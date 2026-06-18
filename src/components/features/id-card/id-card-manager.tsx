'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { IDCardDesigner } from '@/components/features/id-card/id-card-designer';
import { IDCardBulk } from '@/components/features/id-card/id-card-bulk';
import { IdCard, Users, Plus, Download, Printer, CreditCard, Palette, BarChart3, TrendingUp, TrendingDown, Calendar, Wallet, FileText, Settings, Shield, Eye, EyeOff, Upload, Download as DownloadIcon, FileImage, Loader2 } from 'lucide-react';
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
  const [showDesignWizard, setShowDesignWizard] = useState(false);

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

      // Fetch recent activity (mock data for now)
      const recentActivity = [
        { date: '2024-06-18', action: 'Generated', count: 15 },
        { date: '2024-06-17', action: 'Updated', count: 8 },
        { date: '2024-06-16', action: 'Exported', count: 12 },
        { date: '2024-06-15', action: 'Generated', count: 20 },
      ];

      setStats({
        totalCards,
        activeCards: totalCards,
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="size-3.5 text-green-600" />;
      case 'down': return <TrendingDown className="size-3.5 text-red-600" />;
      default: return <BarChart3 className="size-3.5 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600 bg-green-50';
      case 'down': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <IdCard className="size-6 w-6 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">ID Card Manager</h2>
              <p className="text-sm text-gray-500">Design, generate, and manage school ID cards</p>
            </div>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <IdCard className="size-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">ID Card Manager</h2>
            <p className="text-sm text-gray-500">Design, generate, and manage student and staff ID cards</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            <IdCard className="size-4 mr-1.5" /> {stats?.totalCards || 0} Total Cards
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <Users className="size-4 mr-1.5" /> {stats?.studentsCards || 0} Students
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <CreditCard className="size-4 mr-1.5" /> {stats?.staffCards || 0} Staff
          </Badge>
        </div>
      </div>

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
              <Badge variant="secondary" className="text-xs">Active</Badge>
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
              <Badge variant="secondary" className="text-xs">Status</Badge>
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
                  onClick={() => setShowDesignWizard(true)}
                  className="w-full h-10 text-sm font-medium"
                >
                  <Palette className="size-4 mr-2" /> Start Design Wizard
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
                <Button
                  variant="outline"
                  className="w-full h-10 text-sm font-medium"
                >
                  <DownloadIcon className="size-4 mr-2" /> Export All
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="designer" className="space-y-6">
          <IDCardDesigner />
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          <IDCardBulk />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6">
          <IDCardBulk />
        </TabsContent>
      </Tabs>
    </div>
  );
}
