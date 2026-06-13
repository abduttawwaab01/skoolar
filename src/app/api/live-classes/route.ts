import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { v4 as uuidv4 } from 'uuid';

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function generateUniqueJoinCode(): Promise<string> {
  for (let attempts = 0; attempts < 20; attempts++) {
    const code = generateJoinCode();
    const existing = await db.liveClass.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique join code after 20 attempts');
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get('schoolId');
  const status = searchParams.get('status');
  const type = searchParams.get('type');

  const where: Record<string, unknown> = { deletedAt: null };

  if (auth.role !== 'SUPER_ADMIN') {
    where.schoolId = schoolId || auth.schoolId;
  } else if (schoolId) {
    where.schoolId = schoolId;
  } else if (auth.role === 'SUPER_ADMIN' && !schoolId) {
    // SUPER_ADMIN with no filter sees all
    delete where.schoolId;
  }

  if (status) where.status = status;
  if (type) where.type = type;

  const classes = await db.liveClass.findMany({
    where,
    include: {
      _count: { select: { participants: true } },
      host: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ data: classes });
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    // Check if the live class exists
    const liveClass = await db.liveClass.findUnique({
      where: { id },
      select: { hostId: true, schoolId: true },
    });

    if (!liveClass) {
      return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
    }

    // Check permissions
    if (auth.role !== 'SUPER_ADMIN' && liveClass.hostId !== auth.id) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Soft-delete the live class
    await db.liveClass.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'cancelled' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request).catch(() => null);
    const isGuest = !auth || auth instanceof NextResponse;

    const body = await request.json();
    const { title, description, type, scheduledAt, maxParticipants, hostName, guestUserId } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

  if (!isGuest) {
    const allowedRoles = ['SCHOOL_ADMIN', 'TEACHER', 'DIRECTOR', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(auth.role!)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  // Guest duration logic: 5 min free or 60 min with credits (deducted per-hour via /extend)
  let guestDurationMinutes = 5;
  if (isGuest && guestUserId) {
    const guestUser = await db.guestUser.findUnique({ where: { id: guestUserId } });
    if (guestUser && guestUser.credits >= 1 && guestUser.emailVerified) {
      guestDurationMinutes = 60;
    }
  }
  // Do NOT deduct credits upfront — deduction happens per-hour via the /extend endpoint

  // Enforce concurrent guest limit (max 3 concurrent active classes per guest)
  if (isGuest && guestUserId) {
    const guestConcurrentCount = await db.liveClass.count({
      where: {
        guestUserId,
        status: 'active',
        deletedAt: null,
      },
    });
    if (guestConcurrentCount >= 3) {
      return NextResponse.json({
        error: 'You can have at most 3 concurrent live classes. End an active class first.',
      }, { status: 403 });
    }
  }

  // Enforce school-level limits for authenticated users
  if (!isGuest && auth.schoolId) {
    const school = await db.school.findUnique({
      where: { id: auth.schoolId },
      select: {
        liveClassMaxParticipants: true,
        liveClassMaxDuration: true,
        liveClassMaxConcurrent: true,
        liveClassMaxMeetingsPerMonth: true,
      },
    });

    if (school) {
      const requestedParticipants = maxParticipants || 50;
      if (requestedParticipants > school.liveClassMaxParticipants) {
        return NextResponse.json({
          error: `Max participants (${requestedParticipants}) exceeds school limit of ${school.liveClassMaxParticipants}`,
        }, { status: 403 });
      }

      const requestedDuration = body.maxDuration || 60;
      if (requestedDuration > school.liveClassMaxDuration) {
        return NextResponse.json({
          error: `Max duration (${requestedDuration} min) exceeds school limit of ${school.liveClassMaxDuration} min`,
        }, { status: 403 });
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [concurrentCount, monthlyCount] = await Promise.all([
        db.liveClass.count({
          where: {
            schoolId: auth.schoolId,
            status: 'active',
            deletedAt: null,
          },
        }),
        db.liveClass.count({
          where: {
            schoolId: auth.schoolId,
            status: { in: ['active', 'ended'] },
            deletedAt: null,
            createdAt: { gte: startOfMonth },
          },
        }),
      ]);

      if (concurrentCount >= school.liveClassMaxConcurrent) {
        return NextResponse.json({
          error: `Maximum concurrent live classes (${school.liveClassMaxConcurrent}) reached. End an active class first.`,
        }, { status: 403 });
      }

      if (monthlyCount >= school.liveClassMaxMeetingsPerMonth) {
        return NextResponse.json({
          error: `Monthly meeting limit (${school.liveClassMaxMeetingsPerMonth}) reached. Upgrade your plan or wait until next month.`,
        }, { status: 403 });
      }
    }
  }

  const joinCode = await generateUniqueJoinCode().catch(() => {
    throw new Error('Unable to generate a unique join code. Please try again.');
  });

  const liveClass = await db.liveClass.create({
    data: {
      title,
      description: description || null,
      type: type || 'class',
      schoolId: !isGuest && auth.schoolId ? auth.schoolId : null,
      hostId: isGuest ? null : auth.id,
      hostName: hostName || (isGuest ? 'Guest' : auth.id || 'Host'),
      joinCode,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      maxParticipants: maxParticipants || 50,
      status: scheduledAt ? 'scheduled' : 'active',
      startedAt: scheduledAt ? null : new Date(),
      settings: {
        allowChat: true,
        allowScreenShare: true,
        allowWhiteboard: true,
        allowPolls: true,
        muteOnJoin: true,
        hideParticipantsFromEachOther: false,
        maxDurationMinutes: isGuest ? guestDurationMinutes : (body.maxDuration || 60),
      },
      guestUserId: isGuest && guestUserId ? guestUserId : undefined,
    },
  });

  // Create host participant for both guest and authenticated hosts
  if (liveClass.status === 'active') {
    await db.liveClassParticipant.create({
      data: {
        liveClassId: liveClass.id,
        userId: isGuest ? null : auth.id,
        guestId: isGuest ? (guestUserId || null) : null,
        name: hostName || (isGuest ? 'Guest' : auth.id || 'Host'),
        role: 'host',
        isMuted: false,
        isVideoOn: true,
      },
    });
  }

    return NextResponse.json({ data: liveClass }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create live class';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
