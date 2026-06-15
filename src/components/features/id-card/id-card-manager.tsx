'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IdCard, LayoutTemplate, Layers, ScanQrCode, BarChart3, User } from 'lucide-react';
import { IDCardDesigner } from './id-card-designer';
import { IDCardBulk } from './id-card-bulk';
import { IDCardMyCard } from './id-card-my-card';
import { IDCardStats } from './id-card-stats';
import { IDCardTemplateLibrary } from './id-card-template-library';
import { useAppStore } from '@/store/app-store';
import { hasPermission } from '@/lib/id-card-utils/permissions';

export function IDCardManager() {
  const { currentUser } = useAppStore();
  const role = currentUser.role as any;
  const [activeTab, setActiveTab] = useState('designer');

  const canManage = hasPermission(role, 'create:design');
  const canViewStats = hasPermission(role, 'view:analytics');
  const canBulk = hasPermission(role, 'bulk:generate');
  const canViewOwn = hasPermission(role, 'view:own-card');

  const tabs = [
    { id: 'designer', label: 'Designer', icon: Layers, show: canManage },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate, show: canManage },
    { id: 'bulk', label: 'Bulk Generate', icon: IdCard, show: canBulk },
    { id: 'my-card', label: 'My Card', icon: User, show: canViewOwn },
    { id: 'stats', label: 'Analytics', icon: BarChart3, show: canViewStats },
  ].filter((t) => t.show);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">ID Card Management</h2>
          <p className="text-sm text-muted-foreground">
            Design, generate, and manage school ID cards
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-9">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs" disabled={!tab.show}>
              <tab.icon className="size-3.5 mr-1.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="designer" className="mt-3">
          <IDCardDesigner />
        </TabsContent>

        <TabsContent value="templates" className="mt-3">
          <IDCardTemplateLibrary onSelect={() => setActiveTab('designer')} />
        </TabsContent>

        <TabsContent value="bulk" className="mt-3">
          <IDCardBulk />
        </TabsContent>

        <TabsContent value="my-card" className="mt-3">
          <IDCardMyCard />
        </TabsContent>

        <TabsContent value="stats" className="mt-3">
          <IDCardStats />
        </TabsContent>
      </Tabs>
    </div>
  );
}
