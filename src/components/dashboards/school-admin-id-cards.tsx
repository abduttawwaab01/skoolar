'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { IDCardManager } from '@/components/features/id-card/id-card-manager';
import { IDCardBulk } from '@/components/features/id-card/id-card-bulk';
import { IDCardDesigner } from '@/components/features/id-card/id-card-designer';
import { IdCard, Users, Plus, Download, Printer, CreditCard, Palette, BarChart3 } from 'lucide-react';

export function SchoolAdminIDCards() {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCards: 0,
    activeCards: 0,
    pendingCards: 0,
    studentsCards: 0,
    staffCards: 0,
  });

  useEffect(() => {
    loadStats();
  }, [currentUser]);

  async function loadStats() {
    setLoading(true);
    try {
      // Fetch students count
      const studentsRes = await fetch(`/api/students?schoolId=${currentUser.schoolId}&limit=1`);
      const studentsData = await studentsRes.json();
      const totalStudents = studentsData.total || 0;

      // Fetch teachers count
      const teachersRes = await fetch(`/api/teachers?schoolId=${currentUser.schoolId}&limit=1`);
      const teachersData = await teachersRes.json();
      const totalTeachers = teachersData.total || 0;

      // Fetch ID cards count
      const cardsRes = await fetch(`/api/id-cards?schoolId=${currentUser.schoolId}&limit=1`);
      const cardsData = await cardsRes.json();
      const totalCards = cardsData.total || 0;

      setStats({
        totalCards,
        activeCards: totalCards,
        pendingCards: 0,
        studentsCards: totalStudents,
        staffCards: totalTeachers,
      });
    } catch (error) {
      console.error('Failed to load ID card stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <IdCard className="size-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">ID Card Management</h2>
            <p className="text-sm text-gray-500">Design, generate, and manage school ID cards</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
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
            <IdCard className="size-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">ID Card Management</h2>
            <p className="text-sm text-gray-500">Design, generate, and manage student and staff ID cards</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100">
            <IdCard className="size-4 mr-1.5" /> {stats.totalCards} Total Cards
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">
            <Users className="size-4 mr-1.5" /> {stats.studentsCards} Students
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
            <CreditCard className="size-4 mr-1.5" /> {stats.staffCards} Staff
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <IdCard className="size-5 text-indigo-600" />
              <Badge variant="secondary" className="text-xs">Total</Badge>
            </div>
            <p className="text-3xl font-bold">{stats.totalCards}</p>
            <p className="text-sm text-muted-foreground">ID Cards Generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="size-5 text-emerald-600" />
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
            <p className="text-3xl font-bold">{stats.studentsCards}</p>
            <p className="text-sm text-muted-foreground">Student Cards</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <CreditCard className="size-5 text-blue-600" />
              <Badge variant="secondary" className="text-xs">Staff</Badge>
            </div>
            <p className="text-3xl font-bold">{stats.staffCards}</p>
            <p className="text-sm text-muted-foreground">Staff Cards</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="size-5 text-amber-600" />
              <Badge variant="secondary" className="text-xs">Status</Badge>
            </div>
            <p className="text-3xl font-bold">{stats.activeCards}</p>
            <p className="text-sm text-muted-foreground">Active Cards</p>
          </CardContent>
        </Card>
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
