'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Users, BookOpen, BarChart3, Calendar, MessageSquare, CreditCard, Bell, GraduationCap, ClipboardList, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { SafeFormattedDate } from '@/components/shared/safe-formatted-date';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn, hoverScale } from '@/lib/motion-variants';
import { useAnalytics } from '@/hooks/use-api';

const quickActions = [
  { icon: Users, label: 'Manage Students', view: 'students' as const, color: 'bg-blue-50 border-blue-200 hover:bg-blue-100', iconColor: 'text-blue-600' },
  { icon: BookOpen, label: 'Academic', view: 'academic-structure' as const, color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100', iconColor: 'text-emerald-600' },
  { icon: Calendar, label: 'Attendance', view: 'attendance' as const, color: 'bg-amber-50 border-amber-200 hover:bg-amber-100', iconColor: 'text-amber-600' },
  { icon: BarChart3, label: 'Reports', view: 'results' as const, color: 'bg-purple-50 border-purple-200 hover:bg-purple-100', iconColor: 'text-purple-600' },
  { icon: CreditCard, label: 'Finance', view: 'finance' as const, color: 'bg-green-50 border-green-200 hover:bg-green-100', iconColor: 'text-green-600' },
  { icon: MessageSquare, label: 'Messages', view: 'messaging-center' as const, color: 'bg-pink-50 border-pink-200 hover:bg-pink-100', iconColor: 'text-pink-600' },
  { icon: Bell, label: 'Announcements', view: 'announcements' as const, color: 'bg-red-50 border-red-200 hover:bg-red-100', iconColor: 'text-red-600' },
  { icon: GraduationCap, label: 'ID Cards', view: 'id-cards' as const, color: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100', iconColor: 'text-cyan-600' },
  { icon: ClipboardList, label: 'Evaluations', view: 'weekly-evaluations' as const, color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', iconColor: 'text-indigo-600' },
];

export function OverviewView() {
  const { currentRole, setCurrentView, selectedTermId, selectedSchoolId } = useAppStore();
  const { data: analyticsData, isLoading, refetch } = useAnalytics();
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; content: string; priority: string; createdAt: string }>>([]);
  
  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!selectedSchoolId) return;
      try {
        const res = await fetch(`/api/announcements?schoolId=${selectedSchoolId}&limit=10`);
        if (res.ok) {
          const json = await res.json();
          setAnnouncements(json.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch announcements:', err);
      }
    };
    fetchAnnouncements();
  }, [selectedSchoolId]);
  
  const handleNavigate = (view: string) => {
    setCurrentView(view as any);
  };

   const analytics = analyticsData?.data as { schoolOverview?: { totalStudents: number; totalTeachers: number; totalClasses: number }; attendanceByClass?: Array<{ percentage: number }> } | undefined;
   
   const stats = analytics?.schoolOverview ? [
     { label: 'Total Students', value: String(analytics.schoolOverview.totalStudents || 0), change: 'Live count', trend: 'neutral' },
     { label: 'Teachers', value: String(analytics.schoolOverview.totalTeachers || 0), change: 'Active', trend: 'neutral' },
     { label: 'Classes', value: String(analytics.schoolOverview.totalClasses || 0), change: 'Active', trend: 'neutral' },
     { label: 'Attendance Rate', value: analytics.attendanceByClass?.[0] 
       ? `${analytics.attendanceByClass[0].percentage}%` 
       : 'N/A', change: 'Today', trend: 'neutral' },
   ] : [];

  return (
    <motion.div 
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Header Section */}
      <motion.div 
        variants={slideUp}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white"
          >
            Insights <span className="text-emerald-500">&</span> Overview
          </motion.h1>
          <p className="text-muted-foreground font-medium mt-1">
            Welcome back! Here&apos;s a live snapshot of your school&apos;s performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-gray-200 py-1.5 px-3 rounded-lg font-bold text-xs shadow-sm uppercase tracking-wider">
            <Clock className="size-3.5 mr-1.5 text-emerald-500" /> <SafeFormattedDate date={new Date()} options={{ month: 'short', day: 'numeric', year: 'numeric' }} mode="toLocaleDateString" />
          </Badge>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
      >
        {isLoading ? (
          [...Array(4)].map((_, idx) => (
            <Card key={idx} className="glass-card overflow-hidden">
              <CardContent className="p-6 space-y-3">
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-2 w-20 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))
        ) : stats.length > 0 ? (
          stats.map((stat, idx) => (
            <motion.div
              key={idx}
              variants={scaleIn}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <Card className="glass-card overflow-hidden group">
                <CardContent className="p-6 relative">
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="size-16" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                  <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
                     <Badge className={cn(
                       "text-[10px] font-bold px-1.5 h-5",
                       (stat.trend as string) === 'up' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-gray-100 text-gray-600 border-gray-200"
                     )}>
                       {(stat.trend as string) === 'up' ? '↑ ' : ''}{stat.change}
                     </Badge>
                  </div>
                   <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full mt-4 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: stat.value !== 'N/A' ? '100%' : '0%' }}
                      className={cn("h-full rounded-full", idx % 2 === 0 ? "bg-emerald-500" : "bg-blue-500")}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        ) : (
          <Card className="col-span-full glass-card">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No analytics data available. Please ensure your school has students and teachers registered.</p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Quick Actions Tile Grid */}
        <motion.div variants={slideUp} className="lg:col-span-8">
          <Card className="glass-panel border-0 shadow-xl overflow-hidden">
            <CardHeader className="border-b bg-white/30 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Briefcase className="size-5 text-emerald-500" />
                    Operational Hub
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">Frequent management tasks at your fingertips</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <motion.div 
                className="grid grid-cols-2 sm:grid-cols-3 gap-4"
                variants={staggerContainer}
              >
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <motion.div
                      key={idx}
                      variants={scaleIn}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <button
                        onClick={() => handleNavigate(action.view)}
                        className={cn(
                          'w-full h-28 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 border-2 group',
                          action.color || 'bg-white border-gray-100 hover:border-emerald-200 shadow-sm'
                        )}
                      >
                        <div className={cn(
                          "size-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110",
                          action.iconColor ? action.iconColor.replace('text-', 'bg-').replace('600', '100') : 'bg-gray-100'
                        )}>
                          <Icon className={cn('size-6', action.iconColor || 'text-gray-600')} />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-tight text-gray-700 dark:text-gray-200">{action.label}</span>
                      </button>
                    </motion.div>
                  );
                })}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Live Multi-feed Activity */}
        <motion.div variants={slideUp} className="lg:col-span-4">
          <Card className="glass-panel border-0 shadow-xl overflow-hidden h-full">
            <CardHeader className="border-b bg-white/30 backdrop-blur-sm">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <RefreshCw className="size-5 text-blue-500" />
                Live Feed
              </CardTitle>
              <CardDescription className="text-xs font-medium">Real-time system & user updates</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-[420px] pr-4">
                <motion.div 
                  className="space-y-3"
                  variants={staggerContainer}
                >
                  {announcements.slice(0, 6).map((ann, idx) => (
                    <motion.div
                      key={ann.id || idx}
                      variants={fadeIn}
                      className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/40 transition-all border border-transparent hover:border-white/50 group"
                    >
                      <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:rotate-12", 
                        ann.priority === 'urgent' ? 'bg-red-50 text-red-500' : ann.priority === 'high' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500')}>
                        <Bell className={cn("size-5", 
                          ann.priority === 'urgent' ? 'text-red-500' : ann.priority === 'high' ? 'text-amber-500' : 'text-emerald-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{ann.title}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{new Date(ann.createdAt).toLocaleDateString()}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* System Status Banner */}
      <motion.div variants={slideUp}>
        <Card className="glass-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">Systems Operational</span>
              </div>
              <div className="flex gap-4">
                {['Platform Active'].map((s, i) => (
                  <span key={i} className="text-[10px] font-bold text-muted-foreground border-l border-gray-200 pl-4 first:border-0 first:pl-0">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
