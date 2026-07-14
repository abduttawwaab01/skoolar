'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ClipboardList, Star, User, Calendar, MessageSquare, Target,
  TrendingUp, Award, Send, Eye, EyeOff, CheckCircle, Loader2, MessageCircle, ExternalLink,
  FileText, Download, Brain, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import jsPDF from 'jspdf';
import { ExportMenu } from '@/components/shared/export-menu';
import { SendToParent } from '@/components/shared/send-to-parent';
import { InsightsPanel } from '@/components/shared/insights-panel';
import { useAppStore } from '@/store/app-store';

interface Student {
  id: string;
  name: string;
  admissionNo: string;
  class: string;
}

interface WeeklyEvaluationForm {
  studentId: string;
  weekDate: string; // Monday date of the week
  academicPerformance: number;
  behavior: number;
  attendance: number;
  homework: number;
  effort?: number;
  comments: string;
  goals: string;
  strengths: string;
  areasToImprove: string;
  isShared: boolean;
  teacherId: string;
}

function getDefaultWeekDate(): string {
  if (typeof window === 'undefined') return '';
  return getMonday(new Date()).toISOString().split('T')[0];
}

const defaultForm: WeeklyEvaluationForm = {
  studentId: '',
  weekDate: '',
  academicPerformance: 3,
  behavior: 3,
  attendance: 3,
  homework: 3,
  effort: 3,
  comments: '',
  goals: '',
  strengths: '',
  areasToImprove: '',
  isShared: true,
  teacherId: '',
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

const RatingScale = [
  { value: 1, label: '1', description: 'Needs Improvement' },
  { value: 2, label: '2', description: 'Developing' },
  { value: 3, label: '3', description: 'Satisfactory' },
  { value: 4, label: '4', description: 'Good' },
  { value: 5, label: '5', description: 'Excellent' },
];

const categories = [
  { key: 'academicPerformance', label: 'Academic Performance', icon: Star, color: 'text-yellow-500' },
  { key: 'behavior', label: 'Behavior', icon: Award, color: 'text-blue-500' },
  { key: 'attendance', label: 'Attendance', icon: TrendingUp, color: 'text-green-500' },
  { key: 'homework', label: 'Homework', icon: ClipboardList, color: 'text-purple-500' },
  { key: 'effort', label: 'Effort', icon: Target, color: 'text-orange-500' },
];

interface ClassOption {
  id: string;
  name: string;
  section?: string;
}

export function WeeklyEvaluation() {
  const { currentUser } = useAppStore();
  const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR'].includes(currentUser.role);
  const [mounted, setMounted] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [form, setForm] = useState<WeeklyEvaluationForm>({ ...defaultForm, weekDate: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [weekFilter, setWeekFilter] = useState('');
  const [sendingParentEmail, setSendingParentEmail] = useState(false);
  const [whatsappUrls, setWhatsappUrls] = useState<{ name: string; phone: string; url: string }[]>([]);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [sendingEvalId, setSendingEvalId] = useState<string | null>(null);
  const [selectedEval, setSelectedEval] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [trendEvals, setTrendEvals] = useState<any[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    const monday = getMonday(new Date()).toISOString().split('T')[0];
    setWeekFilter(monday);
    setForm(prev => ({ ...prev, weekDate: monday }));
    setMounted(true);
  }, []);

  // Fetch classes / teachers / evaluations on mount
  useEffect(() => {
    if (!mounted) return;
    fetchClasses();
    if (isAdmin) fetchTeachers();
    fetchEvaluations();
  }, [mounted]);

  // Fetch students when class changes
  useEffect(() => {
    if (selectedClassId) {
      fetchStudents(selectedClassId);
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  // Fetch evaluations for selected week
  useEffect(() => {
    if (weekFilter) {
      fetchEvaluations(weekFilter);
    }
  }, [weekFilter]);

  async function fetchClasses() {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) {
        const json = await res.json();
        const items = json.data || json || [];
        setClasses(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  }

  async function fetchStudents(classId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/students?classId=${classId}&limit=500`);
      if (res.ok) {
        const json = await res.json();
        const studentList: Student[] = (json.data || []).map((s: any) => ({
          id: s.id,
          name: s.name || s.user?.name || 'Unknown',
          admissionNo: s.admissionNo || 'N/A',
          class: s.class?.name || 'N/A',
        }));
        setStudents(studentList);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvaluations(week?: string) {
    try {
      const params = new URLSearchParams();
      if (week) params.set('weekDate', week);
      const res = await fetch(`/api/weekly-evaluations?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setEvaluations(json.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch evaluations:', error);
    }
  }

  async function fetchTeachers() {
    try {
      const schoolId = currentUser.schoolId;
      if (!schoolId) return;
      const res = await fetch(`/api/teachers?schoolId=${schoolId}&limit=200`);
      if (res.ok) {
        const json = await res.json();
        const items = json.data || json || [];
        setTeachers(Array.isArray(items) ? items.map((t: any) => ({
          id: t.id,
          name: t.user?.name || t.name || 'Unknown',
        })) : []);
      }
    } catch (error) {
      console.error('Failed to fetch teachers:', error);
    }
  }

  function updateForm<K extends keyof WeeklyEvaluationForm>(key: K, value: WeeklyEvaluationForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const { teacherId: _, ...teacherlessPayload } = form;
      const payload = isAdmin ? form : teacherlessPayload;
      const res = await fetch('/api/weekly-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit evaluation');
      }
      
      toast.success('Weekly evaluation submitted successfully!');
      
      // Reset form for next student
      setForm({
        ...defaultForm,
        weekDate: form.weekDate, // Keep same week
      });
      
      // Refresh evaluations list
      fetchEvaluations(form.weekDate);
      
      // Show success action (notify parent if shared)
      if (form.isShared) {
        toast.info('Parent notified of evaluation');
        // If the response includes whatsappUrls, show the dialog
        if (json.whatsappUrls && json.whatsappUrls.length > 0) {
          setWhatsappUrls(json.whatsappUrls);
          setShowWhatsAppDialog(true);
        }
      }
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit evaluation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendToParent(evaluationId: string) {
    if (!evaluationId) { toast.error('No evaluation selected'); return; }
    try {
      setSendingEvalId(evaluationId);
      setSendingParentEmail(true);
      setWhatsappUrls([]);
      const res = await fetch(`/api/weekly-evaluations/${evaluationId}/send-to-parent`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      toast.success(json.message || 'Evaluation sent to parent(s)');
      if (json.whatsappUrls && json.whatsappUrls.length > 0) {
        setWhatsappUrls(json.whatsappUrls);
        setShowWhatsAppDialog(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSendingParentEmail(false);
      setSendingEvalId(null);
    }
  }

  function getAverageScore(evalData: any): number {
    const scores = [
      evalData.academicPerformance,
      evalData.behavior,
      evalData.attendance,
      evalData.homework,
    ].map(Number);
    if (evalData.effort != null) scores.push(Number(evalData.effort));
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  function getScoreColor(score: number): string {
    if (score >= 4) return 'text-emerald-600';
    if (score >= 3) return 'text-amber-600';
    return 'text-red-600';
  }

  function getScoreBg(score: number): string {
    if (score >= 4) return 'bg-emerald-100 text-emerald-800';
    if (score >= 3) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  }

  function getRatingLabel(score: number): string {
    return RatingScale[Math.max(0, Math.min(4, score - 1))]?.description || '';
  }

  async function handleViewDetail(evalData: any) {
    setSelectedEval(evalData);
    setDetailOpen(true);
    // Load trend data for this student
    setTrendLoading(true);
    try {
      const res = await fetch(`/api/weekly-evaluations?studentId=${evalData.studentId}`);
      if (res.ok) {
        const json = await res.json();
        setTrendEvals((json.data || []).sort((a: any, b: any) => new Date(a.weekDate).getTime() - new Date(b.weekDate).getTime()));
      }
    } catch {}
    setTrendLoading(false);
  }

  function generateEvalPDF(evalData: any) {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;
    let y = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(currentUser?.schoolName || 'School Name', pw / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text('Weekly Evaluation Report', pw / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, y, { align: 'center' });
    y += 8;
    doc.setTextColor(0);

    // Separator
    doc.setDrawColor(200);
    doc.line(margin, y, pw - margin, y);
    y += 8;

    // Student Info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Information', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const infoRows = [
      ['Name:', evalData.studentName || 'N/A'],
      ['Class:', evalData.studentClass || 'N/A'],
      ['Week:', `${new Date(evalData.weekDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`],
      ['Teacher:', evalData.teacherName || 'N/A'],
    ];
    for (const [label, value] of infoRows) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(` ${value}`, margin + 30, y);
      y += 5;
    }
    y += 4;

    // Ratings
    doc.setDrawColor(200);
    doc.line(margin, y, pw - margin, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance Ratings', margin, y);
    y += 7;

    const ratingLabels = ['Academic Performance', 'Behavior', 'Attendance', 'Homework', 'Effort'];
    const ratingKeys = ['academicPerformance', 'behavior', 'attendance', 'homework', 'effort'];
    for (let i = 0; i < ratingLabels.length; i++) {
      const val = evalData[ratingKeys[i]];
      if (val === undefined || val === null) continue;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const labelWidth = doc.getTextWidth(ratingLabels[i]);
      doc.text(ratingLabels[i], margin + 4, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`${val}/5 — ${getRatingLabel(val)}`, margin + 4 + labelWidth + 4, y);
      y += 5;
    }
    y += 4;

    // Scores bar
    const avg = getAverageScore(evalData);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(`Overall Score: ${avg.toFixed(1)}/5`, margin, y);
    y += 6;
    doc.setTextColor(0);

    // Comments
    if (evalData.comments) {
      doc.setDrawColor(200);
      doc.line(margin, y, pw - margin, y);
      y += 5;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Comments', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(evalData.comments, pw - margin * 2 - 8);
      for (const l of lines) {
        doc.text(l, margin + 4, y);
        y += 5;
      }
      y += 3;
    }

    // Strengths
    if (evalData.strengths) {
      doc.setDrawColor(200);
      doc.line(margin, y, pw - margin, y);
      y += 5;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Strengths', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(evalData.strengths, pw - margin * 2 - 8);
      for (const l of lines) {
        doc.text(l, margin + 4, y);
        y += 5;
      }
      y += 3;
    }

    // Areas to Improve
    if (evalData.areasToImprove) {
      doc.setDrawColor(200);
      doc.line(margin, y, pw - margin, y);
      y += 5;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Areas to Improve', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(evalData.areasToImprove, pw - margin * 2 - 8);
      for (const l of lines) {
        doc.text(l, margin + 4, y);
        y += 5;
      }
      y += 3;
    }

    // Goals
    if (evalData.goals) {
      doc.setDrawColor(200);
      doc.line(margin, y, pw - margin, y);
      y += 5;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Goals for Next Week', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(evalData.goals, pw - margin * 2 - 8);
      for (const l of lines) {
        doc.text(l, margin + 4, y);
        y += 5;
      }
      y += 3;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Skoolar - Weekly Evaluation Report', pw / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    const safeName = (evalData.studentName || 'student').replace(/\s+/g, '_');
    const safeDate = new Date(evalData.weekDate).toISOString().split('T')[0];
    doc.save(`Weekly_Eval_${safeName}_${safeDate}.pdf`);
  }

  async function handleBulkSend() {
    const shared = evaluations.filter(e => e.isShared);
    if (shared.length === 0) {
      toast.error('No shared evaluations to send');
      return;
    }
    setSendingParentEmail(true);
    let sent = 0;
    let failed = 0;
    for (const ev of shared) {
      try {
        const res = await fetch(`/api/weekly-evaluations/${ev.id}/send-to-parent`, { method: 'POST' });
        if (res.ok) sent++;
        else failed++;
      } catch { failed++; }
    }
    setSendingParentEmail(false);
    if (sent > 0) toast.success(`Sent ${sent} evaluation(s) to parents`);
    if (failed > 0) toast.error(`${failed} evaluation(s) failed to send`);
  }

  // Derive student trend data from evaluations
  const studentTrendData = useMemo(() => {
    if (!selectedEval) return [];
    return trendEvals.map((e: any) => ({
      week: new Date(e.weekDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      avg: getAverageScore(e),
      academic: e.academicPerformance,
      behavior: e.behavior,
      attendance: e.attendance,
      homework: e.homework,
      effort: e.effort || 0,
    }));
  }, [trendEvals, selectedEval]);

  // Radar data for detail view
  const radarData = useMemo(() => {
    if (!selectedEval) return [];
    return [
      { category: 'Academic', score: selectedEval.academicPerformance || 0, fullMark: 5 },
      { category: 'Behavior', score: selectedEval.behavior || 0, fullMark: 5 },
      { category: 'Attendance', score: selectedEval.attendance || 0, fullMark: 5 },
      { category: 'Homework', score: selectedEval.homework || 0, fullMark: 5 },
      { category: 'Effort', score: selectedEval.effort || 3, fullMark: 5 },
    ];
  }, [selectedEval]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="size-6 text-emerald-600" />
            Weekly Evaluations
          </h2>
          <p className="text-sm text-gray-500">
            Evaluate student performance weekly. Parents will be notified when shared.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="weekFilter" className="text-sm">Week of:</Label>
          <Input
            id="weekFilter"
            type="date"
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Evaluation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit Evaluation</CardTitle>
            <CardDescription>
              Rate student performance for the week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Class Selection */}
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Select 
                  value={selectedClassId} 
                  onValueChange={(value) => {
                    setSelectedClassId(value);
                    setForm(prev => ({ ...prev, studentId: '' }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class first" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}{cls.section ? ` (${cls.section})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Teacher Selection (admin only) */}
              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="teacher">Evaluating Teacher</Label>
                  <Select
                    value={form.teacherId}
                    onValueChange={(value) => updateForm('teacherId', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.length === 0 ? (
                        <SelectItem value="_placeholder" disabled>
                          Loading teachers...
                        </SelectItem>
                      ) : teachers.map(teacher => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Student Selection */}
              <div className="space-y-2">
                <Label htmlFor="student">Student</Label>
                <Select 
                  value={form.studentId} 
                  onValueChange={(value) => updateForm('studentId', value)}
                  disabled={!selectedClassId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedClassId ? 'Select a student' : 'Select a class first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {students.length === 0 ? (
                      <SelectItem value="_placeholder" disabled>
                        {loading ? 'Loading...' : 'No students in this class'}
                      </SelectItem>
                    ) : students.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} - {student.admissionNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Week Date */}
              <div className="space-y-2">
                <Label htmlFor="weekDate">Week Starting</Label>
                <Input
                  id="weekDate"
                  type="date"
                  value={form.weekDate}
                  onChange={(e) => updateForm('weekDate', e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  Evaluations are for the week beginning Monday
                </p>
              </div>

              <Separator />

              {/* Rating Categories */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Performance Ratings (1-5)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map(category => {
                    const Icon = category.icon;
                    return (
                      <div key={category.key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`size-4 ${category.color}`} />
                          <Label className="text-xs">{category.label}</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          {RatingScale.map(rate => (
                            <button
                              key={rate.value}
                              type="button"
                              onClick={() => updateForm(category.key as keyof WeeklyEvaluationForm, rate.value)}
                              className={`
                                flex-1 h-8 rounded text-xs font-medium transition-all
                                ${(form[category.key as keyof WeeklyEvaluationForm] as number) >= rate.value
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                              `}
                            >
                              {rate.value}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 h-3">
                          {RatingScale[(form[category.key as keyof WeeklyEvaluationForm] as number) - 1]?.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Comments */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <MessageSquare className="size-3" /> Comments
                  </Label>
                  <Textarea
                    value={form.comments}
                    onChange={(e) => updateForm('comments', e.target.value)}
                    placeholder="General comments about the student's week..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Award className="size-3" /> Strengths
                    </Label>
                    <Textarea
                      value={form.strengths}
                      onChange={(e) => updateForm('strengths', e.target.value)}
                      placeholder="What went well..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Target className="size-3" /> Areas to Improve
                    </Label>
                    <Textarea
                      value={form.areasToImprove}
                      onChange={(e) => updateForm('areasToImprove', e.target.value)}
                      placeholder="Focus areas for next week..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <TrendingUp className="size-3" /> Goals for Next Week
                  </Label>
                  <Textarea
                    value={form.goals}
                    onChange={(e) => updateForm('goals', e.target.value)}
                    placeholder="Specific goals for improvement..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>

              <Separator />

              {/* Share with Parents */}
              <div className="flex items-center justify-between flex-wrap gap-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-3">
                  <Send className="size-5 text-blue-600" />
                  <div>
                    <Label htmlFor="isShared" className="text-sm font-medium cursor-pointer">
                      Share with Parents
                    </Label>
                    <p className="text-xs text-gray-600">
                      Parents will receive a notification
                    </p>
                  </div>
                </div>
                <Switch
                  id="isShared"
                  checked={form.isShared}
                  onCheckedChange={(checked) => updateForm('isShared', checked)}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={submitting || !form.studentId}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="size-4 mr-2" />
                    Submit Evaluation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Evaluations List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evaluations This Week</CardTitle>
            <CardDescription>
              {mounted ? `${new Date(weekFilter).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} - ${new Date(new Date(weekFilter).getTime() + 6*24*60*60*1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : evaluations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ClipboardList className="size-12 mx-auto mb-2 opacity-50" />
                <p>No evaluations for this week</p>
                <p className="text-xs">Start by submitting your first evaluation</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {evaluations.map((evalData) => (
                  <div key={evalData.id} className="p-4 rounded-lg border bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{evalData.studentName}</p>
                        <p className="text-xs text-gray-500">
                          {evalData.studentClass} • {evalData.teacherName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {evalData.isShared && (
                          <Badge variant="outline" className="text-xs bg-blue-50">
                            <Send className="size-3 mr-1" />
                            Shared
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {getAverageScore(evalData).toFixed(1)}/5
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                      {categories.map(cat => (
                        <div key={cat.key} className="text-center">
                          <div className="text-lg font-bold" style={{
                            color: evalData[cat.key] >= 4 ? '#059669' : evalData[cat.key] >= 3 ? '#d97706' : '#dc2626'
                          }}>
                            {evalData[cat.key]}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{cat.label}</div>
                        </div>
                      ))}
                    </div>
                    
                    {evalData.comments && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                        {evalData.comments}
                      </p>
                    )}
                    
                      <div className="flex items-center justify-between flex-wrap gap-2 mt-2 pt-2 border-t">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{new Date(evalData.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(evalData)}
                          className="text-xs h-7"
                        >
                          <Eye className="size-3 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateEvalPDF(evalData)}
                          className="text-xs h-7"
                        >
                          <Download className="size-3 mr-1" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendToParent(evalData.id)}
                          disabled={sendingParentEmail && sendingEvalId === evalData.id}
                          className="text-xs h-7"
                        >
                          {sendingParentEmail && sendingEvalId === evalData.id ? (
                            <Loader2 className="size-3 mr-1 animate-spin" />
                          ) : (
                            <Send className="size-3 mr-1" />
                          )}
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Evaluations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg">All Evaluations</CardTitle>
              <CardDescription>
                Comprehensive view of weekly evaluations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {evaluations.filter(e => e.isShared).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkSend}
                  disabled={sendingParentEmail}
                  className="text-xs"
                >
                  {sendingParentEmail ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <Send className="size-3 mr-1" />
                  )}
                  Bulk Send ({evaluations.filter(e => e.isShared).length})
                </Button>
              )}
              <ExportMenu options={{
                title: 'Weekly Evaluations',
                subtitle: `${evaluations.length} evaluations · Week of ${new Date(weekFilter).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
                fileName: `weekly_evaluations_${weekFilter}`,
                columns: [
                  { header: 'Student', key: 'studentName' },
                  { header: 'Class', key: 'studentClass' },
                  { header: 'Week', key: 'weekDate' },
                  { header: 'Academic', key: 'academicPerformance' },
                  { header: 'Behavior', key: 'behavior' },
                  { header: 'Attendance', key: 'attendance' },
                  { header: 'Homework', key: 'homework' },
                  { header: 'Effort', key: 'effort' },
                  { header: 'Avg', key: 'avgScore' },
                  { header: 'Shared', key: 'sharedStatus' },
                ],
                data: evaluations.map((e: any) => ({
                  studentName: e.studentName,
                  studentClass: e.studentClass,
                  weekDate: new Date(e.weekDate).toLocaleDateString(),
                  academicPerformance: `${e.academicPerformance}/5`,
                  behavior: `${e.behavior}/5`,
                  attendance: `${e.attendance}/5`,
                  homework: `${e.homework}/5`,
                  effort: e.effort != null ? `${e.effort}/5` : '-',
                  avgScore: getAverageScore(e).toFixed(1),
                  sharedStatus: e.isShared ? 'Yes' : 'No',
                })),
                summaryRows: [
                  { label: 'Total Evaluations', value: String(evaluations.length) },
                  { label: 'Shared with Parents', value: String(evaluations.filter(e => e.isShared).length) },
                ],
              }} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No evaluations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Student</th>
                    <th className="text-center py-2 px-2">Week</th>
                    <th className="text-center py-2 px-2">Academic</th>
                    <th className="text-center py-2 px-2">Behavior</th>
                    <th className="text-center py-2 px-2">Attendance</th>
                    <th className="text-center py-2 px-2">Homework</th>
                    <th className="text-center py-2 px-2">Effort</th>
                    <th className="text-center py-2 px-2">Avg</th>
                    <th className="text-center py-2 px-2">Shared</th>
                    <th className="text-center py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((evalData) => (
                    <tr key={evalData.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <button onClick={() => handleViewDetail(evalData)} className="text-left hover:text-emerald-600 transition-colors">
                          <p className="font-medium">{evalData.studentName}</p>
                          <p className="text-xs text-gray-500">{evalData.studentClass}</p>
                        </button>
                      </td>
                      <td className="text-center py-2 px-2 text-xs">
                        {new Date(evalData.weekDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${getScoreColor(evalData.academicPerformance)}`}>
                          {evalData.academicPerformance}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${getScoreColor(evalData.behavior)}`}>
                          {evalData.behavior}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${getScoreColor(evalData.attendance)}`}>
                          {evalData.attendance}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${getScoreColor(evalData.homework)}`}>
                          {evalData.homework}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${evalData.effort != null ? getScoreColor(evalData.effort) : 'text-gray-300'}`}>
                          {evalData.effort != null ? evalData.effort : '-'}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-bold ${getScoreColor(getAverageScore(evalData))}`}>
                          {getAverageScore(evalData).toFixed(1)}
                        </span>
                      </td>
                       <td className="text-center py-2 px-2">
                          {evalData.isShared ? (
                            <Eye className="size-4 text-blue-600 mx-auto" />
                          ) : (
                            <EyeOff className="size-4 text-gray-300 mx-auto" />
                          )}
                        </td>
                        <td className="text-center py-2 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(evalData)}
                              className="h-7 w-7 p-0"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generateEvalPDF(evalData)}
                              className="h-7 w-7 p-0"
                            >
                              <Download className="size-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendToParent(evalData.id)}
                              disabled={sendingParentEmail && sendingEvalId === evalData.id}
                              className="h-7 text-xs px-2"
                            >
                              {sendingParentEmail && sendingEvalId === evalData.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Send className="size-3" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail View Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-emerald-600" />
              Evaluation Detail
            </DialogTitle>
            <DialogDescription>
              Weekly evaluation for {selectedEval?.studentName || ''}
            </DialogDescription>
          </DialogHeader>
          {selectedEval && (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-5">
                {/* Header Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Student</p>
                    <p className="font-semibold text-sm">{selectedEval.studentName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Class</p>
                    <p className="font-semibold text-sm">{selectedEval.studentClass}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Week</p>
                    <p className="font-semibold text-sm">{new Date(selectedEval.weekDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Teacher</p>
                    <p className="font-semibold text-sm">{selectedEval.teacherName}</p>
                  </div>
                </div>

                {/* Radar Chart */}
                {radarData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Brain className="size-4 text-indigo-600" /> Performance Radar
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
                          <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                          <RechartsTooltip formatter={(value: number) => [`${value}/5`, 'Score']} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Ratings */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm">Performance Ratings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      {categories.map(cat => {
                        const val = selectedEval[cat.key] as number || 0;
                        const Icon = cat.icon;
                        return (
                          <div key={cat.key} className={`p-3 rounded-xl text-center ${getScoreBg(val)}`}>
                            <Icon className={`size-5 mx-auto mb-1 ${cat.color}`} />
                            <p className="text-2xl font-bold">{val}</p>
                            <p className="text-xs mt-0.5">{cat.label}</p>
                            <p className="text-[10px] opacity-75 mt-0.5">{getRatingLabel(val)}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-4">
                      <span className="text-sm text-gray-500">Overall Average:</span>
                      <span className={`text-xl font-bold ${getScoreColor(getAverageScore(selectedEval))}`}>
                        {getAverageScore(selectedEval).toFixed(1)} / 5
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Trend Chart */}
                {studentTrendData.length >= 2 && (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="size-4 text-emerald-600" /> Score Trend
                      </CardTitle>
                      <CardDescription className="text-xs">Performance over time for this student</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={studentTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                          <RechartsTooltip />
                          <Line type="monotone" dataKey="avg" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="Avg Score" />
                          <Line type="monotone" dataKey="academic" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 2 }} name="Academic" />
                          <Line type="monotone" dataKey="behavior" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} name="Behavior" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Comments */}
                {selectedEval.comments && (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="size-4 text-blue-500" /> Comments
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{selectedEval.comments}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Strengths & Areas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedEval.strengths && (
                    <Card>
                      <CardHeader className="pb-1">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Award className="size-4 text-emerald-500" /> Strengths
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{selectedEval.strengths}</p>
                      </CardContent>
                    </Card>
                  )}
                  {selectedEval.areasToImprove && (
                    <Card>
                      <CardHeader className="pb-1">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="size-4 text-amber-500" /> Areas to Improve
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{selectedEval.areasToImprove}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Goals */}
                {selectedEval.goals && (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="size-4 text-purple-500" /> Goals for Next Week
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{selectedEval.goals}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Insights */}
                <InsightsPanel
                  title="Weekly Evaluation Insights"
                  averageScore={Math.round(getAverageScore(selectedEval) * 20)}
                  passRate={getAverageScore(selectedEval) >= 3 ? 100 : 0}
                  totalStudents={1}
                  strengths={(() => {
                    const items: { name: string; score: number; average: number }[] = [];
                    for (const cat of categories) {
                      const val = selectedEval[cat.key] as number || 0;
                      if (val >= 4) items.push({ name: cat.label, score: val * 20, average: 60 });
                    }
                    return items;
                  })()}
                  weaknesses={(() => {
                    const items: { name: string; score: number; average: number }[] = [];
                    for (const cat of categories) {
                      const val = selectedEval[cat.key] as number || 0;
                      if (val <= 2) items.push({ name: cat.label, score: val * 20, average: 60 });
                    }
                    return items;
                  })()}
                  recommendations={(() => {
                    const r: Array<{ type: 'danger' | 'warning' | 'success' | 'info'; title: string; description: string }> = [];
                    const avg = getAverageScore(selectedEval);
                    if (avg >= 4) r.push({ type: 'success', title: 'Excellent Overall', description: 'Student is performing very well across all categories.' });
                    else if (avg <= 2.5) r.push({ type: 'danger', title: 'Needs Attention', description: 'Student is struggling. Consider a parent-teacher meeting.' });
                    else r.push({ type: 'info', title: 'Satisfactory Progress', description: 'Student is making steady progress with room for improvement.' });
                    for (const cat of categories) {
                      const val = selectedEval[cat.key] as number || 0;
                      if (val <= 2) r.push({ type: 'warning', title: `Low ${cat.label}`, description: `Score of ${val}/5. Consider intervention strategies.` });
                    }
                    return r;
                  })()}
                  questionAnalysis={categories.map((cat, i) => ({
                    questionNumber: i + 1,
                    questionText: cat.label,
                    type: 'Rating',
                    marks: 5,
                    correctRate: Math.round(((selectedEval[cat.key] as number || 0) / 5) * 100),
                    difficulty: (selectedEval[cat.key] as number || 0) >= 4 ? 'Easy' : (selectedEval[cat.key] as number || 0) >= 3 ? 'Medium' : 'Hard',
                  }))}
                />

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="default" size="sm" onClick={() => { generateEvalPDF(selectedEval); }}>
                    <Download className="size-4 mr-1" /> Download PDF
                  </Button>
                  <SendToParent
                    endpoint={`/api/weekly-evaluations/${selectedEval.id}/send-to-parent`}
                    label="Send to Parent"
                    variant="outline"
                    size="sm"
                    assessmentName="Weekly Evaluation"
                  />
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Share Dialog */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="size-5 text-emerald-600" />
              Share via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Click a parent&apos;s WhatsApp link below to open WhatsApp with a pre-filled evaluation message. You will need to press Send manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {whatsappUrls.length === 0 && (
              <p className="text-sm text-gray-500">No parent phone numbers available.</p>
            )}
            {whatsappUrls.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="size-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.phone}</p>
                  </div>
                </div>
                <ExternalLink className="size-4 text-gray-400" />
              </a>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}