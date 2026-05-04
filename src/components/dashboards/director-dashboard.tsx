'use client';

import { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { useSession, signOut } from 'next-auth/react';
import {
  Users, GraduationCap, CalendarCheck, Wallet, TrendingUp, Award,
  Download, AlertTriangle, BarChart3, FileText,
  Moon, Sun, LogOut
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

interface AnalyticsData {
  schoolOverview: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
    studentTeacherRatio: number;
  };
  attendanceByClass: Array<{
    classId: string;
    className: string;
    percentage: number;
  }>;
  performanceBySubject: Array<{
    subjectName: string;
    averageScore: number;
    passRate: number;
  }>;
  financialData: {
    totalRevenue: number;
    totalTransactions: number;
    byStatus: Array<{ status: string; total: number; count: number }>;
  };
  studentRanking: Array<{
    rank: number;
    id: string;
    gpa: number | null;
    user: { name: string | null; avatar: string | null } | null;
    class: { name: string; section: string | null } | null;
  }>;
  attendanceTrend: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    total: number;
  }>;
}

interface SchoolData {
  id: string;
  name: string;
  region: string | null;
  plan: string | null;
  isActive: boolean;
  _count: { students: number; teachers: number; classes: number };
  createdAt: string;
}

export function DirectorDashboard() {
  const { setCurrentView, selectedSchoolId } = useAppStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session, status } = useSession();
  const { isDark, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Redirect to login page after sign out
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const schoolId = selectedSchoolId || 'school-1';
      try {
        setLoading(true);
        const [analyticsRes, schoolsRes] = await Promise.all([
          fetch(`/api/analytics?schoolId=${schoolId}`),
          fetch('/api/schools?limit=50'),
        ]);
        if (!analyticsRes.ok) throw new Error('Failed to load analytics');
        if (!schoolsRes.ok) throw new Error('Failed to load schools');
        const analyticsJson = await analyticsRes.json();
        const schoolsJson = await schoolsRes.json();
        setAnalytics(analyticsJson.data || null);
        setSchools(schoolsJson.data || []);
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedSchoolId]);

  // Performance trend from attendance data
  const performanceTrends = useMemo(() => {
    if (!analytics?.attendanceTrend) return [];
    return analytics.attendanceTrend.slice(-7).map(t => ({
      month: new Date(t.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
      avg: t.total > 0 ? Math.round((t.present / t.total) * 100) : 0,
    }));
  }, [analytics]);

  // Department comparison from performance by subject
  const deptComparison = useMemo(() => {
    if (!analytics?.performanceBySubject) return [];
    return analytics.performanceBySubject.slice(0, 4).map((p) => ({
      department: p.subjectName.length > 12 ? p.subjectName.substring(0, 12) + '...' : p.subjectName,
      average: Math.round(p.averageScore),
    }));
  }, [analytics]);

  // Top performers from student ranking
  const topPerformers = useMemo(() => {
    if (!analytics?.studentRanking) return [];
    return analytics.studentRanking.slice(0, 5).map(s => ({
      rank: s.rank,
      name: s.user?.name || 'Unknown',
      class: s.class ? `${s.class.name}${s.class.section ? ` ${s.class.section}` : ''}` : 'N/A',
      gpa: s.gpa || 0,
      trend: s.rank <= 2 ? 'up' as const : s.rank >= 4 ? 'down' as const : 'stable' as const,
    }));
  }, [analytics]);

  // Low attendance students (we'll derive from attendance by class)
  const lowAttendanceStudents = useMemo(() => {
    if (!analytics?.attendanceByClass) return [];
    // Show classes with low attendance as concern items
    return analytics.attendanceByClass
      .filter(c => c.percentage < 85)
      .map(c => ({
        id: c.classId,
        name: c.className,
        attendance: c.percentage,
      }));
  }, [analytics]);

  // Low GPA students
  const lowGpaStudents = useMemo(() => {
    if (!analytics?.studentRanking) return [];
    return analytics.studentRanking
      .filter(s => (s.gpa || 0) < 3.0 && (s.gpa || 0) > 0)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        name: s.user?.name || 'Unknown',
        gpa: s.gpa || 0,
      }));
  }, [analytics]);

  // Attendance rate from analytics
  const attendanceRate = useMemo(() => {
    if (!analytics?.attendanceByClass || analytics.attendanceByClass.length === 0) return 0;
    const total = analytics.attendanceByClass.reduce((sum, c) => sum + c.percentage, 0);
    return Math.round(total / analytics.attendanceByClass.length);
  }, [analytics]);

  // Financial overview
  const collected = analytics?.financialData?.byStatus
    ?.find(s => s.status === 'verified')
    ?.total || 0;

  // Avg GPA
  const avgGpa = useMemo(() => {
    if (!analytics?.studentRanking || analytics.studentRanking.length === 0) return 0;
    const total = analytics.studentRanking.reduce((sum, s) => sum + (s.gpa || 0), 0);
    return Math.round((total / analytics.studentRanking.length) * 10) / 10;
  }, [analytics]);

  const totalStudents = analytics?.schoolOverview?.totalStudents || 0;
  const totalTeachers = analytics?.schoolOverview?.totalTeachers || 0;

  const exportButtons = [
    { label: 'Academic Report', icon: BarChart3, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Financial Report', icon: Wallet, color: 'bg-blue-100 text-blue-700' },
    { label: 'Staff Report', icon: Users, color: 'bg-purple-100 text-purple-700' },
  ];

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Executive KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard title="Total Students" value={totalStudents.toLocaleString()} icon={GraduationCap} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" changeLabel="enrolled" />
        <KpiCard title="Teachers" value={totalTeachers.toLocaleString()} icon={Users} iconBgColor="bg-blue-100" iconColor="text-blue-600" changeLabel="active" />
        <KpiCard title="Revenue" value={`₦${collected >= 1000000 ? (collected / 1000000).toFixed(1) + 'M' : collected >= 1000 ? (collected / 1000).toFixed(0) + 'K' : collected.toLocaleString()}`} icon={Wallet} iconBgColor="bg-amber-100" iconColor="text-amber-600" changeLabel="verified" />
        <KpiCard title="Attendance Rate" value={`${attendanceRate}%`} icon={CalendarCheck} iconBgColor="bg-green-100" iconColor="text-green-600" changeLabel="current" />
        <KpiCard title="Avg GPA" value={avgGpa.toFixed(1)} icon={TrendingUp} iconBgColor="bg-purple-100" iconColor="text-purple-600" changeLabel="overall" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Academic Performance Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Academic Performance Trend</CardTitle>
            <CardDescription>Average scores over the academic year</CardDescription>
          </CardHeader>
          <CardContent>
            {performanceTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={performanceTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[60, 80]} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="avg" stroke="#059669" strokeWidth={2.5} dot={{ r: 4, fill: '#059669' }} name="Avg Score" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No trend data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Department Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Department Performance</CardTitle>
            <CardDescription>Average scores by department</CardDescription>
          </CardHeader>
          <CardContent>
            {deptComparison.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptComparison}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="average" fill="#0891B2" radius={[4, 4, 0, 0]} name="Average Score" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No department data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Top Performers + Areas of Concern + Export */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top Performers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top Performers</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('results')}>View all</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {topPerformers.length > 0 ? topPerformers.map(student => (
                <div key={student.rank} className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                    {student.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.class}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{student.gpa} GPA</p>
                    <p className={`text-[10px] font-medium ${student.trend === 'up' ? 'text-emerald-600' : student.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {student.trend === 'up' ? '↑ Improving' : student.trend === 'down' ? '↓ Declining' : '→ Stable'}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground text-center py-4">No ranking data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Areas of Concern */}
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              <CardTitle className="text-base">Areas of Concern</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-red-600">Low Attendance (&lt;85%)</p>
              <div className="mt-1 space-y-1.5 max-h-28 overflow-y-auto">
                {lowAttendanceStudents.length > 0 ? lowAttendanceStudents.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 px-2.5 py-1.5">
                    <span className="text-xs font-medium">{s.name}</span>
                    <span className="text-xs text-red-600 font-semibold">{s.attendance}%</span>
                  </div>
                )) : (
                  <div className="text-xs text-muted-foreground py-2">No low attendance classes</div>
                )}
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-amber-600">Low GPA (&lt;3.0)</p>
              <div className="mt-1 space-y-1.5 max-h-28 overflow-y-auto">
                {lowGpaStudents.length > 0 ? lowGpaStudents.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-1.5">
                    <span className="text-xs font-medium">{s.name}</span>
                    <span className="text-xs text-amber-600 font-semibold">{s.gpa} GPA</span>
                  </div>
                )) : (
                  <div className="text-xs text-muted-foreground py-2">No low GPA students</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Export */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Export</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exportButtons.map(btn => (
                <Button key={btn.label} variant="outline" className="w-full justify-start gap-3 h-auto py-3" onClick={() => setCurrentView('reports')}>
                  <div className={`size-8 rounded-lg flex items-center justify-center ${btn.color}`}>
                    <btn.icon className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{btn.label}</span>
                  <Download className="size-3.5 ml-auto text-muted-foreground" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
