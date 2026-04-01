'use client';

import React, { useEffect, useState } from 'react';

interface SafeFormattedDateProps {
  date: Date | string | number;
  options?: Intl.DateTimeFormatOptions;
  locale?: string;
  fallback?: string | React.ReactNode;
  className?: string;
  mode?: 'toLocaleString' | 'toLocaleDateString' | 'toLocaleTimeString' | 'toISOString';
}

/**
 * A component to safely render formatted dates without causing React hydration mismatches.
 * It ensures the date is formatted only on the client side.
 */
export function SafeFormattedDate({
  date,
  options = { month: 'short', day: 'numeric', year: 'numeric' },
  locale = undefined,
  fallback = '---',
  className = '',
  mode = 'toLocaleString',
}: SafeFormattedDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={className}>{fallback}</span>;
  }

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return <span className={className}>{fallback}</span>;

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

    return <span className={className}>{formatted}</span>;
  } catch (error) {
    console.error('Error formatting date:', error);
    return <span className={className}>{fallback}</span>;
  }
}
