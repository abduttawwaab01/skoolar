import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { uploadFile, validateFile, validateMagicBytes, isStorageConfigured, getStorageStatus } from '@/lib/r2-storage';
import { compressImage, shouldCompress, AVATAR_IMAGE_OPTIONS } from '@/lib/file-compression';

export async function POST(request: NextRequest) {
  try {
    if (!isStorageConfigured()) {
      return NextResponse.json(
        { success: false, message: 'Cloud storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env, or deploy to Cloudflare Pages with R2 binding.' },
        { status: 503 }
      );
    }

    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'uploads';
    const safeFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/\.\./g, '');
    if (!safeFolder) {
      return NextResponse.json({ success: false, message: 'Invalid folder name' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided. Use "file" field in multipart form.' }, { status: 400 });
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ success: false, message: validation.error }, { status: 400 });
    }

    const magicValidation = await validateMagicBytes(file);
    if (!magicValidation.valid) {
      return NextResponse.json({ success: false, message: magicValidation.error }, { status: 400 });
    }

    let uploadFileData: File = file;
    let compressionInfo: { originalSize: number; compressedSize: number; savings: string } | null = null;
    const compressImageParam = searchParams.get('compress');
    const isAvatarFolder = safeFolder === 'avatars' || safeFolder.startsWith('avatars/');

    if (compressImageParam === 'true' && shouldCompress(file.type) && file.type.startsWith('image/')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const compressionOptions = isAvatarFolder ? AVATAR_IMAGE_OPTIONS : undefined;
        const compressed = await compressImage(buffer, compressionOptions);
        if (compressed.size < buffer.length) {
          compressionInfo = {
            originalSize: compressed.originalSize,
            compressedSize: compressed.size,
            savings: `${Math.round((1 - compressed.size / compressed.originalSize) * 100)}%`,
          };
          uploadFileData = new File([Buffer.from(compressed.buffer)], file.name.replace(/\.[^/.]+$/, '.webp'), { type: 'image/webp' });
        }
      } catch (compressError) {
        console.error('Image compression failed:', compressError);
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'status') {
      const status = getStorageStatus();
      return NextResponse.json({ success: true, data: status });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
