import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/feedback - List feedback with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const querySchoolId = searchParams.get('schoolId') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    const userId = searchParams.get('userId') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = { schoolId: targetSchoolId };
    if (status) where.status = status;
    if (category) where.category = category;
    if (userId) where.userId = userId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { response: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.feedback.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          category: true,
          rating: true,
          title: true,
          description: true,
          isAnonymous: true,
          status: true,
          response: true,
          respondedBy: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: { id: true, name: true },
          },
        },
      }),
      db.feedback.count({ where }),
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

// POST /api/feedback - Submit feedback
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    const { schoolId: rawSchoolId, userId, category, rating, title, description, isAnonymous } = body;

    const schoolId = rawSchoolId || auth.schoolId;

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!schoolId || !category || !title) {
      return NextResponse.json(
        { error: 'schoolId, category, and title are required' },
        { status: 400 }
      );
    }

    const feedback = await db.feedback.create({
      data: {
        schoolId,
        userId: userId || null,
        category,
        rating: rating || 5,
        title,
        description: description || null,
        isAnonymous: isAnonymous || false,
        status: 'open',
      },
    });

    return NextResponse.json({ data: feedback, message: 'Feedback submitted successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/feedback - Reply to feedback
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    const { id, response, status, respondedBy } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Feedback id is required' },
        { status: 400 }
      );
    }

    const existing = await db.feedback.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (response && !respondedBy) {
      return NextResponse.json(
        { error: 'respondedBy is required when adding a response' },
        { status: 400 }
      );
    }

    const feedback = await db.feedback.update({
      where: { id },
      data: {
        ...(response !== undefined && { response }),
        ...(status && { status }),
        ...(respondedBy && { respondedBy }),
      },
    });

    // Notify the feedback submitter when a response is added
    if (response && existing.userId && !existing.isAnonymous) {
      await db.notification.create({
        data: {
          schoolId: existing.schoolId,
          userId: existing.userId,
          title: 'Feedback Response Received',
          message: `Your feedback "${existing.title.substring(0, 80)}" has received a response.`,
          type: 'feedback',
          category: 'feedback',
          actionUrl: '/dashboard?view=feedback',
        },
      }).catch(() => { /* non-critical */ });
    }

    return NextResponse.json({ data: feedback, message: 'Feedback updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
