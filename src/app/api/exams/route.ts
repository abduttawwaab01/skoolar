import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { validateParentChild } from '@/lib/api-helpers';

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
    const studentId = searchParams.get('studentId') || '';
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
    if (subjectId) where.subjectId = subjectId;
    if (type) where.type = type;
    if (isPublished !== null && isPublished !== undefined && isPublished !== '') {
      where.isPublished = isPublished === 'true';
    }

    // Collect OR conditions to avoid overwriting (same pattern as homework fix)
    const orConditions: Record<string, unknown>[] = [];

    // STUDENT role: only see published exams for their class
    if (auth.role === 'STUDENT') {
      where.isPublished = true;
      if (classId) {
        where.classId = classId;
      } else {
        const student = await db.student.findUnique({
          where: { userId: auth.userId },
          select: { classId: true },
        });
        if (student?.classId) {
          where.classId = student.classId;
        }
      }
    }

    // TEACHER role: only see exams for their classes
    if (auth.role === 'TEACHER' && !teacherId) {
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: {
          id: true,
          classes: { select: { id: true } },
          classSubjects: { select: { classId: true } },
        },
      });
      if (teacher) {
        const teacherClassIds = new Set<string>();
        teacher.classes.forEach(c => teacherClassIds.add(c.id));
        teacher.classSubjects.forEach(cs => teacherClassIds.add(cs.classId));
        if (teacherClassIds.size > 0) {
          orConditions.push(
            { teacherId: teacher.id },
            { classId: { in: Array.from(teacherClassIds) } },
          );
        } else {
          where.teacherId = teacher.id;
        }
      }
    } else if (teacherId) {
      where.teacherId = teacherId;
    }

    // PARENT role: see exams for their children's classes
    if (auth.role === 'PARENT') {
      if (!auth.userId) {
        return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
      }
      const parentRecord = await db.parent.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (!parentRecord) {
        return NextResponse.json({ data: [], total: 0, page, totalPages: 0 });
      }
      if (studentId) {
        const hasAccess = await validateParentChild(auth.userId, studentId);
        if (!hasAccess) {
          return NextResponse.json({ error: 'You do not have access to this student' }, { status: 403 });
        }
        const student = await db.student.findUnique({
          where: { id: studentId },
          select: { classId: true },
        });
        if (student?.classId) {
          where.classId = student.classId;
        }
      } else {
        const children = await db.studentParent.findMany({
          where: { parentId: parentRecord.id },
          select: { student: { select: { classId: true } } },
        });
        const classIds = children
          .map(c => c.student.classId)
          .filter((id): id is string => id !== null);
        if (classIds.length > 0) {
          where.classId = { in: classIds };
        } else {
          return NextResponse.json({ data: [], total: 0, page, totalPages: 0 });
        }
      }
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
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
            select: { scores: true, questions: true },
          },
        },
      }),
      db.exam.count({ where }),
    ]);

    // For STUDENT role: check which exams they have scores for
    // For PARENT role (with studentId): check which exams the child has scores for
    let studentScoreExamIds: Set<string> | undefined;
    if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (student) {
        const scores = await db.examScore.findMany({
          where: {
            studentId: student.id,
            examId: { in: data.map(e => e.id) },
          },
          select: { examId: true },
        });
        studentScoreExamIds = new Set(scores.map(s => s.examId));
      }
    } else if (auth.role === 'PARENT' && studentId) {
      const scores = await db.examScore.findMany({
        where: {
          studentId,
          examId: { in: data.map(e => e.id) },
        },
        select: { examId: true },
      });
      studentScoreExamIds = new Set(scores.map(s => s.examId));
    }

    const enrichedData = data.map((exam) => ({
      ...exam,
      studentHasScore: studentScoreExamIds ? studentScoreExamIds.has(exam.id) : undefined,
    }));

    return NextResponse.json({
      data: enrichedData,
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

    // Auto-resolve termId to current active term if not provided
    let resolvedTermId = termId;
    if (!resolvedTermId) {
      const currentTerm = await db.term.findFirst({
        where: { schoolId: targetSchoolId, isLocked: false },
        orderBy: { startDate: 'desc' },
        select: { id: true },
      });
      if (currentTerm) resolvedTermId = currentTerm.id;
    }

    if (!resolvedTermId || !subjectId || !classId || !name) {
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
      db.term.findUnique({ where: { id: resolvedTermId } }),
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

    // Resolve teacherId and validate class assignment for TEACHER role
    let resolvedTeacherId = teacherId;
    if (auth.role === 'TEACHER') {
      const teacherRecord = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (!teacherRecord) {
        return NextResponse.json({ error: 'Teacher profile not found' }, { status: 403 });
      }
      resolvedTeacherId = teacherRecord.id;

      // Validate teacher is assigned to this class
      const classAccess = await db.class.findFirst({
        where: { id: classId },
        select: { classTeacherId: true },
      });
      const isClassTeacher = classAccess?.classTeacherId === teacherRecord.id;
      const isSubjectTeacher = await db.classSubject.findFirst({
        where: { classId, teacherId: teacherRecord.id },
        select: { id: true },
      });
      if (!isClassTeacher && !isSubjectTeacher) {
        return NextResponse.json({ error: 'You are not assigned to this class' }, { status: 403 });
      }
    } else if (teacherId) {
      const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.schoolId !== targetSchoolId) {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
      }
      resolvedTeacherId = teacherId;
    }

    const exam = await db.exam.create({
      data: {
        schoolId: targetSchoolId,
        termId: resolvedTermId,
        subjectId,
        classId,
        teacherId: resolvedTeacherId,
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
        // Dual-write to ExamSecuritySettings model
        security: securitySettings ? {
          create: mapSecuritySettingsForDb(securitySettings),
        } : undefined,
      },
    });

    return NextResponse.json({ data: exam, message: 'Exam created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
