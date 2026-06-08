import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const before = searchParams.get('before');

  const where: Record<string, unknown> = { liveClassId: id };
  if (before) where.createdAt = { lt: new Date(before) };

  const messages = await db.liveClassChatMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ data: messages.reverse() });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  const body = await request.json();

  const { message, messageType, fileUrl, guestId, senderName } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  let senderId: string | null = null;
  let name = senderName || 'Anonymous';

  if (auth.authenticated && auth.id) {
    senderId = auth.id as string;
    const user = await db.user.findUnique({
      where: { id: auth.id },
      select: { name: true },
    });
    if (user) name = user.name;
  } else if (guestId) {
    senderId = null;
  }

  const chatMessage = await db.liveClassChatMessage.create({
    data: {
      liveClassId: id,
      senderId,
      senderName: name,
      message,
      messageType: messageType || 'text',
      fileUrl: fileUrl || null,
    },
  });

  return NextResponse.json({ data: chatMessage }, { status: 201 });
}
