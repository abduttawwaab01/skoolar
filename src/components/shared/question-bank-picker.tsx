'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, CheckCircle2, Database, FileQuestion } from 'lucide-react';
import { toast } from 'sonner';

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'MULTI_SELECT', label: 'Multi-Select' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'FILL_BLANK', label: 'Fill in the Blank' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'MATCHING', label: 'Matching' },
];

interface BankQuestion {
  id: string;
  type: string;
  questionText: string;
  options: string[] | null;
  correctAnswer: unknown;
  marks: number;
  difficulty: string;
  explanation: string | null;
  subject: { id: string; name: string } | null;
  topicRel: { id: string; name: string } | null;
  topic: string | null;
  class: { id: string; name: string } | null;
}

interface QuestionBankPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (questions: BankQuestion[]) => void;
  schoolId: string;
  subjectId?: string | null;
  classId?: string | null;
  selectedIds?: string[];
  mode?: 'single' | 'multiple';
  title?: string;
}

const EMPTY_STRING_ARRAY: string[] = [];

const typeBadgeColors: Record<string, string> = {
  MCQ: 'bg-blue-100 text-blue-700', MULTI_SELECT: 'bg-purple-100 text-purple-700',
  TRUE_FALSE: 'bg-green-100 text-green-700', FILL_BLANK: 'bg-amber-100 text-amber-700',
  SHORT_ANSWER: 'bg-orange-100 text-orange-700', ESSAY: 'bg-red-100 text-red-700',
  MATCHING: 'bg-pink-100 text-pink-700',
};

const typeLabels: Record<string, string> = {
  MCQ: 'MCQ', MULTI_SELECT: 'Multi', TRUE_FALSE: 'T/F',
  FILL_BLANK: 'Fill', SHORT_ANSWER: 'Short', ESSAY: 'Essay', MATCHING: 'Match',
};

export function QuestionBankPicker({
  open, onClose, onSelect, schoolId, subjectId, classId, selectedIds = EMPTY_STRING_ARRAY, mode = 'multiple', title,
}: QuestionBankPickerProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open && schoolId) {
      fetch(`/api/subjects?schoolId=${schoolId}&limit=200`)
        .then(r => r.json()).then(j => setSubjects(j.data || j || [])).catch(() => {});
    }
  }, [open, schoolId]);

  const fetchQuestions = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId, limit: '200', isActive: 'true' });
      if (subjectId) params.set('subjectId', subjectId);
      if (classId) params.set('classId', classId);
      if (filterSubject && filterSubject !== '__all__') params.set('subjectId', filterSubject);
      if (filterType && filterType !== '__all__') params.set('type', filterType);
      if (filterDifficulty && filterDifficulty !== '__all__') params.set('difficulty', filterDifficulty);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/question-bank?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setQuestions(json.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [schoolId, subjectId, classId, filterSubject, filterType, filterDifficulty, searchQuery]);

  useEffect(() => { if (open) fetchQuestions(); }, [open, fetchQuestions]);

  useEffect(() => { setSelected(new Set(selectedIds)); }, [selectedIds]);

  const toggleQuestion = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (mode === 'single') {
        next.clear();
        next.add(id);
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const picked = questions.filter(q => selected.has(q.id));
    onSelect(picked);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] w-[95vw] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Database className="size-4 text-purple-600" />
            {title || 'Select from Question Bank'}
          </DialogTitle>
          <DialogDescription>
            {subjectId || classId
              ? `Showing questions for ${subjectId ? 'selected subject' : ''}${subjectId && classId ? ' and ' : ''}${classId ? 'selected class' : ''}`
              : 'Browse the question bank and select questions to use'}
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="px-6 py-3 border-b flex flex-wrap gap-2 items-center">
          {!subjectId && (
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 text-xs w-24"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">All Types</SelectItem>
              {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">All Levels</SelectItem>
              <SelectItem value="beginner" className="text-xs">Beginner</SelectItem>
              <SelectItem value="intermediate" className="text-xs">Intermediate</SelectItem>
              <SelectItem value="advanced" className="text-xs">Advanced</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              className="h-8 text-xs pl-7"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchQuestions(); }}
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchQuestions}>
            <Search className="size-3 mr-1" /> Filter
          </Button>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileQuestion className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No questions found in the bank</p>
              <p className="text-xs">Try adjusting your filters or create new questions in the Question Bank</p>
            </div>
          ) : (
            questions.map(q => {
              const isSelected = selected.has(q.id);
              return (
                <div
                  key={q.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleQuestion(q.id)}
                >
                  <Checkbox checked={isSelected} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] ${typeBadgeColors[q.type] || 'bg-gray-100'}`}>
                        {typeLabels[q.type] || q.type}
                      </Badge>
                      {q.difficulty && (
                        <Badge className={`text-[10px] ${
                          q.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                          q.difficulty === 'advanced' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {q.difficulty}
                        </Badge>
                      )}
                      {q.subject && <Badge variant="outline" className="text-[10px]">{q.subject.name}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-sm mt-1 line-clamp-1">{q.questionText}</p>
                    {(q.topicRel?.name || q.topic) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Topic: {q.topicRel?.name || q.topic}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0} className="bg-purple-600 hover:bg-purple-700 gap-1">
            <CheckCircle2 className="size-4" />
            Add {selected.size > 0 ? `(${selected.size})` : ''} Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
