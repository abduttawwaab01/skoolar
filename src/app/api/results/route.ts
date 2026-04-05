import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/results - Get student results summary with GPA, total, average, rank
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || '';
    const termId = searchParams.get('termId') || '';
    const classId = searchParams.get('classId') || '';
    const schoolId = searchParams.get('schoolId') || '';

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      );
    }

    // Get student info
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true, email: true, avatar: true } },
        class: { select: { id: true, name: true, section: true, grade: true } },
        school: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Build where clause for exam scores
    const where: Record<string, unknown> = { studentId };
    if (termId) where.exam = { termId };
    if (classId) where.exam = { ...((where.exam as Record<string, unknown>) || {}), classId };
    if (schoolId) where.exam = { ...((where.exam as Record<string, unknown>) || {}), schoolId };

    // Get all exam scores for the student - with limit to prevent memory issues
    const examScores = await db.examScore.findMany({
      where,
      include: {
        exam: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            term: { select: { id: true, name: true } },
            class: { select: { id: true, name: true, section: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // Limit to prevent memory issues in free tier
    });

    // Group scores by term
    const termsMap = new Map<string, {
      termId: string;
      termName: string;
      subjects: Array<{
        examId: string;
        examName: string;
        subjectId: string;
        subjectName: string;
        subjectCode: string | null;
        score: number;
        totalMarks: number;
        grade: string | null;
        percentage: number;
      }>;
    }>();

    for (const score of examScores) {
      const tId = score.exam.termId;
      if (!termsMap.has(tId)) {
        termsMap.set(tId, {
          termId: tId,
          termName: score.exam.term.name,
          subjects: [],
        });
      }

      const percentage = score.exam.totalMarks > 0
        ? Math.round((score.score / score.exam.totalMarks) * 10000) / 100
        : 0;

      termsMap.get(tId)!.subjects.push({
        examId: score.examId,
        examName: score.exam.name,
        subjectId: score.exam.subjectId,
        subjectName: score.exam.subject.name,
        subjectCode: score.exam.subject.code,
        score: score.score,
        totalMarks: score.exam.totalMarks,
        grade: score.grade,
        percentage,
      });
    }

    // Calculate term summaries
    const terms = Array.from(termsMap.values()).map((term) => {
      const totalScore = term.subjects.reduce((sum, s) => sum + s.score, 0);
      const totalMarks = term.subjects.reduce((sum, s) => sum + s.totalMarks, 0);
      const average = term.subjects.length > 0
        ? Math.round((totalScore / term.subjects.length) * 100) / 100
        : 0;
      const overallPercentage = totalMarks > 0
        ? Math.round((totalScore / totalMarks) * 10000) / 100
        : 0;

      // Calculate GPA (simple: A+=4.0, A=4.0, B=3.0, C=2.0, D=1.0, F=0)
      const gradePoints: Record<string, number> = {
        'A+': 4.0, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0,
      };
      const totalGradePoints = term.subjects.reduce((sum, s) => {
        return sum + (gradePoints[s.grade || 'F'] || 0);
      }, 0);
      const gpa = term.subjects.length > 0
        ? Math.round((totalGradePoints / term.subjects.length) * 100) / 100
        : 0;

      // Count pass/fail
      const passed = term.subjects.filter((s) => s.percentage >= 50).length;
      const failed = term.subjects.filter((s) => s.percentage < 50).length;

      return {
        ...term,
        totalScore,
        totalMarks,
        average,
        overallPercentage,
        gpa,
        passed,
        failed,
        totalSubjects: term.subjects.length,
      };
    });

    // Calculate class ranking for the most recent term
    let classRank: { rank: number | null; totalStudents: number } | null = null;
    if (terms.length > 0) {
      const latestTerm = terms[0];
      const effectiveClassId = student.classId || classId;

      if (effectiveClassId) {
        // ── BATCH: Get all students and their scores in 2 queries instead of N+1 ──
        // Limit to prevent memory issues in large classes
        const classStudents = await db.student.findMany({
          where: { classId: effectiveClassId, deletedAt: null, isActive: true },
          select: { id: true },
          take: 1000, // Prevent memory issues - limit to 1000 students per class
        });

        const classStudentIds = classStudents.map(cs => cs.id);

        // Single query for ALL scores for ALL students in this class+term
        const allScores = await db.examScore.findMany({
          where: {
            studentId: { in: classStudentIds },
            exam: { termId: latestTerm.termId, classId: effectiveClassId },
          },
          select: { studentId: true, score: true },
          take: 50000, // Limit total scores to prevent memory issues
        });

        // Aggregate scores per student in JS
        const studentTotalMap = new Map<string, number>();
        for (const s of allScores) {
          studentTotalMap.set(s.studentId, (studentTotalMap.get(s.studentId) || 0) + s.score);
        }

        const studentScores = classStudents.map(cs => ({
          studentId: cs.id,
          totalScore: studentTotalMap.get(cs.id) || 0,
        }));

        // Sort by total score descending
        studentScores.sort((a, b) => b.totalScore - a.totalScore);

        const rankIndex = studentScores.findIndex((s) => s.studentId === studentId);
        classRank = {
          rank: rankIndex >= 0 ? rankIndex + 1 : null,
          totalStudents: studentScores.length,
        };
      }
    }

    // Get attendance summary - limit to last 365 days to prevent memory issues
    const attendanceRecords = await db.attendance.findMany({
      where: { studentId },
      select: { status: true },
      orderBy: { date: 'desc' },
      take: 365, // Limit to last year of attendance records
    });

    const attendanceSummary = {
      total: attendanceRecords.length,
      present: attendanceRecords.filter((a) => a.status === 'present').length,
      absent: attendanceRecords.filter((a) => a.status === 'absent').length,
      late: attendanceRecords.filter((a) => a.status === 'late').length,
      excused: attendanceRecords.filter((a) => a.status === 'excused').length,
      percentage: attendanceRecords.length > 0
        ? Math.round((attendanceRecords.filter((a) => a.status === 'present').length / attendanceRecords.length) * 100)
        : 0,
    };

    return NextResponse.json({
      data: {
        student,
        terms,
        classRank,
        attendanceSummary,
        overallGPA: terms.length > 0 ? terms[0].gpa : 0,
        overallAverage: terms.length > 0 ? terms[0].average : 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
