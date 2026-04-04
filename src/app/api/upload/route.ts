import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { uploadFile, getPresignedUploadUrl, generateStorageKey, validateFile, validateMagicBytes, isStorageConfigured } from '@/lib/r2-storage';
import { compressImage, shouldCompress } from '@/lib/file-compression';

// ============================================
// POST /api/upload - Upload file to R2
// ============================================
// Uses native R2 binding on Cloudflare (zero credentials).
// Falls back to S3 API for local development.
//
// Modes:
//   direct    - Multipart form-data upload (default, works everywhere)
//   presigned - Get presigned URL for client-side upload (local dev only)

export async function POST(request: NextRequest) {
  try {
    if (!isStorageConfigured()) {
      return NextResponse.json(
        { success: false, message: 'Cloud storage is not configured. On Cloudflare, ensure the R2 binding is set in wrangler.toml. For local dev, set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.' },
        { status: 503 }
      );
    }

    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'direct';
    const folder = searchParams.get('folder') || 'uploads';

    // Validate folder name (prevent path traversal)
    const safeFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/\.\./g, '');
    if (!safeFolder) {
      return NextResponse.json({ success: false, message: 'Invalid folder name' }, { status: 400 });
    }

    // Presigned URL mode (local dev only — Cloudflare uses direct upload)
    if (mode === 'presigned') {
      const body = await request.json();
      const { fileName, mimeType } = body;

      if (!fileName || !mimeType) {
        return NextResponse.json({ success: false, message: 'fileName and mimeType are required' }, { status: 400 });
      }

      const mockFile = new File([], fileName, { type: mimeType });
      const validation = validateFile(mockFile);
      if (!validation.valid) {
        return NextResponse.json({ success: false, message: validation.error }, { status: 400 });
      }

      const key = generateStorageKey(mockFile, safeFolder);
      const result = await getPresignedUploadUrl(key, mimeType);

      if ('error' in result) {
        return NextResponse.json({ success: false, message: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: {
          uploadUrl: result.url,
          key: result.key,
          publicUrl: result.publicUrl,
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
        },
      });
    }

    // Direct upload (multipart/form-data) — works on Cloudflare & local
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided. Use "file" field in multipart form.' }, { status: 400 });
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ success: false, message: validation.error }, { status: 400 });
    }

    // Validate magic bytes to prevent MIME type spoofing
    const magicValidation = await validateMagicBytes(file);
    if (!magicValidation.valid) {
      return NextResponse.json({ success: false, message: magicValidation.error }, { status: 400 });
    }

    // Compress images before upload
    let uploadFileData: File = file;
    let compressionInfo: { originalSize: number; compressedSize: number; savings: string } | null = null;
    const compressImageParam = searchParams.get('compress');
    if (compressImageParam === 'true' && shouldCompress(file.type) && file.type.startsWith('image/')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const compressed = await compressImage(buffer);
        // Only use compressed if it's actually smaller
        if (compressed.size < buffer.length) {
          compressionInfo = {
            originalSize: compressed.originalSize,
            compressedSize: compressed.size,
            savings: `${Math.round((1 - compressed.size / compressed.originalSize) * 100)}%`,
          };
          uploadFileData = new File([Buffer.from(compressed.buffer)], file.name.replace(/\.[^/.]+$/, '.webp'), { type: 'image/webp' });
        }
      } catch {
        uploadFileData = file;
      }
    }

    const result = await uploadFile(uploadFileData, {
      folder: safeFolder,
      metadata: {
        uploadedBy: String(token.id),
        uploadedByName: String(token.name || ''),
        uploadedAt: new Date().toISOString(),
      },
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        key: result.key,
        url: result.url,
        size: result.size,
        mimeType: result.mimeType,
        category: result.category,
        compression: compressionInfo,
      },
      message: compressionInfo
        ? `File uploaded successfully (compressed ${compressionInfo.savings})`
        : 'File uploaded successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// GET /api/upload?action=status — Storage diagnostics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'status') {
      const { getStorageStatus } = await import('@/lib/r2-storage');
      const status = getStorageStatus();
      return NextResponse.json({ success: true, data: status });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
