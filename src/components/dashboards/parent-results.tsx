'use client';

import { useState, useEffect } from 'react';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { GraduationCap, Download, TrendingUp, Eye, Loader2, FileText } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ReportCardRenderer, type ReportCardData, type MetaData } from './report-card-view';

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

interface ApiReportCard {
  id: string;
  gpa: number | null;
  classRank: number | null;
  averageScore: number | null;
  grade: string | null;
  teacherComment: string | null;
  term: { id: string; name: string } | null;
  termId?: string;
  isPublished?: boolean;
  createdAt: string;
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'A+': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'B': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'C': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'D': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'F': return 'bg-red-100 text-red-700 border-red-200';
    default: return '';
  }
}

const teacherComments: Record<string, string> = {
  'Mathematics': 'Shows strong analytical skills. Needs more practice with word problems.',
  'English Language': 'Good comprehension skills. Writing could be more structured.',
  'Physics': 'Excellent grasp of concepts. Practical application needs improvement.',
  'Chemistry': 'Making good progress. Should focus more on organic chemistry topics.',
  'Biology': 'Consistent performance. Lab reports are well-documented.',
  'Computer Science': 'Outstanding performance! Shows great aptitude for programming.',
  'Financial Accounting': 'Needs to improve understanding of balance sheets and ledgers.',
  'Civic Education': 'Good participation in class discussions and debates.',
};

export function ParentResults() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ApiStudent[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [resultsMap, setResultsMap] = useState<Map<string, ApiResultData>>(new Map());
  const [selectedTermId, setSelectedTermId] = useState('');
  const [reportCardsMap, setReportCardsMap] = useState<Map<string, ApiReportCard[]>>(new Map());

  // Report card dialog state
  const [rcDialogOpen, setRcDialogOpen] = useState(false);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcData, setRcData] = useState<ReportCardData | null>(null);
  const [rcMeta, setRcMeta] = useState<MetaData | null>(null);
  const [rcTermId, setRcTermId] = useState('');
  const [rcChildId, setRcChildId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const studentsRes = await fetch(`/api/students?schoolId=${schoolId}&limit=100`);
        let allStudents: ApiStudent[] = [];
        if (studentsRes.ok) {
          const json = await studentsRes.json();
          allStudents = json.data || json || [];
        }

        const myChildren = allStudents.filter(s =>
          s.parentIds && s.parentIds.includes(currentUser.id)
        );
        const kids = myChildren.length > 0 ? myChildren : allStudents.slice(0, 1);
        setChildren(kids);

        for (const child of kids) {
          const [resultsRes, rcRes] = await Promise.all([
            fetch(`/api/results?studentId=${child.id}`),
            fetch(`/api/report-cards?studentId=${child.id}&limit=10`),
          ]);

          if (resultsRes.ok) {
            const json = await resultsRes.json();
            setResultsMap(prev => { const next = new Map(prev); next.set(child.id, json.data || json); return next; });
          }
          if (rcRes.ok) {
            const json = await rcRes.json();
            setReportCardsMap(prev => { const next = new Map(prev); next.set(child.id, json.data || json || []); return next; });
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
  const currentReportCards: ApiReportCard[] = currentChild ? reportCardsMap.get(currentChild.id) || [] : [];
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

  // Published report cards only
  const publishedCards = currentReportCards.filter(rc => rc.isPublished !== false);

  // View Report Card handler
  const handleViewReportCard = async (childId: string, termId: string, classId: string) => {
    if (!schoolId || !childId || !classId) {
      toast.error('Missing student or class information');
      return;
    }
    setRcLoading(true);
    setRcDialogOpen(true);
    setRcTermId(termId);
    setRcChildId(childId);
    try {
      const res = await fetch(`/api/report-cards/generate?schoolId=${schoolId}&termId=${termId}&classId=${classId}&studentId=${childId}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to load report card');
        setRcDialogOpen(false);
        return;
      }
      if (json.data && json.data.length > 0) {
        setRcData(json.data[0]);
        setRcMeta(json.meta || null);
      } else {
        toast.error('No report card data found for this term');
        setRcDialogOpen(false);
      }
    } catch {
      toast.error('Failed to load report card');
      setRcDialogOpen(false);
    } finally {
      setRcLoading(false);
    }
  };

  // Term options from report cards
  const rcTermOptions = publishedCards.filter(rc => rc.termId).map(rc => ({ id: rc.termId!, name: rc.term?.name || 'Unknown' }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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
          <p className="text-muted-foreground">{currentChild?.class?.name || '—'} · {currentChild?.user?.name || '—'}</p>
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
          <Button variant="outline" onClick={() => toast.success('Downloading report card...')}>
            <Download className="size-4 mr-2" /> Download Report Card
          </Button>
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <KpiCard title="GPA" value={gpa} icon={GraduationCap} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" change={0.3} changeLabel="vs last term" />
        <KpiCard title="Average Score" value={`${avg}%`} icon={TrendingUp} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Best Subject" value={bestSubject?.subjectName.split(' ').pop() || '—'} icon={GraduationCap} iconBgColor="bg-purple-100" iconColor="text-purple-600" changeLabel={bestSubject ? `${bestSubject.percentage}%` : ''} />
      </div>

      {/* Results Table with Comments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subject Results &amp; Teacher Comments</CardTitle>
          <CardDescription>Detailed performance breakdown for the selected term</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
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
                        <Badge variant="outline" className={gradeColor(grade)}>{grade}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{result.score}/{result.totalMarks}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        {teacherComments[result.subjectName] || result.subjectName === bestSubject?.subjectName ? 'Excellent performance this term.' : 'No comment available.'}
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

      {/* Published Report Cards */}
      {publishedCards.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Report Card Records</CardTitle>
                <CardDescription>Published report cards — click to view full report card</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {publishedCards.map(rc => (
                <div key={rc.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{rc.term?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      GPA: {rc.gpa?.toFixed(2) || '—'} · Average: {rc.averageScore?.toFixed(1) || '—'}% · Rank: {rc.classRank ? `#${rc.classRank}` : '—'}
                    </p>
                    {rc.teacherComment && (
                      <p className="text-xs text-muted-foreground mt-1 italic">&quot;{rc.teacherComment}&quot;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={gradeColor(rc.grade || 'F')}>{rc.grade || 'N/A'}</Badge>
                    <Button size="sm" variant="outline" onClick={() => handleViewReportCard(currentChild?.id || '', rc.term?.id || rc.termId || '', currentChild?.class?.id || '')} className="text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                      <Eye className="size-3.5 mr-1.5" /> View Report Card
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Card View Dialog */}
      <Dialog open={rcDialogOpen} onOpenChange={setRcDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-emerald-600" />
              Report Card — {rcData?.student?.name || 'Student'}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4">
            {/* Term Selector inside dialog */}
            {rcTermOptions.length > 1 && (
              <div className="flex items-center gap-2 mb-3 px-2">
                <span className="text-xs text-muted-foreground">Switch term:</span>
                <div className="flex gap-1.5">
                  {rcTermOptions.map(t => (
                    <Badge
                      key={t.id}
                      variant={rcTermId === t.id ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => { if (rcTermId !== t.id) handleViewReportCard(rcChildId, t.id, currentChild?.class?.id || ''); }}
                    >
                      {t.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <ScrollArea className="max-h-[calc(90vh-120px)]">
              {rcLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-8 text-emerald-600 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading report card...</span>
                </div>
              ) : rcData && rcMeta ? (
                <ReportCardRenderer currentCard={rcData} meta={rcMeta} />
              ) : (
                <div className="py-16 text-center text-muted-foreground">No report card data available</div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
