'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon, FileVideo, FileAudio, FileText, Loader2, Check, Trash2 } from 'lucide-react';

// ============================================
// Types
// ============================================
interface FileUploaderProps {
  /** Current file URL (if editing) */
  value?: string;
  /** Callback when file is uploaded successfully */
  onChange: (url: string) => void;
  /** Storage folder path: images, videos, audio, documents, avatars, covers, logos, favicons, attachments */
  folder?: string;
  /** Accepted file types (MIME) */
  accept?: string;
  /** Maximum file size in MB */
  maxSizeMB?: number;
  /** Display label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Show preview of uploaded image/video */
  showPreview?: boolean;
  /** Aspect ratio for image preview (e.g., "16/9", "1/1") */
  previewAspect?: string;
  /** Allow removing the current file */
  allowRemove?: boolean;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Upload mode: 'direct' (server upload) or 'presigned' (client-side upload for large files) */
  uploadMode?: 'direct' | 'presigned';
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

// ============================================
// Component
// ============================================
export function FileUploader({
  value,
  onChange,
  folder = 'images',
  accept = 'image/*',
  maxSizeMB,
  label,
  placeholder = 'Click or drag to upload',
  showPreview = true,
  previewAspect,
  allowRemove = true,
  disabled = false,
  uploadMode = 'direct',
}: FileUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Determine file category for icon
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('video/')) return FileVideo;
    if (type.startsWith('audio/')) return FileAudio;
    return FileText;
  };

  const getCategoryLabel = (type: string) => {
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type.startsWith('audio/')) return 'Audio';
    return 'Document';
  };

  const uploadFile = useCallback(async (file: File) => {
    if (disabled) return;

    // Client-side validation
    const maxSize = maxSizeMB ? maxSizeMB * 1024 * 1024 : Infinity;

    if (file.size > maxSize) {
      toast.error(`File is too large. Maximum size: ${maxSizeMB}MB`);
      return;
    }

    if (file.size === 0) {
      toast.error('File is empty.');
      return;
    }

    // Create local preview
    if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }

    setFileName(file.name);
    setStatus('uploading');
    setProgress(0);

    try {
      if (uploadMode === 'presigned' && file.size > 5 * 1024 * 1024) {
        // For large files, use presigned URL (client-side upload directly to R2)
        setProgress(20);
        const presignRes = await fetch(`/api/upload?mode=presigned&folder=${folder}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
          }),
        });
        const presignJson = await presignRes.json();
        setProgress(40);

        if (!presignJson.success) {
          throw new Error(presignJson.message || 'Failed to get upload URL');
        }

        // Upload directly to R2
        const uploadRes = await fetch(presignJson.data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!uploadRes.ok) {
          throw new Error(`Upload to storage failed with status ${uploadRes.status}`);
        }
        setProgress(100);

        onChange(presignJson.data.publicUrl);
        setStatus('success');
        toast.success('File uploaded successfully');
      } else {
        // Direct server-side upload
        const formData = new FormData();
        formData.append('file', file);

        // Simulate progress for server upload
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const res = await fetch(`/api/upload?folder=${folder}`, {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        const json = await res.json();
        setProgress(100);

        if (!json.success) {
          throw new Error(json.message || 'Upload failed');
        }

        onChange(json.data.url);
        setStatus('success');
        toast.success('File uploaded successfully');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setStatus('error');
      toast.error(message);
      // Reset preview on error
      if (!value) {
        setPreviewUrl(value || null);
        setFileName(null);
      }
    }
  }, [disabled, folder, maxSizeMB, onChange, uploadMode, value]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleRemove = () => {
    onChange('');
    setPreviewUrl(null);
    setFileName(null);
    setStatus('idle');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.success('File removed');
  };

  // Determine if current value looks like an image URL
  const isImageUrl = previewUrl && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)/i.test(previewUrl);
  const isVideoUrl = previewUrl && /^https?:\/\/.+\.(mp4|webm|ogg|mov)/i.test(previewUrl);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      <div
        className={`
          relative rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer
          ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${previewUrl ? 'p-2' : 'p-6'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        {/* Upload in progress */}
        {status === 'uploading' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-gray-600 font-medium">Uploading{fileName ? ` ${fileName}` : ''}...</p>
            <Progress value={progress} className="w-full max-w-xs h-2" />
            <p className="text-xs text-gray-400">{progress}%</p>
          </div>
        )}

        {/* Preview existing file */}
        {previewUrl && status !== 'uploading' && (
          <div className="relative group">
            {isImageUrl && showPreview ? (
              <div
                className="relative overflow-hidden rounded-md bg-gray-100 flex items-center justify-center"
                style={previewAspect ? { aspectRatio: previewAspect } : { minHeight: 120, maxHeight: 240 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="object-contain w-full h-full"
                />
              </div>
            ) : isVideoUrl && showPreview ? (
              <div
                className="relative overflow-hidden rounded-md bg-gray-900 flex items-center justify-center"
                style={{ minHeight: 120, maxHeight: 240 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <video
                  src={previewUrl}
                  controls
                  className="object-contain w-full h-full"
                  style={{ maxHeight: 240 }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-md bg-gray-50">
                <div className="w-10 h-10 rounded bg-emerald-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {fileName || 'Uploaded file'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{previewUrl}</p>
                </div>
              </div>
            )}

            {/* Remove button */}
            {allowRemove && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Success badge */}
            {status === 'success' && (
              <div className="absolute top-2 left-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            )}

            {/* Click to replace hint */}
            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                <p className="text-white text-sm font-medium">Click to replace</p>
              </div>
            )}
          </div>
        )}

        {/* Empty state / drop zone */}
        {!previewUrl && status !== 'uploading' && (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Upload className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{placeholder}</p>
              <p className="text-xs text-gray-400 mt-1">
                {maxSizeMB ? `Max ${maxSizeMB}MB` : 'Accepts'} {accept === 'image/*' ? 'images' : accept === 'video/*' ? 'videos' : accept === 'audio/*' ? 'audio' : 'files'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={disabled}
            >
              Choose File
            </Button>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && !previewUrl && (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <X className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-sm text-red-600">Upload failed. Try again.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={disabled}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper: Upload utility hook
// ============================================
export function useFileUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(async (file: File, folder: string = 'images'): Promise<string | null> => {
    setUploading(true);
    setProgress(0);

    try {
      // Use presigned URL for large files
      if (file.size > 5 * 1024 * 1024) {
        const presignRes = await fetch(`/api/upload?mode=presigned&folder=${folder}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
        });
        const presignJson = await presignRes.json();
        if (!presignJson.success) throw new Error(presignJson.message);
        setProgress(50);

        const uploadRes = await fetch(presignJson.data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);
        setProgress(100);
        return presignJson.data.publicUrl;
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/upload?folder=${folder}`, { method: 'POST', body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setProgress(100);
      return json.data.url;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
      return null;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, []);

  return { upload, uploading, progress };
}
