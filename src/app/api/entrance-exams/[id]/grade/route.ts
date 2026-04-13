import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

// POST /api/entrance-exams/[id]/grade - Grade an entrance exam attempt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(request, ['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id: examId } = await params;
    const body = await request.json();

    const { attemptId, manualScore, status, comments } = body as {
      attemptId: string;
      manualScore?: number;
      status?: string;
      comments?: string;
    };

    if (!attemptId) {
      return NextResponse.json(
        { error: 'attemptId is required' },
        { status: 400 }
      );
    }

    // Verify attempt belongs to this exam
    const attempt = await db.entranceExamAttempt.findFirst({
      where: { id: attemptId, entranceExamId: examId },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Attempt not found or does not belong to this exam' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      gradedAt: new Date(),
    };
    if (manualScore !== undefined) {
      updateData.manualScore = manualScore;
    }
    if (status) {
      // Allowed statuses: submitted, graded, approved, rejected, offered_admission, declined, etc.
      const allowedStatuses = ['submitted', 'graded', 'approved', 'rejected', 'offered_admission', 'declined', 'under_review'];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
    // Note: finalScore could be set based on manualScore or autoScore
    // We'll let DB handle or we can compute: if manualScore set, finalScore = manualScore, else keep autoScore
    // We'll compute finalScore if manualScore provided
    if (manualScore !== undefined) {
      updateData.finalScore = manualScore;
    }

    // Update attempt
    const updatedAttempt = await db.entranceExamAttempt.update({
      where: { id: attemptId },
      data: updateData,
    });

    // If status indicates admission decision, send notification to applicant
    if (status && ['approved', 'rejected', 'offered_admission', 'declined'].includes(status) && attempt.applicantEmail) {
      // Create notification for applicant (they may not have a user account yet)
      // We'll store notification in a separate table or send email directly.
      // For now, we can send email notification if email exists.
      // Use the email service to notify applicant of decision.
      // Since applicant may not be a user, we send email directly.
      // We'll implement email sending in a separate step.
    }

    return NextResponse.json({
      data: updatedAttempt,
      message: 'Attempt graded successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
