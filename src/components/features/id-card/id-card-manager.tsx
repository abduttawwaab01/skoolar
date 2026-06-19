'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { IDCardDesigner } from '@/components/features/id-card/id-card-designer';
import { IDCardGenerate } from '@/components/features/id-card/id-card-generate';
import { IDCardBulk } from '@/components/features/id-card/id-card-bulk';
import { IdCard, Users, CreditCard, BarChart3, Palette, Plus, Upload, FileText, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface IDCardStats {
  totalCards: number;
  activeCards: number;
  pendingCards: number;
  studentsCards: number;
  staffCards: number;
  recentActivity: Array<{ date: string; action: string; count: number }>;
}

export function IDCardManager() {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IDCardStats | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadStats();
  }, [currentUser]);

  async function loadStats() {
    setLoading(true);
    try {
      const studentsRes = await fetch(`/api/students?schoolId=${currentUser.schoolId}&limit=1`);
      const studentsData = await studentsRes.json();
      const totalStudents = studentsData.total || 0;

      const teachersRes = await fetch(`/api/teachers?schoolId=${currentUser.schoolId}&limit=1`);
      const teachersData = await teachersRes.json();
      const totalTeachers = teachersData.total || 0;

      const cardsRes = await fetch(`/api/id-cards?schoolId=${currentUser.schoolId}&limit=1`);
      const cardsData = await cardsRes.json();
      const totalCards = cardsData.total || 0;

      const recentActivity = [
        { date: '2024-06-18', action: 'Generated', count: 15 },
        { date: '2024-06-17', action: 'Updated', count: 8 },
        { date: '2024-06-16', action: 'Exported', count: 12 },
        { date: '2024-06-15', action: 'Generated', count: 20 },
      ];

      setStats({
        totalCards,
        activeCards: Math.max(0, totalCards),
        pendingCards: 0,
        studentsCards: totalStudents,
        staffCards: totalTeachers,
        recentActivity,
      });
    } catch (error) {
      console.error('Failed to load ID card stats:', error);
      toast.error('Failed to load ID card statistics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <IdCard className="size-5 text-indigo-600" />
              <Badge variant="secondary" className="text-xs">Total</Badge>
            </div>
            <p className="text-3xl font-bold">{stats?.totalCards || 0}</p>
            <p className="text-sm text-muted-foreground">ID Cards Generated</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="size-5 text-emerald-600" />
              <Badge variant="secondary" className="text-xs">Students</Badge>
            </div>
            <p className="text-3xl font-bold">{stats?.studentsCards || 0}</p>
            <p className="text-sm text-muted-foreground">Student Cards</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <CreditCard className="size-5 text-blue-600" />
              <Badge variant="secondary" className="text-xs">Staff</Badge>
            </div>
            <p className="text-3xl font-bold">{stats?.staffCards || 0}</p>
            <p className="text-sm text-muted-foreground">Staff Cards</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="size-5 text-amber-600" />
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
            <p className="text-3xl font-bold">{stats?.activeCards || 0}</p>
            <p className="text-sm text-muted-foreground">Active Cards</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="text-sm">
            <BarChart3 className="size-4 mr-2" /> Overview
          </TabsTrigger>
          <TabsTrigger value="designer" className="text-sm">
            <Palette className="size-4 mr-2" /> Designer
          </TabsTrigger>
          <TabsTrigger value="generate" className="text-sm">
            <Plus className="size-4 mr-2" /> Generate
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-sm">
            <Upload className="size-4 mr-2" /> Bulk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
                <CardDescription>Latest ID card generation and updates</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Calendar className="size-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{activity.action}</p>
                            <p className="text-xs text-muted-foreground">{activity.date}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.count} cards
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="size-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
                <CardDescription>Common ID card operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => setActiveTab('designer')}
                  className="w-full h-10 text-sm font-medium"
                >
                  <Palette className="size-4 mr-2" /> Open Designer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('generate')}
                  className="w-full h-10 text-sm font-medium"
                >
                  <Plus className="size-4 mr-2" /> Generate Single Card
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('bulk')}
                  className="w-full h-10 text-sm font-medium"
                >
                  <Upload className="size-4 mr-2" /> Bulk Generate
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="designer" className="space-y-6">
          <IDCardDesigner />
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          <IDCardGenerate />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6">
          <IDCardBulk />
        </TabsContent>
      </Tabs>
    </div>
  );
}
