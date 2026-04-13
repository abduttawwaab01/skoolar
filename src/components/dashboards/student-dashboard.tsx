'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  GraduationCap, CalendarCheck, Award, Star, Trophy, Clock, BookOpen,
  FileEdit, TrendingUp, Target, Medal, CheckCircle2, AlertTriangle, Info, Sparkles,
  Calendar, ChevronRight, BarChart3, LineChart as LineChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';

// --- Interfaces ---
interface StudentProfile {
  id: string;
  name: string;
  admissionNo: string;
  gpa: number;
  rank?: number;
  class?: { name: string; section?: string };
}

interface StudentStats {
  attendanceRate: number;
  behaviorScore: number;
  homeworkCompletion: number;
  homeworkPending: number;
}

interface ExamScore {
  subject: string;
  score: number;
  grade: string;
  classAvg?: number;
}

interface ActivityEntry {
  id: string;
  action: 'SUBMIT' | 'GRADE' | 'COMMENT' | 'INFO';
  details: string;
  date: string;
}

// --- Main Component ---
export function StudentDashboard() {
  const { currentUser, setCurrentView, selectedSchoolId } = useAppStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [studentData, setStudentData] = useState<any>(null);
  const [examScores, setExamScores] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [statsRes, resultsRes, announcementsRes] = await Promise.all([
          fetch('/api/students/stats'),
          fetch(`/api/results?studentId=me&limit=10`),
          fetch(`/api/announcements?schoolId=${schoolId}&limit=5`)
        ]);

        if (statsRes.ok) {
          const json = await statsRes.json();
          setStudentData(json.data);
        }

        if (resultsRes.ok) {
          const json = await resultsRes.json();
          const scores = json.data?.terms?.[0]?.subjects || [];
          setExamScores(scores);
        }

        if (announcementsRes.ok) {
          const json = await announcementsRes.json();
          setAnnouncements(json.data || []);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser.id, schoolId]);

  // Derived Data
  const studentName = studentData?.profile?.name || currentUser.name.split(' ')[0];
  const gpa = studentData?.profile?.gpa || 0;
  const attendanceRate = studentData?.stats?.attendanceRate || 0;
  const rank = studentData?.profile?.rank;
  const behaviorScore = studentData?.stats?.behaviorScore || 0;
  const homeworkPending = studentData?.stats?.homeworkPending || 0;
  const homeworkCompletion = studentData?.stats?.homeworkCompletion || 0;
  const activities = studentData?.activities || [];
  const nextExam = studentData?.nextExam;

  const displayResults = useMemo(() => {
    return examScores.map(score => ({
      subject: score.subject?.name || score.name || 'Subject',
      score: score.score || 0,
      grade: score.grade || (score.score >= 80 ? 'A' : score.score >= 60 ? 'B' : 'C'),
      classAvg: score.classAverage || null
    }));
  }, [examScores]);

  // Performance Trend (derived from exam scores or mocked if single term)
  const performanceTrend = useMemo(() => {
    if (displayResults.length > 0) {
      return displayResults.slice(0, 6).reverse().map((r, i) => ({
        name: r.subject.substring(0, 3),
        score: r.score,
        avg: r.classAvg || 75
      }));
    }
    return [
      { name: 'Jan', score: 65, avg: 70 },
      { name: 'Feb', score: 72, avg: 72 },
      { name: 'Mar', score: 85, avg: 75 },
    ];
  }, [displayResults]);

  const achievements = [
    { name: 'Perfect Attendance', earned: attendanceRate >= 95, icon: CheckCircle2, desc: '95%+ Attendance rate' },
    { name: 'Academic Star', earned: gpa >= 4.5, icon: Trophy, desc: 'Maintaining 4.5+ GPA' },
    { name: 'Top 5 Rank', earned: rank && rank <= 5, icon: Medal, desc: 'Ranked in top 5' },
    { name: 'Active Reader', earned: true, icon: BookOpen, desc: 'Regular library user' },
    { name: 'Good Conduct', earned: behaviorScore >= 90, icon: Star, desc: 'Exemplary behavior' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
      {/* Premium Welcome Header */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Welcome back, {studentName}! 🎓</h1>
            <div className="flex -space-x-2">
              <Sparkles className="size-5 text-amber-500 animate-pulse" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">You are currently ranked <span className="text-indigo-600 font-bold">#{rank || '—'}</span> in your class. Keep pushing!</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 py-2 px-4 rounded-xl font-bold text-xs shadow-sm">
            <GraduationCap className="size-4 mr-2" /> GPA: {gpa.toFixed(1)}
          </Badge>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-lg shadow-indigo-100" onClick={() => setCurrentView('results')}>
            View Reports
          </Button>
        </div>
      </motion.div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Attendance Rate" value={`${attendanceRate}%`} icon={CalendarCheck} iconBgColor="bg-blue-50" iconColor="text-blue-600" changeLabel="This Term" />
        <KpiCard title="Behavior Score" value={`${behaviorScore}/100`} icon={Star} iconBgColor="bg-amber-50" iconColor="text-amber-600" changeLabel="Conduct" />
        <KpiCard title="Homework" value={`${homeworkCompletion}%`} icon={FileEdit} iconBgColor="bg-purple-50" iconColor="text-purple-600" changeLabel={`${homeworkPending} Pending`} />
        <KpiCard title="Academic Stand" value={rank ? `#${rank}` : '—'} icon={Award} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" changeLabel="Class Rank" />
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-2xl h-12 border border-gray-100 shadow-sm backdrop-blur-sm">
          <TabsTrigger value="overview" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest transition-all">Overview</TabsTrigger>
          <TabsTrigger value="academics" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest transition-all">Academics</TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest transition-all">Timetable</TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {/* --- OVERVIEW TAB --- */}
          {activeTab === 'overview' && (
            <TabsContent value="overview" key="overview" className="mt-0 space-y-6 outline-none">
              <motion.div variants={slideUp} className="grid gap-6 lg:grid-cols-3">
                {/* Performance Chart (Restored) */}
                <Card className="lg:col-span-2 border-none shadow-sm bg-gradient-to-br from-white to-gray-50/50">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <TrendingUp className="size-5 text-indigo-500" />
                        Academic Momentum
                      </CardTitle>
                      <CardDescription>Performance trends across subjects vs class average</CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-indigo-100 font-bold uppercase text-[10px]">6 Months</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceTrend}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} domain={[0, 100]} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                          />
                          <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" name="Your Score" />
                          <Area type="monotone" dataKey="avg" stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 5" fill="none" name="Class Average" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Live Activity (Restored) */}
                <Card className="border-none shadow-sm bg-indigo-50/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Sparkles className="size-5 text-indigo-500" />
                      Classroom Pulse
                    </CardTitle>
                    <CardDescription>Real-time activity signal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      {activities.length > 0 ? activities.slice(0, 5).map((activity: any, i: number) => (
                        <div key={activity.id} className="flex gap-4 group">
                          <div className={cn(
                            "size-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110",
                            activity.action === 'SUBMIT' ? "bg-emerald-100 text-emerald-600" :
                            activity.action === 'GRADE' ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {activity.action === 'SUBMIT' ? <CheckCircle2 className="size-5" /> :
                             activity.action === 'GRADE' ? <TrendingUp className="size-5" /> : <Info className="size-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{activity.details}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                              {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(activity.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )) : (
                        <div className="py-20 text-center opacity-30 flex flex-col items-center">
                          <Clock className="size-10 mb-2" />
                          <p className="text-xs font-bold uppercase tracking-widest">Awaiting Pulse...</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Homework Progress */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold">Homework Velocity</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 mb-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Completion</span>
                        <span className="text-lg font-bold text-indigo-600">{homeworkCompletion}%</span>
                      </div>
                      <Progress value={homeworkCompletion} className="h-2.5 bg-gray-200" />
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center justify-between text-xs px-1">
                         <span className="text-muted-foreground font-medium">Pending Tasks</span>
                         <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-bold">{homeworkPending}</Badge>
                       </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Announcements bulletin */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3 border-b border-gray-50">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Bell className="size-4 text-emerald-500" />
                      School Bulletin
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      {announcements.length > 0 ? announcements.map((ann, i) => (
                        <div key={ann.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="size-2 rounded-full bg-emerald-500" />
                            <p className="text-sm font-bold text-gray-900">{ann.title}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(ann.createdAt).toLocaleDateString()}</span>
                            <Badge className={cn(
                              "text-[9px] font-bold uppercase tracking-widest",
                              ann.priority === 'HIGH' ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"
                            )}>{ann.priority}</Badge>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No recent announcements</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* --- ACADEMICS TAB --- */}
          {activeTab === 'academics' && (
            <TabsContent value="academics" key="academics" className="mt-0 space-y-6 outline-none">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-2">
                {/* Recent Scores Grid */}
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3 border-b border-gray-50">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-900">
                      <BookOpen className="size-5" /> Latest Academic Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {displayResults.length > 0 ? displayResults.map((result, i) => (
                        <motion.div whileHover={{ scale: 1.01, x: 5 }} key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-indigo-100 bg-white hover:shadow-md transition-all group">
                          <div className={cn(
                            "size-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm shrink-0",
                            result.grade === 'A' ? "bg-emerald-100 text-emerald-700" :
                            result.grade === 'B' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {result.grade}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{result.subject}</p>
                            <div className="flex items-center gap-4 mt-1.5">
                              <Progress value={result.score} className="h-1.5 flex-1 bg-gray-100" />
                              <span className="text-[10px] font-bold text-muted-foreground truncate italic">Avg: {result.classAvg}%</span>
                            </div>
                          </div>
                          <div className="text-right pl-4">
                            <p className="text-lg font-bold text-gray-900">{result.score}%</p>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="text-center py-20 text-muted-foreground flex flex-col items-center opacity-30">
                          <Info className="size-10 mb-2" />
                          <p className="font-bold uppercase tracking-widest text-xs">No records found for current term</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Achievements Collection (Restored Premium View) */}
                <div className="space-y-6">
                   <Card className="bg-gradient-to-r from-gray-900 to-indigo-950 text-white overflow-hidden relative border-none shadow-xl">
                     <div className="absolute top-0 right-0 p-8 opacity-10">
                       <Trophy className="size-40" />
                     </div>
                     <CardHeader className="relative z-10">
                       <CardTitle className="text-xl font-bold flex items-center gap-2">
                         <Sparkles className="size-5 text-amber-500" />
                         Achievement Collection
                       </CardTitle>
                       <CardDescription className="text-indigo-300">Unlock limited edition badges by excelling in your studies</CardDescription>
                     </CardHeader>
                     <CardContent className="relative z-10 pt-4">
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                         {achievements.map((ach, i) => (
                           <motion.div 
                            whileHover={{ y: -8 }}
                            key={i} className="flex flex-col items-center gap-3"
                           >
                             <div className={cn(
                               "size-16 rounded-3xl flex items-center justify-center transition-all shadow-lg",
                               ach.earned ? "bg-gradient-to-br from-amber-400 to-amber-600 ring-2 ring-amber-400 ring-offset-2 ring-offset-indigo-950" : "bg-white/5 border border-white/10 text-white/20 grayscale opacity-40"
                             )}>
                               <ach.icon className={cn("size-8", ach.earned ? "text-white" : "")} />
                             </div>
                             <div className="text-center">
                               <p className={cn("text-[10px] font-bold uppercase tracking-widest", ach.earned ? "text-white" : "text-white/30")}>{ach.name.split(' ')[0]}</p>
                               {ach.earned && <p className="text-[8px] text-amber-200 mt-0.5 uppercase font-medium">Earned</p>}
                             </div>
                           </motion.div>
                         ))}
                       </div>
                     </CardContent>
                   </Card>

                   {/* Next Exam Card */}
                   <Card className="border-indigo-100 bg-indigo-50/10">
                    <CardHeader>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Clock className="size-4 text-indigo-600" />
                        Next Academic Milestone
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {nextExam ? (
                        <div className="flex items-center justify-between p-5 rounded-3xl bg-white border border-indigo-100 shadow-sm">
                           <div className="space-y-1">
                              <p className="text-lg font-bold text-gray-900">{nextExam.name}</p>
                              <p className="text-sm font-medium text-indigo-600 uppercase tracking-widest">{nextExam.subject}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-2xl font-bold text-indigo-600">{daysToExam}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Days Left</p>
                           </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">No upcoming examinations scheduled</p>
                      )}
                    </CardContent>
                   </Card>
                </div>
              </motion.div>
            </TabsContent>
          )}

          {/* --- SCHEDULE TAB (Restored) --- */}
          {activeTab === 'schedule' && (
            <TabsContent value="schedule" key="schedule" className="mt-0 outline-none">
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="border-none shadow-sm h-[600px] flex flex-col">
                  <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="size-5 text-indigo-600" />
                        Weekly Timetable
                      </CardTitle>
                      <CardDescription>Your current class schedule and lesson plan</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest px-4 h-8 bg-gray-50">TERM 2 · 2024</Badge>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col items-center justify-center space-y-4 pt-10">
                     <div className="size-20 rounded-full bg-indigo-50 flex items-center justify-center">
                        <Calendar className="size-10 text-indigo-300" />
                     </div>
                     <div className="text-center max-w-sm">
                        <h3 className="text-lg font-bold text-gray-900">Timetable Under Construction</h3>
                        <p className="text-sm text-muted-foreground mt-2">The school administration is currently finalizing the lesson schedule for your class. Check back shortly!</p>
                     </div>
                     <Button variant="outline" className="mt-6 rounded-xl h-11 px-8 font-bold uppercase text-xs tracking-widest bg-white border-gray-200 shadow-sm border-2">
                        Get SMS Alert
                     </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}
        </AnimatePresence>
      </Tabs>
    </motion.div>
  );
}

// --- Icons & Helpers ---
const Bell = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
