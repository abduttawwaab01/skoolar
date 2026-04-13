'use client';

import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        success:
          'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
        warning:
          'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
        error:
          'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
        info:
          'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800',
        neutral:
          'bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  }
);

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

function StatusBadge({
  className,
  variant,
  size,
  dot = true,
  pulse = false,
  children,
  ...props
}: StatusBadgeProps) {
  const dotColorMap: Record<NonNullable<VariantProps<typeof statusBadgeVariants>['variant']>, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-sky-500',
    neutral: 'bg-gray-400',
  };

  return (
    <span
      className={cn(statusBadgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span className="relative flex size-2 shrink-0">
          {pulse && (
            <span
              className={cn(
                'absolute inset-0 rounded-full animate-ping opacity-75',
                dotColorMap[variant || 'neutral']
              )}
            />
          )}
          <span
            className={cn(
              'relative rounded-full size-2',
              dotColorMap[variant || 'neutral']
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };
