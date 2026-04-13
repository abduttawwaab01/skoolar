import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/exams - List exams with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const termId = searchParams.get('termId') || '';
    const classId = searchParams.get('classId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const teacherId = searchParams.get('teacherId') || '';
    const type = searchParams.get('type') || '';
    const isPublished = searchParams.get('isPublished');

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    // School context validation
    const userSchoolId = auth.schoolId;
    if (userSchoolId) {
      where.schoolId = userSchoolId;
    } else if (schoolId) {
      where.schoolId = schoolId;
    }

    if (termId) where.termId = termId;
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (teacherId) where.teacherId = teacherId;
    if (type) where.type = type;
    if (isPublished !== null && isPublished !== undefined && isPublished !== '') {
      where.isPublished = isPublished === 'true';
    }

    const [data, total] = await Promise.all([
      db.exam.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          schoolId: true,
          termId: true,
          subjectId: true,
          classId: true,
          teacherId: true,
          name: true,
          type: true,
          totalMarks: true,
          passingMarks: true,
          date: true,
          duration: true,
          isLocked: true,
          isPublished: true,
          allowCalculator: true,
          calculatorMode: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          showResult: true,
          negativeMarking: true,
          createdAt: true,
          updatedAt: true,
          subject: {
            select: { id: true, name: true, code: true },
          },
          class: {
            select: { id: true, name: true, section: true, grade: true },
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
          _count: {
            select: { scores: true },
          },
        },
      }),
      db.exam.count({ where }),
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

// POST /api/exams - Create exam
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const {
      schoolId, termId, subjectId, classId, teacherId, name, type,
      totalMarks, passingMarks, date, duration, instructions,
      securitySettings, allowCalculator, calculatorMode,
      shuffleQuestions, shuffleOptions, showResult, negativeMarking,
    } = body;

    // School context: use auth's schoolId if user is not SUPER_ADMIN
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!termId || !subjectId || !classId || !name) {
      return NextResponse.json(
        { error: 'termId, subjectId, classId, and name are required' },
        { status: 400 }
      );
    }

    // Validate security settings if provided
    if (securitySettings !== undefined) {
      if (typeof securitySettings !== 'object' || securitySettings === null || Array.isArray(securitySettings)) {
        return NextResponse.json(
          { error: 'securitySettings must be an object' },
          { status: 400 }
        );
      }
      const validKeys = ['fullscreen', 'tabSwitchWarning', 'tabSwitchAutoSubmit', 'blockCopyPaste', 'blockRightClick', 'blockKeyboardShortcuts', 'maxTabSwitches', 'webcamMonitor'];
      for (const key of Object.keys(securitySettings)) {
        if (!validKeys.includes(key)) {
          return NextResponse.json(
            { error: `Invalid security setting: ${key}` },
            { status: 400 }
          );
        }
      }
    }

    // Validate calculator settings
    if (calculatorMode !== undefined && !['none', 'basic', 'scientific', 'both'].includes(calculatorMode)) {
      return NextResponse.json(
        { error: 'calculatorMode must be one of: none, basic, scientific, both' },
        { status: 400 }
      );
    }

    // Validate references - verify they belong to the user's school
    const [term, subject, cls] = await Promise.all([
      db.term.findUnique({ where: { id: termId } }),
      db.subject.findUnique({ where: { id: subjectId } }),
      db.class.findUnique({ where: { id: classId } }),
    ]);

    if (!term) return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

    // Verify all resources belong to the school
    if (term.schoolId !== targetSchoolId || subject.schoolId !== targetSchoolId || cls.schoolId !== targetSchoolId) {
      return NextResponse.json({ error: 'Invalid school context' }, { status: 403 });
    }

    if (teacherId) {
      const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.schoolId !== targetSchoolId) {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
      }
    }

    const exam = await db.exam.create({
      data: {
        schoolId: targetSchoolId,
        termId,
        subjectId,
        classId,
        teacherId: teacherId || null,
        name,
        type: type || 'assessment',
        totalMarks: totalMarks || 100,
        passingMarks: passingMarks || 50,
        date: date ? new Date(date) : null,
        duration: duration || null,
        instructions: instructions || null,
        securitySettings: securitySettings ? JSON.stringify(securitySettings) : null,
        allowCalculator: allowCalculator !== undefined ? allowCalculator : true,
        calculatorMode: calculatorMode || 'basic',
        shuffleQuestions: shuffleQuestions || false,
        shuffleOptions: shuffleOptions || false,
        showResult: showResult !== undefined ? showResult : true,
        negativeMarking: negativeMarking !== undefined ? negativeMarking : 0,
      },
    });

    return NextResponse.json({ data: exam, message: 'Exam created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
