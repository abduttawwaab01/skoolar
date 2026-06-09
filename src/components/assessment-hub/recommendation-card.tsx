'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Lightbulb, Target, AlertTriangle } from 'lucide-react';

interface RecommendationCardProps {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  isCompleted: boolean;
  onComplete?: (id: string) => void;
  className?: string;
}

const priorityConfig: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  HIGH: { color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle },
  MEDIUM: { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Target },
  LOW: { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
};

export function RecommendationCard({ id, title, description, priority, category, isCompleted, onComplete, className }: RecommendationCardProps) {
  const config = priorityConfig[priority] || priorityConfig.MEDIUM;
  const Icon = config.icon;

  return (
    <Card className={cn('border-l-4', isCompleted ? 'border-l-emerald-500 opacity-60' : '', className)}>
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div className="flex items-start gap-2">
          <div className={cn('p-1.5 rounded-md', config.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="outline" className="mt-1 text-[10px]">{category}</Badge>
          </div>
        </div>
        <Badge className={cn('text-[10px]', config.color)}>{priority}</Badge>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
        {!isCompleted && onComplete && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onComplete(id)}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Complete
          </Button>
        )}
        {isCompleted && <Badge variant="secondary" className="text-[10px]">Completed</Badge>}
      </CardContent>
    </Card>
  );
}
