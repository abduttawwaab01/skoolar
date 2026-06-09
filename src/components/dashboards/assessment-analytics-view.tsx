'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { ExportMenu } from '@/components/shared/export-menu';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, Users, GraduationCap } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16'];

export function AssessmentAnalyticsView() {
  const { currentUser } = useAppStore();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const schoolId = currentUser.schoolId || '';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, studentRes, teacherRes, classRes] = await Promise.all([
        fetch(`/api/assessment-hub/analytics/overview?schoolId=${schoolId}`),
        fetch(`/api/students?schoolId=${schoolId}&limit=100`),
        fetch(`/api/teachers?schoolId=${schoolId}&limit=100`),
        fetch(`/api/classes?schoolId=${schoolId}`),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (studentRes.ok) { const d = await studentRes.json(); setStudents(d.data || []); }
      if (teacherRes.ok) { const d = await teacherRes.json(); setTeachers(d.data || []); }
      if (classRes.ok) setClasses(await classRes.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const domainDistribution = overview?.domainDistribution
    ? Object.entries(overview.domainDistribution).map(([key, value]) => ({
        name: key.replace(/_/g, ' '),
        value,
      }))
    : [];

  const typeDistribution = overview?.typeDistribution
    ? Object.entries(overview.typeDistribution).map(([key, value]) => ({
        name: key,
        count: value,
      }))
    : [];

  const exportData = useMemo(() => overview?.domainDistribution
    ? Object.entries(overview.domainDistribution).map(([key, value]) => ({ Domain: key.replace(/_/g, ' '), Score: `${value}%` }))
    : [], [overview]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assessment Analytics</h1>
          <p className="text-muted-foreground">Comprehensive analytics and insights</p>
        </div>
        {!loading && overview && (
          <ExportMenu options={{
            title: 'Assessment Hub Analytics',
            subtitle: 'Cross-domain assessment performance analysis',
            fileName: 'assessment-hub-analytics',
            columns: [{ header: 'Domain', key: 'Domain' }, { header: 'Score (%)', key: 'Score' }],
            data: exportData,
            summaryRows: [
              { label: 'Total Assessments', value: String(overview.totalAssessments ?? 0) },
              { label: 'Total Attempts', value: String(overview.totalAttempts ?? 0) },
              { label: 'Avg Score', value: `${overview.avgScore ?? 0}%` },
              { label: 'Completion Rate', value: `${overview.completionRate ?? 0}%` },
            ],
            sections: [
              { heading: 'Assessment Overview', content: [`${overview.totalAssessments ?? 0} total assessments created`, `${overview.totalAttempts ?? 0} total attempts recorded`, `Average score across all domains: ${overview.avgScore ?? 0}%`, `Completion rate: ${overview.completionRate ?? 0}%`] },
              ...(overview.domainDistribution ? [{ heading: 'Domain Performance', content: Object.entries(overview.domainDistribution).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}%`) }] : []),
            ],
          }} />
        )}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Assessments</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overview?.totalAssessments ?? 0}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Attempts</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overview?.totalAttempts ?? 0}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Avg. Score</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overview?.avgScore ?? 0}%</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Completion Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overview?.completionRate ?? 0}%</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Domain Distribution</CardTitle><CardDescription>Score distribution across domains</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={domainDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Assessment Type Distribution</CardTitle><CardDescription>Breakdown by assessment type</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={typeDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, count }) => `${name}: ${count}`}>
                      {typeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detailed Analysis</CardTitle>
              <CardDescription>Select a student, teacher, or class for detailed analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="student">
                <TabsList>
                  <TabsTrigger value="student"><GraduationCap className="h-4 w-4 mr-2" /> Student</TabsTrigger>
                  <TabsTrigger value="teacher"><Users className="h-4 w-4 mr-2" /> Teacher</TabsTrigger>
                  <TabsTrigger value="class"><BarChart3 className="h-4 w-4 mr-2" /> Class</TabsTrigger>
                </TabsList>
                <TabsContent value="student" className="mt-4">
                  <div className="flex gap-3">
                    <Select value={studentId} onValueChange={setStudentId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>
                        {students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {studentId && (
                      <Button variant="outline" onClick={() => window.open(`/api/assessment-hub/analytics/student/${studentId}`, '_blank')}>
                        <TrendingUp className="h-4 w-4 mr-2" /> View Analytics
                      </Button>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="teacher" className="mt-4">
                  <div className="flex gap-3">
                    <Select value={teacherId} onValueChange={setTeacherId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                      <SelectContent>
                        {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {teacherId && (
                      <Button variant="outline" onClick={() => window.open(`/api/assessment-hub/analytics/teacher/${teacherId}`, '_blank')}>
                        <TrendingUp className="h-4 w-4 mr-2" /> View Analytics
                      </Button>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="class" className="mt-4">
                  <div className="flex gap-3">
                    <Select value={classId} onValueChange={setClassId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(classes) ? classes : []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name || c.className || c.grade || c.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {classId && (
                      <Button variant="outline" onClick={() => window.open(`/api/assessment-hub/analytics/class/${classId}`, '_blank')}>
                        <TrendingUp className="h-4 w-4 mr-2" /> View Analytics
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
