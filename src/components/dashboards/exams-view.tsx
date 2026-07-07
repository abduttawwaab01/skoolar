'use client';

import React, { useState, useEffect } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, GraduationCap, AlertCircle, Loader2, ClipboardEdit, Brain, BarChart3, FileQuestion, Trash2, Pencil, Printer, FileDown, FileText, Lock, Unlock, Globe, EyeOff } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ExamGradingView } from './exam-grading-view';
import { ExamAnalyticsView } from './exam-analytics-view';
import { ExamQuestionManager } from '@/components/features/exam-question-editor';
import { ExamScoreEntry } from '@/components/features/exam-score-entry';
import { printExam, generateExamPdf, downloadDocx } from '@/components/features/exam-pdf-export';

export interface ExamRecord {
  id: string;
  name: string;
  subject: string;
  class: string;
  classId: string;
  type: string;
  totalMarks: number;
  status: string;
  isPublished: boolean;
  isLocked: boolean;
  date: string | null;
  term: string | null;
  teacher: string | null;
  passingMarks: number;
  duration: number | null;
  instructions?: string;
  scoresCount: number;
  questionsCount: number;
}

const statusFilters = ['All', 'Active', 'Draft', 'Published', 'Locked'] as const;

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ExamsView() {
  const { currentUser, selectedSchoolId, currentRole } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER'].includes(currentRole || '');
  const [exams, setExams] = React.useState<ExamRecord[]>([]);
  const [classes, setClasses] = React.useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [activeStatus, setActiveStatus] = React.useState<string>('All');
  const [adding, setAdding] = React.useState(false);
  const [teacherPrismaId, setTeacherPrismaId] = React.useState<string | null>(null);
  const [editExam, setEditExam] = React.useState<ExamRecord | null>(null);
  const [deleteExamId, setDeleteExamId] = React.useState<string | null>(null);
  const [deletingExam, setDeletingExam] = React.useState(false);
  const [gradingExamId, setGradingExamId] = React.useState<string | null>(null);
  const [analyticsExamId, setAnalyticsExamId] = React.useState<string | null>(null);
  const [scoreEntryExam, setScoreEntryExam] = React.useState<ExamRecord | null>(null);
  const [questionManagerExam, setQuestionManagerExam] = React.useState<ExamRecord | null>(null);

  React.useEffect(() => {
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

  const mapExamRecord = (e: Record<string, unknown>) => {
    const isPublished = e.isPublished as boolean;
    const isLocked = e.isLocked as boolean;
    let status = 'draft';
    if (isLocked) status = 'locked';
    else if (isPublished) status = 'published';
    else if (e.date) {
      const examDate = new Date(e.date as string);
      const now = mounted ? new Date() : new Date('2026-01-01');
      status = examDate > now ? 'active' : 'draft';
    }
    return {
      id: e.id as string,
      name: e.name as string,
      subject: ((e.subject as Record<string, unknown>)?.name as string) || '—',
      class: ((e.class as Record<string, unknown>)?.name as string) || '—',
      classId: ((e.class as Record<string, unknown>)?.id as string) || '',
      type: (e.type as string) || 'assessment',
      totalMarks: (e.totalMarks as number) || 100,
      status,
      isPublished,
      isLocked,
      date: (e.date as string) || null,
      term: ((e.term as Record<string, unknown>)?.name as string) || null,
      teacher: (e.teacher as Record<string, unknown>)?.user
        ? ((e.teacher as Record<string, unknown>).user as Record<string, unknown>).name as string
        : null,
      passingMarks: (e.passingMarks as number) || 50,
      duration: e.duration as number || null,
      scoresCount: ((e._count as Record<string, unknown>)?.scores as number) || 0,
      questionsCount: ((e._count as Record<string, unknown>)?.questions as number) || 0,
    };
  };

  const fetchExams = React.useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    const classUrl = teacherPrismaId
      ? `/api/classes?schoolId=${schoolId}&limit=100&teacherId=${teacherPrismaId}`
      : `/api/classes?schoolId=${schoolId}&limit=100`;
    try {
      const [examData, classData, subjectData] = await Promise.all([
        (async () => {
          const res = await fetch(`/api/exams?schoolId=${schoolId}&limit=100`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          return (json.data || json || []).map(mapExamRecord);
        })(),
        (async () => {
          const res = await fetch(classUrl);
          const json = await res.json();
          return (json.data || json || []).map((c: Record<string, unknown>) => ({ id: c.id, name: c.name }));
        })(),
        (async () => {
          const res = await fetch(`/api/subjects?schoolId=${schoolId}&limit=100`);
          const json = await res.json();
          return (Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []).map((s: Record<string, unknown>) => ({ id: s.id, name: s.name }));
        })(),
      ]);
      setExams(examData);
      setClasses(classData);
      setSubjects(subjectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      toast.error('Failed to load exams');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId, teacherPrismaId, mounted]);

  React.useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    fetchExams();
  }, [fetchExams, schoolId]);

  const filteredExams = React.useMemo(() => {
    if (activeStatus === 'All') return exams;
    return exams.filter(e => e.status.toLowerCase() === activeStatus.toLowerCase());
  }, [exams, activeStatus]);

  const handleCreateExam = async () => {
    if (!schoolId) {
      toast.error('No school selected');
      return;
    }
    const dialog = document.querySelector('[data-exam-dialog]');
    if (!dialog) return;
    const form = dialog.querySelector('form') as HTMLFormElement | null;
    if (!form) return;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const subjectId = formData.get('subjectId') as string;
    const classId = formData.get('classId') as string;
    if (!name || !subjectId || !classId) {
      toast.error('Name, subject, and class are required');
      return;
    }
    const isEditing = !!editExam;
    setAdding(true);
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `/api/exams/${editExam!.id}` : '/api/exams';
      const body: Record<string, unknown> = isEditing ? {} : { schoolId };
      body.name = name;
      body.subjectId = subjectId;
      body.classId = classId;
      body.type = formData.get('type') || 'assessment';
      body.totalMarks = parseInt(formData.get('totalMarks') as string) || 100;
      body.passingMarks = parseInt(formData.get('passingMarks') as string) || 50;
      body.date = formData.get('date') || null;
      body.duration = parseInt(formData.get('duration') as string) || null;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      toast.success(isEditing ? 'Exam updated successfully' : 'Exam created successfully');
      setOpen(false);
      setEditExam(null);
      await fetchExams();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : (editExam ? 'Failed to update exam' : 'Failed to create exam'));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!deleteExamId) return;
    setDeletingExam(true);
    try {
      const res = await fetch(`/api/exams/${deleteExamId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      toast.success('Exam deleted successfully');
      setDeleteExamId(null);
      setExams(prev => prev.filter(e => e.id !== deleteExamId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete exam');
    } finally {
      setDeletingExam(false);
    }
  };

  const handleStatusChange = async (examId: string, action: string) => {
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to change status');
      await fetchExams();
      const actionLabels: Record<string, string> = { publish: 'published', unpublish: 'unpublished', lock: 'locked', unlock: 'unlocked' };
      toast.success(`Exam ${actionLabels[action] || action} successfully`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change status');
    }
  };

  const columns: ColumnDef<ExamRecord>[] = React.useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => <span className="text-sm">{row.original.subject}</span>,
    },
    {
      accessorKey: 'class',
      header: 'Class',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">{row.original.class}</Badge>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize">{row.original.type}</Badge>
      ),
    },
    {
      accessorKey: 'totalMarks',
      header: 'Total',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.totalMarks}</span>
      ),
    },
    {
      accessorKey: 'questionsCount',
      header: 'Questions',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.questionsCount}</span>
      ),
    },
    {
      accessorKey: 'scoresCount',
      header: 'Scores',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.scoresCount}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status;
        const variant = s === 'active' ? 'success' : s === 'published' ? 'info' : s === 'draft' ? 'warning' : 'neutral';
        return <StatusBadge variant={variant} size="sm">{s}</StatusBadge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const exam = row.original;
        return (
          <div className="flex gap-1 sm:gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); setScoreEntryExam(exam); }}
            >
              <ClipboardEdit className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Scores</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); setQuestionManagerExam(exam); }}
            >
              <FileQuestion className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Questions</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); setGradingExamId(exam.id); }}
            >
              <Brain className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Grade</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-sky-200 text-sky-700 hover:bg-sky-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); printExam(exam, schoolId); }}
            >
              <Printer className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-orange-200 text-orange-700 hover:bg-orange-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); generateExamPdf(exam, schoolId); }}
            >
              <FileText className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); downloadDocx(exam, schoolId); }}
            >
              <FileDown className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">DOC</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); setAnalyticsExamId(exam.id); }}
            >
              <BarChart3 className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Analytics</span>
            </Button>
            {isAdmin && (
              <>
                {exam.status !== 'locked' && exam.status !== 'published' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-green-200 text-green-700 hover:bg-green-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(exam.id, 'publish'); }}
                    disabled={exam.questionsCount === 0}
                    title={exam.questionsCount === 0 ? 'Add questions before publishing' : 'Publish exam'}
                  >
                    <Globe className="size-3 sm:size-3.5" />
                    <span className="hidden sm:inline">Publish</span>
                  </Button>
                )}
                {exam.status === 'published' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(exam.id, 'unpublish'); }}
                  >
                    <EyeOff className="size-3 sm:size-3.5" />
                    <span className="hidden sm:inline">Unpub.</span>
                  </Button>
                )}
                {exam.status !== 'locked' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-gray-200 text-gray-700 hover:bg-gray-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(exam.id, 'lock'); }}
                  >
                    <Lock className="size-3 sm:size-3.5" />
                    <span className="hidden sm:inline">Lock</span>
                  </Button>
                )}
                {exam.status === 'locked' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-yellow-200 text-yellow-700 hover:bg-yellow-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(exam.id, 'unlock'); }}
                  >
                    <Unlock className="size-3 sm:size-3.5" />
                    <span className="hidden sm:inline">Unlock</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
                  onClick={(e) => { e.stopPropagation(); setEditExam(exam); setOpen(true); }}
                >
                  <Pencil className="size-3 sm:size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-red-200 text-red-700 hover:bg-red-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
                  onClick={(e) => { e.stopPropagation(); setDeleteExamId(exam.id); }}
                >
                  <Trash2 className="size-3 sm:size-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ], [isAdmin]);

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GraduationCap className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view exams</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (analyticsExamId) {
    return <ExamAnalyticsView examId={analyticsExamId} onBack={() => setAnalyticsExamId(null)} />;
  }

  if (gradingExamId) {
    return <ExamGradingView examId={gradingExamId} onBack={() => setGradingExamId(null)} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="size-12 text-destructive opacity-60" />
        <p className="mt-3 text-sm font-medium">Failed to load exams</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchExams()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h2 className="text-lg font-semibold">Exam Management</h2>
          <p className="text-sm text-muted-foreground">{exams.length} examinations configured</p>
        </div>
        <Dialog open={open} onOpenChange={(open) => { if (!open) { setEditExam(null); } setOpen(open); }}>
          {isAdmin && <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setEditExam(null)}>
              <Plus className="size-4" />
              Create Exam
            </Button>
          </DialogTrigger>}
          <DialogContent data-exam-dialog className="w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editExam ? 'Edit Exam' : 'Create Exam'}</DialogTitle>
              <DialogDescription>{editExam ? 'Update the examination details.' : 'Set up a new examination or test.'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateExam(); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" placeholder="e.g. Mid-Term Exam" required defaultValue={editExam?.name || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select name="subjectId" required defaultValue={editExam?.subject || ''}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select name="classId" required defaultValue={editExam?.classId || ''}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue={editExam?.type || 'assessment'}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ca">CA Test</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="practical">Practical</SelectItem>
                        <SelectItem value="assessment">Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Total Score</Label>
                    <Input name="totalMarks" placeholder="100" type="number" defaultValue={editExam?.totalMarks?.toString() || '100'} />
                  </div>
                  <div className="space-y-2">
                    <Label>Passing Score</Label>
                    <Input name="passingMarks" placeholder="50" type="number" defaultValue={editExam?.passingMarks?.toString() || '50'} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Exam Date</Label>
                    <Input name="date" type="date" defaultValue={editExam?.date ? editExam.date.split('T')[0] : ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (mins)</Label>
                    <Input name="duration" placeholder="60" type="number" defaultValue={editExam?.duration?.toString() || ''} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditExam(null); }}>Cancel</Button>
                <Button type="submit" disabled={adding}>
                  {adding && <Loader2 className="size-4 animate-spin mr-1" />}
                  {editExam ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {statusFilters.map(filter => (
          <Button key={filter} variant={activeStatus === filter ? 'default' : 'outline'} size="sm" onClick={() => setActiveStatus(filter)}>
            {filter}
          </Button>
        ))}
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable columns={columns} data={filteredExams} searchKey="name" searchPlaceholder="Search exams..." />
      </motion.div>

      {filteredExams.length === 0 && exams.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <GraduationCap className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No exams match the selected filter</p>
        </div>
      )}

      {exams.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <GraduationCap className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No exams configured yet</p>
          <p className="text-xs mt-1">Click &quot;Create Exam&quot; to get started</p>
        </div>
      )}

      {/* Score Entry Dialog */}
      <ExamScoreEntry
        exam={scoreEntryExam ? { id: scoreEntryExam.id, name: scoreEntryExam.name, totalMarks: scoreEntryExam.totalMarks, passingMarks: scoreEntryExam.passingMarks, classId: scoreEntryExam.classId } : null}
        onClose={() => setScoreEntryExam(null)}
        schoolId={schoolId}
        onSaved={fetchExams}
      />

      {/* Question Management Dialog */}
      <ExamQuestionManager
        exam={questionManagerExam ? { id: questionManagerExam.id, name: questionManagerExam.name, subject: questionManagerExam.subject, class: questionManagerExam.class } : null}
        onClose={() => setQuestionManagerExam(null)}
        schoolId={schoolId}
        onSaved={fetchExams}
      />

      {/* Delete Exam Confirmation */}
      <Dialog open={!!deleteExamId} onOpenChange={() => setDeleteExamId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="size-5" />
              Delete Exam
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this exam? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteExamId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteExam} disabled={deletingExam}>
              {deletingExam && <Loader2 className="size-4 mr-2 animate-spin" />}
              {deletingExam ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
