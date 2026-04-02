'use client';

import React from 'react';

interface SafeFormattedDateProps {
  date: Date | string | number;
  options?: Intl.DateTimeFormatOptions;
  locale?: string;
  fallback?: string;
  className?: string;
  mode?: 'toLocaleString' | 'toLocaleDateString' | 'toLocaleTimeString' | 'toISOString';
}

/**
 * A component to safely render formatted dates without causing React hydration mismatches.
 * Uses suppressHydrationWarning to handle server/client time differences.
 */
export function SafeFormattedDate({
  date,
  options = { month: 'short', day: 'numeric', year: 'numeric' },
  locale = undefined,
  fallback = '---',
  className = '',
  mode = 'toLocaleString',
}: SafeFormattedDateProps) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return <span className={className} suppressHydrationWarning>{fallback}</span>;
    }

    let formatted = '';
    if (mode === 'toISOString') {
      formatted = d.toISOString();
    } else if (mode === 'toLocaleDateString') {
      formatted = d.toLocaleDateString(locale, options);
    } else if (mode === 'toLocaleTimeString') {
      formatted = d.toLocaleTimeString(locale, options);
    } else {
      formatted = d.toLocaleString(locale, options);
    }

    return <span className={className} suppressHydrationWarning>{formatted}</span>;
  } catch {
    return <span className={className} suppressHydrationWarning>{fallback}</span>;
  }
}
