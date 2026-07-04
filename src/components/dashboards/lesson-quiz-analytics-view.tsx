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
  PieChart, Pie, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  BookOpen, Users, Award, TrendingUp, AlertTriangle, CheckCircle2,
  ArrowLeft, BarChart3, PieChart as PieChartIcon, Search, Brain,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const COLORS = ['#059669', '#2563eb', '#d97706', '#dc2626', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const GRADE_COLORS: Record<string, string> = {
  'A': '#059669', 'B': '#2563eb', 'C': '#d97706', 'D': '#ea580c', 'F': '#dc2626',
};

interface Props {
  quizId: string;
  onBack?: () => void;
}

export function LessonQuizAnalyticsView({ quizId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [studentSearch, setStudentSearch] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/lessons/quizzes/${quizId}/analytics`);
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      toast.error('Failed to load lesson quiz analytics');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const { quiz, overview, gradeDistribution, perQuestionAnalytics, perStudentPerformance, subjectBreakdown } = data || {};

  const insightsData = useMemo(() => {
    if (!perStudentPerformance) return null;
    const sorted = [...perStudentPerformance].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
    const topStudents = sorted.slice(0, 3);
    const bottomStudents = sorted.slice(-3).reverse();

    const strengths = topStudents.map((s: any) => ({
      name: s.studentName,
      score: s.percentage || Math.round((s.score / (s.totalMarks || 1)) * 100),
      average: overview.averagePct || 0,
    }));
    const weaknesses = bottomStudents.map((s: any) => ({
      name: s.studentName,
      score: s.percentage || Math.round((s.score / (s.totalMarks || 1)) * 100),
      average: overview.averagePct || 0,
    }));

    const recommendations: any[] = [];
    if (overview.passRate < 50) recommendations.push({ type: 'danger' as const, title: 'Low Pass Rate', description: `Only ${overview.passRate}% passed this quiz.` });
    if (perQuestionAnalytics) {
      const hardQ = perQuestionAnalytics.filter((q: any) => q.correctRate < 40);
      if (hardQ.length > 0) recommendations.push({ type: 'warning' as const, title: `Difficult Questions (${hardQ.length})`, description: `${hardQ.length} question(s) had <40% correct.` });
    }
    if (overview.averagePct >= 70) recommendations.push({ type: 'success' as const, title: 'Good Performance', description: 'Class performed well on this quiz.' });
    if (overview.totalAttempts > 0 && overview.completedCount < overview.totalAttempts) {
      recommendations.push({ type: 'info' as const, title: 'Incomplete Attempts', description: `${overview.totalAttempts - overview.completedCount} attempt(s) not completed.` });
    }

    // Subject-based recommendations
    if (subjectBreakdown?.length > 0) {
      for (const sb of subjectBreakdown) {
        if (sb.percentage < 40) recommendations.push({ type: 'danger' as const, title: `${sb.subjectName}: Critical Weakness`, description: `Only ${sb.percentage}% correct in ${sb.subjectName}.` });
        else if (sb.percentage < 60) recommendations.push({ type: 'warning' as const, title: `${sb.subjectName}: Needs Improvement`, description: `${sb.subjectName} score is ${sb.percentage}%.` });
        for (const tb of sb.topicBreakdown || []) {
          if (tb.percentage < 40) recommendations.push({ type: 'info' as const, title: `Weak Topic: ${tb.topic}`, description: `Only ${tb.percentage}% correct on "${tb.topic}" in ${sb.subjectName}.` });
        }
      }
    }

    const topicBreakdownItems: any[] = [];
    if (subjectBreakdown?.length > 0) {
      for (const sb of subjectBreakdown) {
        for (const tb of sb.topicBreakdown || []) {
          topicBreakdownItems.push({
            topic: `${sb.subjectName}: ${tb.topic}`,
            score: tb.percentage,
            totalMarks: 0,
            totalQuestions: tb.totalQuestions,
            correctCount: tb.correctCount,
            masteryLevel: tb.percentage >= 80 ? 'mastered' : tb.percentage >= 60 ? 'advanced' : tb.percentage >= 40 ? 'intermediate' : 'beginner',
          });
        }
      }
    }

    const questionAnalysis = (perQuestionAnalytics || []).map((q: any, i: number) => ({
      questionNumber: i + 1,
      questionText: q.questionText || '',
      type: q.type || 'MCQ',
      marks: q.marks || 0,
      correctRate: q.correctRate || 0,
      difficulty: q.correctRate >= 70 ? 'Easy' : q.correctRate >= 40 ? 'Medium' : 'Hard',
    }));

    return { strengths, weaknesses, recommendations, topicBreakdown: topicBreakdownItems, questionAnalysis, averageScore: overview.averagePct || 0 };
  }, [perStudentPerformance, perQuestionAnalytics, overview, subjectBreakdown]);

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

  const overviewCards = [
    { title: 'Total Attempts', value: overview.totalAttempts, icon: Users, iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: 'Completed', value: overview.completedCount, icon: CheckCircle2, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { title: 'Avg Score', value: `${overview.averageScore}`, icon: TrendingUp, iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { title: 'Pass Rate', value: `${overview.passRate}%`, icon: Award, iconBgColor: overview.passRate >= 50 ? 'bg-emerald-100' : 'bg-red-100', iconColor: overview.passRate >= 50 ? 'text-emerald-600' : 'text-red-600' },
  ];

  const gradeDistData = Object.entries(gradeDistribution || {}).map(([name, value]) => ({ name, value }));
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
              {quiz?.title || 'Quiz Analytics'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {quiz?.lessonTitle} · {quiz?.timeLimit ? `${quiz.timeLimit} min` : 'No time limit'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SendToParent
            endpoint={`/api/lessons/quizzes/${quizId}/send-to-parent`}
            label="Send to Parents"
            variant="outline"
            size="sm"
            assessmentName={quiz?.title}
          />
          <ExportMenu options={{
            title: `${quiz?.title || 'Quiz'} Analytics`,
            subtitle: `${quiz?.lessonTitle || ''} · ${overview.totalStudents || 0} students`,
            fileName: `${(quiz?.title || 'quiz').replace(/\s+/g, '_')}_analytics`,
            columns: [
              { header: 'Student', key: 'Student' },
              { header: 'Score', key: 'Score' },
              { header: 'Percentage', key: 'Pct' },
              { header: 'Passed', key: 'Passed' },
              { header: 'Total Marks', key: 'Total' },
            ],
            data: (perStudentPerformance || []).map((s: any) => ({
              Student: s.studentName,
              Score: s.score || 0,
              Pct: `${s.percentage || 0}%`,
              Passed: s.passed ? 'Yes' : 'No',
              Total: s.totalMarks || 0,
            })),
            summaryRows: [
              { label: 'Avg Score', value: `${(overview.averagePercentage || 0).toFixed(1)}%` },
              { label: 'Pass Rate', value: `${(overview.passRate || 0).toFixed(1)}%` },
              { label: 'Completed', value: `${overview.completedCount || 0}/${overview.totalAttempts || 0}` },
              ...(subjectBreakdown || []).filter((sb: any) => sb.percentage > 0).map((sb: any) => ({
                label: `${sb.subjectName} Avg`,
                value: `${sb.percentage.toFixed(1)}% (${sb.correctCount}/${sb.totalQuestions} correct)`,
              })),
            ],
            chartDescriptions: [
              `Grade Distribution: ${Object.entries(gradeDistribution || {}).filter(([,v]) => (v as number) > 0).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A'}`,
              ...(subjectBreakdown || []).filter((sb: any) => sb.percentage > 0).flatMap((sb: any) => [
                `${sb.subjectName}: ${sb.percentage.toFixed(1)}% correct (${sb.correctCount}/${sb.totalQuestions})`,
                ...(sb.topicBreakdown || []).map((tb: any) => `  · ${tb.topic}: ${tb.percentage.toFixed(1)}% correct`),
              ]),
            ],
            sections: (subjectBreakdown || []).filter((sb: any) => sb.percentage > 0).map((sb: any) => ({
              heading: `${sb.subjectName} — ${sb.percentage.toFixed(1)}% Correct`,
              content: [
                `Questions: ${sb.totalQuestions}, Correct: ${sb.correctCount}/${sb.totalQuestions}`,
                ...(sb.topicBreakdown || []).map((tb: any) => `Topic "${tb.topic}": ${tb.percentage.toFixed(1)}% correct (${tb.correctCount}/${tb.totalQuestions})`),
              ],
            })),
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
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5">
            <Brain className="size-3.5" /> Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChartIcon className="size-4" /> Grade Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gradeDistData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No completed attempts yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={gradeDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                        {gradeDistData.map((entry) => (
                          <Cell key={entry.name} fill={GRADE_COLORS[entry.name] || '#9ca3af'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Key Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Average Score</span><span className="font-semibold">{overview.averageScore}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Average Percentage</span><span className="font-semibold">{overview.averagePct}%</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Pass Rate</span><span className="font-semibold">{overview.passRate}% ({overview.passCount}/{overview.completedCount})</span></div>
                  <div className="flex justify-between py-2"><span className="text-muted-foreground">Total Students</span><span className="font-semibold">{overview.totalStudents}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4 mt-4">
          {(!perQuestionAnalytics || perQuestionAnalytics.length === 0) ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center"><BookOpen className="size-12 text-muted-foreground mx-auto mb-4" /><h3 className="font-semibold">No Questions</h3></CardContent>
            </Card>
          ) : (
            perQuestionAnalytics.map((q: any, idx: number) => {
              const isGood = q.correctRate >= 60;
              const isMedium = q.correctRate >= 40 && q.correctRate < 60;
              return (
                <Card key={q.questionId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{idx + 1}</span>
                          {q.questionText?.length > 100 ? q.questionText.slice(0, 100) + '...' : q.questionText}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                          <span className="text-xs">{q.marks} marks</span>
                        </CardDescription>
                      </div>
                      <Badge className={isGood ? 'bg-emerald-100 text-emerald-700' : isMedium ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                        {q.correctRate}% correct
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Performance</p>
                        <ResponsiveContainer width="100%" height={40}>
                          <BarChart layout="vertical" data={[{ name: 'Answers', correct: q.correctCount, wrong: q.totalAnswers - q.correctCount }]}>
                            <XAxis type="number" hide />
                            <YAxis type="category" hide />
                            <Bar dataKey="correct" stackId="a" fill="#059669" radius={[4, 0, 0, 4]} />
                            <Bar dataKey="wrong" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            <Tooltip />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-emerald-600">{q.correctCount} correct</span>
                          <span className="text-red-600">{q.totalAnswers - q.correctCount} wrong</span>
                        </div>
                      </div>
                      <div className="lg:col-span-2 text-xs text-muted-foreground">
                        <p className="mb-1">Correct Answer: <span className="font-mono text-emerald-600">{q.correctAnswer || 'N/A'}</span></p>
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
              filteredStudents.map((s: any) => (
                <Card key={s.studentId}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm">{s.studentName}</h4>
                        <p className="text-xs text-muted-foreground">{s.admissionNo}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">{s.score}/{s.totalMarks}</span>
                        <div>
                          <Badge className={s.passed ? 'bg-emerald-100 text-emerald-700 text-[10px]' : 'bg-red-100 text-red-700 text-[10px]'}>
                            {s.passed ? 'Passed' : 'Failed'} · {s.percentage}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ═══════ INSIGHTS TAB ═══════ */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          {(subjectBreakdown?.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="size-4 text-indigo-600" /> Subject Performance Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={subjectBreakdown.map((sb: any) => ({
                    subject: sb.subjectName,
                    score: Math.round(sb.percentage),
                    fullMark: 100,
                  }))}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Class Avg %" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {(!subjectBreakdown?.length) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="size-4 text-indigo-600" /> Performance Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={[
                    { metric: 'Avg Score', value: Math.round(overview.averagePct || 0), fullMark: 100 },
                    { metric: 'Pass Rate', value: Math.round(overview.passRate || 0), fullMark: 100 },
                    { metric: 'Completion', value: overview.totalAttempts > 0 ? Math.round((overview.completedCount / overview.totalAttempts) * 100) : 0, fullMark: 100 },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <InsightsPanel
            title="Lesson Quiz Insights"
            averageScore={overview.averagePct || 0}
            passRate={overview.passRate}
            totalStudents={overview.totalStudents}
            strengths={insightsData?.strengths}
            weaknesses={insightsData?.weaknesses}
            recommendations={insightsData?.recommendations}
            topicBreakdown={insightsData?.topicBreakdown}
            questionAnalysis={insightsData?.questionAnalysis}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
