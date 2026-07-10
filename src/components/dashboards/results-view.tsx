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
import { getGradeFromGPA } from '@/lib/grade-calculator';

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

interface TermRecord {
  id: string;
  name: string;
  academicYear: { name: string };
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+':
    case 'A': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400';
    case 'B': return 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400';
    case 'C': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
    case 'D': return 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400';
    case 'F': return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export function ResultsView() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch classes
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      try {
        const res = await fetch(`/api/classes?schoolId=${schoolId}&limit=100`);
        const json = await res.json();
        setClasses(Array.isArray(json.data) ? json.data : []);
      } catch {
        toast.error('Failed to load classes');
      }
    })();
  }, [schoolId]);

  // Fetch terms
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      try {
        const res = await fetch(`/api/terms?schoolId=${schoolId}&limit=10`);
        const json = await res.json();
        const t = Array.isArray(json.data) ? json.data : [];
        setTerms(t);
        if (t.length > 0) setSelectedTermId(t[0].id);
      } catch {
        toast.error('Failed to load terms');
      }
    })();
  }, [schoolId]);

  // Fetch results
  useEffect(() => {
    if (!schoolId || !selectedTermId) return;

    const fetchResults = async () => {
      const classFilter = selectedClass !== 'all' ? `&classId=${selectedClass}` : '';
      try {
        const res = await fetch(`/api/students?schoolId=${schoolId}${classFilter}&limit=500`);
        const json = await res.json();
        const students = json.data || [];

        const studentIds = students.map((s: Record<string, unknown>) => s.id as string);
        const batchRes = await fetch('/api/results/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentIds, schoolId, termId: selectedTermId, classId: selectedClass !== 'all' ? selectedClass : undefined }),
        });
        const batchData = await batchRes.json();
        const resultsData: Record<string, { gpa: number; average: number; grade: string; totalScore: number }> = batchData.data || {};

        const resultList: StudentResult[] = students.map((s: Record<string, unknown>) => {
          const sid = s.id as string;
          const r = resultsData[sid];
          const computedGpa = r?.gpa ?? ((s.gpa as number) || 0);
          return {
            id: sid,
            name: ((s.user as Record<string, unknown>)?.name as string) || 'Unknown',
            className: ((s.class as Record<string, unknown>)?.name as string) || '',
            gpa: computedGpa,
            rank: 0,
            average: r?.average ?? 0,
            grade: r?.grade ?? getGradeFromGPA(computedGpa),
          };
        })
          .sort((a, b) => b.gpa - a.gpa)
          .map((r, i) => ({ ...r, rank: i + 1 }));
        setResults(resultList);
      } catch {
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchResults();
  }, [schoolId, selectedClass, selectedTermId]);

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

  const handleExport = () => {
    if (!selectedTermId) { toast.error('Please select a term'); return; }
    if (results.length === 0) { toast.error('No results to export'); return; }
    const termName = terms.find(t => t.id === selectedTermId)?.name || 'Unknown';
    const className = selectedClass !== 'all' ? classes.find(c => c.id === selectedClass)?.name || 'Selected' : 'All_Classes';
    const headers = ['Rank', 'Name', 'Class', 'GPA', 'Average', 'Grade'];
    const csvRows = results.map(r => [r.rank, `"${r.name}"`, r.className, r.gpa.toFixed(2), `${r.average}%`, r.grade].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results-${termName.replace(/\s+/g, '_')}-${className.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Results exported');
  };

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

  if (!schoolId) {
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
        <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={handleExport}>
          <Download className="size-4" />
          Export Results
        </Button>
      </div>

      {/* Selectors */}
      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Term</label>
          <Select value={selectedTermId} onValueChange={setSelectedTermId}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Select term" /></SelectTrigger>
            <SelectContent>
              {terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name} - {t.academicYear.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Class</label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
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
            <table className="w-full min-w-0 sm:min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Rank</th>
                  <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Name</th>
                  <th className="p-2 sm:p-3 font-medium whitespace-nowrap hidden sm:table-cell">Class</th>
                  <th className="p-2 sm:p-3 font-medium text-right whitespace-nowrap">GPA</th>
                  <th className="p-2 sm:p-3 font-medium text-right whitespace-nowrap hidden sm:table-cell">Average</th>
                  <th className="p-2 sm:p-3 font-medium text-center whitespace-nowrap">Grade</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-2 sm:p-3">
                      <span className={`inline-flex size-5 sm:size-6 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold ${r.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-muted'}`}>
                        {r.rank}
                      </span>
                    </td>
                    <td className="p-2 sm:p-3 font-medium text-sm truncate max-w-[120px] sm:max-w-none">{r.name}</td>
                    <td className="p-2 sm:p-3 text-muted-foreground hidden sm:table-cell">{r.className}</td>
                    <td className="p-2 sm:p-3 text-right font-semibold text-sm">{r.gpa.toFixed(2)}</td>
                    <td className="p-2 sm:p-3 text-right hidden sm:table-cell">{r.average}%</td>
                    <td className="p-2 sm:p-3 text-center">
                      <Badge className={getGradeColor(r.grade)} variant="secondary">{r.grade}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="size-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No results found for this class.</p>
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
            <div className="h-[180px] sm:h-[240px] flex items-center justify-center text-muted-foreground">
              <p className="text-sm">No data available for chart</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
