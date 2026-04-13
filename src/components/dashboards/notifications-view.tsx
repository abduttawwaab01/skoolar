'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Bell, CheckCheck, Trash2, Check, AlertTriangle, XCircle, Info, CircleCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  schoolId: string | null;
  userId: string | null;
  title: string;
  message: string;
  type: string;
  category: string;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  createdAt: string;
}

const typeFilters = ['All', 'Success', 'Warning', 'Error', 'Info'] as const;

const typeConfig: Record<string, { color: string; icon: React.ElementType }> = {
  success: { color: 'border-l-emerald-500', icon: CircleCheck },
  info: { color: 'border-l-sky-500', icon: Info },
  warning: { color: 'border-l-amber-500', icon: AlertTriangle },
  error: { color: 'border-l-red-500', icon: XCircle },
};

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export function NotificationsView() {
  const { selectedSchoolId, currentUser, currentRole } = useAppStore();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifs = async () => {
      const typeParam = activeFilter !== 'All' ? `&type=${activeFilter.toLowerCase()}` : '';
      const schoolIdParam = currentRole === 'SUPER_ADMIN' ? '' : (selectedSchoolId ? `&schoolId=${selectedSchoolId}` : '');
      try {
        const res = await fetch(`/api/notifications?limit=100${typeParam}${schoolIdParam}`);
        const json = await res.json();
        const notifData = json.data || json || [];
        setNotifs(Array.isArray(notifData) ? notifData : []);
      } catch {
        toast.error('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchNotifs();
  }, [selectedSchoolId, activeFilter, currentRole]);

  const filteredNotifs = React.useMemo(() => {
    if (activeFilter === 'All') return notifs;
    return notifs.filter(n => n.type.toLowerCase() === activeFilter.toLowerCase());
  }, [notifs, activeFilter]);

  const unreadCount = notifs.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  };

  const deleteNotif = (id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    fetch(`/api/notifications?ids=${id}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  const markAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    if (currentUser.id) {
      fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true, userId: currentUser.id }),
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-16 rounded-full" />)}
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="size-10 opacity-40 mb-3" />
        <p className="text-sm">Please select a school to view notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bell className="size-5" />
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={markAllRead}>
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {typeFilters.map(filter => (
          <Button
            key={filter}
            variant={activeFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </Button>
        ))}
      </div>

      {/* Notification Cards */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredNotifs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Check className="size-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">All caught up! No notifications to show.</p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifs.map(notif => {
            const config = typeConfig[notif.type] || typeConfig.info;
            const Icon = config.icon;
            return (
              <Card
                key={notif.id}
                className={cn(
                  'border-l-4 transition-all',
                  config.color,
                  notif.isRead && 'opacity-60'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {!notif.isRead && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => markAsRead(notif.id)}>
                            <Check className="size-3" />Mark read
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-red-600 hover:text-red-700" onClick={() => deleteNotif(notif.id)}>
                          <Trash2 className="size-3" />Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
