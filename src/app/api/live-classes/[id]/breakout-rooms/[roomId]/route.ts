import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> },
) {
  const { id, roomId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
  });

  if (!liveClass || (liveClass.hostId !== auth.id && auth.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Only the host can manage breakout rooms' }, { status: 403 });
  }

  const body = await request.json();
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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
  });

  if (!liveClass || (liveClass.hostId !== auth.id && auth.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Only the host can manage breakout rooms' }, { status: 403 });
  }

  await db.liveClassBreakoutRoom.delete({ where: { id: roomId } });

  return NextResponse.json({ success: true });
}
