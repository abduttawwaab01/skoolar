import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { uploadFile as r2Upload, validateFile, validateMagicBytes, isStorageConfigured as r2Configured, getStorageStatus as r2Status } from '@/lib/r2-storage';
import { uploadFile as cloudinaryUpload, isStorageConfigured as cloudinaryConfigured, getStorageStatus as cloudinaryStatus } from '@/lib/cloudinary-storage';
import { compressImage, shouldCompress, AVATAR_IMAGE_OPTIONS } from '@/lib/file-compression';

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) return 'document';
  return 'default';
}

export async function POST(request: NextRequest) {
  try {
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

    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const category = getFileCategory(file.type);
    const useCloudinary = (category === 'image' || category === 'raw') && cloudinaryConfigured();
    const useR2 = category === 'video' || !useCloudinary;

    if (useCloudinary && !cloudinaryConfigured()) {
      return NextResponse.json(
        { success: false, message: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.' },
        { status: 503 }
      );
    }
    if (useR2 && !r2Configured()) {
      return NextResponse.json(
        { success: false, message: 'R2 storage is not configured.' },
        { status: 503 }
      );
    }

    let uploadFileData: File = file;
    let compressionInfo: { originalSize: number; compressedSize: number; savings: string } | null = null;
    const compressImageParam = searchParams.get('compress');
    const isAvatarFolder = safeFolder === 'avatars' || safeFolder.startsWith('avatars/');

    // Compress images before uploading (saves bandwidth and storage at Cloudinary too)
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

    const metadata = {
      uploadedBy: String(token.id),
      uploadedByName: String(token.name || ''),
      uploadedAt: new Date().toISOString(),
    };

    let result;
    if (useCloudinary) {
      result = await cloudinaryUpload(uploadFileData, {
        folder: safeFolder,
        metadata,
      });
    } else {
      result = await r2Upload(uploadFileData, {
        folder: safeFolder,
        metadata,
      });
    }

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
        provider: result.provider,
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
      const r2 = r2Status();
      const cld = cloudinaryStatus();
      return NextResponse.json({
        success: true,
        data: {
          r2,
          cloudinary: cld,
          imagesTo: cld.configured ? 'cloudinary' : 'r2',
          videosTo: 'r2',
          filesTo: cld.configured ? 'cloudinary' : 'r2',
        },
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
