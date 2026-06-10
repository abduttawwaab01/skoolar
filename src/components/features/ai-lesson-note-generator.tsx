'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Sparkles, BookOpen, Loader2, CheckCircle2, Clock,
  Target, BookText, ListChecks, RotateCcw, Save, Copy, Check,
} from 'lucide-react';

interface LessonNoteResult {
  title: string;
  subject: string;
  class: string;
  duration: string;
  learningObjectives: string[];
  materials: string[];
  lessonStructure: {
    starter: string;
    mainActivities: string[];
    plenary: string;
  };
  differentiation: string;
  homework: string;
  assessment: string;
}

export function AILessonNoteGenerator() {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [topic, setTopic] = useState('');
  const [subTopic, setSubTopic] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [duration, setDuration] = useState('40');
  const [resources, setResources] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<LessonNoteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const currentRole = useAppStore(s => s.currentRole);
  const selectedSchoolId = useAppStore(s => s.selectedSchoolId);
  const schoolId = useAppStore(s => s.currentUser.schoolId);
  const queryClient = useQueryClient();

  const effectiveSchoolId = currentRole === 'SUPER_ADMIN' ? selectedSchoolId : schoolId;

  const { data: classes } = useQuery({
    queryKey: ['classes', effectiveSchoolId],
    queryFn: () => fetch(`/api/classes?schoolId=${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects', effectiveSchoolId],
    queryFn: () => fetch(`/api/subjects?schoolId=${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const handleGenerate = useCallback(async () => {
    if (!selectedSubjectId || !selectedClassId || !topic.trim()) {
      toast.error('Subject, class, and topic are required');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setResult(null);

    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 85));
    }, 500);

    try {
      const response = await fetch('/api/ai/lesson-notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          subjectId: selectedSubjectId,
          classId: selectedClassId,
          topic: topic.trim(),
          subTopic: subTopic.trim() || undefined,
          learningObjectives: learningObjectives.trim() || undefined,
          duration: parseInt(duration) || 40,
          resources: resources.trim() || undefined,
        }),
      });

      clearInterval(interval);
      setProgress(95);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await response.json();
      setProgress(100);

      setTimeout(() => {
        setResult(data.data);
        setIsGenerating(false);
        setProgress(0);
        toast.success('Lesson note generated!');
      }, 300);
    } catch (error: unknown) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : 'Failed to generate lesson note');
    }
  }, [selectedSubjectId, selectedClassId, topic, subTopic, learningObjectives, duration, resources, effectiveSchoolId]);

  const handleCopyAll = useCallback(() => {
    if (!result) return;
    const text = [
      `# ${result.title}`,
      `Subject: ${result.subject} | Class: ${result.class} | Duration: ${result.duration}`,
      '',
      '--- Learning Objectives ---',
      ...result.learningObjectives.map(o => `- ${o}`),
      '',
      '--- Materials ---',
      ...result.materials.map(m => `- ${m}`),
      '',
      '--- Lesson Structure ---',
      `Starter: ${result.lessonStructure.starter}`,
      'Main Activities:',
      ...result.lessonStructure.mainActivities.map(a => `- ${a}`),
      `Plenary: ${result.lessonStructure.plenary}`,
      '',
      `Differentiation: ${result.differentiation}`,
      `Homework: ${result.homework}`,
      `Assessment: ${result.assessment}`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  const classList = classes?.data || classes || [];
  const subjectList = subjects?.data || subjects || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <Sparkles className="h-6 w-6 text-violet-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Lesson Note Generator</h2>
            <p className="text-sm text-gray-500">Generate detailed lesson plans from scheme of work entries</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-violet-500" />
                Lesson Details
              </CardTitle>
              <CardDescription>Enter the lesson parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectList.map((s: { id: string; name: string }) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Class</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classList.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium">Topic *</Label>
                <Input placeholder="e.g., Quadratic Equations" value={topic} onChange={e => setTopic(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-medium">Sub-Topic (optional)</Label>
                <Input placeholder="e.g., Solving by Factorization" value={subTopic} onChange={e => setSubTopic(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-medium">Learning Objectives (optional)</Label>
                <Textarea
                  placeholder="e.g., By the end of the lesson, students should be able to..."
                  value={learningObjectives}
                  onChange={e => setLearningObjectives(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Duration (minutes)</Label>
                <Input type="number" min={20} max={120} value={duration} onChange={e => setDuration(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-medium">Resources (optional)</Label>
                <Input placeholder="e.g., Textbook, Whiteboard, Calculators" value={resources} onChange={e => setResources(e.target.value)} />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim() || !selectedSubjectId || !selectedClassId}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Lesson Note
                  </>
                )}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">AI is building your lesson plan...</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
              <div className="p-4 rounded-full bg-violet-100 mb-4">
                <BookText className="h-12 w-12 text-violet-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lesson Note Generated Yet</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Provide the lesson details on the left and click &quot;Generate Lesson Note&quot; to create a comprehensive, ready-to-use lesson plan.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        {result.title}
                      </CardTitle>
                      <CardDescription>
                        {result.subject} · {result.class} · {result.duration}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-2">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy All'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setResult(null)} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Tabs defaultValue="objectives">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="objectives">Objectives</TabsTrigger>
                  <TabsTrigger value="structure">Lesson Structure</TabsTrigger>
                  <TabsTrigger value="details">Additional Details</TabsTrigger>
                </TabsList>

                <TabsContent value="objectives" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-violet-500" />
                        Learning Objectives
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.learningObjectives.map((obj, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-violet-500" />
                        Materials Needed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {result.materials.map((mat, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-violet-500 mt-0.5">•</span>
                            <span>{mat}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="structure" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Starter Activity</CardTitle>
                      <CardDescription>Opening activity (5-10 minutes)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.lessonStructure.starter}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <BookText className="h-4 w-4 text-violet-500" />
                        Main Activities
                      </CardTitle>
                      <CardDescription>Core lesson content and activities</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-3">
                        {result.lessonStructure.mainActivities.map((act, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-sm text-gray-700 leading-relaxed">{act}</p>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Plenary</CardTitle>
                      <CardDescription>Closing activity and assessment (5-10 minutes)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.lessonStructure.plenary}</p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Differentiation</CardTitle>
                      <CardDescription>Strategies for diverse learners</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.differentiation}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Homework Assignment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.homework}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Assessment Methods</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.assessment}</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
