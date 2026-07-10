import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { GRADE_POINTS, DEFAULT_PASS_MARK } from '@/lib/grade-calculator';

function calculateGradeFromPercentage(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= DEFAULT_PASS_MARK) return 'D';
  return 'F';
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { studentIds, schoolId, termId, classId } = body;

    if (!studentIds?.length) {
      return NextResponse.json({ error: 'studentIds array required' }, { status: 400 });
    }

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const examScores = await db.examScore.findMany({
      where: {
        studentId: { in: studentIds },
        exam: {
          schoolId: targetSchoolId,
          ...(termId ? { termId } : {}),
          ...(classId ? { classId } : {}),
        },
      },
      select: {
        studentId: true,
        score: true,
        grade: true,
        exam: {
          select: {
            id: true,
            totalMarks: true,
            subject: { select: { id: true, name: true } },
            term: { select: { id: true, name: true } },
          },
        },
      },
      take: 100000,
    });

    const resultsMap = new Map<string, { totalScore: number; subjectCount: number; grades: string[] }>();

    for (const score of examScores) {
      const sid = score.studentId;
      if (!resultsMap.has(sid)) {
        resultsMap.set(sid, { totalScore: 0, subjectCount: 0, grades: [] });
      }
      const entry = resultsMap.get(sid)!;
      entry.totalScore += score.score;

      const grade = score.grade || calculateGradeFromPercentage(
        score.exam.totalMarks > 0 ? (score.score / score.exam.totalMarks) * 100 : 0
      );
      entry.grades.push(grade);
    }

    const resultMap: Record<string, { gpa: number; average: number; grade: string; totalScore: number; subjectCount: number }> = {};

    for (const [sid, data] of resultsMap) {
      const uniqueGrades = [...new Set(data.grades)];
      const totalGradePoints = uniqueGrades.reduce((sum, g) => sum + (GRADE_POINTS[g] ?? 0), 0);
      const gpa = uniqueGrades.length > 0 ? Math.round((totalGradePoints / uniqueGrades.length) * 100) / 100 : 0;
      const average = data.subjectCount > 0 ? Math.round((data.totalScore / data.subjectCount) * 100) / 100 : 0;
      const grade = calculateGradeFromPercentage(average);

      resultMap[sid] = { gpa, average, grade, totalScore: data.totalScore, subjectCount: data.subjectCount };
    }

    return NextResponse.json({ data: resultMap });
  } catch (error) {
    console.error('POST /api/results/batch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
