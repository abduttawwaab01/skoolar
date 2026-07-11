'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, FileText, DollarSign, HandCoins, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/salary-utils/calculations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export function SalaryReports() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setTextColor(22, 163, 74);
      doc.text('Salary Reports', pageW / 2, 20, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW / 2, 27, { align: 'center' });

      const bodyRows: [string, string, string][] = [];
      if (stats.roleBreakdown) {
        Object.entries(stats.roleBreakdown).forEach(([role, count]: any) => {
          bodyRows.push([role, String(count), '']);
        });
      }
      if (stats.monthlySpend) {
        Object.entries(stats.monthlySpend).forEach(([month, amount]: any) => {
          bodyRows.push([`Spend (${month})`, '', formatCurrency(amount)]);
        });
      }

      autoTable(doc, {
        startY: 35,
        head: [['Category', 'Count', 'Amount']],
        body: bodyRows,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontSize: 9 },
        foot: [['Total Staff', String(stats.totalStaff || 0), formatCurrency(stats.lastPayrollAmount || 0)]],
        footStyles: { fillColor: [240, 253, 244], textColor: [5, 150, 105], fontSize: 9, fontStyle: 'bold' },
      });

      doc.save('Salary_Reports.pdf');
      toast.success('Report exported');
    } catch {
      toast.error('Failed to export report');
    }
  };

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
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <Download className="size-4 mr-1" /> Export PDF
        </Button>
      </div>
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
