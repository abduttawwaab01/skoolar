'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ReportCardApproval() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser?.schoolId || '';
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const fetchPending = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/report-cards?schoolId=${schoolId}&approvalStatus=submitted`);
      const json = await res.json();
      setPending(json.data || []);
    } catch { setPending([]); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/report-cards/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      });
      if (!res.ok) throw new Error('Action failed');
      toast.success(action === 'approve' ? 'Approved' : 'Rejected');
      setPending((prev) => prev.filter((r) => r.id !== id));
      setComment('');
    } catch { toast.error('Action failed'); }
    finally { setActionLoading(null); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="size-4" />Pending Approvals
            <Badge variant="secondary" className="text-[10px]">{pending.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No pending approvals</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {pending.map((rc: any) => (
                <div key={rc.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{rc.student?.name || rc.student?.user?.name || 'N/A'}</span>
                      <Badge variant="outline" className="text-[10px]">{rc.term?.name}</Badge>
                    </div>
                    <Badge className="text-[10px] bg-blue-100 text-blue-700">Submitted</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Approval comment (optional)..."
                      className="h-16 text-xs"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="destructive" onClick={() => handleAction(rc.id, 'reject')}
                      disabled={actionLoading === rc.id}>
                      <XCircle className="size-3.5 mr-1" />Reject
                    </Button>
                    <Button size="sm" onClick={() => handleAction(rc.id, 'approve')}
                      disabled={actionLoading === rc.id}>
                      {actionLoading === rc.id ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <CheckCircle2 className="size-3.5 mr-1" />}
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
