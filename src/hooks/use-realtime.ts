'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useRealtimeContext } from '@/components/shared/realtime-provider';

/**
 * Custom hook for WebSocket real-time communication via the Skoolar gateway.
 * Uses the shared RealtimeProvider connection if available, otherwise creates its own.
 *
 * Connection URL: io('/?XTransformPort=3003') — Caddy routes this to port 3003.
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

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    } as any);

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Realtime] Connected:', socket.id);
      setState({ isConnected: true, isReconnecting: false });
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

    socket.on('reconnect', (attemptNumber) => {
      console.log('[Realtime] Reconnected after', attemptNumber, 'attempts');
      setState({ isConnected: true, isReconnecting: false });
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

  const sendNotification = useCallback(
    (data: {
      schoolId: string;
      title: string;
      message: string;
      type?: string;
      category?: string;
    }) => {
      if (fallbackHooks) {
        socketRef.current?.emit('send-notification', data);
      }
    },
    [fallbackHooks],
  );

  const markAttendance = useCallback(
    (data: { schoolId: string; classId: string; studentId: string; status: string; date?: string }) => {
      if (fallbackHooks) {
        socketRef.current?.emit('attendance-marked', data);
      }
    },
    [fallbackHooks],
  );

  const publishExam = useCallback(
    (data: { schoolId: string; classId: string; subjectId: string; examName: string }) => {
      if (fallbackHooks) {
        socketRef.current?.emit('exam-published', data);
      }
    },
    [fallbackHooks],
  );

  const updateGrade = useCallback(
    (data: { schoolId: string; classId: string; studentId: string; subject: string; score: number }) => {
      if (fallbackHooks) {
        socketRef.current?.emit('grade-updated', data);
      }
    },
    [fallbackHooks],
  );

  const receivePayment = useCallback(
    (data: { schoolId: string; studentId: string; amount: number; currency?: string }) => {
      if (fallbackHooks) {
        socketRef.current?.emit('payment-received', data);
      }
    },
    [fallbackHooks],
  );

  const postAnnouncement = useCallback(
    (data: { schoolId: string; title: string; type?: string; priority?: string }) => {
      if (fallbackHooks) {
        socketRef.current?.emit('announcement-posted', data);
      }
    },
    [fallbackHooks],
  );

  const sendChatMessage = useCallback(
    (data: { schoolId: string; toUserId: string; fromUserId: string; message: string }) => {
      if (fallbackHooks) {
        socketRef.current?.emit('chat-message', data);
      } else {
        context.sendChatMessage(data);
      }
    },
    [context, fallbackHooks],
  );

  const sendTypingIndicator = useCallback(
    (data: { schoolId: string; toUserId: string; fromUserId: string }) => {
      if (fallbackHooks) {
        socketRef.current?.emit('typing', data);
      } else {
        context.sendTypingIndicator(data);
      }
    },
    [context, fallbackHooks],
  );

  const emit = useCallback((event: string, data: unknown) => {
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
