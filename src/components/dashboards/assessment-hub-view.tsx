'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { BarChart3, BookOpen, Users, ClipboardCheck, Brain, TrendingUp, Award, Lightbulb } from 'lucide-react';

const statCards = [
  { key: 'totalAssessments', label: 'Total Assessments', icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
  { key: 'completedAttempts', label: 'Completed Attempts', icon: ClipboardCheck, color: 'text-emerald-600 bg-emerald-50' },
  { key: 'activeStudents', label: 'Active Students', icon: Users, color: 'text-purple-600 bg-purple-50' },
  { key: 'avgScore', label: 'Average Score', icon: TrendingUp, color: 'text-amber-600 bg-amber-50', suffix: '%' },
  { key: 'recommendations', label: 'Recommendations', icon: Lightbulb, color: 'text-indigo-600 bg-indigo-50' },
  { key: 'growthRate', label: 'Growth Rate', icon: Award, color: 'text-rose-600 bg-rose-50', suffix: '%' },
];

export function AssessmentHubView() {
  const { currentUser, currentRole, setCurrentView } = useAppStore();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const schoolId = currentUser.schoolId;
      const res = await fetch(`/api/assessment-hub/analytics/overview?schoolId=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.data || {});
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [currentUser.schoolId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const role = currentRole || 'SCHOOL_ADMIN';

  const quickActions = [
    { label: 'Student Assessments', view: 'assessment-student-list', icon: BookOpen, roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'] },
    { label: 'Teacher Assessments', view: 'assessment-teacher-list', icon: Users, roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'] },
    { label: '360 Feedback', view: 'assessment-360-feedback', icon: ClipboardCheck, roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'] },
    { label: 'Observations', view: 'assessment-observations', icon: BarChart3, roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'] },
    { label: 'Templates', view: 'assessment-templates', icon: Brain, roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'] },
    { label: 'Analytics', view: 'assessment-analytics-view', icon: TrendingUp, roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assessment Hub</h1>
        <p className="text-muted-foreground">Comprehensive diagnostic assessments for students and teachers</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
              <div className={cn('p-1.5 rounded-md', s.color)}>
                <s.icon className="h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold">
                  {stats[s.key] ?? 0}{s.suffix || ''}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>Navigate to assessment management areas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.filter((a) => a.roles.includes(role)).map((action) => (
              <button
                key={action.view}
                onClick={() => setCurrentView(action.view as any)}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  <action.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Student Assessments</TabsTrigger>
          <TabsTrigger value="teachers">Teacher Assessments</TabsTrigger>
        </TabsList>
        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Student Assessments</p>
                  <p className="text-xl font-semibold">{stats.studentAssessments ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Students Assessed</p>
                  <p className="text-xl font-semibold">{stats.studentsAssessed ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg. Domain Score</p>
                  <p className="text-xl font-semibold">{stats.avgDomainScore ?? 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="teachers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Teacher Assessments</p>
                  <p className="text-xl font-semibold">{stats.teacherAssessments ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Teachers Assessed</p>
                  <p className="text-xl font-semibold">{stats.teachersAssessed ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg. Competency Score</p>
                  <p className="text-xl font-semibold">{stats.avgCompetencyScore ?? 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


