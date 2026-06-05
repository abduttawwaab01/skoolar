'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/shared/data-table';
import { type ColumnDef } from '@tanstack/react-table';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { Search, CreditCard, GraduationCap, DollarSign } from 'lucide-react';

interface StudentRecord {
  id: string;
  admissionNo: string;
  name: string;
  className: string;
  gender: string | null;
  classId: string | null;
  isActive: boolean;
  feeBalance?: number;
  lastPayment?: string;
  paymentStatus?: string;
}

const columns: ColumnDef<StudentRecord>[] = [
  {
    accessorKey: 'admissionNo',
    header: 'Admission No',
    cell: ({ row }) => <span className="text-xs font-mono">{row.original.admissionNo}</span>,
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
    accessorKey: 'feeBalance',
    header: 'Fee Balance',
    cell: ({ row }) => {
      const balance = row.original.feeBalance;
      if (balance === undefined) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <span className={`text-xs font-semibold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          ${balance.toFixed(2)}
        </span>
      );
    },
  },
  {
    accessorKey: 'paymentStatus',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.paymentStatus || 'unknown';
      const variant = status === 'paid' ? 'default' as const : status === 'partial' ? 'secondary' as const : 'destructive' as const;
      return <Badge variant={variant} className="text-xs">{status}</Badge>;
    },
  },
  {
    accessorKey: 'lastPayment',
    header: 'Last Payment',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{row.original.lastPayment || '—'}</span>
    ),
  },
];

export default function AccountantStudents() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    const fetchStudents = async () => {
      try {
        const res = await fetch(`/api/students?schoolId=${schoolId}&limit=500`);
        if (res.ok) {
          const json = await res.json();
          const data: { id: string; admissionNo: string; user: { name: string }; class: { name: string } | null; gender: string | null; classId: string | null; isActive: boolean }[] = json.data || json || [];
          setStudents(data.map(s => ({
            id: s.id,
            admissionNo: s.admissionNo,
            name: s.user?.name || '',
            className: s.class?.name || 'Unassigned',
            gender: s.gender,
            classId: s.classId,
            isActive: s.isActive,
          })));
        }
      } catch {
        toast.error('Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [schoolId]);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.admissionNo.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Accounts</h1>
          <p className="text-muted-foreground">View student fee accounts and payment status</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{students.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{students.filter(s => s.isActive).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">With Balance</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{students.filter(s => (s.feeBalance || 0) > 0).length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable columns={columns} data={filtered} />
        </CardContent>
      </Card>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">No students found</div>
      )}
    </div>
  );
}
