import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

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

  const isGuestHost = liveClass.guestUserId === guestId;
  const isAuthHost = auth.authenticated && (liveClass.hostId === auth.id || auth.role === 'SUPER_ADMIN');

  if (!isGuestHost && !isAuthHost) {
    return NextResponse.json({ error: 'Only the host can mute all' }, { status: 403 });
  }

  await db.liveClassParticipant.updateMany({
    where: { liveClassId: id, leftAt: null, role: { not: 'host' } },
    data: { isMuted: true },
  });

  return NextResponse.json({ success: true });
}
