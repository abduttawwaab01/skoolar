'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Sparkles, Loader2, CheckCircle2, RotateCcw, Target,
  Briefcase, GraduationCap, BookOpen, Star, TrendingUp,
} from 'lucide-react';

const performanceRatings = ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'];

export function AIPDPlanner() {
  const [teacherName, setTeacherName] = useState('');
  const [subjectsTaught, setSubjectsTaught] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [performanceRating, setPerformanceRating] = useState('Good');
  const [careerGoals, setCareerGoals] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    shortTermGoals: { title: string; description: string; duration: string }[];
    longTermGoals: { title: string; description: string; duration: string }[];
    recommendedCourses: { title: string; provider: string; url: string; relevance: string }[];
    skillsToDevelop: string[];
  } | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!teacherName.trim()) {
      toast.error('Teacher name is required');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setResult(null);

    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 85));
    }, 500);

    try {
      const response = await fetch('/api/ai/pd/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: teacherName.trim(),
          subjectsTaught: subjectsTaught ? subjectsTaught.split(',').map(s => s.trim()).filter(Boolean) : [],
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : 0,
          currentQualifications: qualifications ? qualifications.split(',').map(q => q.trim()).filter(Boolean) : [],
          recentPerformanceRating: performanceRating,
          careerGoals: careerGoals.trim(),
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
        toast.success('PD Plan generated!');
      }, 300);
    } catch (error: unknown) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : 'Failed to generate plan');
    }
  }, [teacherName, subjectsTaught, yearsOfExperience, qualifications, performanceRating, careerGoals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-100">
            <Sparkles className="h-6 w-6 text-sky-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Professional Development Planner</h2>
            <p className="text-sm text-gray-500">Create personalized growth plans for educators</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teacher Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Teacher Name *</Label>
                <Input value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="e.g., Jane Smith" />
              </div>
              <div>
                <Label>Subjects Taught (comma-separated)</Label>
                <Input value={subjectsTaught} onChange={e => setSubjectsTaught(e.target.value)} placeholder="Math, Physics" />
              </div>
              <div>
                <Label>Years of Experience</Label>
                <Input type="number" min={0} value={yearsOfExperience} onChange={e => setYearsOfExperience(e.target.value)} />
              </div>
              <div>
                <Label>Qualifications (comma-separated)</Label>
                <Input value={qualifications} onChange={e => setQualifications(e.target.value)} placeholder="B.Ed, NCE" />
              </div>
              <div>
                <Label>Performance Rating</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={performanceRating}
                  onChange={e => setPerformanceRating(e.target.value)}
                >
                  {performanceRatings.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Career Goals</Label>
                <Textarea
                  value={careerGoals} onChange={e => setCareerGoals(e.target.value)}
                  placeholder="e.g., Become Head of Department, pursue Master's degree"
                  rows={3}
                />
              </div>

              <Button onClick={handleGenerate} disabled={isGenerating || !teacherName.trim()} className="w-full gap-2">
                {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate PD Plan</>}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">AI creating development plan...</span>
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
              <div className="p-4 rounded-full bg-sky-100 mb-4">
                <GraduationCap className="h-12 w-12 text-sky-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Create a PD Plan</h3>
              <p className="text-sm text-gray-500 max-w-md">Enter teacher details and click "Generate PD Plan" to create a personalized professional development roadmap.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    PD Plan for {teacherName}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-sky-500" />
                    Short-Term Goals
                  </CardTitle>
                  <CardDescription>Achievable within 3-6 months</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.shortTermGoals.map((goal, i) => (
                    <div key={i} className="p-3 rounded-lg border border-sky-100 bg-sky-50">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-sm">{goal.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{goal.description}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">{goal.duration}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    Long-Term Goals
                  </CardTitle>
                  <CardDescription>6-12 months and beyond</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.longTermGoals.map((goal, i) => (
                    <div key={i} className="p-3 rounded-lg border border-purple-100 bg-purple-50">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-sm">{goal.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{goal.description}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">{goal.duration}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-emerald-500" />
                    Recommended Courses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.recommendedCourses.map((course, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      <GraduationCap className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{course.title}</p>
                        <p className="text-xs text-gray-500">{course.provider} · {course.relevance}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Skills to Develop
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.skillsToDevelop.map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
