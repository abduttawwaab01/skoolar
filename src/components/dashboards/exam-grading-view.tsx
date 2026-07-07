'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft, Brain, Sparkles, CheckCircle2, AlertCircle, Loader2, Save, User,
  FileText, Clock, Shield, History
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface QuestionGrading {
  questionId: string;
  type: string;
  questionText: string;
  marks: number;
  options: any;
  correctAnswer: any;
  studentAnswer: any;
  isSubjective: boolean;
  needsManualGrading: boolean;
}

interface AttemptRecord {
  id: string;
  studentId: string;
  student: {
    admissionNo: string;
    user: { name: string; avatar: string | null };
    class: { name: string; section: string | null };
  };
  status: string;
  autoScore: number;
  manualScore: number;
  finalScore: number;
  submittedAt: string | null;
  questionGrading: QuestionGrading[];
  needsManualGrading: boolean;
}

interface ExamGradingViewProps {
  examId: string;
  onBack: () => void;
}

export function ExamGradingView({ examId, onBack }: ExamGradingViewProps) {
  const [loading, setLoading] = React.useState(true);
  const [attempts, setAttempts] = React.useState<AttemptRecord[]>([]);
  const [examInfo, setExamInfo] = React.useState<any>(null);
  const [selectedAttempt, setSelectedAttempt] = React.useState<AttemptRecord | null>(null);
  const [manualScores, setManualScores] = React.useState<Record<string, number>>({});
  const [saving, setSaving] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState<string | null>(null); // questionId

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/exams/${examId}/grade`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAttempts(json.data || []);
      setExamInfo(json.exam);
    } catch (err) {
      toast.error('Failed to load grading data');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAttempt = (attempt: AttemptRecord) => {
    setSelectedAttempt(attempt);
    // Initialize manual scores with existing scores if any
    const scores: Record<string, number> = {};
    attempt.questionGrading.forEach(q => {
      // If we had per-question manual scores saved, we'd load them here.
      // For now, we'll initialize with 0 or the current manualScore if it's a single value
    });
    setManualScores({});
  };

  const handleAiAssist = async (question: QuestionGrading) => {
    if (!question.studentAnswer) {
      toast.error('No student answer to analyze');
      return;
    }
    setAiLoading(question.questionId);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are an expert AI grading assistant. Grade the student answer based on the question and marks provided.
              Respond in JSON format: {"score": number, "feedback": "string"}.
              Max marks for this question: ${question.marks}.`
            },
            {
              role: 'user',
              content: `Question: ${question.questionText}\nStudent Answer: ${question.studentAnswer}`
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      const content = data.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.min(question.marks, Math.max(0, parsed.score));
        setManualScores(prev => ({ ...prev, [question.questionId]: score }));
        toast.success(`AI Suggestion: ${score}/${question.marks}`, { description: parsed.feedback });
      }
    } catch (err) {
      toast.error('AI analysis failed');
    } finally {
      setAiLoading(null);
    }
  };

  const saveGrading = async () => {
    if (!selectedAttempt) return;
    setSaving(true);
    try {
      const finalManualScore = Object.values(manualScores).reduce((sum, s) => sum + s, 0);
      const res = await fetch(`/api/exams/${examId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: selectedAttempt.id,
          scores: manualScores,
          finalManualScore,
        }),
      });

      if (!res.ok) throw new Error('Failed to save grading');
      toast.success('Grading saved successfully');
      setSelectedAttempt(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save grading');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0"><ChevronLeft className="size-5" /></Button>
        <div>
          <h2 className="text-lg sm:text-xl font-bold">{examInfo?.name} - Individual Grading</h2>
          <p className="text-sm text-muted-foreground">{attempts.length} total attempts found</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attempts List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Student Attempts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px] sm:h-[600px]">
              <div className="divide-y">
                {attempts.map(attempt => (
                  <div
                    key={attempt.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedAttempt?.id === attempt.id ? 'bg-muted' : ''}`}
                    onClick={() => openAttempt(attempt)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm">{attempt.student.user.name}</p>
                      <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'} className="text-[10px]">
                        {attempt.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{attempt.student.admissionNo}</span>
                      {attempt.needsManualGrading && (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <AlertCircle className="size-3" /> Needs Grading
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {attempts.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">No attempts yet</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Grading Panel */}
        <Card className="lg:col-span-2">
          {selectedAttempt ? (
            <>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <User className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{selectedAttempt.student.user.name}</CardTitle>
                      <CardDescription className="truncate">{selectedAttempt.student.admissionNo} | {selectedAttempt.student.class.name}</CardDescription>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Auto Score</p>
                    <p className="text-lg font-bold">{selectedAttempt.autoScore} / {examInfo.totalMarks}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px] sm:h-[500px]">
                  <div className="p-6 space-y-8">
                    {selectedAttempt.questionGrading.map((q, idx) => (
                      <div key={q.questionId} className="space-y-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono">Q{idx + 1}</Badge>
                              <span className="text-xs text-muted-foreground uppercase">{q.type.replace('_', ' ')}</span>
                            </div>
                            <p className="text-sm font-medium">{q.questionText}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">Marks:</span>
                            <Input
                              type="number"
                              max={q.marks}
                              min={0}
                              className="w-16 h-9 sm:h-8 text-sm"
                              value={manualScores[q.questionId] ?? (q.isSubjective ? '' : (q.studentAnswer === q.correctAnswer ? q.marks : 0))}
                              onChange={(e) => setManualScores(prev => ({ ...prev, [q.questionId]: parseFloat(e.target.value) || 0 }))}
                              disabled={!q.isSubjective}
                            />
                            <span className="text-xs text-muted-foreground">/ {q.marks}</span>
                          </div>
                        </div>

                        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Student Answer</p>
                            <div className="text-sm bg-white border rounded-md p-3 whitespace-pre-wrap">
                              {q.studentAnswer || <span className="italic text-muted-foreground">No answer provided</span>}
                            </div>
                          </div>

                          {q.isSubjective && q.studentAnswer && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleAiAssist(q)}
                              disabled={aiLoading === q.questionId}
                            >
                              {aiLoading === q.questionId ? <Loader2 className="size-3 animate-spin" /> : <Brain className="size-3" />}
                              AI GRADE ASSIST
                            </Button>
                          )}
                        </div>
                        <Separator />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-4 sm:p-6 bg-muted/10 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Calculated Manual Score</p>
                    <p className="text-xl font-black">{Object.values(manualScores).reduce((sum, s) => sum + s, 0)}</p>
                  </div>
                  <Button onClick={saveGrading} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save Final Grades
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="h-[300px] sm:h-[600px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <FileText className="size-12 opacity-20" />
              <p className="text-sm">Select a student attempt to start grading</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
