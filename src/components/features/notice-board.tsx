'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppStore } from '@/store/app-store';
import {
  Megaphone, Pin, AlertTriangle, Clock, Tag, Plus, Search, Eye, PinOff,
  LayoutGrid, List, FileText, Paperclip, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface Notice {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'academic' | 'events' | 'sports' | 'exam' | 'emergency' | 'staff';
  author: string;
  priority: 'normal' | 'important' | 'urgent';
  pinned: boolean;
  attachmentsCount: number;
  createdAt: string;
  schoolId: string;
}

interface NoticeStats {
  total: number;
  pinned: number;
  thisWeek: number;
  categories: number;
}

const categoryConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  general: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: 'General' },
  academic: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', label: 'Academic' },
  events: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Events' },
  sports: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Sports' },
  exam: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', label: 'Exam' },
  emergency: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Emergency' },
  staff: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', label: 'Staff' },
};

const priorityConfig: Record<string, { bg: string; text: string; border: string; label: string; dotClass: string }> = {
  normal: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', label: 'Normal', dotClass: 'bg-gray-400' },
  important: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Important', dotClass: 'bg-amber-500' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Urgent', dotClass: 'bg-red-500 animate-pulse' },
};

export default function NoticeBoard() {
  const { selectedSchoolId } = useAppStore();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [stats, setStats] = useState<NoticeStats>({ total: 0, pinned: 0, thisWeek: 0, categories: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

  // New notice form
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    category: 'general' as Notice['category'],
    priority: 'normal' as Notice['priority'],
    author: '',
  });

  useEffect(() => {
    fetchNotices();
  }, [categoryFilter, searchQuery]);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/notices?${params.toString()}`);
      const json = await res.json();
      if (json.data) setNotices(json.data);
      if (json.stats) setStats(json.stats);
    } catch {
      toast.error('Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  const handlePostNotice = async () => {
    if (!newNotice.title.trim() || !newNotice.content.trim()) {
      toast.error('Please fill in the title and content');
      return;
    }
    if (!selectedSchoolId) {
      toast.error('No school selected');
      return;
    }
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newNotice,
          schoolId: selectedSchoolId,
          pinned: false,
          attachmentsCount: 0,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Notice posted successfully');
        setShowAddDialog(false);
        setNewNotice({ title: '', content: '', category: 'general', priority: 'normal', author: '' });
        fetchNotices();
      } else {
        toast.error(json.error || 'Failed to post notice');
      }
    } catch {
      toast.error('Failed to post notice');
    }
  };

  const togglePin = (id: string) => {
    setNotices(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    const notice = notices.find(n => n.id === id);
    toast.success(notice?.pinned ? 'Notice unpinned' : 'Notice pinned');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const pinnedNotices = useMemo(() => notices.filter(n => n.pinned), [notices]);
  const regularNotices = useMemo(() => notices.filter(n => !n.pinned), [notices]);

  const renderPriorityDot = (priority: string) => {
    const config = priorityConfig[priority];
    return (
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
        <span className="text-xs text-gray-500">{config.label}</span>
      </span>
    );
  };

  const renderNoticeCard = (notice: Notice) => {
    const cat = categoryConfig[notice.category];
    const pri = priorityConfig[notice.priority];
    const isExpanded = expandedNotice === notice.id;
    const isUrgent = notice.priority === 'urgent';

    return (
      <Card
        key={notice.id}
        className={`relative overflow-hidden transition-all hover:shadow-md ${isExpanded ? 'ring-2 ring-emerald-500' : ''} ${isUrgent ? 'border-red-200' : notice.pinned ? 'border-amber-200 bg-amber-50/30' : ''}`}
      >
        {isUrgent && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-red-400 to-red-500 animate-pulse" />
        )}
        {notice.pinned && !isUrgent && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
        )}
        <CardContent className="pt-5 pb-4 px-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${cat.bg} ${cat.text} text-[10px] border ${cat.border} font-medium`}>
                {cat.label}
              </Badge>
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${pri.dotClass}`} />
                <span className="text-[10px] text-gray-400">{pri.label}</span>
              </span>
              {notice.pinned && (
                <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
              )}
            </div>
            <button
              onClick={() => togglePin(notice.id)}
              className="text-gray-400 hover:text-amber-500 transition-colors p-1"
              title={notice.pinned ? 'Unpin' : 'Pin'}
            >
              {notice.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Title */}
          <h3 className={`font-semibold text-sm mb-1.5 ${isUrgent ? 'text-red-800' : 'text-gray-900'}`}>
            {notice.title}
          </h3>

          {/* Content */}
          <p className={`text-xs text-gray-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
            {notice.content}
          </p>

          {/* Meta */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(notice.createdAt)}
              </span>
              <span>{notice.author}</span>
              {notice.attachmentsCount > 0 && (
                <span className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {notice.attachmentsCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setExpandedNotice(isExpanded ? null : notice.id)}
              className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Less
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" /> Read
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderNoticeListItem = (notice: Notice) => {
    const cat = categoryConfig[notice.category];
    const isUrgent = notice.priority === 'urgent';

    return (
      <div
        key={notice.id}
        className={`flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer ${isUrgent ? 'border-red-200 bg-red-50/30' : notice.pinned ? 'border-amber-200 bg-amber-50/20' : ''}`}
        onClick={() => setExpandedNotice(expandedNotice === notice.id ? null : notice.id)}
      >
        <div className="mt-1">
          {notice.pinned ? (
            <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge className={`${cat.bg} ${cat.text} text-[10px] border ${cat.border}`}>
              {cat.label}
            </Badge>
            <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig[notice.priority].dotClass}`} />
            {notice.attachmentsCount > 0 && (
              <Paperclip className="h-3 w-3 text-gray-400" />
            )}
          </div>
          <h4 className={`font-medium text-sm truncate ${isUrgent ? 'text-red-800' : 'text-gray-900'}`}>
            {notice.title}
          </h4>
          {expandedNotice === notice.id && (
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{notice.content}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
            <span>{formatDate(notice.createdAt)}</span>
            <span>{notice.author}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); togglePin(notice.id); }}
          className="text-gray-400 hover:text-amber-500 transition-colors p-1"
        >
          {notice.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Megaphone className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Notice Board</h2>
            <p className="text-sm text-gray-500">School announcements and updates</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Post Notice
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Megaphone className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Notices</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Pin className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pinned}</p>
              <p className="text-xs text-gray-500">Pinned</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Clock className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.thisWeek}</p>
              <p className="text-xs text-gray-500">This Week</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Tag className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.categories}</p>
              <p className="text-xs text-gray-500">Categories</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search notices..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40 h-9 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryConfig).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex rounded-md border overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none h-9 px-3"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none h-9 px-3"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pinned Notices Section */}
      {pinnedNotices.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pin className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-700">Pinned Notices</h3>
            <Badge variant="secondary" className="text-xs">{pinnedNotices.length}</Badge>
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pinnedNotices.map(renderNoticeCard)}
            </div>
          ) : (
            <div className="space-y-2">
              {pinnedNotices.map(renderNoticeListItem)}
            </div>
          )}
          <Separator className="my-6" />
        </div>
      )}

      {/* All Notices */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">All Notices</h3>
          <Badge variant="secondary" className="text-xs">{regularNotices.length}</Badge>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : regularNotices.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Megaphone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-sm font-medium text-gray-500">No notices found</h4>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regularNotices.map(renderNoticeCard)}
          </div>
        ) : (
          <div className="space-y-2">
            {regularNotices.map(renderNoticeListItem)}
          </div>
        )}
      </div>

      {/* Post Notice Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-emerald-600" />
              Post New Notice
            </DialogTitle>
            <DialogDescription>Create a new notice for the school community</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title *</label>
              <Input
                value={newNotice.title}
                onChange={(e) => setNewNotice(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Notice title..."
                className="h-10"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Content *</label>
              <Textarea
                value={newNotice.content}
                onChange={(e) => setNewNotice(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your notice content here..."
                rows={5}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category</label>
                <Select value={newNotice.category} onValueChange={(v) => setNewNotice(prev => ({ ...prev, category: v as Notice['category'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Priority</label>
                <Select value={newNotice.priority} onValueChange={(v) => setNewNotice(prev => ({ ...prev, priority: v as Notice['priority'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${val.dotClass}`} />
                          {val.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Author</label>
              <Input
                value={newNotice.author}
                onChange={(e) => setNewNotice(prev => ({ ...prev, author: e.target.value }))}
                placeholder="Your name or department..."
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handlePostNotice} className="gap-2">
              <Megaphone className="h-4 w-4" /> Post Notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
