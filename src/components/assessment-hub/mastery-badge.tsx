'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MasteryBadgeProps {
  level: string;
  score?: number;
  className?: string;
}

const masteryConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  BEGINNER: { label: 'Beginner', variant: 'outline', color: 'text-gray-500 border-gray-300' },
  DEVELOPING: { label: 'Developing', variant: 'secondary', color: 'text-amber-600 bg-amber-50' },
  PROFICIENT: { label: 'Proficient', variant: 'default', color: 'text-blue-600 bg-blue-50' },
  ADVANCED: { label: 'Advanced', variant: 'default', color: 'text-emerald-600 bg-emerald-50' },
  EXEMPLARY: { label: 'Exemplary', variant: 'default', color: 'text-purple-600 bg-purple-50' },
};

export function MasteryBadge({ level, score, className }: MasteryBadgeProps) {
  const config = masteryConfig[level] || masteryConfig.BEGINNER;
  return (
    <Badge variant={config.variant} className={cn(config.color, className)}>
      {config.label}{score !== undefined ? ` (${score}%)` : ''}
    </Badge>
  );
}
