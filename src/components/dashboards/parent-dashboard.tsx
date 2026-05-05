import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { useTheme } from '@/hooks/use-theme';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { fadeIn, slideUp, staggerContainer, scaleIn, hoverScale } from '@/lib/motion-variants';
import {
  GraduationCap, CalendarCheck, Wallet, Bell, CreditCard, Calendar, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, User, TrendingUp, RefreshCw, Sparkles, ChevronRight,
  Moon, Sun, LogOut
} from 'lucide-react';

export function ParentDashboard() {
  const { currentUser, setCurrentView, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ApiStudent[]>([]);
  const [childResults, setChildResults] = useState<Map<string, ApiResultData>>(new Map());
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<ApiCalendarEvent[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
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
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (schoolId) params.set('schoolId', schoolId);

        const [childrenRes, paymentsRes, announcementsRes, calendarRes, notificationsRes] = await Promise.all([
          fetch(`/api/parent/children?${params.toString()}`),
          fetch(`/api/payments?${params.toString()}&limit=20`),
          fetch(`/api/announcements?${params.toString()}&limit=10`),
          fetch(`/api/calendar?${params.toString()}`),
          fetch(`/api/notifications?userId=${currentUser.id}&limit=10`),
        ]);

        let childrenData: ApiStudent[] = [];
        if (childrenRes.ok) {
          const json = await childrenRes.json();
          childrenData = json.data || [];
        }
        setChildren(childrenData);

        if (paymentsRes.ok) {
          const json = await paymentsRes.json();
          setPayments(json.data || json || []);
        }
        if (announcementsRes.ok) {
          const json = await announcementsRes.json();
          setAnnouncements(json.data || json || []);
        }
        if (calendarRes.ok) {
          const json = await calendarRes.json();
          setCalendarEvents(json.data || json || []);
        }
        if (notificationsRes.ok) {
          const json = await notificationsRes.json();
          setNotifications(json.data || json || []);
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

  useEffect(() => {
    if (children.length === 0) return;
    const child = children[selectedChildIndex];
    if (!child) return;

    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/results?studentId=${child.id}`);
        if (res.ok) {
          const json = await res.json();
          setChildResults(prev => {
            const next = new Map(prev);
            next.set(child.id, json.data || json);
            return next;
          });
        }
      } catch (error: unknown) { handleSilentError(error); /* Silently fail */ }
    };
    fetchResults();
  }, [children, selectedChildIndex]);

  const currentChild = children[selectedChildIndex];
  const currentResults = currentChild ? childResults.get(currentChild.id) : null;

  const childGPA = currentResults?.overallGPA || currentChild?.gpa || 0;
  const childRank = currentResults?.classRank?.rank || currentChild?.rank || null;
  const childName = currentChild?.user?.name || 'Your Child';
  const attendanceSummary = currentResults?.attendanceSummary;
  const attendanceRate = attendanceSummary?.percentage || 0;

  const totalPaid = payments
    .filter(p => p.status === 'verified' || p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = totalPending;

  // Use real attendance data from API
  const attendanceDays = useMemo(() => {
    const present = attendanceSummary?.present || 0;
    const absent = attendanceSummary?.absent || 0;
    const late = attendanceSummary?.late || 0;
    const total = present + absent + late;
    if (total === 0) return [];
    
    const days: { day: number; status: 'present' | 'absent' | 'late' }[] = [];
    for (let i = 1; i <= total; i++) {
      if (i <= present) {
        days.push({ day: i, status: 'present' });
      } else if (i <= present + absent) {
        days.push({ day: i, status: 'absent' });
      } else {
        days.push({ day: i, status: 'late' });
      }
    }
    return days;
  }, [attendanceSummary]);

  const presentDaysCount = attendanceSummary?.present || 0;
  const upcomingEvents = calendarEvents.slice(0, 4);

  // Use real fee data from payments API
  const feeStatus = {
    total: totalPaid + outstanding,
    paid: totalPaid,
    outstanding: outstanding,
    pendingCount: payments.filter(p => p.status === 'pending').length,
  };

   // Use real academic data from results API
   const recentReport = currentResults?.terms?.[0] ? {
     term: currentResults.terms[0].termName || 'Current Term',
     gpa: childGPA > 0 ? childGPA.toFixed(1) : 'N/A',
     rank: childRank ? `${childRank}${getOrdinal(childRank)} of ${currentResults.classRank?.totalStudents || '—'}` : 'N/A',
     totalSubjects: currentResults.terms[0].totalSubjects || 0,
     average: currentResults.overallAverage?.toFixed(1) || 'N/A',
   } : null;

  function getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return (s[(v - 20) % 10] || s[v] || s[0]);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-60 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
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
       <motion.div variants={slideUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
         <div>
           <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
             Welcome, <span className="text-indigo-600">{currentUser.name.split(' ').slice(-1)[0]}</span> 👋
           </h1>
           <div className="flex items-center gap-3 mt-1.5 overflow-x-auto pb-1 no-scrollbar">
             {children.length > 0 ? (
               <>
                 <p className="text-muted-foreground font-medium whitespace-nowrap text-sm uppercase tracking-widest">Profiles:</p>
                 {children.map((child, i) => (
                   <motion.button
                     key={child.id}
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     onClick={() => setSelectedChildIndex(i)}
                     className={cn(
                       "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                       i === selectedChildIndex 
                         ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                         : "bg-white border text-gray-500 hover:border-indigo-200"
                     )}
                   >
                     {child.user.name.split(' ')[0]}
                   </motion.button>
                 ))}
               </>
             ) : (
               <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold uppercase tracking-widest border border-amber-100">
                 <AlertTriangle className="size-3.5" /> No children linked to profile
               </div>
             )}
           </div>
         </div>
         <div className="flex items-center gap-2">
           <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-gray-100 py-2 px-4 rounded-xl font-bold text-xs shadow-sm text-indigo-700 uppercase tracking-[0.2em] self-start sm:self-center">
             Monitoring Portal
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

      {/* KPI Cards Row */}
      <motion.div className="grid grid-cols-2 gap-4 lg:grid-cols-4" variants={staggerContainer}>
        <motion.div variants={scaleIn}><KpiCard title="Current GPA" value={childGPA > 0 ? `${childGPA.toFixed(1)}/5.0` : 'N/A'} icon={GraduationCap} iconBgColor="bg-blue-50" iconColor="text-blue-600" /></motion.div>
        <motion.div variants={scaleIn}><KpiCard title="Attendance" value={attendanceRate > 0 ? `${attendanceRate}%` : 'N/A'} icon={CalendarCheck} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" /></motion.div>
        <motion.div variants={scaleIn}><KpiCard title="Bill Status" value={`₦${Math.round(feeStatus.paid / 1000)}K`} icon={Wallet} iconBgColor="bg-amber-50" iconColor="text-amber-600" changeLabel={feeStatus.outstanding > 0 ? `₦${Math.round(feeStatus.outstanding / 1000)}K due` : 'All paid'} /></motion.div>
        <motion.div variants={scaleIn}><KpiCard title="Class Stand" value={childRank ? `#${childRank}` : 'N/A'} icon={User} iconBgColor="bg-purple-50" iconColor="text-purple-600" changeLabel={currentResults?.classRank?.totalStudents ? `of ${currentResults.classRank.totalStudents} pupils` : ''} /></motion.div>
      </motion.div>

      {/* Main Grid Content */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Attendance + Fees Hub */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <motion.div variants={fadeIn}>
            <Card className="glass-panel border-0 overflow-hidden h-full">
              <CardHeader className="border-b bg-white/40 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2"><Calendar className="size-5 text-indigo-500" /> Attendance Ledger</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Real-time presence monitoring for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="font-bold text-[10px] uppercase tracking-widest text-indigo-600" onClick={() => setCurrentView('attendance')}>Full Access</Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-6 mb-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"><div className="size-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" /> Present ({presentDaysCount})</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"><div className="size-3 rounded-full bg-rose-500 border-2 border-white shadow-sm" /> Absent ({attendanceDays.filter(d => d.status === 'absent').length})</div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"><div className="size-3 rounded-full bg-amber-500 border-2 border-white shadow-sm" /> Late ({attendanceDays.filter(d => d.status === 'late').length})</div>
                </div>
                <div className="grid grid-cols-5 gap-1 sm:gap-2 md:grid-cols-10">
                  {attendanceDays.map((d, i) => (
                    <motion.div
                      key={d.day}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn(
                        "group relative flex aspect-square items-center justify-center rounded-xl text-[10px] font-bold uppercase shadow-sm border-2 transition-all cursor-help",
                        d.status === 'present' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:scale-110' :
                        d.status === 'absent' ? 'bg-rose-50 border-rose-100 text-rose-700 hover:scale-110' :
                        'bg-amber-50 border-amber-100 text-amber-700 hover:scale-110'
                      )}
                    >
                      {d.day}
                      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 uppercase font-bold tracking-widest">
                        {d.status}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="glass-panel border-0 overflow-hidden">
              <CardHeader className="border-b bg-white/40 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2"><CreditCard className="size-5 text-emerald-500" /> Financial Standing</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Academic tuition and facility balance records</CardDescription>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-xl px-5 uppercase tracking-widest" onClick={() => setCurrentView('finance')}>
                  Settle Fees
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3 text-[10px] font-bold uppercase tracking-[0.1em]">
                    <span className="text-muted-foreground">Budget Allocation (Verified vs Outstanding)</span>
                    <span className="text-emerald-700">₦{Math.round(feeStatus.paid / 1000)}K Total Received</span>
                  </div>
                  <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden border p-0.5 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(feeStatus.paid / feeStatus.total) * 100}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 p-5 group hover:border-emerald-300 transition-all">
                    <CheckCircle2 className="size-5 text-emerald-600 mb-3" />
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Verified Payments</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">₦{feeStatus.paid.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-5 group hover:border-amber-300 transition-all">
                    <AlertTriangle className="size-5 text-amber-600 mb-3" />
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Pending Balance</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">₦{feeStatus.outstanding.toLocaleString()}</p>
                  </div>
                 </div>
               </CardContent>
             </Card>
          </motion.div>
        </div>

        {/* Sidebar Space: Notifications + Events */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <motion.div variants={fadeIn}>
            <Card className="glass-panel border-0 overflow-hidden h-full">
              <CardHeader className="border-b bg-white/40 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Bell className="size-5 text-indigo-500 animate-gentle-bounce" /> Feed
                </CardTitle>
                <Badge variant="destructive" className="bg-red-50 text-red-600 text-[10px] font-bold border-red-100 px-2 h-5">{notifications.filter(n => !n.isRead).length} NEW</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[435px]">
                  <div className="divide-y divide-gray-50">
                    {notifications.length > 0 ? notifications.map(notif => (
                      <motion.div 
                        key={notif.id} 
                        whileHover={{ backgroundColor: "rgba(255,255,255,0.4)" }}
                        className={cn("flex items-start gap-4 p-5 transition-colors cursor-pointer", !notif.isRead ? 'bg-indigo-50/30' : '')}
                      >
                        <div className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-inner",
                          notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                          notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                          'bg-indigo-50 text-indigo-600'
                        )}>
                          {notif.type === 'success' ? <CheckCircle2 className="size-5" /> :
                           notif.type === 'warning' ? <AlertTriangle className="size-5" /> :
                           <Sparkles className="size-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors uppercase tracking-tight truncate">{notif.title}</p>
                          <p className="text-xs font-medium text-gray-500 mt-1 leading-relaxed">{notif.message}</p>
                          <p className="text-xs font-bold text-muted-foreground mt-3 uppercase tracking-widest">{notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : ''}</p>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="flex flex-col items-center justify-center py-20 opacity-40"><Bell className="size-12 mb-4" /><p className="text-sm font-bold uppercase tracking-widest">No Active Feedback</p></div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="glass-panel border-0 overflow-hidden">
              <CardHeader className="border-b bg-white/40 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="size-5 text-emerald-500" /> Events
                </CardTitle>
                <Button variant="ghost" size="sm" className="font-bold text-[10px] uppercase tracking-widest" onClick={() => setCurrentView('calendar')}>Full Agenda</Button>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {upcomingEvents.length > 0 ? upcomingEvents.map(ev => (
                    <motion.div 
                      key={ev.id} 
                      whileHover={{ x: 5 }}
                      className="flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent bg-white shadow-sm hover:border-emerald-100 transition-all cursor-pointer"
                    >
                      <div className="w-1 h-10 rounded-full" style={{ backgroundColor: ev.color || '#6366f1' }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 uppercase tracking-tight truncate">{ev.title}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{ev.startDate ? new Date(ev.startDate).toDateString() : ''}</p>
                      </div>
                      <Badge variant="outline" className="bg-gray-50 border-0 text-xs font-bold uppercase tracking-tighter shrink-0">{ev.type}</Badge>
                    </motion.div>
                  )) : (
                    <div className="text-center py-8 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">No upcoming schedules</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Academic Spotlight: Global Report Summary */}
      {recentReport && (
      <motion.div variants={slideUp}>
        <Card className="glass-panel border-0 border-t-4 border-t-indigo-500 shadow-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b bg-white/40 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="size-6 text-indigo-500 animate-pulse" />
              <div>
                <CardTitle className="text-xl font-bold">Academic Performance Insight</CardTitle>
                <CardDescription className="text-xs font-medium uppercase tracking-tight">{recentReport.term}</CardDescription>
              </div>
            </div>
            <Button variant="outline" className="font-bold text-[10px] uppercase tracking-widest bg-white rounded-xl h-10 px-6 border-gray-200" onClick={() => setCurrentView('results')}>
              <ArrowRight className="size-4 mr-2" /> Comprehensive Report
            </Button>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid gap-8 sm:grid-cols-4 mb-8">
              {[
                { label: 'GPA Metric', value: recentReport.gpa, color: 'text-indigo-600' },
                { label: 'Class Stand', value: recentReport.rank, color: 'text-gray-900' },
                { label: 'Mean Average', value: `${recentReport.average}%`, color: 'text-emerald-600' },
                { label: 'Active Subjects', value: recentReport.totalSubjects, color: 'text-gray-900' }
              ].map(stat => (
                <div key={stat.label} className="text-center group">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                  <p className={cn("text-3xl font-bold tracking-tighter transition-transform group-hover:scale-110", stat.color)}>{stat.value}</p>
                </div>
              ))}
             </div>
           </CardContent>
         </Card>
       </motion.div>
      )}
    </motion.div>
  );
}

// Helper Interfaces
interface ApiStudent {
  id: string;
  admissionNo: string;
  gpa: number | null;
  cumulativeGpa: number | null;
  rank: number | null;
  behaviorScore: number | null;
  user: { name: string; email: string; avatar: string | null };
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  school: { id: string; name: string } | null;
}

interface ApiResultData {
  student: ApiStudent | null;
  terms: Array<{
    termId: string;
    termName: string;
    gpa: number;
    average: number;
    overallPercentage: number;
    totalSubjects: number;
    passed: number;
    failed: number;
    subjects: Array<{
      subjectName: string;
      score: number;
      totalMarks: number;
      percentage: number;
      grade: string | null;
    }>;
  }>;
  classRank: { rank: number | null; totalStudents: number } | null;
  attendanceSummary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percentage: number;
  } | null;
  overallGPA: number;
  overallAverage: number;
}

interface ApiPayment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  receiptNo: string;
  termId: string | null;
  paidBy: string | null;
  createdAt: string;
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

interface ApiCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  type: string;
  color: string | null;
}

interface ApiNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}
