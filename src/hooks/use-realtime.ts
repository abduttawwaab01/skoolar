'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useRealtimeContext } from '@/components/shared/realtime-provider';
import { enqueueSocketEvent, flushSocketQueue, getQueuedSocketCount } from '@/lib/offline/socket-queue';

/**
 * Custom hook for WebSocket real-time communication via the Skoolar gateway.
 * Uses the shared RealtimeProvider connection if available, otherwise creates its own.
 *
 * Connection URL: uses NEXT_PUBLIC_SOCKET_URL env var, or '/' (same origin) for Render.
 */

export interface RealtimeState {
  isConnected: boolean;
  isReconnecting: boolean;
}

export function useRealtime() {
  const context = useRealtimeContext();
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isReconnecting: false,
  });

  const fallbackHooks = context === null;

  useEffect(() => {
    if (!fallbackHooks) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '/';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', async () => {
      console.log('[Realtime] Connected:', socket.id);
      setState({ isConnected: true, isReconnecting: false });
      // Flush queued offline socket events
      try {
        const flushed = await flushSocketQueue(socket);
        if (flushed > 0) console.log(`[Realtime] Flushed ${flushed} queued events`);
      } catch { /* ignore */ }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Realtime] Disconnected:', reason);
      setState((prev) => ({ ...prev, isConnected: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('[Realtime] Connection error:', error.message);
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log('[Realtime] Reconnection attempt:', attempt);
      setState((prev) => ({ ...prev, isReconnecting: true }));
    });

    socket.on('reconnect', async (attemptNumber) => {
      console.log('[Realtime] Reconnected after', attemptNumber, 'attempts');
      setState({ isConnected: true, isReconnecting: false });
      // Flush queued offline socket events on reconnect
      try {
        const flushed = await flushSocketQueue(socket);
        if (flushed > 0) console.log(`[Realtime] Flushed ${flushed} queued events`);
      } catch { /* ignore */ }
    });

    socket.on('reconnect_failed', () => {
      console.error('[Realtime] Reconnection failed');
      setState({ isConnected: false, isReconnecting: false });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fallbackHooks]);

  const joinSchool = useCallback((schoolId: string) => {
    if (fallbackHooks) {
      socketRef.current?.emit('join-school', { schoolId });
    } else {
      context.joinSchool(schoolId);
    }
  }, [context, fallbackHooks]);

  const leaveSchool = useCallback((schoolId: string) => {
    if (fallbackHooks) {
      socketRef.current?.emit('leave-school', { schoolId });
    } else {
      context.leaveSchool(schoolId);
    }
  }, [context, fallbackHooks]);

  const joinClass = useCallback((schoolId: string, classId: string) => {
    if (fallbackHooks) {
      socketRef.current?.emit('join-class', { schoolId, classId });
    } else {
      context.joinClass(schoolId, classId);
    }
  }, [context, fallbackHooks]);

  const leaveClass = useCallback((schoolId: string, classId: string) => {
    if (fallbackHooks) {
      socketRef.current?.emit('leave-class', { schoolId, classId });
    } else {
      context.leaveClass(schoolId, classId);
    }
  }, [context, fallbackHooks]);

  const setUserOnline = useCallback(
    (schoolId: string, userId: string, userName: string) => {
      if (fallbackHooks) {
        socketRef.current?.emit('user-online', { schoolId, userId, userName });
      } else {
        context.setUserOnline(schoolId, userId, userName);
      }
    },
    [context, fallbackHooks],
  );

  const setUserOffline = useCallback(() => {
    if (fallbackHooks) {
      socketRef.current?.emit('user-offline');
    }
  }, [fallbackHooks]);

  const isOfflineFn = useCallback(() => typeof navigator !== 'undefined' && !navigator.onLine, []);

  const queueOrEmit = useCallback(async (event: string, data: unknown) => {
    if (isOfflineFn()) {
      await enqueueSocketEvent(event, data);
    } else if (fallbackHooks) {
      socketRef.current?.emit(event, data);
    }
  }, [fallbackHooks, isOfflineFn]);

  const sendNotification = useCallback(
    (data: {
      schoolId: string;
      title: string;
      message: string;
      type?: string;
      category?: string;
    }) => {
      queueOrEmit('send-notification', data);
    },
    [queueOrEmit],
  );

  const markAttendance = useCallback(
    (data: { schoolId: string; classId: string; studentId: string; status: string; date?: string }) => {
      queueOrEmit('attendance-marked', data);
    },
    [queueOrEmit],
  );

  const publishExam = useCallback(
    (data: { schoolId: string; classId: string; subjectId: string; examName: string }) => {
      queueOrEmit('exam-published', data);
    },
    [queueOrEmit],
  );

  const updateGrade = useCallback(
    (data: { schoolId: string; classId: string; studentId: string; subject: string; score: number }) => {
      queueOrEmit('grade-updated', data);
    },
    [queueOrEmit],
  );

  const receivePayment = useCallback(
    (data: { schoolId: string; studentId: string; amount: number; currency?: string }) => {
      queueOrEmit('payment-received', data);
    },
    [queueOrEmit],
  );

  const postAnnouncement = useCallback(
    (data: { schoolId: string; title: string; type?: string; priority?: string }) => {
      queueOrEmit('announcement-posted', data);
    },
    [queueOrEmit],
  );

  const sendChatMessage = useCallback(
    async (data: { schoolId: string; toUserId: string; fromUserId: string; message: string }) => {
      if (isOfflineFn()) {
        await enqueueSocketEvent('chat-message', data);
      } else if (fallbackHooks) {
        socketRef.current?.emit('chat-message', data);
      } else {
        context.sendChatMessage(data);
      }
    },
    [context, fallbackHooks, isOfflineFn],
  );

  const sendTypingIndicator = useCallback(
    async (data: { schoolId: string; toUserId: string; fromUserId: string }) => {
      if (isOfflineFn()) {
        await enqueueSocketEvent('typing', data);
      } else if (fallbackHooks) {
        socketRef.current?.emit('typing', data);
      } else {
        context.sendTypingIndicator(data);
      }
    },
    [context, fallbackHooks, isOfflineFn],
  );

  const emit = useCallback(async (event: string, data: unknown) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      await enqueueSocketEvent(event, data);
      return;
    }
    if (fallbackHooks) {
      socketRef.current?.emit(event, data);
    } else {
      context.emit(event, data);
    }
  }, [context, fallbackHooks]);

  const on = useCallback(
    (event: string, callback: (...args: unknown[]) => void) => {
      if (fallbackHooks) {
        const handler = (...args: unknown[]) => callback(...args);
        socketRef.current?.on(event, handler);
        return () => {
          socketRef.current?.off(event, handler);
        };
      } else {
        return context.on(event, callback);
      }
    },
    [context, fallbackHooks],
  );

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (fallbackHooks) {
      if (callback) {
        socketRef.current?.off(event, callback);
      } else {
        socketRef.current?.removeAllListeners(event);
      }
    }
  }, [fallbackHooks]);

  if (context) {
    return {
      isConnected: context.isConnected,
      isReconnecting: context.isReconnecting,
      joinSchool: context.joinSchool,
      leaveSchool: context.leaveSchool,
      joinClass: context.joinClass,
      leaveClass: context.leaveClass,
      setUserOnline: context.setUserOnline,
      setUserOffline: () => {},
      sendNotification: () => {},
      markAttendance: () => {},
      publishExam: () => {},
      updateGrade: () => {},
      receivePayment: () => {},
      postAnnouncement: () => {},
      sendChatMessage: context.sendChatMessage,
      sendTypingIndicator: context.sendTypingIndicator,
      emit: context.emit,
      on: context.on,
      off: () => {},
    };
  }

  return {
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    joinSchool,
    leaveSchool,
    joinClass,
    leaveClass,
    setUserOnline,
    setUserOffline,
    sendNotification,
    markAttendance,
    publishExam,
    updateGrade,
    receivePayment,
    postAnnouncement,
    sendChatMessage,
    sendTypingIndicator,
    emit,
    on,
    off,
  };
}
