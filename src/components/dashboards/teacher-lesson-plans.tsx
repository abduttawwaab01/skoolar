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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useAppStore } from '@/store/app-store';
import {
  Plus, BookText, Sparkles, Calendar, CheckCircle2, FileText, Target, ListChecks, Lightbulb, GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';

interface LessonPlan {
  id: string;
  subject: string;
  class: string;
  topic: string;
  date: string;
  status: 'Published' | 'Draft' | 'Archived';
  objectives: string;
  activities: string;
  resources: string;
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
  class: string;
  topic: string;
  objectives: string;
  activities: string;
  resources: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
  const selectedSchoolId = useAppStore((s) => s.selectedSchoolId);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAiPlan, setShowAiPlan] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    subject: '', class: '', topic: '', objectives: '', activities: '', resources: '',
  });
  const [aiPlan, setAiPlan] = useState<AiLessonPlan | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [subjectsRes, classesRes] = await Promise.all([
        fetch(`/api/subjects?schoolId=${selectedSchoolId}&limit=50`),
        fetch(`/api/classes?schoolId=${selectedSchoolId}&limit=50`),
      ]);

      if (subjectsRes.ok) {
        const subjectsJson = await subjectsRes.json();
        setSubjects(subjectsJson.data || []);
      }
      if (classesRes.ok) {
        const classesJson = await classesRes.json();
        setClasses(classesJson.data || []);
      }

      // Fetch homework assignments as lesson plans
      const homeworkRes = await fetch(`/api/homework?schoolId=${selectedSchoolId}&limit=20`);
      if (homeworkRes.ok) {
        const homeworkJson = await homeworkRes.json();
        const homeworkPlans: LessonPlan[] = (homeworkJson.data || []).map((hw: { id: string; title: string; description?: string | null; subject?: { name?: string } | null; class?: { name?: string } | null; createdAt?: string; status?: string }) => ({
          id: hw.id,
          subject: hw.subject?.name || 'General',
          class: hw.class?.name || 'All Classes',
          topic: hw.title,
          date: hw.createdAt ? new Date(hw.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: (hw.status === 'completed' ? 'Archived' : 'Published') as LessonPlan['status'],
          objectives: hw.description || '',
          activities: '',
          resources: '',
        }));
        setPlans(homeworkPlans);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load lesson plans');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    const newPlan: LessonPlan = {
      id: `lp-${Date.now()}`,
      subject: formData.subject,
      class: formData.class,
      topic: formData.topic,
      date: new Date().toISOString().split('T')[0],
      status: 'Draft',
      objectives: formData.objectives,
      activities: formData.activities,
      resources: formData.resources,
    };
    setPlans(prev => [newPlan, ...prev]);
    setDialogOpen(false);
    setFormData({ subject: '', class: '', topic: '', objectives: '', activities: '', resources: '' });
  };

  const handleAiGenerate = async () => {
    if (!selectedSchoolId) return;
    setAiLoading(true);
    setShowAiPlan(false);
    setAiPlan(null);

    try {
      const subjectName = subjects.find(s => s.id === formData.subject)?.name || formData.subject || 'Mathematics';
      const className = classes.find(c => c.id === formData.class)?.name || formData.class || 'JSS 2A';

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

      // Try to parse JSON from the response
      try {
        // Find JSON in the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setAiPlan({
            subject: subjectName,
            class: className,
            topic: parsed.topic || 'Lesson Plan',
            objectives: parsed.objectives || '',
            activities: parsed.activities || '',
            resources: parsed.resources || '',
          });
        } else {
          // Fallback: use the raw content as objectives
          setAiPlan({
            subject: subjectName,
            class: className,
            topic: `${subjectName} Lesson Plan`,
            objectives: content,
            activities: '',
            resources: '',
          });
        }
      } catch {
        // If JSON parsing fails, use raw content
        setAiPlan({
          subject: subjectName,
          class: className,
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

  const statusColors: Record<string, string> = {
    Published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Draft: 'bg-amber-100 text-amber-700 border-amber-200',
    Archived: 'bg-gray-100 text-gray-500 border-gray-200',
  };

  if (loading) return <LoadingSkeleton />;

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BookText className="size-10 mb-3" />
        <p className="text-sm font-medium">No school selected</p>
        <p className="text-xs mt-1">Please select a school to view lesson plans</p>
      </div>
    );
  }

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
              <Button variant="outline"><Plus className="size-4 mr-2" /> Create Lesson Plan</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Lesson Plan</DialogTitle>
                <DialogDescription>Plan your lesson objectives, activities, and resources</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={formData.subject} onValueChange={v => setFormData(p => ({ ...p, subject: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select value={formData.class} onValueChange={v => setFormData(p => ({ ...p, class: v }))}>
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!formData.topic}><Plus className="size-4 mr-2" /> Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lesson Plan Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
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
                    <Badge variant="outline" className="text-[10px]">{plan.subject}</Badge>
                    <Badge variant="outline" className="text-[10px]">{plan.class}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm">{plan.topic}</h3>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Calendar className="size-3" /> {plan.date}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.objectives}</p>
                </div>
                <Badge variant="outline" className={statusColors[plan.status]}>{plan.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Generate Section */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
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
              <Badge variant="outline">{aiPlan.class}</Badge>
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
              <Button size="sm" onClick={() => {
                const newPlan: LessonPlan = {
                  id: `lp-${Date.now()}`,
                  subject: aiPlan.subject,
                  class: aiPlan.class,
                  topic: aiPlan.topic,
                  date: new Date().toISOString().split('T')[0],
                  status: 'Draft',
                  objectives: aiPlan.objectives,
                  activities: aiPlan.activities,
                  resources: aiPlan.resources,
                };
                setPlans(prev => [newPlan, ...prev]);
                toast.success('Lesson plan saved');
              }}><CheckCircle2 className="size-4 mr-2" /> Save Plan</Button>
              <Button size="sm" variant="outline" onClick={() => toast.success('Opening editor...')}><FileText className="size-4 mr-2" /> Edit</Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
