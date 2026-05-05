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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';

interface FeeItem {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  classIds: string | null;
  isOptional: boolean;
  isLatePayment: boolean;
  createdAt: string;
}

function TableSkeleton() {
  return <Skeleton className="h-[400px] rounded-xl" />;
}

export function FeeStructureView() {
  const { selectedSchoolId } = useAppStore();
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);
  const [isOptional, setIsOptional] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    amount: '',
    frequency: 'termly',
  });

  const fetchFees = useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/fee-structure?schoolId=${selectedSchoolId}&limit=100`);
      if (!res.ok) throw new Error('Failed to load fee structure');
      const json = await res.json();
      setFeeItems(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      toast.error('Failed to load fee structure');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  // Map fee items to table rows with a computed classes field
  const tableData = useMemo(() => {
    return feeItems.map(f => ({
      id: f.id,
      name: f.name,
      amount: f.amount,
      frequency: f.frequency,
      classes: !f.classIds ? 'All Classes' : (() => {
        try { return JSON.parse(f.classIds).join(', '); } catch { return 'All Classes'; }
      })(),
      status: 'active',
    }));
  }, [feeItems]);

  const columns: ColumnDef<{ id: string; name: string; amount: number; frequency: string; classes: string; status: string }>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `₦${row.getValue<number>('amount').toLocaleString()}` },
    { accessorKey: 'frequency', header: 'Frequency' },
    { accessorKey: 'classes', header: 'Classes' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge variant={row.getValue<string>('status') === 'active' ? 'success' : 'neutral'} size="sm">
          {row.getValue<string>('status')}
        </StatusBadge>
      ),
    },
  ];

  const totalExpected = feeItems.reduce((sum, f) => sum + (f.amount || 0), 0);

  const handleSubmit = async () => {
    if (!formData.name || !formData.amount) {
      toast.error('Please fill in name and amount');
      return;
    }
    if (!selectedSchoolId) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/fee-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          name: formData.name,
          amount: parseFloat(formData.amount),
          frequency: formData.frequency,
          isOptional,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create fee item');
      }
      toast.success('Fee item created successfully');
      setOpen(false);
      setFormData({ name: '', amount: '', frequency: 'termly' });
      setIsOptional(false);
      fetchFees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create fee item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fee Structure</h2>
          <p className="text-sm text-muted-foreground">Manage school fee items and pricing</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Add Fee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Fee Item</DialogTitle>
              <DialogDescription>Create a new fee item for the school.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="e.g. Science Lab Fee" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Amount (₦)</Label>
                <Input placeholder="25000" type="number" value={formData.amount} onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={formData.frequency} onValueChange={v => setFormData(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="termly">Termly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Is Optional</Label>
                  <p className="text-xs text-muted-foreground">Students can opt out of this fee</p>
                </div>
                <Switch checked={isOptional} onCheckedChange={setIsOptional} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Creating...' : 'Add Fee'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Fee Items Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} data={tableData} searchKey="name" searchPlaceholder="Search fee items..." />
      )}

      {/* Total Expected Revenue */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expected Revenue per Student (All Fees)</p>
              <p className="text-2xl font-bold">₦{totalExpected.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
