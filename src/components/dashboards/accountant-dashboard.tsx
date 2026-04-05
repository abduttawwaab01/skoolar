'use client';

import { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, Clock, CreditCard, Plus, FileText, Download,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const FEE_COLORS = ['#059669', '#7C3AED', '#DC2626', '#0891B2', '#D97706'];

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  receiptNo: string;
  createdAt: string;
  feeStructureId: string | null;
  paidBy: string | null;
  student?: {
    id: string;
    admissionNo: string;
    user: { name: string | null; email: string | null };
    class: { name: string; section: string | null } | null;
  };
}

interface FeeStructureItem {
  id: string;
  name: string;
  amount: number;
}

export function AccountantDashboard() {
  const { setCurrentView, selectedSchoolId } = useAppStore();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructureItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSchoolId) return;
      try {
        setLoading(true);
        const [paymentsRes, feesRes] = await Promise.all([
          fetch(`/api/payments?schoolId=${selectedSchoolId}&limit=100`),
          fetch(`/api/fee-structure?schoolId=${selectedSchoolId}&limit=100`),
        ]);
        if (!paymentsRes.ok) throw new Error('Failed to load payments');
        if (!feesRes.ok) throw new Error('Failed to load fee structures');
        const paymentsJson = await paymentsRes.json();
        const feesJson = await feesRes.json();
        setPayments(paymentsJson.data || []);
        setFeeStructures(feesJson.data || []);
      } catch (err) {
        toast.error('Failed to load financial data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedSchoolId]);

  const stats = useMemo(() => {
    const totalRevenue = feeStructures.reduce((sum, f) => sum + (f.amount || 0), 0);
    const collected = payments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const pending = payments
      .filter(p => p.status === 'pending' || p.status === 'overdue')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Today's collections
    const today = new Date().toISOString().split('T')[0];
    const todayCollected = payments
      .filter(p => p.status === 'verified' && p.createdAt?.startsWith(today))
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const collectionRate = totalRevenue > 0 ? Math.round((collected / totalRevenue) * 100) : 0;

    return { totalRevenue, collected, pending, todayCollected, collectionRate };
  }, [payments, feeStructures]);

  // Group payments by month for chart
  const monthlyTrend = useMemo(() => {
    const monthMap = new Map<string, number>();
    payments.forEach(p => {
      if (p.status !== 'verified' || !p.createdAt) return;
      const date = new Date(p.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + (p.amount || 0));
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, amount]) => ({
        month: new Date(month + '-01').toLocaleString('default', { month: 'short' }),
        amount,
      }));
  }, [payments]);

  // Group collected payments by fee structure for pie chart
  const byFeeType = useMemo(() => {
    const feeMap = new Map<string, number>();
    const verifiedPayments = payments.filter(p => p.status === 'verified');
    verifiedPayments.forEach(p => {
      const feeItem = feeStructures.find(f => f.id === p.feeStructureId);
      const name = feeItem?.name || 'Other';
      feeMap.set(name, (feeMap.get(name) || 0) + (p.amount || 0));
    });
    return Array.from(feeMap.entries()).map(([type, amount]) => ({ type, amount }));
  }, [payments, feeStructures]);

  const recentPayments = useMemo(() => {
    return payments.slice(0, 8).map(p => ({
      id: p.id,
      student: p.student?.user?.name || p.paidBy || 'Unknown',
      amount: p.amount,
      method: p.method,
      date: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A',
      status: p.status,
    }));
  }, [payments]);

  const quickActions = [
    { label: 'Record Payment', icon: Plus, view: 'payments' as const, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Generate Invoice', icon: FileText, view: 'payments' as const, color: 'bg-blue-100 text-blue-700' },
    { label: 'Export Report', icon: Download, view: 'analytics' as const, color: 'bg-purple-100 text-purple-700' },
  ];

  const fmt = (n: number) => {
    if (n >= 1000000) return `₦${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `₦${(n / 1000).toFixed(0)}K`;
    return `₦${n.toLocaleString()}`;
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard title="Total Revenue" value={fmt(stats.totalRevenue)} icon={Wallet} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" changeLabel="fee structure" />
        <KpiCard title="Collected" value={fmt(stats.collected)} icon={CreditCard} iconBgColor="bg-blue-100" iconColor="text-blue-600" changeLabel="verified payments" />
        <KpiCard title="Pending" value={fmt(stats.pending)} icon={Clock} iconBgColor="bg-amber-100" iconColor="text-amber-600" changeLabel="awaiting payment" />
        <KpiCard title="Today" value={fmt(stats.todayCollected)} icon={TrendingUp} iconBgColor="bg-purple-100" iconColor="text-purple-600" />
      </div>

      {/* Collection Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium">Fee Collection Progress</p>
              <p className="text-xs text-muted-foreground">{fmt(stats.collected)} collected of {fmt(stats.totalRevenue)} target</p>
            </div>
            <span className="text-lg font-bold text-emerald-600">{stats.collectionRate}%</span>
          </div>
          <Progress value={stats.collectionRate} className="h-3" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>₦0</span>
            <span>{fmt(stats.totalRevenue)} Target</span>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue collection</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} formatter={(v: number) => [`₦${(v / 1000000).toFixed(1)}M`, 'Revenue']} />
                  <Area type="monotone" dataKey="amount" stroke="#059669" fill="#059669" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No revenue data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Fee Type Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Fee Type</CardTitle>
            <CardDescription>Breakdown of collected fees</CardDescription>
          </CardHeader>
          <CardContent>
            {byFeeType.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byFeeType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="amount" nameKey="type" paddingAngle={2}>
                      {byFeeType.map((_, i) => (
                        <Cell key={i} fill={FEE_COLORS[i % FEE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v: number) => [`₦${(v / 1000000).toFixed(1)}M`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-1">
                  {byFeeType.map((item, i) => (
                    <div key={item.type} className="flex items-center gap-1.5 text-xs">
                      <span className="size-2 rounded-full" style={{ backgroundColor: FEE_COLORS[i] }} />
                      {item.type}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No fee breakdown data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Recent Payments + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Payments Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Payments</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('payments')}>View all</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Student</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Method</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.length > 0 ? recentPayments.map(p => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{p.student}</td>
                      <td className="py-2.5">₦{p.amount.toLocaleString()}</td>
                      <td className="py-2.5 text-muted-foreground">{p.method}</td>
                      <td className="py-2.5 text-muted-foreground">{p.date}</td>
                      <td className="py-2.5">
                        <StatusBadge variant={p.status === 'completed' || p.status === 'verified' ? 'success' : 'warning'} size="sm">
                          {p.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-sm">No payments recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quickActions.map(action => (
                <Button key={action.label} variant="outline" className="w-full justify-start gap-3 h-auto py-3" onClick={() => setCurrentView(action.view)}>
                  <div className={`size-8 rounded-lg flex items-center justify-center ${action.color}`}>
                    <action.icon className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
