'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { exportQuestionsPdf, exportResultsPdf } from '@/lib/pdf-export';
import {
  Plus, ArrowLeft, FileEdit, Lock, Eye, Send, Clock, CheckCircle2, Ban,
  AlertCircle, Download, Trash2, Save, GraduationCap, Shield, Settings,
  ClipboardList, BarChart3, Loader2, ChevronUp, ChevronDown, GripVertical,
  Type, ListChecks, ToggleLeft, PenTool, AlignLeft, BookOpen, Shuffle,
  Calculator, Monitor, Copy, MousePointerClick, Keyboard, Camera, Maximize,
  AlertTriangle, Award, Users, Target, TrendingUp, X, Search,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type ExamStatus = 'Active' | 'Locked' | 'Published' | 'Draft';

interface Exam {
  id: string;
  name: string;
  type: string;
  totalMarks: number;
  passingMarks: number;
  date: string | null;
  duration: string | null;
  isLocked: boolean;
  isPublished: boolean;
  instructions: string | null;
  securitySettings: string | null;
  allowCalculator: boolean;
  calculatorMode: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResult: boolean;
  negativeMarking: number;
  subject?: { id: string; name: string; code: string | null };
  class?: { id: string; name: string; section: string | null; grade: string | null };
  term?: { id: string; name: string };
  teacher?: { id: string; user: { name: string } };
  _count?: { scores: number };
  subjectId: string;
  classId: string;
  teacherId: string | null;
  termId: string;
}

interface ExamQuestion {
  id: string;
  examId: string;
  type: string;
  questionText: string;
  options: string[] | { pairs: { left: string; right: string }[] } | null;
  correctAnswer: string | string[] | null;
  marks: number;
  explanation: string | null;
  mediaUrl: string | null;
  order: number;
}

interface ExamAttempt {
  id: string;
  studentId: string;
  student: {
    id: string;
    admissionNo: string;
    user: { name: string; email: string; avatar: string | null };
    class: { name: string; section: string | null } | null;
  };
  status: string;
  autoScore: number | null;
  manualScore: number | null;
  finalScore: number | null;
  timeTakenSeconds: number | null;
  tabSwitchCount: number | null;
  securityViolations: unknown;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  answers: Record<string, unknown> | null;
  questionGrading: {
    questionId: string;
    type: string;
    questionText: string;
    marks: number;
    options: unknown;
    correctAnswer: unknown;
    studentAnswer: unknown;
    isSubjective: boolean;
    needsManualGrading: boolean;
  }[];
  needsManualGrading: boolean;
}

interface ScoreData {
  exam: Exam;
  scores: {
    id: string;
    studentId: string;
    score: number;
    grade: string | null;
    remarks: string | null;
    student: {
      id: string;
      admissionNo: string;
      user: { name: string; email: string; avatar: string | null };
      class: { name: string; section: string | null } | null;
    };
  }[];
  stats: {
    totalScored: number;
    average: number;
    highest: number;
    lowest: number;
    passed: number;
    failed: number;
    passRate: number;
  };
}

interface ApiSubject { id: string; name: string; code: string | null; }
interface ApiClass { id: string; name: string; section: string | null; }

interface ExamSecuritySettings {
  fullscreen: boolean;
  tabSwitchWarning: boolean;
  tabSwitchAutoSubmit: boolean;
  maxTabSwitches: number;
  blockCopyPaste: boolean;
  blockRightClick: boolean;
  blockKeyboardShortcuts: boolean;
  webcamMonitor: boolean;
}

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice', icon: ListChecks },
  { value: 'MULTI_SELECT', label: 'Multi-Select', icon: CheckCircle2 },
  { value: 'TRUE_FALSE', label: 'True / False', icon: ToggleLeft },
  { value: 'FILL_BLANK', label: 'Fill in the Blank', icon: Type },
  { value: 'SHORT_ANSWER', label: 'Short Answer', icon: PenTool },
  { value: 'ESSAY', label: 'Essay', icon: AlignLeft },
  { value: 'MATCHING', label: 'Matching', icon: Shuffle },
] as const;

const DEFAULT_SECURITY: ExamSecuritySettings = {
  fullscreen: false,
  tabSwitchWarning: true,
  tabSwitchAutoSubmit: false,
  maxTabSwitches: 5,
  blockCopyPaste: false,
  blockRightClick: false,
  blockKeyboardShortcuts: false,
  webcamMonitor: false,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getExamStatus(exam: Exam): ExamStatus {
  if (exam.isLocked && exam.isPublished) return 'Published';
  if (exam.isLocked) return 'Locked';
  const examDate = exam.date ? new Date(exam.date) : null;
  if (examDate && examDate >= new Date()) return 'Active';
  return 'Draft';
}

function getStatusBadge(status: ExamStatus) {
  const config: Record<ExamStatus, { icon: typeof CheckCircle2; className: string }> = {
    Active: { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200' },
    Locked: { icon: Lock, className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200' },
    Published: { icon: Eye, className: 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200' },
    Draft: { icon: FileEdit, className: 'bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200' },
  };
  const c = config[status];
  const Icon = c.icon;
  return <Badge variant="outline" className={cn('gap-1 text-xs font-medium', c.className)}><Icon className="size-3" /> {status}</Badge>;
}

function parseSecuritySettings(raw: string | null): ExamSecuritySettings {
  if (!raw) return { ...DEFAULT_SECURITY };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SECURITY, ...parsed };
  } catch {
    return { ...DEFAULT_SECURITY };
  }
}

function formatTime(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function getQuestionTypeBadge(type: string) {
  const colors: Record<string, string> = {
    MCQ: 'bg-violet-100 text-violet-700',
    MULTI_SELECT: 'bg-sky-100 text-sky-700',
    TRUE_FALSE: 'bg-amber-100 text-amber-700',
    FILL_BLANK: 'bg-emerald-100 text-emerald-700',
    SHORT_ANSWER: 'bg-rose-100 text-rose-700',
    ESSAY: 'bg-orange-100 text-orange-700',
    MATCHING: 'bg-indigo-100 text-indigo-700',
  };
  return <Badge variant="outline" className={cn('text-[10px] font-medium', colors[type] || 'bg-gray-100 text-gray-600')}>{type}</Badge>;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TeacherExams() {
  const { currentUser, selectedSchoolId, selectedTermId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const termId = selectedTermId || '';

  // ── State ──
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [classList, setClassList] = useState<ApiClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // View: list vs detail
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [detailTab, setDetailTab] = useState('questions');

  // Create exam dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', subjectId: '', classId: '', type: 'assessment',
    totalMarks: '100', passingMarks: '50', date: '', duration: '', instructions: '',
  });

  // Questions state
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Add/Edit question dialog
  const [qDialogOpen, setQDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
  const [qForm, setQForm] = useState({
    type: 'MCQ' as string,
    questionText: '',
    marks: '1',
    explanation: '',
    mediaUrl: '',
    wordLimit: '',
    options: ['Option A', 'Option B', 'Option C', 'Option D'] as string[],
    correctAnswer: '' as string,
    correctAnswers: [] as string[],
    fillBlanks: [''] as string[],
    matchingPairs: [{ left: '', right: '' }] as { left: string; right: string }[],
    tfAnswer: 'true' as string,
  });
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Delete question
  const [deleteQId, setDeleteQId] = useState<string | null>(null);
  const [deletingQ, setDeletingQ] = useState(false);

  // Settings state
  const [security, setSecurity] = useState<ExamSecuritySettings>({ ...DEFAULT_SECURITY });
  const [settings, setSettings] = useState({
    allowCalculator: true,
    calculatorMode: 'basic',
    shuffleQuestions: false,
    shuffleOptions: false,
    showResult: true,
    negativeMarking: '0',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Submissions / Grading
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  // Grade dialog
  const [gradingAttempt, setGradingAttempt] = useState<ExamAttempt | null>(null);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [gradeScores, setGradeScores] = useState<Record<string, string>>({});
  const [savingGrades, setSavingGrades] = useState(false);

  // Results
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [scoresLoading, setScoresLoading] = useState(false);

  // ── Data Fetching ──

  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (schoolId) params.set('schoolId', schoolId);
      if (termId) params.set('termId', termId);
      params.set('limit', '100');

      const [examsRes, subjectsRes, classesRes] = await Promise.all([
        fetch(`/api/exams?${params.toString()}`),
        fetch(`/api/subjects?schoolId=${schoolId}&limit=100`),
        fetch(`/api/classes?schoolId=${schoolId}&limit=100`),
      ]);

      if (!examsRes.ok) throw new Error('Failed to load exams');
      if (!subjectsRes.ok) throw new Error('Failed to load subjects');
      if (!classesRes.ok) throw new Error('Failed to load classes');

      const ej = await examsRes.json();
      const sj = await subjectsRes.json();
      const cj = await classesRes.json();

      setExams(ej.data || []);
      setSubjects(sj.data || sj || []);
      setClassList(cj.data || cj || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load exam data');
    } finally {
      setLoading(false);
    }
  }, [schoolId, termId]);

  useEffect(() => { if (schoolId) fetchExams(); }, [schoolId, fetchExams]);

  const fetchQuestions = useCallback(async (examId: string) => {
    try {
      setQuestionsLoading(true);
      const res = await fetch(`/api/exams/${examId}/questions?includeAnswers=true`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setQuestions(json.data || []);
    } catch {
      toast.error('Failed to load questions');
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const fetchAttempts = useCallback(async (examId: string) => {
    try {
      setAttemptsLoading(true);
      const res = await fetch(`/api/exams/${examId}/grade`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setAttempts(json.data || []);
    } catch {
      toast.error('Failed to load submissions');
      setAttempts([]);
    } finally {
      setAttemptsLoading(false);
    }
  }, []);

  const fetchScores = useCallback(async (examId: string) => {
    try {
      setScoresLoading(true);
      const res = await fetch(`/api/exams/${examId}/scores`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setScoreData(json.data || null);
    } catch {
      toast.error('Failed to load scores');
      setScoreData(null);
    } finally {
      setScoresLoading(false);
    }
  }, []);

  // ── Handlers ──

  const handleExamClick = (exam: Exam) => {
    setSelectedExam(exam);
    setDetailTab('questions');
    fetchQuestions(exam.id);
  };

  const handleBack = () => {
    setSelectedExam(null);
    setAttempts([]);
    setScoreData(null);
    setQuestions([]);
    setSettingsLoaded(false);
  };

  const handleCreateExam = async () => {
    if (!schoolId || !termId || !createForm.name || !createForm.subjectId || !createForm.classId) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setCreating(true);
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId, termId,
          subjectId: createForm.subjectId,
          classId: createForm.classId,
          teacherId: currentUser.id,
          name: createForm.name,
          type: createForm.type,
          totalMarks: parseInt(createForm.totalMarks) || 100,
          passingMarks: parseInt(createForm.passingMarks) || 50,
          date: createForm.date || null,
          duration: createForm.duration || null,
          instructions: createForm.instructions || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create exam');
      }
      const result = await res.json();
      toast.success(result.message || 'Exam created successfully');
      setCreateOpen(false);
      setCreateForm({ name: '', subjectId: '', classId: '', type: 'assessment', totalMarks: '100', passingMarks: '50', date: '', duration: '', instructions: '' });
      fetchExams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create exam');
    } finally {
      setCreating(false);
    }
  };

  const handleExamAction = async (examId: string, action: string) => {
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Action failed');
      }
      const result = await res.json();
      toast.success(result.message || `Exam ${action}ed`);
      if (selectedExam) {
        setSelectedExam((prev) => prev ? { ...prev, ...(result.data || {}) } : prev);
      }
      fetchExams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // ── Question Handlers ──

  const openAddQuestion = () => {
    setEditingQuestion(null);
    setQForm({
      type: 'MCQ', questionText: '', marks: '1', explanation: '', mediaUrl: '', wordLimit: '',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: '', correctAnswers: [], fillBlanks: [''], tfAnswer: 'true',
      matchingPairs: [{ left: '', right: '' }],
    });
    setQDialogOpen(true);
  };

  const openEditQuestion = (q: ExamQuestion) => {
    setEditingQuestion(q);
    const opts = q.options;
    let parsedOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
    let tfAnswer = 'true';
    let fillBlanks = [''];
    let matchingPairs = [{ left: '', right: '' }];
    let correctAnswer = '';
    let correctAnswers: string[] = [];

    if (q.type === 'MCQ' && Array.isArray(opts)) {
      parsedOptions = opts as string[];
      correctAnswer = (typeof q.correctAnswer === 'string') ? q.correctAnswer : '0';
    } else if (q.type === 'MULTI_SELECT' && Array.isArray(opts)) {
      parsedOptions = opts as string[];
      correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
    } else if (q.type === 'TRUE_FALSE') {
      tfAnswer = q.correctAnswer === 'true' ? 'true' : 'false';
    } else if (q.type === 'FILL_BLANK' && Array.isArray(q.correctAnswer)) {
      fillBlanks = q.correctAnswer as string[];
    } else if (q.type === 'MATCHING' && opts && typeof opts === 'object' && 'pairs' in opts) {
      matchingPairs = (opts as { pairs: { left: string; right: string }[] }).pairs;
    }

    setQForm({
      type: q.type, questionText: q.questionText,
      marks: String(q.marks), explanation: q.explanation || '', mediaUrl: q.mediaUrl || '',
      wordLimit: '',
      options: parsedOptions, correctAnswer, correctAnswers,
      fillBlanks, tfAnswer, matchingPairs,
    });
    setQDialogOpen(true);
  };

  const buildQuestionPayload = () => {
    const base = {
      type: qForm.type,
      questionText: qForm.questionText,
      marks: parseFloat(qForm.marks) || 1,
      explanation: qForm.explanation || null,
      mediaUrl: qForm.mediaUrl || null,
    };

    switch (qForm.type) {
      case 'MCQ':
        return { ...base, options: qForm.options, correctAnswer: qForm.correctAnswer };
      case 'MULTI_SELECT':
        return { ...base, options: qForm.options, correctAnswer: qForm.correctAnswers };
      case 'TRUE_FALSE':
        return { ...base, options: ['True', 'False'], correctAnswer: qForm.tfAnswer };
      case 'FILL_BLANK':
        return { ...base, correctAnswer: qForm.fillBlanks.filter(Boolean) };
      case 'SHORT_ANSWER':
      case 'ESSAY':
        return { ...base };
      case 'MATCHING':
        return { ...base, options: { pairs: qForm.matchingPairs.filter(p => p.left && p.right) }, correctAnswer: qForm.matchingPairs.filter(p => p.left && p.right).map(p => ({ left: p.left, right: p.right })) };
      default:
        return base;
    }
  };

  const handleSaveQuestion = async () => {
    if (!selectedExam || !qForm.questionText.trim()) {
      toast.error('Please enter question text');
      return;
    }
    try {
      setSavingQuestion(true);
      const payload = buildQuestionPayload();

      if (editingQuestion) {
        // Use bulk update endpoint
        const res = await fetch(`/api/exams/${selectedExam.id}/questions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: [{ id: editingQuestion.id, ...payload }] }),
        });
        if (!res.ok) throw new Error('Failed to update question');
        toast.success('Question updated');
      } else {
        const res = await fetch(`/api/exams/${selectedExam.id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to add question');
        }
        toast.success('Question added');
      }
      setQDialogOpen(false);
      fetchQuestions(selectedExam.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!selectedExam || !deleteQId) return;
    try {
      setDeletingQ(true);
      const res = await fetch(`/api/exams/${selectedExam.id}/questions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: deleteQId }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Question deleted');
      setDeleteQId(null);
      fetchQuestions(selectedExam.id);
    } catch {
      toast.error('Failed to delete question');
    } finally {
      setDeletingQ(false);
    }
  };

  const handleDownloadQuestions = () => {
    if (questions.length === 0) {
      toast.error('No questions to export');
      return;
    }
    const headers = ['Order', 'Type', 'Question', 'Options', 'Correct Answer', 'Marks', 'Explanation'];
    const rows = questions.map(q => {
      let optionsStr = '';
      let correctStr = '';
      if (q.type === 'MCQ' && Array.isArray(q.options)) {
        optionsStr = (q.options as string[]).join(' | ');
        correctStr = String(q.correctAnswer || '');
      } else if (q.type === 'MULTI_SELECT' && Array.isArray(q.options)) {
        optionsStr = (q.options as string[]).join(' | ');
        correctStr = Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : String(q.correctAnswer || '');
      } else if (q.type === 'TRUE_FALSE') {
        optionsStr = 'True | False';
        correctStr = String(q.correctAnswer || '');
      } else if (q.type === 'FILL_BLANK') {
        correctStr = Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : String(q.correctAnswer || '');
      } else if (q.type === 'MATCHING' && q.options && typeof q.options === 'object' && 'pairs' in q.options) {
        const pairs = (q.options as { pairs: { left: string; right: string }[] }).pairs;
        optionsStr = pairs.map(p => `${p.left} → ${p.right}`).join(' | ');
        correctStr = 'Matched pairs';
      }
      return [
        q.order + 1,
        q.type,
        `"${q.questionText.replace(/"/g, '""')}"`,
        `"${optionsStr.replace(/"/g, '""')}"`,
        `"${correctStr.replace(/"/g, '""')}"`,
        q.marks,
        `"${(q.explanation || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedExam?.name || 'questions'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Questions downloaded');
  };

  const handleDownloadDocx = async () => {
    if (!selectedExam || questions.length === 0) {
      toast.error('No questions to export');
      return;
    }
    try {
      const res = await fetch(`/api/exams/${selectedExam.id}/export?format=docx`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedExam.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_questions.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Questions exported as DOCX');
    } catch {
      toast.error('Failed to export questions');
    }
  };

  const handleDownloadPdf = () => {
    if (!selectedExam || questions.length === 0) {
      toast.error('No questions to export');
      return;
    }
    exportQuestionsPdf(
      {
        name: selectedExam.name,
        type: selectedExam.type,
        totalMarks: selectedExam.totalMarks,
        passingMarks: selectedExam.passingMarks,
        subject: selectedExam.subject?.name,
        class: selectedExam.class?.name,
        duration: selectedExam.duration ? parseInt(selectedExam.duration) || null : null,
        instructions: selectedExam.instructions,
      },
      questions.map(q => ({
        type: q.type,
        questionText: q.questionText,
        options: JSON.stringify(q.options),
        correctAnswer: JSON.stringify(q.correctAnswer),
        marks: q.marks,
        explanation: q.explanation,
        order: q.order,
      }))
    );
  };

  const handleDownloadResultsDocx = async () => {
    if (!selectedExam || !scoreData || scoreData.scores.length === 0) {
      toast.error('No results to export');
      return;
    }
    try {
      const res = await fetch(`/api/exams/${selectedExam.id}/export-results?format=docx`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedExam.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_results.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Results exported as DOCX');
    } catch {
      toast.error('Failed to export results');
    }
  };

  const handleDownloadResultsPdf = () => {
    if (!selectedExam || !scoreData || scoreData.scores.length === 0) {
      toast.error('No results to export');
      return;
    }
    exportResultsPdf(
      {
        name: selectedExam.name,
        type: selectedExam.type,
        totalMarks: selectedExam.totalMarks,
        passingMarks: selectedExam.passingMarks,
        subject: selectedExam.subject?.name,
        class: selectedExam.class?.name,
      },
      scoreData.scores.map(s => ({
        score: s.score,
        grade: s.grade,
        studentName: s.student?.user?.name,
        admissionNo: s.student?.admissionNo,
      }))
    );
  };

  // ── Settings Handlers ──

  const loadSettings = (exam: Exam) => {
    setSecurity(parseSecuritySettings(exam.securitySettings));
    setSettings({
      allowCalculator: exam.allowCalculator,
      calculatorMode: exam.calculatorMode || 'basic',
      shuffleQuestions: exam.shuffleQuestions,
      shuffleOptions: exam.shuffleOptions,
      showResult: exam.showResult,
      negativeMarking: String(exam.negativeMarking || 0),
    });
    setSettingsLoaded(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedExam) return;
    try {
      setSavingSettings(true);
      const res = await fetch(`/api/exams/${selectedExam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          securitySettings: security,
          allowCalculator: settings.allowCalculator,
          calculatorMode: settings.calculatorMode,
          shuffleQuestions: settings.shuffleQuestions,
          shuffleOptions: settings.shuffleOptions,
          showResult: settings.showResult,
          negativeMarking: parseFloat(settings.negativeMarking) || 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Grading Handlers ──

  const openGrading = (attempt: ExamAttempt) => {
    setGradingAttempt(attempt);
    const initial: Record<string, string> = {};
    attempt.questionGrading.forEach(qg => {
      if (qg.needsManualGrading) {
        initial[qg.questionId] = '';
      }
    });
    setGradeScores(initial);
    setGradeDialogOpen(true);
  };

  const handleSaveGrades = async () => {
    if (!selectedExam || !gradingAttempt) return;
    try {
      setSavingGrades(true);
      const scores: Record<string, number> = {};
      Object.entries(gradeScores).forEach(([qId, val]) => {
        const num = parseFloat(val);
        if (!isNaN(num)) scores[qId] = num;
      });
      const totalManual = Object.values(scores).reduce((a, b) => a + b, 0);
      const res = await fetch(`/api/exams/${selectedExam.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: gradingAttempt.id,
          scores,
          finalManualScore: totalManual,
        }),
      });
      if (!res.ok) throw new Error('Failed to save grades');
      toast.success('Grades saved');
      setGradeDialogOpen(false);
      setGradingAttempt(null);
      fetchAttempts(selectedExam.id);
      fetchScores(selectedExam.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save grades');
    } finally {
      setSavingGrades(false);
    }
  };

  // ── Detail Tab Change Handler ──

  const handleDetailTabChange = (tab: string) => {
    setDetailTab(tab);
    if (!selectedExam) return;
    if (tab === 'questions') fetchQuestions(selectedExam.id);
    else if (tab === 'submissions') fetchAttempts(selectedExam.id);
    else if (tab === 'results') fetchScores(selectedExam.id);
    else if (tab === 'settings' && !settingsLoaded) loadSettings(selectedExam);
  };

  // ── Filtered Exams ──
  const filteredExams = exams.filter(e =>
    !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.subject?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── RENDER ──────────────────────────────────────────────────────────────

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedExam) {
    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mt-0.5">
            <ArrowLeft className="size-4 mr-1" /> Back to Exams
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight truncate">{selectedExam.name}</h1>
              {getStatusBadge(getExamStatus(selectedExam))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedExam.subject?.name} &middot; {selectedExam.class?.name} &middot; {selectedExam.type} &middot; {selectedExam.duration || '—'} &middot; {selectedExam.date ? selectedExam.date.split('T')[0] : 'No date'}
              {selectedExam.totalMarks ? ` · ${selectedExam.totalMarks} marks` : ''}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedExam.isPublished ? (
              <Button variant="outline" size="sm" onClick={() => handleExamAction(selectedExam.id, 'unpublish')}>
                <Ban className="size-3.5 mr-1.5" /> Unpublish
              </Button>
            ) : selectedExam.isLocked ? (
              <Button variant="outline" size="sm" onClick={() => handleExamAction(selectedExam.id, 'unlock')}>
                <Lock className="size-3.5 mr-1.5" /> Unlock
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExamAction(selectedExam.id, 'publish')}>
                  <Send className="size-3.5 mr-1.5" /> Publish
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExamAction(selectedExam.id, 'lock')}>
                  <Lock className="size-3.5 mr-1.5" /> Lock
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Detail Tabs */}
        <Tabs value={detailTab} onValueChange={handleDetailTabChange}>
          <TabsList>
            <TabsTrigger value="questions" className="gap-1.5"><ClipboardList className="size-3.5" /> Questions <Badge variant="secondary" className="ml-1 text-[10px]">{questions.length}</Badge></TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Shield className="size-3.5" /> Settings</TabsTrigger>
            <TabsTrigger value="submissions" className="gap-1.5"><Users className="size-3.5" /> Submissions</TabsTrigger>
            <TabsTrigger value="results" className="gap-1.5"><BarChart3 className="size-3.5" /> Results</TabsTrigger>
          </TabsList>

          {/* ── Questions Tab ── */}
          <TabsContent value="questions" className="mt-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-base font-semibold">Questions ({questions.length})</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadQuestions} disabled={questions.length === 0}>
                  <Download className="size-3.5 mr-1.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadDocx} disabled={questions.length === 0}>
                  <Download className="size-3.5 mr-1.5" /> DOCX
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={questions.length === 0}>
                  <Download className="size-3.5 mr-1.5" /> PDF
                </Button>
                <Button size="sm" onClick={openAddQuestion}><Plus className="size-3.5 mr-1.5" /> Add Question</Button>
              </div>
            </div>

            {questionsLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
            ) : questions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="size-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No questions yet. Add your first question to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <Card key={q.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full w-7 h-7 flex items-center justify-center">{q.order !== undefined ? q.order + 1 : idx + 1}</span>
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => { /* reorder up */ }} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}><ChevronUp className="size-3.5" /></button>
                            <button onClick={() => { /* reorder down */ }} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === questions.length - 1}><ChevronDown className="size-3.5" /></button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {getQuestionTypeBadge(q.type)}
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{q.marks} mark{q.marks > 1 ? 's' : ''}</Badge>
                          </div>
                          <p className="text-sm leading-relaxed line-clamp-2">{q.questionText}</p>
                          {q.explanation && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">💡 {q.explanation}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditQuestion(q)}><FileEdit className="size-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => setDeleteQId(q.id)}><Trash2 className="size-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Settings Tab ── */}
          <TabsContent value="settings" className="mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Security Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Shield className="size-4 text-emerald-600" /> Security Settings</CardTitle>
                  <CardDescription>Control exam security and anti-cheating measures</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Maximize className="size-4 text-muted-foreground" /><Label htmlFor="sec-fullscreen" className="text-sm">Fullscreen Mode</Label></div>
                    <Switch id="sec-fullscreen" checked={security.fullscreen} onCheckedChange={v => setSecurity(p => ({ ...p, fullscreen: v }))} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><AlertTriangle className="size-4 text-muted-foreground" /><Label htmlFor="sec-tabwarn" className="text-sm">Tab Switch Warning</Label></div>
                    <Switch id="sec-tabwarn" checked={security.tabSwitchWarning} onCheckedChange={v => setSecurity(p => ({ ...p, tabSwitchWarning: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Ban className="size-4 text-muted-foreground" /><Label htmlFor="sec-autosubmit" className="text-sm">Auto-Submit on Max Tab Switches</Label></div>
                    <Switch id="sec-autosubmit" checked={security.tabSwitchAutoSubmit} onCheckedChange={v => setSecurity(p => ({ ...p, tabSwitchAutoSubmit: v }))} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="sec-maxtab" className="text-sm whitespace-nowrap">Max Tab Switches</Label>
                    <Input id="sec-maxtab" type="number" min={0} className="w-20 h-8 text-sm" value={security.maxTabSwitches} onChange={e => setSecurity(p => ({ ...p, maxTabSwitches: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Copy className="size-4 text-muted-foreground" /><Label htmlFor="sec-copy" className="text-sm">Block Copy/Paste</Label></div>
                    <Switch id="sec-copy" checked={security.blockCopyPaste} onCheckedChange={v => setSecurity(p => ({ ...p, blockCopyPaste: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><MousePointerClick className="size-4 text-muted-foreground" /><Label htmlFor="sec-rightclick" className="text-sm">Block Right-Click</Label></div>
                    <Switch id="sec-rightclick" checked={security.blockRightClick} onCheckedChange={v => setSecurity(p => ({ ...p, blockRightClick: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Keyboard className="size-4 text-muted-foreground" /><Label htmlFor="sec-kb" className="text-sm">Block Keyboard Shortcuts</Label></div>
                    <Switch id="sec-kb" checked={security.blockKeyboardShortcuts} onCheckedChange={v => setSecurity(p => ({ ...p, blockKeyboardShortcuts: v }))} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Camera className="size-4 text-muted-foreground" /><Label htmlFor="sec-webcam" className="text-sm">Webcam Monitoring</Label></div>
                    <Switch id="sec-webcam" checked={security.webcamMonitor} onCheckedChange={v => setSecurity(p => ({ ...p, webcamMonitor: v }))} />
                  </div>
                </CardContent>
              </Card>

              {/* Calculator + Other */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Calculator className="size-4 text-emerald-600" /> Calculator</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="set-calc" className="text-sm">Allow Calculator</Label>
                      <Switch id="set-calc" checked={settings.allowCalculator} onCheckedChange={v => setSettings(p => ({ ...p, allowCalculator: v }))} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="set-calcmode" className="text-sm whitespace-nowrap">Calculator Mode</Label>
                      <Select value={settings.calculatorMode} onValueChange={v => setSettings(p => ({ ...p, calculatorMode: v }))}>
                        <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="scientific">Scientific</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Settings className="size-4 text-emerald-600" /> Other Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Shuffle className="size-4 text-muted-foreground" /><Label htmlFor="set-shuffleq" className="text-sm">Shuffle Questions</Label></div>
                      <Switch id="set-shuffleq" checked={settings.shuffleQuestions} onCheckedChange={v => setSettings(p => ({ ...p, shuffleQuestions: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Shuffle className="size-4 text-muted-foreground" /><Label htmlFor="set-shuffleo" className="text-sm">Shuffle Options</Label></div>
                      <Switch id="set-shuffleo" checked={settings.shuffleOptions} onCheckedChange={v => setSettings(p => ({ ...p, shuffleOptions: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Eye className="size-4 text-muted-foreground" /><Label htmlFor="set-result" className="text-sm">Show Results to Students</Label></div>
                      <Switch id="set-result" checked={settings.showResult} onCheckedChange={v => setSettings(p => ({ ...p, showResult: v }))} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2"><AlertTriangle className="size-4 text-muted-foreground" /><Label htmlFor="set-negmark" className="text-sm whitespace-nowrap">Negative Marking (per tab)</Label></div>
                      <Input id="set-negmark" type="number" min={0} step={0.5} className="w-20 h-8 text-sm" value={settings.negativeMarking} onChange={e => setSettings(p => ({ ...p, negativeMarking: e.target.value }))} />
                    </div>
                  </CardContent>
                </Card>

                <Button className="w-full" onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                  Save Settings
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Submissions Tab ── */}
          <TabsContent value="submissions" className="mt-4">
            <h2 className="text-base font-semibold mb-4">Submissions & Grading ({attempts.length})</h2>

            {attemptsLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : attempts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="size-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No submissions yet. Students haven&apos;t taken this exam.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Auto Score</TableHead>
                          <TableHead className="text-center">Manual Score</TableHead>
                          <TableHead className="text-center">Final</TableHead>
                          <TableHead className="text-center">Tab Switches</TableHead>
                          <TableHead className="text-center">Time</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attempts.map(a => (
                          <TableRow key={a.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{a.student?.user?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{a.student?.admissionNo || ''}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-[10px]', a.status === 'graded' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : a.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600')}>
                                {a.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium text-sm">{a.autoScore ?? '—'}</TableCell>
                            <TableCell className="text-center font-medium text-sm">{a.manualScore ?? '—'}</TableCell>
                            <TableCell className="text-center font-bold text-sm">{a.finalScore ?? '—'}</TableCell>
                            <TableCell className="text-center text-sm">{a.tabSwitchCount ?? 0}</TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">{formatTime(a.timeTakenSeconds)}</TableCell>
                            <TableCell className="text-right">
                              {a.needsManualGrading && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openGrading(a)}>
                                  <GraduationCap className="size-3" /> Grade
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Results Tab ── */}
          <TabsContent value="results" className="mt-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-base font-semibold">Results</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadResultsDocx} disabled={!scoreData || scoreData.scores.length === 0}>
                  <Download className="size-3.5 mr-1.5" /> DOCX
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadResultsPdf} disabled={!scoreData || scoreData.scores.length === 0}>
                  <Download className="size-3.5 mr-1.5" /> PDF
                </Button>
              </div>
            </div>
            {scoresLoading ? (
              <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : scoreData ? (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                  <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Average Score</p>
                      <p className="text-2xl font-bold text-emerald-600">{scoreData.stats.average}</p>
                      <p className="text-xs text-muted-foreground">out of {selectedExam.totalMarks}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Highest Score</p>
                      <p className="text-2xl font-bold text-blue-600">{scoreData.stats.highest}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Lowest Score</p>
                      <p className="text-2xl font-bold text-amber-600">{scoreData.stats.lowest}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-violet-500">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Pass Rate</p>
                      <p className="text-2xl font-bold text-violet-600">{scoreData.stats.passRate}%</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-rose-500">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Passed / Failed</p>
                      <p className="text-2xl font-bold text-rose-600">{scoreData.stats.passed}<span className="text-sm font-normal text-muted-foreground"> / {scoreData.stats.failed}</span></p>
                    </CardContent>
                  </Card>
                </div>

                {/* Scores Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Student Scores ({scoreData.scores.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Admission No</TableHead>
                            <TableHead className="text-center">Score</TableHead>
                            <TableHead className="text-center">Grade</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scoreData.scores.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No scores recorded yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            scoreData.scores.map((s, idx) => {
                              const pct = selectedExam.totalMarks > 0 ? Math.round((s.score / selectedExam.totalMarks) * 100) : 0;
                              const passed = s.score >= selectedExam.passingMarks;
                              return (
                                <TableRow key={s.id}>
                                  <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                                  <TableCell className="font-medium text-sm">{s.student?.user?.name || 'Unknown'}</TableCell>
                                  <TableCell className="text-muted-foreground text-sm">{s.student?.admissionNo || '—'}</TableCell>
                                  <TableCell className="text-center">
                                    <span className="font-bold text-sm">{s.score}</span>
                                    <span className="text-xs text-muted-foreground">/{selectedExam.totalMarks}</span>
                                    <span className="text-[10px] text-muted-foreground ml-1">({pct}%)</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className={cn('text-xs font-medium', passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
                                      {s.grade || 'N/A'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className={cn('text-[10px]', passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
                                      {passed ? 'Passed' : 'Failed'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="size-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No results available yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Add/Edit Question Dialog ── */}
        <Dialog open={qDialogOpen} onOpenChange={setQDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
              <DialogDescription>{editingQuestion ? 'Modify the question details below' : 'Create a new question for this exam'}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="space-y-5 pb-2">
                {/* Type Selector */}
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {QUESTION_TYPES.map(qt => {
                      const Icon = qt.icon;
                      return (
                        <button
                          key={qt.value}
                          type="button"
                          onClick={() => setQForm(p => ({ ...p, type: qt.value }))}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left',
                            qForm.type === qt.value
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-muted hover:bg-muted/50'
                          )}
                        >
                          <Icon className="size-3.5 shrink-0" />
                          <span className="truncate">{qt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Text */}
                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Textarea
                    placeholder="Enter your question..."
                    rows={3}
                    value={qForm.questionText}
                    onChange={e => setQForm(p => ({ ...p, questionText: e.target.value }))}
                  />
                </div>

                {/* Dynamic Options Based on Type */}
                {(qForm.type === 'MCQ' || qForm.type === 'MULTI_SELECT') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Options</Label>
                      {qForm.type === 'MCQ' && <p className="text-xs text-muted-foreground">Click radio to set correct answer</p>}
                      {qForm.type === 'MULTI_SELECT' && <p className="text-xs text-muted-foreground">Check all correct answers</p>}
                    </div>
                    <div className="space-y-2">
                      {qForm.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {qForm.type === 'MCQ' ? (
                            <input
                              type="radio"
                              name="mcq-answer"
                              checked={qForm.correctAnswer === String(idx)}
                              onChange={() => setQForm(p => ({ ...p, correctAnswer: String(idx) }))}
                              className="accent-emerald-600"
                            />
                          ) : (
                            <Checkbox
                              checked={qForm.correctAnswers.includes(String(idx))}
                              onCheckedChange={checked => {
                                if (checked) {
                                  setQForm(p => ({ ...p, correctAnswers: [...p.correctAnswers, String(idx)] }));
                                } else {
                                  setQForm(p => ({ ...p, correctAnswers: p.correctAnswers.filter(i => i !== String(idx)) }));
                                }
                              }}
                            />
                          )}
                          <Input
                            value={opt}
                            onChange={e => {
                              const newOpts = [...qForm.options];
                              newOpts[idx] = e.target.value;
                              setQForm(p => ({ ...p, options: newOpts }));
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                            className="flex-1 h-9"
                          />
                          {qForm.options.length > 2 && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-red-400 hover:text-red-600" onClick={() => {
                              const newOpts = qForm.options.filter((_, i) => i !== idx);
                              setQForm(p => ({ ...p, options: newOpts }));
                            }}><X className="size-3.5" /></Button>
                          )}
                        </div>
                      ))}
                      {qForm.options.length < 6 && (
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setQForm(p => ({ ...p, options: [...p.options, ''] }))}>
                          <Plus className="size-3 mr-1" /> Add Option
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {qForm.type === 'TRUE_FALSE' && (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <div className="flex gap-3">
                      {['true', 'false'].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setQForm(p => ({ ...p, tfAnswer: val }))}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                            qForm.tfAnswer === val
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-muted hover:bg-muted/50'
                          )}
                        >
                          {val === 'true' ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}
                          {val === 'true' ? 'True' : 'False'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {qForm.type === 'FILL_BLANK' && (
                  <div className="space-y-2">
                    <Label>Acceptable Answers <span className="text-xs text-muted-foreground">(add all correct variants)</span></Label>
                    <div className="space-y-2">
                      {qForm.fillBlanks.map((ans, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={ans}
                            onChange={e => {
                              const newAns = [...qForm.fillBlanks];
                              newAns[idx] = e.target.value;
                              setQForm(p => ({ ...p, fillBlanks: newAns }));
                            }}
                            placeholder={`Acceptable answer ${idx + 1}`}
                            className="flex-1 h-9"
                          />
                          {qForm.fillBlanks.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-red-400 hover:text-red-600" onClick={() => {
                              setQForm(p => ({ ...p, fillBlanks: p.fillBlanks.filter((_, i) => i !== idx) }));
                            }}><X className="size-3.5" /></Button>
                          )}
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setQForm(p => ({ ...p, fillBlanks: [...p.fillBlanks, ''] }))}>
                        <Plus className="size-3 mr-1" /> Add Answer
                      </Button>
                    </div>
                  </div>
                )}

                {qForm.type === 'SHORT_ANSWER' && (
                  <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">Students will provide a free-form text answer. This will require manual grading.</p>
                )}

                {qForm.type === 'ESSAY' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Label className="whitespace-nowrap">Word Limit</Label>
                      <Input
                        type="number"
                        min={50}
                        max={5000}
                        value={qForm.wordLimit}
                        onChange={e => setQForm(p => ({ ...p, wordLimit: e.target.value }))}
                        placeholder="e.g. 500"
                        className="w-32 h-9"
                      />
                      <span className="text-xs text-muted-foreground">words (optional)</span>
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">Students will write an essay. This will require manual grading.</p>
                  </div>
                )}

                {qForm.type === 'MATCHING' && (
                  <div className="space-y-2">
                    <Label>Matching Pairs</Label>
                    <div className="space-y-2">
                      {qForm.matchingPairs.map((pair, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={pair.left}
                            onChange={e => {
                              const newPairs = [...qForm.matchingPairs];
                              newPairs[idx] = { ...newPairs[idx], left: e.target.value };
                              setQForm(p => ({ ...p, matchingPairs: newPairs }));
                            }}
                            placeholder="Left item"
                            className="flex-1 h-9"
                          />
                          <span className="text-muted-foreground text-sm shrink-0">→</span>
                          <Input
                            value={pair.right}
                            onChange={e => {
                              const newPairs = [...qForm.matchingPairs];
                              newPairs[idx] = { ...newPairs[idx], right: e.target.value };
                              setQForm(p => ({ ...p, matchingPairs: newPairs }));
                            }}
                            placeholder="Right item"
                            className="flex-1 h-9"
                          />
                          {qForm.matchingPairs.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-red-400 hover:text-red-600" onClick={() => {
                              setQForm(p => ({ ...p, matchingPairs: p.matchingPairs.filter((_, i) => i !== idx) }));
                            }}><X className="size-3.5" /></Button>
                          )}
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setQForm(p => ({ ...p, matchingPairs: [...p.matchingPairs, { left: '', right: '' }] }))}>
                        <Plus className="size-3 mr-1" /> Add Pair
                      </Button>
                    </div>
                  </div>
                )}

                {/* Marks & Explanation */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marks</Label>
                    <Input type="number" min={1} value={qForm.marks} onChange={e => setQForm(p => ({ ...p, marks: e.target.value }))} className="h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label>Media URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Input value={qForm.mediaUrl} onChange={e => setQForm(p => ({ ...p, mediaUrl: e.target.value }))} placeholder="https://..." className="h-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Explanation <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Textarea placeholder="Explain the correct answer..." rows={2} value={qForm.explanation} onChange={e => setQForm(p => ({ ...p, explanation: e.target.value }))} />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setQDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveQuestion} disabled={savingQuestion || !qForm.questionText.trim()}>
                {savingQuestion ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                {editingQuestion ? 'Update Question' : 'Add Question'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Question Dialog ── */}
        <Dialog open={!!deleteQId} onOpenChange={() => setDeleteQId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Question</DialogTitle>
              <DialogDescription>Are you sure you want to delete this question? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteQId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteQuestion} disabled={deletingQ}>
                {deletingQ ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Trash2 className="size-4 mr-2" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Grading Dialog ── */}
        <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Grade Submission — {gradingAttempt?.student?.user?.name || 'Student'}</DialogTitle>
              <DialogDescription>
                Review and score subjective questions. Auto score: {gradingAttempt?.autoScore ?? 0} | Tab switches: {gradingAttempt?.tabSwitchCount ?? 0}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pb-2">
                {gradingAttempt?.questionGrading
                  .filter(qg => qg.needsManualGrading)
                  .map(qg => (
                    <Card key={qg.questionId} className="border-l-4 border-l-amber-400">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getQuestionTypeBadge(qg.type)}
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{qg.marks} mark{qg.marks > 1 ? 's' : ''}</Badge>
                            </div>
                            <p className="text-sm font-medium">{qg.questionText}</p>
                          </div>
                        </div>

                        {/* Show correct answer if available */}
                        {!!qg.correctAnswer && (
                          <div className="bg-emerald-50 rounded-lg p-3 text-sm">
                            <p className="text-xs font-semibold text-emerald-700 mb-1">Correct Answer:</p>
                            {qg.type === 'MATCHING' && typeof qg.correctAnswer === 'object' && Array.isArray(qg.correctAnswer) ? (
                              <p className="text-emerald-800">
                                {(qg.correctAnswer as { left: string; right: string }[]).map(p => `${p.left} → ${p.right}`).join(' | ')}
                              </p>
                            ) : (
                              <p className="text-emerald-800">{Array.isArray(qg.correctAnswer) ? qg.correctAnswer.join(', ') : String(qg.correctAnswer)}</p>
                            )}
                          </div>
                        )}

                        {/* Student answer */}
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Student Answer:</p>
                          <p className="text-sm whitespace-pre-wrap">
                            {qg.studentAnswer
                              ? (typeof qg.studentAnswer === 'string' ? qg.studentAnswer : JSON.stringify(qg.studentAnswer, null, 2))
                              : <span className="italic text-muted-foreground">No answer provided</span>
                            }
                          </p>
                        </div>

                        {/* Score Input */}
                        <div className="flex items-center gap-3">
                          <Label className="text-sm whitespace-nowrap">Score:</Label>
                          <Input
                            type="number"
                            min={0}
                            max={qg.marks}
                            step={0.5}
                            className="w-24 h-9"
                            placeholder={`0-${qg.marks}`}
                            value={gradeScores[qg.questionId] || ''}
                            onChange={e => setGradeScores(p => ({ ...p, [qg.questionId]: e.target.value }))}
                          />
                          <span className="text-xs text-muted-foreground">/ {qg.marks}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                {gradingAttempt?.questionGrading.filter(qg => qg.needsManualGrading).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No questions need manual grading for this submission.</p>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setGradeDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveGrades} disabled={savingGrades}>
                {savingGrades ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                Save Grades
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EXAM LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exams &amp; Tests</h1>
          <p className="text-muted-foreground">Manage examinations, questions, and grading</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" /> Create Exam</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Exam</DialogTitle>
              <DialogDescription>Fill in the details for the new examination</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Exam Name *</Label>
                <Input placeholder="e.g. Mathematics Mid-Term" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Select value={createForm.subjectId} onValueChange={v => setCreateForm(p => ({ ...p, subjectId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select value={createForm.classId} onValueChange={v => setCreateForm(p => ({ ...p, classId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={createForm.type} onValueChange={v => setCreateForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CA">Continuous Assessment</SelectItem>
                      <SelectItem value="Quiz">Quiz</SelectItem>
                      <SelectItem value="Mid-Term">Mid-Term</SelectItem>
                      <SelectItem value="assessment">Examination</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input placeholder="e.g. 45 mins" value={createForm.duration} onChange={e => setCreateForm(p => ({ ...p, duration: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input type="number" value={createForm.totalMarks} onChange={e => setCreateForm(p => ({ ...p, totalMarks: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Passing Marks</Label>
                  <Input type="number" value={createForm.passingMarks} onChange={e => setCreateForm(p => ({ ...p, passingMarks: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={createForm.date} onChange={e => setCreateForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea placeholder="Special instructions for students..." rows={3} value={createForm.instructions} onChange={e => setCreateForm(p => ({ ...p, instructions: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateExam} disabled={creating || !createForm.name || !createForm.subjectId || !createForm.classId}>
                {creating ? <><Loader2 className="size-4 mr-2 animate-spin" /> Creating...</> : <><Plus className="size-4 mr-2" /> Create Exam</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search exams..."
          className="pl-9"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Exams</p>
            <p className="text-2xl font-bold">{exams.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Published</p>
            <p className="text-2xl font-bold text-blue-600">{exams.filter(e => e.isPublished && e.isLocked).length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active/Draft</p>
            <p className="text-2xl font-bold text-amber-600">{exams.filter(e => !e.isPublished && !e.isLocked).length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">With Scores</p>
            <p className="text-2xl font-bold text-violet-600">{exams.filter(e => (e._count?.scores || 0) > 0).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Exam Cards Grid */}
      {filteredExams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="size-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No exams match your search.' : 'No exams found. Create one to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExams.map(exam => {
            const status = getExamStatus(exam);
            return (
              <Card
                key={exam.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleExamClick(exam)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate group-hover:text-emerald-600 transition-colors">{exam.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{exam.subject?.name || '—'} &middot; {exam.class?.name || '—'}</p>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-3">
                    <Badge variant="outline" className="text-[10px]">{exam.type}</Badge>
                    <span className="flex items-center gap-1"><Clock className="size-3" />{exam.duration || '—'}</span>
                    <span>{exam.date ? exam.date.split('T')[0] : 'No date'}</span>
                    <span className="ml-auto font-medium">{exam.totalMarks} marks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (exam._count?.scores || 0) * 3)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{exam._count?.scores || 0} scored</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
