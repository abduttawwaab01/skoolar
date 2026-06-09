'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  options?: { id: string; text: string; isCorrect: boolean }[];
  maxMarks: number;
  sectionId: string;
}

interface QuestionRendererProps {
  question: Question;
  answer: unknown;
  onAnswerChange: (questionId: string, answer: unknown) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  feedbackText?: string;
  className?: string;
}

export function QuestionRenderer({ question, answer, onAnswerChange, showFeedback, isCorrect, feedbackText, className }: QuestionRendererProps) {
  switch (question.questionType) {
    case 'MULTIPLE_CHOICE':
    case 'SINGLE_CHOICE':
      return (
        <Card className={cn(className, showFeedback && (isCorrect ? 'border-emerald-300' : 'border-red-300'))}>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">{question.questionText}</p>
            <RadioGroup
              value={answer as string}
              onValueChange={(v) => onAnswerChange(question.id, v)}
            >
              {question.options?.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.id} id={opt.id} />
                  <Label htmlFor={opt.id} className="text-sm cursor-pointer">{opt.text}</Label>
                </div>
              ))}
            </RadioGroup>
            {showFeedback && feedbackText && (
              <p className={cn('text-xs mt-2', isCorrect ? 'text-emerald-600' : 'text-red-600')}>{feedbackText}</p>
            )}
          </CardContent>
        </Card>
      );

    case 'MULTIPLE_ANSWER':
      return (
        <Card className={cn(className, showFeedback && (isCorrect ? 'border-emerald-300' : 'border-red-300'))}>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">{question.questionText}</p>
            <div className="space-y-2">
              {question.options?.map((opt) => {
                const selected = Array.isArray(answer) && (answer as string[]).includes(opt.id);
                return (
                  <div key={opt.id} className="flex items-center gap-2">
                    <Checkbox
                      id={opt.id}
                      checked={selected}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(answer) ? [...answer as string[]] : [];
                        if (checked) { onAnswerChange(question.id, [...current, opt.id]); }
                        else { onAnswerChange(question.id, current.filter((a) => a !== opt.id)); }
                      }}
                    />
                    <Label htmlFor={opt.id} className="text-sm cursor-pointer">{opt.text}</Label>
                  </div>
                );
              })}
            </div>
            {showFeedback && feedbackText && (
              <p className={cn('text-xs mt-2', isCorrect ? 'text-emerald-600' : 'text-red-600')}>{feedbackText}</p>
            )}
          </CardContent>
        </Card>
      );

    case 'TRUE_FALSE':
      return (
        <Card className={cn(className, showFeedback && (isCorrect ? 'border-emerald-300' : 'border-red-300'))}>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">{question.questionText}</p>
            <RadioGroup
              value={answer as string}
              onValueChange={(v) => onAnswerChange(question.id, v)}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="true" id={`${question.id}-true`} />
                <Label htmlFor={`${question.id}-true`} className="text-sm cursor-pointer">True</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="false" id={`${question.id}-false`} />
                <Label htmlFor={`${question.id}-false`} className="text-sm cursor-pointer">False</Label>
              </div>
            </RadioGroup>
            {showFeedback && feedbackText && (
              <p className={cn('text-xs mt-2', isCorrect ? 'text-emerald-600' : 'text-red-600')}>{feedbackText}</p>
            )}
          </CardContent>
        </Card>
      );

    case 'SHORT_ANSWER':
      return (
        <Card className={cn(className, showFeedback && (isCorrect ? 'border-emerald-300' : 'border-red-300'))}>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">{question.questionText}</p>
            <Input
              value={(answer as string) || ''}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Type your answer..."
              className="text-sm"
            />
            {showFeedback && feedbackText && (
              <p className={cn('text-xs mt-2', isCorrect ? 'text-emerald-600' : 'text-red-600')}>{feedbackText}</p>
            )}
          </CardContent>
        </Card>
      );

    case 'ESSAY':
    case 'LONG_ANSWER':
      return (
        <Card className={cn(className, showFeedback && (isCorrect ? 'border-emerald-300' : 'border-red-300'))}>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">{question.questionText}</p>
            <p className="text-xs text-muted-foreground mb-2">Marks: {question.maxMarks}</p>
            <Textarea
              value={(answer as string) || ''}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Write your answer..."
              className="min-h-[100px] text-sm"
            />
            {showFeedback && feedbackText && (
              <p className={cn('text-xs mt-2', isCorrect ? 'text-emerald-600' : 'text-red-600')}>{feedbackText}</p>
            )}
          </CardContent>
        </Card>
      );

    default:
      return (
        <Card className={className}>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">{question.questionText}</p>
            <Textarea
              value={(answer as string) || ''}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Type your answer..."
              className="text-sm"
            />
          </CardContent>
        </Card>
      );
  }
}
