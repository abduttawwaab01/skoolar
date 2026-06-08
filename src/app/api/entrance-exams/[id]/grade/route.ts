import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
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

    // Send notification email if decision status and applicant email exists
    if (status && ['approved', 'rejected', 'offered_admission', 'declined'].includes(status) && attempt.applicantEmail) {
      const exam = await db.entranceExam.findUnique({ where: { id: examId }, select: { title: true } });
      const subject = `Application Update: ${exam?.title || examId} - Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
      const html = `
        <p>Dear ${attempt.applicantName || 'Applicant'},</p>
        <p>Your application has been updated to: <strong>${status}</strong>.</p>
        ${comments ? `<p>Comments: ${comments}</p>` : ''}
        <p>Log in to your account to view details.</p>
        <p>Best regards,<br/>Skoolar Platform</p>
      `;
      sendEmail({ to: attempt.applicantEmail, subject, html }).catch(err => {
        console.error('Failed to send notification email:', err);
      });
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
