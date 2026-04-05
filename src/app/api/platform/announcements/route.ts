import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/platform/announcements - Fetch active announcements with targeting filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    const now = new Date();
    const where: Record<string, unknown> = {
      isActive: true,
      startsAt: { lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } },
      ],
    };

    if (type) where.type = type;

    // Fetch all active announcements within date range
    const allAnnouncements = await db.platformAnnouncement.findMany({
      where,
      take: limit,
      orderBy: [{ startsAt: 'desc' }],
    });

    // Get session to filter by user role/school
    const session = await getServerSession(authOptions);

    // Filter based on targeting
    const filtered = allAnnouncements.filter((ann) => {
      // Parse targetRoles and targetSchools (stored as JSON strings)
      let targetRoles: string[] = [];
      let targetSchools: string[] = [];

      if (ann.targetRoles) {
        try {
          targetRoles = JSON.parse(ann.targetRoles);
          if (!Array.isArray(targetRoles)) targetRoles = [];
        } catch {
          targetRoles = [];
        }
      }

      if (ann.targetSchools) {
        try {
          targetSchools = JSON.parse(ann.targetSchools);
          if (!Array.isArray(targetSchools)) targetSchools = [];
        } catch {
          targetSchools = [];
        }
      }

      if (session?.user) {
        // Authenticated user: must match role and school if targeting is set
        if (targetRoles.length > 0 && !targetRoles.includes(session.user.role as string)) {
          return false;
        }
        if (targetSchools.length > 0 && !targetSchools.includes(session.user.schoolId as string)) {
          return false;
        }
        return true;
      } else {
        // Public user: only see announcements with no targeting (both empty or null)
        return targetRoles.length === 0 && targetSchools.length === 0;
      }
    });

    return NextResponse.json({ success: true, data: filtered });
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
