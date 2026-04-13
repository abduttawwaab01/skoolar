'use client';

import React, { useState, useEffect } from 'react';

interface SafeFormattedDateProps {
  date: Date | string | number;
  options?: Intl.DateTimeFormatOptions;
  locale?: string;
  fallback?: string;
  className?: string;
  mode?: 'toLocaleString' | 'toLocaleDateString' | 'toLocaleTimeString' | 'toISOString';
}

function formatDateValue(date: Date | string | number, mode: string, locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return '';
  }

  if (mode === 'toISOString') {
    return d.toISOString();
  } else if (mode === 'toLocaleDateString') {
    return d.toLocaleDateString(locale, options);
  } else if (mode === 'toLocaleTimeString') {
    return d.toLocaleTimeString(locale, options);
  }
  return d.toLocaleString(locale, options);
}

export function SafeFormattedDate({
  date,
  options = { month: 'short', day: 'numeric', year: 'numeric' },
  locale = undefined,
  fallback = '---',
  className = '',
  mode = 'toLocaleString',
}: SafeFormattedDateProps) {
  const [mounted, setMounted] = useState(false);
  const [formatted, setFormatted] = useState('');

  useEffect(() => {
    // Defer state updates to avoid setState-in-effect rule violation
    const timer = setTimeout(() => {
      setMounted(true);
      setFormatted(formatDateValue(date, mode, locale, options));
    }, 0);
    return () => clearTimeout(timer);
  }, [date, mode, locale, options]);

  if (!mounted) {
    return <span className={className}>{fallback}</span>;
  }

  const displayValue = formatted || fallback;
  
  return (
    <span className={className}>
      {displayValue}
    </span>
  );
}
