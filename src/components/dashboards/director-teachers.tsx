'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { Users, BookUser, BookOpen, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TeacherRecord {
  id: string;
  name: string;
  email: string | null;
  employeeNo: string;
  specialization: string | null;
  qualification: string | null;
  isActive: boolean;
  classesCount: number;
  classSubjects: number;
}

interface SpecializationCount {
  name: string;
  count: number;
}

export default function DirectorTeachers() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const fetchTeachers = async () => {
      try {
        const res = await fetch(`/api/teachers?schoolId=${schoolId}&limit=500`);
        if (res.ok) {
          const json = await res.json();
          const data: { id: string; userId: string; name: string; email: string | null; employeeNo: string; specialization: string | null; qualification: string | null; isActive: boolean; classesCount: number; classSubjects: number }[] = json.data || json || [];
          setTeachers(data.map(t => ({
            id: t.id,
            name: t.name,
            email: t.email,
            employeeNo: t.employeeNo,
            specialization: t.specialization,
            qualification: t.qualification,
            isActive: t.isActive,
            classesCount: t.classesCount,
            classSubjects: t.classSubjects,
          })));
        }
      } catch {
        toast.error('Failed to load teacher data');
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, [schoolId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const active = teachers.filter(t => t.isActive);
  const totalClasses = teachers.reduce((sum, t) => sum + t.classesCount, 0);
  const totalSubjects = teachers.reduce((sum, t) => sum + t.classSubjects, 0);

  const specDistribution: SpecializationCount[] = Object.entries(
    teachers.reduce<Record<string, number>>((acc, t) => {
      const spec = t.specialization || 'General';
      acc[spec] = (acc[spec] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teacher Overview</h1>
        <p className="text-muted-foreground">High-level view of teaching staff</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="size-4" /> Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{teachers.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BookUser className="size-4 text-emerald-600" /> Active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{active.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BookOpen className="size-4 text-blue-600" /> Classes</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalClasses}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Star className="size-4 text-purple-600" /> Subjects</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalSubjects}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Teachers by Specialization</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={specDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Teachers" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Qualification Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(
                teachers.reduce<Record<string, number>>((acc, t) => {
                  const q = t.qualification || 'Not specified';
                  acc[q] = (acc[q] || 0) + 1;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).map(([qual, count]) => (
                <div key={qual} className="flex items-center justify-between flex-wrap gap-4 rounded-lg border px-4 py-2">
                  <span className="text-sm font-medium">{qual}</span>
                  <Badge variant="secondary">{count} teacher{count !== 1 ? 's' : ''}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Teaching Staff</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {teachers.map(t => (
              <div key={t.id} className="flex items-center justify-between flex-wrap gap-4 rounded-lg border px-4 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.specialization || 'General'} &middot; {t.employeeNo}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{t.classesCount} classes</Badge>
                  <Badge variant={t.isActive ? 'default' : 'destructive'} className="text-xs">{t.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
