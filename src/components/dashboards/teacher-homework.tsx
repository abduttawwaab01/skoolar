'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/shared/kpi-card';
import { HomeworkAnalyticsView } from './homework-analytics-view';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BookOpen, Plus, Search, ClipboardList, Clock, AlertTriangle,
  CheckCircle2, FileText, ChevronLeft, ChevronRight, Eye,
  Star, MessageSquare, GraduationCap, Users, CalendarDays,
  Trash2, FileEdit, Save, Loader2, BarChart3,
} from 'lucide-react';

// ---- Types ----
interface HomeworkItem {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  subjectId: string | null;
  classId: string | null;
  teacherId: string | null;
  dueDate: string;
  totalMarks: number;
  status: string;
  attachments: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  subject: { id: string; name: string; code: string | null } | null;
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  _count: { submissions: number };
  submissions?: HomeworkSubmissionItem[];
}

interface HomeworkSubmissionItem {
  id: string;
  studentId: string;
  status: string;
  score: number | null;
  grade: string | null;
  teacherComment: string | null;
  submittedAt: string;
  gradedAt: string | null;
  content: string | null;
  student: {
    id: string;
    admissionNo: string;
    user: { name: string; avatar: string | null };
  };
}

interface SubjectItem {
  id: string;
  name: string;
  code: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
}

// ---- Helpers ----
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate: string, status: string, nowOverride?: Date) {
  if (status === 'closed' || status === 'completed') return false;
  const d = nowOverride || new Date();
  return new Date(dueDate) < d;
}

function isDueSoon(dueDate: string, nowOverride?: Date) {
  const d = nowOverride || new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 2;
}

function getStatusBadge(status: string, dueDate: string) {
  const overdue = isOverdue(dueDate, status);
  if (overdue) return <Badge variant="destructive" className="text-[10px]">Overdue</Badge>;
  if (status === 'active') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">Active</Badge>;
  if (status === 'closed') return <Badge variant="secondary" className="text-[10px]">Closed</Badge>;
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

function getGradeFromScore(score: number, totalMarks: number): string {
  const pct = (score / totalMarks) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

// ---- Component ----
export function TeacherHomework() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [teacherPrismaId, setTeacherPrismaId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  const now = mounted ? new Date() : undefined;

  // Resolve teacher's Prisma ID from User ID
  useEffect(() => {
    if (!schoolId || currentRole !== 'TEACHER') return;
    fetch(`/api/teachers?schoolId=${schoolId}&limit=200`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => {
        const teachers = json.data || json || [];
        const t = teachers.find((t: Record<string, unknown>) => (t.user as Record<string, unknown>)?.id === currentUser.id);
        if (t) setTeacherPrismaId(t.id as string);
      })
      .catch(() => {});
  }, [schoolId, currentRole, currentUser.id]);

  // Data state
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<HomeworkItem | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    subjectId: '',
    classId: '',
    dueDate: '',
    totalMarks: '100',
  });
  const [creating, setCreating] = useState(false);

  // Question builder state
  const [createQuestions, setCreateQuestions] = useState<{ type: string; questionText: string; options: string; correctAnswer: string; marks: number }[]>([]);
  const [showQuestionBuilder, setShowQuestionBuilder] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState({ type: 'MCQ', questionText: '', options: '', correctAnswer: '', marks: 1 });

  // Grading state
  const [gradingData, setGradingData] = useState<Record<string, { score: string; grade: string; comment: string }>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  // Edit/Delete state
  const [editOpen, setEditOpen] = useState(false);
  const [editingHw, setEditingHw] = useState<HomeworkItem | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', subjectId: '', classId: '', dueDate: '', totalMarks: '100' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteHwId, setDeleteHwId] = useState<string | null>(null);
  const [deletingHw, setDeletingHw] = useState(false);

  // Analytics state
  const [analyticsHwId, setAnalyticsHwId] = useState<string | null>(null);

  // Reference data
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // ---- Fetch homework ----
  const fetchHomework = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        schoolId,
        includeSubmissions: 'true',
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter && statusFilter !== 'all' && statusFilter !== 'overdue') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/homework?${params}`);
      if (res.ok) {
        const json = await res.json();
        setHomeworkList(json.data || []);
        setTotal(json.total || 0);
      }
    } catch {
      toast.error('Failed to load homework');
    } finally {
      setLoading(false);
    }
  }, [schoolId, page, statusFilter, searchQuery]);

  // ---- Fetch subjects & classes ----
  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const classUrl = teacherPrismaId
          ? `/api/classes?schoolId=${schoolId}&limit=100&teacherId=${teacherPrismaId}`
          : `/api/classes?schoolId=${schoolId}&limit=100`;
        const [subjRes, classRes] = await Promise.all([
          fetch(`/api/subjects?schoolId=${schoolId}&limit=100`),
          fetch(classUrl),
        ]);
        if (subjRes.ok) {
          const json = await subjRes.json();
          setSubjects(json.data || json || []);
        }
        if (classRes.ok) {
          const json = await classRes.json();
          setClasses(json.data || json || []);
        }
      } catch {
        // Silently fail - reference data is optional
      }
    };
    if (schoolId) fetchRefs();
  }, [schoolId, teacherPrismaId]);

  useEffect(() => {
    if (schoolId) fetchHomework();
  }, [fetchHomework, schoolId]);

  // Client-side filter for computed statuses (overdue)
  const displayedHomework = homeworkList.filter(hw => {
    if (statusFilter === 'overdue') return isOverdue(hw.dueDate, hw.status, now);
    return true;
  });

  // ---- Stats ----
  const stats = {
    total: total,
    active: homeworkList.filter(h => h.status === 'active' && !isOverdue(h.dueDate, h.status)).length,
    overdue: homeworkList.filter(h => h.status === 'active' && isOverdue(h.dueDate, h.status)).length,
    submitted: homeworkList.reduce((sum, h) => sum + (h._count?.submissions || 0), 0),
    pendingGrading: homeworkList.reduce((sum, h) => {
      return sum + (h.submissions?.filter(s => s.status === 'submitted' && !s.score).length || 0);
    }, 0),
  };

  const totalPages = Math.ceil(total / limit);

  // ---- Create homework ----
  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!createForm.dueDate) {
      toast.error('Due date is required');
      return;
    }
    try {
      setCreating(true);
      const body: Record<string, unknown> = {
        schoolId,
        title: createForm.title,
        description: createForm.description,
        subjectId: createForm.subjectId || null,
        classId: createForm.classId || null,
        dueDate: createForm.dueDate,
        totalMarks: parseInt(createForm.totalMarks) || 100,
        createdBy: currentUser.id || null,
      };
      if (createQuestions.length > 0) {
        body.questions = createQuestions.map((q, i) => ({
          type: q.type,
          questionText: q.questionText,
          options: q.options || null,
          correctAnswer: q.correctAnswer || null,
          marks: q.marks || 1,
          order: i,
        }));
      }
      const res = await fetch('/api/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Homework created successfully');
        setCreateOpen(false);
        setCreateForm({ title: '', description: '', subjectId: '', classId: '', dueDate: '', totalMarks: '100' });
        setCreateQuestions([]);
        setShowQuestionBuilder(false);
        setEditingQuestionIndex(null);
        setQuestionForm({ type: 'MCQ', questionText: '', options: '', correctAnswer: '', marks: 1 });
        fetchHomework();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to create homework');
      }
    } catch {
      toast.error('Failed to create homework');
    } finally {
      setCreating(false);
    }
  };

  // ---- Grade submission ----
  const handleGrade = async (homeworkId: string, submissionId: string) => {
    const data = gradingData[submissionId];
    if (!data) return;
    const score = parseFloat(data.score);
    if (isNaN(score) || score < 0) {
      toast.error('Enter a valid score');
      return;
    }
    try {
      setGradingId(submissionId);
      const res = await fetch('/api/homework', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: homeworkId,
          action: 'grade',
          submissionId,
          score,
          grade: data.grade,
          teacherComment: data.comment,
        }),
      });
      if (res.ok) {
        toast.success('Submission graded successfully');
        fetchHomework();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to grade submission');
      }
    } catch {
      toast.error('Failed to grade submission');
    } finally {
      setGradingId(null);
    }
  };

  // ---- Open submissions view ----
  const openSubmissions = (hw: HomeworkItem) => {
    setSelectedHomework(hw);
    setSubmissionsOpen(true);
    // Initialize grading data
    const gd: Record<string, { score: string; grade: string; comment: string }> = {};
    hw.submissions?.forEach(s => {
      gd[s.id] = {
        score: s.score !== null ? String(s.score) : '',
        grade: s.grade || '',
        comment: s.teacherComment || '',
      };
    });
    setGradingData(gd);
  };

  // ---- Edit/Delete handlers ----
  const openEditHomework = (hw: HomeworkItem) => {
    setEditingHw(hw);
    setEditForm({
      title: hw.title,
      description: hw.description,
      subjectId: hw.subjectId || '',
      classId: hw.classId || '',
      dueDate: hw.dueDate ? hw.dueDate.split('T')[0] : '',
      totalMarks: String(hw.totalMarks),
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingHw) return;
    try {
      setSavingEdit(true);
      const res = await fetch('/api/homework', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingHw.id,
          title: editForm.title,
          description: editForm.description,
          subjectId: editForm.subjectId || null,
          classId: editForm.classId || null,
          dueDate: editForm.dueDate,
          totalMarks: parseInt(editForm.totalMarks) || 100,
        }),
      });
      if (res.ok) {
        toast.success('Homework updated');
        setEditOpen(false);
        setEditingHw(null);
        fetchHomework();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to update homework');
      }
    } catch {
      toast.error('Failed to update homework');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteHomework = async () => {
    if (!deleteHwId) return;
    try {
      setDeletingHw(true);
      const res = await fetch(`/api/homework?id=${deleteHwId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Homework deleted');
        setDeleteHwId(null);
        fetchHomework();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to delete homework');
      }
    } catch {
      toast.error('Failed to delete homework');
    } finally {
      setDeletingHw(false);
    }
  };

  // ---- Skeleton ----
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-40 mt-2" /></div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Homework Management</h1>
          <p className="text-muted-foreground">Create, manage and grade homework assignments</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="size-4 mr-2" /> Create Homework
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard title="Total Assignments" value={stats.total} icon={ClipboardList} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Active" value={stats.active} icon={CheckCircle2} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard title="Overdue" value={stats.overdue} icon={AlertTriangle} iconBgColor="bg-red-100" iconColor="text-red-600" />
        <KpiCard title="Submissions" value={stats.submitted} icon={Users} iconBgColor="bg-purple-100" iconColor="text-purple-600" />
        <KpiCard title="Pending Grading" value={stats.pendingGrading} icon={Star} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search homework..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== 'all' || searchQuery) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setSearchQuery(''); setPage(1); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Homework List */}
      {displayedHomework.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <BookOpen className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No homework found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {statusFilter === 'overdue'
                ? 'No overdue homework!'
                : searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters or search query.'
                  : 'Create your first homework assignment to get started.'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="size-4 mr-2" /> Create Homework
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Subject</TableHead>
                    <TableHead className="hidden md:table-cell">Class</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Submissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedHomework.map((hw) => {
                    const overdue = isOverdue(hw.dueDate, hw.status, now);
                    const dueSoon = isDueSoon(hw.dueDate, now);
                    return (
                      <TableRow key={hw.id} className={cn(overdue && 'bg-red-50/50')}>
                        <TableCell>
                          <div className="font-medium">{hw.title}</div>
                          <div className="text-xs text-muted-foreground max-w-[200px] truncate">{hw.description}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {hw.subject ? (
                            <Badge variant="outline" className="text-[10px]">{hw.subject.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">â€”</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {hw.class ? hw.class.name : <span className="text-muted-foreground text-sm">â€”</span>}
                        </TableCell>
                        <TableCell>
                          <div className={cn('flex items-center gap-1 text-sm', overdue && 'text-red-600 font-semibold', dueSoon && !overdue && 'text-amber-600')}>
                            <CalendarDays className="size-3" />
                            {formatDate(hw.dueDate)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">{hw.totalMarks}</TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge variant="secondary" className="text-[10px]">{hw._count?.submissions || 0}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(hw.status, hw.dueDate)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditHomework(hw)}
                              className="h-8 w-8 p-0"
                            >
                              <FileEdit className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openSubmissions(hw)}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <Eye className="size-4 mr-1" />
                              <span className="hidden sm:inline">{hw._count?.submissions ? 'Grade' : 'View'}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAnalyticsHwId(hw.id)}
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 h-8 w-8 p-0"
                              title="View Analytics"
                            >
                              <BarChart3 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteHwId(hw.id)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1}â€“{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <span className="text-sm font-medium">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Homework Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) { setCreateQuestions([]); setShowQuestionBuilder(false); setEditingQuestionIndex(null); setQuestionForm({ type: 'MCQ', questionText: '', options: '', correctAnswer: '', marks: 1 }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-emerald-600" /> Create Homework
            </DialogTitle>
            <DialogDescription>Assign a new homework task to your students.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="hw-title">Title *</Label>
              <Input
                id="hw-title"
                placeholder="e.g., Chapter 5 Exercise"
                value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-desc">Description</Label>
              <Textarea
                id="hw-desc"
                placeholder="Describe the homework assignment..."
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={createForm.subjectId} onValueChange={v => setCreateForm(f => ({ ...f, subjectId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={createForm.classId} onValueChange={v => setCreateForm(f => ({ ...f, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hw-due">Due Date *</Label>
                <Input
                  id="hw-due"
                  type="date"
                  value={createForm.dueDate}
                  onChange={e => setCreateForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hw-marks">Total Marks</Label>
                <Input
                  id="hw-marks"
                  type="number"
                  value={createForm.totalMarks}
                  onChange={e => setCreateForm(f => ({ ...f, totalMarks: e.target.value }))}
                  min={0}
                />
              </div>
            </div>

            {/* Question Builder */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Questions</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuestionBuilder(v => !v)}
                >
                  {showQuestionBuilder ? 'Hide Questions' : 'Add Questions'}
                </Button>
              </div>

              {showQuestionBuilder && (
                <div className="space-y-3">
                  {/* Existing questions list */}
                  {createQuestions.length > 0 && (
                    <div className="space-y-2">
                      {createQuestions.map((q, i) => (
                        <Card key={i} className="border border-muted">
                          <CardContent className="p-3 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-[10px] font-mono">{q.type}</Badge>
                                  <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                                </div>
                                <p className="text-sm font-medium mt-1 line-clamp-2">{q.questionText}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => {
                                    setEditingQuestionIndex(i);
                                    setQuestionForm({
                                      type: q.type, questionText: q.questionText,
                                      options: q.options || '', correctAnswer: q.correctAnswer || '', marks: q.marks,
                                    });
                                  }}
                                >
                                  <FileEdit className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                  onClick={() => setCreateQuestions(prev => prev.filter((_, idx) => idx !== i))}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Question editor */}
                  {editingQuestionIndex !== null ? (
                    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {editingQuestionIndex < createQuestions.length
                            ? `Edit Question #${editingQuestionIndex + 1}`
                            : `Add Question #${createQuestions.length + 1}`}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingQuestionIndex(null); setQuestionForm({ type: 'MCQ', questionText: '', options: '', correctAnswer: '', marks: 1 }); }}>
                          Cancel
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Type</Label>
                        <Select value={questionForm.type} onValueChange={v => setQuestionForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'ESSAY', 'MATCHING'].map(t => (
                              <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Question Text *</Label>
                        <Textarea
                          placeholder="Enter the question..."
                          value={questionForm.questionText}
                          onChange={e => setQuestionForm(f => ({ ...f, questionText: e.target.value }))}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      {['MCQ', 'MULTI_SELECT', 'MATCHING'].includes(questionForm.type) && (
                        <div className="space-y-2">
                          <Label className="text-xs">Options (one per line{questionForm.type === 'MATCHING' ? ', format: left|right' : ''})</Label>
                          <Textarea
                            placeholder={questionForm.type === 'MATCHING' ? 'item A|match A\nitem B|match B' : 'Option 1\nOption 2\nOption 3'}
                            value={questionForm.options}
                            onChange={e => setQuestionForm(f => ({ ...f, options: e.target.value }))}
                            rows={3}
                            className="text-sm"
                          />
                        </div>
                      )}
                      {questionForm.type === 'TRUE_FALSE' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Correct Answer</Label>
                          <Select value={questionForm.correctAnswer} onValueChange={v => setQuestionForm(f => ({ ...f, correctAnswer: v }))}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">True</SelectItem>
                              <SelectItem value="false">False</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {(questionForm.type === 'FILL_BLANK' || questionForm.type === 'SHORT_ANSWER' || questionForm.type === 'ESSAY') && (
                        <div className="space-y-2">
                          <Label className="text-xs">
                            {questionForm.type === 'FILL_BLANK' ? 'Acceptable Answers (one per line)' : 'Correct Answer (optional, for self-review)'}
                          </Label>
                          <Textarea
                            placeholder={questionForm.type === 'FILL_BLANK' ? 'answer1\nanswer2' : 'Expected answer...'}
                            value={questionForm.correctAnswer}
                            onChange={e => setQuestionForm(f => ({ ...f, correctAnswer: e.target.value }))}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      )}
                      {questionForm.type === 'MCQ' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Correct Answer (must match an option exactly)</Label>
                          <Input
                            placeholder="Correct option text"
                            value={questionForm.correctAnswer}
                            onChange={e => setQuestionForm(f => ({ ...f, correctAnswer: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                      )}
                      {questionForm.type === 'MULTI_SELECT' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Correct Answers (comma-separated)</Label>
                          <Input
                            placeholder="Option 1, Option 3"
                            value={questionForm.correctAnswer}
                            onChange={e => setQuestionForm(f => ({ ...f, correctAnswer: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-xs">Marks *</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={questionForm.marks}
                          onChange={e => setQuestionForm(f => ({ ...f, marks: parseInt(e.target.value) || 1 }))}
                          className="h-9 w-24"
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={!questionForm.questionText.trim()}
                        onClick={() => {
                          if (!questionForm.questionText.trim()) return;
                          const newQ = {
                            type: questionForm.type,
                            questionText: questionForm.questionText,
                            options: questionForm.options || '',
                            correctAnswer: questionForm.correctAnswer || '',
                            marks: questionForm.marks || 1,
                          };
                          if (editingQuestionIndex < createQuestions.length) {
                            setCreateQuestions(prev => prev.map((q, idx) => idx === editingQuestionIndex ? newQ : q));
                          } else {
                            setCreateQuestions(prev => [...prev, newQ]);
                          }
                          setEditingQuestionIndex(null);
                          setQuestionForm({ type: 'MCQ', questionText: '', options: '', correctAnswer: '', marks: 1 });
                        }}
                      >
                        {editingQuestionIndex < createQuestions.length ? 'Update Question' : 'Add Question'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => setEditingQuestionIndex(createQuestions.length)}
                    >
                      <Plus className="size-4 mr-1" /> Add Question
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
              {creating ? 'Creating...' : 'Create Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submissions & Grading Dialog */}
      <Dialog open={submissionsOpen} onOpenChange={setSubmissionsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedHomework && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="size-5 text-emerald-600" /> Submissions
                </DialogTitle>
                <DialogDescription>
                  <span className="font-semibold">{selectedHomework.title}</span>
                  {' â€” '}
                  {selectedHomework.subject?.name && `${selectedHomework.subject.name} Â· `}
                  Due: {formatDate(selectedHomework.dueDate)}
                  {' Â· '} Total Marks: {selectedHomework.totalMarks}
                </DialogDescription>
              </DialogHeader>

              {(!selectedHomework.submissions || selectedHomework.submissions.length === 0) ? (
                <div className="py-8 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-3">
                    <Users className="size-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold">No submissions yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Students haven&apos;t submitted their work yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="size-4" />
                    {selectedHomework.submissions.length} submission{selectedHomework.submissions.length !== 1 ? 's' : ''}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
                    {selectedHomework.submissions.map(sub => {
                      const gd = gradingData[sub.id] || { score: '', grade: '', comment: '' };
                      const isGraded = sub.status === 'graded' || sub.score !== null;
                      return (
                        <Card key={sub.id} className={cn(isGraded && 'border-emerald-200 bg-emerald-50/30')}>
                          <CardContent className="p-4 space-y-3">
                            {/* Student Info */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
                                  {sub.student.user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{sub.student.user.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {sub.student.admissionNo} Â· Submitted {formatDate(sub.submittedAt)}
                                  </p>
                                </div>
                              </div>
                              {isGraded ? (
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-emerald-600 text-[10px]">Graded</Badge>
                                  <span className="text-sm font-bold text-emerald-700">{sub.score}/{selectedHomework.totalMarks}</span>
                                  {sub.grade && <Badge variant="outline" className="text-[10px]">{sub.grade}</Badge>}
                                </div>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                              )}
                            </div>

                            {/* Submitted Content */}
                            {sub.content && (
                              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap border">
                                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                                  <FileText className="size-3" /> Answer
                                </div>
                                {sub.content.length > 300 ? sub.content.slice(0, 300) + '...' : sub.content}
                              </div>
                            )}

                            {/* Teacher comment display for graded */}
                            {isGraded && sub.teacherComment && (
                              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm">
                                <div className="flex items-center gap-1 text-xs font-medium text-emerald-700 mb-1">
                                  <MessageSquare className="size-3" /> Teacher Comment
                                </div>
                                {sub.teacherComment}
                              </div>
                            )}

                            {/* Grading Form */}
                            {!isGraded && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                                <div className="space-y-1">
                                  <Label className="text-xs">Score</Label>
                                  <Input
                                    type="number"
                                    placeholder={`0-${selectedHomework.totalMarks}`}
                                    value={gd.score}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const num = parseFloat(val);
                                      let grade = gd.grade;
                                      if (!isNaN(num)) {
                                        grade = getGradeFromScore(num, selectedHomework.totalMarks);
                                      }
                                      setGradingData(prev => ({ ...prev, [sub.id]: { ...gd, score: val, grade } }));
                                    }}
                                    min={0}
                                    max={selectedHomework.totalMarks}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Grade</Label>
                                  <Select value={gd.grade} onValueChange={v => setGradingData(prev => ({ ...prev, [sub.id]: { ...gd, grade: v } }))}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Grade" /></SelectTrigger>
                                    <SelectContent>
                                      {['A+', 'A', 'B', 'C', 'D', 'F'].map(g => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1 sm:col-span-1">
                                  <Label className="text-xs">Comment</Label>
                                  <Input
                                    placeholder="Add feedback..."
                                    value={gd.comment}
                                    onChange={e => setGradingData(prev => ({ ...prev, [sub.id]: { ...gd, comment: e.target.value } }))}
                                    className="h-9"
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 col-span-full sm:col-span-3 h-9"
                                  onClick={() => handleGrade(selectedHomework.id, sub.id)}
                                  disabled={gradingId === sub.id || !gd.score}
                                >
                                  {gradingId === sub.id ? (
                                    'Grading...'
                                  ) : (
                                    <><Star className="size-3.5 mr-1.5" /> Grade Submission</>
                                  )}
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Homework Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="size-5 text-emerald-600" /> Edit Homework
            </DialogTitle>
            <DialogDescription>Update homework details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input id="edit-title" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={editForm.subjectId} onValueChange={v => setEditForm(f => ({ ...f, subjectId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={editForm.classId} onValueChange={v => setEditForm(f => ({ ...f, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-due">Due Date *</Label>
                <Input id="edit-due" type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-marks">Total Marks</Label>
                <Input id="edit-marks" type="number" value={editForm.totalMarks} onChange={e => setEditForm(f => ({ ...f, totalMarks: e.target.value }))} min={0} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !editForm.title} className="bg-emerald-600 hover:bg-emerald-700">
              {savingEdit ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Homework Confirmation */}
      <Dialog open={!!deleteHwId} onOpenChange={() => setDeleteHwId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Homework</DialogTitle>
            <DialogDescription>Are you sure you want to delete this homework assignment? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteHwId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteHomework} disabled={deletingHw}>
              {deletingHw ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Trash2 className="size-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Homework Analytics */}
      {analyticsHwId && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 md:inset-8 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
            <HomeworkAnalyticsView
              homeworkId={analyticsHwId}
              onBack={() => setAnalyticsHwId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
