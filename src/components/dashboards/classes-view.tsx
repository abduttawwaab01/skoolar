'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Users, UserCheck, Loader2, GraduationCap } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface ClassRecord {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
  capacity: number;
  classTeacherName: string | null;
  studentCount: number;
  subjectsCount: number;
  examsCount: number;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function ClassesView() {
  const { selectedSchoolId } = useAppStore();
  const [classes, setClasses] = React.useState<ClassRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [selectedClass, setSelectedClass] = React.useState<ClassRecord | null>(null);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/classes?schoolId=${selectedSchoolId}&limit=100`)
      .then(res => res.json())
      .then(json => {
        const items = json.data || json || [];
        setClasses(items.map((c: Record<string, unknown>) => ({
          id: c.id,
          name: c.name,
          section: c.section || null,
          grade: c.grade || null,
          capacity: (c.capacity as number) || 40,
          classTeacherName: (c.classTeacher as Record<string, unknown>)?.user
            ? ((c.classTeacher as Record<string, unknown>).user as Record<string, unknown>).name as string
            : null,
          studentCount: ((c._count as Record<string, unknown>)?.students as number) || 0,
          subjectsCount: ((c._count as Record<string, unknown>)?.subjects as number) || 0,
          examsCount: ((c._count as Record<string, unknown>)?.exams as number) || 0,
        })));
      })
      .catch(() => {
        toast.error('Failed to load classes');
        setClasses([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const handleAddClass = async () => {
    if (!selectedSchoolId) {
      toast.error('No school selected');
      return;
    }

    const dialog = document.querySelector('[data-class-dialog]');
    if (!dialog) return;
    const form = dialog.querySelector('form') as HTMLFormElement | null;
    if (!form) return;

    const formData = new FormData(form);
    const name = formData.get('name') as string;

    if (!name) {
      toast.error('Class name is required');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          name,
          section: formData.get('section') || null,
          grade: formData.get('grade') || null,
          capacity: parseInt(formData.get('capacity') as string) || 40,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create class');

      toast.success('Class created successfully');
      setAddOpen(false);

      // Refresh
      const refreshed = await fetch(`/api/classes?schoolId=${selectedSchoolId}&limit=100`)
        .then(r => r.json())
        .then(j => (j.data || j || []).map((c: Record<string, unknown>) => ({
          id: c.id,
          name: c.name,
          section: c.section || null,
          grade: c.grade || null,
          capacity: (c.capacity as number) || 40,
          classTeacherName: (c.classTeacher as Record<string, unknown>)?.user
            ? ((c.classTeacher as Record<string, unknown>).user as Record<string, unknown>).name as string
            : null,
          studentCount: ((c._count as Record<string, unknown>)?.students as number) || 0,
          subjectsCount: ((c._count as Record<string, unknown>)?.subjects as number) || 0,
          examsCount: ((c._count as Record<string, unknown>)?.exams as number) || 0,
        })));
      setClasses(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create class');
    } finally {
      setAdding(false);
    }
  };

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GraduationCap className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view classes</p>
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
          <h2 className="text-lg font-semibold">Classes</h2>
          <p className="text-sm text-muted-foreground">{classes.length} classes configured</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent data-class-dialog>
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription>Configure a new class section.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleAddClass(); }}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Class Name</Label>
                    <Input name="name" placeholder="e.g. JSS 1" required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Section</Label>
                    <Select name="section">
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Grade</Label>
                    <Input name="grade" placeholder="e.g. JSS 1" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Capacity</Label>
                    <Input name="capacity" type="number" placeholder="40" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={adding}>
                  {adding && <Loader2 className="size-4 animate-spin mr-1" />}
                  Create Class
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div 
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {classes.map((cls, idx) => {
          const pct = Math.round((cls.studentCount / cls.capacity) * 100);
          return (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.02 }}
            >
              <Card
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedClass(cls)}
              >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{cls.name}</h3>
                    {cls.section && (
                      <p className="text-xs text-muted-foreground">Section {cls.section}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {cls.studentCount} students
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="size-3" />
                      Capacity
                    </span>
                    <span className="font-medium">{cls.studentCount}/{cls.capacity}</span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className="h-1.5" />
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                  {cls.classTeacherName ? (
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="size-3.5" />
                      {cls.classTeacherName}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <UserCheck className="size-3.5" />
                      Unassigned
                    </span>
                  )}
                  <span>{cls.subjectsCount} subjects</span>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {classes.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <GraduationCap className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No classes configured yet</p>
        </div>
      )}

      <Dialog open={!!selectedClass} onOpenChange={() => setSelectedClass(null)}>
        <DialogContent className="max-w-md">
          {selectedClass && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedClass.name}{selectedClass.section ? ` - Section ${selectedClass.section}` : ''}</DialogTitle>
                <DialogDescription>
                  {selectedClass.classTeacherName
                    ? `Class Teacher: ${selectedClass.classTeacherName}`
                    : 'No class teacher assigned'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold">{selectedClass.studentCount}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold">{selectedClass.subjectsCount}</p>
                    <p className="text-xs text-muted-foreground">Subjects</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold">{selectedClass.examsCount}</p>
                    <p className="text-xs text-muted-foreground">Exams</p>
                  </Card>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Capacity</span>
                    <span className="font-medium">{selectedClass.capacity}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Occupancy</span>
                    <span className="font-medium">{Math.round((selectedClass.studentCount / selectedClass.capacity) * 100)}%</span>
                  </div>
                  <Progress value={Math.min(Math.round((selectedClass.studentCount / selectedClass.capacity) * 100), 100)} className="h-2" />
                  {selectedClass.grade && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Grade</span>
                      <span className="font-medium">{selectedClass.grade}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
