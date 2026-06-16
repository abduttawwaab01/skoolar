'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function SalaryAdvanceForm({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ amount: '', repaymentMonths: '1', reason: '' });

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const monthlyDeduction = Number(form.amount) && Number(form.repaymentMonths)
    ? Math.round(Number(form.amount) / Number(form.repaymentMonths))
    : 0;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/salary/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(form.amount),
          repaymentMonths: Number(form.repaymentMonths),
          reason: form.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit');
      toast.success('Advance request submitted');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{showConfirm ? 'Confirm Advance Request' : 'Request Salary Advance'}</DialogTitle>
        </DialogHeader>

        {!showConfirm ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" value={form.amount} onChange={(e) => handleChange('amount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Repayment Months</Label>
              <Input type="number" min={1} value={form.repaymentMonths} onChange={(e) => handleChange('repaymentMonths', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={(e) => handleChange('reason', e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setShowConfirm(true)} disabled={!form.amount || !form.reason.trim()}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Advance Amount</span>
                <span className="font-medium">{Number(form.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Repayment Months</span>
                <span className="font-medium">{form.repaymentMonths}</span>
              </div>
              <div className="flex justify-between font-semibold text-primary">
                <span>Monthly Deduction</span>
                <span>{monthlyDeduction.toLocaleString()}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Back</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : 'Confirm & Submit'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
