'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Building2, CreditCard, CheckCircle, AlertCircle, Clock, Zap, Download, Search, RefreshCw,
  XCircle, Crown, ChevronDown, ChevronRight, Trash2, Calendar, ExternalLink,
} from 'lucide-react';

interface Plan { id: string; name: string; displayName: string; pricingType: string; price: number; warningDays: number; }

interface PricingRecord {
  id: string; planId: string; schoolType: string; monthlyPrice: number; termPrice: number; sessionPrice: number;
  plan: { id: string; name: string; displayName: string };
}

interface PaymentEntry {
  id: string; status: string; startDate: string; endDate: string; duration: string | null;
  amount: number; reference: string; channel: string | null; createdAt: string; planDisplayName: string | null; receiptNo: string | null;
}

interface SchoolData {
  id: string; name: string; email: string | null; phone: string | null;
  schoolType: string | null; plan: string; planId: string | null; isActive: boolean;
  logo: string | null; region: string | null; createdAt: string;
  _count: { students: number; teachers: number; classes: number };
  latestPayment: PaymentEntry | null;
  allPayments: PaymentEntry[];
  pendingPayments: PaymentEntry[];
  subscriptionStatus: 'active' | 'expiring_soon' | 'expired' | 'free' | 'none';
}

interface DashboardData {
  schools: SchoolData[]; plans: Plan[]; pricing: PricingRecord[];
  stats: { totalSchools: number; active: number; expired: number; expiringSoon: number; pendingApprovals: number; };
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  active: { label: 'Active', variant: 'default', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  expiring_soon: { label: 'Expiring Soon', variant: 'secondary', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', variant: 'destructive', className: 'bg-red-100 text-red-700 border-red-200' },
  trial: { label: 'Trial', variant: 'outline', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  none: { label: 'No Plan', variant: 'outline', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const paymentStatusConfig: Record<string, { label: string; className: string }> = {
  success: { label: 'Paid', className: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  pending_verification: { label: 'Awaiting Verification', className: 'bg-blue-100 text-blue-700' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-500' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toISOString().split('T')[0];
}

function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function generateReceiptNumber(): string {
  return `RCP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

async function downloadReceipt(payment: PaymentEntry, schoolName: string) {
  try {
    const [{ ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY }, { jsPDF }] = await Promise.all([
      import('@/lib/fonts/arabic-font-data'),
      import('jspdf'),
    ]);
    const { autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    doc.addFileToVFS('NotoNaskhArabic-Regular.ttf', ARABIC_FONT_BASE64);
    doc.addFont('NotoNaskhArabic-Regular.ttf', ARABIC_FONT_FAMILY, 'normal', 'normal', 'Identity-H');
    doc.setFont(ARABIC_FONT_FAMILY, 'normal');

    // Border frame
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(1.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
    doc.setLineWidth(0.5);
    doc.rect(margin + 3, margin + 3, pageWidth - 2 * margin - 6, pageHeight - 2 * margin - 6);

    // Header
    doc.setFontSize(20);
    doc.setTextColor(22, 163, 74);
    doc.text('SKOOLAR', pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Subscription Payment Receipt', pageWidth / 2, 33, { align: 'center' });

    // Receipt metadata
    const receiptNumber = payment.receiptNo || generateReceiptNumber();
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Receipt No: ${receiptNumber}`, pageWidth - margin, 20, { align: 'right' });
    doc.text(`Date Issued: ${formatDate(payment.createdAt)}`, pageWidth - margin, 27, { align: 'right' });

    // Divider
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.5);
    doc.line(margin + 5, 39, pageWidth - margin - 5, 39);

    autoTable(doc, {
      startY: 44,
      head: [['Field', 'Details']],
      body: [
        ['School', schoolName],
        ['Reference', payment.reference],
        ['Plan', payment.planDisplayName || 'N/A'],
        ['Amount', `₦${payment.amount.toLocaleString()}`],
        ['Start Date', formatDate(payment.startDate)],
        ['End Date', formatDate(payment.endDate)],
        ['Duration', payment.duration || 'N/A'],
        ['Channel', payment.channel || 'N/A'],
        ['Status', 'Paid'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontSize: 9, font: ARABIC_FONT_FAMILY },
      styles: { fontSize: 8, font: ARABIC_FONT_FAMILY },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFont(ARABIC_FONT_FAMILY, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for choosing Skoolar!', pageWidth / 2, finalY + 15, { align: 'center' });
    doc.text('This is a computer-generated receipt.', pageWidth / 2, finalY + 21, { align: 'center' });

    doc.save(`Skoolar_Receipt_${receiptNumber}.pdf`);
  } catch { toast.error('Failed to generate receipt'); }
}

function RevenueChart({ payments }: { payments: PaymentEntry[] }) {
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    const success = payments.filter(p => p.status === 'success' && p.amount > 0);
    for (const p of success) {
      const month = new Date(p.createdAt).toISOString().slice(0, 7);
      map.set(month, (map.get(month) || 0) + p.amount);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  }, [payments]);

  if (monthlyData.length === 0) return null;

  const maxVal = Math.max(...monthlyData.map(([, v]) => v), 1);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Monthly Revenue (₦)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-24">
          {monthlyData.map(([month, total]) => (
            <div key={month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground">₦{(total / 1000).toFixed(0)}k</span>
              <div className="w-full bg-emerald-100 rounded-t" style={{ height: `${(total / maxVal) * 100}%`, minHeight: 4 }} />
              <span className="text-[8px] text-muted-foreground">{month.slice(5)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentHistoryDialog({
  open, onOpenChange, school, onDelete, onRefresh,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; school: SchoolData | null;
  onDelete: (paymentId: string) => void; onRefresh: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Delete this payment record? This cannot be undone.')) return;
    setDeleting(paymentId);
    try {
      const res = await fetch(`/api/subscription/dashboard?id=${paymentId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Payment deleted'); onDelete(paymentId); onRefresh(); }
      else toast.error(json.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  if (!school) return null;

  const payments = school.allPayments || [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Payment History — {school.name}</DialogTitle>
          <DialogDescription>Current plan: {school.latestPayment?.planDisplayName || school.plan} &middot; {payments.length} total records</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr className="border-b">
                <th className="text-left py-2.5 px-3 font-medium text-xs">Date</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs">Plan</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs">Reference</th>
                <th className="text-right py-2.5 px-3 font-medium text-xs">Amount</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs hidden md:table-cell">Duration</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs hidden md:table-cell">Period</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs">Status</th>
                <th className="text-right py-2.5 px-3 font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No payment records.</td></tr>
              ) : (
                payments.map(p => {
                  const cfg = paymentStatusConfig[p.status] || { label: p.status, className: '' };
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-3 text-xs">{formatDate(p.createdAt)}</td>
                      <td className="py-2 px-3 text-xs">{p.planDisplayName || '-'}</td>
                      <td className="py-2 px-3 text-xs font-mono text-[10px]">{p.reference.slice(0, 24)}</td>
                      <td className="py-2 px-3 text-xs text-right">₦{p.amount.toLocaleString()}</td>
                      <td className="py-2 px-3 text-xs hidden md:table-cell">{p.duration || '-'}</td>
                      <td className="py-2 px-3 text-xs hidden md:table-cell">{formatDate(p.startDate)} &rarr; {formatDate(p.endDate)}</td>
                      <td className="py-2 px-3 text-xs">
                        <Badge className={cn('text-[10px] px-1.5 py-0', cfg.className)}>{cfg.label}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {p.status === 'success' && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Download Receipt" onClick={() => downloadReceipt(p, school.name)}>
                              <Download className="size-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" title="Delete" onClick={() => handleDelete(p.id)} disabled={deleting === p.id}>
                            {deleting === p.id ? <RefreshCw className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchoolDetailDialog({
  open, onOpenChange, school, plans, onRefresh, onDeletePayment,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; school: SchoolData | null; plans: Plan[];
  onRefresh: () => void; onDeletePayment: (id: string) => void;
}) {
  const [planId, setPlanId] = useState('');
  const [duration, setDuration] = useState('term');
  const [customEndDate, setCustomEndDate] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quickDays, setQuickDays] = useState(30);
  const [mode, setMode] = useState<'upgrade' | 'extend' | 'history'>('upgrade');
  const [durationMode, setDurationMode] = useState<'duration' | 'customDate' | 'days'>('duration');
  const [upgradeDays, setUpgradeDays] = useState(30);

  useEffect(() => {
    if (!open) return;
    setPlanId(school?.planId || plans.find(p => p.name === 'pro')?.id || plans[0]?.id || '');
    setDuration('term');
    setCustomEndDate('');
    setUseCustomDate(false);
    setMode('upgrade');
    setQuickDays(30);
    setDurationMode('duration');
    setUpgradeDays(30);
  }, [open, school, plans]);

  const computedEndDate = useMemo(() => {
    if (durationMode === 'customDate') return customEndDate || 'Not set';
    if (durationMode === 'days') {
      const d = new Date();
      d.setDate(d.getDate() + upgradeDays);
      return d.toISOString().split('T')[0];
    }
    const months: Record<string, number> = { monthly: 1, term: 4, session: 10 };
    const d = new Date();
    d.setMonth(d.getMonth() + (months[duration] || 4));
    return d.toISOString().split('T')[0];
  }, [duration, durationMode, customEndDate, upgradeDays]);

  if (!school) return null;

  const handleUpgrade = async () => {
    if (!planId) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { schoolId: school.id, planId };
      if (durationMode === 'customDate') {
        if (!customEndDate) { toast.error('Set expiration date'); setSubmitting(false); return; }
        body.endDate = customEndDate;
      } else if (durationMode === 'days') {
        body.days = upgradeDays;
      } else {
        body.duration = duration;
      }
      const res = await fetch('/api/subscription/manual-upgrade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { toast.success(json.message); onRefresh(); onOpenChange(false); }
      else toast.error(json.error);
    } catch { toast.error('Failed'); }
    finally { setSubmitting(false); }
  };

  const handleExtendDays = async () => {
    if (!school.latestPayment) { toast.error('No active payment to extend'); return; }
    setSubmitting(true);
    try {
      const newEnd = new Date();
      newEnd.setDate(newEnd.getDate() + quickDays);
      const res = await fetch('/api/subscription/dashboard', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: school.latestPayment.id, action: 'extend', endDate: newEnd.toISOString() }),
      });
      const json = await res.json();
      if (json.success) { toast.success(json.message); onRefresh(); onOpenChange(false); }
      else toast.error(json.error);
    } catch { toast.error('Failed to extend'); }
    finally { setSubmitting(false); }
  };

  const days = daysUntil(school.latestPayment?.endDate ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{school.name}</DialogTitle>
          <DialogDescription>
            {school.latestPayment?.planDisplayName || school.plan} &middot;
            {days !== null ? (days > 0 ? `${days} days remaining` : 'Expired') : 'No active subscription'}
          </DialogDescription>
        </DialogHeader>

        {/* Quick info */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-muted p-2">
            <p className="text-lg font-bold">{school._count.students}</p>
            <p className="text-[10px] text-muted-foreground">Students</p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-lg font-bold">{school._count.teachers}</p>
            <p className="text-[10px] text-muted-foreground">Teachers</p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-lg font-bold">{school.allPayments.length}</p>
            <p className="text-[10px] text-muted-foreground">Payments</p>
          </div>
        </div>

        <Tabs value={mode} onValueChange={v => setMode(v as typeof mode)} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="upgrade" className="flex-1 text-xs">Change Plan</TabsTrigger>
            <TabsTrigger value="extend" className="flex-1 text-xs">Extend</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 text-xs">History</TabsTrigger>
          </TabsList>

          <TabsContent value="upgrade" className="space-y-3 pt-3">
            <div className="grid gap-2">
              <Label>New Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {(['duration', 'customDate', 'days'] as const).map(opt => (
                <Button key={opt} variant={durationMode === opt ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setDurationMode(opt)}>
                  {opt === 'duration' ? 'Standard' : opt === 'customDate' ? 'End Date' : 'Days'}
                </Button>
              ))}
            </div>
            {durationMode === 'customDate' ? (
              <div className="grid gap-2">
                <Label>Expiration Date</Label>
                <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
              </div>
            ) : durationMode === 'days' ? (
              <div className="grid gap-2">
                <Label>Number of Days</Label>
                <div className="flex gap-2">
                  {[7, 14, 30, 60, 90].map(d => (
                    <Button key={d} variant={upgradeDays === d ? 'default' : 'outline'} size="sm" onClick={() => setUpgradeDays(d)} className="flex-1 text-xs">{d}d</Button>
                  ))}
                </div>
                <Input type="number" value={upgradeDays} onChange={e => setUpgradeDays(parseInt(e.target.value) || 30)} min={1} className="mt-1" />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly (1 month)</SelectItem>
                    <SelectItem value="term">Term (4 months)</SelectItem>
                    <SelectItem value="session">Session (10 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-lg bg-muted p-2 text-xs"><span className="font-medium">End date:</span> {computedEndDate}</div>
            <Button onClick={handleUpgrade} disabled={submitting} className="w-full">{submitting ? 'Applying...' : 'Apply Change'}</Button>
          </TabsContent>

          <TabsContent value="extend" className="space-y-3 pt-3">
            <div className="grid gap-2">
              <Label>Extend by (days)</Label>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90].map(d => (
                  <Button key={d} variant={quickDays === d ? 'default' : 'outline'} size="sm" onClick={() => setQuickDays(d)} className="flex-1 text-xs">{d}d</Button>
                ))}
              </div>
              <Input type="number" value={quickDays} onChange={e => setQuickDays(parseInt(e.target.value) || 30)} min={1} className="mt-1" />
            </div>
            {school.latestPayment && (
              <div className="rounded-lg bg-muted p-2 text-xs">
                Current end: {formatDate(school.latestPayment.endDate)} &rarr; New:{' '}
                {new Date(Date.now() + quickDays * 86400000).toISOString().split('T')[0]}
              </div>
            )}
            <Button onClick={handleExtendDays} disabled={submitting || !school.latestPayment} className="w-full">
              {submitting ? 'Extending...' : 'Extend Subscription'}
            </Button>
            {!school.latestPayment && <p className="text-xs text-muted-foreground text-center">No active payment to extend.</p>}
          </TabsContent>

          <TabsContent value="history" className="pt-3">
            <div className="max-h-48 overflow-y-auto space-y-1">
              {school.allPayments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No payment records.</p>
              ) : (
                school.allPayments.slice(0, 20).map(p => {
                  const cfg = paymentStatusConfig[p.status];
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{p.planDisplayName || '-'} — ₦{p.amount.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(p.createdAt)} &middot; {p.reference.slice(0, 16)}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Badge className={cn('text-[10px] px-1.5 py-0', cfg?.className)}>{cfg?.label || p.status}</Badge>
                        {p.status === 'success' && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => downloadReceipt(p, school.name)}>
                            <Download className="size-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={async () => { try { const res = await fetch(`/api/subscription/dashboard?id=${p.id}`, { method: 'DELETE' }); const j = await res.json(); if (j.success) { toast.success('Deleted'); onDeletePayment(p.id); onRefresh(); } } catch {} }}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApproveDialog({
  open, onOpenChange, payment, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  payment: { id: string; amount: number; planDisplayName: string | null; schoolName?: string } | null;
  onSuccess: () => void;
}) {
  const [customEndDate, setCustomEndDate] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!open) { setCustomEndDate(''); setUseCustomDate(false); } }, [open]);

  const handleApprove = async () => {
    if (!payment) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { action: 'approve' };
      if (useCustomDate && customEndDate) body.endDate = customEndDate;
      const res = await fetch(`/api/subscription/requests/${payment.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { toast.success('Approved'); onSuccess(); onOpenChange(false); }
      else toast.error(json.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!payment) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/subscription/requests/${payment.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }),
      });
      const json = await res.json();
      if (json.success) { toast.success('Rejected'); onSuccess(); onOpenChange(false); }
      else toast.error(json.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review — {payment?.schoolName || ''}</DialogTitle>
          <DialogDescription>{payment?.planDisplayName} &middot; ₦{payment?.amount?.toLocaleString()}</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="customDateApprove" checked={useCustomDate} onChange={e => setUseCustomDate(e.target.checked)} className="size-4" />
            <Label htmlFor="customDateApprove" className="cursor-pointer text-xs">Set custom expiration date</Label>
          </div>
          {useCustomDate && (
            <div className="grid gap-2">
              <Label>Expiration Date</Label>
              <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleReject} disabled={submitting}>Reject</Button>
          <Button onClick={handleApprove} disabled={submitting}>{submitting ? '...' : 'Approve'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PricingEditor({ pricing, onUpdate }: { pricing: PricingRecord[]; onUpdate: () => void }) {
  const [editValues, setEditValues] = useState<Record<string, Record<string, number>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleSave = async (id: string) => {
    const vals = editValues[id];
    if (!vals) return;
    setSavingId(id);
    try {
      const res = await fetch('/api/subscription/pricing', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...vals }),
      });
      const json = await res.json();
      if (json.success) { toast.success('Pricing updated'); onUpdate(); setEditValues(prev => { const n = { ...prev }; delete n[id]; return n; }); }
      else toast.error(json.error || 'Failed');
    } catch { toast.error('Failed to save'); }
    finally { setSavingId(null); }
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/50">
          <th className="text-left py-3 px-4 font-medium text-xs">Plan</th>
          <th className="text-left py-3 px-4 font-medium text-xs">School Type</th>
          <th className="text-right py-3 px-4 font-medium text-xs">Monthly (₦)</th>
          <th className="text-right py-3 px-4 font-medium text-xs">Term (₦)</th>
          <th className="text-right py-3 px-4 font-medium text-xs">Session (₦)</th>
          <th className="text-right py-3 px-4 font-medium text-xs"></th>
        </tr></thead>
        <tbody>
          {pricing.length === 0 ? (
            <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No pricing configured.</td></tr>
          ) : (
            pricing.map(p => {
              const vals = editValues[p.id] || {};
              const hasChanges = Object.keys(vals).length > 0;
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-4 text-xs font-medium">{p.plan.displayName}</td>
                  <td className="py-2 px-4 text-xs capitalize">{p.schoolType.replace(/_/g, ' ')}</td>
                  {(['monthlyPrice', 'termPrice', 'sessionPrice'] as const).map(field => (
                    <td key={field} className="py-2 px-4 text-right">
                      <Input type="number" className="h-8 w-24 ml-auto text-xs text-right"
                        defaultValue={p[field]}
                        onChange={e => setEditValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], [field]: parseInt(e.target.value) || 0 } }))} />
                    </td>
                  ))}
                  <td className="py-2 px-4 text-right">
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleSave(p.id)} disabled={!hasChanges || savingId === p.id}>
                      {savingId === p.id ? '...' : 'Save'}
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SubscriptionDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null);
  const [historySchool, setHistorySchool] = useState<SchoolData | null>(null);
  const [approvePayment, setApprovePayment] = useState<{ id: string; amount: number; planDisplayName: string | null; schoolName?: string } | null>(null);
  const [tab, setTab] = useState('schools');
  const [deletedPaymentIds, setDeletedPaymentIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscription/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
      else toast.error('Failed to load');
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = data?.stats;

  const allPayments = useMemo(() => {
    if (!data) return [];
    const result: (PaymentEntry & { schoolName: string; schoolId: string })[] = [];
    for (const s of data.schools) {
      for (const p of s.allPayments) {
        result.push({ ...p, schoolName: s.name, schoolId: s.id });
      }
    }
    return result;
  }, [data]);

  const pendingList = useMemo(() => {
    if (!data) return [];
    const result: (PaymentEntry & { schoolName: string; schoolId: string })[] = [];
    for (const s of data.schools) {
      for (const p of s.pendingPayments) {
        result.push({ ...p, schoolName: s.name, schoolId: s.id });
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const filteredSchools = useMemo(() => {
    if (!data) return [];
    return data.schools.filter(s => {
      const ms = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase());
      const mf = statusFilter === 'all' || s.subscriptionStatus === statusFilter;
      const mp = planFilter === 'all' || s.plan === planFilter || s.latestPayment?.planDisplayName === planFilter;
      return ms && mf && mp;
    });
  }, [data, search, statusFilter, planFilter]);

  const statCards = stats ? [
    { label: 'Total Schools', value: stats.totalSchools, icon: <Building2 className="size-4" />, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Active', value: stats.active, icon: <CheckCircle className="size-4" />, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Expiring Soon', value: stats.expiringSoon, icon: <Clock className="size-4" />, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Expired', value: stats.expired, icon: <XCircle className="size-4" />, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Pending', value: stats.pendingApprovals, icon: <CreditCard className="size-4" />, color: 'text-violet-600', bg: 'bg-violet-100' },
  ] : [];

  const handleDeletePayment = (paymentId: string) => {
    setDeletedPaymentIds(prev => new Set(prev).add(paymentId));
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-12" /></Card>)}
        </div>
        <Card className="p-8"><Skeleton className="h-6 w-48 mb-4" /><Skeleton className="h-64 w-full" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">Subscription Dashboard</h2>
          <p className="text-sm text-muted-foreground">Manage all school subscriptions — plans, payments, expiry, and pricing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('size-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className={cn('size-6 rounded-lg flex items-center justify-center', s.bg)}>{s.icon}</div>
              {s.label}
            </div>
            <p className={cn('text-2xl font-bold mt-2', s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Revenue mini chart */}
      {data && <RevenueChart payments={allPayments} />}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="schools">All Schools <Badge variant="secondary" className="ml-1.5 text-[10px]">{filteredSchools.length}</Badge></TabsTrigger>
          <TabsTrigger value="pending">Pending Requests {pendingList.length > 0 && <Badge className="ml-1.5 text-[10px]">{pendingList.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="payments">All Payments <Badge variant="secondary" className="ml-1.5 text-[10px]">{allPayments.length}</Badge></TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        {/* === SCHOOLS TAB === */}
        <TabsContent value="schools" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search schools..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="free">Free Plan</SelectItem>
                <SelectItem value="none">No Plan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {data?.plans.map(p => <SelectItem key={p.id} value={p.name}>{p.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2.5 px-3 font-medium text-xs">School</th>
                  <th className="text-left py-2.5 px-3 font-medium text-xs">Plan</th>
                  <th className="text-left py-2.5 px-3 font-medium text-xs hidden md:table-cell">Duration</th>
                  <th className="text-left py-2.5 px-3 font-medium text-xs hidden lg:table-cell">Start</th>
                  <th className="text-left py-2.5 px-3 font-medium text-xs hidden lg:table-cell">End</th>
                  <th className="text-center py-2.5 px-3 font-medium text-xs">Status</th>
                  <th className="text-center py-2.5 px-3 font-medium text-xs hidden sm:table-cell">Days</th>
                  <th className="text-right py-2.5 px-3 font-medium text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchools.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No schools match your filters.</td></tr>
                ) : (
                  filteredSchools.map(s => {
                    const days = daysUntil(s.latestPayment?.endDate ?? null);
                    const cfg = statusConfig[s.subscriptionStatus];
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedSchool(s)}>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-xs">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.email || s.phone || ''}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-xs">{s.latestPayment?.planDisplayName || s.plan}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-xs hidden md:table-cell">{s.latestPayment?.duration || '-'}</td>
                        <td className="py-2.5 px-3 text-xs hidden lg:table-cell">{formatDate(s.latestPayment?.startDate)}</td>
                        <td className="py-2.5 px-3 text-xs hidden lg:table-cell">{formatDate(s.latestPayment?.endDate)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge className={cn('text-[10px] px-1.5 py-0', cfg.className)}>{cfg.label}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                          {days !== null ? (
                            <span className={cn('text-xs font-medium', days <= 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground')}>
                              {days > 0 ? `${days}d` : 'Overdue'}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Manage" onClick={() => setSelectedSchool(s)}>
                              <ExternalLink className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Payment History" onClick={() => setHistorySchool(s)}>
                              <Calendar className="size-3.5" />
                            </Button>
                            {s.latestPayment && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Download Receipt" onClick={() => downloadReceipt(s.latestPayment!, s.name)}>
                                <Download className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-muted-foreground text-right">
            Showing {filteredSchools.length} of {data?.schools.length || 0} schools
          </div>
        </TabsContent>

        {/* === PENDING TAB === */}
        <TabsContent value="pending">
          {pendingList.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No pending requests.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left py-2.5 px-3 font-medium text-xs">School</th>
                  <th className="text-left py-2.5 px-3 font-medium text-xs">Plan</th>
                  <th className="text-right py-2.5 px-3 font-medium text-xs">Amount</th>
                  <th className="text-left py-2.5 px-3 font-medium text-xs">Channel</th>
                  <th className="text-left py-2.5 px-3 font-medium text-xs hidden md:table-cell">Date</th>
                  <th className="text-center py-2.5 px-3 font-medium text-xs">Status</th>
                  <th className="text-right py-2.5 px-3 font-medium text-xs">Actions</th>
                </tr></thead>
                <tbody>
                  {pendingList.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 px-3 text-xs font-medium">{p.schoolName}</td>
                      <td className="py-2.5 px-3 text-xs">{p.planDisplayName || '-'}</td>
                      <td className="py-2.5 px-3 text-xs text-right">₦{p.amount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-xs">{p.channel || '-'}</td>
                      <td className="py-2.5 px-3 text-xs hidden md:table-cell">{formatDate(p.createdAt)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge className={cn('text-[10px] px-1.5 py-0', paymentStatusConfig[p.status]?.className)}>
                          {paymentStatusConfig[p.status]?.label || p.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button size="sm" className="h-7 text-xs" onClick={() => setApprovePayment({ ...p, schoolName: p.schoolName })}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* === ALL PAYMENTS TAB === */}
        <TabsContent value="payments">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left py-2.5 px-3 font-medium text-xs">School</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs">Plan</th>
                <th className="text-right py-2.5 px-3 font-medium text-xs">Amount</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs hidden md:table-cell">Reference</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs">Status</th>
                <th className="text-left py-2.5 px-3 font-medium text-xs hidden lg:table-cell">Date</th>
                <th className="text-right py-2.5 px-3 font-medium text-xs">Actions</th>
              </tr></thead>
              <tbody>
                {allPayments.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No payment records.</td></tr>
                ) : (
                  allPayments.slice(0, 200).map(p => {
                    const cfg = paymentStatusConfig[p.status];
                    return (
                      <tr key={p.id} className={cn('border-b last:border-0 hover:bg-muted/30', deletedPaymentIds.has(p.id) && 'opacity-40')}>
                        <td className="py-2 px-3 text-xs font-medium">{p.schoolName}</td>
                        <td className="py-2 px-3 text-xs">{p.planDisplayName || '-'}</td>
                        <td className="py-2 px-3 text-xs text-right">₦{p.amount.toLocaleString()}</td>
                        <td className="py-2 px-3 text-xs font-mono text-[10px] hidden md:table-cell">{p.reference.slice(0, 20)}</td>
                        <td className="py-2 px-3 text-xs">
                          <Badge className={cn('text-[10px] px-1.5 py-0', cfg?.className)}>{cfg?.label || p.status}</Badge>
                        </td>
                        <td className="py-2 px-3 text-xs hidden lg:table-cell">{formatDate(p.createdAt)}</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {p.status === 'success' && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Receipt" onClick={() => downloadReceipt(p, p.schoolName)}>
                                <Download className="size-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" title="Delete"
                              onClick={async () => {
                                if (!confirm('Delete this payment?')) return;
                                const res = await fetch(`/api/subscription/dashboard?id=${p.id}`, { method: 'DELETE' });
                                const json = await res.json();
                                if (json.success) { toast.success('Deleted'); handleDeletePayment(p.id); fetchData(); }
                                else toast.error(json.error || 'Failed');
                              }}>
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground text-right mt-2">Showing up to 200 most recent records</p>
        </TabsContent>

        {/* === PRICING TAB === */}
        <TabsContent value="pricing">
          {data?.pricing ? <PricingEditor pricing={data.pricing} onUpdate={fetchData} /> : <p className="text-sm text-muted-foreground py-4">No pricing data.</p>}
        </TabsContent>
      </Tabs>

      {/* School Detail Dialog */}
      <SchoolDetailDialog
        open={!!selectedSchool}
        onOpenChange={(v) => { if (!v) setSelectedSchool(null); }}
        school={selectedSchool}
        plans={data?.plans || []}
        onRefresh={fetchData}
        onDeletePayment={handleDeletePayment}
      />

      {/* Payment History Dialog */}
      <PaymentHistoryDialog
        open={!!historySchool}
        onOpenChange={(v) => { if (!v) setHistorySchool(null); }}
        school={historySchool}
        onDelete={handleDeletePayment}
        onRefresh={fetchData}
      />

      {/* Approve Dialog */}
      <ApproveDialog
        open={!!approvePayment}
        onOpenChange={(v) => { if (!v) setApprovePayment(null); }}
        payment={approvePayment}
        onSuccess={fetchData}
      />
    </div>
  );
}
