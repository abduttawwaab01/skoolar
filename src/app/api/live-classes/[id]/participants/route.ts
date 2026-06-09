import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  const body = await request.json();
  const { userId, guestId, isHandRaised, isMuted, isVideoOn, isScreenSharing } = body;

  const pWhere: Record<string, unknown> = { liveClassId: id, leftAt: null };
  if (userId) pWhere.userId = userId;
  else if (guestId) pWhere.guestId = guestId;
  else return NextResponse.json({ error: 'userId or guestId is required' }, { status: 400 });

  const participant = await db.liveClassParticipant.findFirst({ where: pWhere });

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  if (participant.userId && participant.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!participant.userId && participant.guestId !== guestId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (isHandRaised !== undefined) updateData.isHandRaised = isHandRaised;
  if (isMuted !== undefined) updateData.isMuted = isMuted;
  if (isVideoOn !== undefined) updateData.isVideoOn = isVideoOn;
  if (isScreenSharing !== undefined) updateData.isScreenSharing = isScreenSharing;

  const updated = await db.liveClassParticipant.update({
    where: { id: participant.id },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
}
