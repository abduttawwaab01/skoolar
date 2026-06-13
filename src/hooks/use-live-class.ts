'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

interface LiveClassSocketState {
  isConnected: boolean;
  participants: any[];
  messages: any[];
}

export function useLiveClassSocket(classId: string, userId?: string, guestId?: string, userName?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<LiveClassSocketState>({
    isConnected: false,
    participants: [],
    messages: [],
  });

  useEffect(() => {
    if (!classId) return;

    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3003'}/live-class`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[LiveClassSocket] Connected:', socket.id);
      setState(prev => ({ ...prev, isConnected: true }));

      socket.emit('live-class:join', {
        classId,
        userId: userId || null,
        guestId: guestId || null,
        name: userName || 'User',
      });
    });

    socket.on('live-class:user-joined', (data) => {
      setState(prev => ({
        ...prev,
        participants: [...prev.participants, data],
      }));
    });

    socket.on('live-class:user-left', (data) => {
      setState(prev => ({
        ...prev,
        participants: prev.participants.filter((p: any) => p.userId !== data.userId),
      }));
    });

    socket.on('live-class:chat-message', (data) => {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, data],
      }));
    });

    socket.on('live-class:participant-update', (data) => {
      setState(prev => ({ ...prev, participants: data.participants }));
    });

    socket.on('disconnect', () => {
      setState(prev => ({ ...prev, isConnected: false }));
    });

    return () => {
      socket.emit('live-class:leave', { classId, userId, guestId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [classId, userId, guestId]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, callback);
    return () => {
      socket.off(event, callback);
    };
  }, []);

  const getSocket = useCallback(() => socketRef.current, []);

  return {
    ...state,
    emit,
    on,
    getSocket,
  };
}
