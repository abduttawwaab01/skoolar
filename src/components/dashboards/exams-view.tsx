'use client';

import * as React from 'react';
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
import { Plus, GraduationCap, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface ExamRecord {
  id: string;
  name: string;
  subject: string;
  class: string;
  type: string;
  totalMarks: number;
  status: string;
  date: string | null;
  term: string | null;
  teacher: string | null;
  passingMarks: number;
  duration: number | null;
  scoresCount: number;
}

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

const statusFilters = ['All', 'Active', 'Draft', 'Published', 'Locked'] as const;

export function ExamsView() {
  const { selectedSchoolId } = useAppStore();
  const [exams, setExams] = React.useState<ExamRecord[]>([]);
  const [classes, setClasses] = React.useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [activeStatus, setActiveStatus] = React.useState<string>('All');
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/exams?schoolId=${selectedSchoolId}&limit=100`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(json => {
          const items = json.data || json || [];
          return items.map((e: Record<string, unknown>) => {
            const isPublished = e.isPublished as boolean;
            const isLocked = e.isLocked as boolean;
            let status = 'draft';
            if (isLocked) status = 'locked';
            else if (isPublished) status = 'published';
            else if (e.date) {
              const examDate = new Date(e.date as string);
              const now = new Date();
              status = examDate > now ? 'active' : 'draft';
            }
            return {
              id: e.id,
              name: e.name as string,
              subject: (e.subject as Record<string, unknown>)?.name || '—',
              class: (e.class as Record<string, unknown>)?.name || '—',
              type: e.type as string || 'assessment',
              totalMarks: (e.totalMarks as number) || 100,
              status,
              date: e.date as string || null,
              term: (e.term as Record<string, unknown>)?.name || null,
              teacher: (e.teacher as Record<string, unknown>)?.user
                ? ((e.teacher as Record<string, unknown>).user as Record<string, unknown>).name as string
                : null,
              passingMarks: (e.passingMarks as number) || 50,
              duration: e.duration as number || null,
              scoresCount: ((e._count as Record<string, unknown>)?.scores as number) || 0,
            };
          });
        }),
      fetch(`/api/classes?schoolId=${selectedSchoolId}&limit=100`)
        .then(res => res.json())
        .then(json => (json.data || json || []).map((c: Record<string, unknown>) => ({
          id: c.id,
          name: c.name,
        }))),
      fetch(`/api/subjects?schoolId=${selectedSchoolId}&limit=100`)
        .then(res => res.json())
        .then(json => (json.data || json || []).map((s: Record<string, unknown>) => ({
          id: s.id,
          name: s.name,
        }))),
    ])
      .then(([examData, classData, subjectData]) => {
        setExams(examData);
        setClasses(classData);
        setSubjects(subjectData);
      })
      .catch(err => {
        setError(err.message);
        toast.error('Failed to load exams');
        setExams([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const filteredExams = React.useMemo(() => {
    if (activeStatus === 'All') return exams;
    return exams.filter(e => e.status.toLowerCase() === activeStatus.toLowerCase());
  }, [exams, activeStatus]);

  const handleCreateExam = async () => {
    if (!selectedSchoolId) {
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

    setAdding(true);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          name,
          subjectId,
          classId,
          type: formData.get('type') || 'assessment',
          totalMarks: parseInt(formData.get('totalMarks') as string) || 100,
          passingMarks: parseInt(formData.get('passingMarks') as string) || 50,
          date: formData.get('date') || null,
          duration: parseInt(formData.get('duration') as string) || null,
          termId: formData.get('termId') || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create exam');

      toast.success('Exam created successfully');
      setOpen(false);

      // Refresh exams
      const refreshed = await fetch(`/api/exams?schoolId=${selectedSchoolId}&limit=100`)
        .then(r => r.json())
        .then(j => {
          const items = j.data || j || [];
          return items.map((e: Record<string, unknown>) => {
            const isPublished = e.isPublished as boolean;
            const isLocked = e.isLocked as boolean;
            let status = 'draft';
            if (isLocked) status = 'locked';
            else if (isPublished) status = 'published';
            else if (e.date) {
              const examDate = new Date(e.date as string);
              const now = new Date();
              status = examDate > now ? 'active' : 'draft';
            }
            return {
              id: e.id,
              name: e.name as string,
              subject: (e.subject as Record<string, unknown>)?.name || '—',
              class: (e.class as Record<string, unknown>)?.name || '—',
              type: e.type as string || 'assessment',
              totalMarks: (e.totalMarks as number) || 100,
              status,
              date: e.date as string || null,
              term: (e.term as Record<string, unknown>)?.name || null,
              teacher: (e.teacher as Record<string, unknown>)?.user
                ? ((e.teacher as Record<string, unknown>).user as Record<string, unknown>).name as string
                : null,
              passingMarks: (e.passingMarks as number) || 50,
              duration: e.duration as number || null,
              scoresCount: ((e._count as Record<string, unknown>)?.scores as number) || 0,
            };
          });
        });
      setExams(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create exam');
    } finally {
      setAdding(false);
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
  ], []);

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GraduationCap className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view exams</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="size-12 text-destructive opacity-60" />
        <p className="mt-3 text-sm font-medium">Failed to load exams</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Create Exam
            </Button>
          </DialogTrigger>
          <DialogContent data-exam-dialog className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Exam</DialogTitle>
              <DialogDescription>Set up a new examination or test.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateExam(); }}>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" placeholder="e.g. Mid-Term Exam" required />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select name="subjectId" required>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select name="classId" required>
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
                    <Select name="type" defaultValue="assessment">
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Total Score</Label>
                    <Input name="totalMarks" placeholder="100" type="number" defaultValue="100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Passing Score</Label>
                    <Input name="passingMarks" placeholder="50" type="number" defaultValue="50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Exam Date</Label>
                    <Input name="date" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (mins)</Label>
                    <Input name="duration" placeholder="60" type="number" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={adding}>
                  {adding && <Loader2 className="size-4 animate-spin mr-1" />}
                  Create
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
    </motion.div>
  );
}
