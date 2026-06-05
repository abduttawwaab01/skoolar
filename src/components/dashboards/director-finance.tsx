'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { DollarSign, CreditCard, TrendingUp, TrendingDown, Wallet, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface PaymentRecord {
  id: string;
  amount: number;
  status: string;
  method: string;
  createdAt: string;
}

export default function DirectorFinance() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [expenses, setExpenses] = useState<{ id: string; amount: number; category: string; date: string }[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const fetchData = async () => {
      try {
        const [payRes, expRes] = await Promise.all([
          fetch(`/api/payments?schoolId=${schoolId}&limit=1000`),
          fetch(`/api/expenses?schoolId=${schoolId}&limit=1000`),
        ]);

        if (payRes.ok) {
          const json = await payRes.json();
          setPayments(json.data || json || []);
        }
        if (expRes.ok) {
          const json = await expRes.json();
          setExpenses(json.data?.records || json.data || json || []);
        }
      } catch {
        toast.error('Failed to load financial data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId]);

  const stats = useMemo(() => {
    const totalRevenue = payments
      .filter(p => p.status === 'Verified' || p.status === 'completed')
      .reduce((s, p) => s + p.amount, 0);

    const pendingAmount = payments
      .filter(p => p.status === 'Pending' || p.status === 'Pending Verification')
      .reduce((s, p) => s + p.amount, 0);

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    const byStatus = Object.entries(
      payments.reduce<Record<string, number>>((acc, p) => {
        const status = p.status || 'Unknown';
        acc[status] = (acc[status] || 0) + p.amount;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    const byMethod = Object.entries(
      payments.reduce<Record<string, number>>((acc, p) => {
        const method = p.method || 'Other';
        acc[method] = (acc[method] || 0) + p.amount;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    return { totalRevenue, pendingAmount, totalExpenses, netRevenue: totalRevenue - totalExpenses, byStatus, byMethod, totalTransactions: payments.length };
  }, [payments, expenses]);

  const COLORS = ['#059669', '#7c3aed', '#f59e0b', '#ef4444', '#3b82f6'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1>
        <p className="text-muted-foreground">Summary of school finances and transactions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="size-4 text-emerald-600" /> Revenue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">${stats.totalRevenue.toFixed(2)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingDown className="size-4 text-red-600" /> Expenses</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">${stats.totalExpenses.toFixed(2)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Wallet className="size-4 text-blue-600" /> Net</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">${stats.netRevenue.toFixed(2)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CreditCard className="size-4 text-amber-600" /> Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">${stats.pendingAmount.toFixed(2)}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Payment Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: $${value.toFixed(0)}`}>
                  {stats.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Method</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.byMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: $${value.toFixed(0)}`}>
                  {stats.byMethod.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-base">Revenue & Expenses</CardTitle>
              <CardDescription>Total revenue: ${stats.totalRevenue.toFixed(2)} &middot; Total expenses: ${stats.totalExpenses.toFixed(2)} &middot; {stats.totalTransactions} transactions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[
              { name: 'Revenue', amount: stats.totalRevenue },
              { name: 'Expenses', amount: stats.totalExpenses },
              { name: 'Net', amount: stats.netRevenue },
            ]}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {[
                  { name: 'Revenue', amount: stats.totalRevenue },
                  { name: 'Expenses', amount: stats.totalExpenses },
                  { name: 'Net', amount: stats.netRevenue },
                ].map((entry, i) => (
                  <Cell key={i} fill={entry.amount >= 0 ? '#059669' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
