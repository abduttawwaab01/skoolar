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
      ...(userId ? { userId } : { guestId }),
      leftAt: null,
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

  if (participant.userId) {
    await db.liveClassAttendance.updateMany({
      where: { liveClassId: id, userId: participant.userId, leftAt: null },
      data: {
        leftAt: new Date(),
        duration: {
          set: Math.floor(
            (Date.now() - new Date(participant.joinedAt).getTime()) / 1000,
          ),
        },
      },
    });
  }

  return NextResponse.json({ success: true });
}
