'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/salary-utils/calculations';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

interface Props {
  id: string;
  onBack: () => void;
}

export function SalaryPayrollDetail({ id, onBack }: Props) {
  const [payroll, setPayroll] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      try { const parsed = JSON.parse(stored); setUserRole(parsed?.state?.user?.role || ''); } catch {}
    }
  }, []);

  const fetchPayroll = () => {
    setLoading(true);
    setError('');
    fetch(`/api/salary/payroll/${id}`)
      .then(r => r.json())
      .then(res => setPayroll(res.data || res))
      .catch(() => setError('Failed to load payroll'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayroll(); }, [id]);

  const isAdmin = userRole === 'SCHOOL_ADMIN' || userRole === 'SUPER_ADMIN';
  const isAccountant = userRole === 'ACCOUNTANT';

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/salary/payroll/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');
      fetchPayroll();
    } catch { setError('Failed to approve'); }
  };

  const handleMarkPaid = async () => {
    try {
      const res = await fetch(`/api/salary/payroll/${id}/pay`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as paid');
      fetchPayroll();
    } catch { setError('Failed to mark as paid'); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;
  if (!payroll) return <p className="text-sm text-muted-foreground text-center py-4">Payroll not found.</p>;

  const payslips = payroll.payslips || [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4 mr-1" /> Back
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{payroll.title || `Payroll ${payroll.month}/${payroll.year}`}</CardTitle>
            <Badge className={`text-[10px] ${statusColors[payroll.status] || ''}`}>{payroll.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-[10px]">Period</p>
              <p className="font-medium">{payroll.month}/{payroll.year}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Staff Count</p>
              <p className="font-medium">{payroll.staffCount || payslips.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Total Gross</p>
              <p className="font-medium">{formatCurrency(payroll.totalGross || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Total Net Pay</p>
              <p className="font-medium">{formatCurrency(payroll.totalNetPay || 0)}</p>
            </div>
          </div>

          {payroll.status === 'DRAFT' && (isAdmin || isAccountant) && (
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={handleApprove}><CheckCircle2 className="size-4 mr-1" /> Approve</Button>
            </div>
          )}
          {payroll.status === 'APPROVED' && (isAdmin || isAccountant) && (
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={handleMarkPaid}><CheckCircle2 className="size-4 mr-1" /> Mark as Paid</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {payslips.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Gross Pay</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Pay</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payslips.map((ps: any) => (
              <TableRow key={ps.id}>
                <TableCell className="font-medium">{ps.user?.name || ps.staffName || '-'}</TableCell>
                <TableCell>{ps.user?.role || ps.role || '-'}</TableCell>
                <TableCell>{formatCurrency(ps.grossPay || 0)}</TableCell>
                <TableCell>{formatCurrency(ps.totalDeductions || 0)}</TableCell>
                <TableCell className="font-medium">{formatCurrency(ps.netPay || 0)}</TableCell>
                <TableCell>
                  <Badge className={`text-[10px] ${statusColors[ps.status] || ''}`}>{ps.status || payslipStatus(ps)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {payslips.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No payslips in this payroll.</p>
      )}
    </div>
  );
}

function payslipStatus(ps: any): string {
  if (ps.isPaid) return 'PAID';
  return 'PENDING';
}
