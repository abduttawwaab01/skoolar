'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
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
  Plus, AlertCircle, Loader2, Copy, Eye, Trash2, ClipboardCheck,
  CheckCircle2, Users, FileQuestion, Shield, Link2, GraduationCap,
  Briefcase, Timer, ToggleLeft, ArrowUpDown, RefreshCw, Pencil
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { motion } from 'framer-motion';
 import { useConfirm } from '@/components/confirm-dialog';
 import { sendEmail } from '@/lib/email';

interface EntranceExamRecord {
  id: string;
  title: string;
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
  finalScore: number | null;
  autoScore: number | null;
  manualScore: number | null;
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
  id?: string;
  type: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  marks: number;
  explanation: string;
}

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice (MCQ)' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'MULTI_SELECT', label: 'Multi-Select' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay / Interview Question' },
  { value: 'FILL_BLANK', label: 'Fill in the Blank' },
];

function EmptyQuestion(): QuestionData {
  return { type: 'MCQ', questionText: '', options: ['', '', '', ''], correctAnswer: '', marks: 1, explanation: '' };
}

function QuestionEditor({ question, index, onChange, onDelete }: {
  question: QuestionData;
  index: number;
  onChange: (q: QuestionData) => void;
  onDelete: () => void;
}) {
  const needsOptions = ['MCQ', 'TRUE_FALSE', 'MULTI_SELECT'].includes(question.type);
  const tfOptions = ['True', 'False'];

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Q{index + 1}</span>
        <div className="flex items-center gap-2">
          <Select value={question.type} onValueChange={v => onChange({ ...question, type: v, options: v === 'TRUE_FALSE' ? tfOptions : question.options })}>
            <SelectTrigger className="h-7 text-xs w-48"><SelectValue /></SelectTrigger>
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
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 cursor-pointer flex items-center justify-center transition-colors ${question.correctAnswer === opt && opt ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-400'}`}
                onClick={() => opt && onChange({ ...question, correctAnswer: opt })}
              >
                {question.correctAnswer === opt && opt && <div className="w-2 h-2 rounded-full bg-white" />}
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
                  onChange({ ...question, options: newOpts, correctAnswer: question.correctAnswer === opt ? '' : question.correctAnswer });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onChange({ ...question, options: [...question.options, ''] })}>
            <Plus className="h-3 w-3 mr-1" /> Add Option
          </Button>
          <p className="text-[10px] text-muted-foreground">Click the circle next to the correct option to mark it as the answer.</p>
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
      const res = await fetch('/api/entrance-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId, title: createForm.title, type: createForm.type,
          description: createForm.description,
          totalMarks: parseInt(createForm.totalMarks) || 100,
          passingMarks: parseInt(createForm.passingMarks) || 50,
          duration: createForm.duration ? parseInt(createForm.duration) : null,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Exam created! Share code: ${data.data.code}`);
      setCreateOpen(false);
      setCreateForm({ title: '', type: 'assessment', description: '', totalMarks: '100', passingMarks: '50', duration: '' });
      fetchExams();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to create'); }
    finally { setCreating(false); }
  };

  const openExamDetails = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/entrance-exams/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setExamDetails(json.data);
      const qs = (json.data.questions || []).map((q: Record<string, unknown>) => ({
        id: q.id as string,
        type: (q.type as string) || 'MCQ',
        questionText: (q.questionText as string) || '',
        options: q.options ? JSON.parse(q.options as string) : ['', '', '', ''],
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
       // Send notification email if decision status and applicant email exists
       if (gradingAttempt?.applicantEmail && ['approved', 'rejected', 'offered_admission', 'declined'].includes(gradingStatus)) {
         try {
           const subject = `Application Update: ${examDetails?.title} - Status: ${gradingStatus.charAt(0).toUpperCase() + gradingStatus.slice(1)}`;
           const html = `
             <p>Dear ${gradingAttempt.applicantName},</p>
             <p>Your application for <strong>${examDetails?.title}</strong> has been updated to: <strong>${gradingStatus}</strong>.</p>
             ${gradingComments ? `<p>Comments: ${gradingComments}</p>` : ''}
             <p>Log in to your account to view details.</p>
             <p>Best regards,<br/>${process.env.NEXTAUTH_URL || 'Skoolar Platform'}</p>
           `;
           await sendEmail({ to: gradingAttempt.applicantEmail, subject, html });
         } catch (e) {
           console.error('Failed to send notification email:', e);
           // Do not throw - grading already saved
         }
       }
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
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                <Plus className="size-4" /> Create Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Entrance Assessment</DialogTitle>
                <DialogDescription>A unique access code will be generated automatically.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Assessment Type</Label>
                    <Select value={createForm.type} onValueChange={v => setCreateForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assessment">
                          <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-purple-600" /> Student Entrance Exam</div>
                        </SelectItem>
                        <SelectItem value="interview">
                          <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-blue-600" /> Staff Interview</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {createForm.type === 'assessment' ? 'For JSS1-3, SS1-3, Common Entrance, WAEC-standard admissions.' : 'For teacher or staff interview assessments.'}
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
                  <div className="grid grid-cols-3 gap-3">
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
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-semibold">Total Exams</p>
            <p className="text-2xl font-bold text-purple-700">{exams.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 font-semibold">Active</p>
            <p className="text-2xl font-bold text-emerald-700">{exams.filter(e => e.isActive).length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-semibold">Total Attempts</p>
            <p className="text-2xl font-bold text-blue-700">{exams.reduce((s, e) => s + (e._count?.attempts || 0), 0)}</p>
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
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-lg">{examDetails?.title || 'Exam Details'}</DialogTitle>
                <DialogDescription className="flex items-center gap-3 mt-1">
                  <span>Access Code:</span>
                  <Badge variant="secondary" className="font-mono tracking-widest text-base">{examDetails?.code}</Badge>
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
                <TabsList className="mx-6 mt-4 self-start">
                  <TabsTrigger value="attempts" className="gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Attempts ({examDetails.attempts?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="questions" className="gap-1.5">
                    <FileQuestion className="h-3.5 w-3.5" /> Questions ({editedQuestions.length})
                  </TabsTrigger>
                  <TabsTrigger value="security" className="gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Security
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
                        {(examDetails.attempts || []).map((attempt: AttemptRecord) => {
                          const pct = attempt.finalScore !== null ? Math.round((attempt.finalScore / examDetails.totalMarks) * 100) : null;
                          const variant = getScoreBadgeColor(attempt.finalScore, examDetails.totalMarks, examDetails.passingMarks) as 'success' | 'warning' | 'neutral';
                          return (
                            <Card key={attempt.id} className="border border-gray-200">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                      <h4 className="font-bold text-gray-900">{attempt.applicantName}</h4>
                                      {attempt.applicantEmail && <span className="text-xs text-muted-foreground">{attempt.applicantEmail}</span>}
                                      {attempt.applicantPhone && <span className="text-xs text-muted-foreground">{attempt.applicantPhone}</span>}
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
                                <div className="mt-3 pt-3 border-t flex justify-end">
                                  <Button size="sm" variant="outline" onClick={() => openGrading(attempt)}>
                                    <Pencil className="h-3.5 w-3.5 mr-1" /> Grade
                                  </Button>
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
    </motion.div>
  );
}
