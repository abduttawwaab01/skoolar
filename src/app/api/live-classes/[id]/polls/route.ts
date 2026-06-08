import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);

  const polls = await db.liveClassPoll.findMany({
    where: { liveClassId: id },
    include: {
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: polls });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const liveClass = await db.liveClass.findUnique({ where: { id } });
  if (!liveClass || (liveClass.hostId !== auth.id && auth.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Only the host can create polls' }, { status: 403 });
  }

  const body = await request.json();
  const { question, options, isMultiple, isAnonymous } = body;

  if (!question?.trim()) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }

  if (!options || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: 'At least 2 options are required' }, { status: 400 });
  }

  const poll = await db.liveClassPoll.create({
    data: {
      liveClassId: id,
      question,
      options: options.map((text: string, i: number) => ({
        id: `opt-${i}`,
        text,
      })),
      isMultiple: isMultiple || false,
      isAnonymous: isAnonymous || false,
      isActive: true,
    },
  });

  return NextResponse.json({ data: poll }, { status: 201 });
}
