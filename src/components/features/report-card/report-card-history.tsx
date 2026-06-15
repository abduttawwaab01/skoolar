'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const HISTORY_ACTION_COLORS: Record<string, string> = {
  submit: 'bg-blue-100 text-blue-700',
  approve: 'bg-green-100 text-green-700',
  reject: 'bg-red-100 text-red-700',
  publish: 'bg-emerald-100 text-emerald-700',
  archive: 'bg-gray-100 text-gray-700',
  create: 'bg-purple-100 text-purple-700',
  update: 'bg-orange-100 text-orange-700',
};

export function ReportCardHistory() {
  const [reportCardId, setReportCardId] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!reportCardId) { toast.error('Enter report card ID'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/report-cards/${reportCardId}`);
      if (!res.ok) throw new Error('Not found');
      const json = await res.json();
      const rc = json.data;
      const entries: any[] = [
        ...(rc.approvals || []).map((a: any) => ({ ...a, type: 'approval' })),
        ...(rc.deliveries || []).map((d: any) => ({ ...d, type: 'delivery' })),
        ...(rc.comments || []).map((c: any) => ({ ...c, type: 'comment' })),
      ].sort((a, b) => new Date(b.createdAt || b.sentAt).getTime() - new Date(a.createdAt || a.sentAt).getTime());
      setHistory(entries);
    } catch {
      setHistory([]);
      toast.error('Failed to load history');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="size-4" />Activity History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Report Card ID</Label>
              <Input className="h-8 text-xs" value={reportCardId} onChange={(e) => setReportCardId(e.target.value)}
                placeholder="Enter report card ID" />
            </div>
            <Button size="sm" className="self-end" onClick={fetchHistory} disabled={loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <RotateCcw className="size-3.5 mr-1" />}
              Load
            </Button>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No history found</p>
            ) : history.map((entry: any, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 border rounded text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('text-[9px] capitalize', HISTORY_ACTION_COLORS[entry.action] || '')}>
                      {entry.action || entry.status || entry.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.createdAt || entry.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {entry.role && `by ${entry.role}`}{entry.comment ? `: ${entry.comment}` : ''}
                    {entry.type === 'delivery' && ` via ${entry.method} → ${entry.recipient}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
