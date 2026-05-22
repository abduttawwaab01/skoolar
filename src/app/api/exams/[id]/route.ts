import { db } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';
import { resolveTeacherId } from '@/lib/api-helpers';

// Maps frontend security settings naming to Prisma ExamSecuritySettings model fields
function mapSecuritySettingsForDb(settings: Record<string, unknown>) {
  const ss: Record<string, unknown> = {};
  if (settings.fullscreen !== undefined) ss.fullscreenMode = settings.fullscreen;
  if (settings.tabSwitchWarning !== undefined) ss.monitorTabSwitch = settings.tabSwitchWarning;
  if (settings.tabSwitchAutoSubmit !== undefined) ss.tabSwitchAutoSubmit = settings.tabSwitchAutoSubmit;
  if (settings.maxTabSwitches !== undefined) ss.maxTabSwitches = settings.maxTabSwitches;
  if (settings.blockCopyPaste !== undefined) ss.blockCopyPaste = settings.blockCopyPaste;
  if (settings.blockRightClick !== undefined) ss.blockRightClick = settings.blockRightClick;
  if (settings.blockKeyboardShortcuts !== undefined) ss.blockKeyboardShortcuts = settings.blockKeyboardShortcuts;
  if (settings.webcamMonitor !== undefined) ss.monitorWebcam = settings.webcamMonitor;
  return ss;
}

// GET /api/exams/[id] - Get exam with scores
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

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
        security: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && exam.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Role-based data access
    const adminRoles = ['TEACHER', 'DIRECTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'];
    const isAdmin = adminRoles.includes(auth.role || '');

    // Only include scores for authorized roles (teachers, directors, admins)
    let scores: Array<Record<string, unknown>> = [];
    if (isAdmin) {
      scores = await db.examScore.findMany({
        where: { examId: id },
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
      });
    }

    // Calculate score statistics
    const scoreValues = scores.map((s) => (s.score as number) || 0);
    const scoreStats = {
      totalStudents: scoreValues.length,
      average: scoreValues.length > 0 ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 100) / 100 : 0,
      highest: scoreValues.length > 0 ? Math.max(...scoreValues) : 0,
      lowest: scoreValues.length > 0 ? Math.min(...scoreValues) : 0,
      passed: scoreValues.filter((s) => s >= (exam.passingMarks || 0)).length,
      failed: scoreValues.filter((s) => s < (exam.passingMarks || 0)).length,
      passRate: scoreValues.length > 0 ? Math.round((scoreValues.filter((s) => s >= (exam.passingMarks || 0)).length / scoreValues.length) * 100) : 0,
    };

    return NextResponse.json({
      data: {
        ...exam,
        scores,
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

    if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted exam' }, { status: 410 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Teachers can only update their own exams
    if (auth.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(auth.userId || '');
      if (!teacherId || existing.teacherId !== teacherId) {
        return NextResponse.json({ error: 'You can only update your own exams' }, { status: 403 });
      }
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

    // Dual-write ExamSecuritySettings if provided
    if (securitySettings !== undefined) {
      await db.examSecuritySettings.upsert({
        where: { examId: id },
        create: { examId: id, ...mapSecuritySettingsForDb(securitySettings) },
        update: mapSecuritySettingsForDb(securitySettings),
      });
    }

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
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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

// DELETE /api/exams/[id] - Soft-delete an exam
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Exam already deleted' }, { status: 410 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Teachers can only delete their own exams
    if (auth.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(auth.userId || '');
      if (!teacherId || existing.teacherId !== teacherId) {
        return NextResponse.json({ error: 'You can only delete your own exams' }, { status: 403 });
      }
    }

    await db.exam.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'Exam deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
