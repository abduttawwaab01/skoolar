'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IdCard, Plus, Download, Printer, Users, CreditCard } from 'lucide-react';
import { IDCardDesigner } from './id-card-designer';
import { IDCardBulk } from './id-card-bulk';
import { cn } from '@/lib/utils';

export function IDCardManager() {
  const [activeTab, setActiveTab] = useState('designer');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <IdCard className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">ID Card Manager</h2>
            <p className="text-sm text-muted-foreground">Design, generate, and manage school ID cards</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Printer className="size-3.5 mr-1" /> Print Batch
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Download className="size-3.5 mr-1" /> Export All
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="designer" className="text-xs">
            <CreditCard className="size-3.5 mr-1.5" /> Designer
          </TabsTrigger>
          <TabsTrigger value="generate" className="text-xs">
            <Users className="size-3.5 mr-1.5" /> Generate
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-xs">
            <Plus className="size-3.5 mr-1.5" /> Bulk
          </TabsTrigger>
        </TabsList>
        <TabsContent value="designer" className="mt-4">
          <IDCardDesigner />
        </TabsContent>
        <TabsContent value="generate" className="mt-4">
          <IDCardBulk />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4">
          <IDCardBulk />
        </TabsContent>
      </Tabs>
    </div>
  );
}
