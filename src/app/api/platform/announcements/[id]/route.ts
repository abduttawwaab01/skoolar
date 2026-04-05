import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// PUT /api/platform/announcements/[id] - Super Admin: update announcement
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
    const { title, message, type, targetRoles, targetSchools, linkUrl, isActive, startsAt, expiresAt } = body;

    const announcement = await db.platformAnnouncement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(message !== undefined && { message }),
        ...(type !== undefined && { type }),
        ...(targetRoles !== undefined && { targetRoles: targetRoles ? JSON.stringify(targetRoles) : null }),
        ...(targetSchools !== undefined && { targetSchools: targetSchools ? JSON.stringify(targetSchools) : null }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(isActive !== undefined && { isActive }),
        ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });

    return NextResponse.json({ success: true, data: announcement, message: 'Announcement updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// DELETE /api/platform/announcements/[id] - Super Admin: delete announcement
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
    await db.platformAnnouncement.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Announcement deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
