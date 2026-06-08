import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupLiveClassSocket } from '../src/lib/live-class-socket';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log(`[Main] Client connected: ${socket.id}`);

  socket.on('join-school', ({ schoolId }) => {
    if (schoolId) {
      socket.join(`school:${schoolId}`);
      console.log(`[Main] ${socket.id} joined school:${schoolId}`);
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

// Attach the Live Class namespace
setupLiveClassSocket(io);

const PORT = parseInt(process.env.SOCKET_PORT || '3003', 10);
httpServer.listen(PORT, () => {
  console.log(`[Skoolar Socket.IO] Server running on port ${PORT}`);
  console.log(`[Skoolar Socket.IO] Live Class namespace: /live-class`);
});
