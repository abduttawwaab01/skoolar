import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/support - List support tickets with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};

    if (schoolId) where.schoolId = schoolId;
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const [data, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.supportTicket.count({ where }),
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

// POST /api/support - Create support ticket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId, userId, subject, description, category, priority } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { error: 'subject and description are required' },
        { status: 400 }
      );
    }

    const validCategories = ['general', 'billing', 'technical', 'feature_request', 'bug_report'];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `priority must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    const ticket = await db.supportTicket.create({
      data: {
        schoolId: schoolId || null,
        userId: userId || null,
        subject,
        description,
        category: category || 'general',
        priority: priority || 'medium',
      },
    });

    return NextResponse.json({ data: ticket, message: 'Support ticket created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
