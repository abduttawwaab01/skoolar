'use client';

import { useState, useCallback } from 'react';
import { enqueueFileUpload, processFileUploads } from '@/lib/offline/file-queue';
import { useAppStore } from '@/store/app-store';

interface UploadResult {
  success: boolean;
  data?: { key: string; url: string; size: number; mimeType: string };
  error?: string;
  queued?: boolean;
  mutationId?: string;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const { currentUser } = useAppStore();

  const upload = useCallback(async (
    file: File,
    options?: { folder?: string; compress?: boolean },
  ): Promise<UploadResult> => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      const folder = options?.folder || 'uploads';
      const endpoint = `/api/upload?folder=${folder}${options?.compress ? '&compress=true' : ''}`;
      try {
        const mutationId = await enqueueFileUpload(file, endpoint);
        return {
          success: true,
          queued: true,
          mutationId,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to queue upload',
        };
      }
    }

    setUploading(true);
    setProgress('Uploading...');

    try {
      const folder = options?.folder || 'uploads';
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams({ folder });
      if (options?.compress) params.set('compress', 'true');

      const res = await fetch(`/api/upload?${params}`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Upload failed');
      }

      setProgress('Complete');
      return { success: true, data: result.data };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setProgress(null);
      return { success: false, error: errorMsg };
    } finally {
      setUploading(false);
    }
  }, []);

  const processQueued = useCallback(async () => {
    const result = await processFileUploads();
    return result;
  }, []);

  return { upload, uploading, progress, processQueued };
}
