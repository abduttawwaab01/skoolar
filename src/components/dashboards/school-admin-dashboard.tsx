'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { useSession, signOut } from 'next-auth/react';
import {
  Users, GraduationCap, CalendarCheck, Wallet, FileEdit, CreditCard,
  Megaphone, IdCard, TrendingUp, Clock, BookOpen,
  Award, AlertTriangle, CheckCircle2, UserCheck, Plus, ChevronRight,
  BarChart3, ArrowUpRight, ArrowDownRight, CircleDot, RefreshCw, XCircle,
  Moon, Sun, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn, hoverScale } from '@/lib/motion-variants';

interface StudentRecord {
  id: string;
  admissionNo: string;
  user: { name: string | null; email: string | null } | null;
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  gpa: number | null;
  cumulativeGpa: number | null;
  gender: string | null;
  isActive: boolean;
  createdAt: string;
}

interface TeacherRecord {
  id: string;
  employeeNo: string;
  user: { name: string | null; email: string | null } | null;
  specialization: string | null;
  qualification: string | null;
  _count: { classes: number; classSubjects: number; exams: number; comments: number };
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: string;
  student: { admissionNo: string; user: { name: string | null } } | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
  receiptNo: string;
  paidBy: string | null;
  createdAt: string;
  student: { admissionNo: string; user: { name: string | null } } | null;
}

interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  isPublished: boolean;
  createdAt: string;
  createdBy: string | null;
}

interface CalendarEventRecord {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  type: string;
  color: string;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="size-12 rounded-full bg-red-100 flex items-center justify-center">
        <XCircle className="size-6 text-red-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Failed to load data</p>
        <p className="text-xs text-muted-foreground mt-1">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5 mr-1.5" /> Retry
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-52 mt-1" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-52 mt-1" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

export function SchoolAdminDashboard() {
  const { setCurrentView, selectedSchoolId, currentUser } = useAppStore();
  const [activeTab, setActiveTab] = useState('overview');
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

  // Data states
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [exams, setExams] = useState<{ id: string; title: string; termId: string | null }[]>([]);
   
  // Stats - using real current data only
  const [stats, setStats] = useState({
    previousStudents: 0, // Will be fetched from previous term when available
    previousTeachers: 0,
    previousAttendance: 0,
    previousRevenue: 0,
  });

  // Loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const [studentsRes, teachersRes, attendanceRes, paymentsRes, announcementsRes, calendarRes, examsRes] = await Promise.allSettled([
        fetch(`/api/students?schoolId=${selectedSchoolId}&limit=5`),
        fetch(`/api/teachers?schoolId=${selectedSchoolId}&limit=5`),
        fetch(`/api/attendance?schoolId=${selectedSchoolId}&limit=100`),
        fetch(`/api/payments?schoolId=${selectedSchoolId}&limit=10`),
        fetch(`/api/announcements?schoolId=${selectedSchoolId}&limit=10`),
        fetch(`/api/calendar?schoolId=${selectedSchoolId}`),
        fetch(`/api/exams?schoolId=${selectedSchoolId}&limit=100`),
      ]);

      if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
        const json = await studentsRes.value.json();
setStudents(Array.isArray(json.data) ? json.data : []);
        setTeachers(Array.isArray(json.data) ? json.data : []);
        setAttendanceRecords(Array.isArray(json.data) ? json.data : []);
        setPayments(Array.isArray(json.data) ? json.data : []);
        setAnnouncements(Array.isArray(json.data) ? json.data : []);
        setCalendarEvents(Array.isArray(json.data) ? json.data : []);
        setExams(Array.isArray(json.data) ? json.data : []);
      }

       // Fetch analytics for current data only
       try {
         const analyticsRes = await fetch(`/api/analytics?schoolId=${selectedSchoolId}`);
         if (analyticsRes.ok) {
           const analyticsJson = await analyticsRes.json();
           if (analyticsJson.data?.schoolOverview) {
             const overview = analyticsJson.data.schoolOverview;
             // Use actual current counts; previous period would need separate term-based query
             setStats({
               previousStudents: 0, // TODO: fetch previous term data
               previousTeachers: 0,
               previousAttendance: analyticsJson.data.attendanceByClass?.[0]?.percentage || 0,
               previousRevenue: 0,
             });
           }
         }
       } catch {
         // Analytics is optional
       }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <DashboardSkeleton />;
  if (error && students.length === 0 && teachers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">School Dashboard</h1>
            <p className="text-muted-foreground">{currentUser.schoolName} — Dashboard</p>
          </div>
        </div>
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  // Computed values
  const totalStudents = students.length;
  const totalTeachers = teachers.length;

  // Calculate changes compared to previous period
  const studentChange = stats.previousStudents > 0 ? Math.round(((totalStudents - stats.previousStudents) / stats.previousStudents) * 100) : 0;
  const teacherChange = stats.previousTeachers > 0 ? Math.round(((totalTeachers - stats.previousTeachers) / stats.previousTeachers) * 100) : 0;
  
  // Exams count - use real data from API
  const examCount = exams.length;

  // Attendance computation from records
  const attendanceRecs = Array.isArray(attendanceRecords) ? attendanceRecords : [];
  const todayAttendance = attendanceRecs.filter(r => {
    const today = new Date().toISOString().split('T')[0];
    return r.date && new Date(r.date).toISOString().split('T')[0] === today;
  });
  const presentToday = todayAttendance.filter(r => r.status === 'present').length;
  const absentToday = todayAttendance.filter(r => r.status === 'absent').length;
  const lateToday = todayAttendance.filter(r => r.status === 'late').length;
  const totalToday = presentToday + absentToday + lateToday;
  const attendanceRate = totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : 0;

  // Group attendance by day for weekly chart
  const weeklyAttendance = new Map<string, { day: string; present: number; absent: number }>();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  attendanceRecs.forEach(r => {
    const dateKey = new Date(r.date).toISOString().split('T')[0];
    const dayName = dayNames[new Date(r.date).getDay()];
    if (!weeklyAttendance.has(dateKey)) {
      weeklyAttendance.set(dateKey, { day: dayName, present: 0, absent: 0 });
    }
    const dayData = weeklyAttendance.get(dateKey)!;
    if (r.status === 'present') dayData.present++;
    else if (r.status === 'absent') dayData.absent++;
  });
  const weeklyData = Array.from(weeklyAttendance.values()).slice(-5);
  const weeklyMaxPresent = Math.max(...weeklyData.map(d => d.present), 1);

  // Payments
  const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'unverified');
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Top performers from student data
  const topPerformers = [...students]
    .filter(s => s.gpa !== null)
    .sort((a, b) => (b.gpa || 0) - (a.gpa || 0))
    .slice(0, 3)
    .map((s, i) => ({
      rank: i + 1,
      name: s.user?.name || 'Unknown',
      class: s.class ? `${s.class.name}${s.class.section ? ` ${s.class.section}` : ''}` : '-',
      gpa: s.gpa || 0,
      trend: i === 0 ? 'up' as const : i === 2 ? 'down' as const : 'stable' as const,
    }));

  // Attendance by class (from records)
  const classAttendance = new Map<string, { class: string; total: number; present: number }>();
  attendanceRecords.forEach(r => {
    const student = students.find(s => s.id === r.studentId);
    const className = student?.class ? `${student.class.name}${student.class.section ? ` ${student.class.section}` : ''}` : 'Unknown';
    if (!classAttendance.has(className)) {
      classAttendance.set(className, { class: className, total: 0, present: 0 });
    }
    const cd = classAttendance.get(className)!;
    cd.total++;
    if (r.status === 'present') cd.present++;
  });
  const attendanceByClass = Array.from(classAttendance.values())
    .map(c => ({ class: c.class, rate: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate);

  const quickActions = [
    { label: 'Add Student', icon: Plus, view: 'students' as const, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Manage Fees', icon: Wallet, view: 'payments' as const, color: 'bg-blue-100 text-blue-700' },
    { label: 'View Reports', icon: BarChart3, view: 'reports' as const, color: 'bg-purple-100 text-purple-700' },
    { label: 'Send Notice', icon: Megaphone, view: 'announcements' as const, color: 'bg-amber-100 text-amber-700' },
    { label: 'ID Cards', icon: IdCard, view: 'id-cards' as const, color: 'bg-cyan-100 text-cyan-700' },
    { label: 'Attendance', icon: CalendarCheck, view: 'attendance' as const, color: 'bg-pink-100 text-pink-700' },
  ];

  const collectionRate = totalCollected + pendingAmount > 0 ? Math.round((totalCollected / (totalCollected + pendingAmount)) * 100) : 0;

  // Fee type breakdown from payments
  const methodTotals = new Map<string, number>();
  payments.forEach(p => {
    if (p.status === 'verified' || p.status === 'completed') {
      methodTotals.set(p.method, (methodTotals.get(p.method) || 0) + (p.amount || 0));
    }
  });
  const byFeeType = Array.from(methodTotals.entries()).map(([method, amount]) => ({ type: method.charAt(0).toUpperCase() + method.slice(1), amount }));
  const feeTypeMax = Math.max(...byFeeType.map(f => f.amount), 1);

  return (
    <motion.div 
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
       {/* Page Header */}
       <motion.div 
         className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
         variants={slideUp}
       >
         <div>
           <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
             Administrative <span className="text-blue-600">Command</span>
           </h1>
           <p className="text-muted-foreground font-medium mt-1">
             {currentUser.schoolName} — Dashboard Overview
           </p>
         </div>
         <div className="flex items-center gap-3">
           <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 py-1.5 px-4 rounded-xl font-bold text-xs shadow-sm uppercase tracking-widest animate-pulse-glow">
             <GraduationCap className="size-4 mr-2" /> Academic Year Active
           </Badge>
         </div>
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
       </motion.div>

      {/* KPI Row */}
      <motion.div 
        className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6"
        variants={staggerContainer}
      >
        <motion.div variants={scaleIn}><KpiCard title="Students" value={totalStudents.toLocaleString()} icon={GraduationCap} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" change={studentChange} changeLabel="vs last term" /></motion.div>
        <motion.div variants={scaleIn}><KpiCard title="Teachers" value={totalTeachers} icon={Users} iconBgColor="bg-blue-50" iconColor="text-blue-600" change={teacherChange} changeLabel="vs last term" /></motion.div>
        <motion.div variants={scaleIn}><KpiCard title="Attendance" value={`${attendanceRate}%`} icon={CalendarCheck} iconBgColor="bg-green-50" iconColor="text-green-600" changeLabel="current" /></motion.div>
        <motion.div variants={scaleIn}><KpiCard title="Revenue" value={`₦${(totalCollected / 1000000).toFixed(1)}M`} icon={Wallet} iconBgColor="bg-amber-50" iconColor="text-amber-600" changeLabel="collected" /></motion.div>
        <motion.div variants={scaleIn}><KpiCard title="Pending" value={`₦${(pendingAmount / 1000000).toFixed(1)}M`} icon={AlertTriangle} iconBgColor="bg-red-50" iconColor="text-red-600" changeLabel="awaiting" /></motion.div>
        <motion.div variants={scaleIn}><KpiCard title="Exams" value={examCount} icon={FileEdit} iconBgColor="bg-purple-50" iconColor="text-purple-600" changeLabel="this term" /></motion.div>
      </motion.div>

      {/* Finance Progress Banner */}
      <motion.div variants={slideUp}>
        <Card className="glass-card border-0 shadow-lg overflow-hidden group">
          <div className="absolute top-0 left-0 h-full w-1.5 bg-emerald-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="size-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Revenue Milestones</p>
                  <p className="text-xs font-medium text-muted-foreground">₦{(totalCollected / 1000000).toFixed(1)}M collected of ₦{((totalCollected + pendingAmount) / 1000000).toFixed(1)}M target</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-emerald-600">{collectionRate}%</span>
              </div>
            </div>
            <div className="relative h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${collectionRate}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
              />
              <div className="absolute inset-0 animate-shimmer opacity-30" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Dashboard Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <motion.div variants={fadeIn}>
          <TabsList className="bg-gray-100/50 p-1.5 rounded-2xl border backdrop-blur-sm">
            <TabsTrigger value="overview" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg font-bold text-sm">Insights</TabsTrigger>
            <TabsTrigger value="academics" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg font-bold text-sm">Academic Life</TabsTrigger>
            <TabsTrigger value="finance" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg font-bold text-sm">Financials</TabsTrigger>
          </TabsList>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {activeTab === 'overview' && (
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Weekly Attendance Visualization */}
                <div className="lg:col-span-7">
                  <Card className="glass-panel border-0 h-full overflow-hidden">
                    <CardHeader className="border-b bg-white/40">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <CalendarCheck className="size-5 text-blue-500" />
                            Attendance Analytics
                          </CardTitle>
                          <CardDescription className="text-xs">Live tracking of student engagement</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="font-bold text-xs hover:bg-blue-50" onClick={() => setCurrentView('attendance')}>Deep Dive</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {weeklyData.length > 0 ? (
                        <div className="space-y-8">
                          <div className="flex items-end gap-4 h-48">
                            {weeklyData.map((day, i) => (
                              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                <div className="flex gap-1 w-full h-40">
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(day.present / weeklyMaxPresent) * 100}%` }}
                                    className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg shadow-sm group-hover:from-blue-500 transition-all duration-300 relative"
                                  >
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold bg-blue-900 text-white px-1.5 py-0.5 rounded">{day.present}</div>
                                  </motion.div>
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(day.absent / weeklyMaxPresent) * 100}%` }}
                                    className="w-1/3 bg-red-200/50 rounded-t-lg group-hover:bg-red-300 transition-all duration-300"
                                  />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{day.day}</span>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { label: 'Present Today', val: presentToday, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                              { label: 'Absent', val: absentToday, color: 'text-red-600', bg: 'bg-red-50' },
                              { label: 'Late Arrival', val: lateToday, color: 'text-amber-600', bg: 'bg-amber-50' }
                            ].map(item => (
                              <div key={item.label} className={cn("p-4 rounded-2xl border text-center transition-transform hover:scale-105", item.bg)}>
                                <p className={cn("text-2xl font-bold", item.color)}>{item.val}</p>
                                <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground mt-1">{item.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 opacity-50"><BarChart3 className="size-12 mb-2" /><p className="text-sm font-medium">No activity data yet</p></div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Hot Actions + Performers */}
                <div className="lg:col-span-5 space-y-6">
                  <Card className="glass-panel border-0">
                    <CardHeader className="pb-3 border-b bg-white/40 uppercase tracking-widest text-[10px] font-bold text-gray-500">Command Center</CardHeader>
                    <CardContent className="p-4 grid grid-cols-3 gap-3">
                      {quickActions.map(action => (
                        <motion.button 
                          key={action.label} 
                          whileHover={{ y: -3, scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-transparent bg-white hover:border-blue-200 hover:shadow-md transition-all group shadow-sm"
                          onClick={() => setCurrentView(action.view)}
                        >
                          <div className={cn("size-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", action.color)}>
                            <action.icon className="size-5" />
                          </div>
                          <span className="text-[10px] font-bold text-center leading-tight uppercase">{action.label}</span>
                        </motion.button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="glass-panel border-0 overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-white/40 flex flex-row items-center justify-between">
                      <span className="uppercase tracking-widest text-[10px] font-bold text-gray-500">Elite Talent</span>
                      <Award className="size-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-gray-100">
                        {topPerformers.map(student => (
                          <div key={student.rank} className="flex items-center gap-4 p-4 hover:bg-white/60 transition-colors">
                            <div className="flex size-8 items-center justify-center rounded-full bg-amber-50 text-amber-700 text-xs font-bold shadow-inner">
                              #{student.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{student.name}</p>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{student.class}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-600">{student.gpa}</p>
                              <div className={cn(
                                "flex items-center justify-end gap-1 text-xs font-bold uppercase",
                                student.trend === 'up' ? 'text-emerald-500' : student.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                              )}>
                                {student.trend === 'up' ? <TrendingUp className="size-2.5" /> : student.trend === 'down' ? <RefreshCw className="size-2.5 rotate-180" /> : <ChevronRight className="size-2.5" />}
                                {student.trend}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'academics' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="glass-panel border-0">
                  <CardHeader className="border-b bg-white/40">
                    <CardTitle className="text-lg font-bold flex items-center gap-2"><Users className="size-5 text-emerald-500" /> Attendance by Class</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-6">
                        {attendanceByClass.map(cls => (
                          <div key={cls.class} className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                              <span>{cls.class}</span>
                              <span className={cn(cls.rate >= 90 ? 'text-emerald-600' : 'text-amber-600')}>{cls.rate}%</span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${cls.rate}%` }}
                                className={cn("h-full rounded-full transition-all duration-1000", cls.rate >= 90 ? 'bg-emerald-500' : 'bg-amber-500')}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="glass-panel border-0">
                  <CardHeader className="border-b bg-white/40 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <CalendarCheck className="size-5 text-purple-500" /> Timeline
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="font-bold text-xs" onClick={() => setCurrentView('calendar')}>Full View</Button>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {calendarEvents.map(ev => (
                          <motion.div whileHover={{ x: 5 }} key={ev.id} className="flex items-center gap-4 p-4 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all group cursor-pointer">
                            <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: ev.color || '#3b82f6' }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{ev.title}</p>
                              <div className="flex items-center gap-3 mt-1 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                <span className="flex items-center gap-1"><Clock className="size-3" /> {new Date(ev.startDate).toLocaleDateString()}</span>
                                <Badge variant="secondary" className="px-1.5 py-0 h-4 text-xs">{ev.type}</Badge>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'finance' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="glass-panel border-0">
                  <CardHeader className="border-b bg-white/40">
                    <CardTitle className="text-lg font-bold flex items-center gap-2"><CreditCard className="size-5 text-emerald-500" /> Revenue Stream</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-8">
                      {byFeeType.map((item, i) => {
                        const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                        return (
                          <div key={item.type} className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                              <span className="flex items-center gap-2">
                                <div className={cn("size-2.5 rounded-sm shadow-sm", colors[i % colors.length])} />
                                {item.type}
                              </span>
                              <span className="text-gray-900">₦{(item.amount / 1000000).toFixed(2)}M</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.amount / feeTypeMax) * 100}%` }}
                                className={cn("h-full rounded-full", colors[i % colors.length])}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-panel border-0">
                  <CardHeader className="border-b bg-white/40 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2"><RefreshCw className="size-5 text-blue-500" /> Recent Transactions</CardTitle>
                    <Button variant="ghost" size="sm" className="font-bold text-xs" onClick={() => setCurrentView('payments')}>All Log</Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[430px]">
                      <div className="divide-y divide-gray-50">
                        {payments.map(p => (
                          <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-white/60 transition-colors group">
                            <div className="size-10 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                              <Wallet className="size-5 text-gray-500 group-hover:text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{p.student?.user?.name || p.paidBy || 'External Payer'}</p>
                              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{p.method} · {new Date(p.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">₦{(p.amount || 0).toLocaleString()}</p>
                              <Badge variant={p.status === 'verified' || p.status === 'completed' ? 'default' : 'secondary'} className="text-xs px-1.5 h-4 uppercase font-bold tracking-tight">
                                {p.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* Global Announcements Feed */}
      <motion.div variants={slideUp}>
        <Card className="glass-panel border-0 border-t-4 border-t-emerald-500 shadow-xl overflow-hidden">
          <CardHeader className="pb-3 border-b bg-white/40 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Megaphone className="size-5 text-emerald-500 animate-gentle-bounce" />
              <CardTitle className="text-lg font-bold">Broadcast Center</CardTitle>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[10px] font-bold">{announcements.length} ALERTS</Badge>
            </div>
            <Button variant="ghost" size="sm" className="font-bold text-xs" onClick={() => setCurrentView('announcements')}>Bulletin Board</Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              {announcements.slice(0, 4).map(ann => (
                <motion.div 
                  key={ann.id} 
                  whileHover={{ scale: 1.01, x: 5 }} 
                  className="flex items-start gap-4 p-4 rounded-2xl border-2 border-transparent bg-white shadow-sm hover:border-emerald-200 hover:shadow-md transition-all group cursor-pointer"
                  onClick={() => setCurrentView('announcements')}
                >
                  <div className={cn(
                    "mt-1 size-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform",
                    ann.priority === 'urgent' ? 'bg-red-50 text-red-600' : ann.priority === 'high' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  )}>
                    <Megaphone className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold truncate text-gray-900 group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{ann.title}</p>
                      {ann.priority === 'urgent' && <div className="size-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{ann.content}</p>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-dashed">
                      <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{new Date(ann.createdAt).toLocaleDateString()}</span>
                      <Badge variant="outline" className="text-xs border-emerald-100 text-emerald-600 bg-emerald-50/30">READ MORE</Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
