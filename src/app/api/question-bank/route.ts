import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireFeature } from '@/lib/auth-middleware';

const VALID_QUESTION_TYPES = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'ESSAY', 'MATCHING'] as const;

// GET /api/question-bank - List bank questions with filtering
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const featureCheck = await requireFeature(request, 'question_bank');
    if (featureCheck instanceof NextResponse) return featureCheck;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const schoolId = searchParams.get('schoolId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const classId = searchParams.get('classId') || '';
    const topicId = searchParams.get('topicId') || '';
    const type = searchParams.get('type') || '';
    const difficulty = searchParams.get('difficulty') || '';
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (subjectId) where.subjectId = subjectId;
    if (classId) where.classId = classId;
    if (topicId) where.topicId = topicId;
    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;
    if (isActive === 'true') where.isActive = true;
    else if (isActive === 'false') where.isActive = false;
    if (search) {
      where.OR = [
        { questionText: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      db.questionBank.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subject: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
          topicRel: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      db.questionBank.count({ where }),
    ]);

    return NextResponse.json({
      data: data.map((q) => ({
        ...q,
        options: q.options ? safeJsonParse(q.options) : null,
        correctAnswer: q.correctAnswer ? safeJsonParse(q.correctAnswer) : null,
        tags: q.tags ? safeJsonParse(q.tags) : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/question-bank - Create a bank question
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const featureCheck = await requireFeature(request, 'question_bank');
    if (featureCheck instanceof NextResponse) return featureCheck;

    const body = await request.json();
    const {
      type, questionText, options, correctAnswer, marks, explanation, mediaUrl,
      difficulty, subjectId, classId, topicId, topic, tags,
    } = body;

    if (!type || !questionText) {
      return NextResponse.json({ error: 'type and questionText are required' }, { status: 400 });
    }

    if (!VALID_QUESTION_TYPES.includes(type)) {
      return NextResponse.json({ error: `Invalid question type. Must be one of: ${VALID_QUESTION_TYPES.join(', ')}` }, { status: 400 });
    }

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? (body.schoolId || auth.schoolId) : auth.schoolId;
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const question = await db.questionBank.create({
      data: {
        schoolId: targetSchoolId,
        type,
        questionText,
        options: options ? JSON.stringify(options) : null,
        correctAnswer: correctAnswer !== undefined && correctAnswer !== null ? JSON.stringify(correctAnswer) : null,
        marks: marks ?? 1,
        explanation: explanation || null,
        mediaUrl: mediaUrl || null,
        difficulty: difficulty || 'intermediate',
        subjectId: subjectId || null,
        classId: classId || null,
        topicId: topicId || null,
        topic: topic || null,
        tags: tags ? JSON.stringify(tags) : null,
        createdById: auth.userId!,
      },
    });

    return NextResponse.json({ data: question }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeJsonParse(val: string): unknown {
  try { return JSON.parse(val); } catch { return val; }
}
