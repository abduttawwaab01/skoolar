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
    where: { id, deletedAt: null, status: { in: ['active', 'scheduled'] } },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found or no longer active' }, { status: 404 });
  }

  const body = await request.json();
  const guestId = body.guestId as string | undefined;
  const displayName = body.name as string | undefined;
  const email = body.email as string | undefined;

  let name = displayName || 'Anonymous';
  let userId: string | null = auth.authenticated ? (auth.id as string) : null;
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
      ...(userId ? { userId } : { guestId }),
      leftAt: null,
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
