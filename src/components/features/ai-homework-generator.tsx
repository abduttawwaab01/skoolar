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
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Sparkles, BookOpen, Loader2, CheckCircle2, Clock,
  RotateCcw, Copy, Check, CalendarDays, ListChecks,
} from 'lucide-react';

const difficulties = ['Easy', 'Medium', 'Hard'];

export function AIHomeworkGenerator() {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [dueInDays, setDueInDays] = useState('3');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    title: string; description: string; instructions: string[];
    dueDate: string; maxScore: number; submissionGuidelines?: string; estimatedTimeMinutes?: number;
  } | null>(null);
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
      const response = await fetch('/api/ai/homework/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          subjectId: selectedSubjectId,
          classId: selectedClassId,
          topic: topic.trim(),
          difficulty,
          dueInDays: parseInt(dueInDays) || 3,
          additionalInstructions: additionalInstructions.trim() || undefined,
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
        toast.success('Homework assignment generated!');
      }, 300);
    } catch (error: unknown) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : 'Failed to generate homework');
    }
  }, [selectedSubjectId, selectedClassId, topic, difficulty, dueInDays, additionalInstructions, effectiveSchoolId]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    const text = [
      `# ${result.title}`,
      result.description,
      '',
      '--- Instructions ---',
      ...result.instructions.map((inst, i) => `${i + 1}. ${inst}`),
      '',
      `Due: ${result.dueDate} | Max Score: ${result.maxScore}`,
      result.submissionGuidelines ? `Submission: ${result.submissionGuidelines}` : '',
      result.estimatedTimeMinutes ? `Estimated Time: ${result.estimatedTimeMinutes} minutes` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  const classList = classes?.data || classes || [];
  const subjectList = subjects?.data || subjects || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <Sparkles className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Homework Generator</h2>
            <p className="text-sm text-gray-500">Create structured homework assignments with AI</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                Assignment Settings
              </CardTitle>
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
                <Input placeholder="e.g., Fractions, Photosynthesis" value={topic} onChange={e => setTopic(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-medium">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {difficulties.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Due in (days)</Label>
                <Input type="number" min={1} max={30} value={dueInDays} onChange={e => setDueInDays(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-medium">Extra Instructions (optional)</Label>
                <Textarea
                  placeholder="e.g., Include real-world examples, focus on problem-solving..."
                  value={additionalInstructions}
                  onChange={e => setAdditionalInstructions(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim() || !selectedSubjectId || !selectedClassId}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Homework</>
                )}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">AI creating assignment...</span>
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
              <div className="p-4 rounded-full bg-amber-100 mb-4">
                <BookOpen className="h-12 w-12 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Homework Generated Yet</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Set the assignment parameters and click &quot;Generate Homework&quot; to create a structured assignment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="border-amber-200">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        {result.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-3 mt-1">
                        <Badge variant="outline" className="gap-1">
                          <CalendarDays className="h-3 w-3" /> Due: {result.dueDate}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <ListChecks className="h-3 w-3" /> Max: {result.maxScore} pts
                        </Badge>
                        {result.estimatedTimeMinutes && (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" /> ~{result.estimatedTimeMinutes}min
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-700 leading-relaxed">{result.description}</p>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold mb-2">Instructions</h4>
                    <ol className="space-y-2">
                      {result.instructions.map((inst, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{inst}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {result.submissionGuidelines && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Submission Guidelines</h4>
                        <p className="text-sm text-gray-700">{result.submissionGuidelines}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
