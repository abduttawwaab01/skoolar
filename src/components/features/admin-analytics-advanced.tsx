'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart3, TrendingUp, TrendingDown, Users, GraduationCap, Wallet, Calendar,
  RefreshCw, Download, Lightbulb, ArrowUpRight, ArrowDownRight, Minus,
  Building2, PieChart as PieIcon, Activity, Target, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  LineChart, Line, PieChart, Pie, ScatterChart, Scatter, ZAxis,
  ComposedChart, Area,
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const keyInsights = [
  {
    icon: TrendingUp,
    color: 'text-emerald-600 bg-emerald-100',
    title: 'Enrollment Growth',
    description: 'Track total enrollment changes over the selected period.',
  },
  {
    icon: Calendar,
    color: 'text-blue-600 bg-blue-100',
    title: 'Attendance Correlation',
    description: 'Students with higher attendance tend to have better academic performance.',
  },
  {
    icon: Wallet,
    color: 'text-amber-600 bg-amber-100',
    title: 'Fee Collection',
    description: 'Monitor revenue collection rates and outstanding balances.',
  },
  {
    icon: Target,
    color: 'text-purple-600 bg-purple-100',
    title: 'Top Performing Class',
    description: 'Identify classes with the highest average performance.',
  },
];

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
    section: string | null;
    grade: string | null;
    totalStudents: number;
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    percentage: number;
  }>;
  performanceBySubject: Array<{
    subjectId: string;
    subjectName: string;
    totalExams: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
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
    admissionNo: string;
    gpa: number;
    totalScore: number;
    examCount: number;
    user: { name: string | null; avatar: string | null };
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

export default function AdminAnalyticsAdvanced() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  const [dateRange, setDateRange] = useState('this_term');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!schoolId) {
      setError('No school selected');
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      setIsRefreshing(true);
      const res = await fetch(`/api/analytics?schoolId=${schoolId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch analytics');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setAnalyticsData(json.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = () => {
    fetchAnalytics();
  };

  const handleExportSummary = () => {
    if (!analyticsData) return;
    const ov = analyticsData.schoolOverview;
    const fin = analyticsData.financialData;
    const summary = `Skoolar Executive Summary
========================
Date: ${new Date().toLocaleDateString()}

1. Total Students: ${ov.totalStudents.toLocaleString()}
2. Total Teachers: ${ov.totalTeachers}
3. Total Classes: ${ov.totalClasses}
4. Student:Teacher Ratio: ${ov.studentTeacherRatio}
5. Total Revenue: ₦${(fin.totalRevenue).toLocaleString()}
6. Total Transactions: ${fin.totalTransactions}

Powered by Skoolar || Odebunmi Tawwāb`;

    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executive-summary-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Executive summary exported');
  };

  const formatCurrency = (value: number) => `₦${(value / 1000000).toFixed(1)}M`;

  // Derived chart data from analytics
  const attendanceChartData = analyticsData?.attendanceByClass.map(c => ({
    class: c.className,
    present: c.presentCount,
    absent: c.absentCount,
    late: c.lateCount,
    rate: c.percentage,
  })) || [];

  const performanceChartData = analyticsData?.performanceBySubject.map(s => ({
    subject: s.subjectName.length > 12 ? s.subjectName.slice(0, 12) + '...' : s.subjectName,
    average: s.averageScore,
    passRate: s.passRate,
  })) || [];

  const genderDistribution = analyticsData
    ? [
        { name: 'Present', value: analyticsData.attendanceByClass.reduce((a, c) => a + c.presentCount, 0), fill: '#10b981' },
        { name: 'Absent', value: analyticsData.attendanceByClass.reduce((a, c) => a + c.absentCount, 0), fill: '#ef4444' },
        { name: 'Late', value: analyticsData.attendanceByClass.reduce((a, c) => a + c.lateCount, 0), fill: '#f59e0b' },
      ]
    : [];

  const scatterData = analyticsData?.studentRanking.map(s => ({
    totalScore: s.totalScore,
    examCount: s.examCount,
    name: s.user?.name || `Student ${s.rank}`,
    gpa: s.gpa,
  })) || [];

  const attendanceTrendForChart = analyticsData?.attendanceTrend.map(t => ({
    date: isMounted 
      ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : t.date.split('T')[0], // Stable ISO fallback
    rate: t.total > 0 ? Math.round((t.present / t.total) * 100) : 0,
    present: t.present,
    absent: t.absent,
  })) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error && !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <BarChart3 className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Advanced Analytics</h2>
            <p className="text-sm text-gray-500">Comprehensive school performance insights</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchAnalytics} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analyticsData) return null;

  const ov = analyticsData.schoolOverview;
  const fin = analyticsData.financialData;
  const avgAttendanceRate = analyticsData.attendanceByClass.length > 0
    ? Math.round(analyticsData.attendanceByClass.reduce((a, c) => a + c.percentage, 0) / analyticsData.attendanceByClass.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <BarChart3 className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Advanced Analytics</h2>
            <p className="text-sm text-gray-500">Comprehensive school performance insights</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_term">This Term</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExportSummary} className="gap-2">
            <Download className="h-4 w-4" />
            Export Summary
          </Button>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {keyInsights.map((insight, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${insight.color}`}>
                  <insight.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{insight.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{insight.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Students', value: ov.totalStudents.toLocaleString(), icon: Users, trend: 'up' as const, change: 'Active' },
          { label: 'Total Teachers', value: ov.totalTeachers.toString(), icon: GraduationCap, trend: 'up' as const, change: 'Active' },
          { label: 'S:T Ratio', value: ov.studentTeacherRatio.toString(), icon: Target, trend: 'stable' as const, change: '' },
          { label: 'Avg Attendance', value: `${avgAttendanceRate}%`, icon: Calendar, trend: avgAttendanceRate >= 85 ? 'up' as const : 'down' as const, change: avgAttendanceRate >= 85 ? 'Good' : 'Low' },
          { label: 'Revenue', value: formatCurrency(fin.totalRevenue), icon: Wallet, trend: 'up' as const, change: '' },
          { label: 'Classes', value: ov.totalClasses.toString(), icon: Building2, trend: 'stable' as const, change: '' },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <kpi.icon className="h-4 w-4 text-gray-400" />
                <span className={`text-[10px] flex items-center gap-0.5 ${
                  kpi.trend === 'up' ? 'text-emerald-600' :
                  kpi.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {kpi.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> :
                   kpi.trend === 'down' ? <ArrowDownRight className="h-3 w-3" /> :
                   <Minus className="h-3 w-3" />}
                  {kpi.change}
                </span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs">Attendance by Class</TabsTrigger>
          <TabsTrigger value="enrollment" className="text-xs">Attendance Trend</TabsTrigger>
          <TabsTrigger value="revenue" className="text-xs">Performance</TabsTrigger>
          <TabsTrigger value="correlation" className="text-xs">Score Distribution</TabsTrigger>
          <TabsTrigger value="demographics" className="text-xs">Status Breakdown</TabsTrigger>
        </TabsList>

        {/* Attendance by Class */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attendance by Class</CardTitle>
              <CardDescription>Attendance rates across all classes</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData.attendanceByClass.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No attendance data available yet.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-center">Students</TableHead>
                        <TableHead className="text-center">Records</TableHead>
                        <TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-center">Late</TableHead>
                        <TableHead className="text-center">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyticsData.attendanceByClass.map(cls => (
                        <TableRow key={cls.classId}>
                          <TableCell className="font-medium">{cls.className} {cls.section ? `(${cls.section})` : ''}</TableCell>
                          <TableCell className="text-center">{cls.totalStudents}</TableCell>
                          <TableCell className="text-center">{cls.totalRecords}</TableCell>
                          <TableCell className="text-center text-emerald-600">{cls.presentCount}</TableCell>
                          <TableCell className="text-center text-red-600">{cls.absentCount}</TableCell>
                          <TableCell className="text-center text-amber-600">{cls.lateCount}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={cls.percentage >= 90 ? 'default' : cls.percentage >= 75 ? 'secondary' : 'destructive'} className="text-xs">
                              {cls.percentage}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Trend */}
        <TabsContent value="enrollment">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attendance Rate Trend</CardTitle>
              <CardDescription>Daily attendance rate over time</CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceTrendForChart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No attendance trend data available yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={attendanceTrendForChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="rate" name="Attendance %" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance by Subject */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Average Score by Subject</CardTitle>
                <CardDescription>Subject performance overview</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceChartData.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No exam performance data available yet.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="average" name="Avg Score" radius={[4, 4, 0, 0]}>
                        {performanceChartData.map((_, i) => (
                          <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pass Rate by Subject</CardTitle>
                <CardDescription>Percentage of students passing each subject</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceChartData.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No pass rate data available yet.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performanceChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="subject" type="category" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="passRate" name="Pass Rate %" radius={[0, 4, 4, 0]}>
                        {performanceChartData.map((entry, i) => (
                          <Cell key={`cell-${i}`} fill={entry.passRate >= 80 ? '#10b981' : entry.passRate >= 60 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Score Distribution */}
        <TabsContent value="correlation">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Student Score Distribution</CardTitle>
              <CardDescription>Total exam scores vs number of exams taken</CardDescription>
            </CardHeader>
            <CardContent>
              {scatterData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No student score data available yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="examCount" type="number" name="Exams Taken" />
                    <YAxis dataKey="totalScore" type="number" name="Total Score" />
                    <ZAxis range={[30, 50]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                      if (payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-2 border rounded shadow-sm text-xs">
                            <p className="font-medium">{data.name}</p>
                            <p>Exams: {data.examCount}</p>
                            <p>Total Score: {data.totalScore}</p>
                            <p>GPA: {data.gpa}</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Scatter data={scatterData} fill="#8b5cf6" opacity={0.6} />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demographics / Status Breakdown */}
        <TabsContent value="demographics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance Status Breakdown</CardTitle>
                <CardDescription>Present, Absent, Late distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {genderDistribution.every(d => d.value === 0) ? (
                  <div className="text-center py-12 text-gray-500">
                    <PieChart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No attendance status data available yet.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={genderDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {genderDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Financial Summary</CardTitle>
                <CardDescription>Revenue breakdown by status</CardDescription>
              </CardHeader>
              <CardContent>
                {fin.byStatus.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No financial data available yet.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={fin.byStatus}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Amount']} />
                      <Bar dataKey="total" name="Revenue" radius={[4, 4, 0, 0]}>
                        {fin.byStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-gray-400 text-center">Powered by Skoolar || Odebunmi Tawwāb</p>
    </div>
  );
}
