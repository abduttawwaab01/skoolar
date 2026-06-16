import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { setupLiveClassSocket } from '../src/lib/live-class-socket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '10000', 10);

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

  io.on('connection', (socket) => {
    console.log(`[Main] Client connected: ${socket.id}`);

    socket.on('join-school', ({ schoolId }) => {
      if (schoolId) {
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

    socket.on('user-online', ({ schoolId, userId, userName }) => {
      if (schoolId) {
        socket.to(`school:${schoolId}`).emit('user-online', { userId, userName });
      }
    });

    socket.on('chat-message', (data) => {
      if (data.schoolId) {
        socket.to(`school:${data.schoolId}`).emit('chat-message', data);
      }
    });

    socket.on('typing', (data) => {
      if (data.schoolId) {
        socket.to(`school:${data.schoolId}`).emit('typing', data);
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
