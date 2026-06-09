'use client';

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from 'recharts';

interface SkillRadarChartProps {
  data: { domain: string; score: number; fullMark?: number }[];
  className?: string;
}

export function SkillRadarChart({ data, className }: SkillRadarChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({
    domain: d.domain.replace(/_/g, ' '),
    score: d.score,
    fullMark: d.fullMark || 100,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="domain" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
          <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
