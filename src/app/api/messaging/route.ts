import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "";

  try {
    switch (action) {
      case "conversations": {
        const userId = searchParams.get("userId") || "";
        const schoolId = searchParams.get("schoolId") || "";
        const isSuperAdmin = authResult.role === "SUPER_ADMIN";

        if (!userId)
          return NextResponse.json(
            { success: false, message: "Missing userId" },
            { status: 400 },
          );
        if (!schoolId && !isSuperAdmin) {
          return NextResponse.json(
            { success: false, message: "Missing schoolId" },
            { status: 400 },
          );
        }

        const where: Record<string, unknown> = {
          participantIds: { contains: userId },
        };
        if (schoolId) {
          where.schoolId = schoolId;
        }

        const conversations = await db.conversation.findMany({
          where,
          orderBy: { lastMessageAt: "desc" },
        });

        if (conversations.length === 0) {
          return NextResponse.json({ success: true, data: [] });
        }

        // ── BATCH: Fetch all last messages, unread counts, and participants in single queries ──
        const convIds = conversations.map((c) => c.id);

        const [lastMessages, unreadCounts, allUsers] = await Promise.all([
          // Get last message for each conversation (single query with grouping)
          db.message.findMany({
            where: { conversationId: { in: convIds } },
            orderBy: { createdAt: "desc" },
          }),
          // Get unread counts for each conversation
          db.message.groupBy({
            by: ["conversationId"],
            where: {
              conversationId: { in: convIds },
              isRead: false,
              senderId: { not: userId },
            },
            _count: { id: true },
          }),
          // Collect all unique participant IDs and fetch users in one query
          db.user.findMany({
            select: { id: true, name: true, avatar: true, role: true },
          }),
        ]);

        // Build lookup maps
        const lastMsgMap = new Map<
          string,
          { content: string | null; type: string | null; createdAt: Date }
        >();
        for (const msg of lastMessages) {
          if (!lastMsgMap.has(msg.conversationId)) {
            lastMsgMap.set(msg.conversationId, {
              content: msg.content,
              type: msg.type,
              createdAt: msg.createdAt,
            });
          }
        }

        const unreadMap = new Map(
          unreadCounts.map((u) => [u.conversationId, u._count.id]),
        );
        const userMap = new Map(allUsers.map((u) => [u.id, u]));

        const enriched = conversations.map((conv) => {
          const participants = JSON.parse(
            conv.participantIds || "[]",
          ) as string[];
          const participantUsers = participants
            .map((id) => userMap.get(id))
            .filter(Boolean);
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

      case "messages": {
        const conversationId = searchParams.get("conversationId") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        if (!conversationId)
          return NextResponse.json(
            { success: false, message: "conversationId required" },
            { status: 400 },
          );

        const [messages, total] = await Promise.all([
          db.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.message.count({ where: { conversationId } }),
        ]);

        // ── BATCH: Fetch all senders in a single query ──
        const senderIds = [...new Set(messages.map((m) => m.senderId))];
        const senders = await db.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, name: true, avatar: true, role: true },
        });
        const senderMap = new Map(senders.map((s) => [s.id, s]));

        const enriched = messages.map((msg) => ({
          ...msg,
          sender: senderMap.get(msg.senderId) || null,
        }));

        return NextResponse.json({
          success: true,
          data: enriched,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      }

      case "search-users": {
        const schoolId = searchParams.get("schoolId") || "";
        const query = searchParams.get("query") || "";
        const role = searchParams.get("role") || "";

        // For SUPER_ADMIN, allow searching across all schools if no schoolId provided
        const isSuperAdmin = authResult.role === "SUPER_ADMIN";
        if (!schoolId && !isSuperAdmin) {
          return NextResponse.json(
            { success: false, message: "schoolId required" },
            { status: 400 },
          );
        }

        const where: Record<string, unknown> = query
          ? { user: { name: { contains: query, mode: "insensitive" } } }
          : {};
        if (role) {
          where.role = role;
        }
        if (schoolId) {
          where.schoolId = schoolId;
        }
        where.isActive = true;

        // Search across students, teachers, parents
        const [students, teachers, parents] = await Promise.all([
          db.student.findMany({
            where: { ...where, ...(schoolId ? { schoolId } : {}) },
            include: {
              user: { select: { id: true, name: true, avatar: true } },
              class: { select: { name: true } },
              school: { select: { id: true, name: true } },
            },
            take: 10,
          }),
          db.teacher.findMany({
            where: { ...where, ...(schoolId ? { schoolId } : {}) },
            include: {
              user: { select: { id: true, name: true, avatar: true } },
              school: { select: { id: true, name: true } },
            },
            take: 10,
          }),
          db.parent.findMany({
            where: { ...where, ...(schoolId ? { schoolId } : {}) },
            include: {
              user: { select: { id: true, name: true, avatar: true } },
              school: { select: { id: true, name: true } },
            },
            take: 10,
          }),
        ]);

        const userRole = authResult.role;
        let users = [
          ...students.map((s) => ({
            ...s.user,
            role: "STUDENT",
            meta: s.class?.name,
            schoolId: s.schoolId,
            schoolName: s.school?.name || null,
          })),
          ...teachers.map((t) => ({
            ...t.user,
            role: "TEACHER",
            meta: t.specialization,
            schoolId: t.schoolId,
            schoolName: t.school?.name || null,
          })),
          ...parents.map((p) => ({ 
            ...p.user, 
            role: "PARENT", 
            meta: null,
            schoolId: p.schoolId,
            schoolName: p.school?.name || null,
          })),
        ];
        if (userRole === 'PARENT') {
          users = users.filter(u => u.role !== 'PARENT');
        }
        if (userRole === 'STUDENT') {
          users = [];
        }
        if (userRole === 'TEACHER') {
          users = users.filter(u => u.role !== 'STUDENT');
        }

        return NextResponse.json({ success: true, data: users });
      }

      default:
        return NextResponse.json(
          { success: false, message: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "";
  const body = await request.json().catch(() => ({}));

  try {
    switch (action) {
      case "create-conversation": {
        const { schoolId, participantIds, type, title, createdBy } = body;
        if (!schoolId || !participantIds || participantIds.length < 2) {
          return NextResponse.json(
            {
              success: false,
              message: "schoolId and at least 2 participants required",
            },
            { status: 400 },
          );
        }
        const userRole = authResult.role;
        const userId = authResult.id;
        const initiatorIndex = participantIds.indexOf(userId);
        if (initiatorIndex === -1) {
          return NextResponse.json(
            { success: false, message: "You must be a participant" },
            { status: 400 },
          );
        }
        const otherParticipantIds = participantIds.filter((id: string) => id !== userId);
        const otherUsers = await db.user.findMany({
          where: { id: { in: otherParticipantIds } },
          select: { id: true, role: true },
        });
        const otherRoles = otherUsers.map(u => u.role);
        if (userRole === 'PARENT') {
          const allowedRoles = ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER', 'DIRECTOR', 'ACCOUNTANT', 'LIBRARIAN'];
          const hasDisallowed = otherRoles.some(r => !allowedRoles.includes(r));
          if (hasDisallowed) {
            return NextResponse.json(
              { success: false, message: "Parents can only message school staff" },
              { status: 403 },
            );
          }
        }
        if (userRole === 'STUDENT') {
          return NextResponse.json(
            { success: false, message: "Students cannot initiate conversations" },
            { status: 403 },
          );
        }
        if (userRole === 'TEACHER') {
          const allowedRoles = ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER', 'DIRECTOR', 'ACCOUNTANT', 'PARENT'];
          const hasDisallowed = otherRoles.some(r => r === 'STUDENT');
          if (hasDisallowed) {
            return NextResponse.json(
              { success: false, message: "Teachers cannot message students directly" },
              { status: 403 },
            );
          }
        }
        // Check if direct conversation already exists between these users
        if (type === "direct") {
          const sorted = [...participantIds].sort();
          const existing = await db.conversation.findFirst({
            where: {
              schoolId,
              type: "direct",
              participantIds: { contains: sorted[0] },
            },
          });
          if (existing) {
            const parts = JSON.parse(
              existing.participantIds || "[]",
            ) as string[];
            if (parts.sort().join(",") === sorted.join(",")) {
              return NextResponse.json({ success: true, data: existing });
            }
          }
        }
        const conversation = await db.conversation.create({
          data: {
            schoolId,
            type: type || "direct",
            title: title || null,
            participantIds: JSON.stringify(participantIds),
            createdBy: createdBy || null,
          },
        });
        return NextResponse.json(
          { success: true, data: conversation },
          { status: 201 },
        );
      }

      case "send-message": {
        const { conversationId, senderId, schoolId, content, type } = body;
        if (!conversationId || !senderId || !content) {
          return NextResponse.json(
            { success: false, message: "Missing required fields" },
            { status: 400 },
          );
        }
        const conversation = await db.conversation.findUnique({
          where: { id: conversationId },
        });
        if (!conversation)
          return NextResponse.json(
            { success: false, message: "Conversation not found" },
            { status: 404 },
          );

        const message = await db.message.create({
          data: {
            conversationId,
            schoolId: schoolId || conversation.schoolId,
            senderId,
            content: String(content).slice(0, 10000),
            type: type || "text",
          },
        });

        // Update conversation last message
        await db.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessage: String(content).slice(0, 100),
            lastMessageAt: new Date(),
          },
        });

        const sender = await db.user.findUnique({
          where: { id: senderId },
          select: { name: true, avatar: true, role: true },
        });

        return NextResponse.json(
          { success: true, data: { ...message, sender } },
          { status: 201 },
        );
      }

      case "mark-read": {
        const { conversationId, userId } = body;
        if (!conversationId || !userId)
          return NextResponse.json(
            { success: false, message: "Missing fields" },
            { status: 400 },
          );

        await db.message.updateMany({
          where: { conversationId, senderId: { not: userId }, isRead: false },
          data: { isRead: true },
        });

        return NextResponse.json({
          success: true,
          message: "Messages marked as read",
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
