import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/exams/[id]/scores - List all scores for an exam
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        totalMarks: true,
        passingMarks: true,
        isLocked: true,
        isPublished: true,
        classId: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const scores = await db.examScore.findMany({
      where: { examId: id },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { name: true, email: true, avatar: true } },
            class: { select: { name: true, section: true } },
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    // Calculate statistics
    const scoreValues = scores.map((s) => s.score);
    const stats = {
      totalScored: scores.length,
      average: scoreValues.length > 0
        ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 100) / 100
        : 0,
      highest: scoreValues.length > 0 ? Math.max(...scoreValues) : 0,
      lowest: scoreValues.length > 0 ? Math.min(...scoreValues) : 0,
      passed: scores.filter((s) => s.score >= exam.passingMarks).length,
      failed: scores.filter((s) => s.score < exam.passingMarks).length,
      passRate: scoreValues.length > 0
        ? Math.round((scores.filter((s) => s.score >= exam.passingMarks).length / scoreValues.length) * 100)
        : 0,
    };

    return NextResponse.json({
      data: {
        exam,
        scores,
        stats,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/exams/[id]/scores - Bulk upsert scores
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { scores } = body;

    if (!scores || !Array.isArray(scores)) {
      return NextResponse.json(
        { error: 'scores array is required' },
        { status: 400 }
      );
    }

    // Verify exam exists and is not locked
    const exam = await db.exam.findUnique({
      where: { id },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (exam.isLocked) {
      return NextResponse.json(
        { error: 'Exam is locked. Unlock it first to modify scores.' },
        { status: 403 }
      );
    }

    const created: unknown[] = [];
    const updated: unknown[] = [];
    const errors: { studentId: string; error: string }[] = [];

    // ── BATCH: Validate all students in a single query ──
    const studentIds = [...new Set(scores.map((s: { studentId: string }) => s.studentId).filter(Boolean))];
    const validStudents = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true },
    });
    const validStudentIds = new Set(validStudents.map(s => s.id));

    // ── BATCH: Fetch existing scores to determine create vs update ──
    const existingScores = await db.examScore.findMany({
      where: { examId: id, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const existingStudentIds = new Set(existingScores.map(s => s.studentId));

     // ── BATCH: Upsert all scores using batched operations (was M separate upserts) ──
     // Separate into create and update operations
     const scoresToCreate: Array<{ examId: string; studentId: string; score: number; grade: string; remarks?: string }> = [];
     const scoresToUpdate: Array<{ examId: string; studentId: string; score: number; grade: string; remarks?: string }> = [];

     for (const scoreData of scores) {
       if (!scoreData.studentId) {
         errors.push({ studentId: 'unknown', error: 'Missing studentId' });
         continue;
       }
       if (!validStudentIds.has(scoreData.studentId)) {
         errors.push({ studentId: scoreData.studentId, error: 'Student not found' });
         continue;
       }
       if (scoreData.score < 0 || scoreData.score > exam.totalMarks) {
         errors.push({ studentId: scoreData.studentId, error: `Score must be between 0 and ${exam.totalMarks}` });
         continue;
       }

       const percentage = (scoreData.score / exam.totalMarks) * 100;
       let grade = 'F';
       if (percentage >= 90) grade = 'A+';
       else if (percentage >= 80) grade = 'A';
       else if (percentage >= 70) grade = 'B';
       else if (percentage >= 60) grade = 'C';
       else if (percentage >= 50) grade = 'D';

       const scoreRecord = {
         examId: id,
         studentId: scoreData.studentId,
         score: scoreData.score,
         grade: scoreData.grade || grade,
         remarks: scoreData.remarks || null,
       };

       if (existingStudentIds.has(scoreData.studentId)) {
         scoresToUpdate.push(scoreRecord);
       } else {
         scoresToCreate.push(scoreRecord);
       }
     }

     // Batch create new scores (single query)
     if (scoresToCreate.length > 0) {
       await db.examScore.createMany({
         data: scoresToCreate,
       });
       // Add to created list for response
       for (const data of scoresToCreate) {
         created.push(data);
       }
     }

     // Batch update existing scores in groups to reduce queries
     if (scoresToUpdate.length > 0) {
       const BATCH_SIZE = 10;
       for (let i = 0; i < scoresToUpdate.length; i += BATCH_SIZE) {
         const batch = scoresToUpdate.slice(i, i + BATCH_SIZE);
         await Promise.all(batch.map(score => 
           db.examScore.update({
             where: { examId_studentId: { examId: score.examId, studentId: score.studentId } },
             data: { score: score.score, grade: score.grade, remarks: score.remarks },
           })
         ));
       }
       // Add to updated list for response
       for (const data of scoresToUpdate) {
         updated.push(data);
       }
     }

    return NextResponse.json({
      data: { created, updated },
      errors: errors.length > 0 ? errors : undefined,
      createdCount: created.length,
      updatedCount: updated.length,
      errorCount: errors.length,
      message: `Scores saved: ${created.length} created, ${updated.length} updated`,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
