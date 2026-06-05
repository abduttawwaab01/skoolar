'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { CalendarCheck, TrendingUp, AlertTriangle, Clock, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface AttendanceSummary {
  classId: string;
  className: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

export default function DirectorAttendance() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const fetchData = async () => {
      try {
        const [classesRes, attendanceRes] = await Promise.all([
          fetch(`/api/classes?schoolId=${schoolId}&limit=50`),
          fetch(`/api/attendance?schoolId=${schoolId}&limit=5000`),
        ]);
        const classesJson = await classesRes.json();
        const classes: { id: string; name: string }[] = Array.isArray(classesJson.data) ? classesJson.data : [];

        const attJson = await attendanceRes.json();
        const records: { studentId: string; status: string; classId: string }[] = attJson.data || attJson || [];

        // Build per-class summary
        const perClass: Record<string, { total: number; present: number; absent: number; late: number }> = {};
        records.forEach(r => {
          if (!perClass[r.classId]) perClass[r.classId] = { total: 0, present: 0, absent: 0, late: 0 };
          perClass[r.classId].total++;
          if (r.status === 'present') perClass[r.classId].present++;
          else if (r.status === 'absent') perClass[r.classId].absent++;
          else if (r.status === 'late') perClass[r.classId].late++;
        });

        const summaries: AttendanceSummary[] = Object.entries(perClass).map(([classId, stats]) => {
          const cls = classes.find(c => c.id === classId);
          return {
            classId,
            className: cls?.name || classId,
            ...stats,
            percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
          };
        }).sort((a, b) => a.percentage - b.percentage);

        setSummaries(summaries);
      } catch {
        toast.error('Failed to load attendance data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId]);

  const overallStats = useMemo(() => {
    const total = summaries.reduce((s, c) => s + c.total, 0);
    const present = summaries.reduce((s, c) => s + c.present, 0);
    const absent = summaries.reduce((s, c) => s + c.absent, 0);
    const late = summaries.reduce((s, c) => s + c.late, 0);
    return {
      total,
      present,
      absent,
      late,
      rate: total > 0 ? ((present / total) * 100).toFixed(1) : '0',
    };
  }, [summaries]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance Overview</h1>
        <p className="text-muted-foreground">Monitor attendance rates across all classes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CalendarCheck className="size-4 text-blue-600" /> Records</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overallStats.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="size-4 text-emerald-600" /> Present</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{overallStats.present}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="size-4 text-red-600" /> Absent</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{overallStats.absent}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Clock className="size-4 text-purple-600" /> Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overallStats.rate}%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Attendance Rate by Class</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={summaries} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis dataKey="className" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(value: number) => `${value}%`} />
              <Bar dataKey="percentage" fill="#059669" radius={[0, 4, 4, 0]} name="Attendance %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {summaries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Class Details</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summaries.map(s => (
                <div key={s.classId} className="flex items-center justify-between flex-wrap gap-4 rounded-lg border px-4 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.className}</p>
                    <p className="text-xs text-muted-foreground">{s.total} records</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-emerald-600 font-medium">{s.present} present</span>
                    <span className="text-xs text-red-600 font-medium">{s.absent} absent</span>
                    <span className="text-xs text-amber-600 font-medium">{s.late} late</span>
                    <Badge variant={s.percentage >= 80 ? 'default' : s.percentage >= 60 ? 'secondary' : 'destructive'}>
                      {s.percentage}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
