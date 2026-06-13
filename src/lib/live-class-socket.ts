import { Server as SocketIOServer } from 'socket.io';
import { db } from './db';

interface LiveClassUser {
  socketId: string;
  userId?: string;
  guestId?: string;
  name: string;
  role: 'host' | 'co-host' | 'participant';
  isHandRaised: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
}

const classRooms = new Map<string, Map<string, LiveClassUser>>();

function isHostRole(socket: any, classId: string): boolean {
  const room = classRooms.get(classId);
  if (!room) return false;
  const userKey = socket.data.userKey as string | undefined;
  if (!userKey) return false;
  const user = room.get(userKey);
  return user?.role === 'host';
}

export function setupLiveClassSocket(io: SocketIOServer) {
  const liveClassNamespace = io.of('/live-class');

  liveClassNamespace.on('connection', (socket) => {
    let currentClass: string | null = null;
    let currentUser: LiveClassUser | null = null;

    socket.on('live-class:join', ({ classId, userId, guestId, name }) => {
      if (!classId) return;

      if (!classRooms.has(classId)) {
        classRooms.set(classId, new Map());
      }

      const room = classRooms.get(classId)!;
      const userKey = userId || guestId || socket.id;

      currentUser = {
        socketId: socket.id,
        userId,
        guestId,
        name: name || 'Anonymous',
        role: room.size === 0 ? 'host' : 'participant',
        isHandRaised: false,
        isMuted: true,
        isVideoOn: false,
      };

      room.set(userKey, currentUser);
      currentClass = classId;

      socket.join(classId);
      socket.data.classId = classId;
      socket.data.userKey = userKey;

      liveClassNamespace.to(classId).emit('live-class:user-joined', {
        userId: userKey,
        name: currentUser.name,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
      });

      const participants = Array.from(room.values()).map(u => ({
        id: u.userId || u.guestId || u.socketId,
        name: u.name,
        role: u.role,
        isHandRaised: u.isHandRaised,
        isMuted: u.isMuted,
        isVideoOn: u.isVideoOn,
      }));

      socket.emit('live-class:participant-update', { participants });
    });

    socket.on('live-class:leave', ({ classId, userId, guestId }) => {
      leaveClass(classId, userId, guestId);
    });

    socket.on('live-class:chat', ({ classId, message, sender }) => {
      if (!classId || !message) return;
      socket.to(classId).emit('live-class:chat-message', {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender,
        message,
        type: 'text',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('live-class:raise-hand', ({ classId, userId, isRaised }) => {
      if (!classId) return;
      const room = classRooms.get(classId);
      if (!room) return;

      const user = room.get(userId || socket.data.userKey);
      if (user) user.isHandRaised = isRaised;

      liveClassNamespace.to(classId).emit('live-class:raise-hand', { userId, isRaised });
    });

    socket.on('live-class:mute-toggle', ({ classId, userId, isMuted }) => {
      if (!classId) return;
      const room = classRooms.get(classId);
      if (!room) return;

      const user = room.get(userId || socket.data.userKey);
      if (user) user.isMuted = isMuted;

      liveClassNamespace.to(classId).emit('live-class:mute-changed', { userId, isMuted });
    });

    socket.on('live-class:video-toggle', ({ classId, userId, isOn }) => {
      if (!classId) return;
      const room = classRooms.get(classId);
      if (!room) return;

      const user = room.get(userId || socket.data.userKey);
      if (user) user.isVideoOn = isOn;

      liveClassNamespace.to(classId).emit('live-class:video-changed', { userId, isOn });
    });

    socket.on('live-class:screen-share', ({ classId, userId, isSharing }) => {
      if (!classId) return;
      socket.to(classId).emit('live-class:screen-share', { userId, isSharing });
    });

    socket.on('live-class:whiteboard-update', ({ classId, snapshot }) => {
      if (!classId) return;
      socket.to(classId).emit('live-class:whiteboard-sync', { snapshot, timestamp: Date.now() });
    });

    socket.on('live-class:poll-vote', ({ classId, pollId, optionId, userId }) => {
      if (!classId) return;
      socket.to(classId).emit('live-class:poll-result', { pollId, optionId, userId });
    });

    socket.on('live-class:reaction', ({ classId, userId, emoji }) => {
      if (!classId) return;
      socket.to(classId).emit('live-class:reaction', { userId, emoji, timestamp: Date.now() });
    });

    socket.on('live-class:host-mute', ({ classId, userId }) => {
      if (!classId || !isHostRole(socket, classId)) return;
      socket.to(classId).emit('live-class:host-mute', { userId });
    });

    socket.on('live-class:host-remove', ({ classId, userId }) => {
      if (!classId || !isHostRole(socket, classId)) return;
      socket.to(classId).emit('live-class:host-remove', { userId });
    });

    socket.on('live-class:visibility-changed', ({ classId, hidden }) => {
      if (!classId || !isHostRole(socket, classId)) return;
      socket.to(classId).emit('live-class:visibility-changed', { hidden });
    });

    socket.on('live-class:class-ended', ({ classId }) => {
      if (!classId || !isHostRole(socket, classId)) return;
      socket.to(classId).emit('live-class:class-ended', {});
    });

    socket.on('disconnect', async () => {
      if (currentClass) {
        leaveClass(currentClass, currentUser?.userId, currentUser?.guestId);
        try {
          const where: Record<string, unknown> = { liveClassId: currentClass, leftAt: null };
          if (currentUser?.userId) where.userId = currentUser.userId;
          else if (currentUser?.guestId) where.guestId = currentUser.guestId;
          if (Object.keys(where).length > 1) {
            await db.liveClassParticipant.updateMany({
              where: where as any,
              data: { leftAt: new Date(), isVideoOn: false, isScreenSharing: false },
            });
            const now = new Date();
            await db.liveClassAttendance.updateMany({
              where: where as any,
              data: {
                leftAt: now,
              },
            });
          }
        } catch {}
      }
    });

    function leaveClass(classId: string, userId?: string, guestId?: string) {
      if (!classId) return;
      const room = classRooms.get(classId);
      if (!room) return;

      const userKey = userId || guestId;
      if (userKey) {
        room.delete(userKey);
      } else if (currentUser) {
        room.delete(currentUser.socketId);
      }

      liveClassNamespace.to(classId).emit('live-class:user-left', {
        userId: userKey,
        timestamp: new Date().toISOString(),
      });

      if (room.size === 0) {
        classRooms.delete(classId);
      }
    }
  });
}

export { classRooms };
