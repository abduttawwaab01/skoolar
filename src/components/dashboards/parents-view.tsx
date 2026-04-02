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
import { Plus, Users, Loader2, GraduationCap, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface ParentRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  childrenCount: number;
  status: string;
  occupation: string | null;
  createdAt: string;
}

interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
  className: string;
}

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

export function ParentsView() {
  const { selectedSchoolId } = useAppStore();
  const [parents, setParents] = React.useState<ParentRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [parentName, setParentName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [occupation, setOccupation] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [selectedStudents, setSelectedStudents] = React.useState<string[]>([]);
  const [availableStudents, setAvailableStudents] = React.useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = React.useState(false);

  React.useEffect(() => {
    if (open && selectedSchoolId && availableStudents.length === 0) {
      fetchAvailableStudents();
    }
  }, [open, selectedSchoolId]);

  React.useEffect(() => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/parents?schoolId=${selectedSchoolId}&limit=100`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        const items = json.data || json || [];
        setParents(items.map((p: Record<string, unknown>) => ({
          id: p.id,
          name: (p.user as Record<string, unknown>)?.name || '',
          phone: (p.user as Record<string, unknown>)?.phone || p.phone || null,
          email: (p.user as Record<string, unknown>)?.email || '',
          childrenCount: String(p.childrenIds || '').split(',').filter(Boolean).length,
          status: (p.user as Record<string, unknown>)?.isActive !== false ? 'active' : 'inactive',
          occupation: p.occupation || null,
          createdAt: p.createdAt as string || '',
        })));
      })
      .catch(err => {
        setError(err.message);
        toast.error('Failed to load parents');
        setParents([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const handleAddParent = async () => {
    if (!selectedSchoolId) {
      toast.error('No school selected');
      return;
    }

    if (!parentName || !email) {
      toast.error('Name and email are required');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          name: parentName,
          email,
          phone: phone || null,
          occupation: occupation || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create parent');

      // Link selected students to the parent
      if (selectedStudents.length > 0) {
        const parentUserId = json.data?.userId || json.userId;
        if (parentUserId) {
          await fetch('/api/parent-students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parentId: parentUserId,
              studentIds: selectedStudents,
            }),
          });
        }
      }

      toast.success('Parent added successfully');
      setOpen(false);
      setParentName('');
      setPhone('');
      setEmail('');
      setOccupation('');
      setSelectedStudents([]);
      setAvailableStudents([]);

      // Refresh
      const refreshed = await fetch(`/api/parents?schoolId=${selectedSchoolId}&limit=100`)
        .then(r => r.json())
        .then(j => (j.data || j || []).map((p: Record<string, unknown>) => ({
          id: p.id,
          name: (p.user as Record<string, unknown>)?.name || '',
          phone: (p.user as Record<string, unknown>)?.phone || p.phone || null,
          email: (p.user as Record<string, unknown>)?.email || '',
          childrenCount: String(p.childrenIds || '').split(',').filter(Boolean).length,
          status: (p.user as Record<string, unknown>)?.isActive !== false ? 'active' : 'inactive',
          occupation: p.occupation || null,
          createdAt: p.createdAt as string || '',
        })));
      setParents(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add parent');
    } finally {
      setAdding(false);
    }
  };

  const fetchAvailableStudents = async () => {
    if (!selectedSchoolId) return;
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/students?schoolId=${selectedSchoolId}&limit=500`);
      const json = await res.json();
      const students = (json.data || json || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: (s.user as Record<string, unknown>)?.name || '',
        admissionNo: s.admissionNo || '',
        className: (s.class as Record<string, unknown>)?.name || 'Unassigned',
      }));
      setAvailableStudents(students);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const columns: ColumnDef<ParentRecord>[] = React.useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <span className="text-sm">{row.original.phone || '—'}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span className="text-xs">{row.original.email}</span>,
    },
    {
      accessorKey: 'childrenCount',
      header: 'Children',
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-center size-6 rounded-full bg-muted text-xs font-bold">
          {row.getValue<number>('childrenCount')}
        </span>
      ),
    },
    {
      accessorKey: 'occupation',
      header: 'Occupation',
      cell: ({ row }) => <span className="text-sm">{row.original.occupation || '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge variant={row.getValue<string>('status') === 'active' ? 'success' : 'neutral'} size="sm">
          {row.getValue<string>('status')}
        </StatusBadge>
      ),
    },
  ], []);

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GraduationCap className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view parents</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="size-12 text-destructive opacity-60" />
        <p className="mt-3 text-sm font-medium">Failed to load parents</p>
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
      <motion.div 
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h2 className="text-lg font-semibold">Parents</h2>
          <p className="text-sm text-muted-foreground">{parents.length} parent/guardian contacts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Add Parent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Parent/Guardian</DialogTitle>
              <DialogDescription>Add a new parent or guardian to the system.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="Enter full name" value={parentName} onChange={e => setParentName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input placeholder="+234-XXX-XXX-XXXX" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input placeholder="parent@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Occupation</Label>
                <Input placeholder="e.g. Teacher, Business" value={occupation} onChange={e => setOccupation(e.target.value)} />
              </div>
              {open && (
                <div className="space-y-2">
                  <Label>Link Children (Optional)</Label>
                  {loadingStudents ? (
                    <div className="text-sm text-muted-foreground py-2">Loading students...</div>
                  ) : availableStudents.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                      {availableStudents.map(student => (
                        <label key={student.id} className="flex items-center gap-2 py-1 px-1 hover:bg-muted rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedStudents([...selectedStudents, student.id]);
                              } else {
                                setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                              }
                            }}
                            className="rounded border-input"
                          />
                          <span className="text-sm">
                            {student.name} ({student.admissionNo}) - {student.className}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-2">No students available</div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleAddParent} disabled={adding}>
                {adding && <Loader2 className="size-4 animate-spin mr-1" />}
                Add Parent
              </Button>
            </DialogFooter>
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
          data={parents}
          searchKey="name"
          searchPlaceholder="Search parent..."
          emptyMessage="No parents found. Add your first parent/guardian."
        />
      </motion.div>

      {parents.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Users className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No parent/guardian contacts yet</p>
          <p className="text-xs mt-1">Click &quot;Add Parent&quot; to get started</p>
        </div>
      )}
    </motion.div>
  );
}
