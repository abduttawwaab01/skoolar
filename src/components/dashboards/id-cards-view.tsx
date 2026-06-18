'use client';

import React, { useState, useEffect } from 'react';
import { IDCardManager } from '@/components/features/id-card/id-card-manager';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';

export function IDCardsView() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <IDCardManager />
    </div>
  );
}
