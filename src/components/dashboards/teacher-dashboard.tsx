'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { cn } from '@/lib/utils';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import {
  Users, GraduationCap, FileEdit, CalendarCheck, Clock, BookOpen,
  AlertTriangle, Megaphone, Sparkles, ChevronRight, CheckCircle2,
  XCircle, CircleDot, ClipboardCheck, Eye, BarChart3
} from 'lucide-react';

const quickActions = [
  { label: 'Take Attendance', icon: ClipboardCheck, view: 'attendance' as const, color: 'bg-emerald-100 text-emerald-700' },
  { label: 'Grade Exams', icon: FileEdit, view: 'results' as const, color: 'bg-blue-100 text-blue-700' },
  { label: 'Create Lesson Plan', icon: Sparkles, view: 'lesson-plans' as const, color: 'bg-purple-100 text-purple-700' },
  { label: 'AI Grading', icon: BarChart3, view: 'ai-grading' as const, color: 'bg-amber-100 text-amber-700' },
];

  interface ApiClass {
    id: string;
    name: string;
    section: string | null;
    grade: string | null;
    _count: { students: number; subjects: number; exams: number };
  }

  interface TeacherStats {
    overallAverageScore: number;
    overallPassRate: number;
    totalStudents: number;
    totalClasses: number;
    totalExams: number;
    classPerformances: Array<{
      classId: string;
      className: string;
      averageScore: number;
      classPassRate: number;
      studentCount: number;
      totalExams: number;
    }>;
  }

  interface ApiStudent {
    id: string;
    admissionNo: string;
    gpa: number | null;
    user: { name: string; email: string; avatar: string | null };
    class: { id: string; name: string; section: string | null; grade: string | null } | null;
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

export function TeacherDashboard() {
  const { currentUser, setCurrentView, selectedSchoolId } = useAppStore();
  const [activeTab, setActiveTab] = useState('schedule');
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const schoolId = currentUser.schoolId || selectedSchoolId || '';
        const params = new URLSearchParams();
        if (schoolId) params.set('schoolId', schoolId);
        params.set('limit', '50');

        const [classesRes, announcementsRes] = await Promise.all([
          fetch(`/api/classes?${params.toString()}`),
          fetch(`/api/announcements?${params.toString()}`),
        ]);

        if (!classesRes.ok) throw new Error('Failed to load classes');
        if (!announcementsRes.ok) throw new Error('Failed to load announcements');

        const classesJson = await classesRes.json();
        const announcementsJson = await announcementsRes.json();

        const classesData: ApiClass[] = classesJson.data || classesJson || [];
        const announcementsData: ApiAnnouncement[] = announcementsJson.data || announcementsJson || [];

         setClasses(classesData);
         setAnnouncements(announcementsData);

        // Fetch teacher performance stats
        try {
          const statsRes = await fetch('/api/teachers/stats');
          if (statsRes.ok) {
            const statsJson = await statsRes.json();
            if (statsJson.success) {
              setTeacherStats(statsJson.data);
            }
          }
        } catch (err) {
          console.warn('Failed to load teacher stats:', err);
        }

         // Fetch students for all classes
        if (classesData.length > 0) {
          const studentPromises = classesData.map((cls) =>
            fetch(`/api/students?schoolId=${schoolId}&classId=${cls.id}&limit=100`).then(r => {
              if (!r.ok) return { data: [] };
              return r.json();
            })
          );
          const studentResults = await Promise.all(studentPromises);
          const allStudents = studentResults.flatMap((r: { data?: ApiStudent[] }) => r.data || []);
          setStudents(allStudents);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser.schoolId, selectedSchoolId]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

   const classNames = classes.map(c => c.name);
   const totalStudentsCount = teacherStats ? teacherStats.totalStudents : students.length;

   // Use real data from API or show empty state
   const teachingLoad = teacherStats?.totalClasses || classes.length || 0;
   const pendingGradingCount = homeworkList?.filter(h => h.status !== 'graded').length || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40 mt-2" />
          </div>
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 rounded-xl lg:col-span-2" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Welcome Header */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
        variants={slideUp}
      >
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome, <span className="text-emerald-600">{currentUser.name.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-muted-foreground font-medium mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-gray-200 py-2 px-4 rounded-xl font-bold text-xs shadow-sm uppercase tracking-widest text-emerald-700">
            <BookOpen className="size-4 mr-2" /> Academic Hub
          </Badge>
        </div>
      </motion.div>

      {/* KPI Cards Row */}
       <motion.div 
         className="grid grid-cols-2 gap-4 lg:grid-cols-4"
         variants={staggerContainer}
       >
         <motion.div variants={scaleIn}><KpiCard title="Teaching Load" value={String(teacherStats?.totalClasses || classes.length || 0)} icon={BookOpen} iconBgColor="bg-blue-50" iconColor="text-blue-600" changeLabel="Active Classes" /></motion.div>
         <motion.div variants={scaleIn}><KpiCard title="Total Students" value={String(totalStudentsCount || 0)} icon={GraduationCap} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" change={totalStudentsCount > 0 ? Math.round((totalStudentsCount / 100) * 100) : 0} changeLabel="Enrolled" /></motion.div>
         <motion.div variants={scaleIn}><KpiCard title="Pending Review" value={String(totalPending)} icon={FileEdit} iconBgColor="bg-amber-50" iconColor="text-amber-600" changeLabel="Assignments" /></motion.div>
         <motion.div variants={scaleIn}><KpiCard title="Success Rate" value={teacherStats ? `${teacherStats.overallPassRate}%` : totalStudentsCount > 0 ? "—" : "N/A"} icon={BarChart3} iconBgColor="bg-purple-50" iconColor="text-purple-600" changeLabel="Average Performance" /></motion.div>
       </motion.div>

      {/* Dashboard Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <motion.div variants={fadeIn}>
          <TabsList className="bg-gray-100/50 p-1.5 rounded-2xl border backdrop-blur-sm">
            <TabsTrigger value="schedule" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg font-bold text-sm">Daily Schedule</TabsTrigger>
            <TabsTrigger value="grading" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg font-bold text-sm">Assessments</TabsTrigger>
            <TabsTrigger value="students" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg font-bold text-sm">Student Roster</TabsTrigger>
          </TabsList>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'schedule' && (
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Today's Schedule List */}
                <div className="lg:col-span-8">
                  <Card className="glass-panel border-0 h-full overflow-hidden">
                    <CardHeader className="border-b bg-white/40">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl font-bold">Course Timeline</CardTitle>
                          <CardDescription className="text-xs font-medium">Today's classes</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white/50 border-gray-100 uppercase tracking-widest text-[10px] font-bold">{teachingLoad} CLASSES</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {classes.length > 0 ? (
                        <div className="space-y-4">
                          {classes.slice(0, 5).map((cls, i) => (
                            <motion.div 
                              key={cls.id} 
                              variants={fadeIn}
                              whileHover={{ x: 5 }}
                              className="flex items-center gap-4 rounded-2xl border-2 p-4 transition-all duration-300 bg-white border-transparent hover:border-gray-100"
                            >
                              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-inner bg-indigo-50 text-indigo-600">
                                <BookOpen className="size-6" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-lg font-bold uppercase tracking-tight text-gray-900">{cls.name}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                  <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {cls._count?.students || 0} Students</span>
                                  <span className="flex items-center gap-1.5"><BookOpen className="size-3.5" /> {cls._count?.subjects || 0} Subjects</span>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded-lg text-gray-600">{cls.grade || 'Class'}</span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No classes assigned yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Alerts */}
                <div className="lg:col-span-4">
                  <Card className="glass-panel border-0 h-full overflow-hidden">
                    <CardHeader className="border-b bg-white/40">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <AlertTriangle className="size-5 text-amber-500" /> Class Overview
                        </CardTitle>
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 text-[10px] font-bold border-gray-100">{classes.length} Classes</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      {classes.length > 0 ? (
                        <div className="space-y-3">
                          {classes.slice(0, 6).map((cls, i) => (
                            <motion.div 
                              key={cls.id} 
                              variants={fadeIn}
                              whileHover={{ scale: 1.02 }}
                              className="flex items-start gap-4 p-4 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all group"
                            >
                              <Avatar className="size-10 border-2 border-white shadow-sm">
                                <AvatarFallback className="text-xs font-bold bg-indigo-50 text-indigo-600 uppercase">{cls.name.slice(0, 2)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{cls.name}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5 tracking-wider">{cls.grade || 'Class'}</p>
                                <p className="text-xs font-medium text-gray-600 mt-2 leading-relaxed bg-gray-50 p-2 rounded-xl border-l-2 border-l-emerald-400">{cls._count?.students || 0} students, {cls._count?.subjects || 0} subjects</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No classes assigned</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'grading' && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Grading Queue */}
                <Card className="glass-panel border-0">
                  <CardHeader className="border-b bg-white/40">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold flex items-center gap-2"><Sparkles className="size-5 text-purple-500" /> Homework to Grade</CardTitle>
                      <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-widest">{pendingGradingCount} PENDING</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ScrollArea className="h-[450px] pr-4">
                      <div className="space-y-4">
                        {homeworkList && homeworkList.length > 0 ? (
                          homeworkList.filter(h => h.status !== 'graded').slice(0, 10).map((hw, i) => (
                            <motion.div key={hw.id || i} variants={fadeIn} whileHover={{ x: 5 }} className="flex items-center gap-4 rounded-2xl border p-4 hover:bg-purple-50 transition-all">
                              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                                <FileEdit className="size-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-gray-900 uppercase">{hw.title || 'Homework'}</p>
                                <p className="text-xs text-muted-foreground mt-1">Due: {hw.dueDate || 'N/A'}</p>
                              </div>
                              <Badge variant="outline" className="text-[10px]">{hw.status || 'pending'}</Badge>
                            </motion.div>
                          ))
                        ) : (
                          <p className="text-center text-muted-foreground py-8">No homework to grade</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Class Performance Card */}
                <Card className="glass-panel border-0">
                  <CardHeader className="border-b bg-white/40">
                    <CardTitle className="text-xl font-bold flex items-center gap-2"><BarChart3 className="size-5 text-emerald-500" /> Class Performance</CardTitle>
                    <CardDescription className="text-xs font-medium uppercase tracking-tight">Performance by class</CardDescription>
                  </CardHeader>
                    <CardContent className="p-6">
                      {teacherStats && teacherStats.classPerformances.length > 0 ? (
                        <div className="space-y-8">
                          {teacherStats.classPerformances.slice(0, 5).map((clsPerf) => {
                            const avgScore = clsPerf.averageScore;
                            const cls = classes.find(c => c.id === clsPerf.classId);
                            return (
                              <div key={clsPerf.classId} className="space-y-3">
                                <div className="flex items-center justify-between font-bold uppercase tracking-widest text-[11px]">
                                  <div className="flex items-center gap-3">
                                    <span className="text-gray-900">{clsPerf.className}</span>
                                    <span className="text-muted-foreground border-l pl-3 font-medium">N={clsPerf.studentCount}</span>
                                  </div>
                                  <span className="text-muted-foreground">{cls?.grade || 'Class'}</span>
                                </div>
                                <div className="h-4 bg-gray-50 rounded-full overflow-hidden border p-0.5 shadow-inner">
                                  <div className={`h-full rounded-full ${avgScore >= 80 ? 'bg-emerald-500' : avgScore >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${avgScore}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No class performance data available</p>
                      )}
                    </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'students' && (
              <Card className="glass-panel border-0 overflow-hidden">
                <CardHeader className="border-b bg-white/40 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">Class Roster</CardTitle>
                    <CardDescription className="text-xs font-medium">Live monitoring of student outcomes and GPA metrics</CardDescription>
                  </div>
                  <Button variant="outline" className="font-bold text-[10px] uppercase tracking-widest bg-white border-gray-200" onClick={() => setCurrentView('analytics')}>
                    <Eye className="size-3.5 mr-2" /> Global Analytics
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[520px]">
                    <div className="divide-y divide-gray-50">
                      {students.length > 0 ? students.map(student => (
                        <motion.div 
                          key={student.id} 
                          whileHover={{ x: 5, backgroundColor: "rgba(255,255,255,0.4)" }}
                          className="flex items-center gap-5 p-5 transition-colors group cursor-pointer"
                        >
                          <Avatar className="size-11 border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
                            <AvatarFallback className="text-xs font-bold bg-emerald-50 text-emerald-600 uppercase">{student.user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-bold truncate text-gray-900 group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{student.user.name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{student.class?.name || 'Unassigned'} · <span className="text-gray-400 font-medium">#{student.admissionNo}</span></p>
                          </div>
                          <div className="text-right">
                            <div className="inline-flex items-center px-4 py-2 bg-gray-50 rounded-2xl border group-hover:border-emerald-200 transition-all">
                              <span className="text-sm font-bold text-gray-900">{student.gpa || '0.0'}</span>
                              <span className="ml-1.5 text-xs font-bold text-muted-foreground uppercase tracking-tighter">GPA</span>
                            </div>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="flex flex-col items-center justify-center py-24 opacity-50"><Users className="size-16 mb-4 text-emerald-200" /><p className="text-lg font-bold">No students registered yet</p></div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* Global Announcements Section */}
      <motion.div variants={slideUp}>
        <Card className="glass-panel border-0 border-t-4 border-t-indigo-500 shadow-xl overflow-hidden">
          <CardHeader className="pb-3 border-b bg-white/40 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Megaphone className="size-5 text-indigo-500 animate-gentle-bounce" />
              <CardTitle className="text-lg font-bold">Faculty Bulletin</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="font-bold text-xs" onClick={() => setCurrentView('announcements')}>Access Archive</Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-3">
              {announcements.slice(0, 3).map(ann => (
                <motion.div 
                  key={ann.id} 
                  whileHover={{ y: -3 }}
                  className="p-4 rounded-2xl border-2 border-transparent bg-white shadow-sm hover:border-indigo-100 hover:shadow-md transition-all group"
                >
                  <div className={cn(
                    "mb-3 size-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform",
                    ann.priority === 'urgent' ? 'bg-red-50 text-red-600' : ann.priority === 'high' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                  )}>
                    <Megaphone className="size-5" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors uppercase tracking-tight truncate">{ann.title}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{(ann.publishedAt || ann.createdAt || '').split('T')[0]}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Footer */}
      <motion.div 
        variants={slideUp}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {quickActions.map(action => (
          <motion.button 
            key={action.label} 
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex flex-col items-center gap-4 p-6 rounded-3xl border-2 border-transparent bg-white shadow-lg hover:border-emerald-200 transition-all group"
            onClick={() => setCurrentView(action.view)}
          >
            <div className={cn("size-14 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all", action.color)}>
              <action.icon className="size-7" />
            </div>
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-900">{action.label}</span>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1 shrink-0">Command {'->'} Launch</p>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
