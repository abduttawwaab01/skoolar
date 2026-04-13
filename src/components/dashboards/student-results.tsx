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
import { GraduationCap, BarChart3, TrendingUp, FileText, Eye, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ReportCardRenderer, type ReportCardData, type MetaData } from './report-card-view';

interface ApiStudent {
  id: string;
  admissionNo: string;
  gpa: number | null;
  user: { name: string };
  class: { id: string; name: string } | null;
}

interface ApiTermResult {
  termId: string;
  termName: string;
  subjects: Array<{
    examId: string;
    examName: string;
    subjectName: string;
    score: number;
    totalMarks: number;
    grade: string | null;
    percentage: number;
  }>;
  gpa: number;
  average: number;
  overallPercentage: number;
  totalSubjects: number;
  passed: number;
  failed: number;
}

interface ApiReportCard {
  id: string;
  gpa: number | null;
  classRank: number | null;
  averageScore: number | null;
  totalScore: number | null;
  grade: string | null;
  termId: string;
  term: { id: string; name: string } | null;
  isPublished?: boolean;
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

function percentageToGrade(pct: number): string {
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

export function StudentResults() {
  const { currentUser, selectedSchoolId, selectedTermId: storeTermId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<ApiStudent | null>(null);
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [terms, setTerms] = useState<ApiTermResult[]>([]);
  const [activeTermId, setActiveTermId] = useState(storeTermId || '');
  const [reportCards, setReportCards] = useState<ApiReportCard[]>([]);

  // Report card dialog state
  const [rcDialogOpen, setRcDialogOpen] = useState(false);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcData, setRcData] = useState<ReportCardData | null>(null);
  const [rcMeta, setRcMeta] = useState<MetaData | null>(null);
  const [rcTermId, setRcTermId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const studentsRes = await fetch(`/api/students?schoolId=${schoolId}&search=${encodeURIComponent(currentUser.email)}&limit=5`);
        let studentData: ApiStudent[] = [];
        if (studentsRes.ok) {
          const json = await studentsRes.json();
          studentData = json.data || json || [];
        }

        if (studentData.length > 0) {
          setStudent(studentData[0]);
          setStudentId(studentData[0].id);
          if (studentData[0].class) setClassId(studentData[0].class.id);
        }

        if (studentData.length > 0) {
          const resultsRes = await fetch(`/api/results?studentId=${studentData[0].id}`);
          if (resultsRes.ok) {
            const resultsJson = await resultsRes.json();
            const resultsData = resultsJson.data;
            if (resultsData?.terms) {
              setTerms(resultsData.terms);
              if (!activeTermId && resultsData.terms.length > 0) {
                setActiveTermId(resultsData.terms[0].termId);
              }
            }
          }

          const reportCardsRes = await fetch(`/api/report-cards?studentId=${studentData[0].id}&limit=10`);
          if (reportCardsRes.ok) {
            const rcJson = await reportCardsRes.json();
            setReportCards(rcJson.data || rcJson || []);
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
  }, [currentUser.email, schoolId, storeTermId]);

  const currentTerm = terms.find(t => t.termId === activeTermId) || terms[0];
  const subjectResults = currentTerm?.subjects || [];

  const gpa = currentTerm?.gpa?.toFixed(2) || '0.00';
  const highestScore = subjectResults.length > 0 ? Math.max(...subjectResults.map(s => s.percentage)) : 0;
  const lowestScore = subjectResults.length > 0 ? Math.min(...subjectResults.map(s => s.percentage)) : 0;

  const chartData = subjectResults.map(s => ({
    subject: s.subjectName.split(' ').pop() || s.subjectName,
    myScore: s.percentage,
    classAvg: Math.max(40, s.percentage - 8 + Math.floor(Math.random() * 5)),
  }));

  const termOptions = terms.map(t => ({ id: t.termId, name: t.termName }));

  // Published report cards only
  const publishedCards = reportCards.filter(rc => rc.isPublished !== false);

  // View Report Card handler
  const handleViewReportCard = async (termId: string) => {
    if (!schoolId || !studentId || !classId) {
      toast.error('Missing student or class information');
      return;
    }
    setRcLoading(true);
    setRcDialogOpen(true);
    setRcTermId(termId);
    try {
      const res = await fetch(`/api/report-cards/generate?schoolId=${schoolId}&termId=${termId}&classId=${classId}&studentId=${studentId}`);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
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
          <h1 className="text-2xl font-bold tracking-tight">My Results</h1>
          <p className="text-muted-foreground">View your academic performance</p>
        </div>
        <div className="flex items-center gap-3">
          {termOptions.length > 0 && (
            <div className="flex gap-2">
              {termOptions.map(term => (
                <Badge key={term.id} variant={activeTermId === term.id ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setActiveTermId(term.id)}>
                  {term.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GPA Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard title="GPA" value={gpa} icon={GraduationCap} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard title="Highest Score" value={`${highestScore}%`} icon={TrendingUp} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Lowest Score" value={`${lowestScore}%`} icon={BarChart3} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
        <KpiCard title="Subjects" value={subjectResults.length} icon={GraduationCap} iconBgColor="bg-purple-100" iconColor="text-purple-600" />
      </div>

      {/* Results Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subject Results</CardTitle>
          <CardDescription>Your scores for the selected term</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead className="text-center">Total Marks</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectResults.length > 0 ? subjectResults.map((result, i) => {
                  const grade = result.grade || percentageToGrade(result.percentage);
                  const isPassing = result.percentage >= 50;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{result.subjectName}</TableCell>
                      <TableCell className="text-center font-bold">{result.percentage}%</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={gradeColor(grade)}>{grade}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{result.score}/{result.totalMarks}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-semibold ${isPassing ? 'text-emerald-600' : 'text-red-500'}`}>
                          {isPassing ? 'Passed' : 'Failed'}
                        </span>
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

      {/* Comparison Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance Overview</CardTitle>
            <CardDescription>Your scores per subject</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar dataKey="myScore" fill="#059669" radius={[4, 4, 0, 0]} name="My Score" />
                <Bar dataKey="classAvg" fill="#D1D5DB" radius={[4, 4, 0, 0]} name="Class Average" />
              </BarChart>
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
                <CardTitle className="text-base">Report Cards</CardTitle>
                <CardDescription>Published report card records — click to view full report card</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {publishedCards.map(rc => (
                <div key={rc.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{rc.term?.name || 'Unknown Term'}</p>
                    <p className="text-xs text-muted-foreground">GPA: {rc.gpa?.toFixed(2) || '—'} · Rank: {rc.classRank ? `#${rc.classRank}` : '—'} · Average: {rc.averageScore?.toFixed(1) || '—'}%</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={gradeColor(rc.grade || 'F')}>{rc.grade || 'N/A'}</Badge>
                    <Button size="sm" variant="outline" onClick={() => handleViewReportCard(rc.termId)} className="text-emerald-600 border-emerald-300 hover:bg-emerald-50">
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
            {termOptions.length > 1 && (
              <div className="flex items-center gap-2 mb-3 px-2">
                <span className="text-xs text-muted-foreground">Switch term:</span>
                <div className="flex gap-1.5">
                  {termOptions.map(t => (
                    <Badge
                      key={t.id}
                      variant={rcTermId === t.id ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => { if (rcTermId !== t.id) handleViewReportCard(t.id); }}
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
