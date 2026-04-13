'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Heart, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface HealthRecord {
  id: string;
  student: string;
  studentId: string;
  bloodType: string;
  allergies: string;
  conditions: string;
  vaccinations: string;
  lastCheckup: string;
  recordedBy: string;
  status: string;
}

interface StudentOption {
  id: string;
  name: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    </div>
  );
}

export function HealthRecordsView() {
  const { selectedSchoolId } = useAppStore();
  const [records, setRecords] = React.useState<HealthRecord[]>([]);
  const [students, setStudents] = React.useState<StudentOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [studentId, setStudentId] = React.useState('');
  const [bloodType, setBloodType] = React.useState('');
  const [allergies, setAllergies] = React.useState('');
  const [checkupDate, setCheckupDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!selectedSchoolId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/students?schoolId=${selectedSchoolId}&limit=200`)
        .then(r => r.json())
        .then(json => (json.data || json || []).map((s: Record<string, unknown>) => ({
          id: s.id,
          name: (s.user as Record<string, unknown>)?.name || s.admissionNo || '',
        })))
        .catch(() => []),
      fetch(`/api/analytics?schoolId=${selectedSchoolId}&section=health`)
        .then(r => r.json())
        .then(json => {
          const items = json.data || json.healthRecords || [];
          if (Array.isArray(items) && items.length > 0) {
            return items.map((r: Record<string, unknown>) => ({
              id: r.id,
              student: (r.student as Record<string, unknown>)?.name || r.studentId || '',
              studentId: r.studentId || '',
              bloodType: r.bloodType || '—',
              allergies: r.allergies || 'None',
              conditions: r.conditions || 'None',
              vaccinations: r.vaccinations || 'None',
              lastCheckup: r.lastCheckup ? new Date(r.lastCheckup as string).toLocaleDateString() : '—',
              recordedBy: r.recordedBy || '—',
              status: r.lastCheckup ? (Date.now() - new Date(r.lastCheckup as string).getTime() < 90 * 24 * 60 * 60 * 1000 ? 'healthy' : 'attention') : 'attention',
            }));
          }
          return [];
        })
        .catch(() => []),
    ])
      .then(([studentData, healthData]) => {
        setStudents(studentData);
        setRecords(healthData as HealthRecord[]);
      })
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const columns: ColumnDef<HealthRecord>[] = [
    { accessorKey: 'student', header: 'Student' },
    {
      accessorKey: 'bloodType',
      header: 'Blood Type',
      cell: ({ row }) => {
        const bt = row.getValue<string>('bloodType');
        return bt && bt !== '—' ? (
          <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 px-2.5 py-0.5 text-xs font-bold">{bt}</span>
        ) : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      accessorKey: 'allergies',
      header: 'Allergies',
      cell: ({ row }) => {
        const a = row.getValue<string>('allergies');
        return a === 'None' || !a ? <span className="text-muted-foreground text-xs">None</span> : <span className="text-xs font-medium text-red-600">{a}</span>;
      },
    },
    { accessorKey: 'lastCheckup', header: 'Last Checkup' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.getValue<string>('status');
        return <StatusBadge variant={s === 'healthy' ? 'success' : 'warning'} size="sm">{s === 'healthy' ? 'Healthy' : 'Needs Attention'}</StatusBadge>;
      },
    },
  ];

  const handleSave = async () => {
    if (!selectedSchoolId || !studentId) { toast.error('Select a student'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: selectedSchoolId, id: studentId, healthData: { bloodType, allergies, lastCheckup: checkupDate || new Date().toISOString() } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success('Health record updated');
      setOpen(false);
      setStudentId(''); setBloodType(''); setAllergies(''); setCheckupDate('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  if (!selectedSchoolId) return <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Heart className="size-12 opacity-30" /><p className="mt-3 text-sm">Select a school to view health records</p></div>;
  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Heart className="size-5 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold">Health Records</h2>
            <p className="text-sm text-muted-foreground">{records.length} student health records</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Add Record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Health Record</DialogTitle>
              <DialogDescription>Record a new student health entry.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Blood Type</Label>
                <Select value={bloodType} onValueChange={setBloodType}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Allergies</Label>
                <Input placeholder="List known allergies, or 'None'" value={allergies} onChange={e => setAllergies(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Checkup Date</Label>
                <Input type="date" value={checkupDate} onChange={e => setCheckupDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin mr-1" />}Save Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={records} searchKey="student" searchPlaceholder="Search student..." emptyMessage="No health records yet. Click 'Add Record' to create one." />
    </div>
  );
}
