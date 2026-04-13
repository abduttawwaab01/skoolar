'use client';

import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        <span className="text-gray-600">Loading dashboard...</span>
      </div>
    </div>
  );
}