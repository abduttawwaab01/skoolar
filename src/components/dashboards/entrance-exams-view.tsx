'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, AlertCircle, Loader2, Copy, Eye, Trash2, ClipboardCheck, Check,
  CheckCircle2, Users, FileQuestion, Shield, Link2, GraduationCap,
  Briefcase, Timer, ToggleLeft, ArrowUpDown, RefreshCw, Pencil,
  FileUp, Download, FileText, Brain, TrendingUp, XCircle, Minus,
  Calculator
} from 'lucide-react';
import { useMemo } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { SendToParent } from '@/components/shared/send-to-parent';
import { InsightsPanel } from '@/components/shared/insights-panel';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

import { handleSilentError } from '@/lib/error-handler';
import { motion } from 'framer-motion';
 import { useConfirm } from '@/components/confirm-dialog';
import { exportEntranceExamResultPdf } from '@/lib/entrance-exam-pdf';
  // sendEmail is imported dynamically to avoid bundling nodemailer in client

interface EntranceExamRecord {
  id: string;
  title: string;
  description: string | null;
  type: string;
  code: string;
  totalMarks: number;
  passingMarks: number;
  duration: number | null;
  isActive: boolean;
  createdAt: string;
  _count: { attempts: number; questions: number };
}

interface AttemptRecord {
  id: string;
  applicantName: string;
  applicantEmail: string | null;
  applicantPhone: string | null;
  applicantAddress: string | null;
  finalScore: number | null;
  autoScore: number | null;
  manualScore: number | null;
  registrationStatus: string;
  status: string;
  aiSuggestions: string | null;
  tabSwitchCount: number;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  gradedAt: string | null;
  securityViolations: string | null;
  answers: string | null;
  createdAt: string;
}

interface QuestionData {
  id: string;
  type: string;
  questionText: string;
  options: string[];
  correctAnswer: string | string[];
  marks: number;
  explanation: string;
  subjectId?: string | null;
  topic?: string | null;
}

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice (MCQ)' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'MULTI_SELECT', label: 'Multi-Select' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay / Interview Question' },
  { value: 'FILL_BLANK', label: 'Fill in the Blank' },
];

interface SubjectItem {
  id: string;
  name: string;
}

function EmptyQuestion(): QuestionData {
  return { id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type: 'MCQ', questionText: '', options: ['', '', '', ''], correctAnswer: '', marks: 1, explanation: '', subjectId: null, topic: '' };
}

function QuestionEditor({ question, index, onChange, onDelete, subjects }: {
  question: QuestionData;
  index: number;
  onChange: (q: QuestionData) => void;
  onDelete: () => void;
  subjects?: SubjectItem[];
}) {
  const needsOptions = ['MCQ', 'TRUE_FALSE', 'MULTI_SELECT'].includes(question.type);
  const tfOptions = ['True', 'False'];

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Q{index + 1}</span>
        <div className="flex items-center gap-2">
          <Select value={question.type} onValueChange={v => onChange({ ...question, type: v, options: v === 'TRUE_FALSE' ? tfOptions : question.options })}>
            <SelectTrigger className="h-7 text-xs w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={question.marks}
            onChange={e => onChange({ ...question, marks: parseInt(e.target.value) || 1 })}
            className="h-7 w-20 text-xs"
            min={1}
            placeholder="Marks"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Textarea
        placeholder="Enter question text..."
        value={question.questionText}
        onChange={e => onChange({ ...question, questionText: e.target.value })}
        rows={2}
        className="text-sm resize-none"
      />

      {/* MCQ / Multi-Select options */}
      {(question.type === 'MCQ' || question.type === 'MULTI_SELECT') && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Options</Label>
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-5 h-5 border-2 flex-shrink-0 cursor-pointer flex items-center justify-center transition-colors ${question.type === 'MULTI_SELECT' ? 'rounded-md' : 'rounded-full'} ${opt && (question.type === 'MCQ' ? question.correctAnswer === opt : Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt)) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-400'}`}
                onClick={() => {
                  if (!opt) return;
                  if (question.type === 'MCQ') {
                    onChange({ ...question, correctAnswer: opt });
                  } else {
                    const current = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                    const next = current.includes(opt) ? current.filter(a => a !== opt) : [...current, opt];
                    onChange({ ...question, correctAnswer: next });
                  }
                }}
              >
                {question.type === 'MCQ'
                  ? (question.correctAnswer === opt && opt && <div className="w-2 h-2 rounded-full bg-white" />)
                  : (Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt) && <Check className="w-3 h-3 text-white" />)
                }
              </div>
              <Input
                value={opt}
                onChange={e => {
                  const newOpts = [...question.options];
                  newOpts[i] = e.target.value;
                  onChange({ ...question, options: newOpts });
                }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="h-8 text-sm flex-1"
              />
              {question.options.length > 2 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-300 hover:text-red-400 flex-shrink-0" onClick={() => {
                  const newOpts = question.options.filter((_, oi) => oi !== i);
                  const newCorrect = question.type === 'MULTI_SELECT' && Array.isArray(question.correctAnswer)
                    ? question.correctAnswer.filter(a => a !== opt)
                    : (question.correctAnswer === opt ? '' : question.correctAnswer);
                  onChange({ ...question, options: newOpts, correctAnswer: newCorrect });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onChange({ ...question, options: [...question.options, ''] })}>
            <Plus className="h-3 w-3 mr-1" /> Add Option
          </Button>
          <p className="text-[10px] text-muted-foreground">{question.type === 'MULTI_SELECT' ? 'Click the checkbox on each correct option to mark the answer. Multiple selections allowed.' : 'Click the circle next to the correct option to mark it as the answer.'}</p>
        </div>
      )}

      {/* True/False */}
      {question.type === 'TRUE_FALSE' && (
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Correct Answer</Label>
          <div className="flex gap-3">
            {tfOptions.map(opt => (
              <button key={opt} type="button"
                onClick={() => onChange({ ...question, correctAnswer: opt })}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${question.correctAnswer === opt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:border-gray-300'}`}>
                {opt === 'True' ? '✅ True' : '❌ False'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Short Answer / Fill Blank */}
      {(question.type === 'SHORT_ANSWER' || question.type === 'FILL_BLANK') && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Expected Answer (used for auto-grading)</Label>
          <Input
            value={question.correctAnswer}
            onChange={e => onChange({ ...question, correctAnswer: e.target.value })}
            placeholder="Type expected answer..."
            className="text-sm"
          />
        </div>
      )}

      {/* Essay: No correct answer */}
      {question.type === 'ESSAY' && (
        <p className="text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2">📝 Essay questions will be manually graded by the admin. AI suggestions will be generated based on the overall exam performance.</p>
      )}

      {/* Subject & Topic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Subject</Label>
          <Select
            value={question.subjectId || ''}
            onValueChange={v => onChange({ ...question, subjectId: v || null })}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue placeholder="No subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">No subject</SelectItem>
              {(subjects || []).map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Topic</Label>
          <Input
            value={question.topic || ''}
            onChange={e => onChange({ ...question, topic: e.target.value || null })}
            placeholder="e.g. Algebra, Photosynthesis"
            className="text-xs h-8 mt-1"
          />
        </div>
      </div>

      {/* Explanation */}
      <Input
        value={question.explanation}
        onChange={e => onChange({ ...question, explanation: e.target.value })}
        placeholder="Explanation (shown to admin after grading, optional)"
        className="text-xs h-8"
      />
    </div>
  );
}

export function EntranceExamsView() {
  const { selectedSchoolId } = useAppStore();
  const [exams, setExams] = React.useState<EntranceExamRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

   // Create Dialog
   const [createOpen, setCreateOpen] = React.useState(false);
   const [creating, setCreating] = React.useState(false);
    const [createForm, setCreateForm] = React.useState({
      title: '', type: 'assessment', description: '', totalMarks: '100', passingMarks: '50', duration: '',
      allowCalculator: true, calculatorMode: 'basic',
    });

   const confirm = useConfirm();

  // Detail/Edit Dialog
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [examDetails, setExamDetails] = React.useState<(EntranceExamRecord & { questions: QuestionData[]; attempts: AttemptRecord[] }) | null>(null);
  const [editedQuestions, setEditedQuestions] = React.useState<QuestionData[]>([]);
  const [savingQuestions, setSavingQuestions] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('attempts');

  // Security settings
  const [security, setSecurity] = React.useState({
    fullscreen: false,
    tabSwitchWarning: true,
    tabSwitchAutoSubmit: false,
    blockCopyPaste: true,
    blockRightClick: true,
    blockKeyboardShortcuts: false,
  });
   const [savingSecurity, setSavingSecurity] = React.useState(false);

   // Grading states
   const [gradingOpen, setGradingOpen] = React.useState(false);
   const [gradingAttempt, setGradingAttempt] = React.useState<AttemptRecord | null>(null);
   const [manualScore, setManualScore] = React.useState<number | ''>('');
   const [gradingStatus, setGradingStatus] = React.useState<string>('graded');
   const [gradingComments, setGradingComments] = React.useState('');
   const [savingGrading, setSavingGrading] = React.useState(false);

   // Subjects for question categorization
   const [subjects, setSubjects] = React.useState<SubjectItem[]>([]);

   // Answer review dialog
   const [reviewOpen, setReviewOpen] = React.useState(false);
   const [reviewAttempt, setReviewAttempt] = React.useState<AttemptRecord | null>(null);

   // Admission action dialogs
   const [admitOpen, setAdmitOpen] = React.useState(false);
   const [admitAttemptId, setAdmitAttemptId] = React.useState('');
   const [admitClass, setAdmitClass] = React.useState('');
   const [admitLoading, setAdmitLoading] = React.useState(false);
   const [deferOpen, setDeferOpen] = React.useState(false);
   const [deferAttemptId, setDeferAttemptId] = React.useState('');
   const [deferClass, setDeferClass] = React.useState('');
   const [deferLoading, setDeferLoading] = React.useState(false);

   // Registration management
  const [registrations, setRegistrations] = React.useState<Array<{
    id: string; applicantName: string; applicantEmail: string | null; applicantPhone: string | null;
    applicantAddress: string | null; registrationStatus: string; appliedClass: string | null;
    deferredClass: string | null; canRetry: boolean; createdAt: string; adminNotes: string | null;
    exam: { id: string; title: string; code: string };
  }>>([]);
  const [loadingRegistrations, setLoadingRegistrations] = React.useState(false);
  
  // Bulk registration
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkExamId, setBulkExamId] = React.useState('');
  const [bulkLoading, setBulkLoading] = React.useState(false);
  const [bulkFile, setBulkFile] = React.useState<File | null>(null);

  const downloadTemplate = () => {
    const headers = ['Name', 'Email', 'Phone', 'Class'];
    const rows = [
      ['John Doe', 'john@example.com', '08012345678', 'SS1'],
      ['Jane Smith', 'jane@example.com', '08087654321', 'JSS3']
    ];
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "entrance_applicants_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.info('Template downloaded. Please fill and upload.');
  };

  const handleBulkUpload = async () => {
    if (!bulkExamId) { toast.error('Please select an exam'); return; }
    if (!bulkFile) { toast.error('Please select a file'); return; }
    
    setBulkLoading(true);
    try {
      const text = await bulkFile.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
      if (lines.length < 2) throw new Error('File is empty or missing data');
      
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };
      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
      const candidates = lines.slice(1).map(line => {
        const values = parseCSVLine(line).map(v => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => {
          if (h === 'name') obj.applicantName = values[i];
          if (h === 'email') obj.applicantEmail = values[i];
          if (h === 'phone') obj.applicantPhone = values[i];
          if (h === 'class') obj.appliedClass = values[i];
        });
        return obj;
      }).filter(c => c.applicantName);

      if (candidates.length === 0) throw new Error('No valid candidates found');

      const res = await fetch('/api/entrance-exams?action=bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: bulkExamId, candidates, autoApprove: true }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      
      toast.success(json.message);
      setBulkOpen(false);
      setBulkFile(null);
      fetchExams();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process file');
    } finally {
      setBulkLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    if (!selectedSchoolId) return;
    setLoadingRegistrations(true);
    try {
      const res = await fetch(`/api/entrance-exams?action=registrations&schoolId=${selectedSchoolId}`);
      const json = await res.json();
      if (json.data) setRegistrations(json.data);
    } catch (error: unknown) { handleSilentError(error); }
    finally { setLoadingRegistrations(false); }
  };

  const handleApproveRegistration = async (attemptId: string) => {
    try {
      const res = await fetch('/api/entrance-exams?action=approve-registration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Registration approved');
      fetchRegistrations();
    } catch (err: any) { toast.error(err.message || 'Failed to approve'); }
  };

  const handleRejectRegistration = async (attemptId: string, canRetry = true) => {
    try {
      const res = await fetch('/api/entrance-exams?action=reject-registration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, canRetry }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Registration rejected');
      fetchRegistrations();
    } catch (err: any) { toast.error(err.message || 'Failed to reject'); }
  };

  const handleDeferRegistration = async (attemptId: string, deferredClass: string) => {
    try {
      const res = await fetch('/api/entrance-exams?action=defer-registration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, deferredClass }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Candidate deferred to ${deferredClass}`);
      fetchRegistrations();
    } catch (err: any) { toast.error(err.message || 'Failed to defer'); }
  };

  const handleAdmitCandidate = async (attemptId: string, admittedClass: string) => {
    try {
      const res = await fetch('/api/entrance-exams?action=admit-candidate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, admittedClass }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Candidate admitted to ${admittedClass}`);
      fetchRegistrations();
      if (examDetails?.id) openExamDetails(examDetails.id);
    } catch (err: any) { toast.error(err.message || 'Failed to admit'); }
  };

  const openReview = (attempt: AttemptRecord) => {
    setReviewAttempt(attempt);
    setReviewOpen(true);
  };

   React.useEffect(() => { fetchExams(); }, [selectedSchoolId]);

  const fetchExams = async () => {
    if (!selectedSchoolId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/entrance-exams?schoolId=${selectedSchoolId}&limit=100`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setExams(Array.isArray(json.data) ? json.data : []);
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to load entrance exams'); }
    finally { setLoading(false); }
  };

    const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !selectedSchoolId) { toast.error('Title is required'); return; }
    setCreating(true);
    try {
      const durationValue = createForm.duration.trim() === '' ? null : parseInt(createForm.duration);
      const totalMarksValue = parseInt(createForm.totalMarks) || 100;
      const passingMarksValue = parseInt(createForm.passingMarks) || 50;
      const res = await fetch('/api/entrance-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId, title: createForm.title, type: createForm.type,
          description: createForm.description,
          totalMarks: totalMarksValue,
          passingMarks: passingMarksValue,
          duration: durationValue,
          allowCalculator: createForm.allowCalculator,
          calculatorMode: createForm.calculatorMode,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Exam created! Share code: ${data.data.code}`);
      setCreateOpen(false);
      setCreateForm({ title: '', type: 'assessment', description: '', totalMarks: '100', passingMarks: '50', duration: '', allowCalculator: true, calculatorMode: 'basic' });
      fetchExams();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to create'); }
    finally { setCreating(false); }
  };

  const openExamDetails = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const [examRes, subjectsRes] = await Promise.all([
        fetch(`/api/entrance-exams/${id}`),
        selectedSchoolId ? fetch(`/api/subjects?schoolId=${selectedSchoolId}&limit=100`) : Promise.resolve(null),
      ]);
      const json = await examRes.json();
      if (!examRes.ok) throw new Error(json.error);
      if (subjectsRes) {
        const subjectsJson = await subjectsRes.json();
        setSubjects(subjectsJson.data || subjectsJson || []);
      }
      setExamDetails(json.data);
      const qs = (json.data.questions || []).map((q: Record<string, unknown>) => ({
        id: q.id as string,
        type: (q.type as string) || 'MCQ',
        questionText: (q.questionText as string) || '',
        options: (() => {
          if (!q.options) return ['', '', '', ''];
          try {
            const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            return Array.isArray(parsed) ? parsed : ['', '', '', ''];
          } catch { return ['', '', '', '']; }
        })(),
        correctAnswer: (q.correctAnswer as string) || '',
        marks: (q.marks as number) || 1,
        explanation: (q.explanation as string) || '',
      }));
      setEditedQuestions(qs.length > 0 ? qs : [EmptyQuestion()]);
      if (json.data.securitySettings) {
        try { setSecurity(JSON.parse(json.data.securitySettings)); } catch (error: unknown) { handleSilentError(error); }
      }
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to load'); setDetailOpen(false); }
    finally { setDetailLoading(false); }
  };

  const openGrading = (attempt: AttemptRecord) => {
    setGradingAttempt(attempt);
    setManualScore(attempt.manualScore ?? attempt.finalScore ?? '');
    setGradingStatus(attempt.status);
    setGradingComments('');
    setGradingOpen(true);
  };

  const saveGrading = async () => {
    if (!gradingAttempt || manualScore === '') return;
    setSavingGrading(true);
    try {
      if (!examDetails) throw new Error('Exam details not loaded');
      const res = await fetch(`/api/entrance-exams/${examDetails.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: gradingAttempt.id,
          manualScore: Number(manualScore),
          status: gradingStatus,
          comments: gradingComments,
        }),
      });
      const json = await res.json();
       if (!res.ok) throw new Error(json.error);
       toast.success('Grading saved');
        setGradingOpen(false);
        // Reload exam details to reflect changes
       openExamDetails(examDetails.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save grading');
    } finally {
      setSavingGrading(false);
    }
  };

  const saveQuestions = async () => {
    if (!examDetails) return;
    const valid = editedQuestions.every(q => q.questionText.trim());
    if (!valid) { toast.error('All questions must have question text'); return; }
    setSavingQuestions(true);
    try {
      const res = await fetch(`/api/entrance-exams/${examDetails.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: editedQuestions }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Questions saved!');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setSavingQuestions(false); }
  };

  const saveSecurity = async () => {
    if (!examDetails) return;
    setSavingSecurity(true);
    try {
      const res = await fetch(`/api/entrance-exams/${examDetails.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ securitySettings: security }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Security settings saved!');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setSavingSecurity(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/entrance-exams/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success(`Exam ${!current ? 'activated' : 'deactivated'}`);
      fetchExams();
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to update status'); }
  };

   const deleteExam = async (id: string) => {
     const ok = await confirm('Delete Entrance Exam', 'Are you sure you want to delete this exam? Applicants with the code will no longer be able to access it. This action cannot be undone.');
     if (!ok) return;
     try {
       const res = await fetch(`/api/entrance-exams/${id}`, { method: 'DELETE' });
       if (!res.ok) throw new Error('Failed to delete');
       toast.success('Exam deleted');
       fetchExams();
       setDetailOpen(false);
     } catch (error: unknown) { handleSilentError(error); toast.error('Failed to delete'); }
   };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success(`Code "${code}" copied!`); };
  const copyLink = (code: string) => {
    const url = `${window.location.origin}/entrance?code=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied! Share with applicants.');
  };

  const getScoreBadgeColor = (score: number | null, total: number, passing: number) => {
    if (score === null) return 'neutral';
    if (score >= passing) return 'success';
    if (score >= passing * 0.75) return 'warning';
    return 'error';
  };

  const formatTime = (s: number | null) => {
    if (!s) return '-';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const columns: ColumnDef<EntranceExamRecord>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className={`size-8 rounded-lg flex items-center justify-center ${row.original.type === 'interview' ? 'bg-blue-100' : 'bg-purple-100'}`}>
            {row.original.type === 'interview' ? <Briefcase className="size-4 text-blue-600" /> : <GraduationCap className="size-4 text-purple-600" />}
          </div>
          <div>
            <p className="text-sm font-semibold">{row.original.title}</p>
            <p className="text-xs text-muted-foreground capitalize">{row.original.type}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'code',
      header: 'Access Code',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="font-mono tracking-widest text-sm">{row.original.code}</Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={e => { e.stopPropagation(); copyCode(row.original.code); }}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Copy shareable link" onClick={e => { e.stopPropagation(); copyLink(row.original.code); }}>
            <Link2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      accessorKey: '_count',
      header: () => <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" />Questions</span>,
      cell: ({ row }) => <span className="text-sm font-medium">{row.original._count?.questions || 0}</span>,
    },
    {
      accessorKey: 'attempts',
      header: () => <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Attempts</span>,
      cell: ({ row }) => <span className="text-sm font-medium">{row.original._count?.attempts || 0}</span>,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge variant={row.original.isActive ? 'success' : 'neutral'} size="sm">
          {row.original.isActive ? 'Active' : 'Deactivated'}
        </StatusBadge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openExamDetails(row.original.id)}>
            <Eye className="h-3 w-3 mr-1" /> Manage
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title={row.original.isActive ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(row.original.id, row.original.isActive)}>
            <ToggleLeft className={`h-4 w-4 ${row.original.isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
          </Button>
        </div>
      ),
    },
  ];

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ClipboardCheck className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view entrance exams</p>
      </div>
    );
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            Entrance Exams & Interviews
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create assessments for external applicants. Share the unique code with candidates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchExams}><RefreshCw className="h-4 w-4" /></Button>
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-emerald-200 hover:bg-emerald-50 text-emerald-700">
                <FileUp className="size-4" /> Bulk Register
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Registration</DialogTitle>
                <DialogDescription>Upload a CSV file with candidate details to register them in bulk.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>1. Download Template</Label>
                  <Button variant="ghost" size="sm" onClick={downloadTemplate} className="w-full justify-start text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <Download className="size-3.5 mr-2" /> Download CSV Template
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>2. Select Target Exam</Label>
                  <Select value={bulkExamId} onValueChange={setBulkExamId}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select exam to register for" /></SelectTrigger>
                    <SelectContent>
                      {exams.map(e => <SelectItem key={e.id} value={e.id} className="text-sm">{e.title} ({e.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>3. Upload Filled CSV</Label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-emerald-300 transition-colors cursor-pointer relative">
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    />
                    {bulkFile ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium">
                        <CheckCircle2 className="size-5" /> {bulkFile.name}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <FileUp className="size-8 text-gray-300 mx-auto" />
                        <p className="text-sm text-gray-500">Click or drag CSV here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleBulkUpload} 
                  disabled={bulkLoading || !bulkFile || !bulkExamId}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {bulkLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />}
                  Register Candidates
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                <Plus className="size-4" /> Create Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Entrance Exam</DialogTitle>
                <DialogDescription>A unique access code will be generated automatically for students to take this exam.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Exam Type</Label>
                    <Select value={createForm.type} onValueChange={v => setCreateForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assessment">
                          <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-purple-600" /> Student Entrance Exam</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      For JSS1-3, SS1-3, Transfer admissions.
                    </p>
                  </div>
                  <div>
                    <Label>Title <span className="text-red-500">*</span></Label>
                    <Input className="mt-1" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 2026/2027 JSS1 Common Entrance" required />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea className="mt-1" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description for candidates" rows={2} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Total Marks</Label>
                      <Input className="mt-1" type="number" value={createForm.totalMarks} onChange={e => setCreateForm(f => ({ ...f, totalMarks: e.target.value }))} min={1} />
                    </div>
                    <div>
                      <Label>Pass Mark</Label>
                      <Input className="mt-1" type="number" value={createForm.passingMarks} onChange={e => setCreateForm(f => ({ ...f, passingMarks: e.target.value }))} min={1} />
                    </div>
                    <div>
                      <Label>Duration (min)</Label>
                      <Input className="mt-1" type="number" value={createForm.duration} onChange={e => setCreateForm(f => ({ ...f, duration: e.target.value }))} placeholder="None" min={1} />
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Calculator className="size-4" />
                      Calculator Settings
                    </Label>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Allow Calculator</Label>
                      <Switch
                        checked={createForm.allowCalculator}
                        onCheckedChange={v => setCreateForm(f => ({ ...f, allowCalculator: v }))}
                      />
                    </div>
                    {createForm.allowCalculator && (
                      <div className="flex items-center gap-3 pl-2">
                        <Label className="text-xs text-muted-foreground">Mode</Label>
                        <Select
                          value={createForm.calculatorMode}
                          onValueChange={v => setCreateForm(f => ({ ...f, calculatorMode: v }))}
                        >
                          <SelectTrigger className="w-40 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="scientific">Scientific</SelectItem>
                            <SelectItem value="both">Basic & Scientific</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create & Get Code
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-semibold">Total Exams</p>
            <p className="text-lg sm:text-2xl font-bold text-purple-700">{exams.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 font-semibold">Active</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700">{exams.filter(e => e.isActive).length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-semibold">Total Attempts</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-700">{exams.reduce((s, e) => s + (e._count?.attempts || 0), 0)}</p>
          </CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={exams} searchKey="title" searchPlaceholder="Search exams..." />

      {exams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
          <ClipboardCheck className="size-12 opacity-30" />
          <p className="mt-3 text-sm font-medium">No entrance exams yet</p>
          <p className="text-xs mt-1">Click "Create Assessment" to add your first exam or interview.</p>
        </div>
      )}

      {/* Exam Detail/Management Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-lg">{examDetails?.title || 'Exam Details'}</DialogTitle>
                <DialogDescription className="flex items-center gap-3 mt-1 flex-wrap">
                  <span>Access Code:</span>
                  <Badge variant="secondary" className="font-mono tracking-widest text-sm sm:text-base">{examDetails?.code}</Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => examDetails && copyCode(examDetails.code)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => examDetails && copyLink(examDetails.code)}>
                    <Link2 className="h-3 w-3 mr-1" /> Copy Link
                  </Button>
                </DialogDescription>
              </div>
              {examDetails && (
                <Button variant="destructive" size="sm" className="text-xs" onClick={() => deleteExam(examDetails.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Exam
                </Button>
              )}
            </div>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-emerald-500" /></div>
          ) : examDetails ? (
            <div className="flex-1 overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="mx-3 sm:mx-6 mt-4 self-start overflow-x-auto flex-nowrap max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <TabsTrigger value="attempts" className="gap-1.5 whitespace-nowrap">
                    <Users className="h-3.5 w-3.5 shrink-0" /> Attempts ({examDetails.attempts?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="questions" className="gap-1.5 whitespace-nowrap">
                    <FileQuestion className="h-3.5 w-3.5 shrink-0" /> Questions ({editedQuestions.length})
                  </TabsTrigger>
                  <TabsTrigger value="security" className="gap-1.5 whitespace-nowrap">
                    <Shield className="h-3.5 w-3.5 shrink-0" /> Security
                  </TabsTrigger>
                  <TabsTrigger value="registrations" className="gap-1.5 whitespace-nowrap" onClick={() => { if (registrations.length === 0) fetchRegistrations(); }}>
                    <ClipboardCheck className="h-3.5 w-3.5 shrink-0" /> Registrations ({registrations.filter(r => r.registrationStatus === 'pending').length})
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="gap-1.5 whitespace-nowrap">
                    <Brain className="h-3.5 w-3.5 shrink-0" /> Analytics
                  </TabsTrigger>
                </TabsList>

                {/* Attempts Tab */}
                <TabsContent value="attempts" className="flex-1 overflow-hidden mx-0">
                  <ScrollArea className="h-full px-6 pb-6">
                    {examDetails.attempts?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Users className="h-10 w-10 opacity-30" />
                        <p className="text-sm mt-3 font-medium">No attempts yet</p>
                        <p className="text-xs mt-1">Share the code <strong>{examDetails.code}</strong> with applicants.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{examDetails.attempts?.length || 0} Applicant(s)</p>
                            <Badge variant="outline" className="text-xs">
                              {examDetails.attempts?.filter((a: AttemptRecord) => a.finalScore !== null && a.finalScore >= examDetails.passingMarks).length || 0} Passed
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {examDetails.attempts?.filter((a: AttemptRecord) => a.finalScore === null || a.finalScore < examDetails.passingMarks).length || 0} Failed
                            </Badge>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const attempts = examDetails.attempts || [];
                              const csv = [
                                ['Name', 'Email', 'Phone', 'Score', 'Total', 'Percentage', 'Pass/Fail', 'Status', 'Date', 'Time Taken', 'Tab Switches'].join(','),
                                ...attempts.map((a: AttemptRecord) => [
                                  a.applicantName,
                                  a.applicantEmail || '',
                                  a.applicantPhone || '',
                                  a.finalScore || '',
                                  examDetails.totalMarks,
                                  a.finalScore ? Math.round((a.finalScore / examDetails.totalMarks) * 100) + '%' : '',
                                  a.finalScore && a.finalScore >= examDetails.passingMarks ? 'PASS' : 'FAIL',
                                  a.status,
                                  a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '',
                                  a.timeTakenSeconds ? `${Math.floor(a.timeTakenSeconds / 60)}m ${a.timeTakenSeconds % 60}s` : '',
                                  a.tabSwitchCount
                                ].join(','))
                              ].join('\n') + '\n# Skoolar - Odebunmi Tawwāb';
                              const blob = new Blob([csv], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `${examDetails.title.replace(/\s+/g, '_')}_Results.csv`;
                              link.click();
                              URL.revokeObjectURL(url);
                              toast.success('CSV exported successfully!');
                            }}
                          >
                            <FileQuestion className="h-4 w-4 mr-2" /> Export CSV
                          </Button>
                        </div>
                        {(examDetails.attempts || []).map((attempt: AttemptRecord) => {
                          const pct = attempt.finalScore !== null ? Math.round((attempt.finalScore / examDetails.totalMarks) * 100) : null;
                          const variant = getScoreBadgeColor(attempt.finalScore, examDetails.totalMarks, examDetails.passingMarks) as 'success' | 'warning' | 'neutral';
                          const regStatusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
                            registered: 'default',
                            pending_review: 'secondary',
                            admitted: 'default',
                            rejected: 'destructive',
                            deferred: 'secondary',
                          };
                          const regStatusLabel: Record<string, string> = {
                            registered: 'Registered',
                            pending_review: 'Pending Review',
                            admitted: 'Admitted',
                            rejected: 'Rejected',
                            deferred: 'Deferred',
                          };
                          return (
                            <Card key={attempt.id} className="border border-gray-200">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                      <h4 className="font-bold text-gray-900">{attempt.applicantName}</h4>
                                      {attempt.applicantEmail && <span className="text-xs text-muted-foreground">{attempt.applicantEmail}</span>}
                                      {attempt.applicantPhone && <span className="text-xs text-muted-foreground">{attempt.applicantPhone}</span>}
                                      <Badge variant={regStatusColor[attempt.registrationStatus] || 'outline'} className="text-[10px]">
                                        {regStatusLabel[attempt.registrationStatus] || attempt.registrationStatus}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                      <StatusBadge variant={attempt.status === 'submitted' || attempt.status === 'graded' ? 'success' : 'warning'} size="sm">
                                        {attempt.status}
                                      </StatusBadge>
                                      {attempt.tabSwitchCount > 0 && (
                                        <span className="text-orange-600 font-semibold">⚠️ {attempt.tabSwitchCount} tab switch{attempt.tabSwitchCount > 1 ? 'es' : ''}</span>
                                      )}
                                      <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {formatTime(attempt.timeTakenSeconds)}</span>
                                      {attempt.submittedAt && <span>{new Date(attempt.submittedAt).toLocaleDateString()}</span>}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    {attempt.finalScore !== null ? (
                                      <>
                                        <div className="text-2xl font-black text-gray-900">
                                          {attempt.finalScore}
                                          <span className="text-base font-normal text-muted-foreground">/{examDetails.totalMarks}</span>
                                        </div>
                                        <StatusBadge variant={variant} size="sm">{pct}% · {(attempt.finalScore >= examDetails.passingMarks) ? 'PASS' : 'FAIL'}</StatusBadge>
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Not graded</span>
                                    )}
                                  </div>
                                </div>
                                {attempt.aiSuggestions && (
                                  <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                                    <p className="text-xs font-bold text-blue-700 mb-1.5 flex items-center gap-1.5">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> AI & System Evaluation
                                    </p>
                                    {attempt.aiSuggestions}
                                  </div>
                                )}
                                <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 justify-end">
                                  {attempt.answers && attempt.answers !== '{}' && (
                                    <Button size="sm" variant="outline" onClick={() => openReview(attempt)}>
                                      <Eye className="h-3.5 w-3.5 mr-1" /> View Answers
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => {
                                    if (!examDetails) return;
                                    exportEntranceExamResultPdf(
                                      { ...attempt, totalMarks: examDetails.totalMarks, passingMarks: examDetails.passingMarks },
                                      { title: examDetails.title, description: examDetails.description, school: { name: '', logo: null } },
                                      editedQuestions,
                                    );
                                  }}>
                                    <FileText className="h-3.5 w-3.5 mr-1" /> Export PDF
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openGrading(attempt)}>
                                    <Pencil className="h-3.5 w-3.5 mr-1" /> Grade
                                  </Button>
                                  {attempt.registrationStatus === 'pending_review' && (
                                    <>
                                      <Dialog open={admitOpen && admitAttemptId === attempt.id} onOpenChange={o => { if (!o) { setAdmitOpen(false); setAdmitAttemptId(''); } }}>
                                        <DialogTrigger asChild>
                                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={() => { setAdmitAttemptId(attempt.id); setAdmitClass(''); setAdmitOpen(true); }}>
                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Admit
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader><DialogTitle>Admit Candidate</DialogTitle></DialogHeader>
                                          <div className="space-y-4 py-4">
                                            <p className="text-sm text-muted-foreground">Select class to admit <strong>{attempt.applicantName}</strong>:</p>
                                            <Select value={admitClass} onValueChange={setAdmitClass}>
                                              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                              <SelectContent>
                                                {['JS1', 'JS2', 'JS3', 'SS1', 'SS2', 'SS3', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'].map(c => (
                                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!admitClass} onClick={async () => {
                                              setAdmitLoading(true);
                                              await handleAdmitCandidate(attempt.id, admitClass);
                                              setAdmitLoading(false);
                                              setAdmitOpen(false);
                                            }}>
                                              {admitLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                              Confirm Admission
                                            </Button>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                      <Button size="sm" variant="outline" className="text-xs"
                                        onClick={async () => {
                                          const ok = await confirm(`Reject ${attempt.applicantName}?`, 'This will mark the application as rejected.');
                                          if (ok) { handleRejectRegistration(attempt.id, true); if (examDetails?.id) openExamDetails(examDetails.id); }
                                        }}>
                                        Reject
                                      </Button>
                                      <Dialog open={deferOpen && deferAttemptId === attempt.id} onOpenChange={o => { if (!o) { setDeferOpen(false); setDeferAttemptId(''); } }}>
                                        <DialogTrigger asChild>
                                          <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDeferAttemptId(attempt.id); setDeferClass(''); setDeferOpen(true); }}>
                                            Defer
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader><DialogTitle>Defer to Different Class</DialogTitle></DialogHeader>
                                          <div className="space-y-4 py-4">
                                            <p className="text-sm text-muted-foreground">Select class to defer <strong>{attempt.applicantName}</strong> to:</p>
                                            <Select value={deferClass} onValueChange={setDeferClass}>
                                              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                              <SelectContent>
                                                {['JS1', 'JS2', 'JS3', 'SS1', 'SS2', 'SS3', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'].map(c => (
                                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            <Button className="w-full" variant="outline" disabled={!deferClass} onClick={async () => {
                                              setDeferLoading(true);
                                              await handleDeferRegistration(attempt.id, deferClass);
                                              setDeferLoading(false);
                                              setDeferOpen(false);
                                              if (examDetails?.id) openExamDetails(examDetails.id);
                                            }}>
                                              {deferLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                              Confirm Deferral
                                            </Button>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    </>
                                  )}
                                  {attempt.registrationStatus === 'admitted' && (
                                    <Button size="sm" variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50 text-xs"
                                      onClick={() => window.open(`/api/admission-letter/student/${attempt.id}`, '_blank')}>
                                      <FileText className="h-3.5 w-3.5 mr-1" /> Admission Letter
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Questions Tab */}
                <TabsContent value="questions" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full px-6 pb-6">
                    <div className="flex items-center justify-between py-4">
                      <p className="text-sm text-muted-foreground">{editedQuestions.length} question{editedQuestions.length !== 1 ? 's' : ''}</p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditedQuestions(q => [...q, EmptyQuestion()])}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Question
                        </Button>
                        <Button size="sm" onClick={saveQuestions} disabled={savingQuestions} className="bg-emerald-600 hover:bg-emerald-700">
                          {savingQuestions ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                          Save Questions
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {editedQuestions.map((q, i) => (
                        <QuestionEditor
                          key={i}
                          question={q}
                          index={i}
                          onChange={updated => setEditedQuestions(qs => qs.map((old, idx) => idx === i ? updated : old))}
                          onDelete={() => setEditedQuestions(qs => qs.filter((_, idx) => idx !== i))}
                          subjects={subjects}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full px-6 pb-6">
                    <div className="mt-4 space-y-6 max-w-lg">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-600" /> Exam Security Settings</CardTitle>
                          <CardDescription>Control the security measures applied during the exam.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {[
                            { key: 'fullscreen', label: 'Require Fullscreen', desc: 'Forces the browser into fullscreen mode during the exam.' },
                            { key: 'tabSwitchWarning', label: 'Tab Switch Warning', desc: 'Warns and records when applicant switches tabs.' },
                            { key: 'tabSwitchAutoSubmit', label: 'Auto-Submit on Tab Switch', desc: 'Automatically submits the exam after 3 tab switches.' },
                            { key: 'blockCopyPaste', label: 'Block Copy / Paste', desc: 'Prevents copying questions or pasting answers from external sources.' },
                            { key: 'blockRightClick', label: 'Block Right-Click', desc: 'Disables right-click menu to prevent inspection.' },
                            { key: 'blockKeyboardShortcuts', label: 'Block Keyboard Shortcuts', desc: 'Blocks common shortcuts like Ctrl+C, Ctrl+V, etc.' },
                          ].map(({ key, label, desc }) => (
                            <div key={key} className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{label}</p>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                              </div>
                              <Switch
                                checked={security[key as keyof typeof security] as boolean}
                                onCheckedChange={v => setSecurity(s => ({ ...s, [key]: v }))}
                              />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                      <Button onClick={saveSecurity} disabled={savingSecurity} className="w-full bg-emerald-600 hover:bg-emerald-700">
                        {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                        Save Security Settings
                      </Button>
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Registrations Tab */}
                <TabsContent value="registrations" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full px-6 pb-6">
                    {loadingRegistrations ? (
                      <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
                    ) : registrations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <ClipboardCheck className="h-10 w-10 opacity-30" />
                        <p className="text-sm mt-3 font-medium">No registrations yet</p>
                        <p className="text-xs mt-1">Share the exam code with applicants to receive registrations.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{registrations.length} Registration(s)</p>
                          <Button variant="outline" size="sm" onClick={fetchRegistrations}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                          </Button>
                        </div>
                        {registrations.map(reg => (
                          <Card key={reg.id} className="border-l-4 border-l-emerald-500">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <p className="font-medium">{reg.applicantName}</p>
                                  <p className="text-sm text-muted-foreground">{reg.applicantEmail || 'No email'} · {reg.applicantPhone || 'No phone'}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant={reg.registrationStatus === 'registered' || reg.registrationStatus === 'pending' ? 'outline' : reg.registrationStatus === 'approved' || reg.registrationStatus === 'pending_review' ? 'default' : reg.registrationStatus === 'rejected' ? 'destructive' : 'secondary'}>
                                      {reg.registrationStatus === 'registered' ? 'Registered' : reg.registrationStatus === 'pending_review' ? 'Reviewing' : reg.registrationStatus}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Applied: {reg.appliedClass || 'N/A'}</span>
                                    {reg.deferredClass && <span className="text-xs text-muted-foreground">→ Deferred: {reg.deferredClass}</span>}
                                  </div>
                                  {reg.adminNotes && <p className="text-xs text-muted-foreground mt-2 italic">{reg.adminNotes}</p>}
                                </div>
                                {(reg.registrationStatus === 'registered' || reg.registrationStatus === 'pending' || reg.registrationStatus === 'pending_review') && (
                                  <div className="flex gap-2">
                                    <Dialog>
                                      <DialogTrigger asChild><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Admit</Button></DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader><DialogTitle>Admit Candidate</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                          <p className="text-sm text-muted-foreground">Select the class to admit <strong>{reg.applicantName}</strong>:</p>
                                          <Select onValueChange={async (val) => {
                                            const ok = await confirm(`Admit ${reg.applicantName} to ${val}? This will create a student account.`);
                                            if (ok) { handleAdmitCandidate(reg.id, val); if (examDetails?.id) openExamDetails(examDetails.id); }
                                          }}>
                                            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                            <SelectContent>
                                              {['JS1', 'JS2', 'JS3', 'SS1', 'SS2', 'SS3', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'].map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                    <Dialog>
                                      <DialogTrigger asChild><Button size="sm" variant="outline">Reject</Button></DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader><DialogTitle>Reject Registration</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                          <div className="flex items-center gap-2">
                                            <input type="checkbox" id={'canRetry-' + reg.id} defaultChecked className="rounded" />
                                            <Label htmlFor={'canRetry-' + reg.id}>Can retry next year</Label>
                                          </div>
                                          <Button className="w-full" variant="destructive" onClick={() => {
                                            const cb = document.getElementById('canRetry-' + reg.id) as HTMLInputElement;
                                            handleRejectRegistration(reg.id, cb ? cb.checked : true);
                                            if (examDetails?.id) openExamDetails(examDetails.id);
                                          }}>Reject</Button>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                    <Dialog>
                                      <DialogTrigger asChild><Button size="sm" variant="outline">Defer</Button></DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader><DialogTitle>Defer to Different Class</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                          <p className="text-sm text-muted-foreground">Select a class to defer <strong>{reg.applicantName}</strong> to:</p>
                                          <Select onValueChange={async (val) => {
                                            const ok = await confirm(`Defer ${reg.applicantName} to ${val}?`);
                                            if (ok) { handleDeferRegistration(reg.id, val); if (examDetails?.id) openExamDetails(examDetails.id); }
                                          }}>
                                            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                            <SelectContent>
                                              {['JS1', 'JS2', 'JS3', 'SS1', 'SS2', 'SS3', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'].map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                )}
                                {reg.registrationStatus === 'admitted' && (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                                      onClick={() => window.open(`/api/admission-letter/student/${reg.id}`, '_blank')}
                                    >
                                      <FileText className="h-3.5 w-3.5 mr-1" /> Admission Letter
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* ═══════ ANALYTICS TAB ═══════ */}
                <TabsContent value="analytics" className="flex-1 overflow-hidden mx-0">
                  <ScrollArea className="h-full px-6 pb-6">
                    {(() => {
                      const attempts = examDetails?.attempts || [];
                      const totalMarks = examDetails?.totalMarks || 100;
                      const passingMarks = examDetails?.passingMarks || 0;
                      const graded = attempts.filter((a: any) => a.finalScore !== null);

                      if (graded.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <TrendingUp className="h-10 w-10 opacity-30" />
                            <p className="text-sm mt-3 font-medium">No graded attempts yet</p>
                            <p className="text-xs mt-1">Grade some attempts to see analytics.</p>
                          </div>
                        );
                      }

                      const passed = graded.filter((a: any) => a.finalScore >= passingMarks).length;
                      const failed = graded.length - passed;
                      const scores = graded.map((a: any) => ({
                        name: a.applicantName || 'Unknown',
                        score: a.finalScore || 0,
                        pct: Math.round(((a.finalScore || 0) / totalMarks) * 100),
                        status: a.status || 'unknown',
                      }));
                      scores.sort((a: any, b: any) => b.score - a.score);

                      const avgScore = Math.round(graded.reduce((s: number, a: any) => s + (a.finalScore || 0), 0) / graded.length);
                      const avgPct = Math.round((avgScore / totalMarks) * 100);
                      const passRate = Math.round((passed / graded.length) * 100);

                      // Subject breakdown for entrance exam questions
                      const entranceSubjectBreakdown = (() => {
                        const sbMap: Record<string, { subjectName: string; totalQuestions: number; totalMarks: number; correctCount: number; earnedMarks: number; topicBreakdown: Record<string, { totalQuestions: number; totalMarks: number; correctCount: number }> }> = {};
                        for (const q of (editedQuestions || [])) {
                          const sid = q.subjectId || '__none__';
                          if (!sbMap[sid]) {
                            const sub = subjects.find((s: any) => s.id === sid);
                            sbMap[sid] = { subjectName: sub?.name || (sid === '__none__' ? 'Uncategorized' : 'Unknown'), totalQuestions: 0, totalMarks: 0, correctCount: 0, earnedMarks: 0, topicBreakdown: {} };
                          }
                          sbMap[sid].totalQuestions++;
                          sbMap[sid].totalMarks += q.marks || 0;
                          const topic = q.topic?.trim();
                          if (topic) {
                            if (!sbMap[sid].topicBreakdown[topic]) sbMap[sid].topicBreakdown[topic] = { totalQuestions: 0, totalMarks: 0, correctCount: 0 };
                            sbMap[sid].topicBreakdown[topic].totalQuestions++;
                            sbMap[sid].topicBreakdown[topic].totalMarks += q.marks || 0;
                          }
                        }
                        graded.forEach((a: any) => {
                          try {
                            const answers = typeof a.answers === 'string' ? JSON.parse(a.answers) : a.answers || {};
                            for (let qi = 0; qi < (editedQuestions || []).length; qi++) {
                              const q = editedQuestions[qi];
                              const sid = q.subjectId || '__none__';
                              const ans = answers[qi];
                              if (ans && ans.isCorrect) {
                                sbMap[sid].correctCount++;
                                sbMap[sid].earnedMarks += q.marks || 0;
                                const topic = q.topic?.trim();
                                if (topic && sbMap[sid].topicBreakdown[topic]) sbMap[sid].topicBreakdown[topic].correctCount++;
                              }
                            }
                          } catch {}
                        });
                        return Object.entries(sbMap).map(([subjectId, sb]) => ({
                          subjectId,
                          subjectName: sb.subjectName,
                          totalQuestions: sb.totalQuestions,
                          totalMarks: sb.totalMarks,
                          correctCount: sb.correctCount,
                          earnedMarks: sb.earnedMarks,
                          percentage: (sb.totalMarks * graded.length) > 0 ? Math.round((sb.earnedMarks / (sb.totalMarks * graded.length)) * 100 * 100) / 100 : 0,
                          topicBreakdown: Object.entries(sb.topicBreakdown).map(([topic, tb]) => ({
                            topic,
                            totalQuestions: tb.totalQuestions,
                            totalMarks: tb.totalMarks,
                            correctCount: tb.correctCount,
                            percentage: (tb.totalQuestions * graded.length) > 0 ? Math.round((tb.correctCount / (tb.totalQuestions * graded.length)) * 100 * 100) / 100 : 0,
                          })),
                        })).sort((a, b) => b.totalMarks - a.totalMarks);
                      })();

                      const recommendations: Array<{ type: 'danger' | 'warning' | 'success' | 'info'; title: string; description: string }> = [];
                      if (passRate < 50) recommendations.push({ type: 'danger', title: 'Low Pass Rate', description: `Only ${passRate}% of applicants passed.` });
                      if (passRate >= 70) recommendations.push({ type: 'success', title: 'Good Pass Rate', description: `${passRate}% of applicants passed the exam.` });
                      if (avgPct < 40) recommendations.push({ type: 'warning', title: 'Low Average Score', description: `Average score is ${avgPct}%. Consider reviewing question difficulty.` });
                      // Subject-based recommendations
                      for (const sb of entranceSubjectBreakdown) {
                        if (sb.subjectId === '__none__') continue;
                        if (sb.percentage < 40) recommendations.push({ type: 'danger', title: `${sb.subjectName}: Critical Weakness`, description: `Only ${sb.percentage}% correct in ${sb.subjectName}. Review questions.` });
                        else if (sb.percentage < 60) recommendations.push({ type: 'warning', title: `${sb.subjectName}: Needs Improvement`, description: `${sb.subjectName} score is ${sb.percentage}%. Focus on key topics.` });
                        for (const tb of sb.topicBreakdown || []) {
                          if (tb.percentage < 40) recommendations.push({ type: 'info', title: `Weak Topic: ${tb.topic}`, description: `Only ${tb.percentage}% correct on "${tb.topic}" in ${sb.subjectName}.` });
                        }
                      }

                      const entranceTopicBreakdown = entranceSubjectBreakdown.flatMap(sb =>
                        (sb.topicBreakdown || []).map((tb: any) => ({
                          topic: `${sb.subjectName}: ${tb.topic}`,
                          score: tb.percentage,
                          totalMarks: tb.totalMarks || 0,
                          totalQuestions: tb.totalQuestions,
                          correctCount: tb.correctCount,
                          masteryLevel: tb.percentage >= 80 ? 'mastered' : tb.percentage >= 60 ? 'advanced' : tb.percentage >= 40 ? 'intermediate' : 'beginner',
                        }))
                      );

                      const top3 = scores.slice(0, 3);
                      const bottom3 = scores.slice(-3).reverse();
                      const strengths = top3.map((s: any) => ({ name: s.name, score: s.pct, average: avgPct }));
                      const weaknesses = bottom3.map((s: any) => ({ name: s.name, score: s.pct, average: avgPct }));

                      const questionAnalysis = (() => {
                        const qMap: Record<number, { correct: number; total: number; marks: number }> = {};
                        (editedQuestions || []).forEach((q: any, i: number) => {
                          qMap[i] = { correct: 0, total: 0, marks: q.marks || 0 };
                        });
                        graded.forEach((a: any) => {
                          try {
                            const answers = typeof a.answers === 'string' ? JSON.parse(a.answers) : a.answers || {};
                            Object.entries(answers).forEach(([qIdx, ans]: [string, any]) => {
                              const idx = parseInt(qIdx);
                              if (qMap[idx]) {
                                qMap[idx].total++;
                                if (ans.isCorrect) qMap[idx].correct++;
                              }
                            });
                          } catch {}
                        });
                        return Object.entries(qMap).map(([idx, d]) => ({
                          questionNumber: parseInt(idx) + 1,
                          questionText: editedQuestions[parseInt(idx)]?.questionText || '',
                          type: editedQuestions[parseInt(idx)]?.type || 'MCQ',
                          marks: d.marks,
                          correctRate: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
                          difficulty: d.total > 0 ? (d.correct / d.total >= 0.7 ? 'Easy' : d.correct / d.total >= 0.4 ? 'Medium' : 'Hard') : 'N/A',
                        }));
                      })();

                      const gradeDist = [
                        { range: '0-20%', count: graded.filter((a: any) => ((a.finalScore || 0) / totalMarks) <= 0.2).length, fill: '#ef4444' },
                        { range: '21-40%', count: graded.filter((a: any) => ((a.finalScore || 0) / totalMarks) > 0.2 && ((a.finalScore || 0) / totalMarks) <= 0.4).length, fill: '#f97316' },
                        { range: '41-60%', count: graded.filter((a: any) => ((a.finalScore || 0) / totalMarks) > 0.4 && ((a.finalScore || 0) / totalMarks) <= 0.6).length, fill: '#eab308' },
                        { range: '61-80%', count: graded.filter((a: any) => ((a.finalScore || 0) / totalMarks) > 0.6 && ((a.finalScore || 0) / totalMarks) <= 0.8).length, fill: '#22c55e' },
                        { range: '81-100%', count: graded.filter((a: any) => ((a.finalScore || 0) / totalMarks) > 0.8).length, fill: '#6366f1' },
                      ];

                      return (
                        <div className="space-y-4 mt-4">
                          {/* Summary Cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Card>
                              <CardContent className="p-4 text-center">
                                <p className="text-2xl font-bold text-indigo-600">{graded.length}</p>
                                <p className="text-xs text-muted-foreground">Graded</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4 text-center">
                                <p className="text-2xl font-bold text-emerald-600">{passed}</p>
                                <p className="text-xs text-muted-foreground">Passed</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4 text-center">
                                <p className="text-2xl font-bold text-red-500">{failed}</p>
                                <p className="text-xs text-muted-foreground">Failed</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4 text-center">
                                <p className="text-2xl font-bold text-blue-600">{avgPct}%</p>
                                <p className="text-xs text-muted-foreground">Avg Score</p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Pass/Fail Pie + Score Distribution */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Pass / Fail</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                  <PieChart>
                                    <Pie data={[
                                      { name: 'Passed', value: passed, color: '#22c55e' },
                                      { name: 'Failed', value: failed, color: '#ef4444' },
                                    ]} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                      {[passed > 0, failed > 0].map((e, i) => (
                                        <Cell key={i} fill={[passed > 0 ? '#22c55e' : '#ccc', failed > 0 ? '#ef4444' : '#ccc'][i]} />
                                      ))}
                                    </Pie>
                                    <Tooltip />
                                  </PieChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Score Distribution</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={gradeDist.filter(d => d.count > 0)}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                      {gradeDist.filter(d => d.count > 0).map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Score Bar Chart */}
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="size-4 text-indigo-600" /> Applicants by Score (sorted)
                              </CardTitle>
                              <CardDescription className="text-xs">Highest to Lowest</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={Math.max(120, scores.length * 32)}>
                                <BarChart data={scores} layout="vertical" margin={{ left: 100, right: 20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                  <XAxis type="number" domain={[0, totalMarks]} tick={{ fontSize: 10 }} />
                                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                                  <Tooltip formatter={(value: number, name: string, props: any) => [`${value}/${totalMarks} (${props.payload.pct}%)`, 'Score']} />
                                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                    {scores.map((entry: any, i: number) => (
                                      <Cell key={i} fill={entry.status === 'approved' || entry.status === 'offered_admission' ? '#22c55e' : '#ef4444'} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>

                          {/* Subject Breakdown */}
                          {entranceSubjectBreakdown.filter(sb => sb.subjectId !== '__none__').length > 0 && (
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Brain className="size-4 text-indigo-600" /> Subject Performance Breakdown
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {entranceSubjectBreakdown.filter(sb => sb.subjectId !== '__none__').map(sb => (
                                  <div key={sb.subjectId}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{sb.subjectName}</span>
                                        <Badge variant="outline" className={cn('text-[10px]', sb.percentage >= 80 ? 'bg-emerald-100 text-emerald-700' : sb.percentage >= 60 ? 'bg-blue-100 text-blue-700' : sb.percentage >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
                                          {sb.percentage >= 80 ? 'Mastered' : sb.percentage >= 60 ? 'Advanced' : sb.percentage >= 40 ? 'Intermediate' : 'Beginner'}
                                        </Badge>
                                      </div>
                                      <span className="text-xs text-muted-foreground">{sb.correctCount}/{sb.totalQuestions} correct · {sb.percentage.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all" style={{ width: `${sb.percentage}%`, backgroundColor: sb.percentage >= 80 ? '#059669' : sb.percentage >= 60 ? '#3B82F6' : sb.percentage >= 40 ? '#F59E0B' : '#EF4444' }} />
                                    </div>
                                    {sb.topicBreakdown?.length > 0 && (
                                      <div className="mt-2 ml-4 space-y-1">
                                        {sb.topicBreakdown.map((tb: any) => (
                                          <div key={tb.topic} className="flex items-center gap-2 text-xs">
                                            <span className="text-muted-foreground w-28 truncate">{tb.topic}</span>
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                              <div className="h-full rounded-full" style={{ width: `${tb.percentage}%`, backgroundColor: tb.percentage >= 80 ? '#059669' : tb.percentage >= 60 ? '#3B82F6' : tb.percentage >= 40 ? '#F59E0B' : '#EF4444' }} />
                                            </div>
                                            <span className="text-muted-foreground w-12 text-right">{tb.percentage.toFixed(1)}%</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          )}

                          {/* Send to Parent + Insights */}
                          <div className="flex items-center gap-2">
                            <SendToParent
                              endpoint={`/api/entrance-exams/${examDetails?.id}/send-to-parent`}
                              label="Send Results"
                              variant="outline"
                              size="sm"
                              assessmentName={examDetails?.title}
                            />
                          </div>

                          <InsightsPanel
                            title="Entrance Exam Insights"
                            averageScore={avgPct}
                            passRate={passRate}
                            totalStudents={graded.length}
                            strengths={strengths}
                            weaknesses={weaknesses}
                            recommendations={recommendations}
                            topicBreakdown={entranceTopicBreakdown}
                            questionAnalysis={questionAnalysis}
                          />
                        </div>
                      );
                    })()}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mr-3 text-red-400" /> Failed to load exam data.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grading Dialog */}
      <Dialog open={gradingOpen} onOpenChange={setGradingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grade Attempt - {gradingAttempt?.applicantName}</DialogTitle>
            <DialogDescription>
              Enter manual score and update status. The final score will be set to the manual score.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Manual Score (max: {examDetails?.totalMarks})</Label>
              <Input
                type="number"
                min="0"
                max={examDetails?.totalMarks}
                value={manualScore}
                onChange={e => setManualScore(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Enter score"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={gradingStatus} onValueChange={setGradingStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="graded">Graded</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="offered_admission">Offered Admission</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comments (optional)</Label>
              <Textarea
                value={gradingComments}
                onChange={e => setGradingComments(e.target.value)}
                placeholder="Comments for applicant..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradingOpen(false)} disabled={savingGrading}>
              Cancel
            </Button>
            <Button onClick={saveGrading} disabled={savingGrading || manualScore === ''}>
              {savingGrading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Save Grading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Answer Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Answer Review - {reviewAttempt?.applicantName}</DialogTitle>
            <DialogDescription>Per-question breakdown of the candidate's answers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(() => {
              if (!reviewAttempt || !examDetails) return null;
              let parsedAnswers: Record<string, any> = {};
              try { parsedAnswers = reviewAttempt.answers ? JSON.parse(reviewAttempt.answers) : {}; } catch {}
              const questions = editedQuestions || examDetails.questions || [];
              return questions.map((q: any, i: number) => {
                const studentAnswer = parsedAnswers[q.id] ?? parsedAnswers[String(i)] ?? parsedAnswers[i] ?? null;
                const isCorrect = q.correctAnswer ? (
                  q.type === 'MCQ' || q.type === 'TRUE_FALSE'
                    ? String(studentAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
                    : q.type === 'MULTI_SELECT'
                    ? (() => {
                        try {
                          const correctArr = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer;
                          const studentArr = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
                          return Array.isArray(correctArr) && studentArr.length === correctArr.length &&
                            studentArr.map((a: any) => String(a).trim().toLowerCase()).sort().join(',') ===
                            correctArr.map((a: any) => String(a).trim().toLowerCase()).sort().join(',');
                        } catch { return false; }
                      })()
                    : q.type === 'ESSAY' ? null
                    : String(studentAnswer).trim().toLowerCase().includes(String(q.correctAnswer).trim().toLowerCase()) ||
                      String(q.correctAnswer).trim().toLowerCase().includes(String(studentAnswer).trim().toLowerCase())
                ) : null;
                const displayAnswer = Array.isArray(studentAnswer) ? studentAnswer.join(', ') : studentAnswer;
                const displayCorrect = Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer;
                return (
                  <div key={q.id || i} className={`border rounded-xl p-4 ${isCorrect === true ? 'border-emerald-200 bg-emerald-50/30' : isCorrect === false ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-gray-50/30'}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Q{i + 1}</span>
                        <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                        <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                      </div>
                      {isCorrect === true && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                      {isCorrect === false && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      {isCorrect === null && <Minus className="h-4 w-4 text-gray-400 shrink-0" />}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-2">{q.questionText}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white rounded-lg p-2.5 border border-gray-100">
                        <span className="font-semibold text-gray-600">Candidate's Answer:</span>
                        <p className="mt-0.5 text-gray-900">{displayAnswer || <span className="italic text-gray-400">No answer</span>}</p>
                      </div>
                      {isCorrect !== null && (
                        <div className="bg-white rounded-lg p-2.5 border border-gray-100">
                          <span className="font-semibold text-gray-600">Correct Answer:</span>
                          <p className="mt-0.5 text-gray-900">{displayCorrect || '-'}</p>
                        </div>
                      )}
                    </div>
                    {q.explanation && <p className="text-xs text-gray-500 mt-2 italic">{q.explanation}</p>}
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
