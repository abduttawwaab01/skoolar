import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { setupLiveClassSocket } from '../src/lib/live-class-socket';
import { getToken } from 'next-auth/jwt';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '10000', 10);
const JWT_SECRET = process.env.NEXTAUTH_SECRET;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware: validate JWT from cookies on every connection
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
        socket.to(`conversation:${data.conversationId}`).emit('chat-message', data);
      } else if (data.schoolId) {
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

    // Conversation room joins
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

  setupLiveClassSocket(io);

  httpServer.listen(port, hostname, () => {
    console.log(`[Skoolar] Server ready on http://${hostname}:${port}`);
    console.log(`[Skoolar] Socket.IO namespaces: / (default), /live-class`);
  });
});
