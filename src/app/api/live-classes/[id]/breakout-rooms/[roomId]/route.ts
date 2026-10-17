import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { isLiveClassHost } from '@/lib/live-class-auth';

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  return request.json().catch(() => ({}));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> },
) {
  const { id, roomId } = await params;
  const auth = await authenticateRequest(request);
  const body = await readBody(request);
  const guestId = body.guestId as string | undefined;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
    select: { hostId: true, guestUserId: true },
  });

  if (!liveClass || !isLiveClassHost(liveClass, auth, guestId)) {
    return NextResponse.json({ error: 'Only the host can manage breakout rooms' }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.participantIds !== undefined) updateData.participantIds = body.participantIds;

  const room = await db.liveClassBreakoutRoom.update({
    where: { id: roomId },
    data: updateData,
  });

  return NextResponse.json({ data: room });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> },
) {
  const { id, roomId } = await params;
  const auth = await authenticateRequest(request);
  const body = await readBody(request);
  const guestId = body.guestId as string | undefined;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
    select: { hostId: true, guestUserId: true },
  });

  if (!liveClass || !isLiveClassHost(liveClass, auth, guestId)) {
    return NextResponse.json({ error: 'Only the host can manage breakout rooms' }, { status: 403 });
  }

  await db.liveClassBreakoutRoom.delete({ where: { id: roomId } });

  return NextResponse.json({ success: true });
}
