'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, Pencil, Save, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Eye, Award, ChevronLeft, ChevronRight, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { handleSilentError } from '@/lib/error-handler';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface QuizQuestion {
  id: string;
  type: string;
  questionText: string;
  options: string | null;
  correctAnswer: string | null;
  marks: number;
  order: number;
}

interface LessonQuiz {
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  timeLimit: number | null;
  passingScore: number;
  showResults: boolean;
  isPublished: boolean;
  questions: QuizQuestion[];
}

interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  answers: string | null;
  score: number | null;
  percentage: number | null;
  totalMarks: number;
  status: string;
  passed: boolean | null;
  createdAt: string;
}

function SortableQuestion({ question, index, onEdit, onDelete }: { question: QuizQuestion; index: number; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const typeColors: Record<string, string> = {
    MCQ: 'bg-blue-100 text-blue-700',
    MULTI_SELECT: 'bg-indigo-100 text-indigo-700',
    TRUE_FALSE: 'bg-green-100 text-green-700',
    FILL_BLANK: 'bg-amber-100 text-amber-700',
    SHORT_ANSWER: 'bg-purple-100 text-purple-700',
    ESSAY: 'bg-pink-100 text-pink-700',
    MATCHING: 'bg-cyan-100 text-cyan-700',
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-3 p-4 bg-white rounded-lg border group">
      <div {...attributes} {...listeners} className="mt-1 cursor-grab text-gray-400 hover:text-gray-600"><GripVertical className="h-4 w-4" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-gray-500">Q{index + 1}</span>
          <Badge className={typeColors[question.type] || 'bg-gray-100 text-gray-700'}>{question.type.replace('_', ' ')}</Badge>
          <span className="text-xs text-gray-400">{question.marks} mark{question.marks !== 1 ? 's' : ''}</span>
        </div>
        <p className="text-sm font-medium truncate">{question.questionText}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

export function LessonQuizManager({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';
  const [quizzes, setQuizzes] = useState<LessonQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizDialog, setQuizDialog] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<LessonQuiz | null>(null);
  const [quizForm, setQuizForm] = useState({ title: '', description: '', timeLimit: '', passingScore: '60', showResults: true, isPublished: true });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionDialog, setQuestionDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [qForm, setQForm] = useState({ type: 'MCQ', questionText: '', options: '', correctAnswer: '', marks: '1' });
  const [saving, setSaving] = useState(false);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [activeTab, setActiveTab] = useState('quizzes');

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/quizzes?schoolId=${schoolId}`);
      if (res.ok) {
        const json = await res.json();
        setQuizzes(json.data || []);
        setAttempts(json.attempts || []);
      }
    } catch (error: unknown) { handleSilentError(error); } finally { setLoading(false); }
  }, [lessonId, schoolId]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  const openCreateQuiz = () => {
    setEditingQuiz(null);
    setQuizForm({ title: '', description: '', timeLimit: '', passingScore: '60', showResults: true, isPublished: true });
    setQuestions([]);
    setQuizDialog(true);
  };

  const openEditQuiz = (quiz: LessonQuiz) => {
    setEditingQuiz(quiz);
    setQuizForm({
      title: quiz.title, description: quiz.description || '', timeLimit: quiz.timeLimit?.toString() || '',
      passingScore: quiz.passingScore.toString(), showResults: quiz.showResults, isPublished: quiz.isPublished,
    });
    setQuestions(quiz.questions || []);
    setQuizDialog(true);
  };

  const addQuestion = () => {
    setEditingQuestion(null);
    setQForm({ type: 'MCQ', questionText: '', options: '', correctAnswer: '', marks: '1' });
    setQuestionDialog(true);
  };

  const editQuestion = (q: QuizQuestion) => {
    setEditingQuestion(q);
    setQForm({
      type: q.type, questionText: q.questionText,
      options: q.options ? JSON.parse(q.options).join('\n') : '',
      correctAnswer: q.correctAnswer || '', marks: q.marks.toString(),
    });
    setQuestionDialog(true);
  };

  const saveQuestion = () => {
    if (!qForm.questionText.trim()) { toast.error('Question text is required'); return; }
    const opts = qForm.type === 'MCQ' || qForm.type === 'MULTI_SELECT' || qForm.type === 'TRUE_FALSE'
      ? JSON.stringify(qForm.options.split('\n').filter((o: string) => o.trim()))
      : null;
    const newQ: QuizQuestion = {
      id: editingQuestion?.id || crypto.randomUUID(),
      type: qForm.type, questionText: qForm.questionText, options: opts,
      correctAnswer: qForm.correctAnswer, marks: parseInt(qForm.marks) || 1,
      order: editingQuestion?.order ?? questions.length,
    };
    if (editingQuestion) {
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? newQ : q));
    } else {
      setQuestions(prev => [...prev, newQ]);
    }
    setQuestionDialog(false);
  };

  const deleteQuestion = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setQuestions(prev => {
        const oldIndex = prev.findIndex(q => q.id === active.id);
        const newIndex = prev.findIndex(q => q.id === over.id);
        return arrayMove(prev, oldIndex, newIndex).map((q, i) => ({ ...q, order: i }));
      });
    }
  };

  const saveQuiz = async () => {
    if (!quizForm.title.trim()) { toast.error('Quiz title is required'); return; }
    if (questions.length === 0) { toast.error('Add at least one question'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingQuiz ? 'update' : 'create',
          quizId: editingQuiz?.id,
          schoolId,
          title: quizForm.title,
          description: quizForm.description || null,
          timeLimit: quizForm.timeLimit ? parseInt(quizForm.timeLimit) : null,
          passingScore: parseInt(quizForm.passingScore),
          showResults: quizForm.showResults,
          isPublished: quizForm.isPublished,
          questions: questions.map((q, i) => ({ ...q, order: i })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(editingQuiz ? 'Quiz updated!' : 'Quiz created!');
      setQuizDialog(false);
      fetchQuizzes();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const deleteQuiz = async (quizId: string) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/quizzes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, schoolId }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Quiz deleted');
      fetchQuizzes();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading quizzes...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Quizzes for: {lessonTitle}</h3>
          <p className="text-sm text-muted-foreground">Add questions after this lesson</p>
        </div>
        <Button onClick={openCreateQuiz} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4" /> New Quiz</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quizzes">Quizzes ({quizzes.length})</TabsTrigger>
          <TabsTrigger value="attempts">Student Attempts ({attempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="quizzes" className="mt-4 space-y-3">
          {quizzes.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No quizzes yet. Create one to test students after this lesson.</p></Card>
          ) : quizzes.map(quiz => (
            <Card key={quiz.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{quiz.title}</h4>
                      <Badge variant={quiz.isPublished ? 'default' : 'secondary'} className="text-xs">{quiz.isPublished ? 'Published' : 'Draft'}</Badge>
                    </div>
                    {quiz.description && <p className="text-sm text-muted-foreground mb-2">{quiz.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {quiz.questions.length} questions</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {quiz.timeLimit ? `${Math.floor(quiz.timeLimit / 60)} min` : 'No limit'}</span>
                      <span>Pass: {quiz.passingScore}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditQuiz(quiz)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                    <Button variant="outline" size="sm" className="text-red-500" onClick={() => deleteQuiz(quiz.id)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="attempts" className="mt-4">
          {attempts.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No student attempts yet.</p></Card>
          ) : (
            <div className="space-y-2">
              {attempts.map(a => (
                <Card key={a.id}><CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Student ID: {a.studentId.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === 'passed' ? 'default' : a.status === 'failed' ? 'destructive' : 'secondary'}>{a.status}</Badge>
                    {a.percentage != null && <span className="text-sm font-bold">{a.percentage.toFixed(1)}%</span>}
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quiz Create/Edit Dialog */}
      <Dialog open={quizDialog} onOpenChange={setQuizDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Create Quiz'}</DialogTitle>
            <DialogDescription>Add questions that students will take after this lesson</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Title *</Label><Input value={quizForm.title} onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Post-Lesson Quiz" /></div>
              <div className="space-y-2"><Label>Time Limit (seconds, 0 = none)</Label><Input type="number" value={quizForm.timeLimit} onChange={e => setQuizForm(f => ({ ...f, timeLimit: e.target.value }))} placeholder="600" /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={quizForm.description} onChange={e => setQuizForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Passing Score (%)</Label><Input type="number" value={quizForm.passingScore} onChange={e => setQuizForm(f => ({ ...f, passingScore: e.target.value }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><Label className="text-sm">Show Results</Label><p className="text-xs text-muted-foreground">Show score after submission</p></div>
                <Switch checked={quizForm.showResults} onCheckedChange={v => setQuizForm(f => ({ ...f, showResults: v }))} />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Questions ({questions.length})</h4>
              <Button size="sm" onClick={addQuestion} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Question</Button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={questions.map(q => q.id)}>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {questions.map((q, i) => (
                    <SortableQuestion key={q.id} question={q} index={i} onEdit={() => editQuestion(q)} onDelete={() => deleteQuestion(q.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuizDialog(false)}>Cancel</Button>
            <Button onClick={saveQuiz} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Quiz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialog} onOpenChange={setQuestionDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select value={qForm.type} onValueChange={v => setQForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MCQ">Multiple Choice (Single Answer)</SelectItem>
                  <SelectItem value="MULTI_SELECT">Multiple Select (Multiple Answers)</SelectItem>
                  <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                  <SelectItem value="FILL_BLANK">Fill in the Blank</SelectItem>
                  <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                  <SelectItem value="ESSAY">Essay (Manual Grading)</SelectItem>
                  <SelectItem value="MATCHING">Matching Pairs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Question Text *</Label><Textarea value={qForm.questionText} onChange={e => setQForm(f => ({ ...f, questionText: e.target.value }))} rows={3} placeholder="Enter your question..." /></div>
            {(qForm.type === 'MCQ' || qForm.type === 'MULTI_SELECT') && (
              <div className="space-y-2">
                <Label>Options (one per line) *</Label>
                <Textarea value={qForm.options} onChange={e => setQForm(f => ({ ...f, options: e.target.value }))} rows={5} placeholder={"Option A\nOption B\nOption C\nOption D"} />
              </div>
            )}
            {qForm.type === 'TRUE_FALSE' && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Select value={qForm.correctAnswer} onValueChange={v => setQForm(f => ({ ...f, correctAnswer: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(qForm.type === 'FILL_BLANK' || qForm.type === 'SHORT_ANSWER') && (
              <div className="space-y-2"><Label>Correct Answer</Label><Input value={qForm.correctAnswer} onChange={e => setQForm(f => ({ ...f, correctAnswer: e.target.value }))} placeholder="Acceptable answer" /></div>
            )}
            {qForm.type === 'ESSAY' && (
              <div className="space-y-2"><Label>Grading Rubric (optional)</Label><Textarea value={qForm.correctAnswer} onChange={e => setQForm(f => ({ ...f, correctAnswer: e.target.value }))} rows={3} placeholder="Describe what a good answer should include..." /></div>
            )}
            {qForm.type === 'MATCHING' && (
              <div className="space-y-2">
                <Label>Matching Pairs (JSON format)</Label>
                <Textarea value={qForm.options} onChange={e => setQForm(f => ({ ...f, options: e.target.value }))} rows={5} placeholder={'{"pairs": [{"left": "A", "right": "1"}, {"left": "B", "right": "2"}]}'} />
              </div>
            )}
            <div className="space-y-2"><Label>Marks</Label><Input type="number" value={qForm.marks} onChange={e => setQForm(f => ({ ...f, marks: e.target.value }))} /></div>
            {qForm.type !== 'TRUE_FALSE' && qForm.type !== 'ESSAY' && qForm.type !== 'MATCHING' && (
              <div className="space-y-2">
                <Label>Correct Answer (index/letter/value) *</Label>
                <Input value={qForm.correctAnswer} onChange={e => setQForm(f => ({ ...f, correctAnswer: e.target.value }))} placeholder={qForm.type === 'MCQ' ? 'e.g. A, B, C, or 0, 1, 2' : 'Correct answer'} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialog(false)}>Cancel</Button>
            <Button onClick={saveQuestion} className="bg-emerald-600 hover:bg-emerald-700">Save Question</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StudentLessonQuiz({ lessonId, studentId }: { lessonId: string; studentId: string }) {
  const [quizzes, setQuizzes] = useState<LessonQuiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<LessonQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; percentage: number; passed: boolean; total: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/quizzes`);
      if (res.ok) { const json = await res.json(); setQuizzes(json.data?.filter((q: LessonQuiz) => q.isPublished) || []); }
    } catch (error: unknown) { handleSilentError(error); }
  }, [lessonId]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  useEffect(() => {
    if (activeQuiz?.timeLimit) setTimeLeft(activeQuiz.timeLimit);
  }, [activeQuiz]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || !activeQuiz) return;
    const t = setTimeout(() => setTimeLeft(p => (p !== null ? p - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, activeQuiz]);

  const startQuiz = (quiz: LessonQuiz) => { setActiveQuiz(quiz); setAnswers({}); setCurrentQ(0); setResult(null); };

  const submitQuiz = async () => {
    if (!activeQuiz || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/lessons/quizzes/${activeQuiz.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', studentId, answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult({ score: json.data.score || 0, percentage: json.data.percentage || 0, passed: json.data.passed || false, total: json.data.totalMarks || 0 });
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  if (result) {
    return (
      <Card className="p-6 text-center">
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${result.passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
          {result.passed ? <CheckCircle2 className="h-10 w-10 text-emerald-600" /> : <XCircle className="h-10 w-10 text-red-600" />}
        </div>
        <h3 className="text-xl font-bold mb-2">{result.passed ? 'Congratulations! 🎉' : 'Keep Practicing!'}</h3>
        <p className="text-3xl font-bold text-emerald-600 mb-1">{result.percentage.toFixed(1)}%</p>
        <p className="text-sm text-muted-foreground mb-4">Score: {result.score} / {result.total}</p>
        <Button onClick={() => { setResult(null); setActiveQuiz(null); }}>Back to Lesson</Button>
      </Card>
    );
  }

  if (activeQuiz) {
    const q = activeQuiz.questions[currentQ];
    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{activeQuiz.title}</h3>
          {timeLeft !== null && <Badge variant={timeLeft < 60 ? 'destructive' : 'default'}><Clock className="h-3 w-3 mr-1" /> {formatTime(timeLeft)}</Badge>}
        </div>
        <div className="mb-4 text-xs text-muted-foreground">Question {currentQ + 1} of {activeQuiz.questions.length}</div>
        {q && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge>{q.type.replace('_', ' ')}</Badge>
              <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
            </div>
            <p className="font-medium whitespace-pre-wrap">{q.questionText}</p>
            {(q.type === 'MCQ' || q.type === 'TRUE_FALSE') && q.options && (
              <div className="space-y-2">
                {JSON.parse(q.options).map((opt: string, i: number) => (
                  <label key={i} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${answers[q.id] === opt ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-gray-50'}`}>
                    <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${answers[q.id] === opt ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>{answers[q.id] === opt && <div className="w-1.5 h-1.5 rounded-full bg-white" />}</div>
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            )}
            {q.type === 'MULTI_SELECT' && q.options && (() => {
              const sel: string[] = (answers[q.id] as string[]) || [];
              const toggle = (opt: string) => { const n = sel.includes(opt) ? sel.filter(s => s !== opt) : [...sel, opt]; setAnswers(p => ({ ...p, [q.id]: n })); };
              return (<div className="space-y-2">{JSON.parse(q.options).map((opt: string, i: number) => (<label key={i} onClick={() => toggle(opt)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${sel.includes(opt) ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-gray-50'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${sel.includes(opt) ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>{sel.includes(opt) && <CheckCircle2 className="h-3 w-3 text-white" />}</div><span className="text-sm">{opt}</span></label>))}</div>);
            })()}
            {(q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER') && (
              <Input value={(answers[q.id] as string) || ''} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} placeholder="Type your answer..." />
            )}
            {q.type === 'ESSAY' && (
              <Textarea value={(answers[q.id] as string) || ''} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} placeholder="Write your answer..." rows={5} />
            )}
            <div className="flex justify-between pt-4">
              <Button variant="outline" size="sm" disabled={currentQ === 0} onClick={() => setCurrentQ(p => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
              {currentQ < activeQuiz.questions.length - 1 ? (
                <Button size="sm" onClick={() => setCurrentQ(p => p + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              ) : (
                <Button onClick={submitQuiz} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Submit Quiz</Button>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  }

  if (quizzes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><Award className="h-5 w-5 text-amber-500" /> Lesson Quiz</h3>
      {quizzes.map(quiz => (
        <Card key={quiz.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => startQuiz(quiz)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{quiz.title}</h4>
                <p className="text-sm text-muted-foreground">{quiz.questions.length} questions · Pass: {quiz.passingScore}%{quiz.timeLimit ? ` · ${Math.floor(quiz.timeLimit / 60)} min` : ''}</p>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Start Quiz</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
