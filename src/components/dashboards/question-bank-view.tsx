'use client';

import * as React from 'react';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Loader2, Pencil, Trash2, Database, Search, FileQuestion,
  Download, Upload, Copy, Eye, ChevronDown, ChevronUp, Filter, X,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { QuestionEditor, emptyQuestion, type QuestionData, QUESTION_TYPES } from '@/components/features/exam-question-editor';
import Papa from 'papaparse';

interface BankRecord {
  id: string;
  type: string;
  questionText: string;
  marks: number;
  difficulty: string;
  subject: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  topicRel: { id: string; name: string } | null;
  topic: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  options: string[] | null;
  correctAnswer: string | null;
  explanation: string | null;
}

interface ParsedRow {
  type: string;
  questionText: string;
  options: string;
  correctAnswer: string;
  marks: string;
  difficulty: string;
  subject: string;
  class: string;
  topic: string;
  explanation: string;
  _errors: string[];
  _valid: boolean;
}

const typeBadgeColors: Record<string, string> = {
  MCQ: 'bg-blue-100 text-blue-700',
  MULTI_SELECT: 'bg-purple-100 text-purple-700',
  TRUE_FALSE: 'bg-green-100 text-green-700',
  FILL_BLANK: 'bg-amber-100 text-amber-700',
  SHORT_ANSWER: 'bg-orange-100 text-orange-700',
  ESSAY: 'bg-red-100 text-red-700',
  MATCHING: 'bg-pink-100 text-pink-700',
};

const diffBadgeColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-amber-100 text-amber-700',
  advanced: 'bg-red-100 text-red-700',
};

const typeLabels: Record<string, string> = {
  MCQ: 'Multiple Choice', MULTI_SELECT: 'Multi-Select', TRUE_FALSE: 'True/False',
  FILL_BLANK: 'Fill Blank', SHORT_ANSWER: 'Short Answer', ESSAY: 'Essay', MATCHING: 'Matching',
};

const VALID_TYPES = new Set(['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'ESSAY', 'MATCHING']);
const VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced']);

const CSV_TEMPLATE_HEADERS = ['type', 'questionText', 'options', 'correctAnswer', 'marks', 'difficulty', 'subject', 'class', 'topic', 'explanation'];

function downloadTemplate() {
  const exampleRow = [
    'MCQ',
    'What is 2 + 2?',
    '"2,3,4,5"',
    '4',
    '1',
    'beginner',
    '',
    '',
    'Addition',
    'Basic arithmetic question',
  ];
  const rows = [CSV_TEMPLATE_HEADERS.join(','), exampleRow.join(',')];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'question-bank-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvRows(text: string): ParsedRow[] {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return (result.data as Record<string, string>[]).map((row, i) => {
    const type = (row.type || '').trim().toUpperCase();
    const questionText = (row.questionText || '').trim();
    const options = (row.options || '').trim();
    const correctAnswer = (row.correctAnswer || '').trim();
    const marks = (row.marks || '').trim();
    const difficulty = (row.difficulty || '').trim().toLowerCase();
    const subject = (row.subject || '').trim();
    const classValue = (row.class || '').trim();
    const topic = (row.topic || '').trim();
    const explanation = (row.explanation || '').trim();

    const errors: string[] = [];
    if (!questionText) errors.push('Question text is required');
    if (!VALID_TYPES.has(type)) errors.push(`Invalid type "${type}". Must be one of: ${[...VALID_TYPES].join(', ')}`);
    if (difficulty && !VALID_DIFFICULTIES.has(difficulty)) errors.push(`Invalid difficulty "${difficulty}". Use beginner, intermediate, or advanced`);
    if (!marks || isNaN(Number(marks)) || Number(marks) < 1) errors.push('Marks must be a positive number');

    return { type, questionText, options, correctAnswer, marks, difficulty, subject, class: classValue, topic, explanation, _errors: errors, _valid: errors.length === 0 };
  });
}

function prepareBulkPayload(rows: ParsedRow[], subjectsMap: Record<string, string>, classesMap: Record<string, string>) {
  return rows.filter(r => r._valid).map(r => ({
    type: r.type,
    questionText: r.questionText,
    options: (r.type === 'MCQ' || r.type === 'MULTI_SELECT' || r.type === 'TRUE_FALSE') && r.options
      ? r.options.split(',').map((o: string) => o.trim()).filter(Boolean)
      : null,
    correctAnswer: r.correctAnswer || null,
    marks: parseInt(r.marks) || 1,
    difficulty: r.difficulty || 'intermediate',
    subjectId: r.subject ? (subjectsMap[r.subject.toLowerCase()] || null) : null,
    classId: r.class ? (classesMap[r.class.toLowerCase()] || null) : null,
    topic: r.topic || null,
    explanation: r.explanation || null,
  }));
}

export function QuestionBankView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = selectedSchoolId || currentUser?.schoolId || '';

  const [questions, setQuestions] = useState<BankRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [topics, setTopics] = useState<{ id: string; name: string; subjectId: string | null }[]>([]);

  // Filters
  const [filterSubject, setFilterSubject] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Create/Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editQuestions, setEditQuestions] = useState<QuestionData[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  // Preview
  const [previewQuestion, setPreviewQuestion] = useState<BankRecord | null>(null);

  // Bulk import
  const [bulkOpen, setBulkOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const stats = useMemo(() => {
    const active = questions.filter(q => q.isActive);
    const byType: Record<string, number> = {};
    const byDiff: Record<string, number> = {};
    active.forEach(q => {
      byType[q.type] = (byType[q.type] || 0) + 1;
      byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
    });
    return { total: active.length, byType, byDiff };
  }, [questions]);

  const fetchQuestions = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId, limit: '500' });
      if (filterSubject) params.set('subjectId', filterSubject);
      if (filterClass) params.set('classId', filterClass);
      if (filterTopic) params.set('topicId', filterTopic);
      if (filterType) params.set('type', filterType);
      if (filterDifficulty) params.set('difficulty', filterDifficulty);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/question-bank?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setQuestions(json.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [schoolId, filterSubject, filterClass, filterTopic, filterType, filterDifficulty, debouncedSearch]);

  React.useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  React.useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  React.useEffect(() => {
    if (!schoolId) return;
    (async () => {
      try {
        const [subjectsRes, classesRes, topicsRes] = await Promise.all([
          fetch(`/api/subjects?schoolId=${schoolId}&limit=200`),
          fetch(`/api/classes?schoolId=${schoolId}&limit=200`),
          fetch(`/api/topics?schoolId=${schoolId}`),
        ]);
        const [subjectsJson, classesJson, topicsJson] = await Promise.all([
          subjectsRes.json(),
          classesRes.json(),
          topicsRes.json(),
        ]);
        setSubjects(subjectsJson.data || subjectsJson || []);
        setClasses(classesJson.data || classesJson || []);
        setTopics(topicsJson.data || []);
      } catch {}
    })();
  }, [schoolId]);

  const filteredTopics = useMemo(() => {
    if (!filterSubject) return topics;
    return topics.filter(t => !t.subjectId || t.subjectId === filterSubject);
  }, [topics, filterSubject]);

  const handleCreate = () => {
    setEditQuestions([emptyQuestion(0, filterSubject || null)]);
    setEditDialogOpen(true);
  };

  const handleCreateSave = async () => {
    const invalid = editQuestions.some(q => !q.questionText.trim());
    if (invalid) { toast.error('All questions must have text'); return; }
    setSaving(true);
    try {
      const isUpdate = !!editQuestions[0]?.id;
      if (isUpdate) {
        const q = editQuestions[0];
        const res = await fetch(`/api/question-bank/${q.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: q.type,
            questionText: q.questionText,
            options: (q.type === 'MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE') ? q.options.filter(o => o.trim()) : null,
            correctAnswer: q.correctAnswer,
            marks: q.marks,
            explanation: q.explanation,
            subjectId: q.subjectId || null,
            classId: q.classId || null,
            difficulty: q.difficulty || 'intermediate',
            topic: q.topic || null,
          }),
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success('Question updated');
      } else {
        const res = await fetch('/api/question-bank/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId,
            questions: editQuestions.map(q => ({
              type: q.type,
              questionText: q.questionText,
              options: (q.type === 'MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE') ? q.options.filter(o => o.trim()) : null,
              correctAnswer: q.correctAnswer,
              marks: q.marks,
              explanation: q.explanation,
              subjectId: q.subjectId || filterSubject || null,
              classId: q.classId || null,
              difficulty: q.difficulty || 'intermediate',
              topic: q.topic || null,
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create');
        toast.success(json.message || 'Questions created');
      }
      setEditDialogOpen(false);
      fetchQuestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create/update');
    } finally { setSaving(false); }
  };

  const handleDuplicate = async (q: BankRecord) => {
    try {
      const res = await fetch('/api/question-bank/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          questions: [{
            type: q.type,
            questionText: q.questionText,
            options: q.options || null,
            correctAnswer: q.correctAnswer || null,
            marks: q.marks,
            difficulty: q.difficulty,
            subjectId: q.subject?.id || null,
            classId: q.class?.id || null,
            topic: q.topicRel?.name || q.topic || null,
            explanation: q.explanation || null,
          }],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to duplicate');
      toast.success('Question duplicated');
      fetchQuestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/question-bank/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Question deactivated');
      setDeleteId(null);
      fetchQuestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteIds.length === 0) return;
    try {
      const res = await fetch('/api/question-bank/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: bulkDeleteIds }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      const json = await res.json();
      toast.success(`${json.count} question(s) deactivated`);
      setBulkDeleteIds([]);
      setBulkDeleteOpen(false);
      fetchQuestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleDeleteAll = async () => {
    const activeIds = questions.filter(q => q.isActive).map(q => q.id);
    if (activeIds.length === 0) {
      toast.error('No active questions to delete');
      setDeleteAllOpen(false);
      return;
    }
    try {
      const res = await fetch('/api/question-bank/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: activeIds }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      const json = await res.json();
      toast.success(`${json.count} question(s) deactivated`);
      setDeleteAllOpen(false);
      fetchQuestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Bulk import handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsvRows(text);
      if (rows.length === 0) {
        toast.error('No valid rows found in CSV');
        return;
      }
      setParsedRows(rows);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBulkImport = async () => {
    const valid = parsedRows.filter(r => r._valid);
    if (valid.length === 0) { toast.error('No valid rows to import'); return; }

    const subjectsMap: Record<string, string> = {};
    subjects.forEach(s => { subjectsMap[s.name.toLowerCase()] = s.id; });
    const classesMap: Record<string, string> = {};
    classes.forEach(c => { classesMap[c.name.toLowerCase()] = c.id; });

    setImporting(true);
    try {
      const payload = prepareBulkPayload(valid, subjectsMap, classesMap);
      const res = await fetch('/api/question-bank/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, questions: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');
      toast.success(json.message || `${json.data?.count || valid.length} question(s) imported`);
      setBulkOpen(false);
      setParsedRows([]);
      fetchQuestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally { setImporting(false); }
  };

  const columns = [
    {
      header: 'Type',
      accessorKey: 'type',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return (
          <Badge className={`text-[10px] font-medium ${typeBadgeColors[r.type] || 'bg-gray-100'}`}>
            {typeLabels[r.type] || r.type}
          </Badge>
        );
      },
    },
    {
      header: 'Question',
      accessorKey: 'questionText',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return (
          <button className="max-w-md truncate text-sm text-left hover:text-purple-600 cursor-pointer" onClick={() => setPreviewQuestion(r)} title="Click to preview">
            {r.questionText}
          </button>
        );
      },
    },
    {
      header: 'Subject',
      accessorKey: 'subject',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return <span className="text-xs">{r.subject?.name || '-'}</span>;
      },
    },
    {
      header: 'Class',
      accessorKey: 'class',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return <span className="text-xs">{r.class?.name || '-'}</span>;
      },
    },
    {
      header: 'Topic',
      accessorKey: 'topic',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return <span className="text-xs">{r.topicRel?.name || r.topic || '-'}</span>;
      },
    },
    {
      header: 'Difficulty',
      accessorKey: 'difficulty',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return (
          <Badge className={`text-[10px] ${diffBadgeColors[r.difficulty] || 'bg-gray-100'}`}>
            {r.difficulty}
          </Badge>
        );
      },
    },
    {
      header: 'Marks',
      accessorKey: 'marks',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return <span className="text-xs font-medium">{r.marks}</span>;
      },
    },
    {
      header: 'Created By',
      accessorKey: 'createdBy',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return <span className="text-xs text-muted-foreground">{r.createdBy?.name || '-'}</span>;
      },
    },
    {
      header: 'Status',
      accessorKey: 'isActive',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return (
          <Badge className={r.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
            {r.isActive ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }: any) => {
        const r = row.original as BankRecord;
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View" onClick={() => setPreviewQuestion(r)}>
              <Eye className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => {
              setEditQuestions([{
                id: r.id,
                type: r.type,
                questionText: r.questionText,
                options: r.options || [],
                correctAnswer: r.correctAnswer || '',
                marks: r.marks,
                explanation: r.explanation || '',
                order: 0,
                subjectId: r.subject?.id || null,
                classId: r.class?.id || null,
                difficulty: r.difficulty || 'intermediate',
                topic: r.topicRel?.name || r.topic || '',
              }]);
              setEditDialogOpen(true);
            }}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Duplicate" onClick={() => handleDuplicate(r)}>
              <Copy className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" title="Deactivate" onClick={() => setDeleteId(r.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-purple-600" />
          <h1 className="text-lg font-semibold">Question Bank</h1>
          <Badge variant="outline" className="text-xs">{stats.total} active</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setBulkOpen(true)}>
            <Upload className="size-3.5" /> Bulk Import
          </Button>
          <Button size="sm" className="gap-1" onClick={handleCreate}>
            <Plus className="size-3.5" /> Add Question
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3">
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5 flex items-center gap-1">
          <FileQuestion className="size-3" /> {stats.total} Total
        </div>
        {Object.entries(stats.byType).map(([k, v]) => (
          <div key={k} className={`text-xs rounded-md px-3 py-1.5 flex items-center gap-1 ${typeBadgeColors[k] || 'bg-gray-100 text-gray-500'}`}>
            {typeLabels[k] || k}: {v}
          </div>
        ))}
        {Object.entries(stats.byDiff).map(([k, v]) => (
          <div key={k} className={`text-xs rounded-md px-3 py-1.5 flex items-center gap-1 ${diffBadgeColors[k] || 'bg-gray-100'}`}>
            {k}: {v}
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="size-3" /> Filters {showFilters ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </Button>
        {showFilters && (
          <>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Subject</Label>
              <Select value={filterSubject || undefined} onValueChange={(v) => setFilterSubject(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Class</Label>
              <Select value={filterClass || undefined} onValueChange={(v) => setFilterClass(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Topic</Label>
              <Select value={filterTopic || undefined} onValueChange={(v) => setFilterTopic(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Topics" /></SelectTrigger>
                <SelectContent>
                  {filteredTopics.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Type</Label>
              <Select value={filterType || undefined} onValueChange={(v) => setFilterType(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Difficulty</Label>
              <Select value={filterDifficulty || undefined} onValueChange={(v) => setFilterDifficulty(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="All Levels" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner" className="text-xs">Beginner</SelectItem>
                  <SelectItem value="intermediate" className="text-xs">Intermediate</SelectItem>
                  <SelectItem value="advanced" className="text-xs">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="space-y-1 flex-1 min-w-[150px]">
          <Label className="text-[10px] text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              className="h-8 text-xs pl-7"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchQuestions(); }}
            />
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs mt-4" onClick={fetchQuestions}>
          <Search className="size-3 mr-1" /> Search
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={questions}
          pageSize={20}
          enableRowSelection={true}
          onRowSelectionChange={(ids) => setBulkDeleteIds(ids)}
          toolbar={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                disabled={bulkDeleteIds.length === 0}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="size-3" /> Delete Selected ({bulkDeleteIds.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setDeleteAllOpen(true)}
              >
                <Trash2 className="size-3" /> Delete All
              </Button>
            </>
          }
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] w-[95vw] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileQuestion className="size-4 text-purple-600" />
              {editQuestions[0]?.id ? 'Edit Question' : 'Add to Question Bank'}
            </DialogTitle>
            <DialogDescription>
              {editQuestions[0]?.id ? 'Update the question details' : 'Create a new reusable question for the bank'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {editQuestions.map((q, i) => (
              <QuestionEditor
                key={q.id || `new-${i}`}
                question={q}
                index={i}
                total={editQuestions.length}
                onChange={(updated) => setEditQuestions(prev => prev.map((item, idx) => idx === i ? updated : item))}
                onDelete={() => {}}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                subjects={subjects}
                classes={classes}
              />
            ))}
            <Button variant="outline" size="sm" onClick={() => setEditQuestions(prev => [...prev, emptyQuestion(prev.length, filterSubject || null)])} className="gap-1 w-full border-dashed">
              <Plus className="size-3.5" /> Add Another Question
            </Button>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 gap-1">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {saving ? 'Saving...' : `Save ${editQuestions.length} Question${editQuestions.length > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewQuestion} onOpenChange={() => setPreviewQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="size-4 text-purple-600" />
              Question Preview
            </DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={typeBadgeColors[previewQuestion.type] || ''}>{typeLabels[previewQuestion.type] || previewQuestion.type}</Badge>
                <Badge className={diffBadgeColors[previewQuestion.difficulty] || ''}>{previewQuestion.difficulty}</Badge>
                <Badge variant="outline">{previewQuestion.marks} mark{previewQuestion.marks !== 1 ? 's' : ''}</Badge>
              </div>
              <div className="text-sm font-medium">Question:</div>
              <div className="text-sm bg-muted/30 rounded-md p-3 whitespace-pre-wrap">{previewQuestion.questionText}</div>
              {previewQuestion.options && Array.isArray(previewQuestion.options) && previewQuestion.options.length > 0 && (
                <>
                  <div className="text-sm font-medium">Options:</div>
                  <div className="space-y-1">
                    {previewQuestion.options.map((opt: string, i: number) => (
                      <div key={i} className="text-sm bg-muted/20 rounded px-3 py-1.5 flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {previewQuestion.correctAnswer && (
                <>
                  <div className="text-sm font-medium text-green-700">Correct Answer:</div>
                  <div className="text-sm bg-green-50 rounded-md p-3 border border-green-200">
                    {typeof previewQuestion.correctAnswer === 'object'
                      ? JSON.stringify(previewQuestion.correctAnswer)
                      : previewQuestion.correctAnswer}
                  </div>
                </>
              )}
              {previewQuestion.explanation && (
                <>
                  <div className="text-sm font-medium">Explanation:</div>
                  <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">{previewQuestion.explanation}</div>
                </>
              )}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                {previewQuestion.subject && <span>Subject: {previewQuestion.subject.name}</span>}
                {previewQuestion.class && <span>Class: {previewQuestion.class.name}</span>}
                <span>Topic: {previewQuestion.topicRel?.name || previewQuestion.topic || '-'}</span>
                {previewQuestion.createdBy && <span>Created by: {previewQuestion.createdBy.name}</span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4 text-purple-600" />
              Bulk Import Questions
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file with question data. Download the template to see the required format.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-1" onClick={downloadTemplate}>
                <Download className="size-3.5" /> Download CSV Template
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="w-60 h-8 text-xs"
                  onChange={handleFileSelect}
                />
              </div>
            </div>

            {parsedRows.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {parsedRows.filter(r => r._valid).length} valid / {parsedRows.filter(r => !r._valid).length} invalid rows
                  </div>
                </div>
                <ScrollArea className="max-h-80 border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium w-8">#</th>
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-left p-2 font-medium">Type</th>
                        <th className="text-left p-2 font-medium">Question</th>
                        <th className="text-left p-2 font-medium">Options</th>
                        <th className="text-left p-2 font-medium">Answer</th>
                        <th className="text-left p-2 font-medium">Marks</th>
                        <th className="text-left p-2 font-medium">Difficulty</th>
                        <th className="text-left p-2 font-medium">Topic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => (
                        <tr key={i} className={`border-t ${row._valid ? '' : 'bg-red-50'}`}>
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2">
                            {row._valid
                              ? <Badge className="bg-green-100 text-green-700 text-[10px]">OK</Badge>
                              : (
                                <div className="flex flex-col gap-0.5">
                                  <Badge className="bg-red-100 text-red-700 text-[10px]">Error</Badge>
                                  {row._errors.map((e, j) => (
                                    <span key={j} className="text-red-600 text-[10px]">{e}</span>
                                  ))}
                                </div>
                              )}
                          </td>
                          <td className="p-2">{row.type}</td>
                          <td className="p-2 max-w-[200px] truncate">{row.questionText}</td>
                          <td className="p-2 max-w-[120px] truncate">{row.options}</td>
                          <td className="p-2 max-w-[100px] truncate">{row.correctAnswer}</td>
                          <td className="p-2">{row.marks}</td>
                          <td className="p-2">{row.difficulty}</td>
                          <td className="p-2 max-w-[100px] truncate">{row.topic}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20 gap-2">
            <Button variant="outline" onClick={() => { setBulkOpen(false); setParsedRows([]); }}>Cancel</Button>
            <Button
              onClick={handleBulkImport}
              disabled={importing || parsedRows.filter(r => r._valid).length === 0}
              className="bg-purple-600 hover:bg-purple-700 gap-1"
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {importing ? 'Importing...' : `Import ${parsedRows.filter(r => r._valid).length} Question(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Question</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the question. It will no longer appear in the bank but existing references remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-red-600 hover:bg-red-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={() => setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Selected Questions</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate {bulkDeleteIds.length} question(s). They will no longer appear in the bank but existing references remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
              Deactivate {bulkDeleteIds.length} Question(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation */}
      <AlertDialog open={deleteAllOpen} onOpenChange={() => setDeleteAllOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate All Questions</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate all {questions.filter(q => q.isActive).length} active questions in the bank. Existing references in exams and homework will remain. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteAllOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              Deactivate All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
