import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const liveClass = await db.liveClass.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(auth.role !== 'SUPER_ADMIN' && auth.schoolId
        ? { schoolId: auth.schoolId }
        : {}),
    },
    include: {
      host: { select: { id: true, name: true, avatar: true } },
      _count: { select: { participants: true } },
      participants: {
        orderBy: { joinedAt: 'asc' },
        take: 100,
      },
    },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  return NextResponse.json({ data: liveClass });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  if (liveClass.hostId !== auth.id && auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only the host can update this class' }, { status: 403 });
  }

  const body = await request.json();
  const allowedFields = ['title', 'description', 'maxParticipants', 'settings'];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const updated = await db.liveClass.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  if (liveClass.hostId !== auth.id && auth.role !== 'SUPER_ADMIN' && auth.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  await db.liveClass.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'cancelled' },
  });

  return NextResponse.json({ success: true });
}
