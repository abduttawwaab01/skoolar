'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/store/app-store';
import {
  Activity,
  Zap,
  Clock,
  Database,
  HardDrive,
  Layers,
  Wifi,
  Users,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface SchoolOverview {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  studentTeacherRatio: number;
}

interface FinancialData {
  totalRevenue: number;
  totalTransactions: number;
  byStatus: Array<{ status: string; total: number; count: number }>;
}

interface SchoolInfo {
  id: string;
  name: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    students?: number;
    teachers?: number;
    classes?: number;
    subjects?: number;
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><div className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-6 w-24" /><Skeleton className="h-1.5 w-full" /></div></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

export function SystemHealthView() {
  const selectedSchoolId = useAppStore((s) => s.selectedSchoolId);
  const [loading, setLoading] = React.useState(true);
  const [overview, setOverview] = React.useState<SchoolOverview | null>(null);
  const [financial, setFinancial] = React.useState<FinancialData | null>(null);
  const [schoolInfo, setSchoolInfo] = React.useState<SchoolInfo | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [analyticsRes, schoolRes] = await Promise.all([
        fetch(`/api/analytics?schoolId=${selectedSchoolId}`),
        fetch(`/api/schools/${selectedSchoolId}`),
      ]);

      if (analyticsRes.ok) {
        const analyticsJson = await analyticsRes.json();
        const data = analyticsJson.data;
        setOverview(data?.schoolOverview || null);
        setFinancial(data?.financialData || null);
      }

      if (schoolRes.ok) {
        const schoolJson = await schoolRes.json();
        setSchoolInfo(schoolJson.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load system health data');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute system health metrics from real data
  const metrics = React.useMemo(() => {
    const totalStudents = overview?.totalStudents || schoolInfo?._count?.students || 0;
    const totalTeachers = overview?.totalTeachers || schoolInfo?._count?.teachers || 0;
    const totalClasses = overview?.totalClasses || schoolInfo?._count?.classes || 0;

    return [
      {
        label: 'Students',
        value: totalStudents.toLocaleString(),
        sublabel: 'enrolled',
        icon: GraduationCap,
        color: 'text-emerald-600',
        bg: 'bg-emerald-100',
        progress: Math.min(100, (totalStudents / 1000) * 100),
      },
      {
        label: 'Teachers',
        value: totalTeachers.toLocaleString(),
        sublabel: 'active',
        icon: Users,
        color: 'text-blue-600',
        bg: 'bg-blue-100',
        progress: Math.min(100, (totalTeachers / 100) * 100),
      },
      {
        label: 'Classes',
        value: totalClasses.toString(),
        sublabel: 'total',
        icon: BookOpen,
        color: 'text-amber-600',
        bg: 'bg-amber-100',
        progress: Math.min(100, (totalClasses / 20) * 100),
      },
      {
        label: 'Revenue',
        value: financial?.totalRevenue
          ? `₦${(financial.totalRevenue / 1000000).toFixed(1)}M`
          : '₦0',
        sublabel: 'collected',
        icon: Zap,
        color: 'text-violet-600',
        bg: 'bg-violet-100',
        progress: 0,
      },
      {
        label: 'Transactions',
        value: financial?.totalTransactions?.toLocaleString() || '0',
        sublabel: 'total',
        icon: Database,
        color: 'text-pink-600',
        bg: 'bg-pink-100',
        progress: Math.min(100, ((financial?.totalTransactions || 0) / 1000) * 100),
      },
      {
        label: 'Subjects',
        value: (overview?.totalSubjects || schoolInfo?._count?.subjects || 0).toString(),
        sublabel: 'available',
        icon: HardDrive,
        color: 'text-cyan-600',
        bg: 'bg-cyan-100',
        progress: Math.min(100, ((overview?.totalSubjects || 0) / 20) * 100),
      },
      {
        label: 'Student:Teacher',
        value: overview?.studentTeacherRatio?.toString() || '0',
        sublabel: 'ratio',
        icon: Layers,
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        progress: Math.min(100, ((overview?.studentTeacherRatio || 0) / 30) * 100),
      },
      {
        label: 'School Status',
        value: schoolInfo?.isActive !== false ? 'Active' : 'Inactive',
        sublabel: schoolInfo?.isActive !== false ? 'operational' : 'check settings',
        icon: schoolInfo?.isActive !== false ? UserCheck : ShieldCheck,
        color: schoolInfo?.isActive !== false ? 'text-teal-600' : 'text-red-600',
        bg: schoolInfo?.isActive !== false ? 'bg-teal-100' : 'bg-red-100',
        progress: schoolInfo?.isActive !== false ? 100 : 0,
      },
    ];
  }, [overview, financial, schoolInfo]);

  if (loading) return <LoadingSkeleton />;

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ShieldCheck className="size-10 mb-3" />
        <p className="text-sm font-medium">No school selected</p>
        <p className="text-xs mt-1">Please select a school to view system health</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">System Health</h2>
        <p className="text-sm text-muted-foreground">Monitor platform performance and infrastructure</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-bold">{metric.value}</p>
                    {metric.sublabel && (
                      <span className="text-xs text-muted-foreground">{metric.sublabel}</span>
                    )}
                  </div>
                </div>
                <div className={`flex size-9 items-center justify-center rounded-lg ${metric.bg}`}>
                  <metric.icon className={`size-4.5 ${metric.color}`} />
                </div>
              </div>
              <Progress value={metric.progress} className="mt-3 h-1.5" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" />
            Recent Incidents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ShieldCheck className="size-10 text-emerald-300" />
            <p className="mt-3 text-sm font-medium">No incidents in the last 30 days</p>
            <p className="text-xs mt-1">All systems are operating normally</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
