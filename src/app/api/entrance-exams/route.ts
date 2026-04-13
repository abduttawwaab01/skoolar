import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// Generate a random 6-character alphanumeric code
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/entrance-exams - List entrance exams
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 });
    }

    const where = {
      schoolId: schoolId,
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      db.entranceExam.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              attempts: true,
              questions: true,
            }
          }
        }
      }),
      db.entranceExam.count({ where }),
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

// POST /api/entrance-exams - Create an entrance exam
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title, description, type, totalMarks, passingMarks, duration, instructions,
      allowCalculator, calculatorMode, shuffleQuestions, shuffleOptions
    } = body;
    
    let { schoolId } = body;
    schoolId = schoolId || auth.schoolId;

    if (!title || !schoolId) {
      return NextResponse.json({ error: 'Title and School ID are required' }, { status: 400 });
    }

    // Generate a unique code
    let isUnique = false;
    let code = '';
    while (!isUnique) {
      code = generateCode();
      const existing = await db.entranceExam.findUnique({ where: { code } });
      if (!existing) isUnique = true;
    }

    const exam = await db.entranceExam.create({
      data: {
        schoolId,
        title,
        description: description || null,
        code,
        type: type || 'assessment',
        totalMarks: totalMarks || 100,
        passingMarks: passingMarks || 50,
        duration: duration || null,
        instructions: instructions || null,
        allowCalculator: allowCalculator !== undefined ? allowCalculator : true,
        calculatorMode: calculatorMode || 'basic',
        shuffleQuestions: shuffleQuestions || false,
        shuffleOptions: shuffleOptions || false,
        isActive: true,
      },
    });

    return NextResponse.json({ data: exam, message: 'Entrance exam created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
