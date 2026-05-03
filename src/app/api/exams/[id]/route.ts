import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/exams/[id] - Get exam with scores
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        subject: {
          select: { id: true, name: true, code: true },
        },
        class: {
          select: {
            id: true,
            name: true,
            section: true,
            grade: true,
            students: {
              where: { deletedAt: null, isActive: true },
              select: {
                id: true,
                admissionNo: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        term: {
          select: { id: true, name: true },
        },
        teacher: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
        scores: {
          include: {
            student: {
              select: {
                id: true,
                admissionNo: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Calculate score statistics
    const scores = exam.scores.map((s) => s.score);
    const scoreStats = {
      totalStudents: scores.length,
      average: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0,
      highest: scores.length > 0 ? Math.max(...scores) : 0,
      lowest: scores.length > 0 ? Math.min(...scores) : 0,
      passed: scores.filter((s) => s >= exam.passingMarks).length,
      failed: scores.filter((s) => s < exam.passingMarks).length,
      passRate: scores.length > 0 ? Math.round((scores.filter((s) => s >= exam.passingMarks).length / scores.length) * 100) : 0,
    };

    return NextResponse.json({
      data: {
        ...exam,
        scoreStats,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/exams/[id] - Update exam
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted exam' }, { status: 410 });
    }

    const {
      name, type, totalMarks, passingMarks, date, duration, instructions,
      isLocked, isPublished, subjectId, classId, teacherId, termId,
      securitySettings, allowCalculator, calculatorMode,
      shuffleQuestions, shuffleOptions, showResult, negativeMarking,
    } = body;

    const exam = await db.exam.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(totalMarks !== undefined && { totalMarks }),
        ...(passingMarks !== undefined && { passingMarks }),
        ...(date !== undefined && { date: date ? new Date(date) : null }),
        ...(duration !== undefined && { duration }),
        ...(instructions !== undefined && { instructions }),
        ...(isLocked !== undefined && { isLocked }),
        ...(isPublished !== undefined && { isPublished }),
        ...(subjectId && { subjectId }),
        ...(classId && { classId }),
        ...(teacherId !== undefined && { teacherId }),
        ...(termId && { termId }),
        ...(securitySettings !== undefined && { securitySettings: securitySettings ? JSON.stringify(securitySettings) : null }),
        ...(allowCalculator !== undefined && { allowCalculator }),
        ...(calculatorMode !== undefined && { calculatorMode }),
        ...(shuffleQuestions !== undefined && { shuffleQuestions }),
        ...(shuffleOptions !== undefined && { shuffleOptions }),
        ...(showResult !== undefined && { showResult }),
        ...(negativeMarking !== undefined && { negativeMarking }),
      },
    });

    return NextResponse.json({ data: exam, message: 'Exam updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/exams/[id] - Publish/unlock exam results
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const { action } = body; // 'publish', 'unpublish', 'lock', 'unlock'

    const updates: Record<string, unknown> = {};
    switch (action) {
      case 'publish':
        updates.isPublished = true;
        updates.isLocked = true;
        break;
      case 'unpublish':
        updates.isPublished = false;
        break;
      case 'lock':
        updates.isLocked = true;
        break;
      case 'unlock':
        updates.isLocked = false;
        updates.isPublished = false;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: publish, unpublish, lock, or unlock' },
          { status: 400 }
        );
    }

    const exam = await db.exam.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ data: exam, message: `Exam ${action}ed successfully` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
