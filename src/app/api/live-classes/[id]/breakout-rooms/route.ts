import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  if (liveClass.hostId !== auth.id && auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only the host can manage breakout rooms' }, { status: 403 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
  }

  const room = await db.liveClassBreakoutRoom.create({
    data: { liveClassId: id, name: name.trim() },
  });

  return NextResponse.json({ data: room }, { status: 201 });
}
