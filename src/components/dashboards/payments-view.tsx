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
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  receiptNo: string;
  createdAt: string;
  studentId: string;
  parentNote: string | null;
  feeStructureId: string | null;
  feeStructure?: { id: string; name: string; amount: number } | null;
  student?: {
    id: string;
    admissionNo: string;
    user: { name: string | null; email: string | null };
    class: { name: string; section: string | null } | null;
  };
}

type PaymentRow = Payment & { studentName: string };

const statusFilters = ['All', 'Verified', 'Pending', 'Pending Verification', 'Failed'] as const;

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
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [studentSearch, setStudentSearch] = React.useState('');
  const [allStudents, setAllStudents] = React.useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = React.useState(false);
  const [studentPopoverOpen, setStudentPopoverOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(50);
  const [total, setTotal] = React.useState(0);
  React.useEffect(() => setMounted(true), []);

  const totalPages = Math.ceil(total / pageSize);
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  // Form state
  const [formData, setFormData] = React.useState({
    studentId: '',
    amount: '',
    method: 'bank-transfer',
    reference: '',
    termId: 'first',
  });

  // Fetch all students when dialog opens
  const fetchAllStudents = useCallback(async () => {
    if (!schoolId) return;
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/students?schoolId=${schoolId}&limit=500`);
      if (res.ok) {
        const json = await res.json();
        setAllStudents(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch students', err);
    } finally {
      setLoadingStudents(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (open) {
      fetchAllStudents();
      setStudentSearch('');
      setFormData({ studentId: '', amount: '', method: 'bank-transfer', reference: '', termId: 'first' });
    }
  }, [open, fetchAllStudents]);

  // Filter students by search (client-side)
  const filteredStudents = allStudents.filter(s => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return (s.user?.name || '').toLowerCase().includes(q) ||
           (s.admissionNo || '').toLowerCase().includes(q);
  });

  const fetchPayments = useCallback(async () => {
    if (!schoolId || !activeFilter) return;
    try {
      setLoading(true);
      let statusParam = '';
      if (activeFilter === 'Pending Verification') statusParam = 'pending_verification';
      else if (activeFilter !== 'All') statusParam = activeFilter.toLowerCase();
      const url = `/api/payments?schoolId=${schoolId}&page=${page}&limit=${pageSize}${statusParam ? `&status=${statusParam}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load payments');
      const json = await res.json();
      setPayments(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [schoolId, activeFilter, page, pageSize]);

  useEffect(() => { setPage(1); }, [activeFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const tableData = useMemo((): PaymentRow[] => {
    let filtered = payments;
    if (activeFilter === 'Pending Verification') {
      filtered = payments.filter(p => p.status === 'pending_verification');
    } else if (activeFilter !== 'All') {
      filtered = payments.filter(p => p.status.toLowerCase() === activeFilter.toLowerCase());
    }
    return filtered.map(p => ({
      ...p,
      studentName: p.student?.user?.name || p.student?.admissionNo || 'Unknown',
    }));
  }, [activeFilter, payments]);

  const columns: ColumnDef<PaymentRow>[] = [
    { accessorKey: 'studentName', header: 'Student' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `₦${row.getValue<number>('amount').toLocaleString()}` },
    {
      id: 'feeItem',
      header: 'Fee Item',
      cell: ({ row }) => <span className="text-sm">{row.original.feeStructure?.name || '—'}</span>,
    },
    { accessorKey: 'method', header: 'Method' },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => mounted ? new Date(row.getValue<string>('createdAt')).toLocaleDateString() : '' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.getValue<string>('status');
        return (
          <StatusBadge variant={s === 'verified' || s === 'completed' ? 'success' : s === 'pending_verification' ? 'warning' : s === 'pending' ? 'warning' : 'error'} size="sm">
            {s === 'pending_verification' ? 'Pending Verification' : s}
          </StatusBadge>
        );
      },
    },
    { accessorKey: 'receiptNo', header: 'Receipt' },
    {
      id: 'actions',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => handlePrintReceipt(p)} className="text-blue-600 hover:text-blue-700">
              Receipt
            </Button>
            {p.status === 'pending_verification' && (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleVerify(p.id, 'verify')} className="text-emerald-600 hover:text-emerald-700">
                  Verify
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleVerify(p.id, 'reject')} className="text-red-600 hover:text-red-700">
                  Reject
                </Button>
              </>
            )}
            {(p.status === 'pending' || p.status === 'pending_verification' || p.status === 'unpaid') && (
              <Button variant="ghost" size="sm" onClick={() => handleRemind(p.id)} className="text-amber-600 hover:text-amber-700">
                Remind
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const handleVerify = async (paymentId: string, action: 'verify' | 'reject') => {
    try {
      const res = await fetch(`/api/payments/${paymentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to update payment');
      toast.success(`Payment ${action === 'verify' ? 'verified' : 'rejected'} successfully`);
      fetchPayments();
    } catch (err) {
      toast.error('Failed to update payment');
    }
  };

  const handleRemind = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}/remind`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to send reminder');
      toast.success('Reminder sent to parent');
    } catch (err) {
      toast.error('Failed to send reminder');
    }
  };

  const handlePrintReceipt = async (p: PaymentRow) => {
    try {
      const [{ ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY }] = await Promise.all([
        import('@/lib/fonts/arabic-font-data'),
      ]);
      const doc = new jsPDF() as any;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;

      doc.addFileToVFS('NotoNaskhArabic-Regular.ttf', ARABIC_FONT_BASE64);
      doc.addFont('NotoNaskhArabic-Regular.ttf', ARABIC_FONT_FAMILY, 'normal', 'normal', 'Identity-H');
      doc.setFont(ARABIC_FONT_FAMILY, 'normal');
      
      // Diagonal watermark
      doc.setFontSize(60);
      doc.setTextColor(220, 220, 220);
      doc.saveGraphicsState();
      doc.setGState(new (doc.GState || (() => ({ opacity: 0.12 })))());
      doc.text('Skoolar', pageW / 2, pageH / 2, { align: 'center', angle: -30 });
      doc.restoreGraphicsState();
      doc.setTextColor(0, 0, 0);
      
      // Decorative border frame
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(1.5);
      doc.rect(margin, margin, pageW - 2 * margin, pageH - 2 * margin);
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(0.5);
      doc.rect(margin + 3, margin + 3, pageW - 2 * margin - 6, pageH - 2 * margin - 6);
      
      // Receipt Header
      doc.setFontSize(18);
      doc.setTextColor(5, 150, 105);
      doc.text('SKOOLAR', 105, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Payment Receipt', 105, 33, { align: 'center' });
      
      // Receipt details top-right
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Date: ${new Date(p.createdAt).toLocaleDateString()}`, pageW - margin - 5, 22, { align: 'right' });
      doc.text(`Receipt: ${p.receiptNo || 'N/A'}`, pageW - margin - 5, 29, { align: 'right' });
      
      // Green divider
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(0.8);
      doc.line(margin + 5, 40, pageW - margin - 5, 40);
      
      // PAYMENT INFORMATION section
      doc.setFontSize(11);
      doc.setTextColor(5, 150, 105);
      doc.text('PAYMENT INFORMATION', margin + 5, 52);
      
      // Student info in two-column layout
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const leftX = margin + 5;
      const rightX = pageW / 2 + 10;
      const infoY = 62;
      const lineH = 7;
      
      doc.setFont(ARABIC_FONT_FAMILY, 'bold');
      doc.text('Student:', leftX, infoY);
      doc.text('Admission No:', leftX, infoY + lineH);
      doc.text('Class:', leftX, infoY + lineH * 2);
      doc.setFont(ARABIC_FONT_FAMILY, 'normal');
      doc.text(p.studentName || 'N/A', leftX + 25, infoY);
      doc.text(p.student?.admissionNo || 'N/A', leftX + 25, infoY + lineH);
      doc.text(p.student?.class?.name || 'N/A', leftX + 25, infoY + lineH * 2);
      
      doc.setFont(ARABIC_FONT_FAMILY, 'bold');
      doc.text('Method:', rightX, infoY);
      doc.text('Reference:', rightX, infoY + lineH);
      doc.text('Status:', rightX, infoY + lineH * 2);
      doc.setFont(ARABIC_FONT_FAMILY, 'normal');
      doc.text(p.method.toUpperCase(), rightX + 22, infoY);
      doc.text(p.reference || 'N/A', rightX + 22, infoY + lineH);
      doc.text('PAID', rightX + 22, infoY + lineH * 2);
      
      // PAID stamp
      doc.saveGraphicsState();
      doc.setGState(new (doc.GState || (() => ({ opacity: 0.2 })))());
      doc.setFontSize(36);
      doc.setTextColor(5, 150, 105);
      doc.setFont(ARABIC_FONT_FAMILY, 'bold');
      doc.text('PAID', pageW - margin - 5, 70, { align: 'right', angle: -15 });
      doc.restoreGraphicsState();
      doc.setTextColor(0, 0, 0);
      
      // Amount Table
      autoTable(doc, {
        startY: 90,
        head: [['Description', 'Amount']],
        body: [
          ['Fee Payment', `NGN ${p.amount.toLocaleString()}`],
          ['', ''],
          ['', ''],
        ],
        theme: 'grid',
        headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', font: ARABIC_FONT_FAMILY },
        bodyStyles: { fontSize: 9, textColor: [60, 60, 60], font: ARABIC_FONT_FAMILY },
        columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50, halign: 'right' } },
        foot: [['Total Paid', `NGN ${p.amount.toLocaleString()}`]],
        footStyles: { fillColor: [240, 253, 244], textColor: [5, 150, 105], fontSize: 10, fontStyle: 'bold', font: ARABIC_FONT_FAMILY },
      });
      
      // Footer
      const footerY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFont(ARABIC_FONT_FAMILY, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Thank you for your payment.', 105, footerY, { align: 'center' });
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text('This is an electronically generated receipt.', 105, footerY + 6, { align: 'center' });
      doc.setFontSize(7);
      doc.setTextColor(200, 200, 200);
      doc.text('Skoolar - Odebunmi Tawwāb', 105, footerY + 12, { align: 'center' });
      
      doc.save(`Receipt_${p.receiptNo || p.id}.pdf`);
    } catch { toast.error('Failed to generate receipt'); }
  };

  const handleSubmit = async () => {
    if (!formData.amount || !formData.method) {
      toast.error('Please fill in amount and method');
      return;
    }
    if (!schoolId) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
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
          <DialogContent className="w-[95vw]">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>Record a new fee payment from a student.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Student</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search students..." 
                    className="pl-9" 
                    value={studentSearch} 
                    onChange={e => setStudentSearch(e.target.value)} 
                  />
                </div>
                {loadingStudents ? (
                  <div className="text-sm text-muted-foreground py-2">Loading students...</div>
                ) : (
                  <div className="border rounded-md mt-1 divide-y max-h-48 overflow-y-auto">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map(s => (
                        <div 
                          key={s.id} 
                          className={cn(
                            "p-2 hover:bg-emerald-50 cursor-pointer text-sm flex items-center justify-between",
                            formData.studentId === s.id && "bg-emerald-50"
                          )}
                          onClick={() => {
                            setFormData(f => ({ ...f, studentId: s.id }));
                            setStudentSearch(s.user?.name || s.admissionNo || '');
                          }}
                        >
                          <div>
                            <p className="font-medium truncate">{s.user?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{s.admissionNo || ''}{s.class?.name ? ` • ${s.class.name}` : ''}</p>
                          </div>
                          {formData.studentId === s.id && <Plus className="size-4 text-emerald-600 rotate-45" />}
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground text-center">No students found</div>
                    )}
                  </div>
                )}
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
      {!activeFilter ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="size-12 opacity-30 mb-3" />
          <p className="text-lg font-medium">Select a status filter to view payments</p>
          <p className="text-sm">Choose from Verified, Pending, Pending Verification, or Failed above</p>
        </div>
      ) : loading ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} data={tableData} searchKey="studentName" searchPlaceholder="Search student..." />
      )}
      {!loading && activeFilter && total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {showingFrom}-{showingTo} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
