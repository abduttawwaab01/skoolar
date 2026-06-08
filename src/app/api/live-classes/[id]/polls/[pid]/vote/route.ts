import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  const { id, pid } = await params;
  const auth = await authenticateRequest(request);
  const body = await request.json();

  const { optionId, guestId } = body;

  if (!optionId) {
    return NextResponse.json({ error: 'Option ID is required' }, { status: 400 });
  }

  const poll = await db.liveClassPoll.findFirst({
    where: { id: pid, liveClassId: id, isActive: true },
  });

  if (!poll) {
    return NextResponse.json({ error: 'Poll not found or closed' }, { status: 404 });
  }

  let userId = auth.authenticated ? auth.id : null;
  const existingVote = userId
    ? await db.liveClassPollVote.findUnique({
        where: { pollId_userId: { pollId: pid, userId } },
      })
    : guestId
      ? await db.liveClassPollVote.findUnique({
          where: { pollId_guestId: { pollId: pid, guestId } },
        })
      : null;

  if (existingVote) {
    if (!poll.isMultiple) {
      return NextResponse.json({ error: 'Already voted' }, { status: 409 });
    }
    if (existingVote.optionId === optionId) {
      await db.liveClassPollVote.delete({ where: { id: existingVote.id } });
      return NextResponse.json({ success: true, action: 'removed' });
    }
  }

  const vote = await db.liveClassPollVote.create({
    data: { pollId: pid, userId, guestId, optionId },
  });

  return NextResponse.json({ data: vote }, { status: 201 });
}
