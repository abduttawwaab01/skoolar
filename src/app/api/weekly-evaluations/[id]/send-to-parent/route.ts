import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { sendWeeklyEvaluationToParents } from '@/lib/parent-notification';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const evaluation = await db.weeklyEvaluation.findUnique({
      where: { id },
      include: { student: { select: { id: true } }, school: { select: { id: true } } },
    });

    if (!evaluation) {
      return NextResponse.json({ error: 'Weekly evaluation not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && evaluation.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';

    const result = await sendWeeklyEvaluationToParents(evaluation.student.id, id, baseUrl);

    return NextResponse.json({
      message: `Evaluation sent to ${result.email.sent} parent(s)${result.email.failed > 0 ? ` (${result.email.failed} failed)` : ''}`,
      sent: result.email.sent,
      failed: result.email.failed,
      whatsappUrls: result.whatsapp,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
