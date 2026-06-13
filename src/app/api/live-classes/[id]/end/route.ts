import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, authenticateRequest } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null, status: { in: ['active', 'scheduled'] } },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found or already ended' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId as string | undefined;

  const isHost = liveClass.hostId
    ? (auth.authenticated && liveClass.hostId === auth.id)
    : (liveClass.guestUserId === guestId);

  if (!isHost && auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only the host can end this class' }, { status: 403 });
  }

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

  const now = new Date();
  const attendanceRecords = await db.liveClassAttendance.findMany({
    where: { liveClassId: id, leftAt: null },
    select: { id: true, joinedAt: true },
  });
  await Promise.all(
    attendanceRecords.map(rec =>
      db.liveClassAttendance.update({
        where: { id: rec.id },
        data: {
          leftAt: now,
          duration: Math.floor((now.getTime() - new Date(rec.joinedAt).getTime()) / 1000),
        },
      })
    ),
  );

  return NextResponse.json({ data: ended });
}
