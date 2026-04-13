import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/communication/conversations
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId && auth.schoolId) {
      // Use user's school if not specified
    }

    const where: Record<string, unknown> = {
      schoolId: schoolId || auth.schoolId,
    };

    // Get conversations where user is a participant (participantIds contains user ID)
    // participantIds is stored as JSON array string
    const conversations = await db.conversation.findMany({
      where,
      include: {
        messages: {
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
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // For each conversation, compute last message, unread count, and other display data
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const messages = conv.messages as any[];
        const lastMessage = messages[messages.length - 1] || null;
        // Count unread messages (isRead = false and senderId !== current user)
        const unreadCount = messages.filter(
          (m) => !m.isRead && m.senderId !== auth.userId!
        ).length;

        // Parse participantIds JSON array
        let participantIds: string[] = [];
        try {
          participantIds = typeof conv.participantIds === 'string'
            ? JSON.parse(conv.participantIds)
            : Array.isArray(conv.participantIds)
              ? conv.participantIds
              : [];
        } catch {
          participantIds = [];
        }

         // Get other participants (exclude current user)
         const otherParticipantIds = participantIds.filter((id) => id !== auth.userId!);
        let otherNames = '';
        if (otherParticipantIds.length > 0) {
          const users = await db.user.findMany({
            where: { id: { in: otherParticipantIds } },
            select: { name: true },
          });
          otherNames = users.map((u) => u.name).join(', ');
        }

        return {
          id: conv.id,
          title: conv.title || otherNames || 'Conversation',
          lastMessage: lastMessage ? lastMessage.content : '',
          lastMessageAt: lastMessage ? lastMessage.createdAt : conv.createdAt,
          unreadCount,
          participantIds,
          messageCount: messages.length,
        };
      })
    );

    return NextResponse.json({ data: enriched });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/communication/conversations
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolId, participantIds, title, initialMessage } = body;

    if (!schoolId || !participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { error: 'schoolId and participantIds (array) are required' },
        { status: 400 }
      );
    }

     // Ensure current user is included
     if (!participantIds.includes(auth.userId!)) {
       participantIds.push(auth.userId!);
     }

     // Create conversation
     const conversation = await db.conversation.create({
       data: {
         schoolId,
         participantIds: JSON.stringify(participantIds),
         title: title || null,
         createdBy: auth.userId!,
       },
     });

     // Optionally create initial message
     if (initialMessage && typeof initialMessage === 'string') {
       await db.message.create({
         data: {
           conversationId: conversation.id,
           schoolId,
           senderId: auth.userId!,
           content: initialMessage,
           type: 'text',
         },
       });
     }

    return NextResponse.json(
      { data: conversation },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
