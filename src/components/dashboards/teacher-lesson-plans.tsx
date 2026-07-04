'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store/app-store';
import {
  Plus, BookText, Sparkles, Calendar, CheckCircle2, FileText, Target, ListChecks, Lightbulb, GraduationCap, MoreVertical, Pencil, Trash2, Archive, HelpCircle, Loader2, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { LessonPlanQuizEditor } from '@/components/features/lesson-plan-quiz-editor';
import type { QuizQuestion } from '@/components/features/lesson-plan-quiz-editor';
import { LessonPlanAnalyticsView } from '@/components/dashboards/lesson-plan-analytics-view';
import { OcrUploadButton } from '@/components/features/ocr/ocr-button';

interface LessonPlan {
  id: string;
  subjectId: string | null;
  classId: string | null;
  topic: string;
  content: string | null;
  objectives: string | null;
  activities: string | null;
  resources: string | null;
  quiz: string | null;
  masteryThresholds: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  subject: { id: string; name: string; code?: string | null } | null;
  class: { id: string; name: string; section?: string | null } | null;
}

interface StudentAttemptsData {
  plan: LessonPlan;
  students: Array<{
    student: { id: string; admissionNo: string | null; user: { name: string | null; email: string | null } | null };
    attempts: Array<{
      id: string; attemptNumber: number; score: number | null; totalMarks: number; masteryLevel: string | null; passed: boolean | null; completedAt: string | null;
    }>;
    bestScore: number;
    bestMastery: string;
    totalAttempts: number;
  }>;
  totalStudents: number;
  totalAttempts: number;
}

interface SubjectData {
  id: string;
  name: string;
  code?: string | null;
  type?: string;
}

interface ClassData {
  id: string;
  name: string;
  section?: string | null;
  grade?: string | null;
}

interface AiLessonPlan {
  subject: string;
  className: string;
  topic: string;
  objectives: string;
  activities: string;
  resources: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-64 mt-1" /></div>
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-full" /></div></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

export function TeacherLessonPlans() {
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedSchoolId = useAppStore((s) => s.selectedSchoolId);
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<LessonPlan | null>(null);
  const [showAiPlan, setShowAiPlan] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    subjectId: '', classId: '', topic: '', content: '', objectives: '', activities: '', resources: '', quiz: '',
    masteryThresholds: '',
  });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [aiPlan, setAiPlan] = useState<AiLessonPlan | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Student results dialog state
  const [resultsPlan, setResultsPlan] = useState<LessonPlan | null>(null);
  const [resultsData, setResultsData] = useState<StudentAttemptsData | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [analyticsPlanId, setAnalyticsPlanId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [subjectsRes, classesRes, plansRes] = await Promise.all([
        fetch(`/api/subjects?schoolId=${schoolId}&limit=50`),
        fetch(`/api/classes?schoolId=${schoolId}&limit=50`),
        fetch(`/api/lesson-plans?schoolId=${schoolId}&limit=50`),
      ]);

      if (subjectsRes.ok) {
        const subjectsJson = await subjectsRes.json();
        setSubjects(subjectsJson.data || []);
      }
      if (classesRes.ok) {
        const classesJson = await classesRes.json();
        setClasses(classesJson.data || []);
      }
      if (plansRes.ok) {
        const plansJson = await plansRes.json();
        setPlans(plansJson.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load lesson plans');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({ subjectId: '', classId: '', topic: '', content: '', objectives: '', activities: '', resources: '', quiz: '', masteryThresholds: '' });
    setQuizQuestions([]);
    setEditPlan(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (plan: LessonPlan) => {
    setEditPlan(plan);
    const planQuiz = plan.quiz || '';
    const parsedQuiz = planQuiz ? (() => { try { return JSON.parse(planQuiz); } catch { return []; } })() : [];
    setQuizQuestions(parsedQuiz);
    setFormData({
      subjectId: plan.subjectId || '',
      classId: plan.classId || '',
      topic: plan.topic,
      content: plan.content || '',
      objectives: plan.objectives || '',
      activities: plan.activities || '',
      resources: plan.resources || '',
      quiz: planQuiz,
      masteryThresholds: plan.masteryThresholds || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!schoolId || !formData.topic) return;
    setSaving(true);
    try {
      const quizJson = quizQuestions.length > 0 ? JSON.stringify(quizQuestions) : null;
      let masteryThresholds = formData.masteryThresholds;
      if (masteryThresholds) {
        try { JSON.parse(masteryThresholds); } catch { masteryThresholds = ''; }
      }
      const body = {
        schoolId,
        subjectId: formData.subjectId || undefined,
        classId: formData.classId || undefined,
        topic: formData.topic,
        content: formData.content || undefined,
        objectives: formData.objectives || undefined,
        activities: formData.activities || undefined,
        resources: formData.resources || undefined,
        quiz: quizJson,
        masteryThresholds: masteryThresholds || undefined,
      };

      if (editPlan) {
        const res = await fetch(`/api/lesson-plans/${editPlan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to update');
        const json = await res.json();
        setPlans(prev => prev.map(p => p.id === editPlan.id ? json.data : p));
        toast.success('Lesson plan updated');
      } else {
        const res = await fetch('/api/lesson-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create');
        const json = await res.json();
        setPlans(prev => [json.data, ...prev]);
        toast.success('Lesson plan created');
      }

      setDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save lesson plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePlanId) return;
    setDeletingPlan(true);
    try {
      const res = await fetch(`/api/lesson-plans/${deletePlanId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setPlans(prev => prev.filter(p => p.id !== deletePlanId));
      setDeletePlanId(null);
      toast.success('Lesson plan deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete lesson plan');
    } finally {
      setDeletingPlan(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/lesson-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const json = await res.json();
      setPlans(prev => prev.map(p => p.id === id ? json.data : p));
      toast.success(`Lesson plan ${status}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handleViewResults = async (plan: LessonPlan) => {
    setResultsPlan(plan);
    setResultsOpen(true);
    setResultsData(null);
    setResultsLoading(true);
    try {
      const res = await fetch(`/api/lesson-plans/${plan.id}/students`);
      if (res.ok) {
        const json = await res.json();
        setResultsData(json.data);
      } else {
        toast.error('Failed to load student results');
      }
    } catch {
      toast.error('Failed to load student results');
    } finally {
      setResultsLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!schoolId) return;
    setAiLoading(true);
    setShowAiPlan(false);
    setAiPlan(null);

    try {
      const subjectName = subjects.find(s => s.id === formData.subjectId)?.name || formData.subjectId || 'Mathematics';
      const className = classes.find(c => c.id === formData.classId)?.name || formData.classId || 'JSS 2A';

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'TEACHER',
          messages: [
            {
              role: 'user',
              content: `Create a detailed lesson plan for ${subjectName} class ${className}. Include:
1. A clear topic/title
2. 5 specific learning objectives (numbered list)
3. Step-by-step lesson activities with time allocations (starter, introduction, main activities, plenary)
4. Required resources and materials

Format your response as JSON with these exact keys: topic, objectives, activities, resources. The objectives, activities, and resources should be plain text (not JSON arrays). Make it practical and age-appropriate.`,
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('Failed to generate lesson plan');

      const json = await res.json();
      const content = json.message?.content || '';

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setAiPlan({
            subject: subjectName,
            className,
            topic: parsed.topic || 'Lesson Plan',
            objectives: parsed.objectives || '',
            activities: parsed.activities || '',
            resources: parsed.resources || '',
          });
        } else {
          setAiPlan({
            subject: subjectName,
            className,
            topic: `${subjectName} Lesson Plan`,
            objectives: content,
            activities: '',
            resources: '',
          });
        }
      } catch {
        setAiPlan({
          subject: subjectName,
          className,
          topic: `${subjectName} Lesson Plan`,
          objectives: content,
          activities: '',
          resources: '',
        });
      }

      setShowAiPlan(true);
      toast.success('AI lesson plan generated successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate lesson plan. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const saveAiPlan = async () => {
    if (!schoolId || !aiPlan) return;
    setSaving(true);
    try {
      const subjectId = subjects.find(s => s.name === aiPlan.subject)?.id || formData.subjectId;
      const classId = classes.find(c => c.name === aiPlan.className)?.id || formData.classId;

      const res = await fetch('/api/lesson-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          subjectId: subjectId || undefined,
          classId: classId || undefined,
          topic: aiPlan.topic,
          objectives: aiPlan.objectives || undefined,
          activities: aiPlan.activities || undefined,
          resources: aiPlan.resources || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const json = await res.json();
      setPlans(prev => [json.data, ...prev]);
      setShowAiPlan(false);
      setAiPlan(null);
      toast.success('AI lesson plan saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save AI lesson plan');
    } finally {
      setSaving(false);
    }
  };

  const subjectName = (plan: LessonPlan) => plan.subject?.name || 'General';
  const className = (plan: LessonPlan) => plan.class?.name || plan.classId || 'All Classes';
  const planDate = (plan: LessonPlan) => new Date(plan.createdAt).toISOString().split('T')[0];

  const statusColors: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    draft: 'bg-amber-100 text-amber-700 border-amber-200',
    archived: 'bg-gray-100 text-gray-500 border-gray-200',
  };

  const statusLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (loading) return <LoadingSkeleton />;

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BookText className="size-10 mb-3" />
        <p className="text-sm font-medium">No school selected</p>
        <p className="text-xs mt-1">Please select a school to view lesson plans</p>
      </div>
    );
  }

  const dialogTitle = editPlan ? 'Edit Lesson Plan' : 'Create Lesson Plan';
  const dialogDesc = editPlan ? 'Update your lesson objectives, activities, and resources' : 'Plan your lesson objectives, activities, and resources';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lesson Plans</h1>
          <p className="text-muted-foreground">Create and manage your lesson plans</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={openCreateDialog}><Plus className="size-4 mr-2" /> Create Lesson Plan</Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>{dialogDesc}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={formData.subjectId} onValueChange={v => setFormData(p => ({ ...p, subjectId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select value={formData.classId} onValueChange={v => setFormData(p => ({ ...p, classId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input placeholder="Lesson topic" value={formData.topic} onChange={e => setFormData(p => ({ ...p, topic: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Objectives</Label>
                  <Textarea placeholder="What students should achieve..." rows={3} value={formData.objectives} onChange={e => setFormData(p => ({ ...p, objectives: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Activities</Label>
                  <Textarea placeholder="Lesson activities and flow..." rows={3} value={formData.activities} onChange={e => setFormData(p => ({ ...p, activities: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Resources</Label>
                  <Textarea placeholder="Required materials..." rows={2} value={formData.resources} onChange={e => setFormData(p => ({ ...p, resources: e.target.value }))} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <FileText className="h-4 w-4 text-indigo-500" />
                    Lesson Note Content
                    <span className="ml-auto"><OcrUploadButton onTextExtracted={(text) => setFormData(p => ({ ...p, content: p.content + text }))} label="Scan" /></span>
                  </Label>
                  <p className="text-xs text-muted-foreground">Write the full lesson note for students to study. Supports markdown formatting (headings, lists, bold, etc.)</p>
                  <Textarea
                    placeholder="Write your lesson note here... Use markdown for formatting.

## Introduction
Start with an introduction...

## Key Concepts
Explain the main concepts...

## Summary
Summarize what was covered..."
                    rows={10}
                    value={formData.content}
                    onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                  />
                </div>
                <Separator />
                <LessonPlanQuizEditor
                  questions={quizQuestions}
                  onChange={setQuizQuestions}
                  masteryThresholds={formData.masteryThresholds}
                  onMasteryThresholdsChange={v => setFormData(p => ({ ...p, masteryThresholds: v }))}
                  subjects={subjects}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={!formData.topic || saving}>
                  {saving ? 'Saving...' : <>{editPlan ? 'Update' : 'Create'}</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lesson Plan Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
            <GraduationCap className="size-10 mb-3" />
            <p className="text-sm font-medium">No lesson plans yet</p>
            <p className="text-xs mt-1">Create your first lesson plan or use AI to generate one</p>
          </div>
        ) : plans.map(plan => (
          <Card key={plan.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{subjectName(plan)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{className(plan)}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm">{plan.topic}</h3>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Calendar className="size-3" /> {planDate(plan)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.objectives}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusColors[plan.status]}>{statusLabel(plan.status)}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7"><MoreVertical className="size-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => openEditDialog(plan)}>
                        <Pencil className="size-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewResults(plan)}>
                        <FileText className="size-3.5 mr-2" /> View Results
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAnalyticsPlanId(plan.id)}>
                        <BarChart3 className="size-3.5 mr-2" /> Analytics
                      </DropdownMenuItem>
                      {plan.status !== 'published' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(plan.id, 'published')}>
                          <CheckCircle2 className="size-3.5 mr-2" /> Publish
                        </DropdownMenuItem>
                      )}
                      {plan.status !== 'archived' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(plan.id, 'archived')}>
                          <Archive className="size-3.5 mr-2" /> Archive
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-red-600" onClick={() => setDeletePlanId(plan.id)}>
                        <Trash2 className="size-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Student Results Dialog */}
      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quiz Results: {resultsPlan?.topic}</DialogTitle>
            <DialogDescription>
              {resultsPlan?.subject?.name}{resultsPlan?.class ? ` — ${resultsPlan.class.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          {resultsLoading ? (
            <div className="space-y-4 py-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
                </div>
              ))}
            </div>
          ) : resultsData && resultsData.students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No attempts yet</p>
              <p className="text-sm mt-1">Students haven't taken this quiz yet</p>
            </div>
          ) : resultsData ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {resultsData.totalStudents} student{resultsData.totalStudents !== 1 ? 's' : ''} · {resultsData.totalAttempts} total attempt{resultsData.totalAttempts !== 1 ? 's' : ''}
              </p>
              {resultsData.students.map((entry, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-sm">{entry.student.user?.name || 'Unknown Student'}</p>
                        <p className="text-xs text-muted-foreground">{entry.student.admissionNo || entry.student.user?.email || ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.bestMastery === 'mastered' ? 'default' : entry.bestMastery === 'advanced' ? 'secondary' : 'outline'}>
                          {entry.bestMastery}
                        </Badge>
                        <Badge variant="outline">{entry.totalAttempts} attempt{entry.totalAttempts !== 1 ? 's' : ''}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {entry.attempts.map((a, ai) => (
                        <div key={ai} className="flex items-center justify-between text-xs bg-muted/30 rounded px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Attempt #{a.attemptNumber}</span>
                            <span className="text-muted-foreground">{mounted && a.completedAt ? new Date(a.completedAt).toLocaleDateString() : '—'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span>{a.score !== null ? `${a.score}/${a.totalMarks}` : '—'}</span>
                            {a.masteryLevel && (
                              <Badge variant="outline" className="text-[10px]">{a.masteryLevel}</Badge>
                            )}
                            <span className={a.passed ? 'text-emerald-600' : 'text-red-500'}>
                              {a.passed ? 'Passed' : 'Failed'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Lesson Plan Analytics */}
      {analyticsPlanId && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 md:inset-8 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
            <LessonPlanAnalyticsView
              planId={analyticsPlanId}
              onBack={() => setAnalyticsPlanId(null)}
            />
          </div>
        </div>
      )}

      {/* AI Generate Section */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <Sparkles className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">AI Lesson Plan Generator</CardTitle>
                <CardDescription>Generate a comprehensive lesson plan with AI</CardDescription>
              </div>
            </div>
            <Button onClick={handleAiGenerate} disabled={aiLoading}>
              <Sparkles className="size-4 mr-2" /> {aiLoading ? 'Generating...' : 'Generate Plan'}
            </Button>
          </div>
        </CardHeader>
        {aiLoading && (
          <CardContent className="py-8 text-center">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
              <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground mt-4">AI is crafting your lesson plan...</p>
          </CardContent>
        )}
        {showAiPlan && aiPlan && (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{aiPlan.subject}</Badge>
              <Badge variant="outline">{aiPlan.className}</Badge>
              <Badge className="bg-purple-600">AI Generated</Badge>
            </div>
            <h3 className="text-lg font-bold">{aiPlan.topic}</h3>

            <div className="space-y-3">
              {aiPlan.objectives && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="size-4 text-emerald-600" />
                    <h4 className="font-semibold text-sm">Learning Objectives</h4>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{aiPlan.objectives}</p>
                </div>
              )}

              {aiPlan.activities && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ListChecks className="size-4 text-blue-600" />
                    <h4 className="font-semibold text-sm">Lesson Activities</h4>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{aiPlan.activities}</p>
                </div>
              )}

              {aiPlan.resources && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="size-4 text-amber-600" />
                    <h4 className="font-semibold text-sm">Resources</h4>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{aiPlan.resources}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={saveAiPlan} disabled={saving}>
                <CheckCircle2 className="size-4 mr-2" /> {saving ? 'Saving...' : 'Save Plan'}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletePlanId} onOpenChange={() => setDeletePlanId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="size-5" />
              Delete Lesson Plan
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lesson plan? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePlanId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletingPlan}>
              {deletingPlan && <Loader2 className="size-4 mr-2 animate-spin" />}
              {deletingPlan ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
