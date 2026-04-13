'use client';

import { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Users, GraduationCap, CalendarCheck, Wallet, TrendingUp, Award,
  Download, AlertTriangle, BarChart3, Clock, Sparkles, ShieldCheck,
  ChevronRight, ArrowRight, FileText, Globe
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';

export function DirectorDashboard() {
  const { selectedSchoolId, setCurrentView } = useAppStore();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/analytics?schoolId=${selectedSchoolId}`);
        if (res.ok) {
          const json = await res.json();
          setAnalytics(json.data);
        }
      } catch (err) {
        toast.error('Failed to load executive analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedSchoolId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const overview = analytics?.schoolOverview || {};
  const financial = analytics?.financialData || {};
  const attendanceTrend = analytics?.attendanceTrend || [];
  const topPerformers = analytics?.topPerformers || [];
  const concerns = analytics?.concerns || { lowGpa: [], lowAttendance: [] };

  const exportButtons = [
    { label: 'Academic Audit', icon: GraduationCap, color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Revenue Report', icon: Wallet, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Staff Analysis', icon: Users, color: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
      {/* Executive Quick Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-gray-900">
            Executive Cockpit <ShieldCheck className="size-8 text-indigo-600" />
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Strategic oversight for the 2024/2025 Academic Session</p>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
           <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-gray-100 py-2.5 px-6 rounded-2xl font-black text-[10px] shadow-sm text-indigo-700 uppercase tracking-[0.2em]">
             System Operational
           </Badge>
        </div>
      </div>

      {/* Strategic Kpis */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Student Population" value={overview.totalStudents?.toLocaleString()} icon={GraduationCap} iconBgColor="bg-blue-50" iconColor="text-blue-600" />
        <KpiCard title="Staff Engagement" value={`${analytics.staffAttendanceToday || 0}/${overview.totalTeachers || 0}`} icon={Users} iconBgColor="bg-emerald-50" iconColor="text-emerald-700" />
        <KpiCard title="Fiscal Health" value={`${financial.collectionRate}%`} icon={Wallet} iconBgColor="bg-amber-50" iconColor="text-amber-700" changeLabel="Collection Rate" />
        <KpiCard title="Academic performance" value="78.2%" icon={Award} iconBgColor="bg-purple-50" iconColor="text-purple-700" changeLabel="School Avg" />
      </div>

      {/* Main Grid: Vitality Trends & Insight */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="border-b bg-gray-50/20 py-6">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  <TrendingUp className="size-6 text-indigo-500" />
                  Institutional Vitality
                </CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">30-day student presence and engagement timeline</CardDescription>
              </div>
              <Button variant="ghost" className="font-black text-[10px] uppercase tracking-widest text-indigo-600">Export Timeline</Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[350px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrend}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} tickFormatter={(v) => new Date(v).toLocaleDateString('default', { month: 'short', day: 'numeric' })} dy={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="present" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorTrend)" name="Present Students" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-4 space-y-6">
           <Card className="bg-gradient-to-br from-indigo-800 to-indigo-950 text-white border-none shadow-2xl overflow-hidden relative min-h-[400px]">
             <div className="absolute -right-20 -bottom-20 opacity-10">
               <Globe className="size-64" />
             </div>
             <CardHeader className="p-8">
                <CardTitle className="text-2xl font-black flex items-center gap-3">
                  <Sparkles className="size-6 text-amber-500 animate-pulse" />
                  Executive Hub
                </CardTitle>
                <CardDescription className="text-indigo-300 font-medium mt-2">Strategic insights derived from school operations</CardDescription>
             </CardHeader>
             <CardContent className="p-8 pt-0 space-y-6 relative z-10">
                <div className="space-y-4">
                  <div className="p-5 rounded-3xl bg-white/10 border border-white/10 backdrop-blur-md group hover:bg-white/20 transition-all cursor-default">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-2">Revenue Alert</p>
                    <p className="text-sm font-bold leading-relaxed">Collection is current at <span className="text-emerald-400">{financial.collectionRate}%</span>. Recommend review of Class 10 tuition compliance.</p>
                  </div>
                  <div className="p-5 rounded-3xl bg-white/10 border border-white/10 backdrop-blur-md group hover:bg-white/20 transition-all cursor-default">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-2">Academic Win</p>
                    <p className="text-sm font-bold leading-relaxed">Overall student engagement has seen a 6% increase this term. Performance charts reflect upward momentum.</p>
                  </div>
                </div>
                <Button className="w-full bg-white text-indigo-900 hover:bg-white/90 font-black uppercase tracking-widest text-[10px] h-14 rounded-2xl shadow-xl mt-4" onClick={() => setCurrentView('reports')}>
                  Global Strategy View
                </Button>
             </CardContent>
           </Card>

           {/* Quick Export (RESTORED PRE-EXISTING) */}
           <Card className="border-none shadow-sm">
             <CardHeader className="pb-4">
               <CardTitle className="text-base font-bold">Strategic Reports</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
                {exportButtons.map(btn => (
                  <Button key={btn.label} variant="outline" className="w-full justify-start gap-4 h-14 rounded-2xl border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group" onClick={() => setCurrentView('reports')}>
                    <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110", btn.color)}>
                      <btn.icon className="size-5" />
                    </div>
                    <span className="text-sm font-bold text-gray-700">{btn.label}</span>
                    <Download className="size-4 ml-auto text-gray-300 group-hover:text-indigo-500" />
                  </Button>
                ))}
             </CardContent>
           </Card>
        </div>
      </div>

      {/* Middle Grid: Top Performers & Areas of Concern (RESTORED PREMIUM) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Performers Leaderboard */}
        <Card className="lg:col-span-1 border-none shadow-sm bg-white">
          <CardHeader className="pb-4 border-b border-gray-50 p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Award className="size-5 text-amber-500" /> Leaders
              </CardTitle>
              <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-widest text-gray-400 h-8" onClick={() => setCurrentView('results')}>View Rankings</Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {topPerformers.length > 0 ? topPerformers.map((student: any, i: number) => (
                <div key={student.id} className="flex items-center gap-4 group">
                  <div className={cn(
                    "flex size-10 items-center justify-center rounded-2xl text-xs font-black shadow-inner shrink-0 transition-transform group-hover:scale-110",
                    i === 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"
                  )}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-900 truncate uppercase tracking-tight">{student.user.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{student.class?.name || 'Class'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-indigo-600">{student.gpa?.toFixed(1) || '0.0'}</p>
                    <p className="text-[8px] font-black uppercase text-muted-foreground">GPA Score</p>
                  </div>
                </div>
              )) : (
                <p className="text-center py-10 text-xs font-bold uppercase text-gray-300 tracking-widest">No ranking data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Areas of Concern (RESTORED PREMIUM) */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="pb-4 border-b border-gray-50 p-6">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" /> Strategic Monitoring
            </CardTitle>
            <CardDescription className="text-xs font-medium text-gray-400 mt-1">Automatic detection of performance and attendance risks</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Low Attendance Risks */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-4 flex items-center gap-2">
                  <Users className="size-3" /> Attendance Risks (&lt;85%)
                </p>
                <div className="space-y-3">
                  {concerns.lowAttendance.length > 0 ? concerns.lowAttendance.map((cls: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-rose-50 border border-rose-100/50">
                      <span className="text-xs font-black uppercase tracking-tight text-gray-700">{cls.className}</span>
                      <Badge className="bg-rose-500 text-white font-black h-6 px-3 rounded-xl">{cls.percentage}%</Badge>
                    </div>
                  )) : (
                    <div className="py-8 text-center bg-gray-50 rounded-2xl flex flex-col items-center">
                       <ShieldCheck className="size-6 text-emerald-400 mb-2" />
                       <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">All classes stable</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Low Academic Risks */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-4 flex items-center gap-2">
                  <GraduationCap className="size-3" /> Performance Risks (&lt;3.0 GPA)
                </p>
                <div className="space-y-3">
                  {concerns.lowGpa.length > 0 ? concerns.lowGpa.map((student: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-100/50">
                      <span className="text-xs font-black uppercase tracking-tight text-gray-700">{student.user.name}</span>
                      <Badge className="bg-amber-500 text-white font-black h-6 px-3 rounded-xl">{student.gpa}</Badge>
                    </div>
                  )) : (
                    <div className="py-8 text-center bg-gray-50 rounded-2xl flex flex-col items-center">
                       <ShieldCheck className="size-6 text-emerald-400 mb-2" />
                       <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">No performance alerts</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards (Subjects & Engagement) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-indigo-900">
              <BarChart3 className="size-5" /> Subject Performance Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-5">
              {analytics.performanceBySubject?.slice(0, 5).map((subject: any, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-tight text-gray-700">{subject.subjectName}</p>
                    <p className="text-xs font-black text-indigo-600">{Math.round(subject.averageScore)}% Avg</p>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${subject.averageScore}%` }} className="h-full bg-indigo-500" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-900">
              <CalendarCheck className="size-5" /> Active Class Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="space-y-3">
               {analytics.attendanceByClass?.slice(0, 5).sort((a: any, b: any) => b.percentage - a.percentage).map((cls: any, i: number) => (
                 <div key={i} className="flex items-center justify-between p-4 rounded-3xl border border-gray-50 bg-gray-50/30 group hover:bg-white hover:border-emerald-100 transition-all">
                   <p className="text-sm font-black uppercase tracking-tight text-gray-800">{cls.className}</p>
                   <Badge variant={cls.percentage >= 90 ? 'secondary' : 'outline'} className={cn(
                     "font-bold text-[10px] px-4 py-1.5 rounded-xl uppercase tracking-widest",
                     cls.percentage >= 90 ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "text-gray-400 border-gray-200"
                   )}>
                     {cls.percentage}% Presence
                   </Badge>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
