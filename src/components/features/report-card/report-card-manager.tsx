'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, FileText } from 'lucide-react';
import { ReportCardDesigner } from './report-card-designer';
import { ReportCardPreview } from './report-card-preview';
import { ReportCardView } from './report-card-view';

export function ReportCardManager() {
  const [activeTab, setActiveTab] = useState('design-preview');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Report Cards</h2>
          <p className="text-sm text-muted-foreground">
            Design, preview, and view student report cards
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 border-b">
          <TabsList className="bg-transparent h-10 gap-1">
            <TabsTrigger value="design-preview" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-2 text-xs font-medium">
              <Palette className="size-4 mr-1.5" />Design &amp; Preview
            </TabsTrigger>
            <TabsTrigger value="view" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-2 text-xs font-medium">
              <FileText className="size-4 mr-1.5" />View Generated
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="design-preview" className="flex-1 min-h-0 m-0">
          <div className="h-full flex flex-col lg:flex-row">
            <div className="w-full lg:w-80 lg:border-r lg:flex-shrink-0 overflow-y-auto">
              <ReportCardDesigner />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ReportCardPreview />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="view" className="flex-1 min-h-0 m-0 overflow-y-auto p-4">
          <ReportCardView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
