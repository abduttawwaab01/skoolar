'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/shared/kpi-card';
import { useAppStore } from '@/store/app-store';
import { ExportMenu } from '@/components/shared/export-menu';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  BookOpen, Users, Award, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, ArrowLeft, BarChart3, PieChart as PieChartIcon, Search, Brain,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SendToParent } from '@/components/shared/send-to-parent';
import { InsightsPanel } from '@/components/shared/insights-panel';

const COLORS = ['#059669', '#2563eb', '#d97706', '#dc2626', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const GRADE_COLORS: Record<string, string> = {
  'A+': '#059669', 'A': '#10b981', 'B': '#2563eb', 'C': '#d97706',
  'D': '#ea580c', 'F': '#dc2626', 'N/A': '#9ca3af',
};

interface HomeworkAnalyticsProps {
  homeworkId: string;
  onBack?: () => void;
}

export function HomeworkAnalyticsView({ homeworkId, onBack }: HomeworkAnalyticsProps) {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [studentSearch, setStudentSearch] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/homework/${homeworkId}/analytics`);
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      toast.error('Failed to load homework analytics');
    } finally {
      setLoading(false);
    }
  }, [homeworkId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const { homework, overview, gradeDistribution, scoreDistribution, perQuestionAnalytics, perStudentPerformance, submissionTimeline, subjectBreakdown } = data || {};

  const insightsData = useMemo(() => {
    if (!overview) return { strengths: [], weaknesses: [], recommendations: [], topicBreakdown: [], questionAnalysis: [], subjectRadar: [], averageScore: 0 };
    const o = overview || {};
    const tp = o.totalPossible || 0;
    const sortedByScore = [...(perStudentPerformance || [])].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
    const topStudents = sortedByScore.slice(0, 3).map((s: any) => ({
      name: s.studentName,
      subject: homework.subject?.name || '',
      score: s.score || 0,
    }));
    const bottomStudents = [...sortedByScore].reverse().slice(0, 3).map((s: any) => ({
      name: s.studentName,
      subject: homework.subject?.name || '',
      score: s.score || 0,
    }));

    const strengths = topStudents.length > 0 ? topStudents.map(s => ({
      name: s.name,
      score: tp > 0 ? Math.round((s.score / tp) * 100) : 0,
      average: o.averageScore ? Math.round((o.averageScore / tp) * 100) : 0,
    })) : [];

    const weaknesses = bottomStudents.length > 0 ? bottomStudents.map(s => ({
      name: s.name,
      score: tp > 0 ? Math.round((s.score / tp) * 100) : 0,
      average: o.averageScore ? Math.round((o.averageScore / tp) * 100) : 0,
    })) : [];

    const recommendations: any[] = [];
    if ((o.passRate ?? 100) < 50) {
      recommendations.push({ type: 'danger' as const, title: 'Low Pass Rate', description: `Only ${o.passRate}% of students passed. Consider reviewing the homework concepts.` });
    }
    if (o.averageScore !== undefined && o.averageScore < 50) {
      recommendations.push({ type: 'warning' as const, title: 'Below Average Performance', description: 'Class average is below 50%. Additional practice materials may be needed.' });
    }
    if (perQuestionAnalytics?.length > 0) {
      const hardQuestions = perQuestionAnalytics.filter((q: any) => q.correctRate < 40);
      if (hardQuestions.length > 0) {
        recommendations.push({ type: 'warning' as const, title: `Challenging Questions (${hardQuestions.length})`, description: `Q${hardQuestions.map((q: any) => perQuestionAnalytics.indexOf(q) + 1).join(', ')} had fewer than 40% correct. Consider reteaching these concepts.` });
      }
      const wellAnswered = perQuestionAnalytics.filter((q: any) => q.correctRate >= 80);
      if (wellAnswered.length > 0) {
        recommendations.push({ type: 'success' as const, title: 'Well-Understood Concepts', description: `${wellAnswered.length} question(s) had 80%+ correct rate. Students show good grasp of these topics.` });
      }
    }
    if ((o.totalStudents || 0) > 0 && (o.gradedCount || 0) < (o.totalStudents || 0)) {
      recommendations.push({ type: 'info' as const, title: 'Pending Submissions', description: `${(o.totalStudents || 0) - (o.gradedCount || 0)} student(s) have not been graded yet.` });
    }

    // Subject-based recommendations from subjectBreakdown
    const subjectRecs: any[] = [];
    if (subjectBreakdown?.length > 0) {
      for (const sb of subjectBreakdown) {
        if (sb.percentage < 40) {
          subjectRecs.push({ type: 'danger' as const, title: `${sb.subjectName}: Critical Weakness`, description: `Only ${sb.percentage}% correct in ${sb.subjectName}. Consider remediation.` });
        } else if (sb.percentage < 60) {
          subjectRecs.push({ type: 'warning' as const, title: `${sb.subjectName}: Needs Improvement`, description: `${sb.subjectName} score is ${sb.percentage}%. Focus on key topics.` });
        }
        for (const tb of sb.topicBreakdown || []) {
          if (tb.percentage < 40) {
            subjectRecs.push({ type: 'info' as const, title: `Weak Topic: ${tb.topic}`, description: `Only ${tb.percentage}% correct on "${tb.topic}" in ${sb.subjectName}.` });
          }
        }
      }
    }
    recommendations.push(...subjectRecs);

    const topicBreakdownItems: any[] = [];
    if (subjectBreakdown?.length > 0) {
      for (const sb of subjectBreakdown) {
        for (const tb of sb.topicBreakdown || []) {
          topicBreakdownItems.push({
            topic: `${sb.subjectName}: ${tb.topic}`,
            score: tb.percentage,
            totalMarks: tb.totalMarks || 0,
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
      commonMisconception: q.commonMisconception || undefined,
    }));

    const subjectRadar = subjectBreakdown?.length > 0
      ? subjectBreakdown.map((sb: any) => ({ domain: sb.subjectName, score: Math.round(sb.percentage), fullMark: 100 }))
      : homework.subject?.name
        ? [{ domain: homework.subject.name, score: tp > 0 ? Math.round((o.averageScore || 0) / tp * 100) : 0, fullMark: 100 }]
        : [];

    return { strengths, weaknesses, recommendations, topicBreakdown: topicBreakdownItems, questionAnalysis, subjectRadar, averageScore: tp > 0 ? Math.round(((o.averageScore || 0) / tp) * 100) : 0 };
  }, [perStudentPerformance, perQuestionAnalytics, overview, homework, subjectBreakdown]);

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

  const o = overview || {};
  const hw = homework || {};
  const pqa = perQuestionAnalytics || [];
  const psp = perStudentPerformance || [];
  const overviewCards = [
    { title: 'Total Students', value: o.totalStudents || 0, icon: Users, iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: 'Graded', value: o.gradedCount || 0, icon: Award, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { title: 'Avg Score', value: `${o.averageScore || 0}/${o.totalPossible || 0}`, icon: TrendingUp, iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { title: 'Pass Rate', value: `${o.passRate || 0}%`, icon: CheckCircle2, iconBgColor: (o.passRate || 0) >= 50 ? 'bg-emerald-100' : 'bg-red-100', iconColor: (o.passRate || 0) >= 50 ? 'text-emerald-600' : 'text-red-600' },
  ];

  const gradeDistData = Object.entries(gradeDistribution || {}).map(([name, value]) => ({ name, value }));
  const scoreDistData = Object.entries(scoreDistribution || {}).map(([range, count]) => ({ range, count }));
  const timelineData = Object.entries(submissionTimeline || {}).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  const filteredStudents = psp.filter((s: any) =>
    !studentSearch || s.studentName?.toLowerCase().includes(studentSearch.toLowerCase()) || s.admissionNo?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const homeworkTitle = hw.title || 'Homework';

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
              {homeworkTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {hw.subject?.name && `${hw.subject.name} · `}
              {hw.class?.name && `${hw.class.name} · `}
              {hw.questionsCount || 0} questions · {hw.totalMarks || 0} marks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SendToParent
            endpoint={`/api/homework/${homeworkId}/send-to-parent`}
            label="Send to Parents"
            variant="outline"
            size="sm"
            studentName=""
            assessmentName={homeworkTitle}
          />
          <ExportMenu options={{
            title: `${homeworkTitle} - Analytics`,
            subtitle: `${hw.subject?.name || ''} · ${o.totalStudents || 0} students`,
            fileName: `${homeworkTitle.replace(/\s+/g, '_')}_analytics`,
            columns: [
              { header: 'Student', key: 'Student' },
              { header: 'Score', key: 'Score' },
              { header: 'Grade', key: 'Grade' },
              { header: 'Earned', key: 'Earned' },
              { header: 'Possible', key: 'Possible' },
              { header: 'Status', key: 'Status' },
            ],
            data: (perStudentPerformance || []).map((s: any) => ({
              Student: s.studentName,
              Score: `${((s.totalEarned || 0) / (s.totalPossible || 1)) * 100}%`,
              Grade: s.grade || 'N/A',
              Earned: s.totalEarned || 0,
              Possible: s.totalPossible || 0,
              Status: s.status || 'N/A',
            })),
            summaryRows: [
              { label: 'Avg Score', value: `${o.averageScore || 0}/${o.totalPossible || 0}` },
              { label: 'Pass Rate', value: `${o.passRate || 0}%` },
              { label: 'Graded', value: `${o.gradedCount || 0}/${o.totalStudents || 0}` },
              ...(subjectBreakdown || []).filter((sb: any) => sb.subjectId !== '__none__').map((sb: any) => ({
                label: `${sb.subjectName} Avg`,
                value: `${sb.percentage.toFixed(1)}% (${sb.correctCount}/${sb.totalQuestions} correct)`,
              })),
            ],
            chartDescriptions: [
              `Score Distribution: ${Object.entries(scoreDistribution || {}).filter(([,v]) => (v as number) > 0).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A'}`,
              `Grade Distribution: ${Object.entries(gradeDistribution || {}).filter(([,v]) => (v as number) > 0).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A'}`,
              ...(subjectBreakdown || []).filter((sb: any) => sb.subjectId !== '__none__').flatMap((sb: any) => [
                `${sb.subjectName}: ${sb.percentage.toFixed(1)}% correct (${sb.correctCount}/${sb.totalQuestions} questions)`,
                ...(sb.topicBreakdown || []).map((tb: any) => `  · ${tb.topic}: ${tb.percentage.toFixed(1)}% correct`),
              ]),
            ],
            sections: (subjectBreakdown || []).filter((sb: any) => sb.subjectId !== '__none__').map((sb: any) => ({
              heading: `${sb.subjectName} — ${sb.percentage.toFixed(1)}% Correct`,
              content: [
                `Questions: ${sb.totalQuestions}, Total Marks: ${sb.totalMarks}, Correct: ${sb.correctCount}/${sb.totalQuestions}`,
                ...(sb.topicBreakdown || []).map((tb: any) => `Topic "${tb.topic}": ${tb.percentage.toFixed(1)}% correct (${tb.correctCount}/${tb.totalQuestions})`),
              ],
            })),
          }} />
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {overviewCards.map((card, i) => (
          <KpiCard key={i} {...card} />
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5">
            <Brain className="size-3.5" /> Insights
          </TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ─── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChartIcon className="size-4" /> Grade Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gradeDistData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No graded submissions yet</p>
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

            {/* Score Distribution Bar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="size-4" /> Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scoreDistData.every(d => d.count === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No graded submissions yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={scoreDistData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Key Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Key Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Highest Score</span><span className="font-semibold text-emerald-600">{o.highestScore || 0}/{o.totalPossible || 0}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Lowest Score</span><span className="font-semibold text-red-600">{o.lowestScore || 0}/{o.totalPossible || 0}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Average Score</span><span className="font-semibold">{o.averageScore || 0}/{o.totalPossible || 0}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Pass Rate</span><span className="font-semibold">{o.passRate || 0}% ({o.passedCount || 0}/{o.gradedCount || 0})</span></div>
                  <div className="flex justify-between py-2"><span className="text-muted-foreground">Total Submissions</span><span className="font-semibold">{o.totalStudents || 0}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Homework Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Status</span><Badge variant={hw.status === 'active' ? 'default' : 'secondary'}>{hw.status || 'N/A'}</Badge></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Questions</span><span className="font-semibold">{hw.questionsCount || 0}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Total Marks</span><span className="font-semibold">{hw.totalMarks || 0}</span></div>
                  <div className="flex justify-between py-2"><span className="text-muted-foreground">Due Date</span><span className="font-semibold">{hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : 'N/A'}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── QUESTIONS TAB ─── */}
        <TabsContent value="questions" className="space-y-4 mt-4">
          {pqa.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center"><BookOpen className="size-12 text-muted-foreground mx-auto mb-4" /><h3 className="font-semibold">No Questions</h3><p className="text-sm text-muted-foreground mt-1">This homework has no questions configured.</p></CardContent>
            </Card>
          ) : (
            pqa.map((q: any, idx: number) => {
              const distEntries = Object.entries(q.answerDistribution || {}).sort(([, a], [, b]) => (b as number) - (a as number));
              const isGood = q.correctRate >= 60;
              const isMedium = q.correctRate >= 40 && q.correctRate < 60;
              return (
                <Card key={q.questionId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{idx + 1}</span>
                          {q.questionText.length > 100 ? q.questionText.slice(0, 100) + '...' : q.questionText}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                          <span className="text-xs">{q.marks} marks</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={isGood ? 'bg-emerald-100 text-emerald-700' : isMedium ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                          {q.correctRate}% correct
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Correct/Wrong bar */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Performance</p>
                        <ResponsiveContainer width="100%" height={40}>
                          <BarChart layout="vertical" data={[{ name: 'Answers', correct: q.correctCount, wrong: q.wrongCount }]}>
                            <XAxis type="number" hide />
                            <YAxis type="category" hide />
                            <Bar dataKey="correct" stackId="a" fill="#059669" radius={[4, 0, 0, 4]} />
                            <Bar dataKey="wrong" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            <Tooltip />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-emerald-600">{q.correctCount} correct</span>
                          <span className="text-red-600">{q.wrongCount} wrong</span>
                        </div>
                      </div>
                      {/* Answer distribution */}
                      <div className="lg:col-span-2">
                        <p className="text-xs text-muted-foreground mb-2">Answer Distribution</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {distEntries.slice(0, 6).map((entry) => {
                            const [answer, count] = entry as [string, number];
                            const pct = q.totalAnswers > 0 ? (count / q.totalAnswers) * 100 : 0;
                            const isCorrectAnswer = answer === q.correctAnswer || (q.type === 'TRUE_FALSE' && answer === q.correctAnswer);
                            return (
                              <div key={answer} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/50">
                                <span className={isCorrectAnswer ? 'font-bold text-emerald-600' : 'text-muted-foreground'} style={{ maxWidth: 120 }}>
                                  {answer.length > 30 ? answer.slice(0, 30) + '...' : answer}
                                </span>
                                <span className="ml-auto font-medium">{count} ({pct.toFixed(0)}%)</span>
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

        {/* ─── STUDENTS TAB ─── */}
        <TabsContent value="students" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-9" />
            </div>
            <span className="text-sm text-muted-foreground">{filteredStudents.length} of {psp.length} students</span>
          </div>

          {pqa.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Student × Question Heatmap</CardTitle>
                <CardDescription className="text-xs">Green = correct, Red = wrong, Gray = not answered</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left p-1.5 sticky left-0 bg-white min-w-[120px]">Student</th>
                      {pqa.map((q: any, i: number) => (
                        <th key={q.questionId} className="p-1.5 text-center min-w-[40px]" title={q.questionText}>
                          Q{i + 1}
                        </th>
                      ))}
                      <th className="p-1.5 text-center min-w-[60px]">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s: any) => (
                      <tr key={s.studentId} className="border-t hover:bg-muted/30">
                        <td className="p-1.5 sticky left-0 bg-white font-medium whitespace-nowrap">
                          {s.studentName}
                          <span className="text-muted-foreground ml-1">({s.admissionNo})</span>
                        </td>
                        {pqa.map((q: any) => {
                          const ans = s.answers.find((a: any) => a.questionId === q.questionId);
                          const isCorrect = ans?.isCorrect;
                          return (
                            <td key={q.questionId} className="p-1.5 text-center">
                              <span
                                className={`inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
                                  ans === undefined ? 'bg-gray-100 text-gray-400' :
                                  isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}
                                title={`Answer: ${ans?.studentAnswer || 'N/A'}`}
                              >
                                {ans === undefined ? '-' : isCorrect ? '✓' : '✗'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="p-1.5 text-center font-semibold">
                          {s.status === 'graded' ? `${s.score}/${s.totalPossible}` : s.status === 'submitted' ? 'Pending' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Student detail cards */}
          <div className="space-y-3">
            {filteredStudents.map((s: any) => (
              <Card key={s.studentId}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-sm">{s.studentName}</h4>
                      <p className="text-xs text-muted-foreground">{s.admissionNo} · {s.status === 'graded' ? `Score: ${s.score}/${s.totalPossible}` : s.status === 'submitted' ? 'Submitted - Awaiting grade' : 'Not submitted'}</p>
                    </div>
                    {s.grade && <Badge className="bg-emerald-600 text-[10px]">{s.grade}</Badge>}
                  </div>
                  {s.answers.length > 0 && (
                    <div className="space-y-1.5">
                      {s.answers.map((a: any, i: number) => (
                        <div key={a.questionId} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                          <span className="font-medium text-muted-foreground shrink-0">Q{i + 1}:</span>
                          <span className="flex-1 truncate">{a.questionText}</span>
                          <span className={`shrink-0 font-medium ${a.isCorrect ? 'text-emerald-600' : a.autoScore === null && a.manualScore === null ? 'text-gray-400' : 'text-red-600'}`}>
                            {a.studentAnswer ? (a.studentAnswer.length > 30 ? a.studentAnswer.slice(0, 30) + '...' : a.studentAnswer) : 'N/A'}
                          </span>
                          <span className={`shrink-0 font-bold ${a.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                            {a.autoScore !== null ? `${a.autoScore}/${a.marks}` : a.manualScore !== null ? `${a.manualScore}/${a.marks}` : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── TIMELINE TAB ─── */}
        <TabsContent value="timeline" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="size-4" /> Submission Timeline
              </CardTitle>
              <CardDescription>Number of submissions per day</CardDescription>
            </CardHeader>
            <CardContent>
              {timelineData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── INSIGHTS TAB ─── */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          {insightsData.subjectRadar.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="size-4 text-indigo-600" /> Subject Performance Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={insightsData.subjectRadar}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Avg Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <InsightsPanel
            title="Homework Performance Insights"
            averageScore={insightsData.averageScore}
            passRate={o.passRate || 0}
            totalStudents={o.totalStudents || 0}
            strengths={insightsData.strengths}
            weaknesses={insightsData.weaknesses}
            recommendations={insightsData.recommendations}
            topicBreakdown={insightsData.topicBreakdown}
            questionAnalysis={insightsData.questionAnalysis}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
