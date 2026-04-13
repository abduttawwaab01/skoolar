'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import {
  TrendingUp, TrendingDown, Target,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, AreaChart, Area,
} from 'recharts';
import { toast } from 'sonner';

interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  totalExams: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
}

interface AttendanceTrendItem {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

interface SchoolOverview {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  studentTeacherRatio: number;
}

interface StudentResultTerm {
  termId: string;
  termName: string;
  subjects: Array<{
    examId: string;
    examName: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    score: number;
    totalMarks: number;
    grade: string | null;
    percentage: number;
  }>;
  totalScore: number;
  totalMarks: number;
  average: number;
  overallPercentage: number;
  gpa: number;
  passed: number;
  failed: number;
  totalSubjects: number;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      ))}
    </div>
  );
}

export function StudentAnalytics() {
  const selectedSchoolId = useAppStore((s) => s.selectedSchoolId);
  const selectedClassId = useAppStore((s) => s.selectedClassId);
  const [loading, setLoading] = React.useState(true);
  const [performanceBySubject, setPerformanceBySubject] = React.useState<SubjectPerformance[]>([]);
  const [attendanceTrend, setAttendanceTrend] = React.useState<AttendanceTrendItem[]>([]);
  const [studentResults, setStudentResults] = React.useState<StudentResultTerm[]>([]);
  const [overview, setOverview] = React.useState<SchoolOverview | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [analyticsRes, resultsRes] = await Promise.all([
        fetch(`/api/analytics?schoolId=${selectedSchoolId}${selectedClassId ? `&classId=${selectedClassId}` : ''}`),
        // Try to fetch results for the current user's student record
        fetch(`/api/results?schoolId=${selectedSchoolId}`).catch(() => null),
      ]);

      if (analyticsRes.ok) {
        const analyticsJson = await analyticsRes.json();
        const data = analyticsJson.data;
        setPerformanceBySubject(data?.performanceBySubject || []);
        setAttendanceTrend(data?.attendanceTrend || []);
        setOverview(data?.schoolOverview || null);
      }

      if (resultsRes && resultsRes.ok) {
        const resultsJson = await resultsRes.json();
        if (resultsJson.data?.terms) {
          setStudentResults(resultsJson.data.terms);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId, selectedClassId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build subject comparison from analytics performance data
  const subjectComparison = React.useMemo(() => {
    if (studentResults.length > 0 && studentResults[0].subjects.length > 0) {
      return studentResults[0].subjects.map(s => ({
        subject: s.subjectName.split(' ').pop() || s.subjectName,
        myScore: s.percentage,
        classAvg: performanceBySubject.find(ps => ps.subjectName === s.subjectName)?.averageScore || 0,
      }));
    }
    return performanceBySubject.map(s => ({
      subject: s.subjectName.split(' ').pop() || s.subjectName,
      myScore: s.averageScore,
      classAvg: s.averageScore,
    }));
  }, [performanceBySubject, studentResults]);

  // Build attendance trend for chart (weekly aggregation)
  const weeklyAttendance = React.useMemo(() => {
    if (attendanceTrend.length === 0) return [];
    // Group by week (every 7 days)
    const weeks: { week: string; rate: number }[] = [];
    for (let i = 0; i < attendanceTrend.length; i += 7) {
      const chunk = attendanceTrend.slice(i, i + 7);
      const totalPresent = chunk.reduce((sum, d) => sum + d.present, 0);
      const totalAll = chunk.reduce((sum, d) => sum + d.total, 0);
      if (totalAll > 0) {
        const weekNum = Math.floor(i / 7) + 1;
        weeks.push({
          week: `Week ${weekNum}`,
          rate: Math.round((totalPresent / totalAll) * 100),
        });
      }
    }
    return weeks.length > 0 ? weeks : [{ week: 'Week 1', rate: 0 }];
  }, [attendanceTrend]);

  // Build performance trend from student results if available
  const performanceTrend = React.useMemo(() => {
    if (studentResults.length === 0) {
      // Generate a simple trend from subject performance data
      return performanceBySubject.length > 0
        ? [{ month: 'Current', avg: performanceBySubject.reduce((sum, s) => sum + s.averageScore, 0) / performanceBySubject.length }]
        : [];
    }
    return studentResults.map((term, i) => ({
      month: term.termName.length > 8 ? term.termName.substring(0, 8) : term.termName,
      avg: term.overallPercentage || term.average,
    }));
  }, [performanceBySubject, studentResults]);

  // Strengths and areas derived from data
  const strengths = React.useMemo(() => {
    const sorted = [...performanceBySubject].sort((a, b) => b.averageScore - a.averageScore).slice(0, 3);
    return sorted.map(s => ({
      subject: s.subjectName,
      score: Math.round(s.averageScore),
      vsClass: `+${Math.max(0, Math.round(s.averageScore - (performanceBySubject.reduce((sum, p) => sum + p.averageScore, 0) / Math.max(performanceBySubject.length, 1))))}`,
    }));
  }, [performanceBySubject]);

  const areas = React.useMemo(() => {
    const sorted = [...performanceBySubject].sort((a, b) => a.averageScore - b.averageScore).slice(0, 3);
    return sorted.map(a => ({
      subject: a.subjectName,
      score: Math.round(a.averageScore),
      vsClass: `+${Math.max(0, Math.round(a.averageScore - (performanceBySubject.reduce((sum, p) => sum + p.averageScore, 0) / Math.max(performanceBySubject.length, 1))))}`,
    }));
  }, [performanceBySubject]);

  const avgScore = performanceBySubject.length > 0
    ? Math.round(performanceBySubject.reduce((sum, s) => sum + s.averageScore, 0) / performanceBySubject.length)
    : 0;

  if (loading) return <LoadingSkeleton />;

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <TrendingUp className="size-10 mb-3" />
        <p className="text-sm font-medium">No school selected</p>
        <p className="text-xs mt-1">Please select a school to view analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-muted-foreground">Detailed analysis of academic performance</p>
      </div>

      {/* Performance Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Performance Trend</CardTitle>
          <CardDescription>Average score across terms</CardDescription>
        </CardHeader>
        <CardContent>
          {performanceTrend.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <TrendingUp className="size-8 mb-2" />
              <p className="text-sm">No performance trend data available</p>
              <p className="text-xs mt-1">Data will appear once exam results are recorded</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="avg" stroke="#059669" strokeWidth={3} dot={{ r: 5, fill: '#059669' }} activeDot={{ r: 7 }} name="Average Score" />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-2 mt-2">
                <TrendingUp className="size-4 text-emerald-600" />
                <span className="text-sm text-emerald-600 font-medium">Class average: {avgScore}%</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Subject Comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subject Comparison</CardTitle>
          <CardDescription>Performance by subject</CardDescription>
        </CardHeader>
        <CardContent>
          {subjectComparison.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No subject comparison data available</p>
              <p className="text-xs mt-1">Data will appear once exam results are recorded</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={subjectComparison}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar dataKey="myScore" fill="#059669" radius={[4, 4, 0, 0]} name="My Score" />
                <Bar dataKey="classAvg" fill="#D1D5DB" radius={[4, 4, 0, 0]} name="Class Average" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Attendance Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Attendance Trend</CardTitle>
          <CardDescription>Weekly attendance rate</CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyAttendance.length === 0 || (weeklyAttendance.length === 1 && weeklyAttendance[0].rate === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No attendance trend data available</p>
              <p className="text-xs mt-1">Data will appear once attendance is recorded</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyAttendance}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[85, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Area type="monotone" dataKey="rate" stroke="#2563EB" fill="#2563EB" fillOpacity={0.1} strokeWidth={2} name="Attendance %" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Strengths & Areas */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Strengths */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-600" /> Top Strengths
            </CardTitle>
            <CardDescription>Subjects where students excel the most</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {strengths.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">No data available yet</p>
              </div>
            ) : strengths.map(s => (
              <div key={s.subject}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{s.subject}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-600">{s.score}%</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">{s.vsClass}</Badge>
                  </div>
                </div>
                <Progress value={s.score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Areas for Improvement */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4 text-amber-600" /> Areas for Improvement
            </CardTitle>
            <CardDescription>Focus areas to boost performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {areas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">No data available yet</p>
              </div>
            ) : areas.map(a => (
              <div key={a.subject}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{a.subject}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-600">{a.score}%</span>
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">{a.vsClass}</Badge>
                  </div>
                </div>
                <Progress value={a.score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
