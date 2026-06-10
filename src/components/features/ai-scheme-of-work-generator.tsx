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
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Sparkles, BookOpen, Loader2, CheckCircle2, Clock,
  Calendar, ListChecks, Target, Download, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react';

interface SchemeEntry {
  weekNumber: number;
  topic: string;
  subTopic: string;
  learningObjectives: string;
  teachingActivities: string;
  learningActivities: string;
  resources: string;
  assessmentMethod: string;
  duration: number;
}

interface SchemeResult {
  title: string;
  description: string;
  entries: SchemeEntry[];
  totalWeeks: number;
  recommendedTextbooks: string[];
}

export function AISchemeOfWorkGenerator() {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [numberOfWeeks, setNumberOfWeeks] = useState('12');
  const [focusAreas, setFocusAreas] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SchemeResult | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

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

  const { data: terms } = useQuery({
    queryKey: ['terms', effectiveSchoolId],
    queryFn: () => fetch(`/api/terms?schoolId=${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const handleGenerate = useCallback(async () => {
    if (!selectedSubjectId || !selectedClassId || !selectedTermId) {
      toast.error('Subject, class, and term are required');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setResult(null);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 85));
    }, 500);

    try {
      const response = await fetch('/api/ai/scheme-of-work/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          subjectId: selectedSubjectId,
          classId: selectedClassId,
          termId: selectedTermId,
          numberOfWeeks: parseInt(numberOfWeeks) || 12,
          focusAreas: focusAreas ? focusAreas.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        }),
      });

      clearInterval(progressInterval);
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
        toast.success(`Scheme generated: ${data.data.entries.length} weeks`);
      }, 300);
    } catch (error: unknown) {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : 'Failed to generate scheme of work');
    }
  }, [selectedSubjectId, selectedClassId, selectedTermId, numberOfWeeks, focusAreas, effectiveSchoolId]);

  const handleSaveAsScheme = useCallback(async () => {
    if (!result) return;

    try {
      const response = await fetch('/api/scheme-of-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          subjectId: selectedSubjectId,
          classId: selectedClassId,
          termId: selectedTermId,
          title: result.title,
          description: result.description,
          entries: result.entries.map(e => ({
            weekNumber: e.weekNumber,
            topic: e.topic,
            subTopic: e.subTopic,
            learningObjectives: e.learningObjectives,
            teachingActivities: e.teachingActivities,
            learningActivities: e.learningActivities,
            resources: e.resources,
            assessmentMethod: e.assessmentMethod,
            duration: e.duration,
            status: 'PENDING',
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Save failed');
      }

      toast.success('Scheme of Work saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['scheme-of-work'] });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save scheme of work');
    }
  }, [result, selectedSubjectId, selectedClassId, selectedTermId, effectiveSchoolId, queryClient]);

  const handleExportAsCSV = useCallback(() => {
    if (!result) return;

    const headers = 'Week Number,Topic,Sub-Topic,Learning Objectives,Teaching Activities,Learning Activities,Resources,Assessment Method,Duration (min)';
    const rows = result.entries.map(e =>
      `"${e.weekNumber}","${e.topic}","${e.subTopic}","${e.learningObjectives}","${e.teachingActivities}","${e.learningActivities}","${e.resources}","${e.assessmentMethod}",${e.duration}`
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported as CSV');
  }, [result]);

  const classList = classes?.data || classes || [];
  const subjectList = subjects?.data || subjects || [];
  const termList = terms?.data || terms || [];

  const getSubjectName = (id: string) => subjectList.find((s: { id: string; name: string }) => s.id === id)?.name || 'Subject';
  const getClassName = (id: string) => classList.find((c: { id: string; name: string }) => c.id === id)?.name || 'Class';
  const getTermName = (id: string) => termList.find((t: { id: string; name: string }) => t.id === id)?.name || 'Term';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Sparkles className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Scheme of Work Generator</h2>
            <p className="text-sm text-gray-500">Generate comprehensive curriculum plans with AI</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-emerald-500" />
                Curriculum Settings
              </CardTitle>
              <CardDescription>Configure the scheme parameters</CardDescription>
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

              <div>
                <Label className="text-sm font-medium">Term</Label>
                <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {termList.map((t: { id: string; name: string }) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Number of Weeks</Label>
                <Input
                  type="number"
                  min={4}
                  max={20}
                  value={numberOfWeeks}
                  onChange={e => setNumberOfWeeks(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Focus Areas (comma-separated, optional)</Label>
                <Input
                  placeholder="e.g., Algebra, Geometry, Statistics"
                  value={focusAreas}
                  onChange={e => setFocusAreas(e.target.value)}
                />
              </div>

              <Separator />

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedSubjectId || !selectedClassId || !selectedTermId}
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
                    Generate with AI
                  </>
                )}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">AI is building your curriculum...</span>
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
              <div className="p-4 rounded-full bg-emerald-100 mb-4">
                <BookOpen className="h-12 w-12 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Scheme of Work Generated Yet</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Select a subject, class, and term on the left, then click &quot;Generate with AI&quot; to create a comprehensive curriculum plan.
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
                        {result.entries.length} weeks · {result.description}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSaveAsScheme} className="gap-2">
                        <ListChecks className="h-4 w-4" />
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportAsCSV} className="gap-2">
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setResult(null)} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {result.recommendedTextbooks.length > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <BookOpen className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Recommended Textbooks</p>
                        <ul className="text-sm text-blue-700 mt-1 list-disc list-inside">
                          {result.recommendedTextbooks.map((book, i) => (
                            <li key={i}>{book}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <ScrollArea className="h-[500px]">
                  <CardContent className="p-4 space-y-2">
                    {result.entries.map(entry => (
                      <div key={entry.weekNumber} className="rounded-lg border overflow-hidden">
                        <button
                          onClick={() => setExpandedWeek(expandedWeek === entry.weekNumber ? null : entry.weekNumber)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                              <span className="text-[10px] font-medium">Week</span>
                              <span className="text-lg font-bold">{entry.weekNumber}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{entry.topic}</p>
                              {entry.subTopic && (
                                <p className="text-sm text-gray-500">{entry.subTopic}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs gap-1">
                              <Clock className="h-3 w-3" />
                              {entry.duration}min
                            </Badge>
                            {expandedWeek === entry.weekNumber ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {expandedWeek === entry.weekNumber && (
                          <div className="px-4 pb-4 space-y-3 border-t bg-gray-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  Learning Objectives
                                </p>
                                <p className="text-sm text-gray-700">{entry.learningObjectives}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Teaching Activities</p>
                                <p className="text-sm text-gray-700">{entry.teachingActivities}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Learning Activities</p>
                                <p className="text-sm text-gray-700">{entry.learningActivities}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assessment Method</p>
                                <p className="text-sm text-gray-700">{entry.assessmentMethod}</p>
                              </div>
                            </div>
                            {entry.resources && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Resources</p>
                                <p className="text-sm text-gray-700">{entry.resources}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </ScrollArea>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
