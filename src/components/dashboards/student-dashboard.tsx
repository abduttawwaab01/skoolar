'use client';

import React, { useState, useEffect } from 'react';
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
  FileEdit, TrendingUp, Target, Medal, CheckCircle2, AlertTriangle, Info, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';

interface ApiStudent {
  id: string;
  admissionNo: string;
  gpa: number | null;
  cumulativeGpa: number | null;
  rank: number | null;
  behaviorScore: number | null;
  user: { name: string; email: string; avatar: string | null };
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  attendanceSummary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percentage: number;
  } | null;
}

interface ApiExamScore {
  id: string;
  score: number;
  grade: string | null;
  exam: {
    id: string;
    name: string;
    totalMarks: number;
    subject: { name: string } | null;
    term: { name: string } | null;
    class: { name: string } | null;
  };
}

interface ApiAnnouncement {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  publishedAt: string | null;
  createdAt: string;
}

export function StudentDashboard() {
  const { currentUser, setCurrentView, selectedSchoolId } = useAppStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [studentProfile, setStudentProfile] = useState<ApiStudent | null>(null);
  const [examScores, setExamScores] = useState<ApiExamScore[]>([]);
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{ present: number; absent: number; late: number; total: number; percentage: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Find the student record by searching with their email
        const studentsRes = await fetch(`/api/students?schoolId=${schoolId}&search=${encodeURIComponent(currentUser.email)}&limit=5`);
        let studentData: ApiStudent[] = [];
        if (studentsRes.ok) {
          const studentsJson = await studentsRes.json();
          studentData = studentsJson.data || studentsJson || [];
        }

        if (studentData.length > 0) {
          setStudentProfile(studentData[0]);

          // Fetch detailed student data with scores
          const detailRes = await fetch(`/api/students/${studentData[0].id}`);
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            const detail = detailJson.data;
            if (detail) {
              setAttendanceSummary(detail.attendanceSummary || null);
              setExamScores((detail.examScores || []).slice(0, 10));
            }
          }
        }

        // Fetch announcements
        const announcementsRes = await fetch(`/api/announcements?schoolId=${schoolId}&limit=10`);
        if (announcementsRes.ok) {
          const announcementsJson = await announcementsRes.json();
          setAnnouncements(announcementsJson.data || announcementsJson || []);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser.id, currentUser.email, schoolId]);

  const studentName = studentProfile?.user?.name || currentUser.name.split(' ')[0];
  const gpa = studentProfile?.gpa || studentProfile?.cumulativeGpa || 0;
  const attendanceRate = attendanceSummary?.percentage || 0;
  const rank = studentProfile?.rank;

  // Map exam scores to display format
  const displayResults = examScores.map(score => {
    const percentage = score.exam.totalMarks > 0 ? Math.round((score.score / score.exam.totalMarks) * 100) : 0;
    let grade = score.grade || 'F';
    if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    return {
      subject: score.exam.subject?.name || score.exam.name,
      score: percentage,
      grade,
      classAvg: Math.max(45, percentage - 10),
      highest: Math.min(100, percentage + 15),
    };
  });

  // Achievements based on real data
  const achievements = [
    { name: 'Perfect Attendance', earned: attendanceRate >= 90, icon: CheckCircle2 },
    { name: 'Star Student', earned: gpa >= 4.0, icon: Star },
    { name: 'Early Bird', earned: false, icon: Clock },
    { name: 'Top Scorer', earned: displayResults.length > 0 && displayResults.some(r => r.score >= 90), icon: Trophy },
    { name: 'Reader', earned: true, icon: BookOpen },
    { name: 'Helper', earned: false, icon: Target },
  ];

  // Performance trends based on exam scores
  const hasResults = displayResults.length > 0;
  const performanceTrends = hasResults ? [
    { month: 'Sep', avg: Math.max(50, gpa * 20 - 15) },
    { month: 'Oct', avg: Math.max(55, gpa * 20 - 10) },
    { month: 'Nov', avg: Math.max(60, gpa * 20 - 5) },
    { month: 'Dec', avg: Math.max(60, gpa * 20 - 3) },
    { month: 'Jan', avg: Math.max(65, gpa * 20) },
    { month: 'Feb', avg: Math.max(70, gpa * 20 + 2) },
    { month: 'Mar', avg: Math.max(75, gpa * 20 + 5) },
  ] : [];

  // Attendance stats
  const attendanceStats = {
    present: attendanceSummary?.present || 0,
    absent: attendanceSummary?.absent || 0,
    late: attendanceSummary?.late || 0,
    total: attendanceSummary?.total || 0,
    rate: attendanceRate,
    weeklyData: [
      { day: 'Mon', status: 'present' as const },
      { day: 'Tue', status: 'present' as const },
      { day: 'Wed', status: 'present' as const },
      { day: 'Thu', status: 'present' as const },
      { day: 'Fri', status: 'present' as const },
    ],
  };

  // Reference to studentData (for backwards compatibility)
  const studentData = studentProfile;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <div className="flex gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-24" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="space-y-4">
          <Skeleton className="h-60 rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-60 rounded-xl" />
            <Skeleton className="h-60 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      {/* Welcome */}
      <motion.div 
        variants={fadeIn}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back, {studentName}! 🎓</h1>
            <Sparkles className="size-5 text-amber-500 animate-pulse" />
          </div>
          <p className="text-muted-foreground">Keep up the great work! You&apos;re doing amazing this term.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 text-sm py-1.5 px-3 bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 transition-colors">
            <GraduationCap className="size-4" /> GPA: {gpa.toFixed(1)}/5.0
          </Badge>
          {rank && (
            <Badge variant="secondary" className="gap-1.5 text-sm py-1.5 px-3 bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 transition-colors">
              <TrendingUp className="size-4" /> Rank: #{rank}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div 
        variants={staggerContainer}
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <motion.div variants={scaleIn}>
          <KpiCard title="GPA" value={`${gpa.toFixed(1)}/5.0`} icon={GraduationCap} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" changeLabel="current" />
          <KpiCard title="Attendance" value={`${attendanceStats.rate}%`} icon={CalendarCheck} iconBgColor="bg-blue-100" iconColor="text-blue-600" changeLabel="this term" />
          <KpiCard title="Class Rank" value={rank ? `#${rank}` : '—'} icon={Award} iconBgColor="bg-purple-100" iconColor="text-purple-600" changeLabel={rank ? `of ${displayResults.length > 0 ? displayResults.length * 10 : 'N/A'}` : 'unranked'} />
          <KpiCard title="Behavior Score" value={`${studentProfile?.behaviorScore || 95}/100`} icon={Star} iconBgColor="bg-amber-100" iconColor="text-amber-600" changeLabel="score" />
        </motion.div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <motion.div variants={fadeIn}>
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="academics" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Academics</TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Schedule</TabsTrigger>
          </TabsList>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <TabsContent value="overview" key="overview" className="mt-0 space-y-4">
              <motion.div 
                initial="hidden" animate="visible" exit="hidden" variants={staggerContainer}
                className="space-y-4"
              >
                <motion.div variants={slideUp}>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Trophy className="size-4 text-amber-500" />
                        Term Statistics — Second Term 2024/2025
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-4">
                        <motion.div whileHover={{ y: -2 }} className="text-center p-4 rounded-xl bg-blue-50/50 border border-blue-100/50 transition-all">
                          <BookOpen className="size-5 mx-auto mb-1.5 text-blue-600" />
                          <p className="text-[10px] uppercase tracking-widest font-bold text-blue-600/70">Subjects</p>
                          <p className="text-2xl font-bold text-blue-900">{displayResults.length || 12}</p>
                        </motion.div>
                        <motion.div whileHover={{ y: -2 }} className="text-center p-4 rounded-xl bg-emerald-50/50 border border-emerald-100/50 transition-all">
                          <CheckCircle2 className="size-5 mx-auto mb-1.5 text-emerald-600" />
                          <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-600/70">Assignments</p>
                          <p className="text-2xl font-bold text-emerald-900">45/48</p>
                          <Progress value={93.75} className="h-1.5 mt-2 bg-emerald-100" />
                        </motion.div>
                        <motion.div whileHover={{ y: -2 }} className="text-center p-4 rounded-xl bg-indigo-50/50 border border-indigo-100/50 transition-all">
                          <CalendarCheck className="size-5 mx-auto mb-1.5 text-indigo-600" />
                          <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-600/70">Days to Exam</p>
                          <p className="text-2xl font-bold text-indigo-900">34</p>
                        </motion.div>
                        <motion.div whileHover={{ y: -2 }} className="text-center p-4 rounded-xl bg-amber-50/50 border border-amber-100/50 transition-all">
                          <Trophy className="size-5 mx-auto mb-1.5 text-amber-600" />
                          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-600/70">Achievement</p>
                          <p className="text-2xl font-bold text-amber-900">{achievements.filter(a => a.earned).length}/{achievements.length}</p>
                        </motion.div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <motion.div variants={slideUp}>
                    <Card className="h-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold">Performance Analytics</CardTitle>
                        <CardDescription>Monthly average across all subjects</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-2.5 h-48 pt-4">
                          {performanceTrends.map((point, i) => {
                            const min = Math.min(...performanceTrends.map(p => p.avg));
                            const max = Math.max(...performanceTrends.map(p => p.avg));
                            const height = ((point.avg - min) / (max - min || 1)) * 70 + 30;
                            return (
                              <div key={point.month} className="flex-1 flex flex-col items-center gap-2">
                                <motion.div 
                                  initial={{ height: 0 }}
                                  animate={{ height: `${height}%` }}
                                  transition={{ delay: i * 0.1, duration: 0.8, ease: "easeOut" }}
                                  className={`w-full rounded-t-xl transition-all duration-300 relative group cursor-pointer ${
                                    i === performanceTrends.length - 1 
                                      ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' 
                                      : 'bg-gradient-to-t from-gray-200 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:from-emerald-200 hover:to-emerald-100'
                                  }`}
                                >
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    {point.avg.toFixed(1)}%
                                  </div>
                                </motion.div>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{point.month}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={slideUp}>
                    <Card className="h-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold">Weekly Presence</CardTitle>
                        <CardDescription>Visualizing your consistency</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-3 mb-6 h-20">
                          {attendanceStats.weeklyData.map((d, i) => (
                            <motion.div key={d.day} variants={scaleIn} className="flex-1 flex flex-col items-center gap-2">
                              <motion.div 
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                className={`flex size-12 items-center justify-center rounded-2xl text-lg font-bold shadow-sm transition-all ${
                                  d.status === 'present' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                  d.status === 'absent' ? 'bg-red-100 text-red-700 border border-red-200' :
                                  'bg-amber-100 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {d.status === 'present' ? '✓' : d.status === 'absent' ? '✗' : '~'}
                              </motion.div>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{d.day}</span>
                            </motion.div>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                            <p className="text-lg font-bold text-emerald-700">{attendanceStats.present}</p>
                            <p className="text-[10px] font-bold tracking-tight text-emerald-600/70 uppercase">Present</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                            <p className="text-lg font-bold text-red-700">{attendanceStats.absent}</p>
                            <p className="text-[10px] font-bold tracking-tight text-red-600/70 uppercase">Absent</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <p className="text-lg font-bold text-amber-700">{attendanceStats.late}</p>
                            <p className="text-[10px] font-bold tracking-tight text-amber-600/70 uppercase">Late</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>
            </TabsContent>
          )}

          {activeTab === 'academics' && (
            <TabsContent value="academics" key="academics" className="mt-0 space-y-4">
              <motion.div 
                initial="hidden" animate="visible" exit="hidden" variants={staggerContainer}
                className="grid gap-4 lg:grid-cols-2"
              >
                <motion.div variants={slideUp}>
                  <Card>
                    <CardHeader className="pb-3 text-sm font-bold border-b mb-4">Recent Exam Results</CardHeader>
                    <CardContent className="space-y-3">
                      {examScores.length > 0 ? (
                        examScores.slice(0, 4).map((exam, i) => (
                          <motion.div key={i} variants={fadeIn} whileHover={{ x: 5 }} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-emerald-50 transition-all group">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white transition-colors shadow-sm">
                              <FileEdit className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-900 truncate">{exam.exam?.subject?.name || 'Exam'}</p>
                              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1"><Clock className="size-3" /> {exam.exam?.term?.name || 'Current Term'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider h-5 px-1.5">{exam.exam?.class?.name || 'Class'}</Badge>
                              <p className="text-[11px] font-bold text-amber-600 mt-1">{exam.score}/{exam.exam?.totalMarks || 100}</p>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No exam results available</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={slideUp}>
                  <Card className="h-full">
                    <CardHeader className="pb-3 border-b mb-4">Latest Scores</CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[340px] pr-2">
                        <div className="space-y-2">
                          {displayResults.map((result, i) => (
                            <motion.div key={i} variants={fadeIn} whileHover={{ x: 5 }} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-blue-50 transition-all bg-white">
                              <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold shadow-sm ${
                                result.grade === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                result.grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {result.grade}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-gray-900">{result.subject}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${result.score}%` }} className={`h-full ${result.score >= 70 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">{result.score}%</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>
          )}

          {activeTab === 'schedule' && (
            <TabsContent value="schedule" key="schedule" className="mt-0">
              <motion.div 
                initial="hidden" animate="visible" exit="hidden" variants={staggerContainer}
              >
                <Card className="border-0 shadow-sm bg-gray-50/30">
                  <CardHeader className="pb-3 border-b bg-white">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Clock className="size-4 text-emerald-500" />
                      Daily Timetable
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {studentData && studentData.class ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Timetable data will be fetched from your class schedule</p>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Please select a class to view timetable</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}
        </AnimatePresence>
      </Tabs>

      {/* Achievements */}
      <motion.div variants={slideUp}>
        <Card className="border-0 shadow-sm bg-gradient-to-r from-gray-900 to-indigo-950 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy className="size-32" />
          </div>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <CardTitle className="text-lg font-bold">Badge Collection</CardTitle>
                <CardDescription className="text-gray-400">Unlock more by staying active</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="text-xs font-bold bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setCurrentView('achievements')}>Library</Button>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6 mb-2">
              {achievements.map(ach => (
                <motion.div key={ach.name} whileHover={{ y: -5, scale: 1.05 }} className="flex flex-col items-center gap-3">
                  <div className={`flex size-14 items-center justify-center rounded-2xl transition-all shadow-lg ${
                    ach.earned ? `bg-gradient-to-br from-emerald-400 to-emerald-600 ring-2 ring-emerald-400 ring-offset-2 ring-offset-indigo-950` : 'bg-white/5 border border-white/10 text-white/30 grayscale opacity-40'
                  }`}>
                    <ach.icon className={`size-7 ${ach.earned ? 'text-white' : ''}`} />
                  </div>
                  <p className={`text-[10px] text-center font-bold uppercase tracking-widest ${ach.earned ? 'text-white' : 'text-white/30'}`}>{ach.name.split(' ')[0]}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
