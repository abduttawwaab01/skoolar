import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, requireAuth } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);

  const liveClass = await db.liveClass.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      host: { select: { id: true, name: true, avatar: true } },
      _count: { select: { participants: true } },
      participants: {
        orderBy: { joinedAt: 'asc' },
        take: 100,
      },
      whiteboards: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  if (auth.authenticated && auth.role !== 'SUPER_ADMIN' && auth.schoolId && liveClass.schoolId && liveClass.schoolId !== auth.schoolId) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  // When hideParticipantsFromEachOther is enabled, only return the requesting user's participant data
  const settings = (liveClass.settings as Record<string, unknown>) || {};
  if (settings.hideParticipantsFromEachOther === true) {
    const { searchParams } = new URL(request.url);
    const reqGuestId = searchParams.get('guestId');
    const userId = auth.authenticated ? auth.id : null;
    liveClass.participants = liveClass.participants.filter((p: any) => {
      if (userId && p.userId === userId) return true;
      if (reqGuestId && p.guestId === reqGuestId) return true;
      return p.role === 'host';
    });
  }

  return NextResponse.json({ data: liveClass });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId as string | undefined;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  const isGuestHost = liveClass.guestUserId === guestId;
  const isAuthHost = auth.authenticated && (liveClass.hostId === auth.id || auth.role === 'SUPER_ADMIN');

  if (!isGuestHost && !isAuthHost) {
    return NextResponse.json({ error: 'Only the host can update this class' }, { status: 403 });
  }

  const allowedFields = ['title', 'description', 'maxParticipants', 'settings', 'recordingUrl'];
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
