import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/teachers/stats - Get teacher performance statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const teacherId = id || auth.userId;

    // Verify teacher profile exists
    const teacher = await db.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    // School context check
    const userSchoolId = auth.schoolId;
    if (userSchoolId && teacher.schoolId !== userSchoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all classes taught by this teacher (either as class teacher or subject teacher)
    const [classTeacherClasses, subjectTeacherClasses] = await Promise.all([
      db.class.findMany({
        where: { classTeacherId: teacherId, schoolId: teacher.schoolId },
        select: { id: true, name: true, _count: { select: { students: true } } },
      }),
      db.classSubject.findMany({
        where: { teacherId: teacherId, class: { schoolId: teacher.schoolId } },
        select: { class: { select: { id: true, name: true, _count: { select: { students: true } } } } },
      }),
    ]);

    const allClassIds = new Set<string>();
    const classMap = new Map<string, { name: string; studentCount: number }>();

    classTeacherClasses.forEach(cls => {
      allClassIds.add(cls.id);
      classMap.set(cls.id, { name: cls.name, studentCount: cls._count?.students || 0 });
    });

    subjectTeacherClasses.forEach(cs => {
      if (cs.class) {
        allClassIds.add(cs.class.id);
        const count = cs.class._count?.students || 0;
        classMap.set(cs.class.id, { name: cs.class.name, studentCount: count });
      }
    });

    // Get all exams taught by this teacher
    const exams = await db.exam.findMany({
      where: { teacherId, schoolId: teacher.schoolId },
      select: { id: true, classId: true, totalMarks: true, passingMarks: true },
    });

    if (exams.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overallAverageScore: 0,
          overallPassRate: 0,
          totalStudents: 0,
          totalClasses: classMap.size,
          totalExams: 0,
          classPerformances: [],
        },
      });
    }

    // Get all exam scores for these exams (include studentId for counting unique students)
    const examIds = exams.map(e => e.id);
    const examScores = await db.examScore.findMany({
      where: { examId: { in: examIds } },
      select: { score: true, examId: true, studentId: true },
    });

    // Calculate overall metrics
    const scoreValues = examScores.map(s => s.score);
    const totalScores = scoreValues.length;
    const overallAverage = totalScores > 0
      ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / totalScores) * 100) / 100
      : 0;

    // Pass count (score >= passingMarks for each exam)
    const examMap = new Map(exams.map(e => [e.id, e]));
    const passingCount = examScores.filter(es => {
      const exam = examMap.get(es.examId);
      return exam && es.score >= exam.passingMarks;
    }).length;
    const overallPassRate = totalScores > 0
      ? Math.round((passingCount / totalScores) * 100)
      : 0;

    // Calculate per-class averages
    const classExamMap = new Map<string, { scores: number[]; totalMarks: number[] }>();
    exams.forEach(exam => {
      if (!allClassIds.has(exam.classId)) return;
      if (!classExamMap.has(exam.classId)) {
        classExamMap.set(exam.classId, { scores: [], totalMarks: [] });
      }
      classExamMap.get(exam.classId)!.totalMarks.push(exam.totalMarks);
    });

    examScores.forEach(es => {
      const exam = examMap.get(es.examId);
      if (!exam) return;
      const classData = classExamMap.get(exam.classId);
      if (classData) {
        classData.scores.push(es.score);
      }
    });

    const classPerformances = Array.from(classMap.entries()).map(([classId, info]) => {
      const data = classExamMap.get(classId);
      const scores = data?.scores || [];
      const totalMarksList = data?.totalMarks || [];
      const studentCount = info.studentCount;

      let averageScore = 0;
      let classPassRate = 0;
      let totalStudents = 0;

      if (scores.length > 0) {
        const sum = scores.reduce((a, b) => a + b, 0);
        averageScore = Math.round((sum / scores.length) * 100) / 100;
        totalStudents = scores.length;

        // For pass rate, we need to count scores against respective exam passing marks
        let passing = 0;
        examScores.forEach(es => {
          const exam = examMap.get(es.examId);
          if (exam?.classId === classId && es.score >= exam.passingMarks) {
            passing++;
          }
        });
        classPassRate = totalStudents > 0 ? Math.round((passing / totalStudents) * 100) : 0;
      }

      return {
        classId,
        className: info.name,
        averageScore,
        classPassRate,
        studentCount,
        totalExams: totalMarksList.length,
      };
    });

    // Total unique students across all classes
    const totalStudents = new Set(examScores.map(s => s.studentId)).size;

    return NextResponse.json({
      success: true,
      data: {
        overallAverageScore: overallAverage,
        overallPassRate,
        totalStudents,
        totalClasses: classMap.size,
        totalExams: exams.length,
        classPerformances,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
