'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LearningStyleChartProps {
  style: {
    primaryStyle: string;
    secondaryStyle?: string;
    visualScore: number;
    auditoryScore: number;
    kinestheticScore: number;
    readingScore: number;
  };
  className?: string;
}

const COLORS = { Visual: '#6366f1', Auditory: '#10b981', Kinesthetic: '#f59e0b', Reading: '#8b5cf6' };
const LABELS: Record<string, string> = { visualScore: 'Visual', auditoryScore: 'Auditory', kinestheticScore: 'Kinesthetic', readingScore: 'Reading' };

export function LearningStyleChart({ style, className }: LearningStyleChartProps) {
  const data = [
    { name: LABELS.visualScore, value: style.visualScore, color: COLORS.Visual },
    { name: LABELS.auditoryScore, value: style.auditoryScore, color: COLORS.Auditory },
    { name: LABELS.kinestheticScore, value: style.kinestheticScore, color: COLORS.Kinesthetic },
    { name: LABELS.readingScore, value: style.readingScore, color: COLORS.Reading },
  ].filter((d) => d.value > 0);

  if (data.length === 0) return null;

  return (
    <div className={className}>
      <div className="mb-3 space-y-1">
        <p className="text-sm font-medium">Primary Style: <span className="text-primary">{style.primaryStyle}</span></p>
        {style.secondaryStyle && (
          <p className="text-xs text-muted-foreground">Secondary Style: {style.secondaryStyle}</p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}%`}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
