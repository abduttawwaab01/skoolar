'use client';

import React, { useState, useEffect } from 'react';
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
  editId?: string;
}

export function SalaryConfigForm({ onClose, onSaved, editId }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    userId: '',
    baseSalary: '',
    housingAllowance: '',
    transportAllowance: '',
    medicalAllowance: '',
    bonus: '',
    otherAllowances: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    effectiveDate: '',
  });

  useEffect(() => {
    fetch('/api/users?role=TEACHER&role=ACCOUNTANT&role=LIBRARIAN&role=DIRECTOR')
      .then(r => r.json())
      .then(res => setUsers(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    fetch(`/api/salary/config/${editId}`)
      .then(r => r.json())
      .then(res => {
        const d = res.data || res;
        setForm({
          userId: d.userId || d.user?.id || '',
          baseSalary: String(d.baseSalary || ''),
          housingAllowance: String(d.housingAllowance || ''),
          transportAllowance: String(d.transportAllowance || ''),
          medicalAllowance: String(d.medicalAllowance || ''),
          bonus: String(d.bonus || ''),
          otherAllowances: d.otherAllowances || '',
          bankName: d.bankName || '',
          accountNumber: d.accountNumber || '',
          accountName: d.accountName || '',
          effectiveDate: d.effectiveDate ? d.effectiveDate.slice(0, 10) : '',
        });
      })
      .catch(() => toast.error('Failed to load config'))
      .finally(() => setLoading(false));
  }, [editId]);

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      userId: form.userId,
      baseSalary: Number(form.baseSalary) || 0,
      housingAllowance: Number(form.housingAllowance) || 0,
      transportAllowance: Number(form.transportAllowance) || 0,
      medicalAllowance: Number(form.medicalAllowance) || 0,
      bonus: Number(form.bonus) || 0,
      otherAllowances: form.otherAllowances,
      bankName: form.bankName,
      accountNumber: form.accountNumber,
      accountName: form.accountName,
      effectiveDate: form.effectiveDate || null,
    };

    try {
      const url = editId ? `/api/salary/config/${editId}` : '/api/salary/config';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      toast.success(editId ? 'Salary config updated' : 'Salary config created');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editId ? 'Edit Salary Config' : 'Add Salary Config'}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Staff</Label>
                <Select value={form.userId} onValueChange={(v) => handleChange('userId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Base Salary</Label>
                <Input type="number" value={form.baseSalary} onChange={(e) => handleChange('baseSalary', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Housing Allowance</Label>
                <Input type="number" value={form.housingAllowance} onChange={(e) => handleChange('housingAllowance', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Transport Allowance</Label>
                <Input type="number" value={form.transportAllowance} onChange={(e) => handleChange('transportAllowance', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Medical Allowance</Label>
                <Input type="number" value={form.medicalAllowance} onChange={(e) => handleChange('medicalAllowance', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bonus</Label>
                <Input type="number" value={form.bonus} onChange={(e) => handleChange('bonus', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Effective Date</Label>
                <Input type="date" value={form.effectiveDate} onChange={(e) => handleChange('effectiveDate', e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Other Allowances (JSON)</Label>
                <Textarea value={form.otherAllowances} onChange={(e) => handleChange('otherAllowances', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input value={form.bankName} onChange={(e) => handleChange('bankName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Account Number</Label>
                <Input value={form.accountNumber} onChange={(e) => handleChange('accountNumber', e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Account Name</Label>
                <Input value={form.accountName} onChange={(e) => handleChange('accountName', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : 'Save'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
