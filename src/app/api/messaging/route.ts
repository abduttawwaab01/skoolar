import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';

  try {
    switch (action) {
      case 'conversations': {
        const userId = searchParams.get('userId') || '';
        const schoolId = searchParams.get('schoolId') || '';
        if (!userId || !schoolId) return NextResponse.json({ success: false, message: 'Missing params' }, { status: 400 });

        const conversations = await db.conversation.findMany({
          where: { schoolId, participantIds: { contains: userId } },
          orderBy: { lastMessageAt: 'desc' },
        });

        if (conversations.length === 0) {
          return NextResponse.json({ success: true, data: [] });
        }

        // ── BATCH: Fetch all last messages, unread counts, and participants in single queries ──
        const convIds = conversations.map(c => c.id);

        const [lastMessages, unreadCounts, allUsers] = await Promise.all([
          // Get last message for each conversation (single query with grouping)
          db.message.findMany({
            where: { conversationId: { in: convIds } },
            orderBy: { createdAt: 'desc' },
          }),
          // Get unread counts for each conversation
          db.message.groupBy({
            by: ['conversationId'],
            where: { conversationId: { in: convIds }, isRead: false, senderId: { not: userId } },
            _count: { id: true },
          }),
          // Collect all unique participant IDs and fetch users in one query
          db.user.findMany({
            select: { id: true, name: true, avatar: true, role: true },
          }),
        ]);

        // Build lookup maps
        const lastMsgMap = new Map<string, { content: string | null; type: string | null; createdAt: Date }>();
        for (const msg of lastMessages) {
          if (!lastMsgMap.has(msg.conversationId)) {
            lastMsgMap.set(msg.conversationId, { content: msg.content, type: msg.type, createdAt: msg.createdAt });
          }
        }

        const unreadMap = new Map(unreadCounts.map(u => [u.conversationId, u._count.id]));
        const userMap = new Map(allUsers.map(u => [u.id, u]));

        const enriched = conversations.map((conv) => {
          const participants = JSON.parse(conv.participantIds || '[]') as string[];
          const participantUsers = participants.map(id => userMap.get(id)).filter(Boolean);
          const lastMsg = lastMsgMap.get(conv.id);

          return {
            ...conv,
            participants: participantUsers,
            lastMessage: lastMsg?.content || null,
            lastMessageType: lastMsg?.type || null,
            lastMessageAt: lastMsg?.createdAt || conv.lastMessageAt,
            unreadCount: unreadMap.get(conv.id) || 0,
          };
        });

        return NextResponse.json({ success: true, data: enriched });
      }

      case 'messages': {
        const conversationId = searchParams.get('conversationId') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        if (!conversationId) return NextResponse.json({ success: false, message: 'conversationId required' }, { status: 400 });

        const [messages, total] = await Promise.all([
          db.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.message.count({ where: { conversationId } }),
        ]);

        // ── BATCH: Fetch all senders in a single query ──
        const senderIds = [...new Set(messages.map(m => m.senderId))];
        const senders = await db.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, name: true, avatar: true, role: true },
        });
        const senderMap = new Map(senders.map(s => [s.id, s]));

        const enriched = messages.map(msg => ({
          ...msg,
          sender: senderMap.get(msg.senderId) || null,
        }));

        return NextResponse.json({
          success: true,
          data: enriched,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }

      case 'search-users': {
        const schoolId = searchParams.get('schoolId') || '';
        const query = searchParams.get('query') || '';
        const role = searchParams.get('role') || '';
        if (!schoolId) return NextResponse.json({ success: false, message: 'schoolId required' }, { status: 400 });

        const where: Record<string, unknown> = { schoolId, isActive: true };
        if (query) {
          (where as Record<string, unknown>).user = { name: { contains: query } };
        }
        if (role) {
          (where as Record<string, string>).role = role;
        }

        // Search across students, teachers, parents
        const [students, teachers, parents] = await Promise.all([
          db.student.findMany({
            where: { schoolId, isActive: true, user: query ? { name: { contains: query } } : undefined },
            include: { user: { select: { id: true, name: true, avatar: true } }, class: { select: { name: true } } },
            take: 10,
          }),
          db.teacher.findMany({
            where: { schoolId, isActive: true, user: query ? { name: { contains: query } } : undefined },
            include: { user: { select: { id: true, name: true, avatar: true } } },
            take: 10,
          }),
          db.parent.findMany({
            where: { schoolId, user: query ? { name: { contains: query } } : undefined },
            include: { user: { select: { id: true, name: true, avatar: true } } },
            take: 10,
          }),
        ]);

        const users = [
          ...students.map(s => ({ ...s.user, role: 'STUDENT', meta: s.class?.name })),
          ...teachers.map(t => ({ ...t.user, role: 'TEACHER', meta: t.specialization })),
          ...parents.map(p => ({ ...p.user, role: 'PARENT', meta: null })),
        ];

        return NextResponse.json({ success: true, data: users });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';
  const body = await request.json().catch(() => ({}));

  try {
    switch (action) {
      case 'create-conversation': {
        const { schoolId, participantIds, type, title, createdBy } = body;
        if (!schoolId || !participantIds || participantIds.length < 2) {
          return NextResponse.json({ success: false, message: 'schoolId and at least 2 participants required' }, { status: 400 });
        }
        // Check if direct conversation already exists between these users
        if (type === 'direct') {
          const sorted = [...participantIds].sort();
          const existing = await db.conversation.findFirst({
            where: { schoolId, type: 'direct', participantIds: { contains: sorted[0] } },
          });
          if (existing) {
            const parts = JSON.parse(existing.participantIds || '[]') as string[];
            if (parts.sort().join(',') === sorted.join(',')) {
              return NextResponse.json({ success: true, data: existing });
            }
          }
        }
        const conversation = await db.conversation.create({
          data: {
            schoolId,
            type: type || 'direct',
            title: title || null,
            participantIds: JSON.stringify(participantIds),
            createdBy: createdBy || null,
          },
        });
        return NextResponse.json({ success: true, data: conversation }, { status: 201 });
      }

      case 'send-message': {
        const { conversationId, senderId, schoolId, content, type } = body;
        if (!conversationId || !senderId || !content) {
          return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }
        const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });

        const message = await db.message.create({
          data: {
            conversationId,
            schoolId: schoolId || conversation.schoolId,
            senderId,
            content: String(content).slice(0, 10000),
            type: type || 'text',
          },
        });

        // Update conversation last message
        await db.conversation.update({
          where: { id: conversationId },
          data: { lastMessage: String(content).slice(0, 100), lastMessageAt: new Date() },
        });

        const sender = await db.user.findUnique({
          where: { id: senderId },
          select: { name: true, avatar: true, role: true },
        });

        return NextResponse.json({ success: true, data: { ...message, sender } }, { status: 201 });
      }

      case 'mark-read': {
        const { conversationId, userId } = body;
        if (!conversationId || !userId) return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });

        await db.message.updateMany({
          where: { conversationId, senderId: { not: userId }, isRead: false },
          data: { isRead: true },
        });

        return NextResponse.json({ success: true, message: 'Messages marked as read' });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
