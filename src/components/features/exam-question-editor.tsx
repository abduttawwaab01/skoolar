'use client';

import React, { useState, useEffect, startTransition } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckCircle2, Loader2, FileQuestion, Trash2, ArrowUpDown, Database } from 'lucide-react';
import { OcrUploadButton } from '@/components/features/ocr/ocr-button';
import { toast } from 'sonner';
import { QuestionBankPicker } from '@/components/shared/question-bank-picker';

export interface QuestionData {
  id?: string;
  type: string;
  questionText: string;
  options: string[];
  correctAnswer: any;
  marks: number;
  explanation: string;
  order: number;
  subjectId?: string | null;
  classId?: string | null;
  difficulty?: string;
  topic?: string | null;
  questionBankId?: string | null;
}

export const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'MULTI_SELECT', label: 'Multi-Select' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'FILL_BLANK', label: 'Fill in the Blank' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'MATCHING', label: 'Matching' },
];

export function emptyQuestion(order: number, subjectId?: string | null): QuestionData {
  return { type: 'MCQ', questionText: '', options: ['', '', '', ''], correctAnswer: '', marks: 1, explanation: '', order, subjectId, classId: null, difficulty: 'intermediate', topic: '' };
}

const QUESTION_TYPE_OPTIONS = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'MULTI_SELECT', label: 'Multi-Select' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'FILL_BLANK', label: 'Fill in the Blank' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'MATCHING', label: 'Matching' },
];

interface SubjectOption {
  id: string;
  name: string;
}

export function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  subjects,
  classes,
}: {
  question: QuestionData;
  index: number;
  total: number;
  onChange: (q: QuestionData) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  subjects?: SubjectOption[];
  classes?: SubjectOption[];
}) {
  const updateField = (field: keyof QuestionData, value: any) => {
    onChange({ ...question, [field]: value });
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full shrink-0">
            Q{index + 1}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
              title="Move up"
            >
              <ArrowUpDown className="size-3.5 rotate-90" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={question.type} onValueChange={v => {
            const updated: QuestionData = { ...question, type: v };
            if (v === 'TRUE_FALSE') updated.options = ['True', 'False'];
            else if (v === 'MCQ' || v === 'MULTI_SELECT') {
              if (!updated.options || updated.options.length === 0) updated.options = ['', '', '', ''];
            } else updated.options = [];
            if (v !== 'MCQ' && v !== 'MULTI_SELECT') updated.correctAnswer = '';
            if (v === 'TRUE_FALSE') updated.correctAnswer = '';
            onChange(updated);
          }}>
            <SelectTrigger className="h-7 text-xs w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUESTION_TYPE_OPTIONS.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
            title="Delete question"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Question Text</Label>
        <OcrUploadButton onTextExtracted={(text) => updateField('questionText', question.questionText + text)} label="Scan" />
      </div>
      <Textarea
        placeholder="Enter question text..."
        value={question.questionText}
        onChange={e => updateField('questionText', e.target.value)}
        rows={2}
        className="text-sm resize-none"
      />

      {(question.type === 'MCQ' || question.type === 'MULTI_SELECT') && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Options</Label>
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!opt.trim()) return;
                  if (question.type === 'MCQ') {
                    updateField('correctAnswer', opt);
                  } else {
                    const current = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                    const next = current.includes(opt)
                      ? current.filter((a: string) => a !== opt)
                      : [...current, opt];
                    updateField('correctAnswer', next);
                  }
                }}
                className={`w-5 h-5 shrink-0 flex items-center justify-center border-2 transition-colors rounded-sm ${
                  question.type === 'MCQ' ? 'rounded-full' : 'rounded-md'
                } ${
                  question.type === 'MCQ'
                    ? question.correctAnswer === opt && opt
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300 hover:border-purple-400'
                    : Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt)
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300 hover:border-purple-400'
                }`}
                title="Mark as correct"
              >
                {(question.type === 'MCQ' && question.correctAnswer === opt && opt) ||
                  (Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt)) ? (
                  <div className="w-2 h-2 rounded-full bg-white" />
                ) : null}
              </button>
              <Input
                value={opt}
                onChange={e => {
                  const newOpts = [...question.options];
                  newOpts[i] = e.target.value;
                  updateField('options', newOpts);
                }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="h-8 text-sm flex-1"
              />
              {question.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newOpts = question.options.filter((_, oi) => oi !== i);
                    const newCorrect = question.type === 'MCQ'
                      ? (question.correctAnswer === opt ? '' : question.correctAnswer)
                      : Array.isArray(question.correctAnswer)
                        ? question.correctAnswer.filter((a: string) => a !== opt)
                        : question.correctAnswer;
                    onChange({ ...question, options: newOpts, correctAnswer: newCorrect });
                  }}
                  className="p-1 rounded hover:bg-red-50 text-red-300 hover:text-red-500"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => updateField('options', [...question.options, ''])}
          >
            <Plus className="size-3 mr-1" /> Add Option
          </Button>
          <p className="text-[10px] text-muted-foreground">
            {question.type === 'MCQ'
              ? 'Click the circle next to the correct option to mark it as the answer.'
              : 'Click the box next to each correct option. Multiple can be correct.'}
          </p>
        </div>
      )}

      {question.type === 'TRUE_FALSE' && (
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Correct Answer</Label>
          <div className="flex gap-3">
            {[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField('correctAnswer', opt.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  question.correctAnswer === opt.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {question.type === 'FILL_BLANK' && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Acceptable Answers (comma-separated, for auto-grading)
          </Label>
          <Input
            value={Array.isArray(question.correctAnswer) ? question.correctAnswer.join(', ') : question.correctAnswer || ''}
            onChange={e => updateField('correctAnswer', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            placeholder="e.g. photosynthesis, Photosynthesis"
            className="text-sm"
          />
        </div>
      )}

      {question.type === 'SHORT_ANSWER' && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Expected Answer (for auto-grading reference)</Label>
          <Input
            value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
            onChange={e => updateField('correctAnswer', e.target.value)}
            placeholder="Type the expected answer..."
            className="text-sm"
          />
        </div>
      )}

      {question.type === 'ESSAY' && (
        <p className="text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2">
          Essay questions will be manually graded by the teacher. AI grading suggestions will be available.
        </p>
      )}

      {question.type === 'MATCHING' && (
        <p className="text-xs text-muted-foreground bg-amber-50 rounded-lg px-3 py-2">
          Matching questions are supported. Define pairs using the correct answer format:{' '}
          <code className="text-amber-700">{'{ pairs: [{left, right}] }'}</code>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Subject</Label>
          <Select
            value={question.subjectId || '__none__'}
            onValueChange={v => updateField('subjectId', v === '__none__' ? null : v)}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue placeholder="No subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">No subject</SelectItem>
              {(subjects || []).map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Class</Label>
          <Select
            value={question.classId || '__none__'}
            onValueChange={v => updateField('classId', v === '__none__' ? null : v)}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue placeholder="No class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">No class</SelectItem>
              {(classes || []).map(c => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Difficulty</Label>
          <Select
            value={question.difficulty || 'intermediate'}
            onValueChange={v => updateField('difficulty', v)}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner" className="text-xs">Beginner</SelectItem>
              <SelectItem value="intermediate" className="text-xs">Intermediate</SelectItem>
              <SelectItem value="advanced" className="text-xs">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Topic</Label>
          <Input
            value={question.topic || ''}
            onChange={e => updateField('topic', e.target.value || null)}
            placeholder="e.g. Algebra, Photosynthesis"
            className="text-xs h-8 mt-1"
          />
        </div>
      </div>

      <Input
        value={question.explanation}
        onChange={e => updateField('explanation', e.target.value)}
        placeholder="Explanation (shown to students after grading, optional)"
        className="text-xs h-8"
      />
    </div>
  );
}

interface QuestionManagerExam {
  id: string;
  name: string;
  subject: string;
  class: string;
}

interface ExamQuestionManagerProps {
  exam: QuestionManagerExam | null;
  onClose: () => void;
  schoolId: string;
  onSaved: () => void;
}

export function ExamQuestionManager({ exam, onClose, schoolId, onSaved }: ExamQuestionManagerProps) {
  const [examQuestions, setExamQuestions] = useState<QuestionData[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/subjects?schoolId=${schoolId}&limit=100`)
      .then(res => res.json())
      .then(json => setSubjects(json.data || json || []))
      .catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    if (!exam) return;
    setQuestionsLoading(true);
    setExamQuestions([]);
    fetch(`/api/exams/${exam.id}/questions?includeAnswers=true`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load questions');
        return res.json();
      })
      .then(json => {
        const qs: QuestionData[] = (json.data || []).map((q: Record<string, unknown>) => ({
          id: q.id as string,
          type: (q.type as string) || 'MCQ',
          questionText: (q.questionText as string) || '',
          options: Array.isArray(q.options) ? q.options as string[] : [],
          correctAnswer: q.correctAnswer ?? '',
          marks: (q.marks as number) || 1,
          explanation: (q.explanation as string) || '',
          order: (q.order as number) || 0,
          subjectId: (q.subjectId as string) || null,
          topic: (q.topic as string) || null,
        }));
        setExamQuestions(qs.length > 0 ? qs : [emptyQuestion(0)]);
      })
      .catch(() => {
        toast.error('Failed to load questions');
        setExamQuestions([emptyQuestion(0)]);
      })
      .finally(() => setQuestionsLoading(false));
  }, [exam]);

  const addQuestion = () => {
    setExamQuestions(prev => [...prev, emptyQuestion(prev.length)]);
  };

  const updateQuestion = (index: number, q: QuestionData) => {
    setExamQuestions(prev => prev.map((item, i) => (i === index ? q : item)));
  };

  const deleteQuestion = async (index: number) => {
    const q = examQuestions[index];
    if (!window.confirm(`Delete question ${index + 1}? This cannot be undone.`)) return;
    if (q.id && exam) {
      try {
        const res = await fetch(`/api/exams/${exam.id}/questions`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: q.id }),
        });
        if (!res.ok) throw new Error('Failed to delete question');
        toast.success('Question deleted');
      } catch (err) {
        toast.error('Failed to delete question');
        return;
      }
    }
    setExamQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= examQuestions.length) return;
    setExamQuestions(prev => {
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr.map((q, i) => ({ ...q, order: i }));
    });
  };

  const handleSelectFromBank = (bankQuestions: any[]) => {
    const newQuestions: QuestionData[] = bankQuestions.map((bq, i) => ({
      type: bq.type || 'MCQ',
      questionText: bq.questionText,
      options: Array.isArray(bq.options) ? bq.options : [],
      correctAnswer: bq.correctAnswer ?? '',
      marks: bq.marks || 1,
      explanation: bq.explanation || '',
      order: examQuestions.length + i,
      subjectId: bq.subject?.id || bq.subjectId || null,
      topic: bq.topicRel?.name || bq.topic || null,
      questionBankId: bq.id,
    }));
    setExamQuestions(prev => [...prev, ...newQuestions]);
    toast.success(`${bankQuestions.length} question(s) added from bank`);
  };

  const saveAllQuestions = async () => {
    if (!exam) return;
    const invalid = examQuestions.some(q => !q.questionText.trim());
    if (invalid) {
      toast.error('All questions must have question text');
      return;
    }
    setSavingQuestions(true);
    try {
      const newQuestions = examQuestions.filter(q => !q.id);
      const existingQuestions = examQuestions.filter(q => q.id);

      for (const q of newQuestions) {
        const payload: Record<string, unknown> = {
          type: q.type,
          questionText: q.questionText,
          marks: q.marks,
          explanation: q.explanation || null,
          order: q.order,
          subjectId: q.subjectId || null,
          topic: q.topic || null,
          questionBankId: q.questionBankId || null,
        };
        if (q.type === 'MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE') {
          payload.options = q.options.filter(o => o.trim() !== '');
          if (q.type === 'TRUE_FALSE' && (payload.options as string[]).length === 0) {
            payload.options = ['True', 'False'];
          }
        }
        if (q.type === 'MATCHING') {
          payload.options = { pairs: [{ left: '', right: '' }] };
        }
        if (q.correctAnswer !== '' && q.correctAnswer !== undefined && q.correctAnswer !== null) {
          payload.correctAnswer = q.correctAnswer;
        }
        const res = await fetch(`/api/exams/${exam.id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create question');
        }
      }

      if (existingQuestions.length > 0) {
        const updates = existingQuestions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          marks: q.marks,
          explanation: q.explanation || null,
          order: q.order,
          subjectId: q.subjectId || null,
          topic: q.topic || null,
          options: (q.type === 'MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE')
            ? q.options.filter(o => o.trim() !== '')
            : q.type === 'MATCHING' ? { pairs: [] } : undefined,
          correctAnswer: q.correctAnswer !== '' && q.correctAnswer !== undefined && q.correctAnswer !== null
            ? q.correctAnswer : undefined,
        }));
        const res = await fetch(`/api/exams/${exam.id}/questions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: updates }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update questions');
      }

      toast.success('All questions saved successfully');
      onClose();
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save questions');
    } finally {
      setSavingQuestions(false);
    }
  };

  return (
    <Dialog open={!!exam} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="size-5 text-purple-600" />
            Manage Questions — {exam?.name}
          </DialogTitle>
          <DialogDescription>
            {exam?.subject} · {exam?.class} · {examQuestions.length} question{examQuestions.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {questionsLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {examQuestions.map((q, i) => (
                <QuestionEditor
                  key={q.id || `new-${i}`}
                  question={q}
                  index={i}
                  total={examQuestions.length}
                  onChange={(updated) => updateQuestion(i, updated)}
                  onDelete={() => deleteQuestion(i)}
                  onMoveUp={() => moveQuestion(i, 'up')}
                  onMoveDown={() => moveQuestion(i, 'down')}
                  subjects={subjects}
                />
              ))}
              <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1 w-full border-dashed">
                <Plus className="size-3.5" /> Add Question
              </Button>
            </div>
            <DialogFooter className="px-6 py-4 border-t bg-muted/20">
              <Button variant="outline" size="sm" onClick={() => startTransition(() => setBankPickerOpen(true))} className="gap-1">
                <Database className="size-3.5" /> From Question Bank
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={saveAllQuestions} disabled={savingQuestions} className="bg-purple-600 hover:bg-purple-700 gap-1">
                {savingQuestions ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {savingQuestions ? 'Saving...' : 'Save All Questions'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      <QuestionBankPicker
        open={bankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        onSelect={handleSelectFromBank}
        schoolId={schoolId}
        subjectId={subjects.find(s => s.name === exam?.subject)?.id || null}
        classId={null}
        title={`Select Questions — ${exam?.subject}`}
      />
    </Dialog>
  );
}
