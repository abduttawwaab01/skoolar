'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  receiptNo: string;
  createdAt: string;
  studentId: string;
  student?: {
    id: string;
    admissionNo: string;
    user: { name: string | null; email: string | null };
    class: { name: string; section: string | null } | null;
  };
}

type PaymentRow = Payment & { studentName: string };

const statusFilters = ['All', 'Verified', 'Pending', 'Failed'] as const;

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-md" />)}
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

export function PaymentsView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<string>('All');
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    studentId: '',
    amount: '',
    method: '',
    reference: '',
    termId: '',
  });

  const fetchPayments = useCallback(async () => {
    if (!selectedSchoolId) return;
    try {
      setLoading(true);
      const statusParam = activeFilter !== 'All' ? activeFilter.toLowerCase() : '';
      const url = `/api/payments?schoolId=${selectedSchoolId}&limit=100${statusParam ? `&status=${statusParam}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load payments');
      const json = await res.json();
      setPayments(json.data || []);
    } catch (err) {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId, activeFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const tableData = useMemo((): PaymentRow[] => {
    const filtered = activeFilter === 'All' ? payments : payments.filter(p => p.status.toLowerCase() === activeFilter.toLowerCase());
    return filtered.map(p => ({
      ...p,
      studentName: p.student?.user?.name || p.student?.admissionNo || 'Unknown',
    }));
  }, [activeFilter, payments]);

  const columns: ColumnDef<PaymentRow>[] = [
    { accessorKey: 'studentName', header: 'Student' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `₦${row.getValue<number>('amount').toLocaleString()}` },
    { accessorKey: 'method', header: 'Method' },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => new Date(row.getValue<string>('createdAt')).toLocaleDateString() },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.getValue<string>('status');
        return (
          <StatusBadge variant={s === 'verified' || s === 'completed' ? 'success' : s === 'pending' ? 'warning' : 'error'} size="sm">
            {s}
          </StatusBadge>
        );
      },
    },
    { accessorKey: 'receiptNo', header: 'Receipt' },
  ];

  const handleSubmit = async () => {
    if (!formData.amount || !formData.method) {
      toast.error('Please fill in amount and method');
      return;
    }
    if (!selectedSchoolId) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          studentId: formData.studentId || undefined,
          amount: parseFloat(formData.amount),
          method: formData.method,
          reference: formData.reference || undefined,
          termId: formData.termId || undefined,
          status: 'pending',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record payment');
      }
      toast.success('Payment recorded successfully');
      setOpen(false);
      setFormData({ studentId: '', amount: '', method: '', reference: '', termId: '' });
      fetchPayments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payments</h2>
          <p className="text-sm text-muted-foreground">Manage student fee payments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Record Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>Record a new fee payment from a student.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Student</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input placeholder="Search student..." className="pl-9" value={formData.studentId} onChange={e => setFormData(f => ({ ...f, studentId: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount (₦)</Label>
                <Input placeholder="150000" type="number" value={formData.amount} onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={formData.method} onValueChange={v => setFormData(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input placeholder="REF-XXXX" value={formData.reference} onChange={e => setFormData(f => ({ ...f, reference: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Term</Label>
                <Select value={formData.termId} onValueChange={v => setFormData(f => ({ ...f, termId: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">First Term</SelectItem>
                    <SelectItem value="second">Second Term</SelectItem>
                    <SelectItem value="third">Third Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Recording...' : 'Record Payment'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map(filter => (
          <Button
            key={filter}
            variant={activeFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(filter)}
            className={cn(activeFilter === filter && 'pointer-events-none')}
          >
            {filter}
          </Button>
        ))}
      </div>

      {/* Data Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} data={tableData} searchKey="studentName" searchPlaceholder="Search student..." />
      )}
    </div>
  );
}
