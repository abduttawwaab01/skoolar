'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Search, Plus, Phone, BookOpen, GraduationCap, Users, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn, hoverScale } from '@/lib/motion-variants';

interface TeacherRecord {
  id: string;
  name: string;
  email: string | null;
  employeeNo: string;
  specialization: string | null;
  qualification: string | null;
  phone: string | null;
  classesCount: number;
  classSubjects: number;
  exams: number;
  comments: number;
  isActive: boolean;
  createdAt: string;
}

const avatarColors = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-sky-500',
];

function getInitials(name: string) {
  return name.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function TeachersView() {
  const { selectedSchoolId } = useAppStore();
  const [teachers, setTeachers] = React.useState<TeacherRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);
  const [detailTeacher, setDetailTeacher] = React.useState<TeacherRecord | null>(null);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/teachers?schoolId=${selectedSchoolId}&limit=100`)
      .then(res => res.json())
      .then(json => {
        const items = json.data || json || [];
        setTeachers(items.map((t: Record<string, unknown>) => ({
          id: t.id,
          name: (t.user as Record<string, unknown>)?.name || '',
          email: (t.user as Record<string, unknown>)?.email || null,
          employeeNo: t.employeeNo || '',
          specialization: t.specialization || null,
          qualification: t.qualification || null,
          phone: t.phone || null,
          classesCount: (t._count as Record<string, unknown>)?.classes as number || 0,
          classSubjects: (t._count as Record<string, unknown>)?.classSubjects as number || 0,
          exams: (t._count as Record<string, unknown>)?.exams as number || 0,
          comments: (t._count as Record<string, unknown>)?.comments as number || 0,
          isActive: t.isActive ?? true,
          createdAt: t.createdAt as string || '',
        })));
      })
      .catch(() => {
        toast.error('Failed to load teachers');
        setTeachers([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.specialization || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleAddTeacher = async () => {
    if (!selectedSchoolId) {
      toast.error('No school selected');
      return;
    }

    const dialog = document.querySelector('[data-teacher-dialog]');
    if (!dialog) return;
    const form = dialog.querySelector('form') as HTMLFormElement | null;
    if (!form) return;

    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const employeeNo = formData.get('employeeNo') as string;

    if (!name || !email || !employeeNo) {
      toast.error('Name, email, and employee number are required');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          name,
          email,
          employeeNo,
          specialization: formData.get('specialization') || null,
          qualification: formData.get('qualification') || null,
          phone: formData.get('phone') || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create teacher');

      toast.success('Teacher added successfully');
      setAddOpen(false);

      // Refresh
      const refreshed = await fetch(`/api/teachers?schoolId=${selectedSchoolId}&limit=100`)
        .then(r => r.json())
        .then(j => (j.data || j || []).map((t: Record<string, unknown>) => ({
          id: t.id,
          name: (t.user as Record<string, unknown>)?.name || '',
          email: (t.user as Record<string, unknown>)?.email || null,
          employeeNo: t.employeeNo || '',
          specialization: t.specialization || null,
          qualification: t.qualification || null,
          phone: t.phone || null,
          classesCount: (t._count as Record<string, unknown>)?.classes as number || 0,
          classSubjects: (t._count as Record<string, unknown>)?.classSubjects as number || 0,
          exams: (t._count as Record<string, unknown>)?.exams as number || 0,
          comments: (t._count as Record<string, unknown>)?.comments as number || 0,
          isActive: t.isActive ?? true,
          createdAt: t.createdAt as string || '',
        })));
      setTeachers(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add teacher');
    } finally {
      setAdding(false);
    }
  };

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GraduationCap className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view teachers</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div 
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        variants={slideUp}
      >
        <div>
          <h2 className="text-lg font-semibold">Teachers</h2>
          <p className="text-sm text-muted-foreground">{teachers.length} teachers on staff</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent data-teacher-dialog>
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>Enter the teacher&apos;s details below.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); handleAddTeacher(); }}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Full Name</Label>
                    <Input name="name" placeholder="Enter teacher name" required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" placeholder="teacher@school.com" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Employee No</Label>
                      <Input name="employeeNo" placeholder="e.g. TCH-001" required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Phone Number</Label>
                      <Input name="phone" placeholder="+234-..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Subject / Specialization</Label>
                      <Input name="specialization" placeholder="e.g. Mathematics" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Qualification</Label>
                      <Input name="qualification" placeholder="e.g. B.Ed" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={adding}>
                    {adding && <Loader2 className="size-4 animate-spin mr-1" />}
                    Add Teacher
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <motion.div 
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        variants={staggerContainer}
      >
        <AnimatePresence>
          {filtered.map((teacher, idx) => (
            <motion.div
              key={teacher.name}
              variants={scaleIn}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setDetailTeacher(teacher)}
            >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm',
                    avatarColors[idx % avatarColors.length]
                  )}
                >
                  {getInitials(teacher.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{teacher.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{teacher.specialization || 'No specialization'}</p>
                  <p className="text-xs text-muted-foreground">{teacher.employeeNo}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {teacher.classesCount} {teacher.classesCount === 1 ? 'class' : 'classes'}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {teacher.classSubjects} {teacher.classSubjects === 1 ? 'subject' : 'subjects'}
                </Badge>
                <Badge variant={teacher.isActive ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                  {teacher.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t text-xs text-muted-foreground">
                <Users className="size-3.5" />
                <span>{teacher.exams} exams created</span>
              </div>
            </CardContent>
            </Card>
          </motion.div>
        ))}
        </AnimatePresence>
      </motion.div>

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <GraduationCap className="size-10 opacity-40" />
          <p className="mt-2 text-sm">{search ? 'No teachers match your search' : 'No teachers found'}</p>
        </div>
      )}

      <Dialog open={!!detailTeacher} onOpenChange={() => setDetailTeacher(null)}>
        <DialogContent className="max-w-md">
          {detailTeacher && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm',
                    avatarColors[teachers.indexOf(detailTeacher) % avatarColors.length]
                  )}>
                    {getInitials(detailTeacher.name)}
                  </div>
                  {detailTeacher.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Employee No</span>
                    <p className="font-medium">{detailTeacher.employeeNo}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Specialization</span>
                    <p className="font-medium flex items-center gap-1.5">
                      <BookOpen className="size-3.5" />
                      {detailTeacher.specialization || '—'}
                    </p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Qualification</span>
                    <p className="font-medium">{detailTeacher.qualification || '—'}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <p className="font-medium flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {detailTeacher.phone || '—'}
                    </p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-medium text-xs">{detailTeacher.email || '—'}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={detailTeacher.isActive ? 'default' : 'secondary'}>
                      {detailTeacher.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold">{detailTeacher.classesCount}</p>
                    <p className="text-xs text-muted-foreground">Classes</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold">{detailTeacher.classSubjects}</p>
                    <p className="text-xs text-muted-foreground">Subjects</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold">{detailTeacher.exams}</p>
                    <p className="text-xs text-muted-foreground">Exams</p>
                  </Card>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
