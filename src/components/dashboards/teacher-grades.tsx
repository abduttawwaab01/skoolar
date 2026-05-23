'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Save, BarChart3, TrendingUp, TrendingDown, Award, Download, Printer, FileText, Loader2, BookOpen, GraduationCap,
} from 'lucide-react';
import { calculateGradeFromScore, isPassing, DEFAULT_PASS_MARK } from '@/lib/grade-calculator';

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

interface ScoreType {
  id: string;
  name: string;
  type: string;
  maxMarks: number;
  weight: number;
  position: number;
}

interface StudentScore {
  studentId: string;
  name: string;
  admissionNo: string;
  scores: Record<string, { score: number; examId: string; examName: string }>;
  totalScore: number;
  totalMax: number;
}

interface TermScoreData {
  students: StudentScore[];
  scoreTypes: ScoreType[];
  exams: { id: string; name: string; scoreTypeId: string | null; totalMarks: number }[];
}

export function TeacherGrades() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [classes, setClasses] = useState<{ id: string; name: string; section: string | null }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string; academicYear?: { name: string } }[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [scoreData, setScoreData] = useState<TermScoreData | null>(null);
  const [scoresInput, setScoresInput] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [loadingScores, setLoadingScores] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const isTeacher = useMemo(() => currentRole === 'TEACHER', [currentRole]);

  // Fetch classes, subjects, terms on mount
  useEffect(() => {
    if (!schoolId) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [classRes, subjRes, termRes] = await Promise.all([
          fetch(`/api/classes?schoolId=${schoolId}&limit=100`),
          fetch(`/api/subjects?schoolId=${schoolId}&limit=100`),
          fetch(`/api/terms?schoolId=${schoolId}&limit=10`),
        ]);

        if (classRes.ok) {
          const json = await classRes.json();
          const data = json.data || [];
          setClasses(data);
          if (data.length > 0 && !selectedClass) setSelectedClass(data[0].id);
        }
        if (subjRes.ok) {
          const json = await subjRes.json();
          setSubjects(json.data || []);
        }
        if (termRes.ok) {
          const json = await termRes.json();
          const data = json.data || [];
          setTerms(data);
          if (data.length > 0 && !selectedTerm) setSelectedTerm(data[0].id);
        }
      } catch {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [schoolId]);

  // Fetch scores when selections change
  useEffect(() => {
    if (!selectedClass || !selectedSubject || !selectedTerm) return;
    const fetchScores = async () => {
      setLoadingScores(true);
      setSubmitted(false);
      try {
        const res = await fetch(
          `/api/term-scores?schoolId=${schoolId}&classId=${selectedClass}&subjectId=${selectedSubject}&termId=${selectedTerm}`
        );
        if (!res.ok) throw new Error('Failed to load scores');
        const json = await res.json();
        const data: TermScoreData = json.data;
        setScoreData(data);

        // Initialize input map
        const inputMap: Record<string, Record<string, string>> = {};
        for (const student of data.students) {
          inputMap[student.studentId] = {};
          for (const st of data.scoreTypes) {
            const existing = student.scores[st.id];
            inputMap[student.studentId][st.id] = existing?.score > 0 ? String(existing.score) : '';
          }
        }
        setScoresInput(inputMap);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load scores');
        setScoreData(null);
      } finally {
        setLoadingScores(false);
      }
    };
    fetchScores();
  }, [selectedClass, selectedSubject, selectedTerm, schoolId]);

  const updateScore = useCallback((studentId: string, scoreTypeId: string, value: string) => {
    setSubmitted(false);
    setScoresInput(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [scoreTypeId]: value },
    }));
  }, []);

  const handleSave = async () => {
    if (!selectedClass || !selectedSubject || !selectedTerm) {
      toast.error('Please select class, subject, and term');
      return;
    }
    if (!scoreData) return;

    const scores: { studentId: string; scoreTypeId: string; score: number }[] = [];
    for (const [studentId, typeScores] of Object.entries(scoresInput)) {
      for (const [scoreTypeId, value] of Object.entries(typeScores)) {
        if (value !== '' && !isNaN(Number(value))) {
          scores.push({ studentId, scoreTypeId, score: Number(value) });
        }
      }
    }

    if (scores.length === 0) {
      toast.error('Please enter at least one score');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/term-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          classId: selectedClass,
          subjectId: selectedSubject,
          termId: selectedTerm,
          scores,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save scores');
      }
      setSubmitted(true);
      toast.success('Scores saved successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save scores');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute statistics
  const stats = useMemo(() => {
    if (!scoreData || scoreData.students.length === 0) {
      return { average: 0, highest: 0, lowest: 0, passRate: 0, graded: 0, total: 0 };
    }
    const withScores = scoreData.students.filter(s => {
      return Object.values(scoresInput[s.studentId] || {}).some(v => v !== '');
    });
    const totals = withScores.map(s => {
      let sum = 0;
      for (const st of scoreData.scoreTypes) {
        const val = scoresInput[s.studentId]?.[st.id];
        if (val && !isNaN(Number(val))) sum += Number(val);
      }
      return sum;
    });
    if (totals.length === 0) return { average: 0, highest: 0, lowest: 0, passRate: 0, graded: 0, total: scoreData.students.length };
    const average = totals.reduce((a, b) => a + b, 0) / totals.length;
    const totalMax = scoreData.scoreTypes.reduce((s, st) => s + st.maxMarks, 0) || 100;
    const passed = totals.filter(t => isPassing((t / totalMax) * 100, DEFAULT_PASS_MARK)).length;
    return {
      average,
      highest: Math.max(...totals),
      lowest: Math.min(...totals),
      passRate: (passed / totals.length) * 100,
      graded: totals.length,
      total: scoreData.students.length,
    };
  }, [scoreData, scoresInput]);

  // Generate report cards
  const handleGenerateReportCards = async () => {
    const studentIds = scoreData?.students.map(s => s.studentId).filter(id => {
      const s = scoresInput[id];
      return s && Object.values(s).some(v => v !== '');
    }) || [];

    if (studentIds.length === 0) {
      toast.error('No students with scores to generate report cards');
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch('/api/report-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          termId: selectedTerm,
          classId: selectedClass,
          studentIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate report cards');
      toast.success(`Generated ${json.data?.length || 0} report card(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate report cards');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <GraduationCap className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Scores & Reports</h2>
            <p className="text-sm text-muted-foreground">Enter scores by term and generate report cards</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleGenerateReportCards}
            disabled={downloading || !selectedTerm || !selectedClass}
            className="gap-2"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate Report Cards
          </Button>
          <Button onClick={handleSave} disabled={submitted || submitting || !scoreData} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitted ? 'Saved ✓' : 'Save Scores'}
          </Button>
        </div>
      </div>

      {/* Selectors: Class | Subject | Term */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setScoreData(null); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.section ? ` - ${c.section}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setScoreData(null); }}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.code ? ` (${s.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Term</Label>
              <Select value={selectedTerm} onValueChange={(v) => { setSelectedTerm(v); setScoreData(null); }}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>
                  {terms.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.academicYear ? ` (${t.academicYear.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Entry Area */}
      {loadingScores ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
        </div>
      ) : !selectedClass || !selectedSubject || !selectedTerm ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-gray-100 mb-4">
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Select Class, Subject & Term</h3>
            <p className="text-sm text-gray-500">Choose a class, subject, and term to enter scores</p>
          </CardContent>
        </Card>
      ) : !scoreData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-500">Failed to load score data. Please try again.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Score Table */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {scoreData.scoreTypes.length > 0
                    ? `${scoreData.students.length} Students — Score Types: ${scoreData.scoreTypes.map(st => st.name).join(', ')}`
                    : `${scoreData.students.length} Students`}
                </CardTitle>
                {submitted && <Badge className="bg-emerald-100 text-emerald-700">Saved</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 sticky left-0 bg-white">#</TableHead>
                      <TableHead className="sticky left-10 bg-white">Student</TableHead>
                      <TableHead className="sticky left-44 bg-white">Admission</TableHead>
                      {scoreData.scoreTypes.map(st => (
                        <TableHead key={st.id} className="text-center min-w-[100px]">
                          {st.name}
                          <div className="text-xs font-normal text-muted-foreground">/ {st.maxMarks}</div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[80px]">Total</TableHead>
                      <TableHead className="text-center min-w-[60px]">Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoreData.students.map((student, i) => {
                      let total = 0;
                      let maxTotal = 0;
                      for (const st of scoreData.scoreTypes) {
                        const val = scoresInput[student.studentId]?.[st.id];
                        if (val && !isNaN(Number(val))) {
                          total += Number(val);
                          maxTotal += st.maxMarks;
                        }
                      }
                      const grade = maxTotal > 0 ? calculateGradeFromScore(total, maxTotal) : '-';
                      return (
                        <TableRow key={student.studentId}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{student.name}</TableCell>
                          <TableCell className="text-muted-foreground">{student.admissionNo}</TableCell>
                          {scoreData.scoreTypes.map(st => (
                            <TableCell key={st.id} className="p-1">
                              <Input
                                type="number"
                                min="0"
                                max={st.maxMarks}
                                placeholder="—"
                                className="h-8 w-full text-center"
                                value={scoresInput[student.studentId]?.[st.id] ?? ''}
                                onChange={e => updateScore(student.studentId, st.id, e.target.value)}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-semibold">{maxTotal > 0 ? total : '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={grade !== '-' ? getGradeColor(grade) : ''}>
                              {grade}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Stats Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-4" /> Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Average Total Score</p>
                  <p className="text-3xl font-bold">{stats.average.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{stats.graded}/{stats.total} graded</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-emerald-50 p-3 text-center">
                    <TrendingUp className="size-4 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Highest</p>
                    <p className="text-lg font-bold text-emerald-700">{stats.highest}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <TrendingDown className="size-4 text-red-600 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Lowest</p>
                    <p className="text-lg font-bold text-red-700">{stats.lowest}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <Award className="size-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Pass Rate</p>
                  <p className="text-lg font-bold text-blue-700">{stats.passRate.toFixed(1)}%</p>
                </div>
              </CardContent>
            </Card>

            {/* Score Types Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Score Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {scoreData.scoreTypes.map(st => (
                  <div key={st.id} className="flex items-center justify-between text-muted-foreground">
                    <span>{st.name}</span>
                    <span className="font-medium">Max: {st.maxMarks} | Wt: {st.weight}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Grade Scale */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Grade Scale</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  { grade: 'A+', range: '90 – 100', color: 'bg-emerald-500' },
                  { grade: 'A', range: '80 – 89', color: 'bg-emerald-400' },
                  { grade: 'B', range: '70 – 79', color: 'bg-blue-500' },
                  { grade: 'C', range: '60 – 69', color: 'bg-amber-500' },
                  { grade: 'D', range: '50 – 59', color: 'bg-orange-500' },
                  { grade: 'F', range: 'Below 50', color: 'bg-red-500' },
                ].map(g => (
                  <div key={g.grade} className="flex items-center gap-2">
                    <span className={`flex size-6 items-center justify-center rounded text-xs font-bold text-white ${g.color}`}>{g.grade}</span>
                    <span className="text-muted-foreground">{g.range}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
