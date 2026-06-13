import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId as string | undefined;

  let userId: string | null = auth.authenticated ? (auth.id as string) : null;

  const participant = await db.liveClassParticipant.findFirst({
    where: {
      liveClassId: id,
      leftAt: null,
      ...(userId ? { userId } : guestId ? { guestId } : {}),
    },
  });

  if (!participant) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 404 });
  }

  await db.liveClassParticipant.update({
    where: { id: participant.id },
    data: {
      leftAt: new Date(),
      isVideoOn: false,
      isScreenSharing: false,
    },
  });

  const now = new Date();
  const attendanceWhere: Record<string, unknown> = { liveClassId: id, leftAt: null };
  if (participant.userId) {
    attendanceWhere.userId = participant.userId;
  } else if (participant.guestId) {
    attendanceWhere.guestId = participant.guestId;
  }
  if (Object.keys(attendanceWhere).length > 0) {
    await db.liveClassAttendance.updateMany({
      where: attendanceWhere as any,
      data: {
        leftAt: now,
        duration: Math.floor((now.getTime() - new Date(participant.joinedAt).getTime()) / 1000),
      },
    });
  }

  return NextResponse.json({ success: true });
}
