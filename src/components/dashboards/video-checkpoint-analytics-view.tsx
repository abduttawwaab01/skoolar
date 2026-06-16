'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/shared/kpi-card';
import { ExportMenu } from '@/components/shared/export-menu';
import { toast } from 'sonner';
import { SendToParent } from '@/components/shared/send-to-parent';
import { InsightsPanel } from '@/components/shared/insights-panel';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  BookOpen, Users, AlertTriangle, CheckCircle2,
  ArrowLeft, BarChart3, Search, Brain,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  lessonId: string;
  onBack?: () => void;
}

export function VideoCheckpointAnalyticsView({ lessonId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [studentSearch, setStudentSearch] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/video-checkpoints/analytics?lessonId=${lessonId}`);
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      toast.error('Failed to load video checkpoint analytics');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="size-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Failed to Load Analytics</h3>
          <p className="text-sm text-muted-foreground mt-2">{error || 'No data available'}</p>
          <Button onClick={fetchAnalytics} className="mt-4">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const { lesson, overview, perCheckpointAnalytics, perStudentPerformance } = data;

  const insightsData = useMemo(() => {
    if (!perStudentPerformance) return null;
    const sorted = [...perStudentPerformance].sort((a: any, b: any) => (b.correctRate || 0) - (a.correctRate || 0));
    const topStudents = sorted.slice(0, 3);
    const bottomStudents = sorted.slice(-3).reverse();

    const strengths = topStudents.map((s: any) => ({ name: s.studentName, score: s.correctRate || 0, average: overview.overallCorrectRate }));
    const weaknesses = bottomStudents.map((s: any) => ({ name: s.studentName, score: s.correctRate || 0, average: overview.overallCorrectRate }));

    const recommendations: any[] = [];
    if (overview.overallCorrectRate < 50) {
      recommendations.push({ type: 'danger' as const, title: 'Low Overall Correct Rate', description: `Only ${overview.overallCorrectRate}% of checkpoint answers are correct. Consider reviewing lesson content.` });
    }
    if (perCheckpointAnalytics) {
      const lowCheckpoints = perCheckpointAnalytics.filter((cp: any) => cp.correctRate < 40);
      if (lowCheckpoints.length > 0) {
        recommendations.push({ type: 'warning' as const, title: `Difficult Checkpoints (${lowCheckpoints.length})`, description: `${lowCheckpoints.length} checkpoint(s) have <40% correct rate. Review these concepts.` });
      }
    }
    if (overview.overallCorrectRate >= 70) {
      recommendations.push({ type: 'success' as const, title: 'Strong Understanding', description: 'Students demonstrate good understanding of checkpoint material.' });
    }
    if (overview.totalStudents > 0 && overview.totalAnswers < overview.totalStudents * (perCheckpointAnalytics?.length || 1)) {
      recommendations.push({ type: 'info' as const, title: 'Incomplete Responses', description: 'Some students have not answered all checkpoints.' });
    }

    const questionAnalysis = (perCheckpointAnalytics || []).map((cp: any, i: number) => ({
      questionNumber: i + 1,
      questionText: cp.question || '',
      type: cp.questionType || 'MCQ',
      marks: 1,
      correctRate: cp.correctRate || 0,
      difficulty: cp.correctRate >= 70 ? 'Easy' : cp.correctRate >= 40 ? 'Medium' : 'Hard',
    }));

    return { strengths, weaknesses, recommendations, questionAnalysis, averageScore: overview.overallCorrectRate };
  }, [perStudentPerformance, perCheckpointAnalytics, overview]);

  const overviewCards = [
    { title: 'Checkpoints', value: overview.totalCheckpoints, icon: BookOpen, iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: 'Students', value: overview.totalStudents, icon: Users, iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { title: 'Total Answers', value: overview.totalAnswers, icon: CheckCircle2, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { title: 'Overall Correct', value: `${overview.overallCorrectRate}%`, icon: BarChart3, iconBgColor: overview.overallCorrectRate >= 60 ? 'bg-emerald-100' : 'bg-red-100', iconColor: overview.overallCorrectRate >= 60 ? 'text-emerald-600' : 'text-red-600' },
  ];

  const filteredStudents = perStudentPerformance?.filter((s: any) =>
    !studentSearch || s.studentName?.toLowerCase().includes(studentSearch.toLowerCase()) || s.admissionNo?.toLowerCase().includes(studentSearch.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="size-6 text-emerald-600" />
              {lesson?.title || 'Video Checkpoint Analytics'}
            </h1>
            <p className="text-sm text-muted-foreground">{overview.totalCheckpoints} checkpoints · {overview.totalStudents} students</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SendToParent
            endpoint={`/api/video-lessons/${lessonId}/send-to-parent`}
            label="Send to Parents"
            variant="outline"
            size="sm"
            assessmentName={lesson?.title}
          />
          <ExportMenu options={{
            title: `${lesson?.title || 'Video Checkpoint'} Analytics`,
            subtitle: `${overview.totalCheckpoints} checkpoints · ${overview.totalStudents} students`,
            fileName: `${(lesson?.title || 'video-checkpoint').replace(/\s+/g, '_')}_analytics`,
            summaryRows: [
              { label: 'Avg Score', value: `${(overview.averagePercentage || 0).toFixed(1)}%` },
              { label: 'Pass Rate', value: `${(overview.passRate || 0).toFixed(1)}%` },
              { label: 'Completion', value: `${(overview.completionRate || 0).toFixed(1)}%` },
            ],
          }} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {overviewCards.map((card, i) => (
          <KpiCard key={i} {...card} />
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5">
            <Brain className="size-3.5" /> Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Checkpoint Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {(!perCheckpointAnalytics || perCheckpointAnalytics.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">No checkpoint data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={perCheckpointAnalytics.map((cp: any, i: number) => ({
                    name: `CP${i + 1}`,
                    correct: cp.correctRate,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip formatter={(val: number) => `${val}%`} />
                    <Bar dataKey="correct" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Key Stats</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Correct Answers</span><span className="font-semibold text-emerald-600">{overview.correctAnswers}/{overview.totalAnswers}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Avg per Student</span><span className="font-semibold">{overview.averagePerStudent}%</span></div>
                  <div className="flex justify-between py-2"><span className="text-muted-foreground">Overall Correct Rate</span><span className="font-semibold">{overview.overallCorrectRate}%</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="checkpoints" className="space-y-4 mt-4">
          {(!perCheckpointAnalytics || perCheckpointAnalytics.length === 0) ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center"><BookOpen className="size-12 text-muted-foreground mx-auto mb-4" /><h3 className="font-semibold">No Checkpoints</h3></CardContent>
            </Card>
          ) : (
            perCheckpointAnalytics.map((cp: any, idx: number) => {
              const isGood = cp.correctRate >= 60;
              const isMedium = cp.correctRate >= 40 && cp.correctRate < 60;
              return (
                <Card key={cp.checkpointId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{idx + 1}</span>
                          {cp.question?.length > 100 ? cp.question.slice(0, 100) + '...' : cp.question}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{cp.questionType}</Badge>
                          <span className="text-xs">{cp.timestamp ? `${Math.floor(cp.timestamp / 60)}:${String(cp.timestamp % 60).padStart(2, '0')}` : ''}</span>
                        </CardDescription>
                      </div>
                      <Badge className={isGood ? 'bg-emerald-100 text-emerald-700' : isMedium ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                        {cp.correctRate}% correct
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Performance</p>
                        <ResponsiveContainer width="100%" height={40}>
                          <BarChart layout="vertical" data={[{ name: 'Answers', correct: cp.correctCount, wrong: cp.wrongCount }]}>
                            <XAxis type="number" hide />
                            <YAxis type="category" hide />
                            <Bar dataKey="correct" stackId="a" fill="#059669" radius={[4, 0, 0, 4]} />
                            <Bar dataKey="wrong" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            <Tooltip />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-emerald-600">{cp.correctCount} correct</span>
                          <span className="text-red-600">{cp.wrongCount} wrong</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Answer Distribution</p>
                        <div className="space-y-1">
                          {(cp.answerDistribution || []).slice(0, 5).map(([answer, count]: [string, number]) => {
                            const pct = cp.totalAnswers > 0 ? (count / cp.totalAnswers) * 100 : 0;
                            const isCorrect = answer === cp.correctAnswer;
                            return (
                              <div key={answer} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/50">
                                <span className={isCorrect ? 'font-bold text-emerald-600 truncate' : 'text-muted-foreground truncate'} style={{ maxWidth: 140 }}>
                                  {answer.length > 25 ? answer.slice(0, 25) + '...' : answer}
                                </span>
                                <span className="ml-auto font-medium shrink-0">{count} ({pct.toFixed(0)}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-9" />
            </div>
            <span className="text-sm text-muted-foreground">{filteredStudents.length} of {perStudentPerformance?.length || 0} students</span>
          </div>
          <div className="space-y-3">
            {filteredStudents.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">No students found</CardContent>
              </Card>
            ) : (
              filteredStudents.map((s: any) => {
                const isGood = s.correctRate >= 60;
                return (
                  <Card key={s.studentId}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-sm">{s.studentName}</h4>
                          <p className="text-xs text-muted-foreground">{s.admissionNo}</p>
                        </div>
                        <Badge className={isGood ? 'bg-emerald-100 text-emerald-700 text-[10px]' : 'bg-amber-100 text-amber-700 text-[10px]'}>
                          {s.correctRate}% correct
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Correct: <strong className="text-emerald-600">{s.correctCount}</strong></span>
                        <span>Wrong: <strong className="text-red-600">{s.wrongCount}</strong></span>
                        <span>Total: <strong>{s.totalCheckpoints}</strong></span>
                      </div>
                      {s.details?.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {s.details.map((d: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                              <span className={`shrink-0 font-bold ${d.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                                {d.isCorrect ? '✓' : '✗'}
                              </span>
                              <span className="flex-1 truncate">{d.question}</span>
                              <span className="shrink-0 text-muted-foreground">{d.answer}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ═══════ INSIGHTS TAB ═══════ */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          <InsightsPanel
            title="Checkpoint Performance Insights"
            averageScore={overview.overallCorrectRate}
            totalStudents={overview.totalStudents}
            strengths={insightsData?.strengths}
            weaknesses={insightsData?.weaknesses}
            recommendations={insightsData?.recommendations}
            questionAnalysis={insightsData?.questionAnalysis}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
