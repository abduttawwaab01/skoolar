import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, authenticateRequest, getSchoolId } from '@/lib/auth-middleware';

// GET /api/notices - List notices with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const priority = searchParams.get('priority') || '';
    const search = searchParams.get('search') || '';
    const pinned = searchParams.get('pinned');

    // Auth is optional for GET — use schoolId from query or auth token
    const auth = await authenticateRequest(request);
    const schoolId = getSchoolId(request, auth);

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (schoolId) {
      where.schoolId = schoolId;
    }
    if (category && category !== 'all') {
      where.category = category;
    }
    if (priority && priority !== 'all') {
      where.priority = priority;
    }
    if (pinned !== null && pinned !== undefined && pinned !== '') {
      where.pinned = pinned === 'true';
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const notices = await db.schoolNotice.findMany({
      where,
      orderBy: [
        { pinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Calculate stats
    const pinnedCount = notices.filter(n => n.pinned).length;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekCount = notices.filter(n => new Date(n.createdAt) >= oneWeekAgo).length;
    const categories = [...new Set(notices.map(n => n.category))];

    // Sort: pinned first, then by priority (urgent > important > normal), then by date
    const priorityOrder: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
    const sorted = [...notices].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      data: sorted,
      total: sorted.length,
      stats: {
        total: sorted.length,
        pinned: pinnedCount,
        thisWeek: thisWeekCount,
        categories: categories.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/notices - Create a new notice
export async function POST(request: NextRequest) {
  try {
    // Require authentication for POST
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { title, content, category, author, priority, pinned, attachmentsCount, schoolId } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const resolvedSchoolId = schoolId || authResult.schoolId;
    if (!resolvedSchoolId) {
      return NextResponse.json(
        { error: 'School ID is required' },
        { status: 400 }
      );
    }

    const notice = await db.schoolNotice.create({
      data: {
        schoolId: resolvedSchoolId,
        title,
        content,
        category: category || 'general',
        author: author || authResult.schoolName || 'Unknown',
        priority: priority || 'normal',
        pinned: pinned || false,
        attachmentsCount: attachmentsCount || 0,
      },
    });

    return NextResponse.json({ data: notice, message: 'Notice created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/notices - Update a notice
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { id, title, content, category, author, priority, pinned, attachmentsCount } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Notice ID is required' },
        { status: 400 }
      );
    }

    // Check that the notice exists and belongs to the user's school
    const existing = await db.schoolNotice.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (author !== undefined) updateData.author = author;
    if (priority !== undefined) updateData.priority = priority;
    if (pinned !== undefined) updateData.pinned = pinned;
    if (attachmentsCount !== undefined) updateData.attachmentsCount = attachmentsCount;

    const notice = await db.schoolNotice.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: notice, message: 'Notice updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/notices - Soft delete a notice
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Notice ID is required' },
        { status: 400 }
      );
    }

    // Check that the notice exists
    const existing = await db.schoolNotice.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      );
    }

    await db.schoolNotice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'Notice deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
