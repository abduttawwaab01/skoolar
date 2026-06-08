import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function PUT(
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

  const body = await request.json();
  const { snapshot } = body;

  if (!snapshot) {
    return NextResponse.json({ error: 'Snapshot is required' }, { status: 400 });
  }

  const whiteboard = await db.liveClassWhiteboard.create({
    data: {
      liveClassId: id,
      snapshot,
      createdBy: auth.id,
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
