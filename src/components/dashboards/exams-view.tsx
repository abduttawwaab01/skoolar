'use client';

import React, { useState, useEffect } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, GraduationCap, AlertCircle, Loader2, ClipboardEdit, Brain, BarChart3, FileQuestion, Trash2, CheckCircle2, ArrowUpDown, Pencil, Printer, FileDown } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ExamGradingView } from './exam-grading-view';
import { ExamAnalyticsView } from './exam-analytics-view';

interface ExamRecord {
  id: string;
  name: string;
  subject: string;
  class: string;
  classId: string;
  type: string;
  totalMarks: number;
  status: string;
  date: string | null;
  term: string | null;
  teacher: string | null;
  passingMarks: number;
  duration: number | null;
  instructions?: string;
  scoresCount: number;
  questionsCount: number;
}

interface QuestionData {
  id?: string;
  type: string;
  questionText: string;
  options: string[];
  correctAnswer: any;
  marks: number;
  explanation: string;
  order: number;
}

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'MULTI_SELECT', label: 'Multi-Select' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'FILL_BLANK', label: 'Fill in the Blank' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'MATCHING', label: 'Matching' },
];

function emptyQuestion(order: number): QuestionData {
  return { type: 'MCQ', questionText: '', options: ['', '', '', ''], correctAnswer: '', marks: 1, explanation: '', order };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

const statusFilters = ['All', 'Active', 'Draft', 'Published', 'Locked'] as const;

export function ExamsView() {
  const { currentUser, selectedSchoolId, currentRole } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER'].includes(currentRole || '');
  const [exams, setExams] = React.useState<ExamRecord[]>([]);
  const [classes, setClasses] = React.useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [activeStatus, setActiveStatus] = React.useState<string>('All');
  const [adding, setAdding] = React.useState(false);
  const [scoreExam, setScoreExam] = React.useState<ExamRecord | null>(null);
  const [students, setStudents] = React.useState<{id: string; name: string; admissionNo: string}[]>([]);
  const [existingScores, setExistingScores] = React.useState<Record<string, number>>({});
  const [savingScores, setSavingScores] = React.useState(false);
  const [gradingExamId, setGradingExamId] = React.useState<string | null>(null);
  const [analyticsExamId, setAnalyticsExamId] = React.useState<string | null>(null);
  const [teacherPrismaId, setTeacherPrismaId] = React.useState<string | null>(null);
  const [editExam, setEditExam] = React.useState<ExamRecord | null>(null);
  const [deleteExamId, setDeleteExamId] = React.useState<string | null>(null);
  const [deletingExam, setDeletingExam] = React.useState(false);

  // Question management state
  const [manageQuestionsExam, setManageQuestionsExam] = React.useState<ExamRecord | null>(null);
  const [examQuestions, setExamQuestions] = React.useState<QuestionData[]>([]);
  const [questionsLoading, setQuestionsLoading] = React.useState(false);
  const [savingQuestions, setSavingQuestions] = React.useState(false);

  // Resolve teacher's Prisma ID from User ID
  React.useEffect(() => {
    if (!schoolId || currentRole !== 'TEACHER') return;
    fetch(`/api/teachers?schoolId=${schoolId}&limit=200`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => {
        const teachers = json.data || json || [];
        const t = teachers.find((t: Record<string, unknown>) => (t.user as Record<string, unknown>)?.id === currentUser.id);
        if (t) setTeacherPrismaId(t.id as string);
      })
      .catch(() => {});
  }, [schoolId, currentRole, currentUser.id]);

  React.useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const classUrl = teacherPrismaId
      ? `/api/classes?schoolId=${schoolId}&limit=100&teacherId=${teacherPrismaId}`
      : `/api/classes?schoolId=${schoolId}&limit=100`;

    Promise.all([
      fetch(`/api/exams?schoolId=${schoolId}&limit=100`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(json => {
          const items = json.data || json || [];
          return items.map((e: Record<string, unknown>) => {
            const isPublished = e.isPublished as boolean;
            const isLocked = e.isLocked as boolean;
            let status = 'draft';
            if (isLocked) status = 'locked';
            else if (isPublished) status = 'published';
            else if (e.date) {
              const examDate = new Date(e.date as string);
              const now = mounted ? new Date() : new Date('2026-01-01');
              status = examDate > now ? 'active' : 'draft';
            }
            return {
              id: e.id,
              name: e.name as string,
              subject: (e.subject as Record<string, unknown>)?.name || '—',
              class: (e.class as Record<string, unknown>)?.name || '—',
              classId: (e.class as Record<string, unknown>)?.id || '',
              type: e.type as string || 'assessment',
              totalMarks: (e.totalMarks as number) || 100,
              status,
              date: e.date as string || null,
              term: (e.term as Record<string, unknown>)?.name || null,
              teacher: (e.teacher as Record<string, unknown>)?.user
                ? ((e.teacher as Record<string, unknown>).user as Record<string, unknown>).name as string
                : null,
              passingMarks: (e.passingMarks as number) || 50,
              duration: e.duration as number || null,
              scoresCount: ((e._count as Record<string, unknown>)?.scores as number) || 0,
              questionsCount: ((e._count as Record<string, unknown>)?.questions as number) || 0,
            };
          });
        }),
      fetch(classUrl)
        .then(res => res.json())
        .then(json => (json.data || json || []).map((c: Record<string, unknown>) => ({
          id: c.id,
          name: c.name,
        }))),
      fetch(`/api/subjects?schoolId=${schoolId}&limit=100`)
        .then(res => res.json())
        .then(json => (Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []).map((s: Record<string, unknown>) => ({
          id: s.id,
          name: s.name,
        }))),
    ])
      .then(([examData, classData, subjectData]) => {
        setExams(examData);
        setClasses(classData);
        setSubjects(subjectData);
      })
      .catch(err => {
        setError(err.message);
        toast.error('Failed to load exams');
        setExams([]);
      })
      .finally(() => setLoading(false));
  }, [schoolId, teacherPrismaId]);

  const filteredExams = React.useMemo(() => {
    if (activeStatus === 'All') return exams;
    return exams.filter(e => e.status.toLowerCase() === activeStatus.toLowerCase());
  }, [exams, activeStatus]);

  const handleCreateExam = async () => {
    if (!schoolId) {
      toast.error('No school selected');
      return;
    }

    const dialog = document.querySelector('[data-exam-dialog]');
    if (!dialog) return;
    const form = dialog.querySelector('form') as HTMLFormElement | null;
    if (!form) return;

    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const subjectId = formData.get('subjectId') as string;
    const classId = formData.get('classId') as string;

    if (!name || !subjectId || !classId) {
      toast.error('Name, subject, and class are required');
      return;
    }

    const isEditing = !!editExam;

    setAdding(true);
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `/api/exams/${editExam!.id}` : '/api/exams';
      const body: Record<string, unknown> = isEditing ? {} : { schoolId };
      body.name = name;
      body.subjectId = subjectId;
      body.classId = classId;
      body.type = formData.get('type') || 'assessment';
      body.totalMarks = parseInt(formData.get('totalMarks') as string) || 100;
      body.passingMarks = parseInt(formData.get('passingMarks') as string) || 50;
      body.date = formData.get('date') || null;
      body.duration = parseInt(formData.get('duration') as string) || null;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (isEditing ? 'Failed to update exam' : 'Failed to create exam'));

      toast.success(isEditing ? 'Exam updated successfully' : 'Exam created successfully');
      setOpen(false);
      setEditExam(null);

      // Refresh exams
      const refreshed = await fetch(`/api/exams?schoolId=${schoolId}&limit=100`)
        .then(r => r.json())
        .then(j => {
          const items = j.data || j || [];
          return items.map((e: Record<string, unknown>) => {
            const isPublished = e.isPublished as boolean;
            const isLocked = e.isLocked as boolean;
            let status = 'draft';
            if (isLocked) status = 'locked';
            else if (isPublished) status = 'published';
            else if (e.date) {
              const examDate = new Date(e.date as string);
              const now = mounted ? new Date() : new Date('2026-01-01');
              status = examDate > now ? 'active' : 'draft';
            }
            return {
              id: e.id,
              name: e.name as string,
              subject: (e.subject as Record<string, unknown>)?.name || '—',
              class: (e.class as Record<string, unknown>)?.name || '—',
              classId: (e.class as Record<string, unknown>)?.id || '',
              type: e.type as string || 'assessment',
              totalMarks: (e.totalMarks as number) || 100,
              status,
              date: e.date as string || null,
              term: (e.term as Record<string, unknown>)?.name || null,
              teacher: (e.teacher as Record<string, unknown>)?.user
                ? ((e.teacher as Record<string, unknown>).user as Record<string, unknown>).name as string
                : null,
              passingMarks: (e.passingMarks as number) || 50,
              duration: e.duration as number || null,
              scoresCount: ((e._count as Record<string, unknown>)?.scores as number) || 0,
              questionsCount: ((e._count as Record<string, unknown>)?.questions as number) || 0,
            };
          });
        });
      setExams(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : (editExam ? 'Failed to update exam' : 'Failed to create exam'));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!deleteExamId) return;
    setDeletingExam(true);
    try {
      const res = await fetch(`/api/exams/${deleteExamId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete exam');
      toast.success('Exam deleted successfully');
      setDeleteExamId(null);
      setExams(prev => prev.filter(e => e.id !== deleteExamId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete exam');
    } finally {
      setDeletingExam(false);
    }
  };

  const openScoreEntry = async (exam: ExamRecord) => {
    setScoreExam(exam);
    setStudents([]);
    setExistingScores({});
    try {
      const classFilter = exam.classId ? `&classId=${exam.classId}` : '';
      const [studentsRes, scoresRes] = await Promise.all([
        fetch(`/api/students?schoolId=${schoolId}&limit=500${classFilter}`),
        fetch(`/api/exams/${exam.id}/scores`),
      ]);
      const studentsJson = await studentsRes.json();
      const scoresJson = await scoresRes.json();
      const studentList = (studentsJson.data || studentsJson || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: (s.user as Record<string, unknown>)?.name || 'Unknown',
        admissionNo: s.admissionNo as string || '',
      }));
      setStudents(studentList);
      if (scoresJson.data?.scores) {
        const scoreMap: Record<string, number> = {};
        scoresJson.data.scores.forEach((s: Record<string, unknown>) => {
          scoreMap[s.studentId as string] = s.score as number;
        });
        setExistingScores(scoreMap);
      }
    } catch (err) {
      toast.error('Failed to load students and scores');
    }
  };

  const saveScores = async () => {
    if (!scoreExam) return;
    setSavingScores(true);
    try {
      const scores = Object.entries(existingScores).map(([studentId, score]) => ({
        studentId,
        score: parseFloat(score.toString()),
      }));
      const res = await fetch(`/api/exams/${scoreExam.id}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save scores');
      toast.success('Scores saved successfully');
      setScoreExam(null);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save scores');
    } finally {
      setSavingScores(false);
    }
  };

  const handlePrintExam = async (exam: ExamRecord) => {
    try {
      const [examRes, schoolRes] = await Promise.all([
        fetch(`/api/exams/${exam.id}/questions?includeAnswers=true`),
        fetch(`/api/schools/${schoolId}`),
      ]);
      const examJson = await examRes.json();
      const schoolJson = await schoolRes.json();
      const questions: QuestionData[] = (examJson.data || []);
      const school = schoolJson.data || schoolJson;
      if (questions.length === 0) { toast.error('No questions to print'); return; }
      const sortedQ = [...questions].sort((a, b) => (a.order || 0) - (b.order || 0));
      const typeLabel = exam.type.charAt(0).toUpperCase() + exam.type.slice(1);
      const qHtml = sortedQ.map((q, i) => {
        const typeLabelMap: Record<string, string> = { 'MCQ': 'Multiple Choice', 'MULTI_SELECT': 'Multi-Select', 'TRUE_FALSE': 'True/False', 'FILL_BLANK': 'Fill in the Blank', 'SHORT_ANSWER': 'Short Answer', 'ESSAY': 'Essay', 'MATCHING': 'Matching' };
        let optionsHtml = '';
        if (q.type === 'MCQ' || q.type === 'MULTI_SELECT') {
          optionsHtml = '<div style="margin-top:8px">' + (q.options || []).map((opt, oi) =>
            `<div style="padding:4px 0;font-size:12px"><span style="display:inline-block;width:20px;height:20px;border:1.5px solid #333;border-radius:${q.type === 'MCQ' ? '50%' : '3px'};text-align:center;line-height:20px;margin-right:8px;font-size:11px">${String.fromCharCode(65 + oi)}</span>${opt}</div>`
          ).join('') + '</div>';
        } else if (q.type === 'TRUE_FALSE') {
          optionsHtml = '<div style="margin-top:8px"><div style="padding:4px 0;font-size:12px"><span style="display:inline-block;width:20px;height:20px;border:1.5px solid #333;border-radius:50%;margin-right:8px"></span>True</div><div style="padding:4px 0;font-size:12px"><span style="display:inline-block;width:20px;height:20px;border:1.5px solid #333;border-radius:50%;margin-right:8px"></span>False</div></div>';
        } else if (q.type === 'FILL_BLANK') {
          optionsHtml = '<div style="margin-top:8px;border-bottom:1px solid #999;width:70%;height:24px"></div>';
        } else if (q.type === 'SHORT_ANSWER' || q.type === 'ESSAY') {
          optionsHtml = '<div style="margin-top:8px">' + Array.from({ length: q.type === 'ESSAY' ? 8 : 3 }, () => '<div style="border-bottom:1px solid #ddd;height:28px;margin-bottom:4px"></div>').join('') + '</div>';
        }
        const marksLabel = q.marks > 1 ? `${q.marks} marks` : `${q.marks} mark`;
        return `<tr><td style="width:40px;vertical-align:top;padding:10px 6px;font-size:12px;font-weight:600;text-align:center">${i + 1}.</td><td style="vertical-align:top;padding:10px 6px"><div style="font-size:13px;margin-bottom:4px">${q.questionText}</div><div style="font-size:10px;color:#666;margin-bottom:4px">[${typeLabelMap[q.type] || q.type} - ${marksLabel}]</div>${optionsHtml}</td><td style="width:50px;vertical-align:top;padding:10px 6px;text-align:center;font-size:12px">${q.marks}</td></tr>`;
      }).join('');
      const win = window.open('', '_blank');
      if (!win) { toast.error('Popup blocked. Please allow popups.'); return; }
      const logoHtml = school.logo ? `<img src="${school.logo}" style="height:50px;width:auto;margin-right:12px" />` : '';
      win.document.write(`<!DOCTYPE html><html><head><title>${exam.name}</title><style>
        @page { size: A4; margin: 15mm 20mm }
        body { font-family: 'Times New Roman', Times, serif; color: #222; padding: 0; margin: 0 }
        table { width: 100%; border-collapse: collapse }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px }
        .header h1 { font-size: 18px; margin: 5px 0; text-transform: uppercase; letter-spacing: 1px }
        .header h2 { font-size: 14px; margin: 3px 0; font-weight: normal }
        .header p { font-size: 11px; margin: 2px 0; color: #555 }
        .exam-info { margin-bottom: 15px; font-size: 12px }
        .exam-info td { padding: 2px 10px }
        .instructions { margin-bottom: 15px; padding: 10px; border: 1px solid #ccc; background: #f9f9f9; font-size: 12px }
        .instructions h3 { margin: 0 0 5px 0; font-size: 13px }
        .score-col { width: 50px; text-align: center }
        .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 10px; color: #888; text-align: center }
        @media print { .no-print { display: none } }
      </style></head><body>
        <div class="header">
          <div style="display:flex;align-items:center;justify-content:center;gap:12px">${logoHtml}<div><h1>${school.name || 'School'}</h1>${school.address ? `<p>${school.address}</p>` : ''}${school.motto ? `<p><em>${school.motto}</em></p>` : ''}</div></div>
          <h2>${exam.name}</h2>
          <p>${typeLabel} | ${exam.subject} | ${exam.class}</p>
        </div>
        <table class="exam-info"><tr><td><strong>Date:</strong> ${exam.date ? new Date(exam.date).toLocaleDateString() : '________'}</td><td><strong>Duration:</strong> ${exam.duration ? exam.duration + ' mins' : '________'}</td><td><strong>Total Marks:</strong> ${exam.totalMarks}</td></tr></table>
        ${exam.instructions ? `<div class="instructions"><h3>Instructions</h3><p style="font-size:12px;margin:0">${exam.instructions}</p></div>` : ''}
        <table><thead><tr style="border-bottom:2px solid #333"><th style="width:40px;padding:8px 6px;font-size:12px;text-align:center">No.</th><th style="padding:8px 6px;font-size:12px;text-align:left">Question</th><th style="width:50px;padding:8px 6px;font-size:12px;text-align:center">Marks</th></tr></thead><tbody>${qHtml}</tbody></table>
        <div style="margin-top:20px"><p style="font-size:11px;text-align:right"><strong>Total Marks:</strong> ${sortedQ.reduce((sum, q) => sum + (q.marks || 0), 0)}</p></div>
        <div class="footer"><p>SKOOLAR • SCHOOL MANAGEMENT</p></div>
        <div class="no-print" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer">Print</button> <button onclick="window.close()" style="padding:8px 24px;font-size:14px;cursor:pointer">Close</button></div>
      </body></html>`);
      win.document.close();
    } catch (err) {
      toast.error('Failed to generate exam paper');
    }
  };

  const handleDownloadDocx = (examId: string) => {
    const a = document.createElement('a');
    a.href = `/api/exams/${examId}/export?format=docx`;
    a.download = `exam-${examId}.docx`;
    a.click();
  };

  // ── Question Management Handlers ──

  const openQuestionManager = async (exam: ExamRecord) => {
    setManageQuestionsExam(exam);
    setExamQuestions([]);
    setQuestionsLoading(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}/questions?includeAnswers=true`);
      if (!res.ok) throw new Error('Failed to load questions');
      const json = await res.json();
      const qs: QuestionData[] = (json.data || []).map((q: any) => ({
        id: q.id,
        type: q.type || 'MCQ',
        questionText: q.questionText || '',
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correctAnswer ?? '',
        marks: q.marks || 1,
        explanation: q.explanation || '',
        order: q.order || 0,
      }));
      setExamQuestions(qs.length > 0 ? qs : [emptyQuestion(0)]);
    } catch (err) {
      toast.error('Failed to load questions');
      setExamQuestions([emptyQuestion(0)]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const addQuestion = () => {
    setExamQuestions(prev => [...prev, emptyQuestion(prev.length)]);
  };

  const updateQuestion = (index: number, q: QuestionData) => {
    setExamQuestions(prev => prev.map((item, i) => (i === index ? q : item)));
  };

  const deleteQuestion = async (index: number) => {
    const q = examQuestions[index];
    if (!window.confirm(`Delete question ${index + 1}? This cannot be undone.`)) return;
    if (q.id) {
      // Exists on server - delete via API
      if (!manageQuestionsExam) return;
      try {
        const res = await fetch(`/api/exams/${manageQuestionsExam.id}/questions`, {
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

  const saveAllQuestions = async () => {
    if (!manageQuestionsExam) return;
    // Validate
    const invalid = examQuestions.some(q => !q.questionText.trim());
    if (invalid) {
      toast.error('All questions must have question text');
      return;
    }
    setSavingQuestions(true);
    try {
      // Separate new questions (no id) from existing (have id)
      const newQuestions = examQuestions.filter(q => !q.id);
      const existingQuestions = examQuestions.filter(q => q.id);

      // Create new questions one by one
      for (const q of newQuestions) {
        const payload: Record<string, unknown> = {
          type: q.type,
          questionText: q.questionText,
          marks: q.marks,
          explanation: q.explanation || null,
          order: q.order,
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
        const res = await fetch(`/api/exams/${manageQuestionsExam.id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create question');
        }
      }

      // Update existing questions in bulk
      if (existingQuestions.length > 0) {
        const updates = existingQuestions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          marks: q.marks,
          explanation: q.explanation || null,
          order: q.order,
          options: (q.type === 'MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE')
            ? q.options.filter(o => o.trim() !== '')
            : q.type === 'MATCHING' ? { pairs: [] } : undefined,
          correctAnswer: q.correctAnswer !== '' && q.correctAnswer !== undefined && q.correctAnswer !== null
            ? q.correctAnswer : undefined,
        }));
        const res = await fetch(`/api/exams/${manageQuestionsExam.id}/questions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: updates }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update questions');
      }

      toast.success('All questions saved successfully');
      setManageQuestionsExam(null);
      // Refresh the exam list to update question counts if available
      const refreshed = await fetch(`/api/exams?schoolId=${schoolId}&limit=100`)
        .then(r => r.json())
        .then(j => {
          const items = j.data || j || [];
          return items.map((e: Record<string, unknown>) => ({
            id: e.id,
            name: e.name as string,
            subject: (e.subject as Record<string, unknown>)?.name || '—',
            class: (e.class as Record<string, unknown>)?.name || '—',
            classId: (e.class as Record<string, unknown>)?.id || '',
            type: e.type as string || 'assessment',
            totalMarks: (e.totalMarks as number) || 100,
            status: e.isLocked ? 'locked' : e.isPublished ? 'published' : e.date ? (new Date(e.date as string) > (mounted ? new Date() : new Date('2026-01-01')) ? 'active' : 'draft') : 'draft',
            date: e.date as string || null,
            term: (e.term as Record<string, unknown>)?.name || null,
            teacher: (e.teacher as Record<string, unknown>)?.user
              ? ((e.teacher as Record<string, unknown>).user as Record<string, unknown>).name as string
              : null,
            passingMarks: (e.passingMarks as number) || 50,
            duration: e.duration as number || null,
            scoresCount: ((e._count as Record<string, unknown>)?.scores as number) || 0,
            questionsCount: ((e._count as Record<string, unknown>)?.questions as number) || 0,
          }));
        });
      setExams(refreshed);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save questions');
    } finally {
      setSavingQuestions(false);
    }
  };

  const columns: ColumnDef<ExamRecord>[] = React.useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => <span className="text-sm">{row.original.subject}</span>,
    },
    {
      accessorKey: 'class',
      header: 'Class',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">{row.original.class}</Badge>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize">{row.original.type}</Badge>
      ),
    },
    {
      accessorKey: 'totalMarks',
      header: 'Total',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.totalMarks}</span>
      ),
    },
    {
      accessorKey: 'questionsCount',
      header: 'Questions',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.questionsCount}</span>
      ),
    },
    {
      accessorKey: 'scoresCount',
      header: 'Scores',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.scoresCount}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status;
        const variant = s === 'active' ? 'success' : s === 'published' ? 'info' : s === 'draft' ? 'warning' : 'neutral';
        return <StatusBadge variant={variant} size="sm">{s}</StatusBadge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const exam = row.original;
        if (exam.status === 'locked') return null;
        return (
          <div className="flex gap-1 sm:gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); openScoreEntry(exam); }}
            >
              <ClipboardEdit className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Scores</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); openQuestionManager(exam); }}
            >
              <FileQuestion className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Questions</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); setGradingExamId(exam.id); }}
            >
              <Brain className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Grade</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-sky-200 text-sky-700 hover:bg-sky-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); handlePrintExam(exam); }}
            >
              <Printer className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); handleDownloadDocx(exam.id); }}
            >
              <FileDown className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">DOC</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
              onClick={(e) => { e.stopPropagation(); setAnalyticsExamId(exam.id); }}
            >
              <BarChart3 className="size-3 sm:size-3.5" />
              <span className="hidden sm:inline">Analytics</span>
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
                  onClick={(e) => { e.stopPropagation(); setEditExam(exam); setOpen(true); }}
                >
                  <Pencil className="size-3 sm:size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-red-200 text-red-700 hover:bg-red-50 text-[10px] sm:text-xs px-1.5 sm:px-2"
                  onClick={(e) => { e.stopPropagation(); setDeleteExamId(exam.id); }}
                >
                  <Trash2 className="size-3 sm:size-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ], []);

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GraduationCap className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view exams</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (analyticsExamId) {
    return <ExamAnalyticsView examId={analyticsExamId} onBack={() => setAnalyticsExamId(null)} />;
  }

  if (gradingExamId) {
    return <ExamGradingView examId={gradingExamId} onBack={() => setGradingExamId(null)} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="size-12 text-destructive opacity-60" />
        <p className="mt-3 text-sm font-medium">Failed to load exams</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div 
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h2 className="text-lg font-semibold">Exam Management</h2>
          <p className="text-sm text-muted-foreground">{exams.length} examinations configured</p>
        </div>
        <Dialog open={open} onOpenChange={(open) => { if (!open) { setEditExam(null); } setOpen(open); }}>
          {isAdmin && <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setEditExam(null)}>
              <Plus className="size-4" />
              Create Exam
            </Button>
          </DialogTrigger>}
          <DialogContent data-exam-dialog className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editExam ? 'Edit Exam' : 'Create Exam'}</DialogTitle>
              <DialogDescription>{editExam ? 'Update the examination details.' : 'Set up a new examination or test.'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateExam(); }}>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" placeholder="e.g. Mid-Term Exam" required defaultValue={editExam?.name || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select name="subjectId" required defaultValue={editExam?.subject || ''}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select name="classId" required defaultValue={editExam?.classId || ''}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue={editExam?.type || 'assessment'}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ca">CA Test</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="practical">Practical</SelectItem>
                        <SelectItem value="assessment">Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Total Score</Label>
                    <Input name="totalMarks" placeholder="100" type="number" defaultValue={editExam?.totalMarks?.toString() || '100'} />
                  </div>
                  <div className="space-y-2">
                    <Label>Passing Score</Label>
                    <Input name="passingMarks" placeholder="50" type="number" defaultValue={editExam?.passingMarks?.toString() || '50'} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Exam Date</Label>
                    <Input name="date" type="date" defaultValue={editExam?.date ? editExam.date.split('T')[0] : ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (mins)</Label>
                    <Input name="duration" placeholder="60" type="number" defaultValue={editExam?.duration?.toString() || ''} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditExam(null); }}>Cancel</Button>
                <Button type="submit" disabled={adding}>
                  {adding && <Loader2 className="size-4 animate-spin mr-1" />}
                  {editExam ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Filters */}
      <motion.div 
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {statusFilters.map(filter => (
          <Button key={filter} variant={activeStatus === filter ? 'default' : 'outline'} size="sm" onClick={() => setActiveStatus(filter)}>
            {filter}
          </Button>
        ))}
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable columns={columns} data={filteredExams} searchKey="name" searchPlaceholder="Search exams..." />
      </motion.div>

      {filteredExams.length === 0 && exams.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <GraduationCap className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No exams match the selected filter</p>
        </div>
      )}

      {exams.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <GraduationCap className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No exams configured yet</p>
          <p className="text-xs mt-1">Click &quot;Create Exam&quot; to get started</p>
        </div>
      )}

      <Dialog open={!!scoreExam} onOpenChange={(open) => { if (!open) setScoreExam(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw]">
          <DialogHeader>
            <DialogTitle>Enter Scores - {scoreExam?.name}</DialogTitle>
            <DialogDescription>
              Total Marks: {scoreExam?.totalMarks} | Passing: {scoreExam?.passingMarks}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-0 sm:min-w-[500px]">
              <thead className="sticky top-0 bg-white border-b">
                <tr>
                  <th className="text-left p-2 font-medium whitespace-nowrap">Admission No</th>
                  <th className="text-left p-2 font-medium whitespace-nowrap">Student Name</th>
                  <th className="text-left p-2 font-medium whitespace-nowrap">Score (0-{scoreExam?.totalMarks || 100})</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs whitespace-nowrap">{student.admissionNo}</td>
                    <td className="p-2 whitespace-nowrap">{student.name}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        max={scoreExam?.totalMarks || 100}
                        className="w-20 sm:w-24"
                        value={existingScores[student.id] || ''}
                        onChange={(e) => setExistingScores(prev => ({
                          ...prev,
                          [student.id]: parseFloat(e.target.value) || 0,
                        }))}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {students.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No students found for this exam's class</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setScoreExam(null)}>Cancel</Button>
            <Button onClick={saveScores} disabled={savingScores || students.length === 0}>
              {savingScores && <Loader2 className="size-4 animate-spin mr-1" />}
              Save Scores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Question Management Dialog ── */}
      <Dialog open={!!manageQuestionsExam} onOpenChange={(open) => { if (!open) setManageQuestionsExam(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="size-5 text-purple-600" />
              Manage Questions — {manageQuestionsExam?.name}
            </DialogTitle>
            <DialogDescription>
              {manageQuestionsExam?.subject} · {manageQuestionsExam?.class} · {examQuestions.length} question{examQuestions.length !== 1 ? 's' : ''}
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
                  />
                ))}
                <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1 w-full border-dashed">
                  <Plus className="size-3.5" /> Add Question
                </Button>
              </div>
              <DialogFooter className="px-6 py-4 border-t bg-muted/20">
                <Button variant="outline" onClick={() => setManageQuestionsExam(null)}>Cancel</Button>
                <Button onClick={saveAllQuestions} disabled={savingQuestions} className="bg-purple-600 hover:bg-purple-700 gap-1">
                  {savingQuestions ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {savingQuestions ? 'Saving...' : 'Save All Questions'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Exam Confirmation */}
      <Dialog open={!!deleteExamId} onOpenChange={() => setDeleteExamId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="size-5" />
              Delete Exam
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this exam? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteExamId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteExam} disabled={deletingExam}>
              {deletingExam && <Loader2 className="size-4 mr-2 animate-spin" />}
              {deletingExam ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── Question Editor Sub-Component ───────────────────────────────────────────

const QUESTION_TYPE_OPTIONS = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'MULTI_SELECT', label: 'Multi-Select' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'FILL_BLANK', label: 'Fill in the Blank' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'MATCHING', label: 'Matching' },
];

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: QuestionData;
  index: number;
  total: number;
  onChange: (q: QuestionData) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const needsOptions = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE'].includes(question.type);

  const updateField = (field: keyof QuestionData, value: any) => {
    onChange({ ...question, [field]: value });
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      {/* Header row */}
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
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUESTION_TYPE_OPTIONS.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={question.marks}
            onChange={e => updateField('marks', parseInt(e.target.value) || 1)}
            className="h-7 w-16 text-xs"
            min={1}
            placeholder="Marks"
          />
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

      {/* Question text */}
      <Textarea
        placeholder="Enter question text..."
        value={question.questionText}
        onChange={e => updateField('questionText', e.target.value)}
        rows={2}
        className="text-sm resize-none"
      />

      {/* MCQ / Multi-Select options */}
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

      {/* True/False */}
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

      {/* Fill in the Blank */}
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

      {/* Short Answer */}
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

      {/* Essay */}
      {question.type === 'ESSAY' && (
        <p className="text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2">
          Essay questions will be manually graded by the teacher. AI grading suggestions will be available.
        </p>
      )}

      {/* Matching */}
      {question.type === 'MATCHING' && (
        <p className="text-xs text-muted-foreground bg-amber-50 rounded-lg px-3 py-2">
          Matching questions are supported. Define pairs using the correct answer format:{' '}
          <code className="text-amber-700">{'{ pairs: [{left, right}] }'}</code>
        </p>
      )}

      {/* Explanation */}
      <Input
        value={question.explanation}
        onChange={e => updateField('explanation', e.target.value)}
        placeholder="Explanation (shown to students after grading, optional)"
        className="text-xs h-8"
      />
    </div>
  );
}
