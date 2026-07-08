'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, FileText } from 'lucide-react';
import { ReportCardPrintConfigurator } from './report-card-print-configurator';
import { ReportCardPrintPreview } from './report-card-print-preview';
import { useReportCardPrintStore } from '@/store/report-card-print-store';

export function ReportCardPrintManager() {
  const { activeTab, setActiveTab } = useReportCardPrintStore();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Report Card Print</h2>
          <p className="text-sm text-muted-foreground">
            Generate A4-ready printable report cards with 5 templates
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 border-b">
          <TabsList className="bg-transparent h-10 gap-1">
            <TabsTrigger value="configurator" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-2 text-xs font-medium">
              <Palette className="size-4 mr-1.5" />Configurator
            </TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-2 text-xs font-medium">
              <FileText className="size-4 mr-1.5" />Preview &amp; Export
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="configurator" className="flex-1 min-h-0 m-0">
          <div className="h-full flex flex-col lg:flex-row">
            <div className="w-full lg:w-80 lg:border-r lg:flex-shrink-0 overflow-y-auto">
              <ReportCardPrintConfigurator />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto hidden lg:flex items-center justify-center text-muted-foreground text-sm p-8">
              Switch to Preview &amp; Export tab to see the result.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="flex-1 min-h-0 m-0">
          <ReportCardPrintPreview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
