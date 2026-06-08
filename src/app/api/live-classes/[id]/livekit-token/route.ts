import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { generateLiveKitToken, LIVEKIT_URL } from '@/lib/livekit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null, status: { in: ['active', 'scheduled'] } },
    include: { participants: true },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId as string | undefined;
  const displayName = body.name as string | undefined;

  let identity = guestId || `guest-${Date.now()}`;
  let name = displayName || 'Guest';
  let metadata = '{}';

  if (auth.authenticated && auth.id) {
    const user = await db.user.findUnique({
      where: { id: auth.id },
      select: { id: true, name: true, avatar: true, role: true },
    });
    if (user) {
      identity = user.id;
      name = user.name;
      metadata = JSON.stringify({
        role: user.role,
        avatar: user.avatar,
        isHost: liveClass.hostId === user.id,
      });
    }
  }

  const participant = liveClass.participants.find(
    p =>
      (auth.authenticated && p.userId === auth.id) ||
      p.guestId === guestId,
  );
  const isHost = liveClass.hostId === (auth.authenticated ? auth.id : null);
  const isParticipant = !!participant;

  if (!isHost && !isParticipant && liveClass.status === 'active') {
    return NextResponse.json({ error: 'Join the class first' }, { status: 403 });
  }

  const token = generateLiveKitToken(identity, id, {
    name,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    metadata,
  });

  return NextResponse.json({
    data: {
      token: token.toJwt(),
      url: LIVEKIT_URL,
      room: id,
      identity,
    },
  });
}
