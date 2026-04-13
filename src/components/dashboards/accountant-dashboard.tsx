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
  Wallet, TrendingUp, CreditCard, Banknote, Landmark, ArrowUpRight,
  Plus, History, FileText, Download, CheckCircle2, Clock, Search,
  Filter, ChevronRight, User, PieChart as PieChartIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, scaleIn } from '@/lib/motion-variants';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6'];

export function AccountantDashboard() {
  const { setCurrentView, selectedSchoolId } = useAppStore();
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSchoolId) return;
      try {
        setLoading(true);
        const [analyticsRes, paymentsRes] = await Promise.all([
          fetch(`/api/accountant/analytics?schoolId=${selectedSchoolId}`),
          fetch(`/api/payments?schoolId=${selectedSchoolId}&limit=10`),
        ]);

        if (analyticsRes.ok) {
          const json = await analyticsRes.json();
          setAnalytics(json.data);
        }
        if (paymentsRes.ok) {
          const json = await paymentsRes.json();
          setRecentPayments(json.data || []);
        }
      } catch (err) {
        toast.error('Failed to load financial analytics');
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

  const overview = analytics?.overview || {};
  const byGrade = analytics?.byGrade || [];
  const trend = analytics?.trend || [];
  const performance = analytics?.performance || {};

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
      {/* Premium Header & Financial Switcher (RESTORED PRE-EXISTING) */}
      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-gray-900">
            Fiscal Command <Wallet className="size-8 text-indigo-600" />
          </h1>
          <p className="text-muted-foreground font-medium">Revenue realization and collection health</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden md:flex h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] border-gray-100 hover:bg-gray-50 gap-2" onClick={() => setCurrentView('reports')}>
            <Download className="size-4" /> Export Audit
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100 flex gap-2" onClick={() => setCurrentView('payments')}>
            <Plus className="size-4" /> Record Payment
          </Button>
        </div>
      </motion.div>

      {/* Strategic Financial Kpis */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Realized Revenue" value={`₦${(overview.realizedRevenue || 0).toLocaleString()}`} icon={Landmark} iconBgColor="bg-emerald-50" iconColor="text-emerald-700" changeLabel="Current Term" />
        <KpiCard title="Efficiency" value={`${performance.collectionPercentage}%`} icon={TrendingUp} iconBgColor="bg-indigo-50" iconColor="text-indigo-700" changeLabel="Realization Rate" />
        <KpiCard title="Outstanding" value={`₦${(performance.totalOutstanding || 0).toLocaleString()}`} icon={Banknote} iconBgColor="bg-amber-50" iconColor="text-amber-700" changeLabel="Pending Fees" />
        <KpiCard title="Verified Invoices" value={overview.verifiedCount?.toString() || '0'} icon={CheckCircle2} iconBgColor="bg-blue-50" iconColor="text-blue-700" changeLabel="Transactions" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Revenue Velocity Chart */}
        <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="border-b bg-gray-50/20 py-6">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  <BarChart3 className="size-6 text-indigo-500" />
                  Collection Momentum
                </CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Realized revenue vs Term targets across grades</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white/50 border-gray-100 text-[10px] font-black uppercase tracking-widest px-4 h-8 rounded-xl">TERM 2 SUMMARY</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[350px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byGrade}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="grade" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="collected" fill="#6366f1" radius={[10, 10, 0, 0]} name="Collected" />
                  <Bar dataKey="target" fill="#e2e8f0" radius={[10, 10, 0, 0]} name="Target" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Global Realization (RESTORED PREMIUM PIE) */}
        <Card className="lg:col-span-4 border-none shadow-sm bg-gradient-to-br from-indigo-800 to-indigo-950 text-white overflow-hidden relative">
          <div className="absolute -right-20 -bottom-20 opacity-10">
             <PieChartIcon className="size-64" />
          </div>
          <CardHeader className="p-8 pb-4 relative z-10">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <Sparkles className="size-5 text-amber-500" /> Fiscal Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 relative z-10">
             <div className="h-[250px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie
                        data={[
                           { name: 'Collected', value: overview.realizedRevenue || 0 },
                           { name: 'Pending', value: performance.totalOutstanding || 0 }
                        ]}
                        innerRadius={80}
                        outerRadius={105}
                        paddingAngle={5}
                        dataKey="value"
                      >
                         <Cell fill="#10B981" />
                         <Cell fill="rgba(255,255,255,0.1)" />
                      </Pie>
                   </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <p className="text-4xl font-black text-white">{performance.collectionPercentage}%</p>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Realized</p>
                </div>
             </div>
             <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                   <div className="flex items-center gap-2">
                      <div className="size-2.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Realized</span>
                   </div>
                   <span className="text-sm font-black text-white">₦{overview.realizedRevenue?.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                   <div className="flex items-center gap-2">
                      <div className="size-2.5 rounded-full bg-white/20" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Expected</span>
                   </div>
                   <span className="text-sm font-black text-white">₦{overview.totalTarget?.toLocaleString()}</span>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Transaction Ledger (RESTORED PREMIUM COMPONENT) */}
        <Card className="lg:col-span-8 border-none shadow-sm">
          <CardHeader className="pb-4 border-b border-gray-50 p-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <History className="size-5 text-indigo-500" /> Transaction Ledger
              </CardTitle>
              <CardDescription className="text-xs font-medium">Monitoring recently recorded school fees</CardDescription>
            </div>
            <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-gray-100 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50">Filter Status</Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {recentPayments.length > 0 ? recentPayments.map((payment: any, i: number) => (
                <motion.div whileHover={{ scale: 1.01, x: 5 }} key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-gray-50 bg-white shadow-sm hover:border-indigo-100 transition-all group">
                  <div className="flex items-center gap-4">
                     <div className={cn(
                       "size-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-transform group-hover:scale-110",
                       payment.status === 'verified' ? "bg-emerald-500" : payment.status === 'pending' ? "bg-amber-500" : "bg-rose-500"
                     )}>
                        <CreditCard className="size-6" />
                     </div>
                     <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">{payment.student?.user?.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{payment.method} · {payment.term?.name}</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="text-right">
                        <p className="text-lg font-black text-gray-900">₦{payment.amount.toLocaleString()}</p>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(payment.createdAt).toLocaleDateString()}</p>
                     </div>
                     <Badge className={cn(
                       "font-black uppercase tracking-widest text-[9px] h-9 px-5 rounded-xl shadow-sm",
                       payment.status === 'verified' ? "bg-emerald-50 text-emerald-700 border-emerald-100/50" : "bg-amber-50 text-amber-700 border-amber-100/50"
                     )}>
                        {payment.status}
                     </Badge>
                  </div>
                </motion.div>
              )) : (
                <div className="py-20 text-center opacity-30 flex flex-col items-center">
                   <Search className="size-12 mb-4 text-gray-300" />
                   <p className="font-black uppercase tracking-[0.2em] text-[10px]">No transaction history found</p>
                </div>
              )}
            </div>
            <Button variant="ghost" className="w-full mt-6 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] text-gray-400 hover:text-indigo-600">View Global Registry</Button>
          </CardContent>
        </Card>

        {/* Financial Utilities */}
        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-sm h-full bg-gray-50/50 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5">
               <FileText className="size-48" />
             </div>
             <CardHeader className="p-8">
                <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
             </CardHeader>
             <CardContent className="p-8 pt-0 space-y-4">
                <Button className="w-full h-14 rounded-2xl bg-white border border-gray-100 shadow-sm text-gray-700 hover:bg-white hover:border-indigo-100 transition-all font-black uppercase text-[10px] tracking-widest justify-start px-6 gap-4">
                   <div className="size-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                      <ArrowUpRight className="size-4" />
                   </div>
                   Bulk Verification
                </Button>
                <Button className="w-full h-14 rounded-2xl bg-white border border-gray-100 shadow-sm text-gray-700 hover:bg-white hover:border-indigo-100 transition-all font-black uppercase text-[10px] tracking-widest justify-start px-6 gap-4">
                   <div className="size-8 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                      <FileText className="size-4" />
                   </div>
                   Unpaid Summary
                </Button>
                <Button className="w-full h-14 rounded-2xl bg-white border border-gray-100 shadow-sm text-gray-700 hover:bg-white hover:border-indigo-100 transition-all font-black uppercase text-[10px] tracking-widest justify-start px-6 gap-4">
                   <div className="size-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                      <History className="size-4" />
                   </div>
                   Audit Trail
                </Button>
             </CardContent>
           </Card>

           {/* Income Health */}
           <Card className="border-none shadow-sm">
             <CardHeader>
                <CardTitle className="text-base font-bold">Income Stability</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cash flow</span>
                      <span className="text-xs font-black text-emerald-600">+12%</span>
                   </div>
                   <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                   </div>
                   <p className="text-[10px] font-medium text-gray-400 text-center">Stable realization for current Term</p>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </motion.div>
  );
}
