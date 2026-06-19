'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { IDCardManager } from '@/components/features/id-card/id-card-manager';
import { IDCardBulk } from '@/components/features/id-card/id-card-bulk';
import { IDCardDesigner } from '@/components/features/id-card/id-card-designer';
import { IdCard, CreditCard, Palette, Plus } from 'lucide-react';

export function SchoolAdminIDCards() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <IdCard className="size-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">ID Card Management</h2>
            <p className="text-sm text-gray-500">Design, generate, and manage school ID cards</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <IdCard className="size-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">ID Card Management</h2>
            <p className="text-sm text-gray-500">Design, generate, and manage student and staff ID cards</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100">
            <IdCard className="size-4 mr-1.5" /> School Cards
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="manager" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manager" className="text-sm">
            <CreditCard className="size-4 mr-2" /> Card Manager
          </TabsTrigger>
          <TabsTrigger value="designer" className="text-sm">
            <Palette className="size-4 mr-2" /> Designer
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-sm">
            <Plus className="size-4 mr-2" /> Bulk Generation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manager" className="space-y-6">
          <IDCardManager />
        </TabsContent>

        <TabsContent value="designer" className="space-y-6">
          <IDCardDesigner />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6">
          <IDCardBulk />
        </TabsContent>
      </Tabs>
    </div>
  );
}
