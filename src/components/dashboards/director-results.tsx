'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { Award, TrendingUp, BarChart3, GraduationCap, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ClassPerformance {
  className: string;
  avgGpa: number;
  passRate: number;
  studentCount: number;
}

export default function DirectorResults() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [classData, setClassData] = useState<ClassPerformance[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/students?schoolId=${schoolId}&limit=1000`);
        if (res.ok) {
          const json = await res.json();
          const students: { id: string; gpa: number | null; class: { name: string } | null; user: { name: string } }[] = json.data || json || [];

          const perClass: Record<string, { gpas: number[]; total: number }> = {};
          students.forEach(s => {
            const cn = s.class?.name || 'Unassigned';
            if (!perClass[cn]) perClass[cn] = { gpas: [], total: 0 };
            perClass[cn].total++;
            if (s.gpa !== null && s.gpa !== undefined) perClass[cn].gpas.push(s.gpa);
          });

          const data: ClassPerformance[] = Object.entries(perClass)
            .map(([className, stats]) => {
              const avgGpa = stats.gpas.length > 0
                ? stats.gpas.reduce((a, b) => a + b, 0) / stats.gpas.length
                : 0;
              const passRate = stats.gpas.length > 0
                ? (stats.gpas.filter(g => g >= 2.0).length / stats.gpas.length) * 100
                : 0;
              return { className, avgGpa: Math.round(avgGpa * 100) / 100, passRate: Math.round(passRate), studentCount: stats.total };
            })
            .sort((a, b) => b.avgGpa - a.avgGpa);

          setClassData(data);
        }
      } catch {
        toast.error('Failed to load results data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId]);

  const overallStats = useMemo(() => {
    const total = classData.reduce((s, c) => s + c.studentCount, 0);
    const avgGpa = classData.length > 0
      ? classData.reduce((s, c) => s + c.avgGpa, 0) / classData.length
      : 0;
    const avgPassRate = classData.length > 0
      ? classData.reduce((s, c) => s + c.passRate, 0) / classData.length
      : 0;
    return { total, avgGpa: avgGpa.toFixed(2), avgPassRate: Math.round(avgPassRate) };
  }, [classData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid grid-cols-4 gap-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Academic Performance</h1>
        <p className="text-muted-foreground">Overview of student academic results across classes</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><GraduationCap className="size-4 text-blue-600" /> Students</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overallStats.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Award className="size-4 text-emerald-600" /> Avg GPA</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{overallStats.avgGpa}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="size-4 text-purple-600" /> Pass Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overallStats.avgPassRate}%</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BookOpen className="size-4 text-amber-600" /> Classes</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{classData.length}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Average GPA by Class</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="className" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="avgGpa" fill="#059669" radius={[4, 4, 0, 0]} name="Avg GPA" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pass Rate by Class</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="className" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Bar dataKey="passRate" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Pass Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Class Performance Details</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {classData.map(c => (
              <div key={c.className} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 rounded-lg border px-4 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.className}</p>
                  <p className="text-xs text-muted-foreground">{c.studentCount} students</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">GPA:</span>
                  <span className="text-sm font-semibold">{c.avgGpa}</span>
                  <Badge variant={c.passRate >= 80 ? 'default' : c.passRate >= 60 ? 'secondary' : 'destructive'}>
                    {c.passRate}% pass
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
