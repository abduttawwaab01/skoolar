'use client';

import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GrowthRecord {
  id: string;
  assessmentDate: string;
  overallScore: number;
  domainScores: Record<string, number>;
  growthScore: number | null;
  trend: string | null;
}

interface GrowthTimelineProps {
  records: GrowthRecord[];
  domains?: string[];
  className?: string;
}

export function GrowthTimeline({ records, domains, className }: GrowthTimelineProps) {
  const chartData = useMemo(() => {
    return records.map((r) => {
      const date = new Date(r.assessmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
      const base: Record<string, string | number> = { date };
      if (domains && domains.length > 0) {
        domains.forEach((d) => { base[d] = r.domainScores?.[d] ?? 0; });
      } else {
        base.overall = r.overallScore;
      }
      return base;
    });
  }, [records, domains]);

  if (!records || records.length === 0) {
    return <p className="text-sm text-muted-foreground">No growth records yet.</p>;
  }

  if (domains && domains.length > 0) {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {domains.map((d, i) => (
              <Line key={d} type="monotone" dataKey={d} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="overall" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
