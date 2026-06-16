'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, LayoutTemplate, Layers, BarChart3, User, CheckCircle2, Send, Download, MessageSquare, History, Grid3X3 } from 'lucide-react';
import { ReportCardDesigner } from './report-card-designer';
import { ReportCardPreview } from './report-card-preview';
import { ReportCardTemplateLibrary } from './report-card-template-library';
import { ReportCardBulk } from './report-card-bulk';
import { ReportCardView } from './report-card-view';
import { ReportCardStats } from './report-card-stats';
import { ReportCardApproval } from './report-card-approval';
import { ReportCardDelivery } from './report-card-delivery';
import { ReportCardDomainEditor } from './report-card-domain-editor';
import { ReportCardComments } from './report-card-comments';
import { ReportCardHistory } from './report-card-history';
import { ReportCardQuickExport } from './report-card-quick-export';
import { useAppStore } from '@/store/app-store';
import { hasPermission } from '@/lib/report-card-utils/permissions';

export function ReportCardManager() {
  const { currentUser } = useAppStore();
  const role = currentUser.role;
  const [activeTab, setActiveTab] = useState('designer');

  const canDesign = hasPermission(role as any, 'create:design');
  const canViewAnalytics = hasPermission(role as any, 'view:analytics');
  const canBulk = hasPermission(role as any, 'bulk:generate');
  const canApprove = hasPermission(role as any, 'approve:card');
  const canDeliver = hasPermission(role as any, 'deliver:whatsapp');
  const canManageDomains = hasPermission(role as any, 'manage:domains');
  const canViewAny = hasPermission(role as any, 'view:any-report');

  const tabs = [
    { id: 'designer', label: 'Designer', icon: Palette, show: canDesign },
    { id: 'preview', label: 'Preview', icon: Layers, show: canDesign },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate, show: canDesign },
    { id: 'bulk', label: 'Bulk Generate', icon: Grid3X3, show: canBulk },
    { id: 'view', label: 'Reports', icon: User, show: canViewAny },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle2, show: canApprove },
    { id: 'delivery', label: 'Delivery', icon: Send, show: canDeliver },
    { id: 'domains', label: 'Domains', icon: Layers, show: canManageDomains },
    { id: 'comments', label: 'Comments', icon: MessageSquare, show: canViewAny },
    { id: 'history', label: 'History', icon: History, show: canViewAny },
    { id: 'export', label: 'Export', icon: Download, show: canViewAny },
    { id: 'stats', label: 'Analytics', icon: BarChart3, show: canViewAnalytics },
  ].filter((t) => t.show);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Report Card Management</h2>
          <p className="text-sm text-muted-foreground">
            Design, generate, approve, and deliver student report cards
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex-wrap h-auto min-h-9">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
              <tab.icon className="size-3.5 mr-1.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="designer" className="mt-3"><ReportCardDesigner /></TabsContent>
        <TabsContent value="preview" className="mt-3"><ReportCardPreview /></TabsContent>
        <TabsContent value="templates" className="mt-3"><ReportCardTemplateLibrary onSelect={() => setActiveTab('designer')} /></TabsContent>
        <TabsContent value="bulk" className="mt-3"><ReportCardBulk /></TabsContent>
        <TabsContent value="view" className="mt-3"><ReportCardView /></TabsContent>
        <TabsContent value="approvals" className="mt-3"><ReportCardApproval /></TabsContent>
        <TabsContent value="delivery" className="mt-3"><ReportCardDelivery /></TabsContent>
        <TabsContent value="domains" className="mt-3"><ReportCardDomainEditor /></TabsContent>
        <TabsContent value="comments" className="mt-3"><ReportCardComments /></TabsContent>
        <TabsContent value="history" className="mt-3"><ReportCardHistory /></TabsContent>
        <TabsContent value="export" className="mt-3"><ReportCardQuickExport /></TabsContent>
        <TabsContent value="stats" className="mt-3"><ReportCardStats /></TabsContent>
      </Tabs>
    </div>
  );
}
