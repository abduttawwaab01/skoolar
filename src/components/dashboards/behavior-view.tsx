'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { Award, ThumbsUp, ThumbsDown, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

interface BehaviorRecord {
  id: string;
  student: string;
  class: string;
  score: number;
  status: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="p-6"><div className="space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-64" /><Skeleton className="h-64 w-full" /></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-64" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></CardContent></Card>
      </div>
    </div>
  );
}

export function BehaviorView() {
  const selectedSchoolId = useAppStore((s) => s.selectedSchoolId);
  const [loading, setLoading] = React.useState(true);
  const [students, setStudents] = React.useState<BehaviorRecord[]>([]);
  const [type, setType] = React.useState<string>('positive');
  const [studentId, setStudentId] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [points, setPoints] = React.useState('');
  const [description, setDescription] = React.useState('');

  const fetchData = React.useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/students?schoolId=${selectedSchoolId}&limit=100`);
      if (!res.ok) throw new Error('Failed to fetch students');
      const json = await res.json();
      const data: BehaviorRecord[] = (json.data || []).map((s: { id: string; user?: { name?: string | null }; class?: { name?: string | null } | null; behaviorScore?: number | null }) => ({
        id: s.id,
        student: s.user?.name || 'Unknown',
        class: s.class?.name || 'Unassigned',
        score: s.behaviorScore ?? 0,
        status: (s.behaviorScore ?? 0) >= 90 ? 'Excellent' : (s.behaviorScore ?? 0) >= 80 ? 'Good' : (s.behaviorScore ?? 0) >= 70 ? 'Fair' : 'Needs Improvement',
      }));
      setStudents(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load behavior data');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const topBehaved = React.useMemo(
    () => [...students].sort((a, b) => b.score - a.score).slice(0, 5),
    [students]
  );

  const pointsDistribution = React.useMemo(() => {
    if (students.length === 0) return [];
    const excellent = students.filter(s => s.score >= 90).length;
    const good = students.filter(s => s.score >= 80 && s.score < 90).length;
    const fair = students.filter(s => s.score >= 70 && s.score < 80).length;
    const below = students.filter(s => s.score < 70).length;
    return [
      { range: '90-100', count: excellent, color: '#059669' },
      { range: '80-89', count: good, color: '#0891B2' },
      { range: '70-79', count: fair, color: '#D97706' },
      { range: 'Below 70', count: below, color: '#DC2626' },
    ].filter(p => p.count > 0);
  }, [students]);

  const columns: ColumnDef<BehaviorRecord>[] = [
    { accessorKey: 'student', header: 'Student' },
    { accessorKey: 'class', header: 'Class' },
    {
      accessorKey: 'score',
      header: 'Score',
      cell: ({ row }) => (
        <span className="font-bold">{row.getValue<number>('score')}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.getValue<string>('status');
        const variant = s === 'Excellent' ? 'success' : s === 'Good' ? 'info' : s === 'Fair' ? 'warning' : 'error';
        return <StatusBadge variant={variant} size="sm">{s}</StatusBadge>;
      },
    },
  ];

  if (loading) return <LoadingSkeleton />;

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Award className="size-10 mb-3" />
        <p className="text-sm font-medium">No school selected</p>
        <p className="text-xs mt-1">Please select a school to view behavior data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Behavior Tracking</h2>
        <p className="text-sm text-muted-foreground">Monitor and manage student behavior records</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Behavior Scores Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Behavior Scores</CardTitle>
            <CardDescription>Current behavior scores for all students</CardDescription>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ThumbsUp className="size-8 mb-2" />
                <p className="text-sm font-medium">No students found</p>
                <p className="text-xs mt-1">Add students to begin tracking behavior</p>
              </div>
            ) : (
              <DataTable columns={columns} data={students} searchKey="student" searchPlaceholder="Search student..." pageSize={5} />
            )}
          </CardContent>
        </Card>

        {/* Add Record Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Behavior Record</CardTitle>
            <CardDescription>Record a new positive or negative behavior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.student}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  <Button
                    variant={type === 'positive' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5 flex-1"
                    onClick={() => setType('positive')}
                  >
                    <ThumbsUp className="size-3.5" />Positive
                  </Button>
                  <Button
                    variant={type === 'negative' ? 'destructive' : 'outline'}
                    size="sm"
                    className="gap-1.5 flex-1"
                    onClick={() => setType('negative')}
                  >
                    <ThumbsDown className="size-3.5" />Negative
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="punctuality">Punctuality</SelectItem>
                    <SelectItem value="respect">Respect</SelectItem>
                    <SelectItem value="participation">Participation</SelectItem>
                    <SelectItem value="discipline">Discipline</SelectItem>
                    <SelectItem value="teamwork">Teamwork</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Points</Label>
                <Input placeholder="10" type="number" value={points} onChange={e => setPoints(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Describe the behavior..." rows={2} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => { toast.success('Behavior record added'); setStudentId(''); setCategory(''); setPoints(''); setDescription(''); }}>Add Record</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Behaved */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Award className="size-5 text-amber-500" />
              <CardTitle className="text-base">Top Behaved Students</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {topBehaved.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">No behavior data available</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topBehaved.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.student}</p>
                      <p className="text-xs text-muted-foreground">{s.class}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="size-3.5 text-emerald-500" />
                      <span className="text-sm font-bold">{s.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Points Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Points Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pointsDistribution.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">No behavior data to display</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pointsDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="count" nameKey="range" paddingAngle={2}>
                      {pointsDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-1">
                  {pointsDistribution.map(p => (
                    <div key={p.range} className="flex items-center gap-1.5 text-xs">
                      <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.range} ({p.count})
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
