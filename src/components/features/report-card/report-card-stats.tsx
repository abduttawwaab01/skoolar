'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, FileText, CheckCircle2, Send, Users } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';

export function ReportCardStats() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser?.schoolId || '';
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    fetch(`/api/report-cards/stats?schoolId=${schoolId}`)
      .then(r => r.json())
      .then(res => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>;
  if (!stats) return <p className="text-xs text-muted-foreground text-center py-4">Failed to load stats</p>;

  const cards = [
    { label: 'Total', value: stats.total, icon: FileText, color: 'text-blue-600 bg-blue-100' },
    { label: 'This Week', value: stats.recent7Days, icon: BarChart3, color: 'text-purple-600 bg-purple-100' },
    { label: 'Today', value: stats.today, icon: BarChart3, color: 'text-orange-600 bg-orange-100' },
    { label: 'Approvals', value: stats.approvals, icon: CheckCircle2, color: 'text-green-600 bg-green-100' },
    { label: 'Deliveries', value: stats.deliveries, icon: Send, color: 'text-teal-600 bg-teal-100' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg', c.color)}><c.icon className="size-4" /></div>
                <div>
                  <p className="text-2xl font-bold">{c.value}</p>
                  <p className="text-[10px] text-muted-foreground">{c.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">By Status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.entries(stats.byStatus || {}).map(([status, count]: any) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <Badge variant="outline" className="text-[10px] capitalize">{status}</Badge>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">By Grade</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.entries(stats.byGrade || {}).map(([grade, count]: any) => (
                <div key={grade} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{grade}</span>
                  <Badge variant="secondary" className="text-[10px]">{count as any}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
