'use client';

import { useState, useEffect } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { GraduationCap, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+':
    case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'A-': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'B+': return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'B': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'C': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'D': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'F': return 'bg-red-100 text-red-700 border-red-200';
    default: return '';
  }
}

interface ApiStudent {
  id: string;
  admissionNo: string;
  gpa: number | null;
  parentIds: string | null;
  classId?: string;
  user: { name: string };
  class: { id: string; name: string } | null;
}

interface ApiTermResult {
  termId: string;
  termName: string;
  gpa: number;
  average: number;
  overallPercentage: number;
  totalSubjects: number;
  passed: number;
  subjects: Array<{
    subjectName: string;
    score: number;
    totalMarks: number;
    percentage: number;
    grade: string | null;
  }>;
}

interface ApiResultData {
  terms: ApiTermResult[];
  overallGPA: number;
  overallAverage: number;
}

export function ParentResults() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ApiStudent[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [resultsMap, setResultsMap] = useState<Map<string, ApiResultData>>(new Map());
  const [teacherCommentsMap, setTeacherCommentsMap] = useState<Map<string, string>>(new Map());
  const [selectedTermId, setSelectedTermId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const studentsRes = await fetch(`/api/parent/children?schoolId=${schoolId}`);
        let allStudents: ApiStudent[] = [];
        if (studentsRes.ok) {
          const json = await studentsRes.json();
          allStudents = Array.isArray(json.data) ? json.data : [];
        }

        const kids = allStudents.length > 0 ? allStudents : [];
        setChildren(kids);

        for (const child of kids) {
          const [resultsRes, commentsRes] = await Promise.all([
            fetch(`/api/results?studentId=${child.id}`),
            fetch(`/api/teacher-comments?studentId=${child.id}`),
          ]);

          if (resultsRes.ok) {
            const json = await resultsRes.json();
            setResultsMap(prev => { const next = new Map(prev); next.set(child.id, json.data || json); return next; });
          }
          if (commentsRes.ok) {
            const json = await commentsRes.json();
            const comments = Array.isArray(json.data) ? json.data : [];
            const commentMap = new Map<string, string>();
            comments.forEach((c: { category: string; comment: string }) => {
              commentMap.set(c.category, c.comment);
            });
            setTeacherCommentsMap(prev => { const next = new Map(prev); next.set(child.id, JSON.stringify(Object.fromEntries(commentMap))); return next; });
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser.id, schoolId]);

  const currentChild = children[selectedChildIndex];
  const currentResults = currentChild ? resultsMap.get(currentChild.id) : null;
  const terms = currentResults?.terms || [];

  useEffect(() => {
    if (terms.length > 0 && !selectedTermId) {
      setSelectedTermId(terms[0].termId);
    }
  }, [terms, selectedTermId]);

  const currentTerm = terms.find(t => t.termId === selectedTermId) || terms[0];
  const subjectResults = currentTerm?.subjects || [];

  const gpa = currentTerm?.gpa?.toFixed(2) || '0.00';
  const avg = currentTerm?.average?.toFixed(1) || '0.0';

  const bestSubject = subjectResults.length > 0
    ? subjectResults.reduce((best, s) => s.percentage > best.percentage ? s : best, subjectResults[0])
    : null;

  const gpaTrend = terms.map(t => ({
    term: t.termName.split(' ')[0] + ' ' + (t.termId || ''),
    gpa: t.gpa,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{currentChild?.user?.name || 'Child&apos;s'} Results</h1>
          <p className="text-muted-foreground">{currentChild?.class?.name || 'â€”'} Â· {currentChild?.user?.name || 'â€”'}</p>
        </div>
        <div className="flex items-center gap-3">
          {terms.length > 1 && (
            <div className="flex gap-2">
              {terms.map(term => (
                <Badge key={term.termId} variant={selectedTermId === term.termId ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedTermId(term.termId)}>
                  {term.termName}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Child Selector (if multiple children) */}
      {children.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {children.map((child, i) => (
            <Badge
              key={child.id}
              variant={i === selectedChildIndex ? 'default' : 'outline'}
              className="cursor-pointer text-sm px-3 py-1"
              onClick={() => setSelectedChildIndex(i)}
            >
              {child.user.name}
            </Badge>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <KpiCard title="GPA" value={gpa} icon={GraduationCap} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" change={0.3} changeLabel="vs last term" />
        <KpiCard title="Average Score" value={`${avg}%`} icon={TrendingUp} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Best Subject" value={bestSubject?.subjectName.split(' ').pop() || 'â€”'} icon={GraduationCap} iconBgColor="bg-purple-100" iconColor="text-purple-600" changeLabel={bestSubject ? `${bestSubject.percentage}%` : ''} />
      </div>

      {/* Results Table with Comments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subject Results &amp; Teacher Comments</CardTitle>
          <CardDescription>Detailed performance breakdown for the selected term</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead>Teacher&apos;s Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectResults.length > 0 ? subjectResults.map((result, i) => {
                  const grade = result.grade || 'F';
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{result.subjectName}</TableCell>
                      <TableCell className="text-center font-bold">{result.percentage}%</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={getGradeColor(grade)}>{grade}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{result.score}/{result.totalMarks}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        {(() => {
                          const stored = currentChild ? teacherCommentsMap.get(currentChild.id) : null;
                          if (stored) {
                            try {
                              const parsed = JSON.parse(stored);
                              return parsed[result.subjectName] || parsed.general || 'No comment available.';
                            } catch { return 'No comment available.'; }
                          }
                          return 'No comment available.';
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No results available for this term
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* GPA Trend Chart */}
      {gpaTrend.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">GPA Trend</CardTitle>
            <CardDescription>Academic performance over recent terms</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={gpaTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="term" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[2.5, 4.5]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="gpa" stroke="#059669" strokeWidth={2.5} dot={{ r: 5, fill: '#059669' }} activeDot={{ r: 7 }} name="GPA" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
