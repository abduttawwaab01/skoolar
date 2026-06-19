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
  Building2, CreditCard, CheckCircle, AlertCircle, Clock, Zap, Download, Search, RefreshCw, XCircle, Crown,
} from 'lucide-react';

interface Plan {
  id: string; name: string; displayName: string; pricingType: string; price: number; warningDays: number;
}

interface PricingRecord {
  id: string; planId: string; schoolType: string; monthlyPrice: number; termPrice: number; sessionPrice: number;
  plan: { id: string; name: string; displayName: string };
}

interface PaymentInfo {
  id: string; status: string; startDate: string; endDate: string; duration: string | null;
  amount: number; reference: string; channel: string | null; createdAt: string; planDisplayName: string | null;
}

interface PendingInfo {
  id: string; status: string; amount: number; reference: string; createdAt: string;
  planDisplayName: string | null; channel: string | null;
}

interface SchoolData {
  id: string; name: string; email: string | null; phone: string | null;
  schoolType: string | null; plan: string; planId: string | null; isActive: boolean;
  logo: string | null; region: string | null; createdAt: string;
  _count: { students: number; teachers: number; classes: number };
  latestPayment: PaymentInfo | null;
  pendingPayments: PendingInfo[];
  subscriptionStatus: 'active' | 'expiring_soon' | 'expired' | 'free' | 'none';
}

interface DashboardData {
  schools: SchoolData[];
  plans: Plan[];
  pricing: PricingRecord[];
  stats: {
    totalSchools: number;
    active: number;
    expired: number;
    expiringSoon: number;
    pendingApprovals: number;
  };
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  active: { label: 'Active', variant: 'default', icon: <CheckCircle className="size-3" /> },
  expiring_soon: { label: 'Expiring Soon', variant: 'secondary', icon: <Clock className="size-3" /> },
  expired: { label: 'Expired', variant: 'destructive', icon: <XCircle className="size-3" /> },
  free: { label: 'Free', variant: 'outline', icon: <Crown className="size-3" /> },
  none: { label: 'No Subscription', variant: 'outline', icon: <AlertCircle className="size-3" /> },
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

async function downloadReceipt(payment: PaymentInfo, schoolName: string) {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  doc.setFontSize(18).text('Skoolar', 14, 22);
  doc.setFontSize(10).text('Subscription Receipt', 14, 30);
  doc.setFontSize(9);
  doc.text(`School: ${schoolName}`, 14, 40);
  doc.text(`Reference: ${payment.reference}`, 14, 46);
  doc.text(`Plan: ${payment.planDisplayName || 'N/A'}`, 14, 52);
  doc.text(`Amount: ₦${payment.amount.toLocaleString()}`, 14, 58);
  doc.text(`Start: ${formatDate(payment.startDate)}`, 14, 64);
  doc.text(`End: ${formatDate(payment.endDate)}`, 14, 70);
  doc.text(`Duration: ${payment.duration || 'N/A'}`, 14, 76);
  doc.text(`Channel: ${payment.channel || 'N/A'}`, 14, 82);
  autoTable(doc, {
    startY: 90,
    head: [['Description', 'Value']],
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
  });
  doc.save(`receipt-${payment.reference}.pdf`);
}

function ManualUpgradeDialog({
  open, onOpenChange, school, plans, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  school: SchoolData | null; plans: Plan[]; onSuccess: () => void;
}) {
  const [planId, setPlanId] = useState('');
  const [duration, setDuration] = useState('term');
  const [customEndDate, setCustomEndDate] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlanId(school?.planId || plans.find(p => p.name === 'pro')?.id || plans[0]?.id || '');
    setDuration('term');
    setCustomEndDate('');
    setUseCustomDate(false);
  }, [open, school, plans]);

  const handleSubmit = async () => {
    if (!planId || !school) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { schoolId: school.id, planId, duration };
      if (useCustomDate) {
        if (!customEndDate) { toast.error('Please set an expiration date'); setSubmitting(false); return; }
        body.endDate = customEndDate;
        delete body.duration;
      }
      const res = await fetch('/api/subscription/manual-upgrade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { toast.success(json.message); onSuccess(); onOpenChange(false); }
      else toast.error(json.error);
    } catch { toast.error('Failed to upgrade'); }
    finally { setSubmitting(false); }
  };

  const computedEndDate = useMemo(() => {
    if (useCustomDate) return customEndDate || 'Not set';
    const months: Record<string, number> = { monthly: 1, term: 4, session: 10 };
    const d = new Date();
    d.setMonth(d.getMonth() + (months[duration] || 4));
    return d.toISOString().split('T')[0];
  }, [duration, useCustomDate, customEndDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Subscription — {school?.name || ''}</DialogTitle>
          <DialogDescription>Change plan or extend the subscription.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="useCustomDateSU" checked={useCustomDate} onChange={e => setUseCustomDate(e.target.checked)} className="size-4" />
            <Label htmlFor="useCustomDateSU" className="cursor-pointer">Set custom expiration date</Label>
          </div>
          {useCustomDate ? (
            <div className="grid gap-2">
              <Label>Expiration Date</Label>
              <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
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
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="font-medium">End date:</span> {computedEndDate}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : 'Apply'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApproveDialog({
  open, onOpenChange, payment, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  payment: PendingInfo & { schoolName?: string } | null; onSuccess: () => void;
}) {
  const [customEndDate, setCustomEndDate] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setCustomEndDate(''); setUseCustomDate(false); }
  }, [open]);

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
      if (json.success) { toast.success('Request approved'); onSuccess(); onOpenChange(false); }
      else toast.error(json.error || 'Failed to approve');
    } catch { toast.error('Failed to approve'); }
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
      if (json.success) { toast.success('Request rejected'); onSuccess(); onOpenChange(false); }
      else toast.error(json.error || 'Failed to reject');
    } catch { toast.error('Failed to reject'); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Request — {payment?.schoolName || ''}</DialogTitle>
          <DialogDescription>
            {payment?.planDisplayName} — ₦{payment?.amount?.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="useCustomDateApprove" checked={useCustomDate} onChange={e => setUseCustomDate(e.target.checked)} className="size-4" />
            <Label htmlFor="useCustomDateApprove" className="cursor-pointer">Set custom expiration date</Label>
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
          <Button onClick={handleApprove} disabled={submitting}>{submitting ? 'Processing...' : 'Approve'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PricingEditor({
  pricing, onUpdate,
}: {
  pricing: PricingRecord[]; onUpdate: () => void;
}) {
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
      if (json.success) { toast.success('Pricing updated'); onUpdate(); }
      else toast.error(json.error || 'Failed');
    } catch { toast.error('Failed to save'); }
    finally { setSavingId(null); }
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-3 px-4 font-medium text-xs">Plan</th>
            <th className="text-left py-3 px-4 font-medium text-xs">School Type</th>
            <th className="text-right py-3 px-4 font-medium text-xs">Monthly (₦)</th>
            <th className="text-right py-3 px-4 font-medium text-xs">Term (₦)</th>
            <th className="text-right py-3 px-4 font-medium text-xs">Session (₦)</th>
            <th className="text-right py-3 px-4 font-medium text-xs"></th>
          </tr>
        </thead>
        <tbody>
          {pricing.map((p) => {
            const vals = editValues[p.id] || {};
            const hasChanges = Object.keys(vals).length > 0;
            return (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 px-4 text-xs font-medium">{p.plan.displayName}</td>
                <td className="py-2 px-4 text-xs capitalize">{p.schoolType.replace(/_/g, ' ')}</td>
                {['monthlyPrice', 'termPrice', 'sessionPrice'].map(field => (
                  <td key={field} className="py-2 px-4 text-right">
                    <Input
                      type="number"
                      className="h-8 w-24 ml-auto text-xs text-right"
                      defaultValue={(p as Record<string, unknown>)[field] as number}
                      onChange={e => setEditValues(prev => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], [field]: parseInt(e.target.value) || 0 },
                      }))}
                    />
                  </td>
                ))}
                <td className="py-2 px-4 text-right">
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSave(p.id)} disabled={!hasChanges || savingId === p.id}>
                    {savingId === p.id ? '...' : 'Save'}
                  </Button>
                </td>
              </tr>
            );
          })}
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
  const [upgradeSchool, setUpgradeSchool] = useState<SchoolData | null>(null);
  const [approvePayment, setApprovePayment] = useState<(PendingInfo & { schoolName?: string }) | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscription/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
      else toast.error('Failed to load subscription data');
    } catch { toast.error('Failed to load subscription data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = data?.stats;

  const filteredSchools = useMemo(() => {
    if (!data) return [];
    return data.schools.filter(s => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || s.subscriptionStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  const pendingList = useMemo(() => {
    if (!data) return [];
    const result: (PendingInfo & { schoolName: string; schoolId: string })[] = [];
    for (const s of data.schools) {
      for (const p of s.pendingPayments) {
        result.push({ ...p, schoolName: s.name, schoolId: s.id });
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const statCards = stats ? [
    { label: 'Total Schools', value: stats.totalSchools, icon: <Building2 className="size-4" />, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Active', value: stats.active, icon: <CheckCircle className="size-4" />, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Expiring Soon', value: stats.expiringSoon, icon: <Clock className="size-4" />, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Expired', value: stats.expired, icon: <XCircle className="size-4" />, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Pending', value: stats.pendingApprovals, icon: <CreditCard className="size-4" />, color: 'text-violet-600', bg: 'bg-violet-100' },
  ] : [];

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">Subscription Dashboard</h2>
          <p className="text-sm text-muted-foreground">Manage all school subscriptions in one place</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('size-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
        </Button>
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

      <Tabs defaultValue="schools">
        <TabsList>
          <TabsTrigger value="schools">All Schools</TabsTrigger>
          <TabsTrigger value="pending">Pending Requests {pendingList.length > 0 && <Badge className="ml-2 text-xs">{pendingList.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        {/* Schools Tab */}
        <TabsContent value="schools" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search schools..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="none">No Subscription</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-xs">School</th>
                  <th className="text-left py-3 px-4 font-medium text-xs">Plan</th>
                  <th className="text-left py-3 px-4 font-medium text-xs hidden md:table-cell">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-xs hidden lg:table-cell">Start</th>
                  <th className="text-left py-3 px-4 font-medium text-xs hidden lg:table-cell">End</th>
                  <th className="text-center py-3 px-4 font-medium text-xs">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-xs hidden sm:table-cell">Days</th>
                  <th className="text-right py-3 px-4 font-medium text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchools.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No schools found.</td></tr>
                ) : (
                  filteredSchools.map(s => {
                    const days = daysUntil(s.latestPayment?.endDate ?? null);
                    const cfg = statusConfig[s.subscriptionStatus];
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <p className="font-medium text-xs">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.email || s.phone || ''}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">{s.latestPayment?.planDisplayName || s.plan}</Badge>
                        </td>
                        <td className="py-3 px-4 text-xs hidden md:table-cell">{s.latestPayment?.duration || '-'}</td>
                        <td className="py-3 px-4 text-xs hidden lg:table-cell">{formatDate(s.latestPayment?.startDate)}</td>
                        <td className="py-3 px-4 text-xs hidden lg:table-cell">{formatDate(s.latestPayment?.endDate)}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={cfg.variant} className="gap-1 text-xs">{cfg.icon}{cfg.label}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center hidden sm:table-cell">
                          {days !== null ? (
                            <span className={cn('text-xs font-medium', days <= 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground')}>
                              {days > 0 ? `${days}d` : 'Overdue'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Manage" onClick={() => setUpgradeSchool(s)}>
                              <Zap className="size-3.5" />
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
        </TabsContent>

        {/* Pending Requests Tab */}
        <TabsContent value="pending">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-xs">School</th>
                  <th className="text-left py-3 px-4 font-medium text-xs">Plan</th>
                  <th className="text-right py-3 px-4 font-medium text-xs">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-xs">Channel</th>
                  <th className="text-left py-3 px-4 font-medium text-xs hidden md:table-cell">Date</th>
                  <th className="text-center py-3 px-4 font-medium text-xs">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No pending requests.</td></tr>
                ) : (
                  pendingList.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 text-xs font-medium">{p.schoolName}</td>
                      <td className="py-3 px-4 text-xs">{p.planDisplayName || '-'}</td>
                      <td className="py-3 px-4 text-xs text-right">₦{p.amount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-xs">{p.channel || '-'}</td>
                      <td className="py-3 px-4 text-xs hidden md:table-cell">{formatDate(p.createdAt)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="secondary" className="text-xs capitalize">{p.status.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" className="h-7 text-xs" onClick={() => setApprovePayment({ ...p, schoolName: p.schoolName })}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          {data?.pricing ? (
            <PricingEditor pricing={data.pricing} onUpdate={fetchData} />
          ) : (
            <p className="text-sm text-muted-foreground py-4">No pricing data available.</p>
          )}
        </TabsContent>
      </Tabs>

      <ManualUpgradeDialog
        open={!!upgradeSchool}
        onOpenChange={(v) => { if (!v) setUpgradeSchool(null); }}
        school={upgradeSchool}
        plans={data?.plans || []}
        onSuccess={fetchData}
      />

      <ApproveDialog
        open={!!approvePayment}
        onOpenChange={(v) => { if (!v) setApprovePayment(null); }}
        payment={approvePayment}
        onSuccess={fetchData}
      />
    </div>
  );
}
