'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ScanText, Upload, Camera, X, Loader2, Check, Copy, Download, FileText,
  Trash2, Image as ImageIcon, Search, AlertCircle,
} from 'lucide-react';
import { recognizeMultiple, OCR_LANGUAGES } from '@/lib/ocr/tesseract-worker';
import { useAppStore } from '@/store/app-store';

interface ScannedImage {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'scanning' | 'done' | 'error';
  progress: number;
  result: string;
}

export function OcrScannerView() {
  const [images, setImages] = useState<ScannedImage[]>([]);
  const [lang, setLang] = useState('eng');
  const [scanningAll, setScanningAll] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusText, setStatusText] = useState('');
  const { setCurrentView } = useAppStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      images.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, []);

  const addImage = useCallback((file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) return;
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setImages(prev => [...prev, {
      id,
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
      result: '',
    }]);
  }, []);

  const handleFiles = useCallback((files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      addImage(file);
    }
  }, [addImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
  }, [images]);

  const scanAll = async () => {
    if (images.length === 0) return;
    setScanningAll(true);
    setStatusText('');

    const pendingImages = images.filter(i => i.status === 'pending');
    if (pendingImages.length === 0) { setScanningAll(false); return; }

    const files = pendingImages.map(i => i.file);

    await recognizeMultiple(
      files,
      [lang],
      (index, progress, status) => {
        setImages(prev => prev.map((img, idx) => {
          const pendingIdx = images.filter(i => i.status === 'pending')[index];
          if (img.id === pendingIdx?.id) {
            return { ...img, progress: Math.round(progress * 100), status: img.status === 'pending' ? 'scanning' as const : img.status };
          }
          return img;
        }));
        setStatusText(`Scanning ${index + 1} of ${files.length}... ${status}`);
      },
      (index, text) => {
        setImages(prev => prev.map((img, idx) => {
          const pendingIdx = images.filter(i => i.status === 'pending')[index];
          if (img.id === pendingIdx?.id) {
            return { ...img, result: text, status: 'done' as const, progress: 100 };
          }
          return img;
        }));
      }
    );

    setScanningAll(false);
    setStatusText(`Completed ${files.length} document${files.length > 1 ? 's' : ''}`);
  };

  const copyAllText = () => {
    const allText = images
      .filter(i => i.result)
      .map((i, idx) => `--- Document ${idx + 1} ---\n${i.result}`)
      .join('\n\n');
    navigator.clipboard.writeText(allText);
  };

  const downloadAsText = () => {
    const allText = images
      .filter(i => i.result)
      .map((i, idx) => `--- Document ${idx + 1} ---\n${i.result}`)
      .join('\n\n');
    const blob = new Blob([allText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-results-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsDoc = () => {
    const allText = images
      .filter(i => i.result)
      .map((i, idx) => `<h2>Document ${idx + 1}</h2><p>${i.result.replace(/\n/g, '<br/>')}</p>`)
      .join('\n');
    const html = `<html><body>${allText}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-results-${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navigateTo = (viewId: string) => {
    setCurrentView(viewId as any);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setStatusText('Could not access camera.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
        addImage(file);
      }
    }, 'image/png');
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const hasResults = images.some(i => i.result);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OCR Scanner</h1>
        <p className="text-muted-foreground mt-1">
          Upload documents, images, or PDFs to extract text using optical character recognition.
          All processing happens in your browser — nothing is uploaded to any server.
        </p>
      </div>

      {/* Language + Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-lg border border-muted/80 bg-background px-3 py-1.5 text-sm"
          >
            {OCR_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 ml-auto">
          {images.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={clearAll}>
                <Trash2 className="size-4 mr-1" /> Clear All
              </Button>
              <Button
                size="sm"
                onClick={scanAll}
                disabled={scanningAll || images.every(i => i.status === 'done')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {scanningAll ? <><Loader2 className="size-4 mr-1 animate-spin" /> Scanning...</> : <><ScanText className="size-4 mr-1" /> Scan All</>}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-indigo-500 bg-indigo-50/50' : 'border-muted/60'
        }`}
      >
        <div className="space-y-3">
          <Upload className="size-12 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Drop files here, or click to browse
          </p>
          <div className="flex justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4 mr-1" /> Browse Files
            </Button>
            {!cameraActive ? (
              <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                <Camera className="size-4 mr-1" /> Camera
              </Button>
            ) : (
              <Button type="button" variant="destructive" size="sm" onClick={stopCamera}>
                <X className="size-4 mr-1" /> Stop Camera
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground/50">PNG, JPEG, BMP, WEBP, PDF</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/bmp,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Camera */}
      {cameraActive && (
        <Card>
          <CardContent className="p-4">
            <div className="relative rounded-lg overflow-hidden bg-black max-w-lg mx-auto">
              <video ref={videoRef} autoPlay playsInline className="w-full max-h-[300px] object-contain" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <Button type="button" size="sm" onClick={capturePhoto} className="bg-white text-black hover:bg-gray-200">
                  <Camera className="size-4 mr-1" /> Capture
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {statusText && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {scanningAll ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-emerald-500" />}
          {statusText}
        </div>
      )}

      {/* Image Gallery + Results */}
      {images.length > 0 && (
        <div className="grid gap-4">
          {images.map((img) => (
            <Card key={img.id} className={`border ${img.status === 'done' ? 'border-emerald-200' : 'border-muted/80'}`}>
              <CardContent className="p-4">
                <div className="flex gap-4 flex-wrap sm:flex-nowrap">
                  {/* Thumbnail */}
                  <div className="relative shrink-0">
                    <img src={img.preview} alt="Document" className="w-24 h-32 object-cover rounded-lg border border-muted/60" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                    >
                      <X className="size-3" />
                    </button>
                    {img.status === 'done' && (
                      <Badge className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-[10px] px-1.5 py-0">Done</Badge>
                    )}
                    {img.status === 'scanning' && (
                      <Badge className="absolute -bottom-1.5 -right-1.5 bg-indigo-500 text-[10px] px-1.5 py-0">
                        <Loader2 className="size-3 animate-spin" />
                      </Badge>
                    )}
                  </div>

                  {/* Result */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">{img.file.name}</p>

                    {img.status === 'scanning' && (
                      <Progress value={img.progress} className="h-1.5" />
                    )}

                    {img.status === 'pending' && !scanningAll && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={async () => {
                            try {
                              const { recognizeImage } = await import('@/lib/ocr/tesseract-worker');
                              setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'scanning' as const } : i));
                              const text = await recognizeImage(img.file, [lang], (p) => {
                                setImages(prev => prev.map(i => i.id === img.id ? { ...i, progress: Math.round(p * 100) } : i));
                              });
                              setImages(prev => prev.map(i => i.id === img.id ? { ...i, result: text, status: 'done' as const, progress: 100 } : i));
                            } catch {
                              setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error' as const } : i));
                            }
                          }}
                        >
                          <ScanText className="size-3 mr-1" /> Scan
                        </Button>
                      </div>
                    )}

                    {img.status === 'done' && (
                      <>
                        <textarea
                          value={img.result}
                          onChange={(e) => setImages(prev => prev.map(i => i.id === img.id ? { ...i, result: e.target.value } : i))}
                          className="w-full h-24 rounded-lg border border-muted/80 bg-background p-2.5 text-xs font-mono resize-y"
                        />
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => navigator.clipboard.writeText(img.result)}>
                            <Copy className="size-3 mr-1" /> Copy
                          </Button>
                        </div>
                      </>
                    )}

                    {img.status === 'error' && (
                      <div className="flex items-center gap-2 text-xs text-red-500">
                        <AlertCircle className="size-3" /> Scan failed
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {hasResults && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
              <Check className="size-4" /> Actions
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyAllText}>
                <Copy className="size-4 mr-1" /> Copy All Text
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAsText}>
                <Download className="size-4 mr-1" /> Download .txt
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAsDoc}>
                <Download className="size-4 mr-1" /> Download .doc
              </Button>
            </div>
            <div className="pt-2 border-t border-emerald-200">
              <p className="text-xs text-emerald-700 mb-2 font-medium">Send extracted text to...</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="bg-white" onClick={() => navigateTo('lesson-plans')}>
                  <FileText className="size-4 mr-1" /> Lesson Plans
                </Button>
                <Button variant="outline" size="sm" className="bg-white" onClick={() => navigateTo('exams')}>
                  <FileText className="size-4 mr-1" /> Exam Questions
                </Button>
                <Button variant="outline" size="sm" className="bg-white" onClick={() => navigateTo('teacher-homework')}>
                  <FileText className="size-4 mr-1" /> Homework
                </Button>
                <Button variant="outline" size="sm" className="bg-white" onClick={() => navigateTo('documents')}>
                  <FileText className="size-4 mr-1" /> Documents
                </Button>
                <Button variant="outline" size="sm" className="bg-white" onClick={() => navigateTo('ai-lesson-note-generator')}>
                  <FileText className="size-4 mr-1" /> AI Lesson Notes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
