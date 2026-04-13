import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// PUT /api/platform/adverts/[id] - Super Admin: update advert
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title, description, contentType, mediaUrl, mediaType, imageUrl,
      linkUrl, linkText, ctaType, htmlContent, buttonColor,
      targetRoles, targetSchools, position, autoSwipeMs, isActive, startsAt, expiresAt,
    } = body;

    const advert = await db.platformAdvert.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(contentType !== undefined && { contentType }),
        ...(mediaUrl !== undefined && { mediaUrl }),
        ...(mediaType !== undefined && { mediaType }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(linkText !== undefined && { linkText }),
        ...(ctaType !== undefined && { ctaType }),
        ...(htmlContent !== undefined && { htmlContent }),
        ...(buttonColor !== undefined && { buttonColor }),
        ...(targetRoles !== undefined && { targetRoles: targetRoles ? JSON.stringify(targetRoles) : null }),
        ...(targetSchools !== undefined && { targetSchools: targetSchools ? JSON.stringify(targetSchools) : null }),
        ...(position !== undefined && { position }),
        ...(autoSwipeMs !== undefined && { autoSwipeMs }),
        ...(isActive !== undefined && { isActive }),
        ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });

    return NextResponse.json({ success: true, data: advert, message: 'Advert updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// DELETE /api/platform/adverts/[id] - Super Admin: delete advert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await db.platformAdvert.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Advert deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
