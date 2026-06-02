import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/term-scores?classId=X&subjectId=X&termId=X&schoolId=X
// Returns all students in the class with their scores grouped by score type
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const classId = searchParams.get('classId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const termId = searchParams.get('termId') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId || !classId || !subjectId || !termId) {
      return NextResponse.json({ error: 'schoolId, classId, subjectId, and termId are required' }, { status: 400 });
    }
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    // Fetch students in class
    const students = await db.student.findMany({
      where: { classId, schoolId: targetSchoolId, deletedAt: null, isActive: true },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { admissionNo: 'asc' },
    });

    // Fetch score types for this school (only midterm and exam for scores input)
    const scoreTypes = (await db.scoreType.findMany({
      where: { schoolId: targetSchoolId, isActive: true },
      orderBy: { position: 'asc' },
    })).filter(st => st.type === 'midterm' || st.type === 'exam');

    // Find or create exams for this combination
    const exams = await db.exam.findMany({
      where: { schoolId: targetSchoolId, classId, subjectId, termId, deletedAt: null },
      include: {
        scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true } },
        scores: true,
      },
    });

    // Build a map of scoreTypeId -> exam for quick lookup
    const examByScoreType = new Map<string, typeof exams[0]>();
    for (const exam of exams) {
      const stId = exam.scoreTypeId || '';
      if (stId && !examByScoreType.has(stId)) {
        examByScoreType.set(stId, exam);
      }
    }

    // Build student score data
    const studentScores = students.map(student => {
      const scores: Record<string, { score: number; examId: string; examName: string }> = {};
      let totalScore = 0;
      let totalMax = 0;

      for (const st of scoreTypes) {
        const exam = examByScoreType.get(st.id);
        const examScore = exam?.scores.find(s => s.studentId === student.id);
        scores[st.id] = {
          score: examScore?.score ?? 0,
          examId: exam?.id || '',
          examName: exam?.name || '',
        };
        if (examScore) {
          totalScore += examScore.score;
          totalMax += exam?.totalMarks || 100;
        }
      }

      return {
        studentId: student.id,
        name: student.user.name,
        admissionNo: student.admissionNo,
        scores,
        totalScore,
        totalMax,
      };
    });

    return NextResponse.json({
      data: {
        students: studentScores,
        scoreTypes,
        exams,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/term-scores - Save scores for a subject+term
// Body: { schoolId, classId, subjectId, termId, scores: [{ studentId, scoreTypeId, score }] }
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolId: bodySchoolId, classId, subjectId, termId, scores } = body;
    // SECURITY: Auth token schoolId wins. Body is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');

    if (!targetSchoolId || !classId || !subjectId || !termId || !scores?.length) {
      return NextResponse.json({ error: 'schoolId, classId, subjectId, termId, and scores are required' }, { status: 400 });
    }

    // Verify resources
    const [classRecord, subjectRecord, termRecord] = await Promise.all([
      db.class.findUnique({ where: { id: classId } }),
      db.subject.findUnique({ where: { id: subjectId } }),
      db.term.findUnique({ where: { id: termId } }),
    ]);
    if (!classRecord) return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    if (!subjectRecord) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    if (!termRecord) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

    // Resolve teacher
    let teacherId = '';
    if (auth.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 403 });
      teacherId = teacher.id;
    }

    // Fetch score types to determine maxMarks
    const scoreTypes = await db.scoreType.findMany({
      where: { schoolId: targetSchoolId, isActive: true },
    });
    const scoreTypeMap = new Map(scoreTypes.map(st => [st.id, st]));

    // Group scores by scoreTypeId to create one exam per score type
    const scoresByType = new Map<string, { studentId: string; score: number | null }[]>();
    for (const s of scores) {
      if (!s.scoreTypeId || s.studentId === undefined || s.score === undefined) continue;
      if (!scoresByType.has(s.scoreTypeId)) scoresByType.set(s.scoreTypeId, []);
      scoresByType.get(s.scoreTypeId)!.push({ studentId: s.studentId, score: s.score === null ? null : Number(s.score) });
    }

    const results: Record<string, unknown>[] = [];

    for (const [scoreTypeId, studentScores] of scoresByType) {
      const st = scoreTypeMap.get(scoreTypeId);
      if (!st) continue;

      const maxMarks = st.maxMarks || 100;

      // Find or create exam for this score type
      let exam = await db.exam.findFirst({
        where: { schoolId: targetSchoolId, classId, subjectId, termId, scoreTypeId, deletedAt: null },
      });

      if (!exam) {
        const examName = `${subjectRecord.name} - ${st.name} - ${termRecord.name}`;
        exam = await db.exam.create({
          data: {
            schoolId: targetSchoolId,
            classId,
            subjectId,
            termId,
            teacherId: teacherId || undefined,
            name: examName,
            type: st.type || 'assessment',
            totalMarks: maxMarks,
            passingMarks: Math.round(maxMarks * 0.5),
            scoreTypeId,
            isPublished: true,
            date: new Date(),
          },
        });
      }

      // Upsert or delete student scores
      for (const ss of studentScores) {
        if (ss.score === null) {
          // Score was cleared — delete existing record if any
          await db.examScore.deleteMany({
            where: { examId: exam.id, studentId: ss.studentId },
          });
        } else {
          const existingScore = await db.examScore.findFirst({
            where: { examId: exam.id, studentId: ss.studentId },
          });
          if (existingScore) {
            await db.examScore.update({
              where: { id: existingScore.id },
              data: { score: ss.score },
            });
          } else {
            await db.examScore.create({
              data: {
                examId: exam.id,
                studentId: ss.studentId,
                score: ss.score,
              },
            });
          }
        }
      }

      results.push({ scoreTypeId, examId: exam.id, examName: exam.name, count: studentScores.length });
    }

    return NextResponse.json({ data: results, message: 'Scores saved successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
