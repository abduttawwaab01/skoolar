'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, HelpCircle, Trophy } from 'lucide-react';
import { OcrUploadButton } from '@/components/features/ocr/ocr-button';

export interface QuizQuestion {
  type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER';
  questionText: string;
  options: string[];
  correctAnswer: string;
  marks: number;
  subjectId?: string | null;
  topic?: string | null;
}

interface SubjectItem {
  id: string;
  name: string;
}

interface Props {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  masteryThresholds?: string;
  onMasteryThresholdsChange?: (value: string) => void;
  subjects?: SubjectItem[];
}

export function LessonPlanQuizEditor({ questions, onChange, masteryThresholds, onMasteryThresholdsChange, subjects }: Props) {
  const [showThresholds, setShowThresholds] = useState(!!masteryThresholds);

  const addQuestion = () => {
    onChange([...questions, { type: 'MCQ', questionText: '', options: ['', '', '', ''], correctAnswer: '', marks: 1, subjectId: null, topic: '' }]);
  };

  const updateQuestion = (index: number, field: string, value: unknown) => {
    const updated = questions.map((q, i) => {
      if (i !== index) return q;
      return { ...q, [field]: value };
    });
    onChange(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = questions.map((q, i) => {
      if (i !== qIndex) return q;
      const options = [...q.options];
      options[optIndex] = value;
      return { ...q, options };
    });
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (from: number, to: number) => {
    const updated = [...questions];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onChange(updated);
  };

  const defaultThresholds = '{"beginner":0,"intermediate":40,"advanced":60,"mastered":80}';
  const thresholdsDisplay = masteryThresholds || defaultThresholds;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1">
          <HelpCircle className="h-4 w-4 text-emerald-600" />
          Mastery Quiz Questions
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="gap-1">
          <Plus className="h-3 w-3" /> Add Question
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4 border rounded-lg bg-gray-50">
          No quiz questions yet. Add questions to assess student mastery after this lesson.
        </p>
      )}

      {questions.map((q, idx) => (
        <Card key={idx} className="border-gray-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab"
                onPointerDown={(e) => {
                  const target = e.currentTarget.parentElement?.parentElement;
                  if (!target) return;
                  const rect = target.getBoundingClientRect();
                  const startY = e.clientY;
                  let moved = false;
                  const onMove = (ev: PointerEvent) => {
                    const diff = ev.clientY - startY;
                    if (Math.abs(diff) > 20) {
                      const dir = diff > 0 ? 1 : -1;
                      if (idx + dir >= 0 && idx + dir < questions.length) {
                        moveQuestion(idx, idx + dir);
                        moved = true;
                      }
                    }
                  };
                  const onUp = () => {
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                  };
                  document.addEventListener('pointermove', onMove);
                  document.addEventListener('pointerup', onUp);
                }}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-6">Q{idx + 1}</span>
                  <Select
                    value={q.type}
                    onValueChange={(v) => updateQuestion(idx, 'type', v)}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ">Multiple Choice</SelectItem>
                      <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                      <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Marks"
                    value={q.marks}
                    onChange={(e) => updateQuestion(idx, 'marks', parseInt(e.target.value) || 1)}
                    className="w-16 h-7 text-xs"
                    min={1}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(idx)}
                    className="ml-auto h-7 w-7 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-medium text-muted-foreground">Question Text</Label>
                  <OcrUploadButton onTextExtracted={(text) => updateQuestion(idx, 'questionText', q.questionText + text)} label="Scan" />
                </div>
                <Textarea
                  placeholder="Question text"
                  value={q.questionText}
                  onChange={(e) => updateQuestion(idx, 'questionText', e.target.value)}
                  className="text-sm min-h-[60px]"
                />

                {q.type === 'MCQ' && (
                  <div className="space-y-2 pl-6">
                    <p className="text-xs text-gray-500">Options (select the correct one):</p>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${idx}`}
                          checked={q.correctAnswer === String(oi)}
                          onChange={() => updateQuestion(idx, 'correctAnswer', String(oi))}
                          className="h-3 w-3"
                        />
                        <Input
                          placeholder={`Option ${oi + 1}`}
                          value={opt}
                          onChange={(e) => updateOption(idx, oi, e.target.value)}
                          className="text-sm h-8"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'TRUE_FALSE' && (
                  <div className="flex items-center gap-4 pl-6">
                    <p className="text-xs text-gray-500">Correct answer:</p>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        name={`tf-${idx}`}
                        checked={q.correctAnswer === 'true'}
                        onChange={() => updateQuestion(idx, 'correctAnswer', 'true')}
                      />
                      True
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        name={`tf-${idx}`}
                        checked={q.correctAnswer === 'false'}
                        onChange={() => updateQuestion(idx, 'correctAnswer', 'false')}
                      />
                      False
                    </label>
                  </div>
                )}

                {q.type === 'SHORT_ANSWER' && (
                  <div className="pl-6">
                    <Label className="text-xs text-gray-500">Correct answer (case-insensitive):</Label>
                    <Input
                      placeholder="Expected answer"
                      value={q.correctAnswer}
                      onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                      className="text-sm h-8 mt-1"
                    />
                  </div>
                )}

                {/* Subject & Topic */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <Select
                      value={q.subjectId || '__none__'}
                      onValueChange={v => updateQuestion(idx, 'subjectId', v === '__none__' ? null : v)}
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
                    <Label className="text-xs text-muted-foreground">Topic</Label>
                    <Input
                      value={q.topic || ''}
                      onChange={e => updateQuestion(idx, 'topic', e.target.value || null)}
                      placeholder="e.g. Algebra, Photosynthesis"
                      className="text-sm h-8 mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Mastery Thresholds Configuration */}
      {questions.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3 bg-amber-50/30">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Trophy className="h-4 w-4 text-amber-600" />
              Mastery Level Thresholds
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowThresholds(!showThresholds)}
              className="h-7 text-xs"
            >
              {showThresholds ? 'Hide' : 'Configure'}
            </Button>
          </div>
          {showThresholds && onMasteryThresholdsChange && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Set minimum score percentages for each mastery level. Default: Beginner 0%, Intermediate 40%, Advanced 60%, Mastered 80%.
              </p>
              <Textarea
                placeholder={defaultThresholds}
                value={masteryThresholds || ''}
                onChange={e => onMasteryThresholdsChange(e.target.value)}
                rows={2}
                className="text-xs font-mono"
              />
              <p className="text-xs text-muted-foreground">
                JSON format: {'{"beginner":0,"intermediate":40,"advanced":60,"mastered":80}'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
