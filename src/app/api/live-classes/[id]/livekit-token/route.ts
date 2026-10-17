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
    where: { id, deletedAt: null, status: 'active' },
    include: { participants: true },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId as string | undefined;
  const displayName = body.name as string | undefined;

  const isGuestHost = !!liveClass.guestUserId && liveClass.guestUserId === guestId;
  const isAuthHost = auth.authenticated && liveClass.hostId === auth.id;
  const isHost = isAuthHost || isGuestHost;

  // A stable LiveKit identity is required — never mint a throwaway one.
  let identity: string;
  let name = displayName || 'Guest';
  let metadata = '{}';

  if (auth.authenticated && auth.id) {
    const user = await db.user.findUnique({
      where: { id: auth.id },
      select: { id: true, name: true, avatar: true, role: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    identity = user.id;
    name = user.name;
    metadata = JSON.stringify({
      role: user.role,
      avatar: user.avatar,
      isHost: isAuthHost,
    });
  } else if (guestId) {
    identity = guestId;
    const participant = liveClass.participants.find(
      (p: any) => p.guestId === guestId && !p.leftAt,
    );
    if (participant?.name) name = participant.name;
    metadata = JSON.stringify({ type: 'guest', isHost: isGuestHost });
  } else {
    return NextResponse.json(
      { error: 'Authentication or guest ID is required' },
      { status: 400 },
    );
  }

  const participant = liveClass.participants.find(
    (p: any) =>
      ((auth.authenticated && p.userId === auth.id) ||
        (p.guestId && p.guestId === guestId)) &&
      !p.leftAt,
  );
  const isParticipant = !!participant;

  if (!isHost && !isParticipant) {
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
