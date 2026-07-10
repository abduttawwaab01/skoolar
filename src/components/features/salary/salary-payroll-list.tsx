'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, CheckCircle2, Eye, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/salary-utils/calculations';
import { SalaryPayrollDetail } from './salary-payroll-detail';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function SalaryPayrollList() {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      try { const parsed = JSON.parse(stored); setUserRole(parsed?.state?.user?.role || ''); } catch {}
    }
  }, []);

  const fetchPayrolls = () => {
    setLoading(true);
    setError('');
    fetch('/api/salary/payroll')
      .then(r => r.json())
      .then(res => setPayrolls(res.data || []))
      .catch(() => setError('Failed to load payrolls'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayrolls(); }, []);

  const isAdmin = userRole === 'SCHOOL_ADMIN' || userRole === 'SUPER_ADMIN';
  const isAccountant = userRole === 'ACCOUNTANT';

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payroll?')) return;
    try {
      const res = await fetch(`/api/salary/payroll/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchPayrolls();
    } catch { setError('Failed to delete'); }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/salary/payroll/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');
      fetchPayrolls();
    } catch { setError('Failed to approve'); }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/salary/payroll/${id}/pay`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as paid');
      fetchPayrolls();
    } catch { setError('Failed to mark as paid'); }
  };

  const handleCreatePayroll = async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const title = `Payroll - ${month}/${year}`;
    try {
      setError('');
      const res = await fetch('/api/salary/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, month, year }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create payroll');
      }
      toast.success('Payroll created successfully');
      fetchPayrolls();
    } catch (err: any) {
      setError(err.message || 'Failed to create payroll');
      toast.error(err.message || 'Failed to create payroll');
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;

  if (selectedId) {
    return <SalaryPayrollDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {(isAdmin || isAccountant) && (
          <Button size="sm" onClick={handleCreatePayroll}>
            <Plus className="size-4 mr-1" /> Create Payroll
          </Button>
        )}
      </div>

      {payrolls.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No payrolls found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Staff Count</TableHead>
              <TableHead>Gross Pay</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Pay</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrolls.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelectedId(p.id)}>
                <TableCell className="font-medium">{p.title || `${p.month}/${p.year}`}</TableCell>
                <TableCell>{p.month}</TableCell>
                <TableCell>{p.year}</TableCell>
                <TableCell>
                  <Badge className={`text-[10px] ${statusColors[p.status] || ''}`}>{p.status}</Badge>
                </TableCell>
                <TableCell>{p.staffCount || p.payslips?.length || 0}</TableCell>
                <TableCell>{formatCurrency(p.totalGross || 0)}</TableCell>
                <TableCell>{formatCurrency(p.totalDeductions || 0)}</TableCell>
                <TableCell className="font-medium">{formatCurrency(p.totalNetPay || 0)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedId(p.id)}>
                      <Eye className="size-4" />
                    </Button>
                    {p.status === 'DRAFT' && (isAdmin || isAccountant) && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleApprove(p.id)}>
                          <CheckCircle2 className="size-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </>
                    )}
                    {p.status === 'APPROVED' && (isAdmin || isAccountant) && (
                      <Button variant="ghost" size="icon" onClick={() => handleMarkPaid(p.id)}>
                        <CheckCircle2 className="size-4 text-green-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
