'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, History, User, Loader2, ArrowRight, ArrowLeftRight, GraduationCap, LogOut, Undo, Star } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface HistoryRecord {
  id: string;
  studentId: string;
  action: string;
  fromClassId: string | null;
  toClassId: string | null;
  fromSchoolName: string | null;
  toSchoolName: string | null;
  reason: string | null;
  notes: string | null;
  performedBy: string | null;
  createdAt: string;
  fromClass: { id: string; name: string; grade: string | null } | null;
  toClass: { id: string; name: string; grade: string | null } | null;
  student: {
    id: string;
    admissionNo: string;
    user: { name: string; email: string };
  };
}

interface StudentBrief {
  id: string;
  admissionNo: string;
  user: { name: string; email: string };
  class?: { name: string } | null;
}

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  enrollment: { label: 'Enrollment', icon: <Star className="size-3.5" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  transfer_in: { label: 'Transfer In', icon: <ArrowRight className="size-3.5" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  transfer_out: { label: 'Transfer Out', icon: <ArrowRight className="size-3.5" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  class_change: { label: 'Class Change', icon: <ArrowLeftRight className="size-3.5" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  graduation: { label: 'Graduation', icon: <GraduationCap className="size-3.5" />, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  withdrawal: { label: 'Withdrawal', icon: <LogOut className="size-3.5" />, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  reinstatement: { label: 'Reinstatement', icon: <Undo className="size-3.5" />, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><Skeleton className="h-6 w-48 mb-2" /><Skeleton className="h-4 w-36" /></div>
        <Skeleton className="h-10 w-44" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}

export function EnrollmentHistoryView() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [students, setStudents] = React.useState<StudentBrief[]>([]);
  const [selectedStudentId, setSelectedStudentId] = React.useState('');
  const [records, setRecords] = React.useState<HistoryRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  const loadStudents = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/students?schoolId=${schoolId}&limit=500`);
      const json = await res.json();
      setStudents((json.data || json || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        admissionNo: s.admissionNo,
        user: (s.user as Record<string, unknown>) || { name: 'Unknown', email: '' },
        class: (s.class as Record<string, unknown>) || null,
      })));
    } catch {
      setStudents([]);
    }
  }, [schoolId]);

  const loadHistory = React.useCallback(async (studentId: string) => {
    if (!studentId || !schoolId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/enrollment-history?studentId=${studentId}&schoolId=${schoolId}`);
      const json = await res.json();
      setRecords(json.data || []);
    } catch {
      toast.error('Failed to load enrollment history');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => { loadStudents(); }, [loadStudents]);

  React.useEffect(() => {
    if (selectedStudentId) loadHistory(selectedStudentId);
    else setRecords([]);
  }, [selectedStudentId, loadHistory]);

  const handleAddRecord = async () => {
    if (!selectedStudentId) { toast.error('Select a student first'); return; }
    const form = document.querySelector('[data-enrollment-form]') as HTMLFormElement;
    if (!form) return;
    const formData = new FormData(form);
    const action = formData.get('action') as string;
    if (!action) { toast.error('Action is required'); return; }

    setAdding(true);
    try {
      const res = await fetch('/api/enrollment-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          studentId: selectedStudentId,
          action,
          fromClassId: formData.get('fromClassId') || null,
          toClassId: formData.get('toClassId') || null,
          fromSchoolName: formData.get('fromSchoolName') || null,
          toSchoolName: formData.get('toSchoolName') || null,
          reason: formData.get('reason') || null,
          notes: formData.get('notes') || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create record');
      toast.success('Enrollment record created');
      setAddOpen(false);
      loadHistory(selectedStudentId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create record');
    } finally {
      setAdding(false);
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <History className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view enrollment history</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">Enrollment History</h2>
          <p className="text-sm text-muted-foreground">Track student enrollment and class changes over time</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a student..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.user.name} ({s.admissionNo}) {s.class ? `- ${s.class.name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStudentId && (
            <Button className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add Record
            </Button>
          )}
        </div>
      </motion.div>

      {!selectedStudentId ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <User className="size-12 opacity-30" />
          <p className="mt-3 text-sm">Select a student to view their enrollment history</p>
        </div>
      ) : loading ? (
        <LoadingSkeleton />
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <History className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No enrollment history found for this student</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-6">
            {records.map((record, idx) => {
              const meta = ACTION_META[record.action] || { label: record.action, icon: <History className="size-3.5" />, color: 'bg-gray-100 text-gray-700' };
              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative pl-12"
                >
                  <div className={`absolute left-3.5 top-1 size-3 rounded-full ring-4 ring-background ${meta.color.split(' ')[0]}`} />
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`${meta.color} border-0 gap-1`}>
                            {meta.icon} {meta.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(record.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1 text-sm">
                        {(record.fromClass || record.toClass) && (
                          <p>
                            {record.fromClass && <span className="text-muted-foreground">{record.fromClass.name}</span>}
                            {record.fromClass && record.toClass && <span className="mx-1 text-muted-foreground">&rarr;</span>}
                            {record.toClass && <span className="font-medium">{record.toClass.name}</span>}
                          </p>
                        )}
                        {(record.fromSchoolName || record.toSchoolName) && (
                          <p className="text-xs text-muted-foreground">
                            {record.fromSchoolName && <span>{record.fromSchoolName}</span>}
                            {record.fromSchoolName && record.toSchoolName && <span className="mx-1">&rarr;</span>}
                            {record.toSchoolName && <span>{record.toSchoolName}</span>}
                          </p>
                        )}
                        {record.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {record.reason}</p>}
                        {record.notes && <p className="text-xs text-muted-foreground">{record.notes}</p>}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Enrollment Record</DialogTitle>
            <DialogDescription>
              Record a change for {selectedStudent?.user.name || 'selected student'}.
            </DialogDescription>
          </DialogHeader>
          <form data-enrollment-form onSubmit={(e) => { e.preventDefault(); handleAddRecord(); }}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Action</Label>
                <Select name="action">
                  <SelectTrigger><SelectValue placeholder="Select action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enrollment">Enrollment</SelectItem>
                    <SelectItem value="transfer_in">Transfer In</SelectItem>
                    <SelectItem value="transfer_out">Transfer Out</SelectItem>
                    <SelectItem value="class_change">Class Change</SelectItem>
                    <SelectItem value="graduation">Graduation</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    <SelectItem value="reinstatement">Reinstatement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>From Class ID</Label><Input name="fromClassId" placeholder="Optional" /></div>
                <div className="grid gap-2"><Label>To Class ID</Label><Input name="toClassId" placeholder="Optional" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>From School Name</Label><Input name="fromSchoolName" placeholder="Previous school" /></div>
                <div className="grid gap-2"><Label>To School Name</Label><Input name="toSchoolName" placeholder="New school" /></div>
              </div>
              <div className="grid gap-2"><Label>Reason</Label><Input name="reason" placeholder="Reason for this change" /></div>
              <div className="grid gap-2"><Label>Notes</Label><Textarea name="notes" placeholder="Additional notes" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={adding}>
                {adding && <Loader2 className="size-4 animate-spin mr-1" />}Create Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
