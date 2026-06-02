import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticateRequest } from '@/lib/auth-middleware';

// GET /api/announcements - List announcements with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const querySchoolId = searchParams.get('schoolId') || '';
    const type = searchParams.get('type') || '';
    const priority = searchParams.get('priority') || '';
    const isPublished = searchParams.get('isPublished');
    const search = searchParams.get('search') || '';
    const classIds = searchParams.get('classIds') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};

    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (isPublished !== null && isPublished !== undefined && isPublished !== '') {
      where.isPublished = isPublished === 'true';
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }
    if (classIds) {
      const classIdArray = classIds.split(',').filter(Boolean);
      if (classIdArray.length > 0) {
        where.OR = [
          { targetClasses: { isEmpty: true } },
          { targetClasses: { hasSome: classIdArray } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      db.announcement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          schoolId: true,
          title: true,
          content: true,
          type: true,
          targetRoles: true,
          targetClasses: true,
          priority: true,
          isPublished: true,
          publishedAt: true,
          expiresAt: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: { id: true, name: true },
          },
        },
      }),
      db.announcement.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/announcements - Create announcement
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();

    const { schoolId, title, content, type, targetRoles, targetClasses, priority, isPublished, expiresAt, createdBy } = body;

    if (!schoolId || !title || !content) {
      return NextResponse.json(
        { error: 'schoolId, title, and content are required' },
        { status: 400 }
      );
    }

    // SECURITY: Verify user belongs to the school they're trying to create announcement for
    // Super admins can create for any school, school admins can only create for their own school
    if (authResult.role !== 'SUPER_ADMIN' && authResult.schoolId !== schoolId) {
      return NextResponse.json(
        { error: 'You can only create announcements for your own school' },
        { status: 403 }
      );
    }

    const announcement = await db.announcement.create({
      data: {
        schoolId,
        title,
        content,
        type: type || 'general',
        targetRoles: targetRoles ? JSON.stringify(targetRoles) : null,
        targetClasses: targetClasses ? JSON.stringify(targetClasses) : null,
        priority: priority || 'normal',
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: createdBy || null,
      },
    });

    return NextResponse.json({ data: announcement, message: 'Announcement created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/announcements - Update announcement
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();
    const { id, schoolId, ...data } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // SECURITY: Verify the announcement belongs to user's school
    const existingAnnouncement = await db.announcement.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!existingAnnouncement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Super admins can edit any school's announcements, school admins only their own
    if (authResult.role !== 'SUPER_ADMIN' && authResult.schoolId !== existingAnnouncement.schoolId) {
      return NextResponse.json(
        { error: 'You can only edit announcements from your own school' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.targetRoles !== undefined) updateData.targetRoles = typeof data.targetRoles === 'string' ? data.targetRoles : JSON.stringify(data.targetRoles);
    if (data.targetClasses !== undefined) updateData.targetClasses = typeof data.targetClasses === 'string' ? data.targetClasses : JSON.stringify(data.targetClasses);
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
      updateData.publishedAt = data.isPublished ? new Date() : null;
    }
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    const announcement = await db.announcement.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: announcement, message: 'Announcement updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/announcements - Delete announcement
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // SECURITY: Verify the announcement belongs to user's school
    const existingAnnouncement = await db.announcement.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!existingAnnouncement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Super admins can delete any school's announcements, school admins only their own
    if (authResult.role !== 'SUPER_ADMIN' && authResult.schoolId !== existingAnnouncement.schoolId) {
      return NextResponse.json(
        { error: 'You can only delete announcements from your own school' },
        { status: 403 }
      );
    }

    await db.announcement.delete({ where: { id } });
    return NextResponse.json({ message: 'Announcement deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
