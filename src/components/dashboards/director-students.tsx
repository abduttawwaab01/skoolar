'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { Users, GraduationCap, UserCheck, UserX, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StudentRecord {
  id: string;
  name: string;
  className: string;
  gender: string | null;
  isActive: boolean;
}

interface ClassCount {
  name: string;
  count: number;
}

export default function DirectorStudents() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRecord[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const fetchStudents = async () => {
      try {
        const res = await fetch(`/api/students?schoolId=${schoolId}&limit=1000`);
        if (res.ok) {
          const json = await res.json();
          const data: { id: string; user: { name: string }; class: { name: string } | null; gender: string | null; isActive: boolean }[] = json.data || json || [];
          setStudents(data.map(s => ({
            id: s.id,
            name: s.user?.name || '',
            className: s.class?.name || 'Unassigned',
            gender: s.gender,
            isActive: s.isActive,
          })));
        }
      } catch {
        toast.error('Failed to load student data');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [schoolId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const active = students.filter(s => s.isActive);
  const inactive = students.filter(s => !s.isActive);
  const male = students.filter(s => s.gender === 'male' || s.gender === 'M');
  const female = students.filter(s => s.gender === 'female' || s.gender === 'F');

  const classDistribution: ClassCount[] = Object.entries(
    students.reduce<Record<string, number>>((acc, s) => {
      acc[s.className] = (acc[s.className] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Student Overview</h1>
        <p className="text-muted-foreground">High-level view of student population</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="size-4" /> Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{students.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><UserCheck className="size-4 text-emerald-600" /> Active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{active.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><UserX className="size-4 text-red-600" /> Inactive</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{inactive.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><GraduationCap className="size-4 text-blue-600" /> Classes</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{classDistribution.length}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Students per Class</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} name="Students" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Gender Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1"><span>Male</span><span className="font-semibold">{male.length} ({(male.length / students.length * 100 || 0).toFixed(1)}%)</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(male.length / students.length * 100) || 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1"><span>Female</span><span className="font-semibold">{female.length} ({(female.length / students.length * 100 || 0).toFixed(1)}%)</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(female.length / students.length * 100) || 0}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {classDistribution.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Class Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {classDistribution.map(c => (
                <div key={c.name} className="flex items-center justify-between rounded-lg border px-4 py-2 flex-wrap gap-4">
                  <span className="text-sm font-medium">{c.name}</span>
                  <Badge variant="secondary">{c.count} students</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
