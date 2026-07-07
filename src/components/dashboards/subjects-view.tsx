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
import { Plus, BookOpen, Loader2, GraduationCap, Zap, Pencil, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const NIGERIAN_SUBJECTS = [
  { name: 'Mathematics', code: 'MTH', type: 'core' },
  { name: 'English Language', code: 'ENG', type: 'core' },
  { name: 'Basic Science', code: 'BSC', type: 'core' },
  { name: 'Basic Technology', code: 'BTC', type: 'core' },
  { name: 'Social Studies', code: 'SST', type: 'core' },
  { name: 'Religious Studies', code: 'CRS', type: 'core' },
  { name: 'Islamic Studies', code: 'IRS', type: 'core' },
  { name: ' Yoruba', code: 'YOR', type: 'elective' },
  { name: 'Hausa', code: 'HAU', type: 'elective' },
  { name: 'Igbo', code: 'IGB', type: 'elective' },
  { name: 'French', code: 'FRE', type: 'elective' },
  { name: 'Arabic', code: 'ARA', type: 'elective' },
  { name: 'Physics', code: 'PHY', type: 'core' },
  { name: 'Chemistry', code: 'CHM', type: 'core' },
  { name: 'Biology', code: 'BIO', type: 'core' },
  { name: 'Agricultural Science', code: 'AGS', type: 'elective' },
  { name: 'Technical Drawing', code: 'TDR', type: 'elective' },
  { name: 'Computer Studies', code: 'COM', type: 'elective' },
  { name: 'Commerce', code: 'COM', type: 'elective' },
  { name: ' Economics', code: 'ECO', type: 'elective' },
  { name: 'Geography', code: 'GEO', type: 'elective' },
  { name: 'Government', code: 'GOV', type: 'elective' },
  { name: 'Literature', code: 'LIT', type: 'elective' },
  { name: 'History', code: 'HIS', type: 'elective' },
  { name: 'Fine Art', code: 'ART', type: 'elective' },
  { name: 'Music', code: 'MUS', type: 'elective' },
  { name: 'Physical Education', code: 'PE', type: 'elective' },
  { name: 'Home Economics', code: 'HEC', type: 'elective' },
];

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
      <div className="flex items-center justify-between flex-wrap gap-4">
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
        {row.original.code || 'â€”'}
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
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [subjects, setSubjects] = React.useState<SubjectRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editSubject, setEditSubject] = React.useState<SubjectRecord | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/subjects?schoolId=${schoolId}&limit=100`);
        const json = await res.json();
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
      } catch {
        toast.error('Failed to load subjects');
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId]);

  const [populating, setPopulating] = React.useState(false);

  const populateNigerianSubjects = async () => {
    if (!schoolId) return;
    setPopulating(true);
    try {
      const existingNames = new Set(subjects.map(s => s.name.toLowerCase()));
      const toCreate = NIGERIAN_SUBJECTS.filter(sub => !existingNames.has(sub.name.toLowerCase()));
      
      if (toCreate.length === 0) {
        toast.info('All Nigerian subjects already exist');
        return;
      }
      
      const created: string[] = [];
      for (const sub of toCreate) {
        const res = await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId, ...sub }),
        });
        if (res.ok) created.push(sub.name);
      }
      toast.success(`${created.length} Nigerian subjects added (${toCreate.length - created.length} already existed)`);
      // Refresh
      const refreshedRes = await fetch(`/api/subjects?schoolId=${schoolId}&limit=100`);
      const refreshedJson = await refreshedRes.json();
      const refreshed = (refreshedJson.data || refreshedJson || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        code: s.code || null,
        type: s.type || 'core',
        description: s.description || null,
        classesCount: ((s._count as Record<string, unknown>)?.classes as number) || 0,
        examsCount: ((s._count as Record<string, unknown>)?.exams as number) || 0,
      }));
      setSubjects(refreshed);
    } catch (err) {
      toast.error('Failed to populate subjects');
    } finally {
      setPopulating(false);
    }
  };

const handleAddSubject = async () => {
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
          schoolId,
          name,
          code: formData.get('code') || null,
          type: formData.get('type') || 'core',
          description: formData.get('description') || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      toast.success('Subject added successfully');
      setAddOpen(false);

      const refreshedRes = await fetch(`/api/subjects?schoolId=${schoolId}&limit=100`);
      const refreshedJson = await refreshedRes.json();
      const refreshed = (refreshedJson.data || refreshedJson || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        code: s.code || null,
        type: s.type || 'core',
        description: s.description || null,
        classesCount: ((s._count as Record<string, unknown>)?.classes as number) || 0,
        examsCount: ((s._count as Record<string, unknown>)?.exams as number) || 0,
      }));
      setSubjects(refreshed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add subject');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editSubject) return;
    setSaving(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const res = await fetch('/api/subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editSubject.id,
          name: formData.get('name'),
          code: formData.get('code') || null,
          type: formData.get('type'),
          description: formData.get('description') || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Subject updated successfully');
      setEditSubject(null);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update subject');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Subject deleted successfully');
      setSubjects(subjects.filter(s => s.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete subject');
    } finally {
      setDeleting(null);
    }
  };

  if (!schoolId) {
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
        className="flex items-center justify-between flex-wrap"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h2 className="text-lg font-semibold">Subjects</h2>
          <p className="text-sm text-muted-foreground">{subjects.length} subjects configured</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={populateNigerianSubjects}
            disabled={populating}
            title="Add Nigerian curriculum subjects"
          >
            {populating ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            Populate Nigerian Subjects
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent data-subject-dialog className="w-[95vw] max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
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
          onRowClick={(subject) => setEditSubject(subject)}
        />
      </motion.div>

      {subjects.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <BookOpen className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No subjects configured yet</p>
        </div>
      )}

      <Dialog open={!!editSubject} onOpenChange={(open) => { if (!open) setEditSubject(null); }}>
        <DialogContent data-subject-dialog className="w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-5" />
              Edit Subject
            </DialogTitle>
            <DialogDescription>Update subject details.</DialogDescription>
          </DialogHeader>
          {editSubject && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateSubject(e); }}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Subject Name</Label>
                  <Input name="name" defaultValue={editSubject.name} required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Subject Code</Label>
                    <Input name="code" defaultValue={editSubject.code || ''} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue={editSubject.type}>
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
                  <Input name="description" defaultValue={editSubject.description || ''} />
                </div>
                <div className="pt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full gap-1">
                        <Trash2 className="size-4" /> Delete Subject
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Subject</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{editSubject.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteSubject(editSubject.id)} className="bg-red-600 hover:bg-red-700">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditSubject(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin mr-1" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

