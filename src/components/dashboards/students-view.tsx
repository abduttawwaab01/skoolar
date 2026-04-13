'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn, hoverScale } from '@/lib/motion-variants';
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
import { Progress } from '@/components/ui/progress';
import { Plus, User, GraduationCap, BookOpen, BarChart3, CalendarCheck, Loader2 } from 'lucide-react';
 import { useAppStore } from '@/store/app-store';
 import { toast } from 'sonner';
 import { useStudents, useClasses, useCreateStudent } from '@/hooks/use-api';

interface StudentRecord {
  id: string;
  admissionNo: string;
  name: string;
  className: string;
  gender: string | null;
  gpa: number | null;
  behaviorScore: number | null;
  email: string | null;
  phone: string | null;
  classId: string | null;
  isActive: boolean;
}

interface ClassRecord {
  id: string;
  name: string;
}

const columns: ColumnDef<StudentRecord>[] = [
  {
    accessorKey: 'admissionNo',
    header: 'Admission No',
    cell: ({ row }) => (
      <span className="text-xs font-mono">{row.original.admissionNo}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'className',
    header: 'Class',
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">{row.original.className || 'Unassigned'}</Badge>
    ),
  },
  {
    accessorKey: 'gender',
    header: 'Gender',
    cell: ({ row }) => <span className="text-sm">{row.original.gender || '—'}</span>,
  },
  {
    accessorKey: 'gpa',
    header: 'GPA',
    cell: ({ row }) => (
      <span className={row.original.gpa != null && row.original.gpa >= 4.0 ? 'text-emerald-600 font-semibold' : 'text-sm'}>
        {row.original.gpa != null ? row.original.gpa.toFixed(1) : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'behaviorScore',
    header: 'Behavior',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.behaviorScore != null ? `${row.original.behaviorScore}/100` : '—'}</span>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => (
      <StatusBadge variant={row.original.isActive ? 'success' : 'warning'} size="sm">
        {row.original.isActive ? 'Active' : 'Inactive'}
      </StatusBadge>
    ),
  },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-[150px]" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function StudentsView() {
  const { currentUser } = useAppStore();
  const [classFilter, setClassFilter] = React.useState('all');
  const [addOpen, setAddOpen] = React.useState(false);
  const [detailStudent, setDetailStudent] = React.useState<StudentRecord | null>(null);

  const { data: studentsData, isLoading } = useStudents({ limit: 100 });
  const { data: classesData } = useClasses();
  const createStudent = useCreateStudent();

  const students: StudentRecord[] = React.useMemo(() => {
    if (!studentsData?.data) return [];
    return (studentsData.data as unknown[]).map((item) => {
      const s = item as Record<string, unknown>;
      return {
        id: s.id as string,
        admissionNo: (s.admissionNo as string) || '',
        name: ((s.user as Record<string, unknown>)?.name as string) || '',
        className: ((s.class as Record<string, unknown>)?.name as string) || 'Unassigned',
        gender: s.gender as string | null,
        gpa: s.gpa as number | null,
        behaviorScore: s.behaviorScore as number | null,
        email: ((s.user as Record<string, unknown>)?.email as string) || null,
        phone: ((s.user as Record<string, unknown>)?.phone as string) || null,
        classId: s.classId as string | null,
        isActive: s.isActive as boolean ?? true,
      };
    });
  }, [studentsData]);

  const classes: ClassRecord[] = React.useMemo(() => {
    if (!classesData?.data) return [];
    return (classesData.data as unknown[]).map((item) => {
      const c = item as Record<string, unknown>;
      return {
        id: c.id as string,
        name: c.name as string,
      };
    });
  }, [classesData]);

  const filtered = classFilter === 'all'
    ? students
    : students.filter(s => s.className === classFilter);

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    try {
      await createStudent.mutateAsync({
        schoolId: currentUser.schoolId,
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        admissionNo: formData.get('admissionNo') as string,
        classId: formData.get('classId') || null,
        gender: formData.get('gender') || null,
      });
      toast.success('Student added successfully');
      setAddOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add student');
    }
  };

  if (!currentUser.schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GraduationCap className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view students</p>
      </div>
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div 
        className="flex items-center justify-between"
        variants={slideUp}
      >
        <div>
          <h2 className="text-lg font-semibold">Students</h2>
          <p className="text-sm text-muted-foreground">{students.length} total students enrolled</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent data-student-dialog>
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>Enter the student&apos;s details below.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); handleAddStudent(e); }}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Full Name</Label>
                    <Input name="name" placeholder="Enter student name" required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" placeholder="student@school.com" required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Admission No</Label>
                    <Input name="admissionNo" placeholder="e.g. GFA/2025/013" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Class</Label>
                      <Select name="classId">
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Gender</Label>
                      <Select name="gender">
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createStudent.isPending}>
                    {createStudent.isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                    Add Student
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <motion.div
        variants={slideUp}
      >
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="name"
          searchPlaceholder="Search students..."
          emptyMessage="No students found."
          onRowClick={(student) => setDetailStudent(student)}
        />
      </motion.div>

      <Dialog open={!!detailStudent} onOpenChange={() => setDetailStudent(null)}>
        <DialogContent className="max-w-lg">
          {detailStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="size-5" />
                  {detailStudent.name}
                </DialogTitle>
                <DialogDescription>{detailStudent.admissionNo}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Class</span>
                    <p className="font-medium">{detailStudent.className}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Gender</span>
                    <p className="font-medium">{detailStudent.gender || '—'}</p>
                  </div>
                  {detailStudent.email && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <p className="font-medium text-xs">{detailStudent.email}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BarChart3 className="size-3.5" />
                      GPA
                    </div>
                    <p className="text-lg font-bold mt-1">{detailStudent.gpa != null ? detailStudent.gpa.toFixed(1) : '—'}</p>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GraduationCap className="size-3.5" />
                      Behavior
                    </div>
                    <p className="text-lg font-bold mt-1">{detailStudent.behaviorScore != null ? `${detailStudent.behaviorScore}/100` : '—'}</p>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BookOpen className="size-3.5" />
                      Status
                    </div>
                    <StatusBadge variant={detailStudent.isActive ? 'success' : 'warning'} size="sm">
                      {detailStudent.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarCheck className="size-3.5" />
                      Class
                    </div>
                    <p className="text-sm font-bold mt-1">{detailStudent.className}</p>
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
