'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { SafeFormattedDate } from '@/components/shared/safe-formatted-date';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  Building2, Users, GraduationCap, TrendingUp, ShieldCheck, UserPlus, Key,
  Activity, Clock, Database, HardDrive, Server, Zap, Globe,
  Plus, BarChart3, Eye, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2, Info, XCircle, RefreshCw
} from 'lucide-react';

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  address: string | null;
  motto: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primaryColor: string;
  secondaryColor: string;
  region: string | null;
  plan: string;
  isActive: boolean;
  maxStudents: number;
  maxTeachers: number;
  foundedDate: string | null;
  createdAt: string;
  _count: { students: number; teachers: number; classes: number };
}

interface RegistrationCodeRecord {
  id: string;
  code: string;
  plan: string;
  region: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isUsed: boolean;
  schoolId: string | null;
  school: { id: string; name: string } | null;
  createdBy: string | null;
  createdAt: string;
}

interface AuditLogRecord {
  id: string;
  user: { id: string; name: string; email: string; role: string } | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string | null;
  isRead: boolean;
  createdAt: string;
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

export function SuperAdminDashboard() {
  const { setCurrentView, currentUser } = useAppStore();
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [registrationCodes, setRegistrationCodes] = useState<RegistrationCodeRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  // Loading states
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  // Error states
  const [errorSchools, setErrorSchools] = useState<string | null>(null);
  const [errorCodes, setErrorCodes] = useState<string | null>(null);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);
  const [errorNotifs, setErrorNotifs] = useState<string | null>(null);

  const fetchSchools = useCallback(async () => {
    try {
      setLoadingSchools(true);
      setErrorSchools(null);
      const res = await fetch('/api/schools?limit=50');
      if (!res.ok) throw new Error('Failed to fetch schools');
      const json = await res.json();
      setSchools(json.data || []);
    } catch (err) {
      setErrorSchools(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to load schools');
    } finally {
      setLoadingSchools(false);
    }
  }, []);

  const fetchCodes = useCallback(async () => {
    try {
      setLoadingCodes(true);
      setErrorCodes(null);
      const res = await fetch('/api/registration-codes?limit=20');
      if (!res.ok) throw new Error('Failed to fetch registration codes');
      const json = await res.json();
      setRegistrationCodes(json.data || []);
    } catch (err) {
      setErrorCodes(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to load registration codes');
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      setErrorLogs(null);
      const res = await fetch('/api/audit-logs?limit=10');
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const json = await res.json();
      setAuditLogs(json.data || []);
    } catch (err) {
      setErrorLogs(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to load audit logs');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      setErrorNotifs(null);
      const params = new URLSearchParams();
      if (currentUser?.id) params.set('userId', currentUser.id);
      params.set('limit', '10');
      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const json = await res.json();
      setNotifications(json.data || []);
    } catch (err) {
      setErrorNotifs(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to load notifications');
    } finally {
      setLoadingNotifs(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchSchools();
    fetchCodes();
    fetchLogs();
    fetchNotifications();
  }, [fetchSchools, fetchCodes, fetchLogs, fetchNotifications]);

  const isLoading = loadingSchools || loadingCodes || loadingLogs || loadingNotifs;
  const hasError = errorSchools || errorCodes || errorLogs || errorNotifs;

  if (isLoading && schools.length === 0) return <DashboardSkeleton />;
  if (hasError && schools.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
            <p className="text-muted-foreground">Monitor all schools and system health across the Skoolar platform</p>
          </div>
        </div>
        <ErrorState message={errorSchools || errorCodes || errorLogs || errorNotifs || 'Unknown error'} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  // Computed values
  const totalStudents = schools.reduce((a, s) => a + (s._count?.students || 0), 0);
  const totalTeachers = schools.reduce((a, s) => a + (s._count?.teachers || 0), 0);

  const planBadge = (plan: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'outline'; className: string }> = {
      enterprise: { variant: 'default', className: 'bg-emerald-600 text-white' },
      pro: { variant: 'default', className: 'bg-blue-600 text-white' },
      basic: { variant: 'secondary', className: '' },
    };
    const p = map[plan] || map.basic;
    return <Badge variant={p.variant} className={p.className}>{plan}</Badge>;
  };

  const quickActions = [
    { label: 'Create School', icon: Plus, view: 'schools' as const, color: 'bg-emerald-100 text-emerald-700', desc: 'Register new school' },
    { label: 'Generate Code', icon: Key, view: 'registration-codes' as const, color: 'bg-blue-100 text-blue-700', desc: 'Create registration code' },
    { label: 'View Analytics', icon: BarChart3, view: 'analytics' as const, color: 'bg-purple-100 text-purple-700', desc: 'Global analytics' },
    { label: 'System Health', icon: Activity, view: 'system-health' as const, color: 'bg-amber-100 text-amber-700', desc: 'Monitor platform' },
    { label: 'Compare Schools', icon: Eye, view: 'school-comparison' as const, color: 'bg-cyan-100 text-cyan-700', desc: 'Side-by-side' },
    { label: 'Audit Logs', icon: Eye, view: 'audit-logs' as const, color: 'bg-pink-100 text-pink-700', desc: 'View activity' },
  ];

  // Visual bar chart data - calculated from real school data
  const maxStudentCount = Math.max(...schools.map(s => s._count?.students || 0), 1);

  // Calculate revenue from registration codes (each code has a plan)
  // Default plan prices - these should come from subscription settings API in production
  const defaultPlanPrices: Record<string, number> = { enterprise: 0, pro: 0, basic: 0 };
  const revenueByPlan: Record<string, number> = {};
  registrationCodes.forEach(code => {
    revenueByPlan[code.plan] = (revenueByPlan[code.plan] || 0) + (code.usedCount * (defaultPlanPrices[code.plan] || 0));
  });
  const totalRevenue = Object.values(revenueByPlan).reduce((a, b) => a + b, 0);
  
  // Revenue data - dynamic months based on current date
  const currentMonth = new Date().getMonth();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const revenueBars = registrationCodes.slice(0, 7).map((code, idx) => {
    const monthIndex = (currentMonth - 6 + idx + 12) % 12;
    return {
      month: monthNames[monthIndex],
      value: code.usedCount * (defaultPlanPrices[code.plan] || 0)
    };
  });
  const maxRevenue = Math.max(...revenueBars.map(r => r.value), 1);

  // System status items - derived from real data
  const activeSchools = schools.filter(s => s.isActive).length;
  const systemStatusItems: Array<{ label: string; status: 'healthy' | 'warning'; detail: string }> = [
    { label: 'Active Schools', status: activeSchools > 0 ? 'healthy' : 'warning', detail: `${activeSchools} active` },
    { label: 'Total Schools', status: schools.length > 0 ? 'healthy' : 'warning', detail: `${schools.length} registered` },
    { label: 'Registration Codes', status: registrationCodes.filter(c => !c.isUsed).length > 0 ? 'healthy' : 'warning', detail: `${registrationCodes.filter(c => !c.isUsed).length} available` },
    { label: 'Audit Logs', status: auditLogs.length > 0 ? 'healthy' : 'warning', detail: `${auditLogs.length} recent` },
    { label: 'Notifications', status: notifications.filter(n => !n.isRead).length > 0 ? 'warning' : 'healthy', detail: `${notifications.filter(n => !n.isRead).length} unread` },
    { label: 'Recent Activity', status: auditLogs.length > 0 ? 'healthy' : 'warning', detail: `${auditLogs.length} logged` },
  ];

  // System health - derived from real data only, no hardcoded values
  const systemHealth = {
    activeUsers: totalStudents + totalTeachers,
    totalSchools: schools.length,
    totalCodes: registrationCodes.length,
    usedCodes: registrationCodes.filter(c => c.isUsed).length,
    uptime: null as number | null,
    apiRequests: null as number | null,
    avgResponseTime: null as number | null,
    databaseSize: null as string | null,
    storageUsed: null as number | null,
    websocketConnections: null as number | null,
    queuedJobs: null as number | null,
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground">Monitor all schools and system health across the Skoolar platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(
            "gap-1 text-sm py-1",
            activeSchools > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
          )}>
            <span className="relative flex size-2">
              <span className={cn("absolute inset-0 rounded-full animate-ping opacity-75", activeSchools > 0 ? "bg-emerald-400" : "bg-amber-400")} />
              <span className={cn("relative rounded-full size-2", activeSchools > 0 ? "bg-emerald-500" : "bg-amber-500")} />
            </span>
            {activeSchools > 0 ? 'Platform Active' : 'No Active Schools'}
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Total Schools" value={schools.length} icon={Building2} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" changeLabel="registered" />
        <KpiCard title="Active Users" value={totalStudents.toLocaleString()} icon={GraduationCap} iconBgColor="bg-blue-100" iconColor="text-blue-600" changeLabel="students" />
        <KpiCard title="Teachers" value={totalTeachers} icon={Users} iconBgColor="bg-purple-100" iconColor="text-purple-600" changeLabel="registered" />
        <KpiCard title="Platform Revenue" value={`₦${(totalRevenue / 1000000).toFixed(1)}M`} icon={TrendingUp} iconBgColor="bg-amber-100" iconColor="text-amber-600" changeLabel="total revenue" />
        <KpiCard title="Registration Codes" value={registrationCodes.length} icon={Key} iconBgColor="bg-green-100" iconColor="text-green-600" changeLabel="total codes" />
        <KpiCard title="Active Now" value={String(systemHealth.activeUsers)} icon={UserPlus} iconBgColor="bg-cyan-100" iconColor="text-cyan-600" changeLabel="users online" />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* School Growth Chart - CSS Based */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">School Student Growth</CardTitle>
                    <CardDescription>Students enrolled per school</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5"><div className="size-2.5 rounded bg-emerald-500" /> Students</div>
                    <div className="flex items-center gap-1.5"><div className="size-2.5 rounded bg-purple-500" /> Teachers</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSchools ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : schools.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No schools found</p>
                ) : (
                  <div className="space-y-4">
                    {schools.map(school => (
                      <div key={school.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[140px]">{school.name.split(' ')[0]}</span>
                          <span className="text-muted-foreground">{(school._count?.students || 0).toLocaleString()} students</span>
                        </div>
                        <div className="flex gap-1 h-5">
                          <div
                            className="bg-emerald-500 rounded-sm transition-all duration-500 hover:bg-emerald-600 cursor-pointer"
                            style={{ width: `${((school._count?.students || 0) / maxStudentCount) * 75}%` }}
                            title={`${school._count?.students || 0} students`}
                          />
                          <div
                            className="bg-purple-500 rounded-sm transition-all duration-500 hover:bg-purple-600 cursor-pointer"
                            style={{ width: `${((school._count?.teachers || 0) / maxStudentCount) * 75}%` }}
                            title={`${school._count?.teachers || 0} teachers`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Health Grid */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">System Health</CardTitle>
                    <CardDescription>Platform performance metrics</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('system-health')}>Details</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Uptime bar */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-100 text-emerald-600">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Platform Uptime</p>
                      <p className="text-xs text-muted-foreground">Last 30 days</p>
                    </div>
                    <span className="text-lg font-bold text-emerald-600">{systemHealth.uptime}%</span>
                  </div>
                  {/* Health items */}
                  {systemStatusItems.map(item => (
                    <div key={item.label} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className={`flex items-center justify-center size-8 rounded-lg ${item.status === 'healthy' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {item.status === 'healthy' ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <StatusBadge variant={item.status === 'healthy' ? 'success' : 'warning'} size="sm">
                        {item.status}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Trend + Quick Actions */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Revenue Trend - CSS Bars */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Monthly Revenue Trend</CardTitle>
                    <CardDescription>Platform revenue over the past 7 months</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {['7d', '30d', '90d'].map(p => (
                      <Button key={p} variant={selectedPeriod === p ? 'default' : 'outline'} size="sm" className="text-xs h-7 px-2.5" onClick={() => setSelectedPeriod(p)}>
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 h-48">
                  {revenueBars.map((bar, i) => (
                    <div key={bar.month} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-semibold">₦{(bar.value / 10).toFixed(0)}M</span>
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 hover:opacity-80 cursor-pointer ${i === revenueBars.length - 1 ? 'bg-emerald-500' : 'bg-emerald-300 dark:bg-emerald-700'}`}
                        style={{ height: `${(bar.value / maxRevenue) * 100}%` }}
                        title={`${bar.month}: ₦${(bar.value / 10).toFixed(0)}M`}
                      />
                      <span className="text-xs text-muted-foreground">{bar.month}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map(action => (
                    <Button key={action.label} variant="outline" className="h-auto flex-col gap-2 py-3 px-2 hover:bg-accent" onClick={() => setCurrentView(action.view)}>
                      <div className={`size-8 rounded-lg flex items-center justify-center ${action.color}`}>
                        <action.icon className="size-4" />
                      </div>
                      <span className="text-xs font-medium text-center">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schools Tab */}
        <TabsContent value="schools" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Registered Schools</CardTitle>
                    <CardDescription>{schools.length} schools on the platform</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setCurrentView('registration-codes')}>
                    <Key className="size-3.5 mr-1.5" /> New Code
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSchools ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">School</th>
                            <th className="pb-2 font-medium">Region</th>
                            <th className="pb-2 font-medium">Plan</th>
                            <th className="pb-2 font-medium hidden sm:table-cell">Students</th>
                            <th className="pb-2 font-medium hidden md:table-cell">Capacity</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schools.map(school => (
                            <tr key={school.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setCurrentView('schools')}>
                              <td className="py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: school.primaryColor }}>
                                    {school.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{school.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{school.address}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 text-muted-foreground">{school.region}</td>
                              <td className="py-3">{planBadge(school.plan)}</td>
                              <td className="py-3 hidden sm:table-cell">{(school._count?.students || 0).toLocaleString()}</td>
                              <td className="py-3 hidden md:table-cell">
                                <div className="flex items-center gap-2">
                                  <Progress value={school.maxStudents > 0 ? ((school._count?.students || 0) / school.maxStudents) * 100 : 0} className="h-1.5 w-16" />
                                  <span className="text-xs text-muted-foreground">{school.maxStudents > 0 ? Math.round(((school._count?.students || 0) / school.maxStudents) * 100) : 0}%</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <StatusBadge variant={school.isActive ? 'success' : 'error'} pulse={school.isActive}>
                                  {school.isActive ? 'Active' : 'Inactive'}
                                </StatusBadge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Registration Codes Summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Registration Codes</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('registration-codes')}>View all</Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCodes ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                        <p className="text-lg font-bold text-emerald-600">{registrationCodes.length}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <p className="text-lg font-bold text-blue-600">{registrationCodes.filter(c => c.isUsed).length}</p>
                        <p className="text-[10px] text-muted-foreground">Used</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                        <p className="text-lg font-bold text-amber-600">{registrationCodes.filter(c => !c.isUsed).length}</p>
                        <p className="text-[10px] text-muted-foreground">Available</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {registrationCodes.map(code => (
                        <div key={code.id} className="flex items-center justify-between rounded-lg border p-2.5">
                          <div>
                            <p className="text-xs font-mono font-medium">{code.code}</p>
                            <p className="text-[10px] text-muted-foreground">{code.plan} plan</p>
                          </div>
                          <StatusBadge variant={code.isUsed ? 'success' : 'info'} size="sm">
                            {code.isUsed ? 'Used' : 'Open'}
                          </StatusBadge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { label: 'API Requests Today', value: systemHealth.apiRequests != null ? systemHealth.apiRequests.toLocaleString() : 'N/A', icon: Zap, color: 'text-blue-600', bg: 'bg-blue-100' },
              { label: 'Avg Response Time', value: systemHealth.avgResponseTime != null ? `${systemHealth.avgResponseTime}ms` : 'N/A', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-100' },
              { label: 'Database Size', value: systemHealth.databaseSize ?? 'N/A', icon: Database, color: 'text-purple-600', bg: 'bg-purple-100' },
              { label: 'Storage Used', value: systemHealth.storageUsed != null ? `${systemHealth.storageUsed}%` : 'N/A', icon: HardDrive, color: 'text-amber-600', bg: 'bg-amber-100' },
              { label: 'WebSocket Conns', value: systemHealth.websocketConnections != null ? String(systemHealth.websocketConnections) : 'N/A', icon: Globe, color: 'text-cyan-600', bg: 'bg-cyan-100' },
              { label: 'Queued Jobs', value: systemHealth.queuedJobs != null ? String(systemHealth.queuedJobs) : 'N/A', icon: Server, color: 'text-orange-600', bg: 'bg-orange-100' },
              { label: 'Active Users Now', value: String(systemHealth.activeUsers), icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100' },
              { label: 'Uptime (30d)', value: `${systemHealth.uptime}%`, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-100' },
            ] as const).map(item => (
              <Card key={item.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center size-10 rounded-lg ${item.bg} ${item.color}`}>
                      <item.icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-lg font-bold">{item.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent Activity + Recent Notifications */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('audit-logs')}>View all</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              <ScrollArea className="max-h-[320px]">
                <div className="space-y-3">
                  {auditLogs.slice(0, 8).map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={`mt-0.5 size-8 rounded-full flex items-center justify-center shrink-0 ${
                        log.action === 'create' ? 'bg-emerald-100 text-emerald-600' :
                        log.action === 'update' ? 'bg-blue-100 text-blue-600' :
                        log.action === 'export' ? 'bg-purple-100 text-purple-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {log.action === 'create' ? <Plus className="size-3.5" /> :
                         log.action === 'update' ? <ArrowUpRight className="size-3.5" /> :
                         log.action === 'export' ? <ArrowDownRight className="size-3.5" /> :
                         <Info className="size-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{log.details || log.action}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{log.user?.name || 'System'}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <SafeFormattedDate date={log.createdAt} className="text-xs text-muted-foreground" />
                          <Badge variant="outline" className="text-[10px] h-4">{log.entity}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Notifications</CardTitle>
              {unreadCount > 0 && <Badge variant="destructive" className="text-xs">{unreadCount} new</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {loadingNotifs ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
            ) : (
              <ScrollArea className="max-h-[320px]">
                <div className="space-y-3">
                  {notifications.slice(0, 6).map(notif => (
                    <div key={notif.id} className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${!notif.isRead ? 'bg-blue-50/30 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900' : ''}`}>
                      <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                        notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                        notif.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {notif.type === 'success' ? <CheckCircle2 className="size-3.5" /> :
                         notif.type === 'warning' ? <AlertTriangle className="size-3.5" /> :
                         <Info className="size-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{notif.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{notif.message}</p>
                        <SafeFormattedDate date={notif.createdAt} className="text-[10px] text-muted-foreground mt-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
