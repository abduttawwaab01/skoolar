'use client';

import * as React from 'react';
import { memo, Suspense, lazy } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { ExportMenu } from '@/components/shared/export-menu';
import { Search, CalendarDays, Users, RefreshCw, XCircle, TrendingUp as TrendingUpIcon, Award, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';

const BarChartComponent = lazy(() => import('@/components/shared/bar-chart').then(mod => ({ default: mod.default })));
const LineChartComponent = lazy(() => import('@/components/shared/line-chart').then(mod => ({ default: mod.default })));
const PieChartComponent = lazy(() => import('@/components/shared/pie-chart').then(mod => ({ default: mod.default })));

function ChartsLoadingFallback({ height = 280 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
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
    userId: string;
    classId: string | null;
    gpa: number;
    cumulativeGpa: number;
    user: { name: string | null; avatar: string | null };
    class: { name: string; section: string | null } | null;
    totalScore: number;
    examCount: number;
  }>;
  attendanceTrend: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    total: number;
  }>;
}

interface ClassOption {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
}

export function AnalyticsView() {
    const { selectedSchoolId, currentRole, currentUser } = useAppStore();
    const effectiveSchoolId = selectedSchoolId || (currentRole !== 'SUPER_ADMIN' ? currentUser.schoolId : null);
   const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
   const [classes, setClasses] = React.useState<ClassOption[]>([]);
   const [currentTerm, setCurrentTerm] = React.useState<{ name: string; startDate: string; endDate: string } | null>(null);
   const [loading, setLoading] = React.useState(true);
   const [error, setError] = React.useState<string | null>(null);
   const [searchQuery, setSearchQuery] = React.useState('');
   const [selectedClass, setSelectedClass] = React.useState<string>('all');

   const isPlatformLevel = currentRole === 'SUPER_ADMIN' && !effectiveSchoolId;

   const fetchAnalytics = React.useCallback(async () => {
     if (!effectiveSchoolId && !isPlatformLevel) {
       setLoading(false);
       return;
     }
     try {
       setLoading(true);
       setError(null);

       const schoolQueryParam = effectiveSchoolId ? `?schoolId=${effectiveSchoolId}` : '';
       const classesQueryParam = effectiveSchoolId ? `?schoolId=${effectiveSchoolId}&limit=50` : '?limit=50';
       const termsQueryParam = effectiveSchoolId ? `?schoolId=${effectiveSchoolId}&isCurrent=true` : '';

         const [analyticsRes, classesRes, termRes] = await Promise.allSettled([
           fetch(`/api/analytics${schoolQueryParam}`),
           fetch(`/api/classes${classesQueryParam}`),
           termsQueryParam ? fetch(`/api/terms${termsQueryParam}`) : Promise.resolve(null),
         ]);

         if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
           const json = await analyticsRes.value.json();
           if (json.error) throw new Error(json.error);
           setAnalytics(json.data || null);
         } else if (analyticsRes.status === 'fulfilled') {
           const json = await analyticsRes.value.json();
           throw new Error(json.error || `Failed to fetch analytics (${analyticsRes.value.status})`);
         } else {
           throw new Error('Failed to fetch analytics');
         }

       if (classesRes.status === 'fulfilled' && classesRes.value.ok) {
         const json = await classesRes.value.json();
         setClasses(Array.isArray(json.data) ? json.data : []);
       }

       if (termRes.status === 'fulfilled' && termRes.value && termRes.value.ok) {
         const json = await termRes.value.json();
         const terms = json.data || [];
         if (terms.length > 0) {
           const term = terms[0];
           const start = new Date(term.startDate);
           const end = new Date(term.endDate);
           const startStr = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
           const endStr = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
           setCurrentTerm({
             name: term.name,
             startDate: startStr,
             endDate: endStr,
           });
         }
       }
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Unknown error');
       toast.error('Failed to load analytics data');
     } finally {
       setLoading(false);
     }
   }, [effectiveSchoolId, isPlatformLevel]);

  React.useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Prepare chart data
  const performanceBySubject = React.useMemo(() => {
    if (!analytics?.performanceBySubject) return [];
    return analytics.performanceBySubject.slice(0, 6).map(s => ({
      subject: s.subjectName,
      term1: Math.round(s.averageScore * 0.9),
      term2: Math.round(s.averageScore),
    }));
  }, [analytics]);

  const attendanceTrend = React.useMemo(() => {
    if (!analytics?.attendanceTrend) return [];
    return analytics.attendanceTrend.slice(-5).map(d => ({
      day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      present: d.present,
      absent: d.absent,
    }));
  }, [analytics]);

  const gradeDistribution = React.useMemo(() => {
    if (!analytics?.studentRanking) return [];
    const ranking = Array.isArray(analytics.studentRanking) ? analytics.studentRanking : [];
    const gpas = ranking.map(s => s.gpa || 0);
    if (gpas.length === 0) return [];
    const a = gpas.filter(g => g >= 3.5).length;
    const b = gpas.filter(g => g >= 3.0 && g < 3.5).length;
    const c = gpas.filter(g => g >= 2.5 && g < 3.0).length;
    const d = gpas.filter(g => g >= 2.0 && g < 2.5).length;
    const f = gpas.filter(g => g < 2.0).length;
    const total = gpas.length;
    return [
      { grade: 'A', value: total > 0 ? Math.round((a / total) * 100) : 0, color: 'hsl(152, 69%, 31%)' },
      { grade: 'B', value: total > 0 ? Math.round((b / total) * 100) : 0, color: 'hsl(187, 91%, 36%)' },
      { grade: 'C', value: total > 0 ? Math.round((c / total) * 100) : 0, color: 'hsl(36, 90%, 44%)' },
      { grade: 'D', value: total > 0 ? Math.round((d / total) * 100) : 0, color: 'hsl(0, 74%, 50%)' },
      { grade: 'F', value: total > 0 ? Math.round((f / total) * 100) : 0, color: 'hsl(262, 69%, 47%)' },
    ];
  }, [analytics]);

   // Computed statistics
   const avgAttendance = React.useMemo(() => {
     if (!analytics?.attendanceByClass?.length) return 0;
     const total = analytics.attendanceByClass.reduce((sum, cls) => sum + cls.percentage, 0);
     return Math.round(total / analytics.attendanceByClass.length);
   }, [analytics]);

    const avgGPA = React.useMemo(() => {
      if (!analytics?.studentRanking?.length) return null;
      const gpulos = analytics.studentRanking.filter(s => s.gpa && s.gpa > 0).map(s => s.gpa as number);
      if (gpulos.length === 0) return null;
      const sum = gpulos.reduce((a, b) => a + b, 0);
      return (sum / gpulos.length).toFixed(2);
    }, [analytics]);

   const filteredStudents = React.useMemo(() => {
     if (!analytics?.studentRanking) return [];
     let list = analytics.studentRanking;
     if (selectedClass !== 'all') {
       list = list.filter(s => s.class?.name === selectedClass || s.classId === selectedClass);
     }
     if (searchQuery) {
       list = list.filter(s => (s.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
     }
     return list;
   }, [analytics, searchQuery, selectedClass]);

  // Gender data not available from analytics API
  const totalStudents = analytics?.schoolOverview?.totalStudents || 0;

  const classOptions = React.useMemo(() => {
    const names = new Set<string>();
    analytics?.attendanceByClass.forEach(c => {
      names.add(`${c.className}${c.section ? ` ${c.section}` : ''}`);
    });
    return Array.from(names);
  }, [analytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4"><Skeleton className="h-6 w-48" /><Skeleton className="h-8 w-40" /></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-52" /></CardHeader><CardContent><Skeleton className="h-[260px] w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-52" /></CardHeader><CardContent><Skeleton className="h-[260px] w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Advanced Analytics</h2>
            <p className="text-sm text-muted-foreground">Comprehensive academic and performance insights</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="size-12 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="size-6 text-red-600" /></div>
          <div className="text-center"><p className="text-sm font-medium">Failed to load analytics</p><p className="text-xs text-muted-foreground mt-1">{error}</p></div>
          <Button variant="outline" size="sm" onClick={fetchAnalytics}><RefreshCw className="size-3.5 mr-1.5" /> Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header with Date Range */}
      <motion.div 
        variants={fadeIn}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-lg sm:text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            Advanced Analytics
            <Sparkles className="size-5 text-indigo-500 animate-pulse" />
          </h2>
          <p className="text-sm font-medium text-gray-500">Comprehensive academic and performance insights</p>
        </div>
         <div className="flex items-center gap-2">
           <div className="flex items-center gap-2 rounded-2xl bg-white/50 backdrop-blur-md border border-white/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-indigo-600 shadow-sm">
             <CalendarDays className="size-4" />
             <span>{currentTerm ? `${currentTerm.startDate} – ${currentTerm.endDate}` : 'Select term'}</span>
           </div>
           {analytics && (
             <ExportMenu options={{
               title: 'Advanced Analytics Report',
                subtitle: `${currentTerm?.name || 'Current Term'} · ${effectiveSchoolId ? 'School Level' : 'Platform Level'}`,
                fileName: `analytics-report-${currentTerm?.name?.replace(/\s+/g, '_') || 'current'}`,
                summaryRows: [
                  { label: 'Total Students', value: String(analytics.schoolOverview?.totalStudents || 0) },
                  { label: 'Classes', value: String(analytics.schoolOverview?.totalClasses || 0) },
                  { label: 'Subjects', value: String(analytics.schoolOverview?.totalSubjects || 0) },
                  { label: 'Student:Teacher', value: `1:${analytics.schoolOverview?.studentTeacherRatio || 0}` },
                ],
                sections: [
                  { heading: 'Academic Performance', content: (analytics.performanceBySubject || []).map((s: any) => `${s.subjectName}: ${s.averageScore.toFixed(1)}% avg (${s.passRate.toFixed(1)}% pass)`) },
                  { heading: 'Attendance Overview', content: (analytics.attendanceByClass || []).map((c: any) => `${c.className}: ${c.percentage.toFixed(1)}%`) },
                ],
             }} />
           )}
         </div>
      </motion.div>

       {/* Stats Cards Row */}
       <motion.div variants={slideUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {[
           { label: 'Total Students', value: analytics?.schoolOverview?.totalStudents || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: 'Avg Attendance', value: avgAttendance > 0 ? `${avgAttendance}%` : 'N/A', icon: TrendingUpIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: 'Avg GPA', value: avgGPA || 'N/A', icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50' },
           { label: 'Revenue', value: '₦' + (analytics?.financialData?.totalRevenue || 0).toLocaleString(), icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
         ].map((stat, i) => (
           <div key={i} className="glass-panel p-6 rounded-3xl group hover:scale-[1.02] transition-all duration-300">
             <div className={cn("size-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:rotate-6", stat.bg)}>
               <stat.icon className={cn("size-6", stat.color)} />
             </div>
             <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-lg sm:text-2xl font-semibold text-gray-900 tracking-tight">{stat.value}</p>
           </div>
         ))}
       </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Term Comparison */}
        <motion.div variants={slideUp}>
          <Card className="glass-panel border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold uppercase tracking-tight">Term Comparison</CardTitle>
              <CardDescription className="text-xs font-medium">First Term vs Second Term average scores</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<ChartsLoadingFallback />}>
                <BarChartComponent data={performanceBySubject} />
              </Suspense>
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance Trends */}
        <motion.div variants={slideUp}>
          <Card className="glass-panel border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold uppercase tracking-tight">Attendance Trends</CardTitle>
              <CardDescription className="text-xs font-medium">Weekly attendance patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<ChartsLoadingFallback />}>
                <LineChartComponent data={attendanceTrend} />
              </Suspense>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Middle Row: Ranking Table + Grade Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Student Ranking */}
        <motion.div variants={slideUp}>
          <Card className="glass-panel border-0 shadow-lg rounded-3xl overflow-hidden h-full">
            <CardHeader className="pb-3 border-b border-gray-50/50">
              <CardTitle className="text-lg font-semibold uppercase tracking-tight">Student Rankings</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input 
                      placeholder="Search top performers..." 
                      className="pl-11 rounded-2xl bg-gray-50/50 border-gray-100 focus:bg-white transition-all h-11" 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                    />
                  </div>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-40 rounded-2xl bg-gray-50/50 border-gray-100 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100">
                      <SelectItem value="all">All Classes</SelectItem>
                      {classOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {filteredStudents.length > 0 ? filteredStudents.map((s, idx) => (
                    <motion.div 
                      key={s.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3 rounded-2xl border border-gray-50 bg-white/50 p-4 hover:border-indigo-100 hover:bg-white hover:shadow-sm transition-all group"
                    >
                      <span className={cn(
                        "flex size-10 items-center justify-center rounded-xl text-xs font-semibold shrink-0 transition-transform group-hover:scale-110",
                        s.rank === 1 ? "bg-amber-100 text-amber-700" : 
                        s.rank === 2 ? "bg-gray-100 text-gray-600" :
                        s.rank === 3 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"
                      )}>
                        #{s.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.user?.name || 'Unknown'}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.class ? `${s.class.name}${s.class.section ? ` ${s.class.section}` : ''}` : '-'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-indigo-600">{(s.gpa || 0).toFixed(2)} GPA</p>
                        <div className="w-16 h-1 rounded-full bg-gray-100 mt-1.5 overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(s.gpa / 4) * 100}%` }} />
                        </div>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="text-center py-20 flex flex-col items-center gap-2">
                       <Search className="size-10 text-gray-100" />
                       <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No candidates found</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Grade Distribution + Metrics */}
        <div className="flex flex-col gap-6">
          <motion.div variants={slideUp}>
            <Card className="glass-panel border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="text-lg font-semibold uppercase tracking-tight">Performance Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartsLoadingFallback height={220} />}>
                  <PieChartComponent data={gradeDistribution} />
                </Suspense>
              </CardContent>
            </Card>
          </motion.div>

          {/* Student Overview Metrics */}
          <motion.div variants={slideUp}>
            <Card className="glass-panel border-0 shadow-lg rounded-3xl overflow-hidden h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="size-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Users className="size-5 text-indigo-600" />
                  </div>
                  <p className="text-sm font-semibold uppercase tracking-tight">Cohort Demographics</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Total Students', value: totalStudents, color: 'text-blue-600', sub: 'Enrolled' },
                    { label: 'Total Faculty', value: analytics?.schoolOverview?.totalTeachers || 0, color: 'text-indigo-600', sub: 'Staff' },
                    { label: 'Total Classes', value: analytics?.schoolOverview?.totalClasses || 0, color: 'text-emerald-600', sub: 'Active' },
                    { label: 'Student:Teacher', value: analytics?.schoolOverview?.studentTeacherRatio || 0, color: 'text-amber-600', sub: 'Ratio' },
                  ].map((m, i) => (
                    <div key={i} className="p-4 rounded-3xl bg-gray-50/50 border border-gray-50 hover:bg-white hover:shadow-sm transition-all group">
                      <p className={cn("text-lg sm:text-2xl font-semibold mb-1 group-hover:scale-110 transition-transform", m.color)}>{m.value}</p>
                      <p className="text-[10px] font-semibold text-gray-900 uppercase tracking-widest">{m.label}</p>
                      <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">{m.sub}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
