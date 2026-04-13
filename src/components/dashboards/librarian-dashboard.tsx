'use client';

import { useState, useEffect, useMemo } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  BookOpen, BookCheck, BookX, AlertTriangle, ArrowRight,
  Plus, Search, BarChart3, Clock, TrendingUp, PieChart as PieChartIcon,
  RefreshCw, User, Book, Filter, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function LibrarianDashboard() {
  const { setCurrentView, selectedSchoolId } = useAppStore();
  const [analytics, setAnalytics] = useState<any>(null);
  const [borrowRecords, setBorrowRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSchoolId) return;
      try {
        setLoading(true);
        const [analyticsRes, borrowsRes] = await Promise.all([
          fetch(`/api/library/analytics?schoolId=${selectedSchoolId}`),
          fetch(`/api/library/borrow?schoolId=${selectedSchoolId}&limit=10`),
        ]);

        if (analyticsRes.ok) {
          const json = await analyticsRes.json();
          setAnalytics(json.data);
        }
        if (borrowsRes.ok) {
          const json = await borrowsRes.json();
          setBorrowRecords(json.data || []);
        }
      } catch (err) {
        toast.error('Failed to load library analytics');
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

  const summary = analytics?.summary || {};
  const categories = analytics?.categories || [];
  const trend = analytics?.trend || [];
  const popularBooks = analytics?.popularBooks || [];
  const overdueRecords = analytics?.overdueRecords || [];

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
      {/* Premium Header & Utilities (RESTORED PRE-EXISTING) */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-gray-900">
            Library Intel <BookOpen className="size-8 text-indigo-600" />
          </h1>
          <p className="text-muted-foreground font-medium">Inventory velocity and circulation health</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Quick Book Search..." 
              className="pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-100 w-64 shadow-sm transition-all"
            />
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-100 flex gap-2" onClick={() => setCurrentView('borrow-records')}>
            <Plus className="size-4" /> Issue Book
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Total Inventory" value={summary.totalCopies?.toLocaleString()} icon={BookOpen} iconBgColor="bg-indigo-50" iconColor="text-indigo-600" />
        <KpiCard title="Out on Loan" value={summary.borrowedCount?.toLocaleString()} icon={BookX} iconBgColor="bg-amber-50" iconColor="text-amber-600" />
        <KpiCard title="Critical Overdue" value={summary.overdueCount?.toLocaleString()} icon={AlertTriangle} iconBgColor="bg-rose-50" iconColor="text-rose-600" changeLabel="Immediate Action" />
        <KpiCard title="Circulation Rate" value={`${summary.returnRate}%`} icon={TrendingUp} iconBgColor="bg-emerald-50" iconColor="text-emerald-700" changeLabel="Turnover" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Circulation Trend Chart */}
        <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="border-b bg-gray-50/20 py-6">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <TrendingUp className="size-6 text-indigo-500" />
              Circulation Velocity
            </CardTitle>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Monthly volume of books issued across sectors</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[350px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="colorCirc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorCirc)" name="Books Issued" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution (RESTORED PREMIUM PIE) */}
        <Card className="lg:col-span-4 border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="border-b bg-gray-50/20 py-6">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <PieChartIcon className="size-5 text-indigo-500" /> Catalog Index
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pb-4">
            <div className="h-[280px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {categories.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black text-gray-900">{summary.uniqueTitles || 0}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Titles</span>
              </div>
            </div>
            
            <div className="mt-8 space-y-3">
              {categories.slice(0, 3).map((cat: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{cat.name}</span>
                  </div>
                  <span className="text-xs font-black text-gray-900">{cat.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Overdue Tracker (RESTORED PREMIUM COMPONENT) */}
        <Card className="lg:col-span-8 border-none shadow-sm">
          <CardHeader className="pb-4 border-b border-gray-50 p-6 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-rose-600">
                <AlertTriangle className="size-6" /> Overdue Monitor
              </CardTitle>
              <CardDescription className="text-xs font-medium">Immediate collection actions required</CardDescription>
            </div>
            <Button variant="outline" className="h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest border-rose-100 text-rose-600 hover:bg-rose-50">Notify All Parents</Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {overdueRecords.length > 0 ? overdueRecords.map((record: any, i: number) => (
                <motion.div whileHover={{ x: 5 }} key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-rose-100 bg-rose-50/20 group hover:bg-white hover:shadow-lg hover:border-rose-200 transition-all">
                  <div className="flex items-center gap-4">
                     <div className="size-12 rounded-2xl bg-white border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm shrink-0">
                        <User className="size-6" />
                     </div>
                     <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{record.student?.user?.name}</p>
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{record.book?.title}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="text-right">
                        <p className="text-xs font-black text-rose-600 uppercase tracking-tight">Due: {new Date(record.dueDate).toLocaleDateString()}</p>
                        <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Late by {Math.ceil((new Date().getTime() - new Date(record.dueDate).getTime()) / (1000 * 60 * 60 * 24))} days</p>
                     </div>
                     <Button size="sm" className="bg-white text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white font-black uppercase tracking-widest text-[9px] h-10 px-6 rounded-2xl transition-all">Return</Button>
                  </div>
                </motion.div>
              )) : (
                <div className="py-20 text-center flex flex-col items-center opacity-30">
                   <BookCheck className="size-12 mb-4 text-emerald-500" />
                   <p className="font-black uppercase tracking-[0.2em] text-[10px]">All accounts in good standing</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: Popular Titles & Recent Logs */}
        <div className="lg:col-span-4 space-y-6">
          {/* Top Titles */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-50 bg-gray-50/20">
              <CardTitle className="text-lg font-bold">Trending Titles</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {popularBooks.map((book: any, i: number) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="size-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xs font-black text-gray-400 group-hover:bg-indigo-50 group-hover:border-indigo-100 group-hover:text-indigo-600 transition-all font-serif italic">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-800 truncate uppercase tracking-tight">{book.title}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{book.count} Borrows this month</p>
                  </div>
                  <div className="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(book.count / popularBooks[0].count) * 100}%` }} className="h-full bg-indigo-500" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
             <Card className="border-none shadow-sm bg-indigo-50/30 group hover:bg-white transition-all cursor-pointer">
                <CardContent className="p-5 flex flex-col items-center text-center">
                   <div className="size-10 rounded-2xl bg-white border border-indigo-50 text-indigo-500 flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      <Book className="size-5" />
                   </div>
                   <p className="text-lg font-black text-gray-900">{summary.availableCopies}</p>
                   <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400">In Stock</p>
                </CardContent>
             </Card>
             <Card className="border-none shadow-sm bg-emerald-50/30 group hover:bg-white transition-all cursor-pointer">
                <CardContent className="p-5 flex flex-col items-center text-center">
                   <div className="size-10 rounded-2xl bg-white border border-emerald-50 text-emerald-500 flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      <RefreshCw className="size-5" />
                   </div>
                   <p className="text-lg font-black text-gray-900">12</p>
                   <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Restock</p>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
