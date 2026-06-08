import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  const body = await request.json();
  const { code } = body;

  if (!code?.trim()) {
    return NextResponse.json({ error: 'Join code is required' }, { status: 400 });
  }

  const liveClass = await db.liveClass.findFirst({
    where: {
      joinCode: code.toUpperCase().trim(),
      deletedAt: null,
      status: { in: ['active', 'scheduled'] },
    },
    include: {
      host: { select: { id: true, name: true, avatar: true } },
      _count: { select: { participants: true } },
    },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Invalid or expired join code' }, { status: 404 });
  }

  return NextResponse.json({ data: liveClass });
}
