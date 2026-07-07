'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { FileUploader } from '@/components/ui/file-uploader';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Phone, BookOpen, GraduationCap, Users, Loader2, Pencil, Trash2, Camera, MessageCircle, X, Crown, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAppStore, type DashboardView } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn, hoverScale } from '@/lib/motion-variants';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MessageUserDialog } from '@/components/shared/message-user-dialog';

interface TeacherRecord {
  id: string;
  userId: string;
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
  dateOfJoining: string | null;
  gender: string | null;
  address: string | null;
  salary: number | null;
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
      <div className="flex items-center justify-between flex-wrap gap-4">
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
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [teachers, setTeachers] = React.useState<TeacherRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);
  const [detailTeacher, setDetailTeacher] = React.useState<TeacherRecord | null>(null);
  const [editTeacher, setEditTeacher] = React.useState<TeacherRecord | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [upgradeDialog, setUpgradeDialog] = React.useState<{ open: boolean; maxTeachers: number; currentCount: number }>({ open: false, maxTeachers: 0, currentCount: 0 });
  const [photoUrl, setPhotoUrl] = React.useState('');
  const [editPhotoUrl, setEditPhotoUrl] = React.useState('');
  const [messageOpen, setMessageOpen] = React.useState(false);
  const [messageUser, setMessageUser] = React.useState<{id:string, name:string, role:string} | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(50);
  const [totalTeachers, setTotalTeachers] = React.useState(0);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [detailClasses, setDetailClasses] = React.useState<{ id: string; name: string; section: string | null }[]>([]);
  const [detailSubjects, setDetailSubjects] = React.useState<{ subject: { name: string }; class: { name: string } }[]>([]);

  // Class/subject assignment state
  const [classList, setClassList] = React.useState<{ id: string; name: string }[]>([]);
  const [subjectList, setSubjectList] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedClassIds, setSelectedClassIds] = React.useState<string[]>([]);
  const [subjectAssignments, setSubjectAssignments] = React.useState<{ classId: string; subjectId: string }[]>([]);
  const [editSelectedClassIds, setEditSelectedClassIds] = React.useState<string[]>([]);
  const [editSubjectAssignments, setEditSubjectAssignments] = React.useState<{ classId: string; subjectId: string }[]>([]);

  // Fetch classes and subjects for assignment dropdowns
  const fetchClassSubjectOptions = React.useCallback(() => {
    if (!schoolId) return;
    fetch(`/api/classes?schoolId=${schoolId}&limit=200`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setClassList((j.data || j || []).map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string }))))
      .catch(() => {});
    fetch(`/api/subjects?schoolId=${schoolId}&limit=200`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setSubjectList((j.data || j || []).map((s: Record<string, unknown>) => ({ id: s.id as string, name: s.name as string }))))
      .catch(() => {});
  }, [schoolId]);

  React.useEffect(() => {
    fetchClassSubjectOptions();
  }, [fetchClassSubjectOptions]);

  React.useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/teachers?schoolId=${schoolId}&page=${page}&limit=${pageSize}`);
        const json = await res.json();
        const items = json.data || json || [];
        setTotalTeachers(json.total || items.length);
        setTeachers(items.map((t: Record<string, unknown>) => ({
          id: t.id,
          userId: t.userId || '',
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
          dateOfJoining: t.dateOfJoining ? String(t.dateOfJoining) : null,
          gender: t.gender as string | null,
          address: t.address as string | null,
          salary: t.salary as number | null,
        })));
      } catch {
        toast.error('Failed to load teachers');
        setTeachers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId, page, refreshKey]);

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.specialization || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(totalTeachers / pageSize);
  const showingFrom = totalTeachers === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalTeachers);

    const handleAddTeacher = async () => {
    if (!schoolId) {
      toast.error('No school selected. Please select a school first.');
      return;
    }

    const dialog = document.querySelector('[data-teacher-dialog]');
    if (!dialog) return;
    const form = dialog.querySelector('form') as HTMLFormElement | null;
    if (!form) return;

    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const employeeNo = formData.get('employeeNo') as string;

    if (!name || !email || !password) {
      toast.error('Name, email, and password are required');
      return;
    }

    // Pre-check plan limit before submission
    try {
      const schoolRes = await fetch(`/api/schools/${schoolId}`);
      if (schoolRes.ok) {
        const schoolJson = await schoolRes.json();
        const schoolData = schoolJson.data || schoolJson;
        const plan = schoolData.subscriptionPlan;
        const maxTeachers = plan?.maxTeachers ?? schoolData.maxTeachers ?? 50;
        const currentCount = schoolData._count?.teachers ?? 0;

        if (maxTeachers !== -1 && currentCount >= maxTeachers) {
          setUpgradeDialog({ open: true, maxTeachers, currentCount });
          return;
        }
      }
    } catch {
      // Silently continue - backend will enforce limit if frontend check fails
    }

    setAdding(true);
    try {
      const body: Record<string, unknown> = {
        schoolId,
        name,
        email: email.toLowerCase(),
        password,
        specialization: formData.get('specialization') || null,
        qualification: formData.get('qualification') || null,
        phone: formData.get('phone') || null,
        dateOfJoining: formData.get('dateOfJoining') || null,
        gender: formData.get('gender') || null,
        address: formData.get('address') || null,
        salary: formData.get('salary') ? parseFloat(formData.get('salary') as string) : null,
        classIds: selectedClassIds,
        subjectAssignments,
      };
      
      if (photoUrl) body.photo = photoUrl;
      
      // Only include employeeNo if provided (will be auto-generated if not)
      if (employeeNo) {
        body.employeeNo = employeeNo;
      }
      
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json.error || 'Failed to create teacher';
        // If backend rejects due to plan limit, show upgrade dialog
        if (res.status === 403 && errorMsg.toLowerCase().includes('plan')) {
          // Fetch current plan info for the dialog
          try {
            const sRes = await fetch(`/api/schools/${schoolId}`);
            if (sRes.ok) {
              const sJson = await sRes.json();
              const sData = sJson.data || sJson;
              const plan = sData.subscriptionPlan;
              const maxT = plan?.maxTeachers ?? sData.maxTeachers ?? 50;
              const currC = sData._count?.teachers ?? 0;
              setUpgradeDialog({ open: true, maxTeachers: maxT, currentCount: currC });
            }
          } catch {}
          setAdding(false);
          return;
        }
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      toast.success('Teacher added successfully');
      setAddOpen(false);
      setPhotoUrl('');
      setSelectedClassIds([]);
      setSubjectAssignments([]);
      setPage(1);
      setRefreshKey(k => k + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add teacher');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTeacher) return;
    setSaving(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const res = await fetch(`/api/teachers/${editTeacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          employeeNo: formData.get('employeeNo') || null,
          phone: formData.get('phone') || null,
          specialization: formData.get('specialization') || null,
          qualification: formData.get('qualification') || null,
          dateOfJoining: formData.get('dateOfJoining') || null,
          gender: formData.get('gender') || null,
          address: formData.get('address') || null,
          salary: formData.get('salary') ? parseFloat(formData.get('salary') as string) : null,
          isActive: formData.get('isActive') === 'true',
          ...(editPhotoUrl ? { photo: editPhotoUrl } : {}),
          classIds: editSelectedClassIds,
          subjectAssignments: editSubjectAssignments,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Teacher updated successfully');
      setEditTeacher(null);
      setDetailTeacher(null);
      setEditPhotoUrl('');
      setRefreshKey(k => k + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update teacher');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    try {
      const res = await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Teacher deleted successfully');
      setDetailTeacher(null);
      setRefreshKey(k => k + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete teacher');
    }
  };

  if (!schoolId) {
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
          <p className="text-sm text-muted-foreground">{totalTeachers} teacher{totalTeachers !== 1 ? 's' : ''} on staff</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
            <DialogContent data-teacher-dialog className="w-[95vw] max-h-[90vh] overflow-y-auto">
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
                  <div className="grid gap-2">
                    <Label>Password</Label>
                    <Input name="password" type="password" placeholder="At least 6 characters" required />
                    <span className="text-xs text-muted-foreground">Minimum 6 characters</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Employee No</Label>
                      <Input name="employeeNo" placeholder="e.g. TCH-001 (auto-generated if empty)" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Phone Number</Label>
                      <Input name="phone" placeholder="+234-..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Subject / Specialization</Label>
                      <Input name="specialization" placeholder="e.g. Mathematics" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Qualification</Label>
                      <Input name="qualification" placeholder="e.g. B.Ed" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Date of Joining</Label>
                      <Input name="dateOfJoining" type="date" />
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
                  <div className="grid gap-2">
                    <Label>Address</Label>
                    <Textarea name="address" placeholder="Home address" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Salary (NGN)</Label>
                    <Input name="salary" type="number" placeholder="e.g. 150000" />
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
                      variant="avatar"
                      placeholder="Upload teacher photo (auto-compressed)"
                    />
                  </div>

                  {/* Class Teacher Assignments */}
                  <div className="grid gap-2 border-t pt-4">
                    <Label className="text-base font-semibold">Class Teacher For</Label>
                    <p className="text-xs text-muted-foreground">Select classes where this teacher will be the class teacher</p>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {classList.map(cls => (
                        <label key={cls.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer">
                          <Checkbox
                            checked={selectedClassIds.includes(cls.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedClassIds(prev => [...prev, cls.id]);
                              } else {
                                setSelectedClassIds(prev => prev.filter(id => id !== cls.id));
                              }
                            }}
                          />
                          <span className="text-sm">{cls.name}</span>
                        </label>
                      ))}
                      {classList.length === 0 && <p className="text-xs text-muted-foreground p-2">No classes available</p>}
                    </ScrollArea>
                    {selectedClassIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedClassIds.map(cid => {
                          const cls = classList.find(c => c.id === cid);
                          return cls ? (
                            <Badge key={cid} variant="secondary" className="gap-1 text-xs">
                              {cls.name}
                              <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedClassIds(prev => prev.filter(id => id !== cid))} />
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Subject Assignments */}
                  <div className="grid gap-2 border-t pt-4">
                    <Label className="text-base font-semibold">Subject Teacher For</Label>
                    <p className="text-xs text-muted-foreground">Assign subjects to classes for this teacher</p>
                    <div className="flex gap-2">
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const cid = e.target.value;
                          setSubjectAssignments(prev => [...prev, { classId: cid, subjectId: '' }]);
                          e.target.value = '';
                        }}
                      >
                        <option value="">Select class...</option>
                        {classList.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <ScrollArea className="h-40 border rounded-md p-2">
                      {subjectAssignments.length === 0 && <p className="text-xs text-muted-foreground p-2">No subject assignments yet</p>}
                      {subjectAssignments.map((sa, idx) => {
                        const cls = classList.find(c => c.id === sa.classId);
                        return (
                          <div key={idx} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">{cls?.name || sa.classId}</Badge>
                            <select
                              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                              value={sa.subjectId}
                              onChange={(e) => {
                                const newVal = e.target.value;
                                setSubjectAssignments(prev => prev.map((item, i) => i === idx ? { ...item, subjectId: newVal } : item));
                              }}
                            >
                              <option value="">Select subject...</option>
                              {subjectList.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <X className="h-4 w-4 cursor-pointer shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setSubjectAssignments(prev => prev.filter((_, i) => i !== idx))} />
                          </div>
                        );
                      })}
                    </ScrollArea>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setAddOpen(false); setPhotoUrl(''); setSelectedClassIds([]); setSubjectAssignments([]); }}>Cancel</Button>
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
              onClick={async () => {
                setDetailTeacher(teacher);
                try {
                  const res = await fetch(`/api/teachers/${teacher.id}`);
                  if (res.ok) {
                    const json = await res.json();
                    const t = json.data;
                    setDetailClasses(t.classes || []);
                    setDetailSubjects(t.classSubjects || []);
                  }
                } catch {}
              }}
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

      {!loading && totalTeachers > 0 && (
        <motion.div variants={slideUp} className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {showingFrom}-{showingTo} of {totalTeachers}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </motion.div>
      )}

      <Dialog open={!!detailTeacher} onOpenChange={() => setDetailTeacher(null)}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
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
                <DialogDescription>Teacher account details and information</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Employee No</span>
                    <p className="font-medium">{detailTeacher.employeeNo}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Specialization</span>
                    <p className="font-medium flex items-center gap-1.5">
                      <BookOpen className="size-3.5" />
                      {detailTeacher.specialization || 'â€”'}
                    </p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Qualification</span>
                    <p className="font-medium">{detailTeacher.qualification || 'â€”'}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <p className="font-medium flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {detailTeacher.phone || 'â€”'}
                    </p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-medium text-xs">{detailTeacher.email || 'â€”'}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={detailTeacher.isActive ? 'default' : 'secondary'}>
                      {detailTeacher.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                {/* Assigned Classes */}
                {detailClasses.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Class Teacher For</h4>
                    <div className="flex flex-wrap gap-1">
                      {detailClasses.map(c => (
                        <Badge key={c.id} variant="secondary" className="text-xs">{c.name}{c.section ? ` (${c.section})` : ''}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned Subjects */}
                {detailSubjects.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Subject Teacher For</h4>
                    <div className="flex flex-wrap gap-1">
                      {detailSubjects.map((cs, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {cs.class.name}: {cs.subject.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1">
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Teacher</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {detailTeacher.name}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteTeacher(detailTeacher.id)} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" size="sm" className="gap-1" onClick={async () => {
                  setEditTeacher(detailTeacher);
                  setEditPhotoUrl('');
                  setDetailTeacher(null);
                  // Fetch teacher's current assignments
                  try {
                    const res = await fetch(`/api/teachers/${detailTeacher.id}`);
                    if (res.ok) {
                      const json = await res.json();
                      const t = json.data;
                      setEditSelectedClassIds((t.classes || []).map((c: { id: string }) => c.id));
                      setEditSubjectAssignments((t.classSubjects || []).map((cs: { classId: string; subjectId: string }) => ({ classId: cs.classId, subjectId: cs.subjectId })));
                    }
                  } catch {}
                }}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setMessageUser({ id: detailTeacher.userId, name: detailTeacher.name, role: 'TEACHER' });
                    setMessageOpen(true);
                  }}
                >
                  <MessageCircle className="size-3.5" /> Message
                </Button>
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
                <DialogTitle>Teacher Limit Reached</DialogTitle>
                <DialogDescription>Your current plan has a limit on the number of teachers.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <GraduationCap className="size-5 text-violet-600" />
                <div>
                  <p className="text-sm font-medium">Teachers</p>
                  <p className="text-xs text-muted-foreground">Current usage</p>
                </div>
              </div>
              <p className="text-lg font-bold">{upgradeDialog.currentCount} / {upgradeDialog.maxTeachers === -1 ? '∞' : upgradeDialog.maxTeachers}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <Crown className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Upgrade to continue adding teachers</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Your current plan allows a maximum of {upgradeDialog.maxTeachers} teacher{upgradeDialog.maxTeachers !== 1 ? 's' : ''}.
                    Upgrade to a higher plan to add more teachers and unlock additional features.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setUpgradeDialog({ open: false, maxTeachers: 0, currentCount: 0 })}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={() => {
                setUpgradeDialog({ open: false, maxTeachers: 0, currentCount: 0 });
                useAppStore.getState().setCurrentView('subscription' as DashboardView);
              }}
            >
              <Crown className="size-4" />
              Upgrade Plan
              <ArrowRight className="size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTeacher} onOpenChange={(open) => { if (!open) { setEditTeacher(null); setEditPhotoUrl(''); } }}>
        <DialogContent data-teacher-dialog className="w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>Update the teacher&apos;s details below.</DialogDescription>
          </DialogHeader>
          {editTeacher && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateTeacher(e); }}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Full Name</Label>
                  <Input name="name" defaultValue={editTeacher.name} required />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={editTeacher.email || ''} required />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={editTeacher.phone || ''} />
                </div>
                <div className="grid gap-2">
                  <Label>Employee No</Label>
                  <Input name="employeeNo" defaultValue={editTeacher.employeeNo} placeholder="e.g. TCH-001" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Specialization</Label>
                    <Input name="specialization" defaultValue={editTeacher.specialization || ''} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Qualification</Label>
                    <Input name="qualification" defaultValue={editTeacher.qualification || ''} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Date of Joining</Label>
                    <Input name="dateOfJoining" type="date" defaultValue={editTeacher.dateOfJoining ? editTeacher.dateOfJoining.split('T')[0] : ''} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Gender</Label>
                    <Select name="gender" defaultValue={editTeacher.gender || ''}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Textarea name="address" defaultValue={editTeacher.address || ''} placeholder="Home address" />
                </div>
                <div className="grid gap-2">
                  <Label>Salary (NGN)</Label>
                  <Input name="salary" type="number" defaultValue={editTeacher.salary ?? ''} placeholder="e.g. 150000" />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select name="isActive" defaultValue={editTeacher.isActive ? 'true' : 'false'}>
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
                    variant="avatar"
                    placeholder="Upload new photo (auto-compressed)"
                  />
                </div>

                {/* Edit Class Teacher Assignments */}
                <div className="grid gap-2 border-t pt-4">
                  <Label className="text-base font-semibold">Class Teacher For</Label>
                  <p className="text-xs text-muted-foreground">Select classes where this teacher will be the class teacher</p>
                  <ScrollArea className="h-32 border rounded-md p-2">
                    {classList.map(cls => (
                      <label key={cls.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer">
                        <Checkbox
                          checked={editSelectedClassIds.includes(cls.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditSelectedClassIds(prev => [...prev, cls.id]);
                            } else {
                              setEditSelectedClassIds(prev => prev.filter(id => id !== cls.id));
                            }
                          }}
                        />
                        <span className="text-sm">{cls.name}</span>
                      </label>
                    ))}
                    {classList.length === 0 && <p className="text-xs text-muted-foreground p-2">No classes available</p>}
                  </ScrollArea>
                  {editSelectedClassIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {editSelectedClassIds.map(cid => {
                        const cls = classList.find(c => c.id === cid);
                        return cls ? (
                          <Badge key={cid} variant="secondary" className="gap-1 text-xs">
                            {cls.name}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => setEditSelectedClassIds(prev => prev.filter(id => id !== cid))} />
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Edit Subject Assignments */}
                <div className="grid gap-2 border-t pt-4">
                  <Label className="text-base font-semibold">Subject Teacher For</Label>
                  <p className="text-xs text-muted-foreground">Assign subjects to classes for this teacher</p>
                  <div className="flex gap-2">
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setEditSubjectAssignments(prev => [...prev, { classId: e.target.value, subjectId: '' }]);
                        e.target.value = '';
                      }}
                    >
                      <option value="">Select class...</option>
                      {classList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <ScrollArea className="h-40 border rounded-md p-2">
                    {editSubjectAssignments.length === 0 && <p className="text-xs text-muted-foreground p-2">No subject assignments yet</p>}
                    {editSubjectAssignments.map((sa, idx) => {
                      const cls = classList.find(c => c.id === sa.classId);
                      return (
                        <div key={idx} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{cls?.name || sa.classId}</Badge>
                          <select
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                            value={sa.subjectId}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setEditSubjectAssignments(prev => prev.map((item, i) => i === idx ? { ...item, subjectId: newVal } : item));
                            }}
                          >
                            <option value="">Select subject...</option>
                            {subjectList.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <X className="h-4 w-4 cursor-pointer shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setEditSubjectAssignments(prev => prev.filter((_, i) => i !== idx))} />
                        </div>
                      );
                    })}
                  </ScrollArea>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditTeacher(null); setEditPhotoUrl(''); setEditSelectedClassIds([]); setEditSubjectAssignments([]); }}>Cancel</Button>
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

