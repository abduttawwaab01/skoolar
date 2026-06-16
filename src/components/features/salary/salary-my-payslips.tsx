'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/salary-utils/calculations';
import { SalaryPayslipView } from './salary-payslip-view';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const PAGE_SIZE = 10;

export function SalaryMyPayslips() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch('/api/salary/my/payslips')
      .then(r => r.json())
      .then(res => setPayslips(res.data?.records || []))
      .catch(() => setError('Failed to load payslips'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;

  const totalPages = Math.max(1, Math.ceil(payslips.length / PAGE_SIZE));
  const paginated = payslips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {payslips.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No payslips found.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month/Year</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((ps) => (
                <TableRow key={ps.id} className="cursor-pointer" onClick={() => setSelectedId(ps.id)}>
                  <TableCell className="font-medium">{ps.payroll?.month}/{ps.payroll?.year}</TableCell>
                  <TableCell>{formatCurrency(ps.grossPay || 0)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(ps.netPay || 0)}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${statusColors[ps.status] || ''}`}>{ps.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedId(ps.id); }}>
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payslip Detail</DialogTitle></DialogHeader>
          {selectedId && <SalaryPayslipView id={selectedId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
