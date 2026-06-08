import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { deleteFile as r2Delete, isStorageConfigured as r2Configured } from '@/lib/r2-storage';
import { deleteFile as cloudinaryDelete, isStorageConfigured as cloudinaryConfigured } from '@/lib/cloudinary-storage';
import { db } from '@/lib/db';

// DELETE /api/upload/[key]?provider=cloudinary|r2 — Delete a file from storage

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { key } = await params;
    const decodedKey = decodeURIComponent(key);

    if (!decodedKey || decodedKey.includes('..') || decodedKey.startsWith('/')) {
      return NextResponse.json({ success: false, message: 'Invalid file key' }, { status: 400 });
    }

    // Check ownership: only allow deletion if user owns the file or is SUPER_ADMIN
    const user = await db.user.findUnique({
      where: { id: token.id as string },
      select: { role: true, schoolId: true },
    });

    if (user?.role !== 'SUPER_ADMIN') {
      const keyParts = decodedKey.split('/');
      const folder = keyParts.length > 0 ? keyParts[0] : null;
      const ownerId = keyParts.length > 1 ? keyParts[1] : null;

      if (folder === 'avatars' && ownerId === token.id) {
        // user owns this avatar file
      } else if (folder === 'uploads') {
        if (ownerId && ownerId !== user?.schoolId) {
          return NextResponse.json({ success: false, message: 'You do not have permission to delete this file' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, message: 'You do not have permission to delete this file' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') || 'auto';

    if (provider === 'cloudinary') {
      if (!cloudinaryConfigured()) {
        return NextResponse.json({ success: false, message: 'Cloudinary is not configured.' }, { status: 503 });
      }
      const result = await cloudinaryDelete(decodedKey, { resourceType: 'image' });
      if (!result.success) {
        return NextResponse.json({ success: false, message: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'File deleted successfully', data: { key: decodedKey, provider: 'cloudinary' } });
    }

    if (provider === 'r2') {
      if (!r2Configured()) {
        return NextResponse.json({ success: false, message: 'R2 storage is not configured.' }, { status: 503 });
      }
      const result = await r2Delete(decodedKey);
      if (!result.success) {
        return NextResponse.json({ success: false, message: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'File deleted successfully', data: { key: decodedKey, provider: 'r2' } });
    }

    // Auto-detect: try both providers
    let deleted = false;
    let lastError: string | undefined;

    if (cloudinaryConfigured()) {
      const result = await cloudinaryDelete(decodedKey, { resourceType: 'image' });
      if (result.success) {
        deleted = true;
      } else {
        lastError = result.error;
      }
    }

    if (!deleted && r2Configured()) {
      const result = await r2Delete(decodedKey);
      if (result.success) {
        deleted = true;
      }
    }

    if (!deleted) {
      return NextResponse.json({ success: false, message: lastError || 'File not found in any storage provider' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'File deleted successfully', data: { key: decodedKey } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
