import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'raw';
}

function getResourceType(mimeType: string): 'image' | 'raw' | 'video' | 'auto' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}

export interface UploadResult {
  success: boolean;
  key: string;
  url: string;
  size: number;
  mimeType: string;
  category: string;
  provider: 'cloudinary';
  error?: string;
}

export async function uploadFile(
  file: File | Buffer | Uint8Array,
  options: {
    folder: string;
    fileName?: string;
    mimeType?: string;
    metadata?: Record<string, string>;
  }
): Promise<UploadResult> {
  try {
    const mimeType = options.mimeType || (file instanceof File ? file.type : 'application/octet-stream');
    const category = getFileCategory(mimeType);
    const resourceType = getResourceType(mimeType);
    const rawBuffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : Buffer.from(file);
    const publicId = options.fileName?.replace(/\.[^.]+$/, '') || uuidv4();
    const folder = options.folder;

    const base64 = rawBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;

    const uploadOptions: any = {
      folder,
      public_id: publicId,
      resource_type: resourceType,
      overwrite: true,
    };

    if (resourceType === 'image') {
      uploadOptions.quality = 'auto';
      uploadOptions.fetch_format = 'auto';
      uploadOptions.flags = 'lossy';
    }

    if (options.metadata && Object.keys(options.metadata).length > 0) {
      uploadOptions.context = Object.entries(options.metadata)
        .map(([k, v]) => `${k}=${v}`)
        .join('|');
    }

    const result = await cloudinary.uploader.upload(dataUri, uploadOptions);

    return {
      success: true,
      key: result.public_id,
      url: result.secure_url,
      size: result.bytes,
      mimeType,
      category,
      provider: 'cloudinary',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cloudinary upload failed';
    return {
      success: false, key: '', url: '', size: 0,
      mimeType: options.mimeType || '', category: 'unknown',
      provider: 'cloudinary', error: message,
    };
  }
}

export async function deleteFile(
  publicId: string,
  options?: { resourceType?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: options?.resourceType || 'image',
      invalidate: true,
    });
    if (result.result === 'ok' || result.result === 'not found') {
      return { success: true };
    }
    return { success: false, error: result.result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cloudinary delete failed';
    return { success: false, error: message };
  }
}

export function isStorageConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export function getPublicUrl(publicId: string): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
}

export function getStorageStatus(): {
  configured: boolean;
  cloudName: boolean;
  apiKey: boolean;
  apiSecret: boolean;
} {
  return {
    configured: isStorageConfigured(),
    cloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: !!process.env.CLOUDINARY_API_KEY,
    apiSecret: !!process.env.CLOUDINARY_API_SECRET,
  };
}
