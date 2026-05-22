'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BookText, BookOpen, Target, Search, FileText, Trophy, ChevronRight, RotateCcw, CheckCircle2, XCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface LessonPlan {
  id: string;
  subjectId: string | null;
  classId: string | null;
  topic: string;
  content: string | null;
  objectives: string | null;
  activities: string | null;
  resources: string | null;
  quiz: string | null;
  masteryThresholds: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  subject: { id: string; name: string; code?: string | null } | null;
  class: { id: string; name: string; section?: string | null } | null;
}

interface Attempt {
  id: string;
  attemptNumber: number;
  answers: Record<string, string> | null;
  score: number | null;
  totalMarks: number;
  masteryLevel: string | null;
  passed: boolean | null;
  completedAt: string | null;
}

interface QuizQuestion {
  type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER';
  questionText: string;
  options: string[];
  correctAnswer: string;
  marks: number;
}

type ViewState = 'list' | 'reading' | 'quiz' | 'result';

const MASTERY_COLORS: Record<string, string> = {
  beginner: 'bg-gray-100 text-gray-700 border-gray-300',
  intermediate: 'bg-blue-100 text-blue-700 border-blue-300',
  advanced: 'bg-purple-100 text-purple-700 border-purple-300',
  mastered: 'bg-amber-100 text-amber-700 border-amber-300',
};
const MASTERY_ICONS: Record<string, string> = { beginner: '🌱', intermediate: '📗', advanced: '📘', mastered: '🏆' };

export function StudentLessonPlans() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';
  const userId = currentUser?.id || '';

  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [subjectOptions, setSubjectOptions] = useState<{ id: string; name: string }[]>([]);

  // Detail / reading state
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('list');
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Result state
  const [lastResult, setLastResult] = useState<{
    score: number; totalMarks: number; masteryLevel: string; passed: boolean; attemptNumber: number;
  } | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/subjects?schoolId=${schoolId}&limit=50`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setSubjectOptions(j.data || []))
      .catch(() => {});
  }, [schoolId]);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId, limit: '100' });
      const res = await fetch(`/api/lesson-plans?${params}`);
      if (res.ok) {
        const json = await res.json();
        const all = json.data || [];
        setPlans(all.filter((p: LessonPlan) => p.status === 'published' || p.status === 'active'));
      }
    } catch {
      toast.error('Failed to load lesson notes');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const fetchAttempts = async (planId: string) => {
    try {
      const params = new URLSearchParams({ studentId: userId });
      const res = await fetch(`/api/lesson-plans/${planId}/attempt?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAttempts(json.data?.attempts || []);
        setQuizQuestions(json.data?.quiz || []);
      }
    } catch { /* ignore */ }
  };

  const openDetail = (plan: LessonPlan) => {
    setSelectedPlan(plan);
    setViewState('reading');
    setLastResult(null);
    setAnswers({});
    setDetailOpen(true);
    fetchAttempts(plan.id);
  };

  const startQuiz = () => {
    setAnswers({});
    setViewState('quiz');
  };

  const handleAnswerChange = (questionIndex: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: value }));
  };

  const submitQuiz = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/lesson-plans/${selectedPlan.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: userId, answers }),
      });
      if (res.ok) {
        const json = await res.json();
        setLastResult({
          score: json.score,
          totalMarks: json.totalMarks,
          masteryLevel: json.masteryLevel,
          passed: json.passed,
          attemptNumber: json.attemptNumber,
        });
        setViewState('result');
        // Refresh attempts list
        fetchAttempts(selectedPlan.id);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to submit quiz');
      }
    } catch {
      toast.error('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReattempt = () => {
    setAnswers({});
    setLastResult(null);
    setViewState('reading');
  };

  const handleClose = () => {
    setDetailOpen(false);
    setViewState('list');
    setSelectedPlan(null);
    setAttempts([]);
    setQuizQuestions([]);
    setLastResult(null);
    setAnswers({});
  };

  const filteredPlans = plans.filter(p => {
    if (subjectFilter !== 'all' && p.subject?.name !== subjectFilter) return false;
    if (search && !p.topic.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasQuiz = (plan: LessonPlan) => {
    if (!plan.quiz) return false;
    try { const q = JSON.parse(plan.quiz); return Array.isArray(q) && q.length > 0; } catch { return false; }
  };

  const latestAttempt = attempts.length > 0 ? attempts[0] : null;
  const answeredCount = Object.keys(answers).length;

  if (!schoolId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Select a school to view lesson notes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Lesson Notes</h2>
        <p className="text-sm text-muted-foreground">Study materials prepared by your teachers</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search topics..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjectOptions.map(s => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <Card className="py-12 text-center">
          <BookText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No lesson notes available</p>
          <p className="text-sm text-muted-foreground mt-1">Your teachers haven&apos;t published any lesson notes yet</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlans.map(plan => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(plan)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <BookText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm leading-tight truncate">{plan.topic}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {plan.subject && (
                        <Badge variant="secondary" className="text-[10px]">{plan.subject.name}</Badge>
                      )}
                      {plan.class && (
                        <Badge variant="outline" className="text-[10px]">{plan.class.name}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {plan.content && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{plan.content.replace(/[#*\[\]]/g, '').substring(0, 100)}</p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t">
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {plan.content ? 'Has content' : 'No content'}</span>
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {hasQuiz(plan) ? 'Has quiz' : 'No quiz'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail / Reading / Quiz / Result Dialog */}
      <Dialog open={detailOpen} onOpenChange={open => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPlan && viewState === 'reading' && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                      <BookText className="h-5 w-5 shrink-0" />
                      {selectedPlan.topic}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedPlan.subject?.name}{selectedPlan.class ? ` — ${selectedPlan.class.name}` : ''}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Previous attempts summary */}
              {latestAttempt && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border">
                  <Trophy className="h-6 w-6 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {latestAttempt.passed ? 'Quiz passed!' : 'Previous attempt'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Score: {latestAttempt.score}/{latestAttempt.totalMarks}</span>
                      {latestAttempt.masteryLevel && (
                        <Badge variant="outline" className={`text-[10px] ${MASTERY_COLORS[latestAttempt.masteryLevel] || ''}`}>
                          {MASTERY_ICONS[latestAttempt.masteryLevel] || ''} {latestAttempt.masteryLevel}
                        </Badge>
                      )}
                      <span>Attempt #{latestAttempt.attemptNumber}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Note Content */}
              {selectedPlan.content && (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground">
                  <ReactMarkdown>{selectedPlan.content}</ReactMarkdown>
                </div>
              )}

              {/* Bottom actions */}
              <div className="flex items-center gap-3 pt-2 border-t">
                {hasQuiz(selectedPlan) && (
                  <Button onClick={startQuiz} className="gap-2">
                    <FileText className="h-4 w-4" />
                    {latestAttempt ? 'Retake Quiz' : 'Take Quiz'}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {attempts.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {attempts.length} attempt{attempts.length !== 1 ? 's' : ''} · Best: {Math.max(...attempts.filter(a => a.score !== null).map(a => a.score!))}/{attempts[0].totalMarks}
                  </div>
                )}
              </div>
            </>
          )}

          {viewState === 'quiz' && quizQuestions.length > 0 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quiz: {selectedPlan?.topic}
                </DialogTitle>
                <DialogDescription>
                  Answer all questions. You can retake this quiz after submission.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {quizQuestions.map((q, qi) => (
                  <div key={qi} className="space-y-3 p-4 rounded-lg border">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-indigo-600 shrink-0 mt-0.5">Q{qi + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{q.questionText}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {q.type === 'MCQ' ? 'Multiple Choice' : q.type === 'TRUE_FALSE' ? 'True/False' : 'Short Answer'} · {q.marks} mark{q.marks !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {q.type === 'MCQ' && (
                      <RadioGroup
                        value={answers[String(qi)] || ''}
                        onValueChange={v => handleAnswerChange(String(qi), v)}
                        className="space-y-2 pl-6"
                      >
                        {q.options.map((opt, oi) => opt.trim() && (
                          <div key={oi} className="flex items-center gap-2">
                            <RadioGroupItem value={String(oi)} id={`q${qi}-o${oi}`} />
                            <Label htmlFor={`q${qi}-o${oi}`} className="text-sm cursor-pointer">{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {q.type === 'TRUE_FALSE' && (
                      <RadioGroup
                        value={answers[String(qi)] || ''}
                        onValueChange={v => handleAnswerChange(String(qi), v)}
                        className="flex items-center gap-6 pl-6"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="true" id={`q${qi}-true`} />
                          <Label htmlFor={`q${qi}-true`} className="text-sm cursor-pointer">True</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="false" id={`q${qi}-false`} />
                          <Label htmlFor={`q${qi}-false`} className="text-sm cursor-pointer">False</Label>
                        </div>
                      </RadioGroup>
                    )}

                    {q.type === 'SHORT_ANSWER' && (
                      <div className="pl-6">
                        <Input
                          placeholder="Type your answer..."
                          value={answers[String(qi)] || ''}
                          onChange={e => handleAnswerChange(String(qi), e.target.value)}
                          className="text-sm max-w-md"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setViewState('reading')}>
                  Back to Note
                </Button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{answeredCount}/{quizQuestions.length} answered</span>
                  <Button onClick={submitQuiz} disabled={submitting || answeredCount < quizQuestions.length}>
                    {submitting ? 'Submitting...' : 'Submit Quiz'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {viewState === 'result' && lastResult && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Quiz Result
                </DialogTitle>
                <DialogDescription>
                  {selectedPlan?.topic} — Attempt #{lastResult.attemptNumber}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center py-8 space-y-4">
                {/* Score circle */}
                <div className="relative size-32 flex items-center justify-center">
                  <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-gray-200" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke={lastResult.passed ? '#22c55e' : '#ef4444'} strokeWidth="8"
                      strokeDasharray={`${(lastResult.score / lastResult.totalMarks) * 283} 283`} strokeLinecap="round" />
                  </svg>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{lastResult.score}/{lastResult.totalMarks}</p>
                    <p className="text-sm text-muted-foreground">{Math.round((lastResult.score / lastResult.totalMarks) * 100)}%</p>
                  </div>
                </div>

                {lastResult.masteryLevel && (
                  <Badge className={`text-sm px-4 py-1.5 ${MASTERY_COLORS[lastResult.masteryLevel] || ''}`}>
                    {MASTERY_ICONS[lastResult.masteryLevel] || ''} Mastery: {lastResult.masteryLevel.charAt(0).toUpperCase() + lastResult.masteryLevel.slice(1)}
                  </Badge>
                )}

                <p className={`text-sm font-medium ${lastResult.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                  {lastResult.passed ? (
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Congratulations! You passed the quiz.</span>
                  ) : (
                    <span className="flex items-center gap-1"><XCircle className="h-4 w-4" /> You didn&apos;t pass. Review the note and try again.</span>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={handleReattempt} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Review &amp; Retake
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
