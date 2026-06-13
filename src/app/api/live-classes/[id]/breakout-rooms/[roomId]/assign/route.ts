import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(
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
    return NextResponse.json({ error: 'Only the host can assign participants' }, { status: 403 });
  }

  const body = await request.json();
  const { participantIds } = body;

  if (!Array.isArray(participantIds)) {
    return NextResponse.json({ error: 'participantIds must be an array' }, { status: 400 });
  }

  const room = await db.liveClassBreakoutRoom.update({
    where: { id: roomId },
    data: { participantIds },
  });

  // Attempt to notify via internal fetch (fire-and-forget)
  // Socket notification is handled client-side via the response
  return NextResponse.json({ data: room });
}
