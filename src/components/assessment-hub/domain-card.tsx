'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MasteryBadge } from './mastery-badge';

interface DomainCardProps {
  domain: string;
  score: number;
  masteryLevel: string;
  strengths?: string[];
  weaknesses?: string[];
  subDomains?: { name: string; score: number }[];
  className?: string;
}

export function DomainCard({ domain, score, masteryLevel, strengths, weaknesses, subDomains, className }: DomainCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{domain}</CardTitle>
          <MasteryBadge level={masteryLevel} score={score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={score} className="h-2" />
        {subDomains && subDomains.length > 0 && (
          <div className="space-y-1">
            {subDomains.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{s.name}</span>
                <span>{s.score}%</span>
              </div>
            ))}
          </div>
        )}
        {strengths && strengths.length > 0 && (
          <div>
            <p className="text-xs font-medium text-emerald-600">Strengths</p>
            <ul className="text-xs text-muted-foreground list-disc list-inside">
              {strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
        {weaknesses && weaknesses.length > 0 && (
          <div>
            <p className="text-xs font-medium text-amber-600">Areas to Improve</p>
            <ul className="text-xs text-muted-foreground list-disc list-inside">
              {weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
