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

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request).catch(() => null);
  const isGuest = !auth || auth instanceof NextResponse;

  const body = await request.json();
  const { title, description, type, scheduledAt, maxParticipants, hostName } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  if (!isGuest) {
    const allowedRoles = ['SCHOOL_ADMIN', 'TEACHER', 'DIRECTOR', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(auth.role!)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  const joinCode = await generateUniqueJoinCode();
  const guestId = isGuest ? `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null;

  const liveClass = await db.liveClass.create({
    data: {
      title,
      description: description || null,
      type: type || 'class',
      schoolId: !isGuest && auth.schoolId ? auth.schoolId : null,
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
      },
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
