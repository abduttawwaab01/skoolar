'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Eye, FileText } from 'lucide-react';
import { ReportCardDesigner } from './report-card-designer';
import { ReportCardPreview } from './report-card-preview';
import { ReportCardView } from './report-card-view';

export function ReportCardManager() {
  const [activeTab, setActiveTab] = useState('designer');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Report Cards</h2>
          <p className="text-sm text-muted-foreground">
            Design, preview, and view student report cards
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="designer" className="text-xs">
            <Palette className="size-3.5 mr-1.5" />Design
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">
            <Eye className="size-3.5 mr-1.5" />Preview
          </TabsTrigger>
          <TabsTrigger value="view" className="text-xs">
            <FileText className="size-3.5 mr-1.5" />View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="designer" className="mt-3"><ReportCardDesigner /></TabsContent>
        <TabsContent value="preview" className="mt-3"><ReportCardPreview /></TabsContent>
        <TabsContent value="view" className="mt-3"><ReportCardView /></TabsContent>
      </Tabs>
    </div>
  );
}
