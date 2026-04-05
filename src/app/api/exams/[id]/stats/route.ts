import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/exams/[id]/stats - Get exam statistics (average, highest, pass rate)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if exam exists and user has access
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // School context check
    const userSchoolId = auth.schoolId;
    if (userSchoolId && exam.schoolId !== userSchoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all scores for this exam
    const scores = await db.examScore.findMany({
      where: { examId: id },
      select: { score: true },
    });

    const scoreValues = scores.map(s => s.score);
    const totalScores = scoreValues.length;
    
    const average = totalScores > 0
      ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / totalScores) * 100) / 100
      : 0;
    
    const highest = totalScores > 0 ? Math.max(...scoreValues) : 0;
    const lowest = totalScores > 0 ? Math.min(...scoreValues) : 0;
    
    // Pass rate (students who scored >= passing marks)
    const passingCount = scoreValues.filter(s => s >= exam.passingMarks).length;
    const passRate = totalScores > 0
      ? Math.round((passingCount / totalScores) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        examId: id,
        examName: exam.name,
        subject: exam.subject?.name,
        className: exam.class?.name,
        totalStudents: totalScores,
        average,
        highest,
        lowest,
        passRate,
        passingMarks: exam.passingMarks,
        totalMarks: exam.totalMarks,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
