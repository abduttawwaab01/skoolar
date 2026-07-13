'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Printer, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  printAnswerSheet,
  generateAnswerSheetPdf,
  fetchSchoolBranding,
  type AnswerSheetConfig,
  type SchoolBranding,
} from '@/lib/answer-sheet/answer-sheet-pdf';

const QUESTION_COUNTS = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100];

interface AnswerSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  prefillTitle?: string;
  prefillSubject?: string;
}

export function AnswerSheetDialog({
  open, onOpenChange, schoolId, prefillTitle, prefillSubject,
}: AnswerSheetDialogProps) {
  const [numObj, setNumObj] = useState(40);
  const [optionsPerQ, setOptionsPerQ] = useState<4 | 5>(4);
  const [numTheory, setNumTheory] = useState(3);
  const [examTitle, setExamTitle] = useState(prefillTitle || '');
  const [subject, setSubject] = useState(prefillSubject || '');
  const [instructions, setInstructions] = useState(
    'Use a pencil to shade the circles completely.\nChoose the best answer for each question.\nWrite legibly in the theory section.\nDo not fold or mutilate this sheet.'
  );
  const [branding, setBranding] = useState<SchoolBranding | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'print' | 'pdf' | null>(null);

  useEffect(() => {
    if (open && schoolId && !branding) {
      fetchSchoolBranding(schoolId).then(setBranding).catch(() => {});
    }
  }, [open, schoolId, branding]);

  const config: AnswerSheetConfig = {
    examTitle: examTitle || 'Examination',
    subject,
    numObjectiveQuestions: numObj,
    optionsPerQuestion: optionsPerQ,
    numTheoryQuestions: numTheory,
    instructions,
  };

  const handlePrint = async () => {
    setAction('print');
    setLoading(true);
    try {
      if (!branding) {
        const b = await fetchSchoolBranding(schoolId);
        setBranding(b);
        await printAnswerSheet(config, b);
      } else {
        await printAnswerSheet(config, branding);
      }
    } catch {
      toast.error('Failed to generate answer sheet');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handlePdf = async () => {
    setAction('pdf');
    setLoading(true);
    try {
      if (!branding) {
        const b = await fetchSchoolBranding(schoolId);
        setBranding(b);
        await generateAnswerSheetPdf(config, b);
      } else {
        await generateAnswerSheetPdf(config, branding);
      }
      toast.success('Answer sheet PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-emerald-600" />
            Answer Sheet Generator
          </DialogTitle>
          <DialogDescription>
            Configure and generate a printable answer sheet for paper-based examinations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Exam Title</Label>
            <Input
              value={examTitle}
              onChange={e => setExamTitle(e.target.value)}
              placeholder="e.g. Mid-Term Examination"
            />
          </div>
          <div className="space-y-2">
            <Label>Subject (optional)</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
            />
          </div>
          <div className="space-y-2">
            <Label>Objective Questions</Label>
            <Select value={String(numObj)} onValueChange={v => setNumObj(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUESTION_COUNTS.map(n => (
                  <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Options Per Question</Label>
            <Select value={String(optionsPerQ)} onValueChange={v => setOptionsPerQ(Number(v) as 4 | 5)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="4">A, B, C, D</SelectItem>
                <SelectItem value="5">A, B, C, D, E</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Theory Questions</Label>
            <Select value={String(numTheory)} onValueChange={v => setNumTheory(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, i) => i).map(n => (
                  <SelectItem key={n} value={String(n)}>{n === 0 ? 'None' : `${n} questions`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Instructions</Label>
            <Textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handlePdf}
            disabled={loading}
          >
            {loading && action === 'pdf' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Download PDF
          </Button>
          <Button className="gap-2" onClick={handlePrint} disabled={loading}>
            {loading && action === 'print' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            Preview & Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
