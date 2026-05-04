'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { useSession, signOut } from 'next-auth/react';
import {
  GraduationCap, CalendarCheck, Award, Star, Trophy, Clock, BookOpen,
  FileEdit, TrendingUp, Target, CheckCircle2, Info, Sparkles, User,
  Video, BrainCircuit, MessageSquare, BarChart3, ChevronRight,
  Moon, Sun, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';

// Specialized Sub-Components
import { StudentResults } from './student-results';
import { StudentHomework } from './student-homework';
import { StudentExams } from './student-exams';
import { StudentVideoLessons } from './student-video-lessons';
import { StudentAnalytics } from './student-analytics';
import { StudentAchievements } from './student-achievements';
import { StudentAIChat } from './student-ai-chat';
import { MessagingCenter } from './messaging-center';

// ---- Types ----
interface ApiStudent {
  id: string;
  admissionNo: string;
  gpa: number | null;
  cumulativeGpa: number | null;
  rank: number | null;
  behaviorScore: number | null;
  user: { name: string; email: string; avatar: string | null };
  class: { id: string; name: string; section: string | null; grade: string | null; subjects?: ApiSubject[] } | null;
  attendanceSummary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percentage: number;
  } | null;
  weeklyAttendance?: Array<{ day: string; status: 'present' | 'absent' | 'late'; present: number; absent: number; late: number; total: number }>;
  nextExam?: {
    id: string;
    name: string;
    date: string;
    subject: { name: string } | null;
  } | null;
  homeworkStats?: {
    total: number;
    completed: number;
  };
  currentTerm?: {
    id: string;
    name: string;
    academicYear: { id: string; name: string };
  } | null;
}

interface ApiSubject {
  id: string;
  name: string;
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
  };
}

interface ApiAnnouncement {
  id: string;
  title: string;
  content: string;
  priority?: 'urgent' | 'normal' | 'low';
}

export function StudentDashboard() {
  const { currentUser, setCurrentView, selectedSchoolId } = useAppStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [studentProfile, setStudentProfile] = useState<ApiStudent | null>(null);
  const [examScores, setExamScores] = useState<ApiExamScore[]>([]);
  const [examStatsMap, setExamStatsMap] = useState<Record<string, { average: number; highest: number }>>({});
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session, status } = useSession();
  const { isDark, toggleTheme } = useTheme();

  const schoolId = currentUser.schoolId || selectedSchoolId || '';

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
     let isMounted = true;
     const fetchData = async () => {
       try {
         setLoading(true);

         // Fetch student profile first
         const studentsRes = await fetch(`/api/students?schoolId=${schoolId}&search=${encodeURIComponent(currentUser.email)}&limit=1`);
         let studentData: ApiStudent[] = [];
         if (studentsRes.ok) {
           const studentsJson = await studentsRes.json();
           studentData = studentsJson.data || studentsJson || [];
         }

         if (!isMounted || studentData.length === 0) {
           setLoading(false);
           return;
         }

         const currentStudent = studentData[0];
         setStudentProfile(currentStudent);

         // Fetch announcements in parallel with detailed student data
         const [detailRes, hwStatsRes, nextExamRes, announcementsRes] = await Promise.all([
           fetch(`/api/students/${currentStudent.id}`),
           fetch(`/api/homework/stats?studentId=${currentStudent.id}`),
           fetch(`/api/exams?schoolId=${schoolId}&studentId=${currentStudent.id}&limit=1&status=upcoming`),
           fetch(`/api/announcements?schoolId=${schoolId}&limit=10`)
         ]);

         if (!isMounted) {
           setLoading(false);
           return;
         }

         // Process detailed student data
         if (detailRes.ok) {
           const detailJson = await detailRes.json();
           const detail = detailJson.data;
           if (detail) {
             setStudentProfile(prev => ({ ...prev!, ...detail }));
             const scores = (detail.examScores || []).slice(0, 10);
             setExamScores(scores);

             // Fetch individual analytics for the overview chart
             if (scores.length > 0) {
               const statsPromises = scores.map(async (score: ApiExamScore) => {
                 try {
                   const sRes = await fetch(`/api/exams/${score.exam.id}/stats`);
                   if (sRes.ok) {
                     const sJson = await sRes.json();
                     if (sJson.success) {
                       return {
                         examId: score.exam.id,
                         average: sJson.data.average || 0,
                         highest: sJson.data.highest || 0,
                       };
                     }
                   }
                 } catch (e) {
                   console.error(`Failed to fetch stats for exam ${score.exam.id}:`, e);
                 }
                 return null;
               });
               const statsResults = await Promise.all(statsPromises);
               const statsMap: Record<string, { average: number; highest: number }> = {};
               statsResults.forEach(stat => {
                 if (stat) statsMap[stat.examId] = { average: stat.average, highest: stat.highest };
               });
               setExamStatsMap(statsMap);
             }
           }
         }

         // Process homework stats
         if (hwStatsRes.ok) {
           const hwJson = await hwStatsRes.json();
           setStudentProfile(prev => ({ ...prev!, homeworkStats: hwJson.data }));
         }

         // Process next exam
         if (nextExamRes.ok) {
           const examJson = await nextExamRes.json();
           if (examJson.data && examJson.data.length > 0) {
             setStudentProfile(prev => ({ ...prev!, nextExam: examJson.data[0] }));
           }
         }

         // Process announcements
         if (announcementsRes.ok) {
           const announcementsJson = await announcementsRes.json();
           setAnnouncements(announcementsJson.data || announcementsJson || []);
         }
       } catch (err) {
         if (isMounted) {
           console.error(err);
           toast.error('Failed to load dashboard data');
         }
       } finally {
         if (isMounted) {
           setLoading(false);
         }
       }
     };

     fetchData();

     return () => {
       isMounted = false;
     };
   }, [currentUser.email, schoolId]);

  // ---- Derived Data for Overview ----
  const studentName = studentProfile?.user?.name || currentUser.name.split(' ')[0];
  const gpa = studentProfile?.gpa || studentProfile?.cumulativeGpa || 0;
  const attendanceRate = studentProfile?.attendanceSummary?.percentage || 0;
  const rank = studentProfile?.rank;
  const behaviorScore = studentProfile?.behaviorScore || 0;

  const daysToExam = useMemo(() => {
    if (!studentProfile?.nextExam?.date) return null;
    const examDate = new Date(studentProfile.nextExam.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = examDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [studentProfile?.nextExam?.date]);

  const displayResults = useMemo(() => {
    return examScores.map(score => {
      const percentage = score.exam.totalMarks > 0 ? Math.round((score.score / score.exam.totalMarks) * 100) : 0;
      const stats = examStatsMap[score.exam.id];
      return {
        subject: score.exam.subject?.name || score.exam.name,
        score: percentage,
        classAvg: stats?.average || 0,
        highest: stats?.highest || 0,
      };
    });
  }, [examScores, examStatsMap]);

  const performanceTrends = useMemo(() => {
    if (displayResults.length === 0) {
      return [ { month: 'Jan', avg: 0 }, { month: 'Feb', avg: 0 }, { month: 'Mar', avg: 0 }, { month: 'Apr', avg: 0 } ];
    }
    return displayResults.map((r, i) => ({
      month: r.subject.substring(0, 3).toUpperCase(),
      avg: r.score
    })).slice(0, 6);
  }, [displayResults]);

  const achievements = [
    { name: 'Perfect Attendance', earned: attendanceRate >= 95, icon: CheckCircle2 },
    { name: 'Star Student', earned: gpa >= 4.5, icon: Star },
    { name: 'Top Scorer', earned: displayResults.some(r => r.score >= 90), icon: Trophy },
    { name: 'Fast Learner', earned: true, icon: BrainCircuit },
    { name: 'Helpful', earned: behaviorScore >= 90, icon: Target },
    { name: 'Active Participant', earned: true, icon: Award },
  ];

  const currentTermName = studentProfile?.currentTerm 
    ? `${studentProfile.currentTerm.academicYear.name} - ${studentProfile.currentTerm.name}`
    : 'No active term';

  // ---- Skeleton ----
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-6">
       {/* Header */}
       <motion.div variants={fadeIn} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
         <div>
           <h1 className="text-2xl font-bold tracking-tight text-gray-900 overflow-hidden">Welcome back, {studentName}! 🎓</h1>
           <p className="text-muted-foreground">Everything you need for your academic journey is right here.</p>
         </div>
         <div className="flex items-center gap-2">
           <Badge variant="secondary" className="gap-1.5 text-sm py-1.5 px-3 bg-emerald-50 text-emerald-700 border-emerald-100 font-bold">
             <GraduationCap className="size-4" /> GPA: {gpa.toFixed(1)}/5.0
           </Badge>
           {rank && (
             <Badge variant="secondary" className="gap-1.5 text-sm py-1.5 px-3 bg-blue-50 text-blue-700 border-blue-100 font-bold">
               Rank: #{rank}
             </Badge>
           )}
           <div className="flex items-center gap-2">
             <Button 
               variant="outline" 
               size="icon"
               onClick={toggleTheme}
               title="Toggle Theme"
             >
               {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
             </Button>
             <Button 
               variant="outline" 
               size="icon"
               onClick={handleSignOut}
               title="Sign Out"
             >
               <LogOut className="size-4" />
             </Button>
           </div>
         </div>
       </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="GPA Metric" value={`${gpa.toFixed(1)}/5.0`} icon={GraduationCap} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard title="Attendance" value={`${attendanceRate}%`} icon={CalendarCheck} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Class Stand" value={rank ? `#${rank}` : '—'} icon={Award} iconBgColor="bg-purple-100" iconColor="text-purple-600" />
        <KpiCard title="Conduct" value={`${behaviorScore}/100`} icon={Star} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1.5 rounded-2xl flex flex-wrap h-auto gap-1 border-2 border-transparent">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'results', label: 'Results' },
            { id: 'homework', label: 'Homework' },
            { id: 'exams', label: 'Exams' },
            { id: 'lessons', label: 'Video Hub' },
            { id: 'ai', label: 'AI Study' },
            { id: 'messages', label: 'Messages' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'achievements', label: 'Awards' },
          ].map(tab => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id} 
              className="rounded-xl px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600 font-bold text-xs uppercase tracking-tight transition-all"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Main Hub Area */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Hero Card */}
                  <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-700 text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Sparkles className="size-48" /></div>
                    <CardHeader className="pb-4 relative z-10">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-indigo-100 text-[10px] font-extrabold uppercase tracking-[0.25em] mb-1">{currentTermName}</p>
                          <CardTitle className="text-4xl font-black mt-1 leading-tight tracking-tighter">Skyrocket Your <br />Results, {studentName}!</CardTitle>
                          <CardDescription className="text-indigo-100 mt-3 font-medium text-sm max-w-md">Your average has improved by 4% since last week. Keep the momentum going!</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 pt-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { label: 'Subjects', value: studentProfile?.class?.subjects?.length || 0, icon: BookOpen },
                          { label: 'Tasks Done', value: studentProfile?.homeworkStats ? `${studentProfile.homeworkStats.completed}/${studentProfile.homeworkStats.total}` : '0/0', icon: FileEdit },
                          { label: 'Next Exam', value: daysToExam !== null ? (daysToExam === 0 ? 'Today' : daysToExam < 0 ? 'Recently' : `${daysToExam} Day${daysToExam !== 1 ? 's' : ''}`) : 'None', icon: CalendarCheck },
                          { label: 'Rank', value: rank ? `#${rank}` : 'N/A', icon: Trophy },
                        ].map((item, i) => (
                          <div key={i} className="p-4 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-lg hover:bg-white/15 transition-colors group cursor-default">
                             <item.icon className="size-5 mb-2 text-indigo-100 group-hover:scale-110 transition-transform" />
                             <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">{item.label}</p>
                             <p className="text-2xl font-black text-white mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Performance Analytics Preview */}
                    <Card className="glass-panel border-0 shadow-sm overflow-hidden group">
                      <CardHeader className="pb-2 border-b bg-white/30">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between text-indigo-600">
                          <span>Live Performance</span>
                          <TrendingUp className="size-4" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 px-4">
                         <div className="flex items-end gap-2 h-40">
                           {performanceTrends.map((p, i) => (
                             <div key={i} className="flex-1 flex flex-col items-center gap-2 group/bar">
                               <div className="w-full relative flex items-end">
                                 <motion.div 
                                   initial={{ height: 0 }} 
                                   animate={{ height: `${p.avg}%` }}
                                   transition={{ delay: i * 0.1, type: 'spring', damping: 15 }}
                                   className={cn(
                                     "w-full rounded-t-xl transition-all relative overflow-hidden",
                                     i === performanceTrends.length - 1 ? "bg-indigo-600 shadow-lg shadow-indigo-200" : "bg-indigo-100 group-hover/bar:bg-indigo-200"
                                   )}
                                 >
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                                 </motion.div>
                                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity text-[10px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded">
                                   {p.avg}%
                                 </div>
                               </div>
                               <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{p.month}</span>
                             </div>
                           ))}
                         </div>
                      </CardContent>
                    </Card>

                    {/* Announcement Reel */}
                    <Card className="glass-panel border-0 shadow-sm overflow-hidden">
                       <CardHeader className="pb-2 border-b bg-white/30">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between text-blue-600">
                          <span>School Bulletin</span>
                          <MessageSquare className="size-4" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                         <ScrollArea className="h-44">
                           <div className="divide-y divide-gray-100">
                             {announcements.length > 0 ? announcements.map(ann => (
                               <div key={ann.id} className="p-4 hover:bg-white transition-colors cursor-pointer group">
                                 <div className="flex items-start gap-3">
                                   <div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm", ann.priority === 'urgent' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500')}>
                                      <Info className="size-4" />
                                   </div>
                                   <div className="min-w-0 flex-1">
                                     <p className="text-xs font-bold text-gray-900 group-hover:text-indigo-600 transition-colors truncate uppercase tracking-tight">{ann.title}</p>
                                     <p className="text-[10px] font-medium text-gray-500 mt-0.5 line-clamp-1">{ann.content}</p>
                                   </div>
                                 </div>
                               </div>
                             )) : (
                               <div className="py-16 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 opacity-50">No Global Updates</div>
                             )}
                           </div>
                         </ScrollArea>
                         <Button variant="ghost" className="w-full h-10 rounded-none border-t text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:bg-indigo-50" onClick={() => setCurrentView('announcements')}>
                           See All Announcements <ChevronRight className="size-3 ml-1" />
                         </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Vertical Analytics Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                   {/* Achievement Showcase */}
                   <Card className="glass-panel border-0 shadow-sm overflow-hidden">
                     <CardHeader className="pb-2">
                       <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Badge Board</CardTitle>
                     </CardHeader>
                     <CardContent className="pt-2">
                        <div className="grid grid-cols-3 gap-3">
                          {achievements.map((ach, i) => (
                            <div key={i} className={cn(
                              "aspect-square rounded-2xl flex items-center justify-center transition-all relative overflow-hidden group",
                              ach.earned ? "bg-emerald-50 text-emerald-600 shadow-inner" : "bg-gray-50 text-gray-300 contrast-50 grayscale opacity-40"
                            )}>
                               <ach.icon className="size-6 relative z-10" />
                               {ach.earned && <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/50 to-transparent" />}
                               <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/60 z-20">
                                 <span className="text-[8px] font-black text-white uppercase text-center px-1 leading-tight">{ach.name}</span>
                               </div>
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" className="w-full mt-6 text-[10px] font-black uppercase tracking-widest border-2 border-indigo-100 text-indigo-600 h-10 rounded-xl hover:bg-indigo-50 hover:border-indigo-200" onClick={() => setActiveTab('achievements')}>
                          Achievement Board
                        </Button>
                     </CardContent>
                   </Card>

                   {/* Progress Visualizers */}
                   <Card className="glass-panel border-0 shadow-sm">
                     <CardHeader className="pb-2">
                       <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Core Metrics</CardTitle>
                     </CardHeader>
                     <CardContent className="pt-2 space-y-5">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                            <span>Attendance Score</span>
                            <span className="text-emerald-600 font-black">{attendanceRate}%</span>
                          </div>
                          <Progress value={attendanceRate} className="h-2 bg-emerald-50" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                            <span>Task Completion</span>
                            <span className="text-indigo-600 font-black">{Math.round(((studentProfile?.homeworkStats?.completed || 0) / (studentProfile?.homeworkStats?.total || 1)) * 100)}%</span>
                          </div>
                          <Progress value={((studentProfile?.homeworkStats?.completed || 0) / (studentProfile?.homeworkStats?.total || 1)) * 100} className="h-2 bg-indigo-50" />
                        </div>
                        
                        {/* Weekly Context Action */}
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl p-4 border-2 border-amber-100/50 mt-2 hover:shadow-md transition-all group flex items-center gap-4 cursor-pointer">
                           <div className="size-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                             <Clock className="size-5" />
                           </div>
                           <div className="flex-1">
                              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Action Required</p>
                              <p className="text-xs font-bold text-gray-900 mt-0.5">Prepare for Finals</p>
                           </div>
                           <ChevronRight className="size-4 text-amber-400" />
                        </div>
                     </CardContent>
                   </Card>
                </div>
              </div>
            )}

            {/* Modular Views (Self-Contained) */}
            {activeTab === 'results' && <StudentResults />}
            {activeTab === 'homework' && <StudentHomework />}
            {activeTab === 'exams' && <StudentExams />}
            {activeTab === 'lessons' && <StudentVideoLessons />}
            {activeTab === 'analytics' && <StudentAnalytics />}
            {activeTab === 'achievements' && <StudentAchievements />}
            {activeTab === 'ai' && <StudentAIChat />}
            {activeTab === 'messages' && <MessagingCenter />}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  );
}
