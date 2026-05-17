import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/avif': 'avif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv',
    'video/quicktime': 'mov', 'video/x-msvideo': 'avi',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'oga',
    'audio/webm': 'weba', 'audio/aac': 'aac',
    'application/pdf': 'pdf', 'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt', 'text/csv': 'csv', 'application/zip': 'zip',
  };
  return map[mimeType] || 'bin';
}

const CATEGORY_FOLDERS: Record<string, string> = {
  image: 'images', video: 'videos', audio: 'audio',
  document: 'documents', archive: 'archives', default: 'uploads',
};

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('sheet') || mimeType.includes('presentation') || mimeType === 'text/plain' || mimeType === 'text/csv') return 'document';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'archive';
  return 'default';
}

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/avif'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv'],
};

const MAX_FILE_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  default: 25 * 1024 * 1024,
};

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'audio/mpeg': [[0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]],
  'audio/wav': [[0x52, 0x49, 0x46, 0x46]],
  'audio/ogg': [[0x4F, 0x67, 0x67, 0x53]],
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]],
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]],
};

export function validateFile(file: File): { valid: boolean; error?: string } {
  const category = getFileCategory(file.type);
  const maxSize = MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;
  const allowed = ALLOWED_MIME_TYPES[category];

  if (allowed && !allowed.includes(file.type)) {
    return { valid: false, error: `File type "${file.type}" not allowed. Allowed: ${allowed.join(', ')}` };
  }
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File size (${Math.round(file.size / (1024 * 1024))}MB) exceeds ${maxMB}MB limit.` };
  }
  if (file.size === 0) return { valid: false, error: 'File is empty.' };
  return { valid: true };
}

export async function validateMagicBytes(file: File): Promise<{ valid: boolean; error?: string }> {
  const patterns = MAGIC_BYTES[file.type];
  if (!patterns) return { valid: true };
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const headerSize = Math.min(bytes.length, 12);
    for (const pattern of patterns) {
      let match = true;
      const checkLen = Math.min(pattern.length, headerSize);
      for (let i = 0; i < checkLen; i++) {
        if (bytes[i] !== pattern[i]) { match = false; break; }
      }
      if (match) return { valid: true };
    }
    return { valid: false, error: `File content does not match claimed type "${file.type}". Possible MIME spoofing detected.` };
  } catch {
    return { valid: false, error: 'Failed to read file content for validation.' };
  }
}

export function generateStorageKey(file: File, folder: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = file.name.split('.').pop() || getExtensionFromMime(file.type);
  const filename = `${uuidv4()}.${ext}`;
  return `${folder}/${year}/${month}/${filename}`;
}

export interface UploadResult {
  success: boolean;
  key: string;
  url: string;
  size: number;
  mimeType: string;
  category: string;
  error?: string;
}

export async function uploadFile(
  file: File | Buffer | Uint8Array,
  options: { folder: string; fileName?: string; mimeType?: string; metadata?: Record<string, string> }
): Promise<UploadResult> {
  try {
    const mimeType = options.mimeType || (file instanceof File ? file.type : 'application/octet-stream');
    const category = getFileCategory(mimeType);
    const folder = CATEGORY_FOLDERS[category] || options.folder || 'uploads';

    const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : Buffer.from(file);

    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `skoolar/${folder}`,
          public_id: options.fileName?.replace(/\.[^/.]+$/, '') || uuidv4(),
          resource_type: 'auto',
          format: mimeType.split('/')[1],
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            resolve({ success: false, key: '', url: '', size: 0, mimeType: '', category: 'unknown', error: error?.message || 'Upload failed' });
          } else {
            resolve({
              success: true,
              key: result.public_id,
              url: result.secure_url,
              size: result.bytes,
              mimeType: result.resource_type === 'image' ? `image/${result.format}` : result.format || mimeType,
              category,
            });
          }
        }
      );
      uploadStream.end(buffer);
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return { success: false, key: '', url: '', size: 0, mimeType: '', category: 'unknown', error: message };
  }
}

export async function deleteFile(publicId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
  }
}

export function isStorageConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export function getStorageStatus(): { configured: boolean; mode: string; cloudName: boolean; apiKey: boolean; apiSecret: boolean } {
  return {
    configured: isStorageConfigured(),
    mode: isStorageConfigured() ? 'Cloudinary' : 'Not Configured',
    cloudName: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    apiKey: !!process.env.CLOUDINARY_API_KEY,
    apiSecret: !!process.env.CLOUDINARY_API_SECRET,
  };
}
