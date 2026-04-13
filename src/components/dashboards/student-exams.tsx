'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FileEdit, Clock, Shield, Lock, ChevronRight, ChevronLeft, CheckCircle2,
  AlertTriangle, Calculator as CalcIcon, Flag, XCircle, Trophy,
  RotateCcw, Search, BookOpen, GraduationCap, Loader2, Eye,
  CircleDot, Check, X, FlagIcon, Timer, ArrowRight, ArrowLeft,
  SkipForward, Info, Monitor, Keyboard, Copy, Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { Calculator } from '@/components/shared/calculator';
import { ExamSecurityGuard } from '@/components/shared/exam-security-guard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExamSecuritySettings {
  fullscreen?: boolean;
  tabSwitchWarning?: boolean;
  tabSwitchAutoSubmit?: boolean;
  blockCopyPaste?: boolean;
  blockRightClick?: boolean;
  blockKeyboardShortcuts?: boolean;
  maxTabSwitches?: number;
  webcamMonitor?: boolean;
}

interface Exam {
  id: string;
  name: string;
  type: string;
  totalMarks: number;
  passingMarks: number;
  date: string | null;
  duration: number | null;
  instructions: string | null;
  isLocked: boolean;
  isPublished: boolean;
  securitySettings: string | null;
  allowCalculator: boolean;
  calculatorMode: 'none' | 'basic' | 'scientific' | 'both';
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResult: boolean;
  negativeMarking: number;
  subject: { id: string; name: string; code: string } | null;
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  term: { id: string; name: string } | null;
  teacher: { id: string; user: { name: string } } | null;
  _count: { scores: number };
}

interface Question {
  id: string;
  type: 'MCQ' | 'MULTI_SELECT' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'ESSAY' | 'MATCHING';
  questionText: string;
  options: unknown;
  marks: number;
  explanation: string | null;
  mediaUrl: string | null;
  order: number;
}

interface MatchingPair {
  left: string;
  right: string;
}

interface MatchingOptions {
  pairs: MatchingPair[];
}

interface QuestionResult {
  questionId: string;
  type: string;
  marksAwarded: number;
  isCorrect: boolean;
}

interface SubmitResult {
  attempt: {
    id: string;
    status: string;
    autoScore: number | null;
    manualScore: number | null;
    finalScore: number | null;
    submittedAt: string | null;
    timeTakenSeconds: number | null;
    tabSwitchCount: number;
  };
  autoScore: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  questionResults: QuestionResult[];
}

type Screen = 'list' | 'instructions' | 'exam' | 'results';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJsonParse<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not scheduled';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Skeleton Components ──────────────────────────────────────────────────────

function ExamListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>
              </div>
              <Skeleton className="h-9 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InstructionsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
      <Skeleton className="h-12 w-48" />
    </div>
  );
}

function ExamSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-3 w-full" />
      <div className="grid gap-4 lg:grid-cols-4">
        <Skeleton className="lg:col-span-1 h-[600px]" />
        <Skeleton className="lg:col-span-3 h-[600px]" />
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="size-14 rounded-full bg-muted flex items-center justify-center">
          <Icon className="size-7 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StudentExams() {
  const { currentUser, selectedClassId } = useAppStore();

  // ── Screen state ──
  const [screen, setScreen] = useState<Screen>('list');
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Selected exam state ──
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  // ── Exam taking state ──
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [examStartedAt, setExamStartedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  // ── Security state ──
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [securityViolationLog, setSecurityViolationLog] = useState<{ type: string; timestamp: string; details: string }[]>([]);

  // ── Results state ──
  const [resultData, setResultData] = useState<SubmitResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);

  // ── Loading for specific screens ──
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [examLoading, setExamLoading] = useState(false);

  // ── Timer ref ──
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSubmittedRef = useRef(false);

  // ── Derived values ──
  const currentQuestion = questions[currentQuestionIndex] ?? null;
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    if (a === undefined || a === null || a === '') return false;
    if (Array.isArray(a) && a.length === 0) return false;
    return true;
  }).length;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const parsedSecuritySettings = useMemo((): ExamSecuritySettings => {
    if (!selectedExam?.securitySettings) return {};
    return safeJsonParse<ExamSecuritySettings>(selectedExam.securitySettings) ?? {};
  }, [selectedExam?.securitySettings]);

  // ── Filtered exams ──
  const availableExams = useMemo(() => {
    let filtered = exams.filter((e) => e.isPublished && !e.isLocked);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.subject?.name.toLowerCase().includes(q) ||
          e.class?.name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [exams, searchQuery]);

  const completedExams = useMemo(() => {
    return exams.filter((e) => e._count?.scores > 0);
  }, [exams]);

  // ── Fetch exams ──
  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('schoolId', currentUser.schoolId);
      if (selectedClassId) {
        params.set('classId', selectedClassId);
      }
      params.set('isPublished', 'true');
      params.set('limit', '100');

      const res = await fetch(`/api/exams?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch exams');
      }
      const json = await res.json();
      setExams(json.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast.error('Failed to load exams', { description: message });
    } finally {
      setLoading(false);
    }
  }, [currentUser.schoolId, selectedClassId]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // ── Timer effect ──
  useEffect(() => {
    if (screen !== 'exam' || hasSubmittedRef.current) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Auto-submit on time expiry
          if (!hasSubmittedRef.current) {
            handleAutoSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [screen]);

  // ── Auto-save effect ──
  useEffect(() => {
    if (screen !== 'exam' || !attemptId || hasSubmittedRef.current) {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
      return;
    }

    autoSaveRef.current = setInterval(async () => {
      await autoSaveAnswers();
    }, 30000);

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    };
  }, [screen, attemptId]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  // ── Auto-save function ──
  const autoSaveAnswers = async () => {
    if (!attemptId || !selectedExam || hasSubmittedRef.current) return;
    try {
      setAutoSaving(true);
      const res = await fetch(`/api/exams/${selectedExam.id}/attempt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser.id,
          answers,
          tabSwitchCount,
          securityViolations: securityViolationLog,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('Auto-save warning:', err.error || 'Failed');
      }
    } catch {
      console.warn('Auto-save failed');
    } finally {
      setAutoSaving(false);
    }
  };

  // ── Start exam ──
  const startExam = async () => {
    if (!selectedExam) return;
    try {
      setExamLoading(true);
      setScreen('exam');

      const res = await fetch(`/api/exams/${selectedExam.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: currentUser.id }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to start exam');
      }

      const examData = json.data.exam as Record<string, unknown>;
      const attemptData = json.data.attempt as Record<string, unknown>;

      setAttemptId(attemptData.id as string);

      // Restore answers from attempt if resuming
      const savedAnswers = attemptData.answers as Record<string, unknown> | null;
      if (savedAnswers) {
        setAnswers(savedAnswers);
      }

      // Parse questions
      const rawQuestions = (examData.questions ?? []) as Question[];

      // Shuffle questions if enabled
      let processedQuestions = selectedExam.shuffleQuestions
        ? shuffleArray(rawQuestions)
        : rawQuestions;

      // Shuffle options within each question if enabled
      if (selectedExam.shuffleOptions) {
        processedQuestions = processedQuestions.map((q) => {
          if (q.type === 'MCQ' && Array.isArray(q.options)) {
            return { ...q, options: shuffleArray(q.options) };
          }
          return q;
        });
      }

      setQuestions(processedQuestions);
      setCurrentQuestionIndex(0);

      // Set timer
      const duration = (selectedExam.duration as number) || 60;
      // If resuming, calculate remaining time from startedAt
      const startedAt = attemptData.startedAt as string | null;
      if (startedAt && savedAnswers) {
        const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
        const remaining = Math.max(0, duration * 60 - elapsed);
        setTimeLeft(remaining);
        setExamStartedAt(new Date(startedAt));
      } else {
        setTimeLeft(duration * 60);
        setExamStartedAt(new Date());
      }

      // Restore security data
      const restoredTabCount = (attemptData.tabSwitchCount as number) || 0;
      setTabSwitchCount(restoredTabCount);
      const restoredViolations = attemptData.securityViolations as { type: string; timestamp: string; details: string }[] | null;
      if (restoredViolations) {
        setSecurityViolationLog(restoredViolations);
      }

      hasSubmittedRef.current = false;

      toast.success(json.message || 'Exam started');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start exam';
      toast.error(message);
      setScreen('instructions');
    } finally {
      setExamLoading(false);
    }
  };

  // ── Submit exam ──
  const submitExam = async () => {
    if (!selectedExam || !attemptId || hasSubmittedRef.current) return;
    try {
      setSubmitting(true);
      hasSubmittedRef.current = true;

      // Save answers one last time
      await autoSaveAnswers();

      const res = await fetch(`/api/exams/${selectedExam.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser.id,
          action: 'submit',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        hasSubmittedRef.current = false;
        throw new Error(json.error || 'Failed to submit exam');
      }

      setResultData(json.data);
      toast.success(json.message || 'Exam submitted successfully!');

      if (selectedExam.showResult) {
        setScreen('results');
      } else {
        toast.info('Your results will be available once graded.');
        resetToExamsList();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit';
      toast.error(message);
      hasSubmittedRef.current = false;
    } finally {
      setSubmitting(false);
      setSubmitConfirmOpen(false);
    }
  };

  // ── Auto-submit (timer expiry) ──
  const handleAutoSubmit = useCallback(() => {
    if (hasSubmittedRef.current) return;
    toast.warning('Time is up! Auto-submitting your exam...');
    setTimeout(() => {
      submitExam();
    }, 500);
  }, [attemptId, selectedExam, answers, tabSwitchCount, securityViolationLog]);

  // ── Security callbacks ──
  const handleTabSwitch = useCallback((count: number) => {
    setTabSwitchCount(count);
    setSecurityViolationLog((prev) => [
      ...prev,
      { type: 'tab_switch', timestamp: new Date().toISOString(), details: `Tab switch #${count}` },
    ]);
  }, []);

  const handleSecurityViolation = useCallback((type: string, details: Record<string, unknown>) => {
    setSecurityViolationLog((prev) => [
      ...prev,
      { type, timestamp: new Date().toISOString(), details: String(details.message || type) },
    ]);
  }, []);

  const handleAutoSubmitSecurity = useCallback(() => {
    toast.error('Too many tab switches! Auto-submitting exam...');
    submitExam();
  }, [attemptId, selectedExam]);

  // ── Answer handlers ──
  const setAnswer = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  }, [questions.length]);

  const goToNext = useCallback(() => {
    goToQuestion(currentQuestionIndex + 1);
  }, [currentQuestionIndex, goToQuestion]);

  const goToPrev = useCallback(() => {
    goToQuestion(currentQuestionIndex - 1);
  }, [currentQuestionIndex, goToQuestion]);

  // ── Reset ──
  const resetToExamsList = useCallback(() => {
    setScreen('list');
    setSelectedExam(null);
    setAttemptId(null);
    setQuestions([]);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setFlaggedQuestions(new Set());
    setTimeLeft(0);
    setExamStartedAt(null);
    setTabSwitchCount(0);
    setSecurityViolationLog([]);
    setResultData(null);
    setCalculatorOpen(false);
    hasSubmittedRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    fetchExams();
  }, [fetchExams]);

  // ── Open exam instructions ──
  const openInstructions = useCallback((exam: Exam) => {
    setSelectedExam(exam);
    setScreen('instructions');
  }, []);

  // ── Question type labels ──
  const questionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      MCQ: 'Multiple Choice',
      MULTI_SELECT: 'Multi-Select',
      TRUE_FALSE: 'True / False',
      FILL_BLANK: 'Fill in the Blank',
      SHORT_ANSWER: 'Short Answer',
      ESSAY: 'Essay',
      MATCHING: 'Matching',
    };
    return labels[type] || type;
  };

  // ── Parse matching options ──
  const getMatchingPairs = (options: unknown): MatchingPair[] => {
    if (!options) return [];
    const parsed = typeof options === 'string' ? safeJsonParse<MatchingOptions>(options) : options as MatchingOptions;
    return parsed?.pairs ?? [];
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Results Screen
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'results' && resultData) {
    const { autoScore, totalMarks, percentage, passed, questionResults } = resultData;
    const exam = selectedExam!;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Exam Results</h1>
            <p className="text-muted-foreground">{exam.name} — {exam.subject?.name}</p>
          </div>
          <Button variant="outline" onClick={resetToExamsList}>
            <ArrowLeft className="size-4 mr-2" /> Back to Exams
          </Button>
        </div>

        {/* Score Card */}
        <Card className={cn(
          'border-2',
          passed ? 'border-emerald-300 bg-emerald-50/30' : 'border-red-300 bg-red-50/30'
        )}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className={cn(
                'flex size-28 items-center justify-center rounded-full',
                passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
              )}>
                {passed ? <Trophy className="size-14" /> : <XCircle className="size-14" />}
              </div>
              <div className="text-center md:text-left flex-1">
                <h2 className="text-3xl font-bold">{autoScore} / {totalMarks}</h2>
                <p className="text-lg text-muted-foreground mt-1">{percentage}%</p>
                <Badge className={cn('mt-2', passed ? 'bg-emerald-600' : 'bg-red-600')}>
                  {passed ? 'PASSED' : 'FAILED'}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Passing: {exam.passingMarks}/{exam.totalMarks} ({Math.round((exam.passingMarks / exam.totalMarks) * 100)}%)
                </p>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                {resultData.attempt.timeTakenSeconds != null && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-4" />
                    Time: {formatTime(resultData.attempt.timeTakenSeconds)}
                  </div>
                )}
                {resultData.attempt.tabSwitchCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="size-4" />
                    Tab switches: {resultData.attempt.tabSwitchCount}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  {questionResults.filter((r) => r.isCorrect).length}/{questionResults.length} correct
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Question Breakdown</CardTitle>
            <CardDescription>Review your answers for each question</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {questions.map((q, idx) => {
                  const result = questionResults.find((r) => r.questionId === q.id);
                  const isCorrect = result?.isCorrect ?? false;
                  const marksAwarded = result?.marksAwarded ?? 0;

                  return (
                    <div key={q.id} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                      <div className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium',
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-700'
                          : marksAwarded > 0
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      )}>
                        {isCorrect ? <Check className="size-4" /> : <X className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          Q{idx + 1}. {q.questionText.length > 100 ? q.questionText.slice(0, 100) + '...' : q.questionText}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] px-1.5">{questionTypeLabel(q.type)}</Badge>
                          <span>{marksAwarded}/{q.marks} marks</span>
                        </div>
                        {q.explanation && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Exam Taking Screen
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'exam' && selectedExam) {
    const exam = selectedExam;

    // Loading state
    if (examLoading) return <ExamSkeleton />;

    // No questions
    if (questions.length === 0 && !examLoading) {
      return (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setScreen('instructions')}>
            <ArrowLeft className="size-4 mr-2" /> Back to Instructions
          </Button>
          <EmptyState
            icon={FileEdit}
            title="No Questions Available"
            description="This exam has no questions yet. Please contact your teacher."
          />
        </div>
      );
    }

    const timeWarning = timeLeft <= 60;
    const timeCritical = timeLeft <= 30;

    return (
      <ExamSecurityGuard
        settings={parsedSecuritySettings}
        enabled={true}
        onTabSwitch={handleTabSwitch}
        onAutoSubmit={handleAutoSubmitSecurity}
        onSecurityViolation={handleSecurityViolation}
      >
        <div className="space-y-4">
          {/* Exam Header */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-900 sticky top-0 z-10 py-2 -mx-2 px-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to exit? Your progress will be auto-saved.')) {
                    autoSaveAnswers().finally(() => {
                      setScreen('list');
                      setSelectedExam(null);
                      setQuestions([]);
                      setAttemptId(null);
                      hasSubmittedRef.current = true;
                      if (timerRef.current) clearInterval(timerRef.current);
                      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
                      fetchExams();
                    });
                  }
                }}
              >
                <ArrowLeft className="size-4 mr-1" /> Exit
              </Button>
              <div>
                <h1 className="text-base font-bold leading-tight">{exam.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {exam.subject?.name} · {exam.totalMarks} marks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {autoSaving && (
                <Badge variant="outline" className="gap-1 text-xs text-blue-600 border-blue-200 bg-blue-50">
                  <Loader2 className="size-3 animate-spin" /> Saving...
                </Badge>
              )}
              {tabSwitchCount > 0 && (
                <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200 bg-amber-50">
                  <AlertTriangle className="size-3" /> {tabSwitchCount} switch{tabSwitchCount > 1 ? 'es' : ''}
                </Badge>
              )}
              {exam.allowCalculator && exam.calculatorMode !== 'none' && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('gap-1.5', calculatorOpen && 'bg-emerald-50 border-emerald-300 text-emerald-700')}
                  onClick={() => setCalculatorOpen((v) => !v)}
                >
                  <CalcIcon className="size-4" /> Calculator
                </Button>
              )}
              <Badge
                variant="destructive"
                className={cn(
                  'gap-1 font-mono text-sm px-3 py-1',
                  timeCritical && 'animate-pulse',
                )}
              >
                <Timer className="size-3.5" />
                {formatTime(timeLeft)}
              </Badge>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">
              {answeredCount}/{questions.length} answered
            </span>
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-emerald-600 font-medium">{progressPercent}%</span>
            {timeWarning && (
              <Badge variant="destructive" className="text-[10px] animate-pulse">
                {timeCritical ? 'Time critical!' : 'Hurry!'}
              </Badge>
            )}
          </div>

          {/* Main Layout */}
          <div className="grid gap-4 lg:grid-cols-4">
            {/* Question Navigation Sidebar */}
            <Card className="lg:col-span-1 order-2 lg:order-1">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Questions</h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-1.5">
                  {questions.map((q, i) => {
                    const isAnswered = (() => {
                      const a = answers[q.id];
                      if (a === undefined || a === null || a === '') return false;
                      if (Array.isArray(a) && a.length === 0) return false;
                      return true;
                    })();
                    const isFlagged = flaggedQuestions.has(q.id);
                    const isCurrent = i === currentQuestionIndex;

                    return (
                      <button
                        key={q.id}
                        onClick={() => goToQuestion(i)}
                        title={`Q${i + 1}${isAnswered ? ' (Answered)' : ''}${isFlagged ? ' (Flagged)' : ''}`}
                        className={cn(
                          'relative flex size-10 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                          isCurrent && 'ring-2 ring-emerald-500 ring-offset-1',
                          isAnswered && isCurrent && 'bg-emerald-600 text-white',
                          isAnswered && !isCurrent && 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                          isFlagged && !isAnswered && !isCurrent && 'bg-amber-100 text-amber-700 border border-amber-200',
                          !isAnswered && !isFlagged && !isCurrent && 'bg-muted hover:bg-muted/80 text-muted-foreground',
                        )}
                      >
                        {i + 1}
                        {isFlagged && (
                          <FlagIcon className="absolute -top-0.5 -right-0.5 size-3 text-amber-500 fill-amber-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-emerald-600" /> Current
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-emerald-100 border border-emerald-200" /> Answered
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-amber-100 border border-amber-200" /> Flagged
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-sm bg-muted" /> Unanswered
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Exam Info */}
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span className="font-medium">{formatDuration(exam.duration || 60)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Marks</span>
                    <span className="font-medium">{exam.totalMarks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Passing</span>
                    <span className="font-medium">{exam.passingMarks}</span>
                  </div>
                  {exam.negativeMarking > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Negative Marking</span>
                      <span className="font-medium">-{exam.negativeMarking}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                {/* Submit Button */}
                <Button
                  className="w-full"
                  onClick={() => setSubmitConfirmOpen(true)}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><CheckCircle2 className="size-4 mr-2" /> Submit Exam</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Question Display */}
            <Card className="lg:col-span-3 order-1 lg:order-2">
              <CardContent className="p-6">
                {currentQuestion && (
                  <div className="space-y-6">
                    {/* Question Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          Q{currentQuestionIndex + 1}/{questions.length}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {questionTypeLabel(currentQuestion.type)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'gap-1 text-xs',
                          flaggedQuestions.has(currentQuestion.id) && 'text-amber-600',
                        )}
                        onClick={() => toggleFlag(currentQuestion.id)}
                      >
                        <FlagIcon className={cn(
                          'size-3.5',
                          flaggedQuestions.has(currentQuestion.id) && 'fill-amber-500 text-amber-500',
                        )} />
                        {flaggedQuestions.has(currentQuestion.id) ? 'Flagged' : 'Flag for Review'}
                      </Button>
                    </div>

                    {/* Question Text */}
                    <div className="text-base font-medium leading-relaxed whitespace-pre-wrap">
                      {currentQuestion.questionText}
                    </div>

                    {/* Question Media */}
                    {currentQuestion.mediaUrl && (
                      <div className="rounded-lg overflow-hidden border bg-muted/30">
                        <img
                          src={currentQuestion.mediaUrl}
                          alt="Question media"
                          className="max-h-64 object-contain mx-auto"
                        />
                      </div>
                    )}

                    {/* Question Type Renderer */}
                    <div className="space-y-3">
                      {renderQuestionInput(currentQuestion)}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={goToPrev}
                        disabled={currentQuestionIndex === 0}
                      >
                        <ArrowLeft className="size-4 mr-2" /> Previous
                      </Button>
                      <div className="flex items-center gap-2">
                        {currentQuestionIndex < questions.length - 1 ? (
                          <Button onClick={goToNext}>
                            Next <ArrowRight className="size-4 ml-2" />
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setSubmitConfirmOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="size-4 mr-2" /> Submit Exam
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Calculator */}
          {exam.allowCalculator && exam.calculatorMode !== 'none' && calculatorOpen && (
            <Calculator
              mode={exam.calculatorMode === 'scientific' ? 'scientific' : 'basic'}
              allowedMode={exam.calculatorMode}
              isOpen={calculatorOpen}
              onToggle={() => setCalculatorOpen(false)}
            />
          )}

          {/* Submit Confirmation Dialog */}
          <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-amber-500" /> Submit Exam
                </DialogTitle>
                <DialogDescription>
                  You have answered {answeredCount} out of {questions.length} questions.
                  {answeredCount < questions.length && (
                    <span className="text-amber-600 font-medium">
                      {' '}{questions.length - answeredCount} question(s) are still unanswered.
                    </span>
                  )}
                  {flaggedQuestions.size > 0 && (
                    <span className="text-amber-600 font-medium block mt-1">
                      {flaggedQuestions.size} question(s) flagged for review.
                    </span>
                  )}
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSubmitConfirmOpen(false)}>
                  Continue Exam
                </Button>
                <Button onClick={submitExam} disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><CheckCircle2 className="size-4 mr-2" /> Confirm Submit</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ExamSecurityGuard>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Exam Instructions Screen
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'instructions' && selectedExam) {
    const exam = selectedExam;
    const security = parsedSecuritySettings;

    if (instructionsLoading) return <InstructionsSkeleton />;

    return (
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => { setScreen('list'); setSelectedExam(null); }}>
          <ArrowLeft className="size-4 mr-2" /> Back to Exams
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">{exam.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{exam.subject?.name}</span>
            <span>·</span>
            <span>{exam.class?.name}</span>
            <span>·</span>
            <span>{exam.teacher?.user.name}</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Exam Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileEdit className="size-4 text-emerald-600" /> Exam Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium capitalize">{exam.type}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{formatDate(exam.date)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{formatDuration(exam.duration || 60)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Marks</span>
                <span className="font-medium">{exam.totalMarks}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Passing Marks</span>
                <span className="font-medium">{exam.passingMarks}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Negative Marking</span>
                <span className={cn('font-medium', exam.negativeMarking > 0 ? 'text-red-600' : '')}>
                  {exam.negativeMarking > 0 ? `-${exam.negativeMarking} per wrong answer` : 'None'}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Question Shuffling</span>
                <span className="font-medium">{exam.shuffleQuestions ? 'Enabled' : 'No'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Show Result</span>
                <span className="font-medium">{exam.showResult ? 'After submission' : 'When graded'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Rules & Security */}
          <div className="space-y-6">
            {/* Instructions */}
            {exam.instructions && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="size-4 text-emerald-600" /> Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {exam.instructions}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security Measures */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="size-4 text-emerald-600" /> Security Measures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {security.fullscreen && (
                    <div className="flex items-center gap-2">
                      <Monitor className="size-4 text-amber-500" />
                      <span>Fullscreen mode is <span className="font-medium text-amber-600">required</span></span>
                    </div>
                  )}
                  {security.tabSwitchWarning && (
                    <div className="flex items-center gap-2">
                      <Eye className="size-4 text-amber-500" />
                      <span>Tab switching will be <span className="font-medium text-amber-600">monitored</span>
                        {security.maxTabSwitches ? ` (max ${security.maxTabSwitches} allowed)` : ''}
                      </span>
                    </div>
                  )}
                  {security.tabSwitchAutoSubmit && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-red-500" />
                      <span className="text-red-600 font-medium">Exam auto-submits after max tab switches</span>
                    </div>
                  )}
                  {security.blockCopyPaste && (
                    <div className="flex items-center gap-2">
                      <Copy className="size-4 text-amber-500" />
                      <span>Copy, paste, and cut are <span className="font-medium">blocked</span></span>
                    </div>
                  )}
                  {security.blockRightClick && (
                    <div className="flex items-center gap-2">
                      <Lock className="size-4 text-amber-500" />
                      <span>Right-click is <span className="font-medium">disabled</span></span>
                    </div>
                  )}
                  {security.blockKeyboardShortcuts && (
                    <div className="flex items-center gap-2">
                      <Keyboard className="size-4 text-amber-500" />
                      <span>Keyboard shortcuts are <span className="font-medium">blocked</span></span>
                    </div>
                  )}
                  {security.webcamMonitor && (
                    <div className="flex items-center gap-2">
                      <Camera className="size-4 text-amber-500" />
                      <span>Webcam <span className="font-medium text-amber-600">monitoring</span> is active</span>
                    </div>
                  )}
                  {Object.keys(security).length === 0 && (
                    <p className="text-muted-foreground">No special security measures for this exam.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Calculator Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalcIcon className="size-4 text-emerald-600" /> Calculator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {exam.allowCalculator && exam.calculatorMode !== 'none' ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span>
                        <span className="font-medium text-emerald-600">Allowed</span>
                        {' '}(
                        {exam.calculatorMode === 'scientific' ? 'Scientific' :
                         exam.calculatorMode === 'basic' ? 'Basic' : 'Basic & Scientific'}
                        )
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="size-4 text-red-500" />
                      <span className="text-red-600 font-medium">Calculator not allowed</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Begin Exam Button */}
        <div className="flex items-center gap-4 pt-2">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-base px-8"
            onClick={startExam}
          >
            <GraduationCap className="size-5 mr-2" /> Begin Exam
          </Button>
          <p className="text-xs text-muted-foreground">
            Make sure you have a stable connection. Your progress is auto-saved every 30 seconds.
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Exam List Screen
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Take Exam</h1>
        <p className="text-muted-foreground">View available exams and take assessments</p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search exams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchQuery && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
            <X className="size-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available" className="gap-1.5">
            <BookOpen className="size-3.5" /> Available
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-5">
              {availableExams.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            <CheckCircle2 className="size-3.5" /> Completed
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-5">
              {completedExams.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-4">
          {loading ? (
            <ExamListSkeleton />
          ) : error ? (
            <Card className="border-red-200 bg-red-50/30">
              <CardContent className="p-6 flex items-center gap-3">
                <AlertTriangle className="size-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-800">Failed to load exams</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={fetchExams}>
                  <RotateCcw className="size-3.5 mr-1" /> Retry
                </Button>
              </CardContent>
            </Card>
          ) : availableExams.length === 0 ? (
            <EmptyState
              icon={FileEdit}
              title="No Available Exams"
              description="There are no exams available right now. Check back later or contact your teacher."
            />
          ) : (
            <div className="space-y-3">
              {availableExams.map((exam) => (
                <Card key={exam.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openInstructions(exam)}>
                  <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                        <FileEdit className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{exam.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          {exam.subject && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {exam.subject.name}
                            </Badge>
                          )}
                          {exam.class && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {exam.class.name}
                            </Badge>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" /> {formatDuration(exam.duration || 60)}
                          </span>
                          <span>{exam.totalMarks} marks</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {exam.negativeMarking > 0 && (
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                          Negative: -{exam.negativeMarking}
                        </Badge>
                      )}
                      {exam.allowCalculator && exam.calculatorMode !== 'none' && (
                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50 gap-1">
                          <CalcIcon className="size-3" /> Calc
                        </Badge>
                      )}
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                        Start <ChevronRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {loading ? (
            <ExamListSkeleton />
          ) : completedExams.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No Completed Exams"
              description="You haven't completed any exams yet. Start an exam to see your results here."
            />
          ) : (
            <div className="space-y-3">
              {completedExams.map((exam) => (
                <Card key={exam.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500 shrink-0">
                        <Lock className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{exam.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {exam.subject?.name} · {formatDate(exam.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {exam._count.scores} attempt{exam._count.scores !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant="secondary">Completed</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Question Type Renderers (internal helper)
  // ══════════════════════════════════════════════════════════════════════════

  function renderQuestionInput(q: Question) {
    const currentAnswer = answers[q.id];
    const options = q.options;

    switch (q.type) {
      case 'MCQ': {
        const optionList = Array.isArray(options) ? options as string[] : [];
        const selected = typeof currentAnswer === 'string' ? currentAnswer : '';
        return (
          <div className="space-y-2.5">
            {optionList.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selected === option || selected === String(idx) || selected === letter;
              return (
                <button
                  key={idx}
                  onClick={() => setAnswer(q.id, option)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-all',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                      : 'hover:bg-muted/50 border-muted'
                  )}
                >
                  <span className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {letter}
                  </span>
                  <span className="text-sm">{option}</span>
                </button>
              );
            })}
          </div>
        );
      }

      case 'MULTI_SELECT': {
        const optionList = Array.isArray(options) ? options as string[] : [];
        const selected = Array.isArray(currentAnswer) ? currentAnswer as string[] : [];
        return (
          <div className="space-y-2.5">
            {optionList.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selected.includes(option) || selected.includes(String(idx)) || selected.includes(letter);
              return (
                <button
                  key={idx}
                  onClick={() => {
                    let newSelected: string[];
                    if (selected.includes(option)) {
                      newSelected = selected.filter((s) => s !== option);
                    } else {
                      newSelected = [...selected, option];
                    }
                    setAnswer(q.id, newSelected);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-all',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                      : 'hover:bg-muted/50 border-muted'
                  )}
                >
                  <span className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-medium border-2 transition-colors',
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-muted-foreground/30 text-muted-foreground'
                  )}>
                    {isSelected && <Check className="size-4" />}
                  </span>
                  <span className="text-sm">{option}</span>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground mt-1">Select all that apply.</p>
          </div>
        );
      }

      case 'TRUE_FALSE': {
        const selected = typeof currentAnswer === 'string' ? currentAnswer.toLowerCase() : '';
        return (
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <button
              onClick={() => setAnswer(q.id, 'true')}
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all text-lg font-semibold',
                selected === 'true'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                  : 'border-muted hover:border-emerald-300 hover:bg-emerald-50/50 text-muted-foreground'
              )}
            >
              <CircleDot className={cn('size-8', selected === 'true' ? 'text-emerald-600' : 'text-muted-foreground')} />
              True
            </button>
            <button
              onClick={() => setAnswer(q.id, 'false')}
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all text-lg font-semibold',
                selected === 'false'
                  ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500'
                  : 'border-muted hover:border-red-300 hover:bg-red-50/50 text-muted-foreground'
              )}
            >
              <XCircle className={cn('size-8', selected === 'false' ? 'text-red-600' : 'text-muted-foreground')} />
              False
            </button>
          </div>
        );
      }

      case 'FILL_BLANK': {
        const value = typeof currentAnswer === 'string' ? currentAnswer : '';
        return (
          <div className="max-w-lg">
            <Input
              type="text"
              placeholder="Type your answer here..."
              value={value}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="text-base h-12"
            />
          </div>
        );
      }

      case 'SHORT_ANSWER': {
        const value = typeof currentAnswer === 'string' ? currentAnswer : '';
        return (
          <div className="max-w-2xl">
            <Textarea
              placeholder="Write your short answer here..."
              value={value}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="text-sm min-h-[100px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {value.length}/1000 characters
            </p>
          </div>
        );
      }

      case 'ESSAY': {
        const value = typeof currentAnswer === 'string' ? currentAnswer : '';
        return (
          <div className="max-w-3xl">
            <Textarea
              placeholder="Write your essay here. Be thorough and organized..."
              value={value}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="text-sm min-h-[200px]"
              maxLength={10000}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                {countWords(value)} word{countWords(value) !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {value.length}/10000 characters
              </p>
            </div>
          </div>
        );
      }

      case 'MATCHING': {
        const pairs = getMatchingPairs(options);
        const currentMatching = (typeof currentAnswer === 'object' && currentAnswer !== null && !Array.isArray(currentAnswer))
          ? (currentAnswer as Record<string, string>)
          : {};

        const rightOptions = pairs.map((p) => p.right);

        return (
          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-muted-foreground">Match the items on the left with the correct answers on the right.</p>
            <div className="space-y-3">
              {pairs.map((pair, idx) => {
                const selectedRight = currentMatching[pair.left] || '';
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0 text-sm font-medium bg-muted/50 rounded-lg p-3 truncate">
                      {pair.left}
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Select
                        value={selectedRight}
                        onValueChange={(val) => {
                          setAnswer(q.id, { ...currentMatching, [pair.left]: val });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select match..." />
                        </SelectTrigger>
                        <SelectContent>
                          {rightOptions.map((opt, optIdx) => (
                            <SelectItem key={optIdx} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      default:
        return (
          <p className="text-sm text-muted-foreground">Unsupported question type: {q.type}</p>
        );
    }
  }
}
