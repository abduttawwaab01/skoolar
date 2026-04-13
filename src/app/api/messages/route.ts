import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/messages - Get messages for a conversation
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    // Verify conversation exists and user is a participant
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const participantIds = JSON.parse(conversation.participantIds as string);
    if (!participantIds.includes(auth.userId!)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get messages with sender info
    const messages = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Mark messages as read for current user
    await db.message.updateMany({
      where: {
        conversationId,
        senderId: { not: auth.userId! },
        isRead: false,
      },
      data: {
        isRead: true,
        readBy: auth.userId!,
      },
    });

    return NextResponse.json({ data: messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/messages - Send a message
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { conversationId, content, type = 'text', fileUrl, fileName } = body;

    if (!conversationId || !content) {
      return NextResponse.json(
        { error: 'conversationId and content are required' },
        { status: 400 }
      );
    }

    // Verify conversation exists and user is a participant
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const participantIds = JSON.parse(conversation.participantIds as string);
    if (!participantIds.includes(auth.userId!)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Create message
    const message = await db.message.create({
      data: {
        conversationId,
        schoolId: conversation.schoolId,
        senderId: auth.userId!,
        content,
        type,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        isRead: false,
      },
    });

    // Update conversation's last message and timestamp
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content,
        lastMessageAt: new Date(),
      },
    });

     // Fetch the message (without sender include for now)
     const messageWithSender = await db.message.findUnique({
       where: { id: message.id },
     });

    return NextResponse.json({ data: messageWithSender }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
