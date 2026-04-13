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
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Save, BarChart3, TrendingUp, TrendingDown, Award, Download, Printer, FileText, Loader2,
} from 'lucide-react';

function calculateGrade(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'B': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'C': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'D': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'F': return 'bg-red-100 text-red-700 border-red-200';
    default: return '';
  }
}

interface StudentGrade {
  id: string;
  name: string;
  admissionNo: string;
  score: string;
}

interface ApiClass {
  id: string;
  name: string;
  section: string | null;
}

interface ApiStudent {
  id: string;
  admissionNo: string;
  user: { name: string; email: string };
}

interface ApiExam {
  id: string;
  name: string;
  classId: string;
  subjectId: string;
  totalMarks: number;
  passingMarks: number;
  subject?: { name: string };
}

interface ApiExamScore {
  id: string;
  studentId: string;
  score: number;
  grade: string | null;
  student?: {
    admissionNo: string;
    user: { name: string };
  } | null;
}

export function TeacherGrades() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const printRef = useRef<HTMLDivElement>(null);

  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [classListLoading, setClassListLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // Fetch classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setClassListLoading(true);
        const res = await fetch(`/api/classes?schoolId=${schoolId}&limit=50`);
        if (!res.ok) throw new Error('Failed to load classes');
        const json = await res.json();
        const data: ApiClass[] = json.data || json || [];
        setClasses(data);
        if (data.length > 0 && !selectedClass) {
          setSelectedClass(data[0].id);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load classes');
      } finally {
        setClassListLoading(false);
      }
    };
    if (schoolId) fetchClasses();
  }, [schoolId]);

  // Fetch terms for report card generation
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await fetch(`/api/terms?schoolId=${schoolId}&limit=10`);
        if (!res.ok) return;
        const json = await res.json();
        const data: { id: string; name: string }[] = json.data || json.terms || json || [];
        setTerms(data);
        if (data.length > 0) {
          setSelectedTerm(data[0].id);
        }
      } catch {
        // Silently fail
      }
    };
    if (schoolId) fetchTerms();
  }, [schoolId]);

  // Fetch exams when class changes
  useEffect(() => {
    if (!selectedClass) return;
    const fetchExams = async () => {
      try {
        const res = await fetch(`/api/exams?classId=${selectedClass}&schoolId=${schoolId}&limit=50`);
        if (!res.ok) return;
        const json = await res.json();
        const data: ApiExam[] = json.data || json || [];
        setExams(data);
        if (data.length > 0 && !selectedExam) {
          setSelectedExam(data[0].id);
        }
      } catch {
        // Silently fail
      }
    };
    fetchExams();
  }, [selectedClass, schoolId]);

  // Fetch students and existing scores when class or exam changes
  const loadData = useCallback(async () => {
    if (!selectedClass) return;
    try {
      setStudentsLoading(true);
      setSubmitted(false);

      const [studentsRes] = await Promise.all([
        fetch(`/api/students?classId=${selectedClass}&limit=100`),
      ]);

      if (!studentsRes.ok) throw new Error('Failed to load students');
      const studentsJson = await studentsRes.json();
      const studentData: ApiStudent[] = studentsJson.data || studentsJson || [];

      const initialGrades: StudentGrade[] = studentData.map(s => ({
        id: s.id,
        name: s.user.name,
        admissionNo: s.admissionNo,
        score: '',
      }));

      // Load existing scores if an exam is selected
      if (selectedExam) {
        try {
          const scoresRes = await fetch(`/api/exams/${selectedExam}/scores`);
          if (scoresRes.ok) {
            const scoresJson = await scoresRes.json();
            const scoresData: ApiExamScore[] = scoresJson.data?.scores || scoresJson.scores || [];
            const scoreMap = new Map(scoresData.map(s => [s.studentId, s.score]));
            initialGrades.forEach(g => {
              if (scoreMap.has(g.id)) {
                g.score = String(scoreMap.get(g.id));
              }
            });
          }
        } catch {
          // Silently fail for existing scores
        }
      }

      setGrades(initialGrades);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  }, [selectedClass, selectedExam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClassChange = useCallback((cls: string) => {
    setSelectedClass(cls);
    setSelectedExam('');
  }, []);

  const updateScore = (id: string, score: string) => {
    setSubmitted(false);
    setGrades(prev => prev.map(g => g.id === id ? { ...g, score } : g));
  };

  const handleSubmit = async () => {
    if (!selectedExam) {
      toast.error('Please select an exam');
      return;
    }
    const validGrades = grades.filter(g => g.score !== '');
    if (validGrades.length === 0) {
      toast.error('Please enter at least one score');
      return;
    }

    try {
      setSubmitting(true);
      const scoresPayload = validGrades.map(g => ({
        studentId: g.id,
        score: parseFloat(g.score),
      }));

      const res = await fetch(`/api/exams/${selectedExam}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: scoresPayload }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save grades');
      }

      const result = await res.json();
      setSubmitted(true);
      toast.success(result.message || 'Grades saved successfully');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to save grades');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const scores = grades.map(g => parseFloat(g.score)).filter(s => !isNaN(s));
    if (scores.length === 0) return { average: 0, highest: 0, lowest: 0, passRate: 0, graded: 0, total: grades.length };
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const passed = scores.filter(s => s >= 50).length;
    const passRate = (passed / scores.length) * 100;
    return { average, highest, lowest, passRate, graded: scores.length, total: grades.length };
  }, [grades]);

  if (classListLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || selectedClass;

  // Generate and download report cards
  const handleDownloadReportCards = async (downloadAll: boolean) => {
    const studentIdsToDownload = downloadAll 
      ? grades.map(g => g.id).filter(id => grades.find(g => g.id === id)?.score)
      : Array.from(selectedStudents);

    if (studentIdsToDownload.length === 0) {
      toast.error('No students with scores to generate report cards');
      return;
    }

    setDownloading(true);
    try {
      // Call the report card generation API
      const res = await fetch('/api/report-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          termId: selectedTerm,
          classId: selectedClass,
          studentIds: studentIdsToDownload,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate report cards');

      if (json.data && json.data.length > 0) {
        // Open the report card view in a new window for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Report Cards - ${selectedClassName}</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; }
                  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
                </style>
              </head>
              <body>
                <h2>Report Cards Generated</h2>
                <p>Generated ${json.data.length} report card(s) for ${selectedClassName}</p>
                <p>Please use the Report Cards section to view and print individual report cards.</p>
                <script>window.close()</script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
        toast.success(`Generated ${json.data.length} report card(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate report cards');
    } finally {
      setDownloading(false);
    }
  };

  // Toggle student selection for bulk actions
  const toggleStudentSelection = (id: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllSelection = () => {
    if (selectedStudents.size === grades.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(grades.map(g => g.id)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scores & Reports</h1>
          <p className="text-muted-foreground">Enter scores and generate report cards</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => handleDownloadReportCards(false)} 
            disabled={downloading || selectedStudents.size === 0}
          >
            {downloading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
            Download Selected ({selectedStudents.size})
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleDownloadReportCards(true)} 
            disabled={downloading || grades.filter(g => g.score).length === 0}
          >
            <FileText className="size-4 mr-2" />
            Generate All Report Cards
          </Button>
          <Button onClick={handleSubmit} disabled={submitted || submitting}>
            <Save className="size-4 mr-2" /> {submitting ? 'Saving...' : submitted ? 'Saved ✓' : 'Submit Grades'}
          </Button>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Class</Label>
          <Select value={selectedClass} onValueChange={handleClassChange}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Exam</Label>
          <Select value={selectedExam} onValueChange={setSelectedExam}>
            <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
            <SelectContent>
              {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Term (for Report Cards)</Label>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
            <SelectContent>
              {terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Grade Table */}
        <Card className="lg:col-span-3">
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              {studentsLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedStudents.size === grades.length && grades.length > 0}
                          onChange={toggleAllSelection}
                          className="rounded border-input"
                        />
                      </TableHead>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Admission No</TableHead>
                      <TableHead className="w-32">Score (0-100)</TableHead>
                      <TableHead className="w-20 text-center">Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.map((student, i) => {
                      const score = parseFloat(student.score);
                      const grade = !isNaN(score) ? calculateGrade(score) : '-';
                      return (
                        <TableRow key={student.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="rounded border-input"
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="text-muted-foreground">{student.admissionNo}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="—"
                              className="h-8"
                              value={student.score}
                              onChange={e => updateScore(student.id, e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={grade !== '-' ? gradeColor(grade) : ''}>
                              {grade}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
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
                <p className="text-xs text-muted-foreground">Average Score</p>
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

          {/* Grade Distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Grade Scale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { grade: 'A', range: '80 – 100', color: 'bg-emerald-500' },
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
    </div>
  );
}
