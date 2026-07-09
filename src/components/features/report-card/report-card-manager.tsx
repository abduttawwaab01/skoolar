'use client';

import React from 'react';
import { Palette } from 'lucide-react';
import { ReportCardDesigner } from './report-card-designer';
import { ReportCardPreview } from './report-card-preview';

export function ReportCardManager() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Report Cards</h2>
          <p className="text-sm text-muted-foreground">
            <Palette className="size-4 mr-1 inline-block align-middle" /> Design, preview, and print report cards
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="w-full lg:w-80 lg:border-r lg:flex-shrink-0 overflow-y-auto">
          <ReportCardDesigner />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ReportCardPreview />
        </div>
      </div>
    </div>
  );
}
