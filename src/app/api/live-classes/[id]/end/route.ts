import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null, status: { in: ['active', 'scheduled'] } },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found or already ended' }, { status: 404 });
  }

  if (liveClass.hostId !== auth.id && auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only the host can end this class' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const ended = await db.liveClass.update({
    where: { id },
    data: {
      status: 'ended',
      endedAt: new Date(),
      recordingUrl: body.recordingUrl || null,
    },
  });

  await db.liveClassParticipant.updateMany({
    where: { liveClassId: id, leftAt: null },
    data: { leftAt: new Date() },
  });

  await db.liveClassAttendance.updateMany({
    where: { liveClassId: id, leftAt: null },
    data: {
      leftAt: new Date(),
      duration: {
        set: Math.floor(
          (Date.now() - new Date(liveClass.startedAt || liveClass.createdAt).getTime()) / 1000,
        ),
      },
    },
  });

  return NextResponse.json({ data: ended });
}
