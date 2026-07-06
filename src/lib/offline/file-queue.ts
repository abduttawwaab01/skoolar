import { queueFileUpload, getQueuedFileUploads, updateFileUploadStatus, removeFileUpload } from './db';
import { generateIdempotencyKey } from './idempotency';
import type { QueuedFileUpload } from './types';

let currentSchoolId = '';
let currentUserId = '';

export function setFileQueueContext(schoolId: string, userId: string): void {
  currentSchoolId = schoolId;
  currentUserId = userId;
}

export async function enqueueFileUpload(
  file: File,
  endpoint: string,
): Promise<string> {
  const id = generateIdempotencyKey();

  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const upload: QueuedFileUpload = {
    id,
    fileInfo: {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    },
    fileData,
    endpoint,
    schoolId: currentSchoolId,
    userId: currentUserId,
    createdAt: Date.now(),
    status: 'pending',
    retryCount: 0,
  };

  await queueFileUpload(upload);
  return id;
}

export async function processFileUploads(): Promise<{ uploaded: number; failed: number }> {
  const uploads = await getQueuedFileUploads(currentSchoolId, 'pending');
  let uploaded = 0;
  let failed = 0;

  for (const upload of uploads) {
    try {
      await updateFileUploadStatus(upload.id, 'uploading');

      const blob = dataURLToBlob(upload.fileData);
      const formData = new FormData();
      formData.append('file', blob, upload.fileInfo.name);

      const res = await fetch(upload.endpoint, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await updateFileUploadStatus(upload.id, 'completed');
        await removeFileUpload(upload.id);
        uploaded++;
      } else {
        throw new Error(`Upload failed with status ${res.status}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      await updateFileUploadStatus(upload.id, 'failed', errorMsg);
      failed++;
    }
  }

  return { uploaded, failed };
}

export async function getPendingFileUploadCount(): Promise<number> {
  const uploads = await getQueuedFileUploads(currentSchoolId, 'pending');
  return uploads.length;
}

function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}
