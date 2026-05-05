'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Download, AlertTriangle } from 'lucide-react';

interface StudentResult {
  id: string;
  name: string;
  className: string;
  gpa: number;
  rank: number;
  average: number;
  grade: string;
}

interface ClassRecord {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
}

const gradeColorMap: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  B: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  D: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  F: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400',
};

function getGradeFromGpa(gpa: number): string {
  if (gpa >= 4.0) return 'A';
  if (gpa >= 3.5) return 'B';
  if (gpa >= 3.0) return 'C';
  if (gpa >= 2.5) return 'D';
  return 'F';
}

function getAverageFromGpa(gpa: number): number {
  return Math.round(gpa * 25 * 10) / 10;
}

export function ResultsView() {
  const { selectedSchoolId } = useAppStore();
  const [selectedClass, setSelectedClass] = useState('all');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch classes
  useEffect(() => {
    if (!selectedSchoolId) return;
    fetch(`/api/classes?schoolId=${selectedSchoolId}&limit=100`)
      .then(res => res.json())
      .then(json => setClasses(Array.isArray(json.data) ? json.data : []))
      .catch(() => toast.error('Failed to load classes'));
  }, [selectedSchoolId]);

  // Fetch students and compute results
  useEffect(() => {
    if (!selectedSchoolId) return;

    const fetchResults = async () => {
      const classFilter = selectedClass !== 'all' ? `&classId=${selectedClass}` : '';
      try {
        const res = await fetch(`/api/students?schoolId=${selectedSchoolId}${classFilter}&limit=500`);
        const json = await res.json();
        const students = json.data || [];
        const resultList: StudentResult[] = students
          .map((s: Record<string, unknown>) => {
            const gpa = (s.gpa as number) || 0;
            return {
              id: s.id as string,
              name: (s.user as Record<string, unknown>)?.name || 'Unknown',
              className: (s.class as Record<string, unknown>)?.name || '',
              gpa,
              rank: (s.rank as number) || 0,
              average: getAverageFromGpa(gpa),
              grade: getGradeFromGpa(gpa),
            };
          })
          .filter(r => r.gpa > 0)
          .sort((a, b) => b.gpa - a.gpa)
          .map((r, i) => ({ ...r, rank: r.rank || i + 1 }));
        setResults(resultList);
      } catch {
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchResults();
  }, [selectedSchoolId, selectedClass]);

  // Distribution chart data
  const gpaDistribution = React.useMemo(() => {
    const ranges = [
      { range: '4.5-5.0', count: 0 },
      { range: '4.0-4.4', count: 0 },
      { range: '3.5-3.9', count: 0 },
      { range: '3.0-3.4', count: 0 },
      { range: '2.5-2.9', count: 0 },
      { range: 'Below 2.5', count: 0 },
    ];
    results.forEach(r => {
      if (r.gpa >= 4.5) ranges[0].count++;
      else if (r.gpa >= 4.0) ranges[1].count++;
      else if (r.gpa >= 3.5) ranges[2].count++;
      else if (r.gpa >= 3.0) ranges[3].count++;
      else if (r.gpa >= 2.5) ranges[4].count++;
      else ranges[5].count++;
    });
    return ranges;
  }, [results]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-16 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-16 w-40" />
        </div>
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="size-10 opacity-40 mb-3" />
        <p className="text-sm">Please select a school to view results</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Results Overview</h2>
          <p className="text-sm text-muted-foreground">View and analyze student academic results</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => toast.success('Export started')}>
          <Download className="size-4" />
          Export Results
        </Button>
      </div>

      {/* Selectors */}
      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Class</label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Rank</th>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Class</th>
                  <th className="p-3 font-medium text-right">GPA</th>
                  <th className="p-3 font-medium text-right">Average</th>
                  <th className="p-3 font-medium text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${r.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-muted'}`}>
                        {r.rank}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-muted-foreground">{r.className}</td>
                    <td className="p-3 text-right font-semibold">{r.gpa.toFixed(2)}</td>
                    <td className="p-3 text-right">{r.average}%</td>
                    <td className="p-3 text-center">
                      <Badge className={gradeColorMap[r.grade] || gradeColorMap.F} variant="secondary">{r.grade}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="size-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No results found. Exam scores have not been recorded yet.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GPA Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">GPA Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gpaDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} name="Students" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground">
              <p className="text-sm">No data available for chart</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
