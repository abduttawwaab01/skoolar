'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { QuestionRenderer } from '@/components/assessment-hub/question-renderer';
import { SectionProgress } from '@/components/assessment-hub/section-progress';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function AssessmentStudentTakeView() {
  const { currentUser, setCurrentView } = useAppStore();
  const [assessment, setAssessment] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);

  const schoolId = currentUser.schoolId || '';

  const fetchAssessment = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessment-hub/student?schoolId=${schoolId}&status=PUBLISHED`);
      if (res.ok) {
        const data = await res.json();
        const items = data.data || [];
        if (items.length > 0) {
          const detailRes = await fetch(`/api/assessment-hub/student/${items[0].id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setAssessment(detail);
          }
        }
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchAssessment(); }, [fetchAssessment]);

  const sections = useMemo(() => assessment?.sections || [], [assessment]);
  const currentSection = sections[currentSectionIdx];
  const questions = currentSection?.questions || [];
  const currentQuestion = questions[currentQuestionIdx];

  const answeredCount = useMemo(() => {
    return sections.reduce((sum: number, s: any) =>
      sum + (s.questions || []).filter((q: any) => answers[q.id] !== undefined).length, 0);
  }, [sections, answers]);

  const sectionProgress = useMemo(() => {
    return sections.map((s: any) => ({
      id: s.id,
      title: s.title,
      totalQuestions: s.questions?.length || 0,
      answeredQuestions: (s.questions || []).filter((q: any) => answers[q.id] !== undefined).length,
    }));
  }, [sections, answers]);

  const handleStart = async () => {
    try {
      const studentRes = await fetch(`/api/students?userId=${currentUser.id}&schoolId=${schoolId}`);
      const studentData = await studentRes.json();
      const studentId = studentData.data?.[0]?.id;
      if (!studentId) { toast.error('Student profile not found'); return; }
      const res = await fetch('/api/assessment-hub/student/attempts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId: assessment.id, studentId }),
      });
      if (res.ok) {
        const attemptData = await res.json();
        setAttempt(attemptData);
        setStarted(true);
        if (assessment.durationMinutes) setTimeLeft(assessment.durationMinutes * 60);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to start');
      }
    } catch { toast.error('Failed to start attempt'); }
  };

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || !started) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, started]);

  const handleSubmit = async () => {
    if (!attempt) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/assessment-hub/student/attempts/${attempt.id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          timeTakenSeconds: assessment.durationMinutes ? (assessment.durationMinutes * 60 - (timeLeft || 0)) : undefined,
        }),
      });
      if (res.ok) {
        toast.success('Assessment submitted successfully!');
        setCompleted(true);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to submit');
      }
    } catch { toast.error('Failed to submit'); } finally { setSubmitting(false); }
  };

  const navigateQuestion = (direction: 'prev' | 'next') => {
    if (direction === 'next') {
      if (currentQuestionIdx < questions.length - 1) {
        setCurrentQuestionIdx(currentQuestionIdx + 1);
      } else if (currentSectionIdx < sections.length - 1) {
        setCurrentSectionIdx(currentSectionIdx + 1);
        setCurrentQuestionIdx(0);
      }
    } else {
      if (currentQuestionIdx > 0) {
        setCurrentQuestionIdx(currentQuestionIdx - 1);
      } else if (currentSectionIdx > 0) {
        setCurrentSectionIdx(currentSectionIdx - 1);
        setCurrentQuestionIdx((sections[currentSectionIdx - 1]?.questions?.length || 1) - 1);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No published assessments available</p>
        <Button variant="outline" className="mt-4" onClick={() => setCurrentView('assessment-student-list')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Assessment Submitted!</h2>
        <p className="text-muted-foreground mb-6">Your responses have been recorded and will be graded.</p>
        <div className="flex gap-3">
          <Button onClick={() => setCurrentView('assessment-student-results')}>View Results</Button>
          <Button variant="outline" onClick={() => setCurrentView('assessment-student-list')}>Back to List</Button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{assessment.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{assessment.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Type:</span> {assessment.type}</div>
              <div><span className="text-muted-foreground">Sections:</span> {sections.length}</div>
              <div><span className="text-muted-foreground">Total Questions:</span> {assessment.totalQuestions}</div>
              {assessment.durationMinutes && <div><span className="text-muted-foreground">Duration:</span> {assessment.durationMinutes} min</div>}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Sections:</h3>
              {sections.map((s: any, i: number) => (
                <div key={s.id} className="text-sm p-2 bg-muted rounded-md">
                  <p className="font-medium">{i+1}. {s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.domain?.replace(/_/g, ' ')} - {s.questions?.length || 0} questions</p>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={handleStart}>
              <PlayIcon className="h-4 w-4 mr-2" /> Start Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{currentSection?.title}</h2>
            <p className="text-xs text-muted-foreground">
              Question {currentQuestionIdx + 1} of {questions.length}
              {currentSection?.domain && ` \u2022 ${currentSection.domain.replace(/_/g, ' ')}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {timeLeft !== null && (
              <div className={cn('flex items-center gap-1 text-sm', timeLeft < 60 ? 'text-red-500' : '')}>
                <Clock className="h-4 w-4" />
                {formatTime(timeLeft)}
              </div>
            )}
            <span className="text-sm text-muted-foreground">{answeredCount}/{assessment.totalQuestions}</span>
          </div>
        </div>

        {currentQuestion && (
          <QuestionRenderer
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            onAnswerChange={(qId, ans) => setAnswers({ ...answers, [qId]: ans })}
          />
        )}

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => navigateQuestion('prev')}
            disabled={currentSectionIdx === 0 && currentQuestionIdx === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Previous
          </Button>
          <div className="flex gap-2">
            {currentSectionIdx === sections.length - 1 && currentQuestionIdx === questions.length - 1 ? (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </Button>
            ) : (
              <Button onClick={() => navigateQuestion('next')}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="w-64 hidden lg:block">
        <SectionProgress
          sections={sectionProgress}
          currentSectionId={currentSection?.id}
          onSectionClick={(sectionId) => {
            const idx = sections.findIndex((s: any) => s.id === sectionId);
            if (idx >= 0) { setCurrentSectionIdx(idx); setCurrentQuestionIdx(0); }
          }}
          className="sticky top-4"
        />
      </div>
    </div>
  );
}


function PlayIcon(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>; }
