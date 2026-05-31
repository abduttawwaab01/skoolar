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
import { FileUploader } from '@/components/ui/file-uploader';
import { Plus, User, Users, GraduationCap, BookOpen, BarChart3, CalendarCheck, Loader2, FileUp, Download, Pencil, Trash2, Camera, MessageCircle, Crown, ArrowRight, AlertTriangle } from 'lucide-react';
  import { useAppStore } from '@/store/app-store';
  import { toast } from 'sonner';
  import { useStudents, useClasses, useCreateStudent } from '@/hooks/use-api';
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
  import { MessageUserDialog } from '@/components/shared/message-user-dialog';

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
  userId?: string;
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
    <span className="text-xs font-mono truncate max-w-[100px]">{row.original.admissionNo}</span>
  ),
},
{
  accessorKey: 'name',
  header: 'Name',
  cell: ({ row }) => <span className="text-sm font-medium truncate max-w-[150px]">{row.original.name}</span>,
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
    cell: ({ row }) => <span className="text-sm">{row.original.gender || 'â€”'}</span>,
  },
  {
    accessorKey: 'gpa',
    header: 'GPA',
    cell: ({ row }) => (
      <span className={row.original.gpa != null && row.original.gpa >= 4.0 ? 'text-emerald-600 font-semibold' : 'text-sm'}>
        {row.original.gpa != null ? row.original.gpa.toFixed(1) : 'â€”'}
      </span>
    ),
  },
  {
    accessorKey: 'behaviorScore',
    header: 'Behavior',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.behaviorScore != null ? `${row.original.behaviorScore}/100` : 'â€”'}</span>
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
  const { currentUser, currentRole } = useAppStore();
  const isAdmin = currentRole === 'SCHOOL_ADMIN' || currentRole === 'SUPER_ADMIN';
  const [classFilter, setClassFilter] = React.useState('all');
  const [addOpen, setAddOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [detailStudent, setDetailStudent] = React.useState<StudentRecord | null>(null);
  const [editStudent, setEditStudent] = React.useState<StudentRecord | null>(null);
  const [bulkFile, setBulkFile] = React.useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [photoUrl, setPhotoUrl] = React.useState('');
  const [editPhotoUrl, setEditPhotoUrl] = React.useState('');
  const [messageOpen, setMessageOpen] = React.useState(false);
  const [messageUser, setMessageUser] = React.useState<{id:string, name:string, role:string} | null>(null);
  const [upgradeDialog, setUpgradeDialog] = React.useState<{ open: boolean; maxStudents: number; currentCount: number }>({ open: false, maxStudents: 0, currentCount: 0 });

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
        userId: s.userId as string,
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
    const password = formData.get('password') as string;
    
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Pre-check plan limit before submission
    const schoolId = currentUser.schoolId;
    if (schoolId) {
      try {
        const schoolRes = await fetch(`/api/schools/${schoolId}`);
        if (schoolRes.ok) {
          const schoolJson = await schoolRes.json();
          const schoolData = schoolJson.data || schoolJson;
          const plan = schoolData.subscriptionPlan;
          const maxStudents = plan?.maxStudents ?? schoolData.maxStudents ?? 500;
          const currentCount = schoolData._count?.students ?? 0;

          if (maxStudents !== -1 && currentCount >= maxStudents) {
            setUpgradeDialog({ open: true, maxStudents, currentCount });
            return;
          }
        }
      } catch {
        // Silently continue - backend will enforce limit if frontend check fails
      }
    }
    
    try {
      await createStudent.mutateAsync({
        schoolId,
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        password,
        admissionNo: formData.get('admissionNo') as string,
        classId: formData.get('classId') || null,
        gender: formData.get('gender') || null,
        photo: photoUrl || null,
      });
      toast.success('Student added successfully');
      setAddOpen(false);
      setPhotoUrl('');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add student';
      // If backend rejects due to plan limit, show upgrade dialog
      if (errorMsg.toLowerCase().includes('plan')) {
        if (schoolId) {
          try {
            const sRes = await fetch(`/api/schools/${schoolId}`);
            if (sRes.ok) {
              const sJson = await sRes.json();
              const sData = sJson.data || sJson;
              const plan = sData.subscriptionPlan;
              const maxS = plan?.maxStudents ?? sData.maxStudents ?? 500;
              const currC = sData._count?.students ?? 0;
              setUpgradeDialog({ open: true, maxStudents: maxS, currentCount: currC });
            }
          } catch {}
        }
        return;
      }
      toast.error(errorMsg);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editStudent) return;
    setSaving(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const res = await fetch(`/api/students/${editStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          classId: formData.get('classId') || null,
          gender: formData.get('gender') || null,
          isActive: formData.get('isActive') === 'true',
          photo: editPhotoUrl || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Student updated successfully');
      setEditStudent(null);
      setDetailStudent(null);
      window.location.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Student deleted successfully');
      setDetailStudent(null);
      window.location.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete student');
    }
  };

  const downloadTemplate = () => {
    const headers = ['Name', 'Email', 'Password', 'AdmissionNo', 'ClassID', 'Gender'];
    const example = ['John Doe', 'john@school.com', 'pass123', 'SCH/2026/001', 'class_id_here', 'Male'];
    const csvContent = [headers, example].map(e => e.join(",")).join("\n") + "\n# Skoolar - Odebunmi Tawwāb";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "students_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) { toast.error('Please select a file'); return; }
    setBulkLoading(true);
    try {
      const text = await bulkFile.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) throw new Error('File is empty or missing data');
      
      // Parse CSV with proper quoting support
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
      
      // Build class name → ID map
      const classMap: Record<string, string> = {};
      classes.forEach(c => { classMap[c.name.toLowerCase()] = c.id; });

      const students = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        headers.forEach((h, i) => {
          if (h === 'name') obj.name = values[i];
          if (h === 'email') obj.email = values[i];
          if (h === 'password') obj.password = values[i];
          if (h === 'admissionno') obj.admissionNo = values[i];
          if (h === 'classid') obj.classId = values[i];
          if (h === 'gender') obj.gender = values[i];
        });
        // Resolve class name to ID if value looks like a name, not a UUID
        if (obj.classId && !obj.classId.includes('-') && classMap[obj.classId.toLowerCase()]) {
          obj.classId = classMap[obj.classId.toLowerCase()];
        }
        // Auto-generate missing fields
        if (!obj.email && obj.name) {
          obj.email = `${obj.name.toLowerCase().replace(/\s+/g, '.')}@school.local`;
        }
        if (!obj.password) {
          obj.password = 'skoolar123';
        }
        return obj;
      }).filter(s => s.name && s.admissionNo);

      const res = await fetch('/api/students?action=bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students, schoolId: currentUser.schoolId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      
      toast.success(json.message);
      setBulkOpen(false);
      setBulkFile(null);
      window.location.reload(); 
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload students');
    } finally {
      setBulkLoading(false);
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
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter by class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {isAdmin && (
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-emerald-200 hover:bg-emerald-50 text-emerald-700">
                <FileUp className="size-4" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Student Upload</DialogTitle>
                <DialogDescription>Add multiple students at once using a CSV file.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>1. Download Template</Label>
                  <Button variant="ghost" size="sm" onClick={downloadTemplate} className="w-full justify-start text-xs text-blue-600 hover:bg-blue-50">
                    <Download className="size-3.5 mr-2" /> Download CSV Template
                  </Button>
                  <p className="text-[10px] text-muted-foreground px-1">Tip: Use class IDs from the dashboard if assigning classes.</p>
                </div>
                <div className="space-y-2">
                  <Label>2. Upload File</Label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-emerald-300 transition-colors cursor-pointer relative">
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={(e) => { setBulkFile(e.target.files?.[0] || null); e.target.value = ''; }}
                    />
                    {bulkFile ? (
                      <div className="text-emerald-600 font-medium flex items-center justify-center gap-2">
                         <BookOpen className="size-5" /> {bulkFile.name}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <FileUp className="size-8 text-gray-300 mx-auto" />
                        <p className="text-sm text-gray-500">Click or drag CSV file here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setBulkOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={handleBulkUpload} disabled={bulkLoading || !bulkFile} className="w-full sm:w-auto">
                  {bulkLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <FileUp className="size-4 mr-2" />}
                  Start Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}

          {isAdmin && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent data-student-dialog className="w-[95vw] max-h-[90vh] overflow-y-auto">
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
                    <Label>Password</Label>
                    <Input name="password" type="password" placeholder="Login password" required />
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
                <div className="grid gap-2">
                  <Label>Photo</Label>
                  <FileUploader
                    value={photoUrl}
                    onChange={(url) => setPhotoUrl(url)}
                    folder="avatars"
                    accept="image/*"
                    maxSizeMB={5}
                    compress
                    placeholder="Upload student photo (auto-compressed)"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setAddOpen(false); setPhotoUrl(''); }}>Cancel</Button>
                  <Button type="submit" disabled={createStudent.isPending}>
                    {createStudent.isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                    Add Student
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}
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
        <DialogContent className="w-[95vw] max-w-lg">
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
                    <p className="font-medium">{detailStudent.gender || 'â€”'}</p>
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
                    <p className="text-lg font-bold mt-1">{detailStudent.gpa != null ? detailStudent.gpa.toFixed(1) : 'â€”'}</p>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GraduationCap className="size-3.5" />
                      Behavior
                    </div>
                    <p className="text-lg font-bold mt-1">{detailStudent.behaviorScore != null ? `${detailStudent.behaviorScore}/100` : 'â€”'}</p>
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
              <div className="flex justify-end gap-2 pt-4 border-t">
                {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1">
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Student</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {detailStudent.name}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteStudent(detailStudent.id)} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                )}
                {isAdmin && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setEditStudent(detailStudent); setDetailStudent(null); }}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
                )}
                {detailStudent.userId && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setMessageUser({ id: detailStudent.userId!, name: detailStudent.name, role: 'STUDENT' });
                    setMessageOpen(true);
                  }}
                >
                  <MessageCircle className="size-3.5" /> Message
                </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <MessageUserDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        targetUser={messageUser}
      />

      {/* Plan Upgrade Dialog */}
      <Dialog open={upgradeDialog.open} onOpenChange={(open) => setUpgradeDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="size-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle>Student Limit Reached</DialogTitle>
                <DialogDescription>Your current plan has a limit on the number of students.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Users className="size-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Students</p>
                  <p className="text-xs text-muted-foreground">Current usage</p>
                </div>
              </div>
              <p className="text-lg font-bold">{upgradeDialog.currentCount} / {upgradeDialog.maxStudents === -1 ? '∞' : upgradeDialog.maxStudents}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <Crown className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Upgrade to continue adding students</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Your current plan allows a maximum of {upgradeDialog.maxStudents} student{upgradeDialog.maxStudents !== 1 ? 's' : ''}.
                    Upgrade to a higher plan to add more students and unlock additional features.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setUpgradeDialog({ open: false, maxStudents: 0, currentCount: 0 })}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={() => {
                setUpgradeDialog({ open: false, maxStudents: 0, currentCount: 0 });
                useAppStore.getState().setCurrentView('subscription' as any);
              }}
            >
              <Crown className="size-4" />
              Upgrade Plan
              <ArrowRight className="size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editStudent} onOpenChange={(open) => { if (!open) setEditStudent(null); }}>
        <DialogContent data-student-dialog className="w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update the student&apos;s details below.</DialogDescription>
          </DialogHeader>
          {editStudent && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateStudent(e); }}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Full Name</Label>
                  <Input name="name" defaultValue={editStudent.name} required />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={editStudent.email || ''} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Class</Label>
                    <Select name="classId" defaultValue={editStudent.classId || ''}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Gender</Label>
                    <Select name="gender" defaultValue={editStudent.gender || ''}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select name="isActive" defaultValue={editStudent.isActive ? 'true' : 'false'}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Photo</Label>
                  <FileUploader
                    value={editPhotoUrl}
                    onChange={(url) => setEditPhotoUrl(url)}
                    folder="avatars"
                    accept="image/*"
                    maxSizeMB={5}
                    compress
                    placeholder="Upload new photo (auto-compressed)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditStudent(null); setEditPhotoUrl(''); }}>Cancel</Button>
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

