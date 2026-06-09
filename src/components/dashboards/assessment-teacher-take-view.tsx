'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { QuestionRenderer } from '@/components/assessment-hub/question-renderer';
import { SectionProgress } from '@/components/assessment-hub/section-progress';
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function AssessmentTeacherTakeView() {
  const { currentUser, setCurrentView } = useAppStore();
  const [assessment, setAssessment] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const schoolId = currentUser.schoolId || '';

  const fetchAssessment = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessment-hub/teacher?schoolId=${schoolId}&status=PUBLISHED`);
      if (res.ok) {
        const data = await res.json();
        const items = data.data || [];
        if (items.length > 0) {
          const detailRes = await fetch(`/api/assessment-hub/teacher/${items[0].id}`);
          if (detailRes.ok) setAssessment(await detailRes.json());
        }
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchAssessment(); }, [fetchAssessment]);

  const sections = useMemo(() => assessment?.sections || [], [assessment]);
  const questions = sections[currentSectionIdx]?.questions || [];
  const currentQuestion = questions[currentQuestionIdx];

  const sectionProgress = useMemo(() => sections.map((s: any) => ({
    id: s.id, title: s.title,
    totalQuestions: s.questions?.length || 0,
    answeredQuestions: (s.questions || []).filter((q: any) => answers[q.id] !== undefined).length,
  })), [sections, answers]);

  const handleStart = async () => {
    try {
      const teacherRes = await fetch(`/api/teacher?userId=${currentUser.id}&schoolId=${schoolId}`);
      const teacherData = await teacherRes.json();
      const teacherId = teacherData.data?.[0]?.id;
      if (!teacherId) { toast.error('Teacher profile not found'); return; }
      const res = await fetch('/api/assessment-hub/teacher/attempts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId: assessment.id, teacherId }),
      });
      if (res.ok) { setStarted(true); }
      else { const err = await res.json(); toast.error(err.error || 'Failed'); }
    } catch { toast.error('Failed to start'); }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const teacherRes = await fetch(`/api/teacher?userId=${currentUser.id}&schoolId=${schoolId}`);
      const teacherData = await teacherRes.json();
      const teacherId = teacherData.data?.[0]?.id;
      const attemptsRes = await fetch(`/api/assessment-hub/teacher/attempts?teacherId=${teacherId}&assessmentId=${assessment.id}`);
      const attemptsData = await attemptsRes.json();
      const attemptId = attemptsData.data?.[0]?.id;
      if (!attemptId) { toast.error('Attempt not found'); setSubmitting(false); return; }
      const res = await fetch(`/api/assessment-hub/teacher/attempts/${attemptId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) { toast.success('Submitted!'); setCompleted(true); }
      else { const err = await res.json(); toast.error(err.error || 'Failed'); }
    } catch { toast.error('Failed to submit'); } finally { setSubmitting(false); }
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  if (!assessment) return (
    <div className="flex flex-col items-center justify-center py-20">
      <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
      <p className="text-muted-foreground">No published assessments available</p>
    </div>
  );

  if (completed) return (
    <div className="flex flex-col items-center justify-center py-20">
      <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Assessment Submitted!</h2>
      <div className="flex gap-3 mt-4">
        <Button onClick={() => setCurrentView('assessment-teacher-results')}>View Results</Button>
        <Button variant="outline" onClick={() => setCurrentView('assessment-teacher-list')}>Back</Button>
      </div>
    </div>
  );

  if (!started) return (
    <div className="max-w-2xl mx-auto pt-10 space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-xl">{assessment.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>{assessment.description}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Type:</span> {assessment.type}</div>
            <div><span className="text-muted-foreground">Sections:</span> {sections.length}</div>
          </div>
          <Button className="w-full" onClick={handleStart}><PlayIcon className="h-4 w-4 mr-2" /> Start</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{sections[currentSectionIdx]?.title}</h2>
          <span className="text-sm text-muted-foreground">Q{currentQuestionIdx + 1}/{questions.length}</span>
        </div>
        {currentQuestion && (
          <QuestionRenderer question={currentQuestion} answer={answers[currentQuestion.id]} onAnswerChange={(qId, ans) => setAnswers({ ...answers, [qId]: ans })} />
        )}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => { if (currentQuestionIdx > 0) setCurrentQuestionIdx(currentQuestionIdx - 1); }} disabled={currentQuestionIdx === 0}><ArrowLeft className="h-4 w-4 mr-2" /> Previous</Button>
          {currentSectionIdx === sections.length - 1 && currentQuestionIdx === questions.length - 1 ? (
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</Button>
          ) : (
            <Button onClick={() => { if (currentQuestionIdx < questions.length - 1) setCurrentQuestionIdx(currentQuestionIdx + 1); else if (currentSectionIdx < sections.length - 1) { setCurrentSectionIdx(currentSectionIdx + 1); setCurrentQuestionIdx(0); } }}>Next <ArrowRight className="h-4 w-4 ml-2" /></Button>
          )}
        </div>
      </div>
      <div className="w-64 hidden lg:block">
        <SectionProgress sections={sectionProgress} currentSectionId={sections[currentSectionIdx]?.id} className="sticky top-4" />
      </div>
    </div>
  );
}

function PlayIcon(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>; }
