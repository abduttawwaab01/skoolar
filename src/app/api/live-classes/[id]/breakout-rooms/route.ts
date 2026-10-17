import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { isLiveClassHost } from '@/lib/live-class-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId') || undefined;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
    select: { hostId: true, guestUserId: true },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  // Read access is allowed for authenticated users and for guests already in the room.
  if (!auth.authenticated && !guestId) {
    return NextResponse.json({ error: 'Authentication or guest ID is required' }, { status: 400 });
  }

  const rooms = await db.liveClassBreakoutRoom.findMany({
    where: { liveClassId: id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ data: rooms });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId as string | undefined;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  if (!isLiveClassHost(liveClass, auth, guestId)) {
    return NextResponse.json({ error: 'Only the host can manage breakout rooms' }, { status: 403 });
  }

  const { name } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
  }

  const room = await db.liveClassBreakoutRoom.create({
    data: { liveClassId: id, name: name.trim() },
  });

  return NextResponse.json({ data: room }, { status: 201 });
}
