import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null, status: 'active' },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found or no longer active' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId as string | undefined;
  const displayName = body.name as string | undefined;
  const email = body.email as string | undefined;
  const joinCode = (body.joinCode as string | undefined)?.trim().toUpperCase();

  if (!auth.authenticated && !guestId) {
    return NextResponse.json({ error: 'Guest ID is required to join as a guest' }, { status: 400 });
  }

  const userId: string | null = auth.authenticated ? (auth.id as string) : null;

  // Guest access control: a guest may only join with a valid join code, unless
  // they are the host or are already an active participant in this class.
  if (!auth.authenticated && guestId) {
    const isHost = !!liveClass.guestUserId && liveClass.guestUserId === guestId;
    const alreadyJoined = await db.liveClassParticipant.findFirst({
      where: { liveClassId: id, leftAt: null, guestId },
    });

    if (!isHost && !alreadyJoined) {
      const expectedCode = (liveClass.joinCode || '').toUpperCase();
      if (!joinCode || joinCode !== expectedCode) {
        return NextResponse.json({ error: 'Invalid join code' }, { status: 403 });
      }
    }
  }

  let name = displayName || 'Anonymous';
  let avatar: string | null = null;

  if (auth.authenticated && auth.id) {
    const user = await db.user.findUnique({
      where: { id: auth.id },
      select: { id: true, name: true, avatar: true },
    });
    if (user) {
      name = user.name;
      avatar = user.avatar;
    }
  }

  const participantCount = await db.liveClassParticipant.count({
    where: { liveClassId: id, leftAt: null },
  });

  if (participantCount >= liveClass.maxParticipants) {
    return NextResponse.json({ error: 'Live class is full' }, { status: 403 });
  }

  const existingParticipant = await db.liveClassParticipant.findFirst({
    where: {
      liveClassId: id,
      leftAt: null,
      ...(userId ? { userId } : guestId ? { guestId } : {}),
    },
  });

  if (existingParticipant) {
    return NextResponse.json({ data: existingParticipant });
  }

  const participant = await db.liveClassParticipant.create({
    data: {
      liveClassId: id,
      userId,
      guestId,
      name,
      email,
      avatar,
      role: 'participant',
      joinedAt: new Date(),
      isMuted: true,
      isVideoOn: false,
    },
  });

  if (liveClass.schoolId && userId) {
    const student = await db.student.findFirst({
      where: { userId, schoolId: liveClass.schoolId },
    });

    if (student) {
      await db.liveClassAttendance.create({
        data: {
          liveClassId: id,
          studentId: student.id,
          userId,
          name,
          status: 'present',
          joinedAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({ data: participant }, { status: 201 });
}
