import { PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Cloudflare R2 Storage
// ============================================
// Two modes of operation:
//
// 1. **Cloudflare Pages (Production)**: Uses native R2 binding via
//    `getRequestContext()` — NO S3 credentials needed!
//    The binding is configured in wrangler.toml.
//
// 2. **Local Development**: Falls back to S3-compatible API using
//    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY env vars.
//
// Free tier: 10GB storage, 10M requests/month, zero egress fees.

// -------------------------------------------
// R2 Binding Access (Cloudflare)
// -------------------------------------------
// When deployed to Cloudflare Pages, the R2 bucket is available
// as a binding through getRequestContext().env.MY_BUCKET
interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<R2Object | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<R2Object | null>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

interface R2Object {
  key: string;
  size: number;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  uploaded: Date;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
}

interface R2Objects {
  objects: R2Object[];
  delimitedPrefixes: string[];
  truncated: boolean;
  cursor?: string;
}

interface R2ListOptions {
  prefix?: string;
  cursor?: string;
  limit?: number;
  delimiter?: string;
}

// Check if we're running on Cloudflare (edge runtime) or Vercel edge
let _isEdgeRuntime: boolean | null = null;

function isRunningOnEdgeRuntime(): boolean {
  if (_isEdgeRuntime !== null) return _isEdgeRuntime;
  // Cloudflare Workers/Pages have access to the cloudflare global
  // Vercel Edge uses process.env.VERCEL
  try {
    // Check for Cloudflare
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('cloudflare:workers');
    if (mod) {
      _isEdgeRuntime = true;
      return true;
    }
  } catch {
    // Not Cloudflare
  }
  // Check for Vercel
  if (process.env.VERCEL === '1' || process.env.VERCEL_URL) {
    _isEdgeRuntime = true;
    return true;
  }
  // Check for any edge runtime indicator
  if (typeof globalThis.__edge_runtime === 'string') {
    _isEdgeRuntime = true;
    return true;
  }
  _isEdgeRuntime = false;
  return false;
}

// Legacy function for backward compatibility
function isRunningOnCloudflare(): boolean {
  return isRunningOnEdgeRuntime();
}

async function getR2Binding(): Promise<R2Bucket | null> {
  if (!isRunningOnCloudflare()) return null;
  try {
    // Use globalThis to access Cloudflare's R2 binding
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (globalThis as any).__cf_context__;
    if (ctx?.env?.MY_BUCKET) {
      return ctx.env.MY_BUCKET as R2Bucket;
    }
    return null;
  } catch {
    return null;
  }
}

// -------------------------------------------
// S3 Client Fallback (Local Development / Vercel)
// -------------------------------------------
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'skoolar';
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.skoolar.org';

let _s3Client: import('@aws-sdk/client-s3').S3Client | null = null;

async function getS3Client() {
  if (_s3Client) return _s3Client;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2 storage is not configured for local development. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env. On Cloudflare, the binding is used automatically.'
    );
  }

  const { S3Client } = await import('@aws-sdk/client-s3');
  _s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return _s3Client;
}

// ============================================
// File Type Configuration
// ============================================
const MAX_FILE_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  default: 25 * 1024 * 1024,
};

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/avif'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'],
  document: [
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'application/zip', 'application/x-rar-compressed',
  ],
};

// ============================================
// Utility Functions
// ============================================
function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) return 'document';
  return 'default';
}

export function validateFile(file: File, category?: string): { valid: boolean; error?: string } {
  const detectedCategory = category || getFileCategory(file.type);
  const maxSize = MAX_FILE_SIZES[detectedCategory] || MAX_FILE_SIZES.default;
  const allowed = ALLOWED_MIME_TYPES[detectedCategory];

  if (allowed && !allowed.includes(file.type)) {
    return { valid: false, error: `File type "${file.type}" not allowed. Allowed: ${allowed.join(', ')}` };
  }
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File size (${Math.round(file.size / (1024 * 1024))}MB) exceeds ${maxMB}MB limit.` };
  }
  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' };
  }
  return { valid: true };
}

export function generateStorageKey(file: File, folder: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = file.name.split('.').pop() || getExtensionFromMime(file.type);
  const filename = `${uuidv4()}.${ext}`;
  return `${folder}/${year}/${month}/${filename}`;
}

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

// ============================================
// Core Storage Operations
// ============================================

export interface UploadResult {
  success: boolean;
  key: string;
  url: string;
  size: number;
  mimeType: string;
  category: string;
  error?: string;
}

/**
 * Upload a file to Cloudflare R2
 * Uses native R2 binding on Cloudflare (zero credentials).
 * Falls back to S3 API for local development.
 */
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
    const buffer = file instanceof File ? await file.arrayBuffer() : file;
    const key = options.fileName || generateStorageKey(
      new File([], 'upload', { type: mimeType }),
      options.folder
    );

    // Try R2 binding first (Cloudflare)
    const r2 = await getR2Binding();
    if (r2) {
      const body = buffer instanceof Uint8Array ? buffer.buffer as ArrayBuffer : buffer;
      await r2.put(key, body, {
        httpMetadata: { contentType: mimeType },
        customMetadata: options.metadata,
      });
      const url = getPublicUrl(key);
      return { success: true, key, url, size: buffer.byteLength, mimeType, category };
    }

    // Fallback to S3 API (local dev)
    const client = await getS3Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer as Buffer | Uint8Array,
      ContentType: mimeType,
      Metadata: options.metadata || {},
    } as PutObjectCommandInput);
    await client.send(command);

    return { success: true, key, url: getPublicUrl(key), size: buffer.byteLength, mimeType, category };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return { success: false, key: '', url: '', size: 0, mimeType: '', category: 'unknown', error: message };
  }
}

/**
 * Delete a file from Cloudflare R2
 */
export async function deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const r2 = await getR2Binding();
    if (r2) {
      await r2.delete(key);
      return { success: true };
    }

    const client = await getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    return { success: false, error: message };
  }
}

/**
 * Check if a file exists in R2
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const r2 = await getR2Binding();
    if (r2) {
      const obj = await r2.head(key);
      return !!obj;
    }

    const client = await getS3Client();
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the public URL for a storage key
 */
export function getPublicUrl(key: string): string {
  if (CDN_URL) {
    const base = CDN_URL.replace(/\/+$/, '');
    const cleanKey = key.replace(/^\/+/, '');
    return `${base}/${cleanKey}`;
  }
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;
}

/**
 * Get a presigned URL for direct browser uploads (large files)
 * Note: This only works via S3 API (local dev). On Cloudflare,
 * use the direct upload endpoint instead (/api/upload with multipart form-data).
 */
export async function getPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn: number = 3600
): Promise<{ url: string; key: string; publicUrl: string } | { error: string }> {
  try {
    // On Cloudflare, presigned URLs via S3 API don't work well.
    // Direct upload via the API endpoint is recommended.
    const r2 = await getR2Binding();
    if (r2) {
      return { error: 'Presigned URLs are not supported on Cloudflare. Use direct upload via /api/upload instead.' };
    }

    const client = await getS3Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: key, ContentType: mimeType,
    });
    const url = await getSignedUrl(client, command, { expiresIn });
    return { url, key, publicUrl: getPublicUrl(key) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate presigned URL';
    return { error: message };
  }
}

/**
 * Check if R2 storage is properly configured
 */
export function isStorageConfigured(): boolean {
  // On Cloudflare, binding is always "configured"
  if (isRunningOnCloudflare()) return true;
  // In local dev, check for S3 credentials
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

/**
 * Get storage configuration status (for admin diagnostics)
 */
export function getStorageStatus(): {
  configured: boolean;
  mode: string;
  accountId: boolean;
  accessKey: boolean;
  secretKey: boolean;
  bucketName: string;
  publicUrl: string;
} {
  const onEdge = isRunningOnEdgeRuntime();
  return {
    configured: onEdge || !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY),
    mode: onEdge ? 'R2 Binding (Edge Runtime)' : (R2_ACCOUNT_ID ? 'S3 API (Local Dev/Vercel)' : 'Not Configured'),
    accountId: !!R2_ACCOUNT_ID || onEdge,
    accessKey: !!R2_ACCESS_KEY_ID || onEdge,
    secretKey: !!R2_SECRET_ACCESS_KEY || onEdge,
    bucketName: onEdge ? R2_BUCKET_NAME || 'skoolar (binding)' : R2_BUCKET_NAME || '(not set)',
    publicUrl: CDN_URL || '(not set)',
  };
}
