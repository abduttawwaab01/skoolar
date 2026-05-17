'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Bell, CheckCheck, Trash2, Check, AlertTriangle, XCircle, Info, CircleCheck,
  Calendar, Clock, ChevronRight, ExternalLink, Filter
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
  user?: { id: string; name: string } | null;
}

const typeFilters = ['All', 'Success', 'Warning', 'Error', 'Info'] as const;

const typeConfig: Record<string, { color: string; icon: React.ElementType; bg: string }> = {
  success: { color: 'border-l-emerald-500', icon: CircleCheck, bg: 'bg-emerald-50' },
  info: { color: 'border-l-sky-500', icon: Info, bg: 'bg-sky-50' },
  warning: { color: 'border-l-amber-500', icon: AlertTriangle, bg: 'bg-amber-50' },
  error: { color: 'border-l-red-500', icon: XCircle, bg: 'bg-red-50' },
};

const categoryConfig: Record<string, { label: string; emoji: string }> = {
  attendance: { label: 'Attendance', emoji: '📋' },
  report_card: { label: 'Report Card', emoji: '📄' },
  payment: { label: 'Payment', emoji: '💳' },
  exam: { label: 'Exam', emoji: '📝' },
  admission: { label: 'Admission', emoji: '🎓' },
  announcement: { label: 'Announcement', emoji: '📢' },
  task: { label: 'Task', emoji: '✅' },
  evaluation: { label: 'Evaluation', emoji: '⭐' },
  job: { label: 'Job', emoji: '💼' },
  general: { label: 'General', emoji: '📌' },
};

function formatTimeAgo(dateStr: string, now?: Date): string {
  const d = now || new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((d.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDateGroup(dateStr: string, now?: Date): string {
  const d = now || new Date();
  const date = new Date(dateStr);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - today.getDay());

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekStart) return 'This Week';
  return 'Earlier';
}

export function NotificationsView() {
  const { selectedSchoolId, currentUser, currentRole } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifs = async (pageNum: number, append = false) => {
    const typeParam = activeFilter !== 'All' ? `&type=${activeFilter.toLowerCase()}` : '';
    const schoolIdParam = currentRole === 'SUPER_ADMIN' ? '' : (selectedSchoolId ? `&schoolId=${selectedSchoolId}` : '');
    const userIdParam = currentUser.id ? `&userId=${currentUser.id}` : '';
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      const res = await fetch(`/api/notifications?limit=50&page=${pageNum}${typeParam}${schoolIdParam}${userIdParam}`);
      const json = await res.json();
      const notifData = json.data || [];
      if (append) {
        setNotifs(prev => [...prev, ...(Array.isArray(notifData) ? notifData : [])]);
      } else {
        setNotifs(Array.isArray(notifData) ? notifData : []);
      }
      setHasMore(pageNum < (json.totalPages || 1));
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setPage(1);
    fetchNotifs(1);
  }, [selectedSchoolId, activeFilter, currentRole, currentUser.id]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifs(nextPage, true);
  };

  const filteredNotifs = useMemo(() => {
    if (activeFilter === 'All') return notifs;
    return notifs.filter(n => n.type.toLowerCase() === activeFilter.toLowerCase());
  }, [notifs, activeFilter]);

  const now = mounted ? new Date() : undefined;
  const groupedNotifs = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    for (const n of filteredNotifs) {
      const group = getDateGroup(n.createdAt, now);
      if (!groups[group]) groups[group] = [];
      groups[group].push(n);
    }
    return groups;
  }, [filteredNotifs, now]);

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];

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
    fetch(`/api/notifications?ids=${id}`, { method: 'DELETE' }).catch(() => {});
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
        <div className="flex justify-between"><Skeleton className="h-12 w-48" /><Skeleton className="h-10 w-32" /></div>
        <div className="flex gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-16 rounded-full" />)}</div>
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Bell className="size-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? (
                <span className="font-medium text-emerald-600">{unreadCount} unread</span>
              ) : 'All caught up!'}
              {' · '}{notifs.length} total
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={markAllRead}>
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {typeFilters.map(filter => (
          <Button
            key={filter}
            variant={activeFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(filter)}
            className={cn(activeFilter === filter && 'bg-emerald-600 hover:bg-emerald-700')}
          >
            {filter === 'All' && <Filter className="size-3 mr-1" />}
            {filter === 'Success' && <CircleCheck className="size-3 mr-1" />}
            {filter === 'Warning' && <AlertTriangle className="size-3 mr-1" />}
            {filter === 'Error' && <XCircle className="size-3 mr-1" />}
            {filter === 'Info' && <Info className="size-3 mr-1" />}
            {filter}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {Object.keys(groupedNotifs).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="size-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
                <Check className="size-8 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-gray-900">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No notifications to show.</p>
            </CardContent>
          </Card>
        ) : (
          groupOrder.filter(g => groupedNotifs[g]).map(group => (
            <div key={group}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Calendar className="size-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group}</h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground">{groupedNotifs[group].length}</span>
              </div>
              <div className="space-y-1.5">
                {groupedNotifs[group].map(notif => {
                  const config = typeConfig[notif.type] || typeConfig.info;
                  const Icon = config.icon;
                  const catConfig = categoryConfig[notif.category] || { label: notif.category, emoji: '📌' };
                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        'group relative border-l-4 rounded-lg transition-all',
                        config.color,
                        notif.isRead ? 'bg-card' : config.bg,
                        notif.actionUrl && 'cursor-pointer hover:shadow-sm'
                      )}
                      onClick={() => {
                        if (notif.actionUrl) {
                          if (!notif.isRead) markAsRead(notif.id);
                          window.location.href = notif.actionUrl;
                        }
                      }}
                    >
                      <div className="p-3.5">
                        <div className="flex gap-3">
                          <div className={cn(
                            'size-9 shrink-0 rounded-xl flex items-center justify-center mt-0.5',
                            config.bg
                          )}>
                            <Icon className={cn(
                              'size-4',
                              notif.type === 'success' && 'text-emerald-600',
                              notif.type === 'warning' && 'text-amber-600',
                              notif.type === 'error' && 'text-red-600',
                              notif.type === 'info' && 'text-sky-600',
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={cn('text-sm', notif.isRead ? 'text-muted-foreground' : 'font-semibold text-foreground')}>
                                    {notif.title}
                                  </p>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                    {catConfig.emoji} {catConfig.label}
                                  </Badge>
                                </div>
                                <p className={cn(
                                  'text-xs mt-0.5 leading-relaxed',
                                  notif.isRead ? 'text-muted-foreground/70' : 'text-muted-foreground'
                                )}>
                                  {notif.message}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {!notif.isRead && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-0.5">
                                  <Clock className="size-3" />
                                  {formatTimeAgo(notif.createdAt, mounted ? new Date() : undefined)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notif.isRead && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2" onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}>
                                  <Check className="size-3" />Read
                                </Button>
                              )}
                              {notif.actionUrl && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 text-emerald-600" onClick={(e) => { e.stopPropagation(); window.open(notif.actionUrl!, '_blank'); }}>
                                  <ExternalLink className="size-3" />View
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 text-red-600 hover:text-red-700" onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}>
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
