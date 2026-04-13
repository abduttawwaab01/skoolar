'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, BookOpen, Loader2, GraduationCap } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface SubjectRecord {
  id: string;
  name: string;
  code: string | null;
  type: string;
  description: string | null;
  classesCount: number;
  examsCount: number;
}

const typeColors: Record<string, string> = {
  core: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  elective: 'bg-violet-100 text-violet-700 border-violet-200',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

const columns: ColumnDef<SubjectRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Subject Name',
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => (
      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
        {row.original.code || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge className={(typeColors[row.original.type] || '') + ' text-xs border capitalize'}>
        {row.original.type}
      </Badge>
    ),
  },
  {
    accessorKey: 'classesCount',
    header: 'Classes',
    cell: ({ row }) => <span className="text-sm">{row.original.classesCount}</span>,
  },
  {
    accessorKey: 'examsCount',
    header: 'Exams',
    cell: ({ row }) => <span className="text-sm">{row.original.examsCount}</span>,
  },
];

export function SubjectsView() {
  const { selectedSchoolId } = useAppStore();
  const [subjects, setSubjects] = React.useState<SubjectRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/subjects?schoolId=${selectedSchoolId}&limit=100`)
      .then(res => res.json())
      .then(json => {
        const items = json.data || json || [];
        setSubjects(items.map((s: Record<string, unknown>) => ({
          id: s.id,
          name: s.name,
          code: s.code || null,
          type: s.type || 'core',
          description: s.description || null,
          classesCount: ((s._count as Record<string, unknown>)?.classes as number) || 0,
          examsCount: ((s._count as Record<string, unknown>)?.exams as number) || 0,
        })));
      })
      .catch(() => {
        toast.error('Failed to load subjects');
        setSubjects([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const handleAddSubject = async () => {
    if (!selectedSchoolId) {
      toast.error('No school selected');
      return;
    }

    const dialog = document.querySelector('[data-subject-dialog]');
    if (!dialog) return;
    const form = dialog.querySelector('form') as HTMLFormElement | null;
    if (!form) return;

    const formData = new FormData(form);
    const name = formData.get('name') as string;

    if (!name) {
      toast.error('Subject name is required');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          name,
          code: formData.get('code') || null,
          type: formData.get('type') || 'core',
          description: formData.get('description') || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create subject');

      toast.success('Subject added successfully');
      setAddOpen(false);

      // Refresh
      const refreshed = await fetch(`/api/subjects?schoolId=${selectedSchoolId}&limit=100`)
        .then(r => r.json())
        .then(j => (j.data || j || []).map((s: Record<string, unknown>) => ({
          id: s.id,
          name: s.name,
          code: s.code || null,
          type: s.type || 'core',
          description: s.description || null,
          classesCount: ((s._count as Record<string, unknown>)?.classes as number) || 0,
          examsCount: ((s._count as Record<string, unknown>)?.exams as number) || 0,
        })));
      setSubjects(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add subject');
    } finally {
      setAdding(false);
    }
  };

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GraduationCap className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view subjects</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h2 className="text-lg font-semibold">Subjects</h2>
          <p className="text-sm text-muted-foreground">{subjects.length} subjects configured</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent data-subject-dialog>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="size-5" />
                Add New Subject
              </DialogTitle>
              <DialogDescription>Configure a new subject for the school.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleAddSubject(); }}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Subject Name</Label>
                  <Input name="name" placeholder="e.g. French" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Subject Code</Label>
                    <Input name="code" placeholder="e.g. FRE" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue="core">
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">Core</SelectItem>
                        <SelectItem value="elective">Elective</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input name="description" placeholder="Optional description" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={adding}>
                  {adding && <Loader2 className="size-4 animate-spin mr-1" />}
                  Add Subject
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable
          columns={columns}
          data={subjects}
          searchKey="name"
          searchPlaceholder="Search subjects..."
          emptyMessage="No subjects found."
        />
      </motion.div>

      {subjects.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <BookOpen className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No subjects configured yet</p>
        </div>
      )}
    </motion.div>
  );
}
