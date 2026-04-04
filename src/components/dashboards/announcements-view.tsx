'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Plus, Megaphone, EyeOff, Eye, Search, X, Pencil, Trash2, Clock,
  Users, Calendar, AlertTriangle, Bell, CheckCircle2, ChevronRight,
  Filter, MoreVertical, Sparkles, Globe, GraduationCap, BookOpen, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// ==================== TYPES ====================
interface Announcement {
  id: string; schoolId: string; title: string; content: string;
  type: string; targetRoles: string | null; targetClasses: string | null;
  priority: string; isPublished: boolean; publishedAt: string | null;
  expiresAt: string | null; createdBy: string | null;
  createdAt: string; updatedAt: string;
}

interface AnnTemplate {
  id: string; title: string; content: string; type: string; priority: string;
}

// ==================== CONSTANTS ====================
const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; pulse?: boolean }> = {
  normal: { color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200', label: 'Normal' },
  important: { color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200', label: 'Important' },
  urgent: { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200', label: 'Urgent', pulse: true },
};

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  general: { icon: <Bell className="h-3.5 w-3.5" />, color: 'bg-blue-100 text-blue-700' },
  event: { icon: <Calendar className="h-3.5 w-3.5" />, color: 'bg-purple-100 text-purple-700' },
  urgent: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'bg-red-100 text-red-700' },
  academic: { icon: <BookOpen className="h-3.5 w-3.5" />, color: 'bg-emerald-100 text-emerald-700' },
  exam: { icon: <FileText className="h-3.5 w-3.5" />, color: 'bg-amber-100 text-amber-700' },
  sports: { icon: <Globe className="h-3.5 w-3.5" />, color: 'bg-teal-100 text-teal-700' },
  holiday: { icon: <Calendar className="h-3.5 w-3.5" />, color: 'bg-rose-100 text-rose-700' },
};

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Teachers', STUDENT: 'Students', PARENT: 'Parents',
  SCHOOL_ADMIN: 'Admins', ALL: 'Everyone',
};

const TEMPLATES: AnnTemplate[] = [
  { id: 't1', title: 'School Closing Notice', content: 'Dear parents and students,\n\nPlease be informed that school will be closed on {{date}} due to {{reason}}. Classes will resume on {{resume_date}}.\n\nThank you for your understanding.', type: 'general', priority: 'important' },
  { id: 't2', title: 'Exam Schedule Published', content: 'The examination schedule for the upcoming term has been published. Students are advised to prepare accordingly and check the portal for their individual timetables.\n\nExams begin: {{start_date}}\nEnd: {{end_date}}', type: 'exam', priority: 'important' },
  { id: 't3', title: 'Fee Payment Reminder', content: 'This is a reminder that all outstanding school fees for the current term must be paid by {{deadline}}. Late payments will attract a surcharge.\n\nPlease visit the school accounts office or use the online payment portal.', type: 'urgent', priority: 'urgent' },
  { id: 't4', title: 'Parent-Teacher Conference', content: 'We cordially invite all parents to the upcoming Parent-Teacher Conference.\n\nDate: {{date}}\nTime: {{time}}\nVenue: School Hall\n\nPlease ensure you attend to discuss your child\'s academic progress.', type: 'event', priority: 'normal' },
  { id: 't5', title: 'Sports Day Announcement', content: 'Get ready for our annual Sports Day! All students are encouraged to participate in various sporting activities.\n\nDate: {{date}}\nVenue: School Sports Field\n\nDress code: House colors', type: 'sports', priority: 'normal' },
  { id: 't6', title: 'Holiday Announcement', content: 'The school will observe {{holiday_name}} from {{start_date}} to {{end_date}}. School resumes on {{resume_date}}.\n\nWe wish all our students and staff a wonderful holiday!', type: 'holiday', priority: 'important' },
  { id: 't7', title: 'Report Card Distribution', content: 'Report cards for the {{term}} term are now available for collection. Parents can collect them from the class teachers between {{time}} on {{date}}.\n\nDigital copies are also available on the portal.', type: 'academic', priority: 'normal' },
  { id: 't8', title: 'Emergency Closure', content: 'URGENT: School will be closed today due to {{reason}}. All students and staff are advised to stay home. Further updates will be communicated via SMS and the school portal.\n\nStay safe.', type: 'urgent', priority: 'urgent' },
];

// ==================== HELPERS ====================
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function parseTargetRoles(roles: string | null): string[] {
  if (!roles) return ['ALL'];
  try { return JSON.parse(roles); } catch { return ['ALL']; }
}

function parseTargetClasses(classes: string | null): string[] {
  if (!classes) return [];
  try { return JSON.parse(classes); } catch { return []; }
}

function renderRichContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/\n/g, '<br/>');
}

// ==================== COMPONENT ====================
export function AnnouncementsView() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;
  const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(currentRole);

  // State
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [detailItem, setDetailItem] = useState<Announcement | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('general');
  const [formPriority, setFormPriority] = useState('normal');
  const [formAudience, setFormAudience] = useState('all');
  const [formTargetClasses, setFormTargetClasses] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formSchedule, setFormSchedule] = useState(false);
  const [formScheduleDate, setFormScheduleDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId, limit: '100' });
      if (searchQuery) params.set('search', searchQuery);
      if (filterPriority !== 'all') params.set('priority', filterPriority);
      if (filterType !== 'all') params.set('type', filterType);
      const res = await fetch(`/api/announcements?${params}`);
      const json = await res.json();
      if (json.data) setItems(json.data);
    } catch { toast.error('Failed to load announcements'); }
    finally { setLoading(false); }
  }, [schoolId, searchQuery, filterPriority, filterType]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  // Filter items by status (client-side since API doesn't support it)
  const displayItems = useMemo(() => {
    let filtered = [...items];
    if (filterStatus === 'published') filtered = filtered.filter(a => a.isPublished);
    else if (filterStatus === 'draft') filtered = filtered.filter(a => !a.isPublished);
    else if (filterStatus === 'scheduled') filtered = filtered.filter(a => !a.isPublished && a.publishedAt);
    return filtered;
  }, [items, filterStatus]);

  const publishedCount = items.filter(a => a.isPublished).length;
  const draftCount = items.filter(a => !a.isPublished).length;
  const urgentCount = items.filter(a => a.priority === 'urgent' && a.isPublished).length;
  const expiredCount = items.filter(a => isExpired(a.expiresAt) && a.isPublished).length;

  // Reset form
  const resetForm = () => {
    setFormTitle(''); setFormContent(''); setFormType('general');
    setFormPriority('normal'); setFormAudience('all');
    setFormTargetClasses(''); setFormExpiry('');
    setFormSchedule(false); setFormScheduleDate('');
  };

  // Open edit dialog
  const openEdit = (item: Announcement) => {
    setEditItem(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormType(item.type);
    setFormPriority(item.priority);
    setFormAudience(parseTargetRoles(item.targetRoles)[0] || 'all');
    setFormTargetClasses(parseTargetClasses(item.targetClasses).join(', '));
    setFormExpiry(item.expiresAt ? item.expiresAt.split('T')[0] : '');
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) { toast.error('Title and content are required'); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        schoolId, title: formTitle, content: formContent,
        type: formType, priority: formPriority,
        targetRoles: formAudience === 'all' ? null : JSON.stringify([formAudience]),
        targetClasses: formTargetClasses.trim() ? JSON.stringify(formTargetClasses.split(',').map(c => c.trim()).filter(Boolean)) : null,
        expiresAt: formExpiry || null,
        isPublished: formSchedule ? false : true,
        createdBy: currentUser.id,
      };
      if (formSchedule && formScheduleDate) body.publishedAt = formScheduleDate;

      if (editItem) {
        body.id = editItem.id;
        const res = await fetch('/api/announcements', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.error) toast.error(json.error); else { toast.success('Announcement updated'); resetForm(); setEditItem(null); setAddOpen(false); fetchAnnouncements(); }
      } else {
        const res = await fetch('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.error) toast.error(json.error); else { toast.success('Announcement created'); resetForm(); setAddOpen(false); fetchAnnouncements(); }
      }
    } catch { toast.error('Failed to save'); } finally { setSubmitting(false); }
  };

  // Delete
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      toast.success('Announcement deleted');
      fetchAnnouncements();
      setDetailItem(null);
    } catch { toast.error('Failed to delete'); }
  };

  // Toggle publish
  const togglePublish = async (item: Announcement) => {
    try {
      await fetch('/api/announcements', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isPublished: !item.isPublished }),
      });
      toast.success(item.isPublished ? 'Unpublished' : 'Published');
      fetchAnnouncements();
    } catch { toast.error('Failed to update'); }
  };

  // Apply template
  const applyTemplate = (t: AnnTemplate) => {
    setFormTitle(t.title);
    setFormContent(t.content);
    setFormType(t.type);
    setFormPriority(t.priority);
    toast.success('Template applied');
  };

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-emerald-600" /> Announcements
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} total &middot; {publishedCount} published &middot; {draftCount} drafts
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { resetForm(); setEditItem(null); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-sm">
                <Plus className="size-4" /> Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Megaphone className="size-5 text-emerald-600" />
                  {editItem ? 'Edit Announcement' : 'Create Announcement'}
                </DialogTitle>
                <DialogDescription>{editItem ? 'Update announcement details.' : 'Write a new announcement for the school community.'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                {/* Templates */}
                {!editItem && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Quick Templates</Label>
                    <ScrollArea className="max-h-28">
                      <div className="flex flex-wrap gap-1.5">
                        {TEMPLATES.map(t => (
                          <button
                            key={t.id}
                            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-100 whitespace-nowrap"
                            onClick={() => applyTemplate(t)}
                          >
                            {t.title}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input placeholder="Announcement title" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Content</Label>
                  <Textarea placeholder="Write your announcement here... (supports **bold** and *italic*)" value={formContent} onChange={e => setFormContent(e.target.value)} rows={5} className="resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                        <SelectItem value="sports">Sports</SelectItem>
                        <SelectItem value="holiday">Holiday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select value={formPriority} onValueChange={setFormPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="important">Important</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Target Audience</Label>
                    <Select value={formAudience} onValueChange={setFormAudience}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Everyone</SelectItem>
                        <SelectItem value="TEACHER">Teachers Only</SelectItem>
                        <SelectItem value="STUDENT">Students Only</SelectItem>
                        <SelectItem value="PARENT">Parents Only</SelectItem>
                        <SelectItem value="SCHOOL_ADMIN">Admins Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Target Classes (optional)</Label>
                    <Input placeholder="e.g. JSS 1A, SS 2B" value={formTargetClasses} onChange={e => setFormTargetClasses(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Expiry Date (optional)</Label>
                    <Input type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">Schedule <Switch checked={formSchedule} onCheckedChange={setFormSchedule} className="scale-75" /></Label>
                    {formSchedule && (
                      <Input type="datetime-local" value={formScheduleDate} onChange={e => setFormScheduleDate(e.target.value)} />
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { resetForm(); setEditItem(null); setAddOpen(false); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={submitting || !formTitle.trim() || !formContent.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                  {submitting ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {editItem ? 'Update' : (formSchedule ? 'Schedule' : 'Publish')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div 
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {[
          { label: 'Published', value: publishedCount, icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Drafts', value: draftCount, icon: <FileText className="h-4 w-4" />, color: 'bg-gray-50 text-gray-700 border-gray-200' },
          { label: 'Urgent', value: urgentCount, icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-red-50 text-red-700 border-red-200' },
          { label: 'Expired', value: expiredCount, icon: <Clock className="h-4 w-4" />, color: 'bg-amber-50 text-amber-700 border-amber-200' },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + idx * 0.05 }}
          >
            <Card className="border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border', stat.color)}>{stat.icon}</div>
                <div>
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div 
        className="flex flex-wrap items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search announcements..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
          {searchQuery && <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery('')}><X className="h-3 w-3 text-muted-foreground" /></button>}
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="important">Important</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="academic">Academic</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="exam">Exam</SelectItem>
            <SelectItem value="sports">Sports</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {(['all', 'published', 'draft', 'scheduled'] as const).map(s => (
            <button
              key={s}
              className={cn('px-2.5 py-1 text-xs rounded-md transition-colors capitalize', filterStatus === s ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setFilterStatus(s)}
            >{s}</button>
          ))}
        </div>
        {(filterPriority !== 'all' || filterType !== 'all' || filterStatus !== 'all' || searchQuery) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setFilterPriority('all'); setFilterType('all'); setFilterStatus('all'); setSearchQuery(''); }}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </motion.div>

      {/* Announcement List */}
      <motion.div 
        className="space-y-3 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mx-auto w-28 h-28 mb-5">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl rotate-6 opacity-15" />
              <div className="relative w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-dashed border-emerald-200 rounded-3xl flex items-center justify-center">
                <Megaphone className="h-10 w-10 text-emerald-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No Announcements</h3>
            <p className="text-sm text-gray-500 mb-4">{searchQuery || filterPriority !== 'all' ? 'Try adjusting your filters' : 'Create your first announcement to keep the school community informed'}</p>
            {!searchQuery && <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Create Announcement</Button>}
          </div>
        ) : (
          displayItems.map((item) => {
            const pConfig = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.normal;
            const tConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;
            const targetRoles = parseTargetRoles(item.targetRoles);
            const targetClasses = parseTargetClasses(item.targetClasses);
            const expired = isExpired(item.expiresAt);
            const isDraft = !item.isPublished;

            return (
              <Card key={item.id} className={cn('transition-all hover:shadow-md border', isDraft && 'opacity-70 border-dashed', expired && !isDraft && 'border-amber-200')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailItem(item)}>
                      {/* Badges row */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge className={cn('text-[10px] border capitalize', pConfig.bg, pConfig.color, pConfig.border)}>
                          {pConfig.pulse && <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse" />}
                          {pConfig.label}
                        </Badge>
                        <Badge variant="outline" className={cn('text-[10px] capitalize', tConfig.color)}>
                          {tConfig.icon} {item.type}
                        </Badge>
                        {isDraft && <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
                        {expired && !isDraft && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">Expired</Badge>}
                        {item.isPublished && !expired && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Published</Badge>}
                      </div>

                      {/* Title */}
                      <h3 className={cn('font-semibold text-sm mb-1', isDraft ? 'text-gray-500' : 'text-gray-900')}>{item.title}</h3>

                      {/* Content preview */}
                      <p className={cn('text-sm leading-relaxed line-clamp-2', isDraft ? 'text-gray-400' : 'text-muted-foreground')} dangerouslySetInnerHTML={{ __html: renderRichContent(item.content.slice(0, 200)) }} />

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(item.createdAt)}
                        </span>
                        {item.isPublished && item.publishedAt && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Published {formatDate(item.publishedAt)}
                          </span>
                        )}
                        {item.expiresAt && (
                          <span className={cn('flex items-center gap-1', expired ? 'text-amber-600' : '')}>
                            <Clock className="h-3 w-3" /> {expired ? 'Expired' : 'Expires'} {formatDate(item.expiresAt)}
                          </span>
                        )}
                      </div>

                      {/* Target audience indicators */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Users className="h-2.5 w-2.5" /></span>
                        {targetRoles.map(r => (
                          <Badge key={r} variant="outline" className="text-xs px-1.5 py-0">
                            {ROLE_LABELS[r] || r}
                          </Badge>
                        ))}
                        {targetClasses.map(c => (
                          <Badge key={c} variant="outline" className="text-xs px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-100">
                            <GraduationCap className="h-2 w-2 mr-0.5" /> {c}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    {isAdmin && (
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => togglePublish(item)}>
                              {item.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish Now</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => { setDetailItem(item); }}><ChevronRight className="h-3.5 w-3.5" /> View Details</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-red-600" onClick={() => handleDelete(item.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px] gap-1"
                          onClick={() => togglePublish(item)}
                        >
                          {item.isPublished ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                          {item.isPublished ? 'Unpub' : 'Pub'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-w-lg">
          {detailItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn('text-[10px] border capitalize', PRIORITY_CONFIG[detailItem.priority]?.bg, PRIORITY_CONFIG[detailItem.priority]?.color, PRIORITY_CONFIG[detailItem.priority]?.border)}>
                    {PRIORITY_CONFIG[detailItem.priority]?.pulse && <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse" />}
                    {PRIORITY_CONFIG[detailItem.priority]?.label}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px] capitalize', TYPE_CONFIG[detailItem.type]?.color)}>
                    {TYPE_CONFIG[detailItem.type]?.icon} {detailItem.type}
                  </Badge>
                  {detailItem.isPublished && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Published</Badge>}
                  {isExpired(detailItem.expiresAt) && !detailItem.isPublished && <Badge variant="outline" className="text-[10px] text-amber-600">Expired</Badge>}
                </div>
                <DialogTitle className="text-lg">{detailItem.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderRichContent(detailItem.content) }} />
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> Created: {formatDateTime(detailItem.createdAt)}
                  </div>
                  {detailItem.isPublished && detailItem.publishedAt && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Published: {formatDateTime(detailItem.publishedAt)}
                    </div>
                  )}
                  {detailItem.expiresAt && (
                    <div className={cn('flex items-center gap-2', isExpired(detailItem.expiresAt) ? 'text-amber-600' : 'text-muted-foreground')}>
                      <Clock className="h-3.5 w-3.5" /> {isExpired(detailItem.expiresAt) ? 'Expired' : 'Expires'}: {formatDate(detailItem.expiresAt)}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">Visible to:</span>
                  {parseTargetRoles(detailItem.targetRoles).map(r => (
                    <Badge key={r} variant="outline" className="text-[10px]">{ROLE_LABELS[r] || r}</Badge>
                  ))}
                  {parseTargetClasses(detailItem.targetClasses).map(c => (
                    <Badge key={c} variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100"><GraduationCap className="h-2.5 w-2.5 mr-0.5" />{c}</Badge>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => { setDetailItem(null); openEdit(detailItem); }}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => togglePublish(detailItem)}>
                    {detailItem.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete &ldquo;{detailItem.title}&rdquo;? This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(detailItem.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
