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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Wallet, TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

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
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);
  const [isOptional, setIsOptional] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [classes, setClasses] = React.useState<{id: string, name: string}[]>([]);
  const [selectedClasses, setSelectedClasses] = React.useState<string[]>([]);
  const [stats, setStats] = useState<{feeId: string; feeName: string; expected: number; collected: number; rate: number}[]>([]);

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    amount: '',
    frequency: 'termly',
  });

  // Edit state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingFee, setEditingFee] = React.useState<FeeItem | null>(null);
  const [editFormData, setEditFormData] = React.useState({ name: '', amount: '', frequency: 'termly' });
  const [editIsOptional, setEditIsOptional] = React.useState(false);
  const [editSelectedClasses, setEditSelectedClasses] = React.useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = React.useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletingFee, setDeletingFee] = React.useState<FeeItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);

  const fetchFees = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [feesRes, classesRes, statsRes] = await Promise.all([
        fetch(`/api/fee-structure?schoolId=${schoolId}&limit=100`),
        fetch(`/api/classes?schoolId=${schoolId}&limit=100`),
        fetch(`/api/payments/stats?schoolId=${schoolId}`),
      ]);
      
      if (!feesRes.ok) throw new Error('Failed to load fee structure');
      if (classesRes.ok) {
        const classesJson = await classesRes.json();
        setClasses(classesJson.data || []);
      }
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setStats(statsJson.data?.byFee || []);
      }
      
      const json = await feesRes.json();
      setFeeItems(Array.isArray(json.data?.records || json.data) ? (json.data?.records || json.data) : []);
    } catch (err) {
      toast.error('Failed to load fee structure');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  // Map fee items to table rows with a computed classes field and stats
  const tableData = useMemo(() => {
    const statMap = new Map(stats.map(s => [s.feeId, s]));
    return feeItems.map(f => {
      const s = statMap.get(f.id);
      return {
        id: f.id,
        name: f.name,
        amount: f.amount,
        frequency: f.frequency,
        classes: !f.classIds ? 'All Classes' : (() => {
          try { return JSON.parse(f.classIds).join(', '); } catch { return 'All Classes'; }
        })(),
        status: 'active',
        collected: s?.collected ?? 0,
        expected: s?.expected ?? 0,
        rate: s?.rate ?? 0,
      };
    });
  }, [feeItems, stats]);

  const columns: ColumnDef<{ id: string; name: string; amount: number; frequency: string; classes: string; status: string; collected: number; expected: number; rate: number }>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `₦${row.getValue<number>('amount').toLocaleString()}` },
    { accessorKey: 'frequency', header: 'Frequency' },
    { accessorKey: 'classes', header: 'Classes' },
    {
      id: 'collection',
      header: 'Collection',
      cell: ({ row }) => {
        const rate = row.original.rate;
        const pct = (rate * 100).toFixed(1);
        const color = rate >= 0.8 ? 'bg-emerald-500' : rate >= 0.5 ? 'bg-amber-500' : 'bg-red-500';
        return (
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:min-w-[140px]">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(Number(pct), 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{pct}%</span>
          </div>
        );
      },
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
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const fee = feeItems.find(f => f.id === row.original.id);
        if (!fee) return null;
        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(fee)}>
              <Pencil className="size-4" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => openDelete(fee)}>
              <Trash2 className="size-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        );
      },
    },
  ];

  const totalExpected = feeItems.reduce((sum, f) => sum + (f.amount || 0), 0);

  const openEdit = (fee: FeeItem) => {
    setEditingFee(fee);
    setEditFormData({
      name: fee.name,
      amount: fee.amount.toString(),
      frequency: fee.frequency,
    });
    setEditIsOptional(fee.isOptional);
    try {
      const parsed = fee.classIds ? JSON.parse(fee.classIds) : [];
      setEditSelectedClasses(Array.isArray(parsed) ? parsed : []);
    } catch {
      setEditSelectedClasses([]);
    }
    setEditOpen(true);
  };

  const openDelete = (fee: FeeItem) => {
    setDeletingFee(fee);
    setDeleteOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editFormData.name || !editFormData.amount || !editingFee) {
      toast.error('Please fill in name and amount');
      return;
    }
    try {
      setEditSubmitting(true);
      const res = await fetch(`/api/fee-structure/${editingFee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name,
          amount: parseFloat(editFormData.amount),
          frequency: editFormData.frequency,
          isOptional: editIsOptional,
          classIds: editSelectedClasses.length > 0 ? editSelectedClasses : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update fee item');
      }
      toast.success('Fee item updated successfully');
      setEditOpen(false);
      setEditingFee(null);
      fetchFees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update fee item');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFee) return;
    try {
      setDeleteSubmitting(true);
      const res = await fetch(`/api/fee-structure/${deletingFee.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete fee item');
      }
      toast.success('Fee item deleted successfully');
      setDeleteOpen(false);
      setDeletingFee(null);
      fetchFees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete fee item');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.amount) {
      toast.error('Please fill in name and amount');
      return;
    }
    if (!schoolId) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/fee-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          name: formData.name,
          amount: parseFloat(formData.amount),
          frequency: formData.frequency,
          isOptional,
          classIds: selectedClasses.length > 0 ? selectedClasses : undefined,
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
      setSelectedClasses([]);
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
              <div className="space-y-2">
                <Label>Applicable Classes</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                  <div className="w-full flex items-center gap-2 pb-2 mb-2 border-b">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px]" 
                      onClick={() => setSelectedClasses(classes.map(c => c.id))}
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px]" 
                      onClick={() => setSelectedClasses([])}
                    >
                      Clear
                    </Button>
                  </div>
                  {classes.map(c => (
                    <Badge 
                      key={c.id} 
                      variant={selectedClasses.includes(c.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedClasses(prev => 
                          prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                        );
                      }}
                    >
                      {c.name}
                    </Badge>
                  ))}
                  {classes.length === 0 && <p className="text-xs text-muted-foreground">No classes found</p>}
                </div>
                <p className="text-[10px] text-muted-foreground">If none selected, it applies to all classes by default.</p>
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

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <Wallet className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Expected Revenue per Student</p>
                <p className="text-2xl font-bold">₦{totalExpected.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Collection Rate</p>
                <p className="text-2xl font-bold">
                  {stats.length > 0
                    ? `${(stats.reduce((a, b) => a + b.rate, 0) / stats.length * 100).toFixed(1)}%`
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Fee Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditingFee(null); setEditOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fee Item</DialogTitle>
            <DialogDescription>Update the fee item details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="e.g. Science Lab Fee" value={editFormData.name} onChange={e => setEditFormData(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input placeholder="25000" type="number" value={editFormData.amount} onChange={e => setEditFormData(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={editFormData.frequency} onValueChange={v => setEditFormData(f => ({ ...f, frequency: v }))}>
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
              <Switch checked={editIsOptional} onCheckedChange={setEditIsOptional} />
            </div>
            <div className="space-y-2">
              <Label>Applicable Classes</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                <div className="w-full flex items-center gap-2 pb-2 mb-2 border-b">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setEditSelectedClasses(classes.map(c => c.id))}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setEditSelectedClasses([])}>
                    Clear
                  </Button>
                </div>
                {classes.map(c => (
                  <Badge key={c.id} variant={editSelectedClasses.includes(c.id) ? "default" : "outline"} className="cursor-pointer" onClick={() => setEditSelectedClasses(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                    {c.name}
                  </Badge>
                ))}
                {classes.length === 0 && <p className="text-xs text-muted-foreground">No classes found</p>}
              </div>
              <p className="text-[10px] text-muted-foreground">If none selected, it applies to all classes by default.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditingFee(null); }}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Fee Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!open) { setDeletingFee(null); setDeleteOpen(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fee Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingFee?.name}</strong>? This action cannot be undone. All associated payment records will be retained but the fee will be removed from the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeletingFee(null); setDeleteOpen(false); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteSubmitting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
