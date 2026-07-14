import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupLiveClassSocket } from '../src/lib/live-class-socket';
import { getToken } from 'next-auth/jwt';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.use(async (socket, next) => {
  try {
    const cookie = socket.handshake.headers.cookie ?? '';
    const token = await getToken({ req: { headers: { cookie } } as any, secret: JWT_SECRET });
    if (token) {
      (socket.data as any).userId = token.id;
      (socket.data as any).role = token.role;
      (socket.data as any).schoolId = token.schoolId;
      next();
    } else {
      next(new Error('Authentication required'));
    }
  } catch {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const userId = (socket.data as any).userId as string;
  const userRole = (socket.data as any).role as string;
  const userSchoolId = (socket.data as any).schoolId as string;
  console.log(`[Main] Client connected: ${socket.id} (user: ${userId})`);

  socket.on('join-school', ({ schoolId }) => {
    // Validate schoolId matches authenticated user's school (admins may join others')
    if (schoolId && (userSchoolId === schoolId || userRole === 'SUPER_ADMIN')) {
      socket.join(`school:${schoolId}`);
    }
  });

  socket.on('leave-school', ({ schoolId }) => {
    if (schoolId) {
      socket.leave(`school:${schoolId}`);
    }
  });

  socket.on('join-class', ({ schoolId, classId }) => {
    if (classId) {
      socket.join(`class:${classId}`);
    }
  });

  socket.on('leave-class', ({ schoolId, classId }) => {
    if (classId) {
      socket.leave(`class:${classId}`);
    }
  });

  socket.on('user-online', ({ schoolId, userId: onlineUserId, userName }) => {
    if (schoolId) {
      socket.to(`school:${schoolId}`).emit('user-online', { userId: onlineUserId, userName });
    }
  });

  // Chat messages: scope to conversation room instead of entire school
  socket.on('chat-message', (data) => {
    if (data.conversationId) {
      // Per-conversation room (most efficient — only recipients get the message)
      socket.to(`conversation:${data.conversationId}`).emit('chat-message', data);
    } else if (data.schoolId) {
      // Fallback: school-wide broadcast for announcements/broadcasts
      socket.to(`school:${data.schoolId}`).emit('chat-message', data);
    }
  });

  // Typing: scope to conversation room instead of entire school
  socket.on('typing', (data) => {
    if (data.conversationId) {
      socket.to(`conversation:${data.conversationId}`).emit('typing', data);
    } else if (data.schoolId) {
      socket.to(`school:${data.schoolId}`).emit('typing', data);
    }
  });

  // Conversation room joins (for chat scoping)
  socket.on('join-conversation', ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conversation:${conversationId}`);
    }
  });

  socket.on('leave-conversation', ({ conversationId }) => {
    if (conversationId) {
      socket.leave(`conversation:${conversationId}`);
    }
  });

  // Server-originated events: broadcast to school room
  socket.on('send-notification', ({ schoolId, ...rest }) => {
    if (schoolId) {
      io.to(`school:${schoolId}`).emit('notification', rest);
    }
  });

  socket.on('attendance-marked', ({ schoolId, ...rest }) => {
    if (schoolId) {
      io.to(`school:${schoolId}`).emit('attendance-update', rest);
    }
  });

  socket.on('exam-published', ({ schoolId, ...rest }) => {
    if (schoolId) {
      io.to(`school:${schoolId}`).emit('exam-published', rest);
    }
  });

  socket.on('grade-updated', ({ schoolId, ...rest }) => {
    if (schoolId) {
      io.to(`school:${schoolId}`).emit('grade-update', rest);
    }
  });

  socket.on('payment-received', ({ schoolId, ...rest }) => {
    if (schoolId) {
      io.to(`school:${schoolId}`).emit('payment-update', rest);
    }
  });

  socket.on('announcement-posted', ({ schoolId, ...rest }) => {
    if (schoolId) {
      io.to(`school:${schoolId}`).emit('announcement', rest);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Main] Client disconnected: ${socket.id} (${reason})`);
  });
});

// Attach the Live Class namespace
setupLiveClassSocket(io);

const PORT = parseInt(process.env.SOCKET_PORT || '3003', 10);
httpServer.listen(PORT, () => {
  console.log(`[Skoolar Socket.IO] Server running on port ${PORT}`);
  console.log(`[Skoolar Socket.IO] Live Class namespace: /live-class`);
});
