'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Receipt, Wallet, TrendingDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Expense {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  category: string;
  date: string;
  paidTo: string | null;
  status: string;
}

const CATEGORIES = [
  'Salary',
  'Utility',
  'Maintenance',
  'Supplies',
  'Rent',
  'Marketing',
  'Others',
];

function TableSkeleton() {
  return <Skeleton className="h-[400px] rounded-xl" />;
}

export function ExpensesView() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [mounted, setMounted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    title: '',
    amount: '',
    category: 'Others',
    description: '',
    paidTo: '',
    date: '',
  });

  const fetchExpenses = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ schoolId, limit: '100' });
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);
      const res = await fetch(`/api/expenses?${params}`);
      if (!res.ok) throw new Error('Failed to load expenses');
      const json = await res.json();
      setExpenses(json.data?.records || json.data || []);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [schoolId, dateRange]);

  useEffect(() => {
    const now = new Date();
    const today = now.toISOString();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    setFormData(prev => ({ ...prev, date: today.split('T')[0] }));
    setCurrentMonth(today.slice(0, 7));
    setDateRange({ start: firstOfMonth, end: today.split('T')[0] });
    setMounted(true);
  }, []);

  useEffect(() => {
    if (dateRange.start) fetchExpenses();
  }, [fetchExpenses, dateRange]);

  const columns: ColumnDef<Expense>[] = [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `₦${row.getValue<number>('amount').toLocaleString()}` },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => mounted ? new Date(row.getValue<string>('date')).toLocaleDateString() : '' },
    { accessorKey: 'paidTo', header: 'Paid To' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge variant={row.getValue<string>('status') === 'paid' ? 'success' : 'warning'} size="sm">
          {row.getValue<string>('status')}
        </StatusBadge>
      ),
    },
  ];

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleSubmit = async () => {
    if (!formData.title || !formData.amount) {
      toast.error('Please fill in title and amount');
      return;
    }
    if (!schoolId) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });
      if (!res.ok) throw new Error('Failed to record expense');
      toast.success('Expense recorded successfully');
      setOpen(false);
      setFormData({
        title: '',
        amount: '',
        category: 'Others',
        description: '',
        paidTo: '',
        date: new Date().toISOString().split('T')[0],
      });
      fetchExpenses();
    } catch (err) {
      toast.error('Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Expenses</h2>
          <p className="text-sm text-muted-foreground">Track school spending and overheads</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700"><Plus className="size-4 mr-2" />Add Expense</Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw]">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>Record a new expenditure for the school.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="e.g. Monthly Electricity Bill" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₦)</Label>
                  <Input placeholder="50000" type="number" value={formData.amount} onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={v => setFormData(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Paid To</Label>
                <Input placeholder="e.g. PHCN / Vendor Name" value={formData.paidTo} onChange={e => setFormData(f => ({ ...f, paidTo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Input placeholder="Brief details..." value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-red-600 hover:bg-red-700">
                {submitting ? 'Recording...' : 'Record Expense'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">From</Label>
          <Input
            type="date"
            value={dateRange.start}
            onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
            className="w-[160px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">To</Label>
          <Input
            type="date"
            value={dateRange.end}
            onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
            className="w-[160px]"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const now = new Date();
            const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const today = now.toISOString().split('T')[0];
            setDateRange({ start: firstOfMonth, end: today });
          }}
        >
          This Month
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateRange({ start: '', end: '' })}
        >
          All Time
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <TrendingDown className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-xl font-bold">₦{totalExpenses.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Receipt className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entries</p>
              <p className="text-xl font-bold">{expenses.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-xl font-bold">₦{mounted ? expenses.filter(e => e.date.startsWith(currentMonth)).reduce((s, e) => s + e.amount, 0).toLocaleString() : '0'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} data={expenses} searchKey="title" searchPlaceholder="Search expenses..." />
      )}
    </div>
  );
}
