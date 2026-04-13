import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

// GET /api/feedback - List feedback with filters
export async function GET(request: NextRequest) {
  try {
    const authResponse = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if (authResponse instanceof NextResponse) return authResponse;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};

    if (schoolId) where.schoolId = schoolId;
    if (status) where.status = status;
    if (category) where.category = category;
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
    const body = await request.json();

    const { schoolId, userId, category, rating, title, description, isAnonymous } = body;

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
    const authResponse = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if (authResponse instanceof NextResponse) return authResponse;
    
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

    return NextResponse.json({ data: feedback, message: 'Feedback updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
