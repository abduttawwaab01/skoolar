import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/notifications - List notifications for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId') || '';
    const schoolId = searchParams.get('schoolId') || '';
    const isRead = searchParams.get('isRead');
    const type = searchParams.get('type') || '';
    const category = searchParams.get('category') || '';

    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (schoolId) where.schoolId = schoolId;
    if (isRead !== null && isRead !== undefined && isRead !== '') {
      where.isRead = isRead === 'true';
    }
    if (type) where.type = type;
    if (category) where.category = category;

    const [data, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          title: true,
          message: true,
          type: true,
          category: true,
          isRead: true,
          readAt: true,
          actionUrl: true,
          createdAt: true,
          user: {
            select: { id: true, name: true },
          },
        },
      }),
      db.notification.count({ where }),
      userId
        ? db.notification.count({
            where: { userId, isRead: false },
          })
        : Promise.resolve(0),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/notifications - Create notification
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();

    const { userId, schoolId, title, message, type, category, actionUrl } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: 'userId, title, and message are required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const notification = await db.notification.create({
      data: {
        userId,
        schoolId: schoolId || null,
        title,
        message,
        type: type || 'info',
        category: category || 'general',
        actionUrl: actionUrl || null,
      },
    });

    return NextResponse.json({ data: notification, message: 'Notification created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/notifications - Mark as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { ids, markAll, userId } = body;

    if (markAll && userId) {
      // Mark all notifications as read for a user
      const result = await db.notification.updateMany({
        where: { userId, isRead: false },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({
        message: `${result.count} notifications marked as read`,
        updatedCount: result.count,
      });
    }

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'ids array is required (or markAll + userId)' },
        { status: 400 }
      );
    }

    const result = await db.notification.updateMany({
      where: { id: { in: ids } },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `${result.count} notifications marked as read`,
      updatedCount: result.count,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/notifications - Delete notification(s)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids')?.split(',') || [];
    const userId = searchParams.get('userId') || '';
    const deleteAll = searchParams.get('deleteAll');

    if (deleteAll === 'true' && userId) {
      const result = await db.notification.deleteMany({
        where: { userId },
      });
      return NextResponse.json({ message: `${result.count} notifications deleted` });
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Provide ids query param (comma-separated) or deleteAll=true with userId' },
        { status: 400 }
      );
    }

    const result = await db.notification.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ message: `${result.count} notifications deleted` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
