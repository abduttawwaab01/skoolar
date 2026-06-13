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

function generateUniqueJoinCode(): Promise<string> {
  let code: string;
  let attempts = 0;
  const generate = async (): Promise<string> => {
    code = generateJoinCode();
    const existing = await db.liveClass.findUnique({ where: { joinCode: code } });
    if (existing && attempts < 10) {
      attempts++;
      return generate();
    }
    return code;
  };
  return generate();
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

    // Delete the live class
    await db.liveClass.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

  // Enforce school-level limits for authenticated users
  if (!isGuest && auth.schoolId) {
    const school = await db.school.findUnique({
      where: { id: auth.schoolId },
      select: {
        liveClassMaxParticipants: true,
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

  const joinCode = await generateUniqueJoinCode();
  const guestId = isGuest ? `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null;

  const liveClass = await db.liveClass.create({
    data: {
      title,
      description: description || null,
      type: type || 'class',
      schoolId: !isGuest && auth.schoolId ? auth.schoolId : '',
      hostId: isGuest ? guestId : auth.id,
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
        maxDurationMinutes: isGuest ? guestDurationMinutes : (body.maxDuration || 60),
      },
      ...(isGuest && guestUserId ? { guestUserId } : {}),
    },
  });

  if (liveClass.status === 'active' && !isGuest && auth.id) {
    await db.liveClassParticipant.create({
      data: {
        liveClassId: liveClass.id,
        userId: auth.id,
        name: hostName || auth.id || 'Host',
        role: 'host',
        isMuted: false,
        isVideoOn: true,
      },
    });
  }

  return NextResponse.json({ data: liveClass }, { status: 201 });
}
