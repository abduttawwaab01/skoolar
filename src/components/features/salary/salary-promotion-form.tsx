'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function SalaryPromotionForm({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    requestedSalary: '',
    reason: '',
    type: 'promotion',
    supportingInfo: '',
  });

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.requestedSalary || !form.reason.trim()) {
      toast.error('Please fill in requested salary and reason');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/salary/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(form.requestedSalary),
          repaymentMonths: 1,
          reason: `[${form.type.toUpperCase()}] ${form.reason}${form.supportingInfo ? `\nSupporting: ${form.supportingInfo}` : ''}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit');
      toast.success('Promotion/upgrade request submitted');
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
          <DialogTitle>Request Salary Review / Promotion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Request Type</Label>
            <Select value={form.type} onValueChange={(v) => handleChange('type', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="promotion">Promotion</SelectItem>
                <SelectItem value="upgrade">Salary Upgrade</SelectItem>
                <SelectItem value="role_change">Role Change</SelectItem>
                <SelectItem value="increment">Annual Increment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>New Salary Requested (₦)</Label>
            <Input type="number" value={form.requestedSalary} onChange={(e) => handleChange('requestedSalary', e.target.value)} placeholder="e.g. 250000" />
          </div>
          <div className="space-y-1.5">
            <Label>Reason for Request</Label>
            <Textarea value={form.reason} onChange={(e) => handleChange('reason', e.target.value)} rows={3} placeholder="Explain why you deserve this salary review..." />
          </div>
          <div className="space-y-1.5">
            <Label>Supporting Information (optional)</Label>
            <Textarea value={form.supportingInfo} onChange={(e) => handleChange('supportingInfo', e.target.value)} rows={2} placeholder="Achievements, additional qualifications, years of service..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
