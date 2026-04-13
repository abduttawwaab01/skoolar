'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { io } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────

export interface RealtimeNotification {
  id: string;
  type:
    | 'notification'
    | 'attendance-update'
    | 'exam-published'
    | 'grade-update'
    | 'payment-update'
    | 'announcement'
    | 'chat-message'
    | 'typing'
    | 'user-online'
    | 'user-offline';
  title?: string;
  message?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface RealtimeContextType {
  isConnected: boolean;
  isReconnecting: boolean;
  notifications: RealtimeNotification[];
  unreadCount: number;
  clearNotifications: () => void;
  markAllRead: () => void;
  /** Join a school room */
  joinSchool: (schoolId: string) => void;
  /** Leave a school room */
  leaveSchool: (schoolId: string) => void;
  /** Join a class room */
  joinClass: (schoolId: string, classId: string) => void;
  /** Leave a class room */
  leaveClass: (schoolId: string, classId: string) => void;
  /** Generic emit */
  emit: (event: string, data: unknown) => void;
  /** Generic listener */
  on: (event: string, callback: (...args: unknown[]) => void) => () => void;
  /** Presence */
  setUserOnline: (schoolId: string, userId: string, userName: string) => void;
  /** Send chat */
  sendChatMessage: (data: { schoolId: string; toUserId: string; fromUserId: string; message: string }) => void;
  /** Typing indicator */
  sendTypingIndicator: (data: { schoolId: string; toUserId: string; fromUserId: string }) => void;
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────────

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { currentUser, selectedSchoolId } = useAppStore();

  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const previousSchoolRef = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Stable ref for addNotification so the effect can use it without being in deps
  const addNotificationRef = useRef((notif: RealtimeNotification) => {
    setNotifications((prev) => [notif, ...prev].slice(0, 100));
    setUnreadCount((prev) => prev + 1);
  });

  // ─── Initialize connection ─────────────────────────────────────

  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      // @ts-expect-error - transports option exists in socket.io-client
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[RealtimeProvider] Connected:', socket.id);
      setIsConnected(true);
      setIsReconnecting(false);

      // If user is authenticated, re-join their school and declare online
      if (session?.user && selectedSchoolId) {
        socket.emit('join-school', { schoolId: selectedSchoolId });
        socket.emit('user-online', {
          schoolId: selectedSchoolId,
          userId: session.user.id,
          userName: session.user.name || 'User',
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[RealtimeProvider] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[RealtimeProvider] Connection error:', error.message);
    });

    socket.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });

    socket.on('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
    });

    socket.on('reconnect_failed', () => {
      setIsReconnecting(false);
    });

    // ─── Event listeners ─────────────────────────────────────────

    // General notifications
    socket.on('notification', (payload: Record<string, unknown>) => {
      const notif: RealtimeNotification = {
        id: payload.id as string,
        type: 'notification',
        title: payload.title as string,
        message: payload.message as string,
        data: payload,
        timestamp: payload.timestamp as string,
      };
      addNotificationRef.current(notif);
    });

    // Attendance updates
    socket.on('attendance-update', (payload: Record<string, unknown>) => {
      const notif: RealtimeNotification = {
        id: `att-${Date.now()}`,
        type: 'attendance-update',
        title: 'Attendance Updated',
        message: `${payload.studentId} marked as ${payload.status}`,
        data: payload,
        timestamp: payload.timestamp as string,
      };
      addNotificationRef.current(notif);
    });

    // Exam published
    socket.on('exam-published', (payload: Record<string, unknown>) => {
      const notif: RealtimeNotification = {
        id: `exam-${Date.now()}`,
        type: 'exam-published',
        title: 'New Exam Published',
        message: `${payload.examName} has been published`,
        data: payload,
        timestamp: payload.timestamp as string,
      };
      addNotificationRef.current(notif);
      toast.info(`📝 ${payload.examName}`, {
        description: 'A new exam has been published.',
      });
    });

    // Grade updated
    socket.on('grade-update', (payload: Record<string, unknown>) => {
      const notif: RealtimeNotification = {
        id: `grade-${Date.now()}`,
        type: 'grade-update',
        title: 'Grade Updated',
        message: `${payload.subject}: ${payload.score}`,
        data: payload,
        timestamp: payload.timestamp as string,
      };
      addNotificationRef.current(notif);
      toast.success(`📊 Grade Updated`, {
        description: `${payload.subject}: ${payload.score}%`,
      });
    });

    // Payment update
    socket.on('payment-update', (payload: Record<string, unknown>) => {
      const notif: RealtimeNotification = {
        id: `pay-${Date.now()}`,
        type: 'payment-update',
        title: 'Payment Received',
        message: `${payload.currency || 'NGN'} ${(payload.amount as number)?.toLocaleString()} received`,
        data: payload,
        timestamp: payload.timestamp as string,
      };
      addNotificationRef.current(notif);
      toast.success(`💰 Payment Received`, {
        description: `${payload.currency || 'NGN'} ${(payload.amount as number)?.toLocaleString()}`,
      });
    });

    // Announcement
    socket.on('announcement', (payload: Record<string, unknown>) => {
      const notif: RealtimeNotification = {
        id: payload.id as string,
        type: 'announcement',
        title: payload.title as string,
        message: `New ${payload.type || 'announcement'}`,
        data: payload,
        timestamp: payload.timestamp as string,
      };
      addNotificationRef.current(notif);
      toast.info(`📢 ${payload.title}`, {
        description: `New ${payload.priority === 'urgent' ? 'urgent ' : ''}${payload.type || 'announcement'}`,
      });
    });

    // Chat message (toast only, no notification accumulation)
    socket.on('chat-message', (payload: Record<string, unknown>) => {
      const fromSelf = payload.fromUserId === session?.user?.id;
      if (!fromSelf) {
        toast(`💬 New Message`, {
          description: `${payload.message}` as string,
          duration: 4000,
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session, selectedSchoolId]);

  // ─── Auto-join school room when school changes ─────────────────

  useEffect(() => {
    const schoolId = selectedSchoolId || currentUser?.schoolId;
    if (!socketRef.current || !schoolId) return;

    // Skip if same school already joined
    if (previousSchoolRef.current === schoolId) return;

    // Leave previous school
    if (previousSchoolRef.current) {
      socketRef.current.emit('leave-school', { schoolId: previousSchoolRef.current });
    }

    // Join new school
    socketRef.current.emit('join-school', { schoolId });

    // Declare user online in new school
    if (session?.user) {
      socketRef.current.emit('user-online', {
        schoolId,
        userId: session.user.id,
        userName: session.user.name || 'User',
      });
    }

    previousSchoolRef.current = schoolId;
  }, [selectedSchoolId, currentUser?.schoolId, session?.user]);

  // ─── Helpers ─────────────────────────────────────────────────────

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // ─── Action helpers ──────────────────────────────────────────────

  const joinSchool = useCallback((schoolId: string) => {
    socketRef.current?.emit('join-school', { schoolId });
  }, []);

  const leaveSchool = useCallback((schoolId: string) => {
    socketRef.current?.emit('leave-school', { schoolId });
  }, []);

  const joinClass = useCallback((schoolId: string, classId: string) => {
    socketRef.current?.emit('join-class', { schoolId, classId });
  }, []);

  const leaveClass = useCallback((schoolId: string, classId: string) => {
    socketRef.current?.emit('leave-class', { schoolId, classId });
  }, []);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback(
    (event: string, callback: (...args: unknown[]) => void) => {
      const handler = (...args: unknown[]) => callback(...args);
      socketRef.current?.on(event, handler);
      return () => {
        socketRef.current?.off(event, handler);
      };
    },
    [],
  );

  const setUserOnline = useCallback(
    (schoolId: string, userId: string, userName: string) => {
      socketRef.current?.emit('user-online', { schoolId, userId, userName });
    },
    [],
  );

  const sendChatMessage = useCallback(
    (data: { schoolId: string; toUserId: string; fromUserId: string; message: string }) => {
      socketRef.current?.emit('chat-message', data);
    },
    [],
  );

  const sendTypingIndicator = useCallback(
    (data: { schoolId: string; toUserId: string; fromUserId: string }) => {
      socketRef.current?.emit('typing', data);
    },
    [],
  );

  // ─── Context value ──────────────────────────────────────────────

  const value: RealtimeContextType = {
    isConnected,
    isReconnecting,
    notifications,
    unreadCount,
    clearNotifications,
    markAllRead,
    joinSchool,
    leaveSchool,
    joinClass,
    leaveClass,
    emit,
    on,
    setUserOnline,
    sendChatMessage,
    sendTypingIndicator,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

// ─── Consumer hook ──────────────────────────────────────────────────

export function useRealtimeContext(): RealtimeContextType {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within a RealtimeProvider');
  }
  return context;
}
