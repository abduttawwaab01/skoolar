import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/announcements - Public: fetch active announcements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    const now = new Date();
    const where: Record<string, unknown> = {
      isActive: true,
      startsAt: { lte: now },
    };

    if (type) where.type = type;

    const announcements = await db.platformAnnouncement.findMany({
      where: {
        ...where,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      take: limit,
      orderBy: [{ startsAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: announcements });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/platform/announcements - Super Admin: create announcement
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, type, targetRoles, targetSchools, linkUrl, isActive, startsAt, expiresAt } = body;

    if (!message) {
      return NextResponse.json({ success: false, message: 'Message is required' }, { status: 400 });
    }

    const announcement = await db.platformAnnouncement.create({
      data: {
        title: title || null,
        message,
        type: type || 'info',
        targetRoles: targetRoles ? JSON.stringify(targetRoles) : null,
        targetSchools: targetSchools ? JSON.stringify(targetSchools) : null,
        linkUrl: linkUrl || null,
        isActive: isActive !== undefined ? isActive : true,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: token.id as string,
      },
    });

    return NextResponse.json({ success: true, data: announcement, message: 'Announcement created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
