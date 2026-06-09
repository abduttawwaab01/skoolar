'use client';

import { cn } from '@/lib/utils';

interface CompetencyHeatmapProps {
  data: { domain: string; competencies: { name: string; score: number }[] }[];
  className?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500 text-white';
  if (score >= 60) return 'bg-emerald-300 text-emerald-900';
  if (score >= 40) return 'bg-amber-300 text-amber-900';
  if (score >= 20) return 'bg-orange-300 text-orange-900';
  return 'bg-red-300 text-red-900';
}

export function CompetencyHeatmap({ data, className }: CompetencyHeatmapProps) {
  if (!data || data.length === 0) return null;

  const maxCompetencies = Math.max(...data.map((d) => d.competencies.length));

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-1.5 text-left font-medium text-muted-foreground">Domain</th>
            {Array.from({ length: maxCompetencies }).map((_, i) => (
              <th key={i} className="p-1.5 text-center font-medium text-muted-foreground w-20">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((domain) => (
            <tr key={domain.domain}>
              <td className="p-1.5 font-medium text-[11px] whitespace-nowrap">{domain.domain.replace(/_/g, ' ')}</td>
              {Array.from({ length: maxCompetencies }).map((_, i) => {
                const comp = domain.competencies[i];
                return (
                  <td
                    key={i}
                    className={cn(
                      'p-1.5 text-center rounded-sm',
                      comp ? scoreColor(comp.score) : 'bg-transparent',
                    )}
                    title={comp ? `${comp.name}: ${comp.score}%` : undefined}
                  >
                    {comp ? (
                      <span className="block truncate" title={comp.name}>
                        {comp.score}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
