'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FileText, DollarSign, HandCoins, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/salary-utils/calculations';

export function SalaryReports() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch('/api/salary/reports')
      .then(r => r.json())
      .then(res => setStats(res.data || res))
      .catch(() => setError('Failed to load reports'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;
  if (!stats) return <p className="text-sm text-muted-foreground text-center py-4">No report data available.</p>;

  const statCards = [
    { label: 'Total Staff', value: stats.totalStaff || 0, icon: Users, color: 'text-blue-600 bg-blue-100' },
    { label: 'Payrolls Processed', value: stats.payrollsProcessed || stats.totalPayrolls || 0, icon: FileText, color: 'text-purple-600 bg-purple-100' },
    { label: 'Last Payroll Amount', value: stats.lastPayrollAmount || 0, icon: DollarSign, color: 'text-green-600 bg-green-100', isCurrency: true },
    { label: 'Pending Advances', value: stats.pendingAdvances || 0, icon: HandCoins, color: 'text-orange-600 bg-orange-100' },
  ];

  const roleBreakdown = stats.roleBreakdown || stats.byRole || {};
  const statusBreakdown = stats.statusBreakdown || stats.byStatus || {};
  const monthlySpend = stats.monthlySpend || stats.byMonth || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg', c.color)}><c.icon className="size-4" /></div>
                <div>
                  <p className="text-2xl font-bold">{c.isCurrency ? formatCurrency(c.value) : c.value}</p>
                  <p className="text-[10px] text-muted-foreground">{c.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Role Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.keys(roleBreakdown).length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                Object.entries(roleBreakdown).map(([role, count]: any) => {
                  const total = Object.values(roleBreakdown).reduce((s: any, v: any) => s + v, 0) as number;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={role} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium capitalize">{role.toLowerCase()}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Payroll by Status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.keys(statusBreakdown).length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                Object.entries(statusBreakdown).map(([status, count]: any) => (
                  <div key={status} className="flex items-center justify-between text-xs">
                    <Badge variant="outline" className="text-[10px] capitalize">{status.toLowerCase()}</Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Monthly Spend</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.keys(monthlySpend).length === 0 ? (
              <p className="text-xs text-muted-foreground">No data</p>
            ) : (
              Object.entries(monthlySpend).map(([month, amount]: any) => (
                <div key={month} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{month}</span>
                  <span>{formatCurrency(amount)}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
