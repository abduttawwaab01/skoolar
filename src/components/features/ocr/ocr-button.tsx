'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScanText, Upload, Camera, X, Loader2, Check, Copy, FileText } from 'lucide-react';
import { recognizeImage, OCR_LANGUAGES } from '@/lib/ocr/tesseract-worker';

interface OcrUploadButtonProps {
  onTextExtracted: (text: string) => void;
  label?: string;
  className?: string;
}

export function OcrUploadButton({ onTextExtracted, label = 'Scan Document', className }: OcrUploadButtonProps) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState('');
  const [lang, setLang] = useState('eng');
  const [cameraActive, setCameraActive] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleFile = useCallback((file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      setStatusText('Unsupported file type. Please use PNG, JPEG, or PDF.');
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setResult('');
    setProgress(0);
    setStatusText('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleScan = async () => {
    if (!image) return;
    setScanning(true);
    setProgress(0);
    setStatusText('Initializing OCR...');
    try {
      const text = await recognizeImage(image, [lang], (p, s) => {
        setProgress(Math.round(p * 100));
        setStatusText(s || 'Processing...');
      });
      setResult(text);
      setStatusText('Complete');
    } catch (err) {
      setStatusText('OCR failed. Please try again.');
      console.error('OCR error:', err);
    } finally {
      setScanning(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setStatusText('Could not access camera. Check permissions.');
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
        handleFile(file);
      }
    }, 'image/png');
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleInsert = () => {
    onTextExtracted(result);
    setOpen(false);
    resetState();
  };

  const resetState = () => {
    setImage(null);
    setImagePreview(null);
    setResult('');
    setProgress(0);
    setStatusText('');
    setCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const handleClose = () => {
    stopCamera();
    setOpen(false);
    resetState();
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
      >
        <ScanText className="size-4 mr-1.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanText className="size-5 text-indigo-600" />
              OCR Scanner
            </DialogTitle>
            <DialogDescription>
              Upload or capture a document to extract text. Supports PNG, JPEG, BMP, and PDF.
            </DialogDescription>
          </DialogHeader>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="flex-1 rounded-lg border border-muted/80 bg-background px-3 py-1.5 text-sm"
            >
              {OCR_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Camera View */}
          {cameraActive && (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full max-h-[300px] object-contain" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                <Button type="button" size="sm" onClick={capturePhoto} className="bg-white text-black hover:bg-gray-200">
                  <Camera className="size-4 mr-1" /> Capture
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={stopCamera}>
                  <X className="size-4 mr-1" /> Stop
                </Button>
              </div>
            </div>
          )}

          {/* Upload Area */}
          {!cameraActive && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-indigo-500 bg-indigo-50/50' : 'border-muted/60 hover:border-indigo-300 hover:bg-muted/20'
              }`}
            >
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg mx-auto" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); resetState(); }}
                    className="absolute -top-2 -right-2 size-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="size-10 text-muted-foreground/60 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Drop an image or PDF here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground/50">PNG, JPEG, BMP, PDF</p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/bmp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {!cameraActive && (
              <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                <Camera className="size-4 mr-1" /> Use Camera
              </Button>
            )}
            {image && !scanning && (
              <Button type="button" onClick={handleScan} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <ScanText className="size-4 mr-1" /> Scan Document
              </Button>
            )}
            {scanning && (
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {statusText}
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                  <Check className="size-4" /> Extracted Text
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => navigator.clipboard.writeText(result)}
                  >
                    <Copy className="size-3.5 mr-1" /> Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={handleInsert}
                  >
                    <FileText className="size-3.5 mr-1" /> Insert
                  </Button>
                </div>
              </div>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="w-full h-32 rounded-lg border border-muted/80 bg-background p-3 text-sm font-mono resize-y"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
