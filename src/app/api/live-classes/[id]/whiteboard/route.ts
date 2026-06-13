import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  const body = await request.json().catch(() => ({}));
  const { snapshot, guestId } = body;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  if (!snapshot) {
    return NextResponse.json({ error: 'Snapshot is required' }, { status: 400 });
  }

  const whiteboard = await db.liveClassWhiteboard.create({
    data: {
      liveClassId: id,
      snapshot,
      createdBy: auth.authenticated ? auth.id : (guestId || 'guest'),
    },
  });

  return NextResponse.json({ data: whiteboard });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const whiteboards = await db.liveClassWhiteboard.findMany({
    where: { liveClassId: id },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  return NextResponse.json({
    data: whiteboards[0] || null,
  });
}
