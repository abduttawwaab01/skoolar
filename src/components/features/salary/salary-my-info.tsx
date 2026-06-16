'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, User } from 'lucide-react';
import { formatCurrency } from '@/lib/salary-utils/calculations';

export function SalaryMyInfo() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch('/api/salary/my')
      .then(r => r.json())
      .then(res => setData(res.data || res))
      .catch(() => setError('Failed to load salary info'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;

  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <User className="size-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Not configured yet</p>
        </CardContent>
      </Card>
    );
  }

  const cfg = data.config || data.salaryConfig || data;
  const grossPay = (cfg.baseSalary || 0) + (cfg.housingAllowance || 0) + (cfg.transportAllowance || 0) + (cfg.medicalAllowance || 0) + (cfg.bonus || 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Salary Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Base Salary</p>
              <p className="text-lg font-bold">{formatCurrency(cfg.baseSalary || 0)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Housing Allowance</p>
              <p className="text-lg font-bold">{formatCurrency(cfg.housingAllowance || 0)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Transport Allowance</p>
              <p className="text-lg font-bold">{formatCurrency(cfg.transportAllowance || 0)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Medical Allowance</p>
              <p className="text-lg font-bold">{formatCurrency(cfg.medicalAllowance || 0)}</p>
            </div>
            {cfg.bonus ? (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Bonus</p>
                <p className="text-lg font-bold">{formatCurrency(cfg.bonus)}</p>
              </div>
            ) : null}
          </div>
          <Separator />
          <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5">
            <p className="font-semibold">Gross Pay</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(grossPay)}</p>
          </div>
        </CardContent>
      </Card>

      {cfg.bankName || cfg.accountNumber ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bank Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">Bank Name</p>
              <p className="font-medium">{cfg.bankName || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Account Number</p>
              <p className="font-medium">{cfg.accountNumber || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Account Name</p>
              <p className="font-medium">{cfg.accountName || '-'}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
