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
  Sparkles, Loader2, CheckCircle2, RotateCcw, Copy, Check, Target, ArrowRight,
} from 'lucide-react';

export function AIReportCardWriter() {
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [termName, setTermName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [overallScore, setOverallScore] = useState('');
  const [grade, setGrade] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [attendanceRate, setAttendanceRate] = useState('100');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    strengths: string[]; areasForImprovement: string[];
    generalComment: string; nextSteps: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!studentName.trim() || !subject.trim()) {
      toast.error('Student name and subject are required');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setResult(null);

    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 85));
    }, 500);

    try {
      const response = await fetch('/api/ai/report-card/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          className: className.trim(),
          subject: subject.trim(),
          termName: termName.trim(),
          academicYear: academicYear.trim(),
          overallScore: overallScore ? parseInt(overallScore) : undefined,
          grade: grade.trim(),
          strengths: strengths ? strengths.split(',').map(s => s.trim()).filter(Boolean) : [],
          weaknesses: weaknesses ? weaknesses.split(',').map(s => s.trim()).filter(Boolean) : [],
          attendanceRate: attendanceRate ? parseInt(attendanceRate) : 100,
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
        toast.success('Report card comment generated!');
      }, 300);
    } catch (error: unknown) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : 'Failed to generate comment');
    }
  }, [studentName, className, subject, termName, academicYear, overallScore, grade, strengths, weaknesses, attendanceRate]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    const text = [
      `--- Report Card Comment for ${studentName} ---`,
      '',
      result.generalComment,
      '',
      'Strengths:',
      ...result.strengths.map(s => `- ${s}`),
      '',
      'Areas for Improvement:',
      ...result.areasForImprovement.map(a => `- ${a}`),
      '',
      'Next Steps:',
      ...result.nextSteps.map(n => `- ${n}`),
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result, studentName]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-100">
            <Sparkles className="h-6 w-6 text-rose-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Report Card Writer</h2>
            <p className="text-sm text-gray-500">Generate personalized student report card comments</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student & Subject Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Student Name *</Label>
                <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g., John Doe" />
              </div>
              <div>
                <Label>Class</Label>
                <Input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g., JSS 2A" />
              </div>
              <div>
                <Label>Subject *</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Mathematics" />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Term</Label>
                  <Input value={termName} onChange={e => setTermName(e.target.value)} placeholder="Term 1" />
                </div>
                <div>
                  <Label>Academic Year</Label>
                  <Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2025/2026" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Score (%)</Label>
                  <Input type="number" min={0} max={100} value={overallScore} onChange={e => setOverallScore(e.target.value)} />
                </div>
                <div>
                  <Label>Grade</Label>
                  <Input value={grade} onChange={e => setGrade(e.target.value)} placeholder="A" />
                </div>
                <div>
                  <Label>Attendance %</Label>
                  <Input type="number" min={0} max={100} value={attendanceRate} onChange={e => setAttendanceRate(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Strengths (comma-separated)</Label>
                <Input value={strengths} onChange={e => setStrengths(e.target.value)} placeholder="Problem-solving, Participation" />
              </div>

              <div>
                <Label>Weaknesses (comma-separated)</Label>
                <Input value={weaknesses} onChange={e => setWeaknesses(e.target.value)} placeholder="Neatness, Timeliness" />
              </div>

              <Button onClick={handleGenerate} disabled={isGenerating || !studentName.trim() || !subject.trim()} className="w-full gap-2">
                {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate Comment</>}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">AI writing report comment...</span>
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
              <div className="p-4 rounded-full bg-rose-100 mb-4">
                <Sparkles className="h-12 w-12 text-rose-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate a Report Card Comment</h3>
              <p className="text-sm text-gray-500 max-w-md">Enter student details and click "Generate Comment" to create a personalized, constructive report card comment.</p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Report Comment for {studentName}
                    </CardTitle>
                    <CardDescription>{subject}{className ? ` · ${className}` : ''}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">General Comment</h4>
                  <p className="text-sm text-gray-800 leading-relaxed">{result.generalComment}</p>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Strengths
                  </h4>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">•</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Target className="h-3.5 w-3.5 text-amber-500" /> Areas for Improvement
                  </h4>
                  <ul className="space-y-1">
                    {result.areasForImprovement.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-amber-500 mt-0.5">•</span><span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ArrowRight className="h-3.5 w-3.5 text-blue-500" /> Next Steps
                  </h4>
                  <ul className="space-y-1">
                    {result.nextSteps.map((n, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-blue-500 mt-0.5">•</span><span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
