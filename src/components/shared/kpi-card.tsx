'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type LucideIcon, ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  className?: string;
  sparklineData?: number[];
  emoji?: string;
}

function KpiCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'text-emerald-600',
  iconBgColor = 'bg-emerald-100',
  className,
  sparklineData,
  emoji,
}: KpiCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change !== undefined && change === 0;

  return (
    <Card className={cn(
      'relative overflow-hidden group hover:shadow-lg hover:shadow-emerald-100/50 hover:-translate-y-0.5 transition-all duration-300 cursor-default border-border/50',
      className
    )}>
      {/* Subtle gradient accent on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-emerald-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <CardContent className="p-4 sm:p-6 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground truncate flex items-center gap-1.5">
              {emoji && <span className="text-base">{emoji}</span>}
              {title}
            </p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {value}
            </p>
          </div>
          {Icon && (
            <div className={cn(
              'flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
              iconBgColor,
              iconColor
            )}>
              <Icon className="size-5" />
            </div>
          )}
        </div>

        {change !== undefined && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold transition-colors',
              isPositive && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
              isNegative && 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
              isNeutral && 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400'
            )}>
              {isPositive && <ArrowUpRight className="size-3" />}
              {isNegative && <ArrowDownRight className="size-3" />}
              {isNeutral && <Minus className="size-3" />}
              {Math.abs(change)}%
            </span>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">{changeLabel}</span>
            )}
          </div>
        )}

        {/* Mini sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3 flex items-end gap-[2px] h-8">
            {sparklineData.map((val, i) => {
              const maxVal = Math.max(...sparklineData);
              const minVal = Math.min(...sparklineData);
              const range = maxVal - minVal || 1;
              const height = ((val - minVal) / range) * 100;
              const isLast = i === sparklineData.length - 1;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-sm min-w-[3px] transition-all duration-300',
                    isLast
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-200'
                      : 'bg-emerald-200 dark:bg-emerald-800 group-hover:bg-emerald-300'
                  )}
                  style={{ height: `${Math.max(height, 8)}%` }}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { KpiCard };
export type { KpiCardProps };
