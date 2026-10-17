import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { isLiveClassHost } from '@/lib/live-class-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> },
) {
  const { id, roomId } = await params;
  const auth = await authenticateRequest(request);
  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId as string | undefined;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
    select: { hostId: true, guestUserId: true },
  });

  if (!liveClass || !isLiveClassHost(liveClass, auth, guestId)) {
    return NextResponse.json({ error: 'Only the host can assign participants' }, { status: 403 });
  }

  const { participantIds } = body;

  if (!Array.isArray(participantIds)) {
    return NextResponse.json({ error: 'participantIds must be an array' }, { status: 400 });
  }

  const room = await db.liveClassBreakoutRoom.update({
    where: { id: roomId },
    data: { participantIds },
  });

  return NextResponse.json({ data: room });
}
