'use client';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SectionProgressProps {
  sections: { id: string; title: string; totalQuestions: number; answeredQuestions: number }[];
  currentSectionId?: string;
  onSectionClick?: (id: string) => void;
  className?: string;
}

export function SectionProgress({ sections, currentSectionId, onSectionClick, className }: SectionProgressProps) {
  const totalQuestions = sections.reduce((sum, s) => sum + s.totalQuestions, 0);
  const totalAnswered = sections.reduce((sum, s) => sum + s.answeredQuestions, 0);
  const overallProgress = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Progress</span>
        <span className="text-muted-foreground">{totalAnswered}/{totalQuestions} answered ({overallProgress}%)</span>
      </div>
      <Progress value={overallProgress} className="h-2" />
      <div className="space-y-2">
        {sections.map((s) => {
          const sectionProgress = s.totalQuestions > 0 ? Math.round((s.answeredQuestions / s.totalQuestions) * 100) : 0;
          const isActive = s.id === currentSectionId;
          return (
            <button
              key={s.id}
              onClick={() => onSectionClick?.(s.id)}
              className={cn(
                'w-full text-left p-2 rounded-md transition-colors text-sm',
                isActive ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted',
              )}
            >
              <div className="flex justify-between mb-1">
                <span className={cn('text-xs font-medium', isActive && 'text-primary')}>{s.title}</span>
                <span className="text-[10px] text-muted-foreground">{s.answeredQuestions}/{s.totalQuestions}</span>
              </div>
              <Progress value={sectionProgress} className="h-1.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
