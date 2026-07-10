'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/salary-utils/calculations';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface Props {
  id: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function SalaryPayslipView({ id }: Props) {
  const [payslip, setPayslip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/salary/payslips/${id}`)
      .then(r => r.json())
      .then(res => setPayslip(res.data || res))
      .catch(() => setError('Failed to load payslip'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPayslip = (ps: any) => {
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;

      doc.setFontSize(16);
      doc.setTextColor(22, 163, 74);
      doc.text(ps.schoolName || 'School Name', pageW / 2, 20, { align: 'center' });
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text('PAYSLIP', pageW / 2, 28, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Period: ${ps.month || 'N/A'}/${ps.year || 'N/A'}`, pageW / 2, 34, { align: 'center' });
      doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, pageW - margin, 20, { align: 'right' });

      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.5);
      doc.line(margin, 38, pageW - margin, 38);

      const cfg2 = ps.config || ps.salaryConfig || {};
      const earnings2 = [
        { label: 'Base Salary', amount: cfg2.baseSalary || 0 },
        { label: 'Housing Allowance', amount: cfg2.housingAllowance || 0 },
        { label: 'Transport Allowance', amount: cfg2.transportAllowance || 0 },
        { label: 'Medical Allowance', amount: cfg2.medicalAllowance || 0 },
        { label: 'Bonus', amount: cfg2.bonus || 0 },
      ];
      let otherTotal = 0;
      if (cfg2.otherAllowances) {
        try {
          const extras = JSON.parse(cfg2.otherAllowances);
          if (typeof extras === 'object') {
            for (const [key, val] of Object.entries(extras)) {
              const v = Number(val) || 0;
              if (v > 0) { earnings2.push({ label: key, amount: v }); otherTotal += v; }
            }
          }
        } catch {}
      }
      const gross2 = ps.grossPay || earnings2.reduce((s, e) => s + e.amount, 0);
      const deductions2 = ps.deductions || [];
      const totalDed2 = ps.totalDeductions || deductions2.reduce((s: number, d: any) => s + d.amount, 0);
      const net2 = ps.netPay || (gross2 - totalDed2);

      (doc as any).autoTable({
        startY: 42,
        head: [['Earnings', 'Amount']],
        body: [...earnings2.map((e: any) => [e.label, formatCurrency(e.amount)]), ['', ''], ['Gross Pay', formatCurrency(gross2)]],
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 60, halign: 'right' } },
      });

      const afterEarnings = (doc as any).lastAutoTable.finalY + 5;
      (doc as any).autoTable({
        startY: afterEarnings,
        head: [['Deductions', 'Amount']],
        body: [...(deductions2.length > 0 ? deductions2.map((d: any) => [d.label || 'Deduction', `-${formatCurrency(d.amount)}`]) : [['No deductions', '—']]), ['', ''], ['Total Deductions', formatCurrency(totalDed2)]],
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 60, halign: 'right' } },
      });

      const fy = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(12);
      doc.setTextColor(22, 163, 74);
      doc.text(`Net Pay: ${formatCurrency(net2)}`, pageW / 2, fy, { align: 'center' });

      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text('This is a computer-generated payslip.', pageW / 2, fy + 8, { align: 'center' });

      doc.save(`Payslip_${ps.month || 'MM'}_${ps.year || 'YYYY'}.pdf`);
    } catch { toast.error('Failed to download payslip'); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;
  if (!payslip) return <p className="text-sm text-muted-foreground text-center py-4">Payslip not found.</p>;

  const cfg = payslip.config || payslip.salaryConfig || {};
  const earnings = [
    { label: 'Base Salary', amount: cfg.baseSalary || 0 },
    { label: 'Housing Allowance', amount: cfg.housingAllowance || 0 },
    { label: 'Transport Allowance', amount: cfg.transportAllowance || 0 },
    { label: 'Medical Allowance', amount: cfg.medicalAllowance || 0 },
    { label: 'Bonus', amount: cfg.bonus || 0 },
  ];

  // Parse other allowances from JSON
  if (cfg.otherAllowances) {
    try {
      const extras = JSON.parse(cfg.otherAllowances);
      if (typeof extras === 'object') {
        for (const [key, val] of Object.entries(extras)) {
          const v = Number(val) || 0;
          if (v > 0) { earnings.push({ label: key, amount: v }); }
        }
      }
    } catch {}
  }

  const grossPay = payslip.grossPay || earnings.reduce((s, e) => s + e.amount, 0);
  const deductions = payslip.deductions || [];
  const totalDeductions = payslip.totalDeductions || deductions.reduce((s: number, d: any) => s + d.amount, 0);
  const netPay = payslip.netPay || (grossPay - totalDeductions);
  const status = payslip.status || 'PENDING';

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg border-2">
        <CardHeader className="text-center border-b pb-4">
          <CardTitle className="text-lg">{payslip.schoolName || 'School Name'}</CardTitle>
          <p className="text-xs text-muted-foreground">Payslip for {payslip.month}/{payslip.year}</p>
          <div className="mt-1">
            <Badge className={`text-[10px] ${statusColors[status] || ''}`}>{status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-[10px]">Staff Name</p>
              <p className="font-medium">{payslip.user?.name || payslip.staffName || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Role</p>
              <p className="font-medium">{payslip.user?.role || payslip.role || '-'}</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold mb-2">Earnings</h4>
            <div className="space-y-1">
              {earnings.map((e, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{e.label}</span>
                  <span>{formatCurrency(e.amount)}</span>
                </div>
              ))}
              {(cfg.otherAllowances) && (() => {
                try {
                  const extras = JSON.parse(cfg.otherAllowances);
                  if (typeof extras === 'object') {
                    return Object.entries(extras).map(([key, val], idx) => {
                      const v = Number(val) || 0;
                      return v > 0 ? (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span>{formatCurrency(v)}</span>
                        </div>
                      ) : null;
                    });
                  }
                } catch {}
                return null;
              })()}
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-semibold">
                <span>Gross Pay</span>
                <span>{formatCurrency(grossPay)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold mb-2">Deductions</h4>
            <div className="space-y-1">
              {deductions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deductions</p>
              ) : (
                deductions.map((d: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{d.label || 'Deduction'}</span>
                    <span className="text-red-600">-{formatCurrency(d.amount)}</span>
                  </div>
                ))
              )}
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-semibold">
                <span>Total Deductions</span>
                <span className="text-red-600">{formatCurrency(totalDeductions)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center text-lg font-bold bg-primary/5 p-3 rounded-lg">
            <span>Net Pay</span>
            <span className="text-primary">{formatCurrency(netPay)}</span>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => handleDownloadPayslip(payslip)}>
              <Download className="size-4 mr-1" /> Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
