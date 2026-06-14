import { Server as SocketIOServer, type Socket } from 'socket.io';
import { getToken } from 'next-auth/jwt';
import { db } from './db';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;

interface SocketAuthResult {
  authenticated: boolean;
  id?: string;
  role?: string;
  schoolId?: string;
  schoolName?: string;
}

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

function getParticipantIdentity(user: LiveClassUser) {
  return user.userId || user.guestId || user.socketId;
}

async function authenticateSocket(socket: Socket): Promise<SocketAuthResult> {
  try {
    const tokenFromAuth = (socket.handshake.auth as any)?.token as string | undefined;
    if (tokenFromAuth) {
      const token = await getToken({ token: tokenFromAuth, secret: JWT_SECRET } as any);
      if (token) {
        return {
          authenticated: true,
          id: token.id as string,
          role: token.role as string,
          schoolId: token.schoolId as string | undefined,
          schoolName: token.schoolName as string | undefined,
        };
      }
    }

    const cookie = socket.handshake.headers.cookie ?? '';
    const token = await getToken({ req: { headers: { cookie } } as any, secret: JWT_SECRET });
    if (token) {
      return {
        authenticated: true,
        id: token.id as string,
        role: token.role as string,
        schoolId: token.schoolId as string | undefined,
        schoolName: token.schoolName as string | undefined,
      };
    }
  } catch (error) {
    console.warn('[LiveClassSocket] Failed to authenticate socket:', error);
  }

  return { authenticated: false };
}

function normalizeParticipants(room: Map<string, LiveClassUser>) {
  const participantMap = new Map<string, LiveClassUser>();
  for (const user of room.values()) {
    const key = user.userId ? `user:${user.userId}` : user.guestId ? `guest:${user.guestId}` : user.socketId;
    const existing = participantMap.get(key);
    if (!existing) {
      participantMap.set(key, { ...user });
    } else {
      existing.isHandRaised = existing.isHandRaised || user.isHandRaised;
      existing.isMuted = existing.isMuted && user.isMuted;
      existing.isVideoOn = existing.isVideoOn || user.isVideoOn;
    }
  }

  return Array.from(participantMap.values()).map((user) => ({
    id: user.userId || user.guestId || user.socketId,
    name: user.name,
    role: user.role,
    isHandRaised: user.isHandRaised,
    isMuted: user.isMuted,
    isVideoOn: user.isVideoOn,
  }));
}

function emitParticipantUpdate(namespace: ReturnType<SocketIOServer['of']>, classId: string, room: Map<string, LiveClassUser>, hideParticipants: boolean) {
  const participants = normalizeParticipants(room);

  if (!hideParticipants) {
    namespace.to(classId).emit('live-class:participant-update', { participants });
    return;
  }

  for (const user of room.values()) {
    const recipientId = getParticipantIdentity(user);
    const visibleParticipants = participants.filter((participant) => {
      return participant.role === 'host' || participant.id === recipientId;
    });
    namespace.to(user.socketId).emit('live-class:participant-update', { participants: visibleParticipants });
  }
}

async function loadLiveClass(classId: string) {
  return db.liveClass.findFirst({
    where: { id: classId, deletedAt: null, status: { in: ['active', 'scheduled'] } },
    select: { hostId: true, guestUserId: true, settings: true },
  });
}

async function validateLiveClassParticipant(classId: string, userId?: string, guestId?: string) {
  const liveClass = await loadLiveClass(classId);
  if (!liveClass) {
    return { error: 'Live class not found or not active', liveClass: null };
  }

  let participant: Awaited<ReturnType<typeof db.liveClassParticipant.findFirst>> | null = null;
  if (userId) {
    participant = await db.liveClassParticipant.findFirst({
      where: { liveClassId: classId, userId },
    });
  } else if (guestId) {
    participant = await db.liveClassParticipant.findFirst({
      where: { liveClassId: classId, guestId },
    });
  }

  const isHost = (!!userId && userId === liveClass.hostId) || (!!guestId && guestId === liveClass.guestUserId);
  if (!participant && !isHost) {
    return { error: 'Not authorized to join this live class', liveClass };
  }

  if (participant && participant.leftAt) {
    return { error: 'Participant has already left the class', liveClass };
  }

  return { liveClass, participant, isHost };
}

async function isHostRole(socket: Socket, classId: string): Promise<boolean> {
  const room = classRooms.get(classId);
  if (room) {
    const user = room.get(socket.id);
    if (user?.role === 'host') {
      return true;
    }
  }

  if (!socket.data.userId && !socket.data.guestId) return false;

  const liveClass = await db.liveClass.findUnique({
    where: { id: classId },
    select: { hostId: true, guestUserId: true },
  });
  if (!liveClass) return false;
  return (!!socket.data.userId && socket.data.userId === liveClass.hostId) ||
         (!!socket.data.guestId && socket.data.guestId === liveClass.guestUserId);
}

export function setupLiveClassSocket(io: SocketIOServer) {
  const liveClassNamespace = io.of('/live-class');

  liveClassNamespace.on('connection', (socket) => {
    let currentClass: string | null = null;
    let currentUser: LiveClassUser | null = null;

    socket.on('live-class:join', async ({ classId, userId, guestId, name }) => {
      if (!classId) {
        socket.emit('live-class:error', { message: 'Class ID is required' });
        return;
      }

      const auth = await authenticateSocket(socket);
      const authUserId = auth.authenticated ? auth.id : undefined;
      const authGuestId = guestId;

      if (!authUserId && !authGuestId) {
        socket.emit('live-class:error', { message: 'Authentication or guest ID is required to join' });
        socket.disconnect(true);
        return;
      }

      const { liveClass, participant, isHost, error } = await validateLiveClassParticipant(classId, authUserId, authGuestId);
      if (!liveClass) {
        socket.emit('live-class:error', { message: error || 'Live class not found' });
        socket.disconnect(true);
        return;
      }
      if (error) {
        socket.emit('live-class:error', { message: error });
        socket.disconnect(true);
        return;
      }

      const room = classRooms.get(classId) ?? new Map<string, LiveClassUser>();
      classRooms.set(classId, room);

      const userName = participant?.name || name || 'Anonymous';
      const role = participant?.role as 'host' | 'co-host' | 'participant' || (isHost ? 'host' : 'participant');
      currentUser = {
        socketId: socket.id,
        userId: authUserId,
        guestId: authGuestId,
        name: userName,
        role,
        isHandRaised: participant?.isHandRaised ?? false,
        isMuted: participant?.isMuted ?? true,
        isVideoOn: participant?.isVideoOn ?? false,
      };

      if (!participant) {
        await db.liveClassParticipant.create({
          data: {
            liveClassId: classId,
            userId: authUserId || null,
            guestId: authGuestId || null,
            name: userName,
            role,
            isMuted: !isHost,
            isVideoOn: isHost,
          },
        });
      }

      room.set(socket.id, currentUser);
      currentClass = classId;

      socket.join(classId);
      socket.data.classId = classId;
      socket.data.userId = authUserId;
      socket.data.guestId = authGuestId;
      socket.data.userRole = role;

      const joinedPayload = {
        userId: authUserId || authGuestId || socket.id,
        name: currentUser.name,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
      };

      const hideParticipants = Boolean((liveClass.settings as Record<string, unknown>)?.hideParticipantsFromEachOther);
      if (hideParticipants) {
        const hostSockets = Array.from(room.values()).filter((u) => u.role === 'host').map((u) => u.socketId);
        hostSockets.forEach((socketId) => {
          liveClassNamespace.to(socketId).emit('live-class:user-joined', joinedPayload);
        });
        socket.emit('live-class:user-joined', joinedPayload);
      } else {
        liveClassNamespace.to(classId).emit('live-class:user-joined', joinedPayload);
      }

      emitParticipantUpdate(liveClassNamespace, classId, room, hideParticipants);
    });

    socket.on('live-class:leave', async ({ classId }) => {
      if (!classId) return;
      await leaveClass(classId);
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

      const key = socket.id;
      const user = room.get(key);
      if (user) {
        user.isHandRaised = isRaised;
      }

      liveClassNamespace.to(classId).emit('live-class:raise-hand', { userId: userId || socket.data.userId || socket.data.guestId, isRaised });
    });

    socket.on('live-class:mute-toggle', ({ classId, userId, isMuted }) => {
      if (!classId) return;
      const room = classRooms.get(classId);
      if (!room) return;

      const key = socket.id;
      const user = room.get(key);
      if (user) {
        user.isMuted = isMuted;
      }

      liveClassNamespace.to(classId).emit('live-class:mute-changed', { userId: userId || socket.data.userId || socket.data.guestId, isMuted });
    });

    socket.on('live-class:video-toggle', ({ classId, userId, isOn }) => {
      if (!classId) return;
      const room = classRooms.get(classId);
      if (!room) return;

      const key = socket.id;
      const user = room.get(key);
      if (user) {
        user.isVideoOn = isOn;
      }

      liveClassNamespace.to(classId).emit('live-class:video-changed', { userId: userId || socket.data.userId || socket.data.guestId, isOn });
    });

    socket.on('live-class:screen-share', ({ classId, userId, isSharing }) => {
      if (!classId) return;
      socket.to(classId).emit('live-class:screen-share', { userId: userId || socket.data.userId || socket.data.guestId, isSharing });
    });

    socket.on('live-class:whiteboard-update', ({ classId, snapshot }) => {
      if (!classId) return;
      socket.to(classId).emit('live-class:whiteboard-sync', { snapshot, timestamp: Date.now() });
    });

    socket.on('live-class:poll-vote', ({ classId, pollId, optionId, userId }) => {
      if (!classId) return;
      socket.to(classId).emit('live-class:poll-result', { pollId, optionId, userId: userId || socket.data.userId || socket.data.guestId });
    });

    socket.on('live-class:reaction', ({ classId, userId, emoji }) => {
      if (!classId) return;
      socket.to(classId).emit('live-class:reaction', { userId: userId || socket.data.userId || socket.data.guestId, emoji, timestamp: Date.now() });
    });

    socket.on('live-class:host-mute', async ({ classId, userId }) => {
      if (!classId || !(await isHostRole(socket, classId))) return;
      socket.to(classId).emit('live-class:host-mute', { userId });
    });

    socket.on('live-class:host-remove', async ({ classId, userId }) => {
      if (!classId || !(await isHostRole(socket, classId))) return;
      socket.to(classId).emit('live-class:host-remove', { userId });
    });

    socket.on('live-class:visibility-changed', async ({ classId, hidden }) => {
      if (!classId || !(await isHostRole(socket, classId))) return;
      socket.to(classId).emit('live-class:visibility-changed', { hidden });
    });

    socket.on('live-class:class-ended', async ({ classId }) => {
      if (!classId || !(await isHostRole(socket, classId))) return;
      socket.to(classId).emit('live-class:class-ended', {});
    });

    socket.on('disconnect', async () => {
      if (currentClass) {
        await leaveClass(currentClass);
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
        } catch (error) {
          console.error('[LiveClassSocket] Disconnect cleanup failed:', error);
        }
      }
    });

    async function leaveClass(classId: string) {
      if (!classId) return;
      const room = classRooms.get(classId);
      if (!room) return;

      room.delete(socket.id);

      const participantSettingsClass = await loadLiveClass(classId);
      const hideParticipants = Boolean((participantSettingsClass?.settings as Record<string, unknown>)?.hideParticipantsFromEachOther);
      const userLeftPayload = {
        userId: currentUser?.userId || currentUser?.guestId || socket.id,
        timestamp: new Date().toISOString(),
      };

      const remainingHostSockets = Array.from(room.values()).filter((u) => u.role === 'host').map((u) => u.socketId);
      if (remainingHostSockets.length > 0) {
        remainingHostSockets.forEach((socketId) => {
          liveClassNamespace.to(socketId).emit('live-class:user-left', userLeftPayload);
        });
      }

      if (!hideParticipants) {
        liveClassNamespace.to(classId).emit('live-class:user-left', userLeftPayload);
      }

      if (room.size === 0) {
        classRooms.delete(classId);
      } else {
        emitParticipantUpdate(liveClassNamespace, classId, room, hideParticipants);
      }
    }
  });
}

export { classRooms };
