'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/salary-utils/calculations';
import { SalaryAdvanceForm } from './salary-advance-form';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export function SalaryAdvances() {
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      try { const parsed = JSON.parse(stored); setUserRole(parsed?.state?.user?.role || ''); } catch {}
    }
  }, []);

  const fetchAdvances = () => {
    setLoading(true);
    setError('');
    fetch('/api/salary/advances')
      .then(r => r.json())
      .then(res => setAdvances(res.data || []))
      .catch(() => setError('Failed to load advances'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAdvances(); }, []);

  const isAdmin = userRole === 'SCHOOL_ADMIN' || userRole === 'SUPER_ADMIN';
  const isAccountant = userRole === 'ACCOUNTANT';
  const isStaff = userRole === 'TEACHER' || userRole === 'DIRECTOR';

  const handleApprove = async (id: string) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/salary/advances/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');
      toast.success('Advance approved');
      setApproveId(null);
      fetchAdvances();
    } catch { toast.error('Failed to approve'); } finally { setApproving(false); }
  };

  const handleReject = async (id: string) => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/salary/advances/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      toast.success('Advance rejected');
      setRejectId(null);
      setRejectReason('');
      fetchAdvances();
    } catch { toast.error('Failed to reject'); } finally { setRejecting(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (error) return <p className="text-xs text-red-500 text-center py-4">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isStaff && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-4 mr-1" /> Request Advance
          </Button>
        )}
      </div>

      {advances.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No salary advances found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Name</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Monthly Deduction</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.user?.name || a.staffName || '-'}</TableCell>
                <TableCell>{formatCurrency(a.amount || 0)}</TableCell>
                <TableCell>{formatCurrency(a.monthlyDeduction || a.installmentAmount || 0)}</TableCell>
                <TableCell>{formatCurrency(a.remainingAmount || 0)}</TableCell>
                <TableCell>
                  <Badge className={`text-[10px] ${statusColors[a.status] || ''}`}>{a.status}</Badge>
                </TableCell>
                <TableCell>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-'}</TableCell>
                <TableCell>
                  {(isAdmin || isAccountant) && a.status === 'PENDING' && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setApproveId(a.id)}>
                        <CheckCircle2 className="size-4 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setRejectId(a.id)}>
                        <XCircle className="size-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {showForm && (
        <SalaryAdvanceForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchAdvances(); }}
        />
      )}

      <Dialog open={!!approveId} onOpenChange={() => setApproveId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Approval</DialogTitle></DialogHeader>
          <p className="text-sm">Are you sure you want to approve this advance?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button onClick={() => approveId && handleApprove(approveId)} disabled={approving}>
              {approving ? <Loader2 className="size-4 animate-spin" /> : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectId} onOpenChange={() => { setRejectId(null); setRejectReason(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Advance</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason for rejection</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectId && handleReject(rejectId)} disabled={rejecting || !rejectReason.trim()}>
              {rejecting ? <Loader2 className="size-4 animate-spin" /> : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
