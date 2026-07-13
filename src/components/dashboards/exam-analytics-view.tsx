'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  computeSubjectBreakdownForClass, generateRecommendations, generateStudentInsights,
  getMasteryLevel, getMasteryBadgeClass,
} from '@/lib/analytics-utils';
import { ExportMenu } from '@/components/shared/export-menu';
import { SendToParent } from '@/components/shared/send-to-parent';
import { InsightsPanel } from '@/components/shared/insights-panel';
import {
  ChevronLeft, Check, X, AlertTriangle, Users, BarChart3, TrendingUp, Clock,
  GraduationCap, Download, Search, Target, Brain, Lightbulb,
  BookOpen, HelpCircle, Activity, Sigma, Zap, Award, User,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

const GRADE_COLORS = ['#059669', '#10B981', '#3B82F6', '#F59E0B', '#F97316', '#EF4444'];

const DIFFICULTY_COLORS: Record<string, string> = {
  'Very Easy': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Easy': 'bg-green-100 text-green-700 border-green-200',
  'Medium': 'bg-amber-100 text-amber-700 border-amber-200',
  'Hard': 'bg-orange-100 text-orange-700 border-orange-200',
  'Very Hard': 'bg-red-100 text-red-700 border-red-200',
};

const DISCRIMINATION_COLORS: Record<string, string> = {
  'Excellent': 'bg-emerald-100 text-emerald-700',
  'Good': 'bg-blue-100 text-blue-700',
  'Fair': 'bg-amber-100 text-amber-700',
  'Poor': 'bg-red-100 text-red-700',
};

const TYPE_LABELS: Record<string, string> = {
  MCQ: 'Multiple Choice', MULTI_SELECT: 'Multi-Select', TRUE_FALSE: 'True/False',
  FILL_BLANK: 'Fill in Blank', SHORT_ANSWER: 'Short Answer', ESSAY: 'Essay', MATCHING: 'Matching',
};

interface ExamAnalyticsViewProps {
  examId: string;
  onBack: () => void;
}

export function ExamAnalyticsView({ examId, onBack }: ExamAnalyticsViewProps) {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchStudent, setSearchStudent] = useState('');
  const [drillDownStudent, setDrillDownStudent] = useState<any>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/exams/${examId}/analytics`);
        if (!res.ok) throw new Error('Failed to load analytics');
        const json = await res.json();
        setAnalytics(json.data);
      } catch (err) {
        toast.error('Failed to load exam analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [examId]);

  const gradeDistData = useMemo(() => {
    if (!analytics?.gradeDistribution) return [];
    return Object.entries(analytics.gradeDistribution as Record<string, number>)
      .filter(([, count]) => count > 0)
      .map(([grade, count]) => ({ grade, count }));
  }, [analytics]);

  const sortedQuestions = useMemo(() => {
    if (!analytics?.questionAnalytics) return [];
    return [...analytics.questionAnalytics].sort((a: any, b: any) => a.index - b.index);
  }, [analytics]);

  const filteredStudents = useMemo(() => {
    if (!analytics?.studentPerformance) return [];
    let list = [...analytics.studentPerformance];
    if (searchStudent) {
      const q = searchStudent.toLowerCase();
      list = list.filter((s: any) => s.studentName.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q));
    }
    return list;
  }, [analytics, searchStudent]);

  // Subject breakdown from API
  const subjectBreakdown = useMemo(() => {
    return analytics?.subjectBreakdown || [];
  }, [analytics]);

  const subjectRecs = useMemo(() => {
    if (!analytics?.subjectBreakdown) return { subjectRecommendations: [], generalRecommendations: [] };
    return generateRecommendations(analytics.subjectBreakdown, analytics.classStats?.classAverage || 0, analytics.classStats?.passRate);
  }, [analytics]);

  // Heatmap data: students × questions
  const heatmapData = useMemo(() => {
    if (!analytics?.studentPerformance || !analytics?.questionAnalytics) return null;
    const students = analytics.studentPerformance.slice(0, 30); // limit to 30 for display
    const questions = analytics.questionAnalytics;
    return { students, questions };
  }, [analytics]);

  const exportCSV = () => {
    if (!analytics) return;
    const rows: string[] = [];
    rows.push('Student,Admission,Rank,Score,Percentage,Grade,Correct,Total Questions,Time (s)');
    for (const s of analytics.studentPerformance) {
      rows.push(`"${s.studentName}","${s.admissionNo}",${s.rank},${s.autoScore},${s.percentage},"${s.grade}",${s.correctedCount},${s.totalQuestions},${s.timeTakenSeconds || ''}`);
    }
    rows.push('');
    rows.push('Question,Type,Difficulty,Discrimination,Correct%,Wrong%,Unanswered%');
    for (const q of analytics.questionAnalytics) {
      rows.push(`"Q${q.index}","${q.type}",${q.difficulty.index},${q.discrimination.index},${q.difficulty.correctPercentage},${q.difficulty.wrongPercentage},${q.difficulty.unansweredPercentage}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analytics.exam.name.replace(/\s+/g, '_')}_analytics.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const fmtPct = (v: number) => `${(v).toFixed(1)}%`;
  const fmtTime = (s: number | null) => {
    if (!s && s !== 0) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };
  const fmtNum = (v: number, d: number = 2) => v.toFixed(d);

  if (loading) return <div className="space-y-4">
    <Skeleton className="h-10 w-64" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
    </div>
    <Skeleton className="h-80 rounded-xl" />
  </div>;

  if (!analytics) return <div className="text-center py-16 text-muted-foreground">
    <AlertTriangle className="size-10 mx-auto mb-3 opacity-40" />
    <p>No analytics data available</p>
  </div>;

  const e = analytics.exam;
  const cs = analytics.classStats;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="size-5" /></Button>
          <div>
            <h2 className="text-xl font-bold">{e.name}</h2>
            <p className="text-sm text-muted-foreground">
              {e.subject?.name} · {analytics.totalStudents} student{analytics.totalStudents !== 1 ? 's' : ''} · {e.totalMarks} marks
              {e.passingMarks > 0 && ` · Pass: ${e.passingMarks}/${e.totalMarks}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SendToParent
            endpoint={`/api/exams/${examId}/send-to-parent`}
            label="Send to Parents"
            variant="outline"
            size="sm"
            assessmentName={e?.name}
          />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowHeatmap(!showHeatmap)}>
            <Activity className="size-3.5" /> {showHeatmap ? 'Hide' : 'Show'} Heatmap
          </Button>
          <ExportMenu options={{
            title: `${e.name} - Analytics Report`,
            subtitle: `${e.subject?.name || ''} · ${analytics.totalStudents} students · ${e.totalMarks} marks`,
            fileName: `${e.name.replace(/\s+/g, '_')}_analytics`,
            columns: [
              { header: 'Student', key: 'Student' },
              { header: 'Score', key: 'Score' },
              { header: 'Grade', key: 'Grade' },
              { header: 'Correct', key: 'Correct' },
              { header: 'Time (s)', key: 'Time' },
            ],
            data: analytics.studentPerformance.map((s: any) => ({
              Student: s.studentName,
              Score: `${s.percentage}%`,
              Grade: s.grade,
              Correct: `${s.correctedCount}/${s.totalQuestions}`,
              Time: s.timeTakenSeconds || '',
            })),
            summaryRows: [
              { label: 'Average Score', value: `${cs.classAverage.toFixed(1)}%` },
              { label: 'Pass Rate', value: `${cs.passRate.toFixed(1)}%` },
              { label: 'Highest', value: `${cs.highestScore.toFixed(1)}%` },
              { label: 'Lowest', value: `${cs.lowestScore.toFixed(1)}%` },
            ],
            chartDescriptions: [
              `Grade Distribution: ${analytics.gradeDistribution?.A || 0} A, ${analytics.gradeDistribution?.B || 0} B, ${analytics.gradeDistribution?.C || 0} C, ${analytics.gradeDistribution?.D || 0} D, ${analytics.gradeDistribution?.F || 0} F`,
              `Question Analysis: ${analytics.questionAnalytics.length} questions analyzed for difficulty and discrimination`,
            ],
          }} />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><BarChart3 className="size-3.5" /></div>
            <div className="min-w-0"><p className="text-[10px] text-muted-foreground truncate">Class Avg</p><p className="text-sm font-bold">{fmtPct(cs.classAverage)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Sigma className="size-3.5" /></div>
            <div className="min-w-0"><p className="text-[10px] text-muted-foreground truncate">Median</p><p className="text-sm font-bold">{fmtPct(cs.medianScore)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600"><Activity className="size-3.5" /></div>
            <div className="min-w-0"><p className="text-[10px] text-muted-foreground truncate">Std Dev</p><p className="text-sm font-bold">{fmtNum(cs.stdDev)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-green-100 text-green-600"><TrendingUp className="size-3.5" /></div>
            <div className="min-w-0"><p className="text-[10px] text-muted-foreground truncate">Highest</p><p className="text-sm font-bold">{fmtPct(cs.highestScore)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-red-100 text-red-600"><TrendingUp className="size-3.5 rotate-180" /></div>
            <div className="min-w-0"><p className="text-[10px] text-muted-foreground truncate">Lowest</p><p className="text-sm font-bold">{fmtPct(cs.lowestScore)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><GraduationCap className="size-3.5" /></div>
            <div className="min-w-0"><p className="text-[10px] text-muted-foreground truncate">Pass Rate</p><p className="text-sm font-bold">{fmtPct(cs.passRate)}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* ── Heatmap (toggle) ── */}
      {showHeatmap && heatmapData && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Student × Question Performance Matrix</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-0">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-background z-10 text-left px-1 py-0.5 border" style={{ minWidth: 120 }}>Student</th>
                    {heatmapData.questions.map((q: any) => (
                      <th key={q.questionId} className="text-center px-1 py-0.5 border font-mono" style={{ minWidth: 28 }}>Q{q.index}</th>
                    ))}
                    <th className="text-center px-1 py-0.5 border font-medium" style={{ minWidth: 40 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.students.map((s: any) => {
                    const qMap = new Map<string, any>(s.perQuestion.map((pq: any) => [pq.questionId, pq]));
                    return (
                      <tr key={s.studentId} className="hover:bg-muted/30">
                        <td className="sticky left-0 bg-background z-10 px-1 py-0.5 border text-ellipsis overflow-hidden whitespace-nowrap" style={{ maxWidth: 120 }}>
                          {s.studentName}
                        </td>
                        {heatmapData.questions.map((q: any) => {
                          const pq = qMap.get(q.questionId);
                          const isCorrect = pq?.isCorrect ?? false;
                          return (
                            <td key={q.questionId} className={cn(
                              'text-center px-1 py-0.5 border',
                              isCorrect ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                            )}>
                              {isCorrect ? '✓' : '✗'}
                            </td>
                          );
                        })}
                        <td className={cn(
                          'text-center px-1 py-0.5 border font-bold',
                          s.percentage >= 70 ? 'text-emerald-700' : s.percentage >= 50 ? 'text-amber-700' : 'text-red-700'
                        )}>
                          {fmtPct(s.percentage)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {/* Grade Distribution */}
            <Card className="xl:col-span-1">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="size-3.5" /> Grade Distribution</CardTitle></CardHeader>
              <CardContent>
                {gradeDistData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={gradeDistData} cx="50%" cy="50%" outerRadius={75} dataKey="count" nameKey="grade" label={({ grade, count }) => `${grade}: ${count}`}>
                        {gradeDistData.map((_, i) => <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data</div>}
              </CardContent>
            </Card>

            {/* Class Statistics */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="size-3.5" /> Class Statistics</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ['Total Students', analytics.totalStudents, ''],
                  ['Average Score', fmtPct(cs.classAverage), 'text-emerald-600'],
                  ['Median Score', fmtPct(cs.medianScore), ''],
                  ['Standard Deviation', fmtNum(cs.stdDev), 'text-muted-foreground'],
                  ['Highest Score', fmtPct(cs.highestScore), 'text-emerald-600'],
                  ['Lowest Score', fmtPct(cs.lowestScore), 'text-red-600'],
                  ['Passed', `${cs.passedCount} (${fmtPct(cs.passRate)})`, 'text-emerald-600'],
                  ['Failed', `${cs.failedCount}`, 'text-red-600'],
                  ['Avg Time', fmtTime(cs.averageTimeSeconds), ''],
                  ['Time-Score Corr.', fmtNum(cs.timeScoreCorrelation), cs.timeScoreCorrelation > 0.3 ? 'text-emerald-600' : cs.timeScoreCorrelation < -0.3 ? 'text-red-600' : ''],
                ].map(([label, value, color]) => (
                  <div key={label} className="flex justify-between border-b border-dashed border-muted pb-1 last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn('font-semibold', color || '')}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Question Type Breakdown */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="size-3.5" /> Question Type Performance</CardTitle></CardHeader>
              <CardContent>
                {analytics.questionTypeBreakdown?.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.questionTypeBreakdown.map((t: any) => (
                      <div key={t.type}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{TYPE_LABELS[t.type] || t.type}</span>
                          <span className="text-muted-foreground">{t.questionCount} Q · {fmtPct(t.correctPercentage)} correct</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${t.correctPercentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data</div>}
              </CardContent>
            </Card>

            {/* Historical Comparison */}
            {analytics.historicalComparison?.length > 0 && (
              <Card className="lg:col-span-2 xl:col-span-3">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="size-3.5" /> Trend vs Previous Exams</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[
                      ...analytics.historicalComparison.map((h: any) => ({ name: h.examName.length > 20 ? h.examName.slice(0, 20) + '…' : h.examName, avg: h.classAverage, pass: h.passRate })),
                      { name: 'This Exam', avg: cs.classAverage, pass: cs.passRate },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avg" fill="#059669" name="Avg Score %" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="pass" fill="#3B82F6" name="Pass Rate %" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Subject Breakdown */}
            {subjectBreakdown.length > 0 && (
              <Card className="lg:col-span-2 xl:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="size-3.5 text-indigo-600" /> Subject Performance Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {subjectBreakdown.map((sb: any) => (
                      <div key={sb.subjectId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{sb.subjectName}</span>
                            <Badge variant="outline" className={cn('text-[10px]', getMasteryBadgeClass(getMasteryLevel(sb.percentage)))}>
                              {getMasteryLevel(sb.percentage)}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {sb.correctCount}/{sb.totalQuestions} correct · {fmtPct(sb.percentage)}
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${sb.percentage}%`,
                              backgroundColor: sb.percentage >= 80 ? '#059669' : sb.percentage >= 60 ? '#3B82F6' : sb.percentage >= 40 ? '#F59E0B' : '#EF4444',
                            }}
                          />
                        </div>
                        {sb.topicBreakdown?.length > 0 && (
                          <div className="mt-2 ml-4 space-y-1">
                            {sb.topicBreakdown.map((tb: any) => (
                              <div key={tb.topic} className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground w-28 truncate">{tb.topic}</span>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{
                                    width: `${tb.percentage}%`,
                                    backgroundColor: tb.percentage >= 80 ? '#059669' : tb.percentage >= 60 ? '#3B82F6' : tb.percentage >= 40 ? '#F59E0B' : '#EF4444',
                                  }} />
                                </div>
                                <span className="text-muted-foreground w-12 text-right">{fmtPct(tb.percentage)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══════════ QUESTIONS TAB ═══════════ */}
        <TabsContent value="questions" className="space-y-3">
          {sortedQuestions.map((q: any, qi: number) => {
            const diffColor = q.difficulty.correctPercentage >= 70 ? 'text-emerald-600' : q.difficulty.correctPercentage >= 40 ? 'text-amber-600' : 'text-red-600';
            const discColorKey = q.discrimination.label as string;
            const discColor = DISCRIMINATION_COLORS[discColorKey] || 'bg-gray-100 text-gray-700';
            return (
              <Card key={q.questionId}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{q.index}</div>
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Question header */}
                      <div>
                        <p className="text-sm font-medium">{q.questionText}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5">{TYPE_LABELS[q.type] || q.type}</Badge>
                          <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5', DIFFICULTY_COLORS[q.difficulty.label] || '')}>
                            {q.difficulty.label}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5', discColor)}>
                            Disc: {q.discrimination.label}
                          </Badge>
                          <span className={cn('text-xs font-semibold', diffColor)}>
                            {fmtPct(q.difficulty.correctPercentage)} correct
                          </span>
                        </div>
                      </div>

                      {/* Stats bar */}
                      <div className="flex h-5 rounded-full overflow-hidden text-[10px] font-medium text-white">
                        {q.difficulty.correctCount > 0 && (
                          <div className="bg-emerald-500 flex items-center justify-center transition-all" style={{ width: `${q.difficulty.correctPercentage}%` }}>
                            {q.difficulty.correctPercentage > 12 ? `${q.difficulty.correctCount}` : ''}
                          </div>
                        )}
                        {q.difficulty.wrongCount > 0 && (
                          <div className="bg-red-500 flex items-center justify-center transition-all" style={{ width: `${q.difficulty.wrongPercentage}%` }}>
                            {q.difficulty.wrongPercentage > 12 ? `${q.difficulty.wrongCount}` : ''}
                          </div>
                        )}
                        {q.difficulty.unansweredCount > 0 && (
                          <div className="bg-gray-300 flex items-center justify-center text-gray-600 transition-all" style={{ width: `${q.difficulty.unansweredPercentage}%` }}>
                            {q.difficulty.unansweredPercentage > 12 ? `${q.difficulty.unansweredCount}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-4 text-[10px] text-muted-foreground">
                        <span><span className="inline-block size-2 rounded-full bg-emerald-500 mr-1" />{q.difficulty.correctCount} correct ({fmtPct(q.difficulty.correctPercentage)})</span>
                        <span><span className="inline-block size-2 rounded-full bg-red-500 mr-1" />{q.difficulty.wrongCount} wrong ({fmtPct(q.difficulty.wrongPercentage)})</span>
                        <span><span className="inline-block size-2 rounded-full bg-gray-300 mr-1" />{q.difficulty.unansweredCount} unanswered ({fmtPct(q.difficulty.unansweredPercentage)})</span>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="rounded-md bg-muted/30 p-2">
                          <p className="text-muted-foreground">Difficulty Index</p>
                          <p className="font-bold">{fmtNum(q.difficulty.index, 3)}</p>
                          <p className="text-[10px] text-muted-foreground">(p-value)</p>
                        </div>
                        <div className="rounded-md bg-muted/30 p-2">
                          <p className="text-muted-foreground">Discrimination</p>
                          <p className="font-bold">{fmtNum(q.discrimination.index, 3)}</p>
                          <p className="text-[10px] text-muted-foreground">({q.discrimination.label})</p>
                        </div>
                        <div className="rounded-md bg-muted/30 p-2">
                          <p className="text-muted-foreground">Point-Biserial</p>
                          <p className="font-bold">{fmtNum(q.discrimination.pointBiserial, 3)}</p>
                        </div>
                        <div className="rounded-md bg-muted/30 p-2">
                          <p className="text-muted-foreground">Upper/Lower</p>
                          <p className="font-bold">{q.discrimination.upperCorrectCount}/{q.discrimination.lowerCorrectCount}</p>
                          <p className="text-[10px] text-muted-foreground">(top/bottom {q.discrimination.groupSize})</p>
                        </div>
                      </div>

                      {/* Correct answer (only if not everyone got it right) */}
                      {q.difficulty.correctPercentage < 100 && (
                        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2">
                          <p className="text-xs font-medium text-emerald-700">
                            Correct answer: <span className="font-bold">{q.correctAnswerFormatted}</span>
                          </p>
                          {q.explanation && <p className="text-xs text-emerald-600 mt-0.5">{q.explanation}</p>}
                        </div>
                      )}

                      {/* Common misconception alert */}
                      {q.commonMisconception && q.commonMisconception.count >= 2 && (
                        <div className="rounded-md bg-amber-50 border border-amber-200 p-2 flex items-start gap-2">
                          <Lightbulb className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-amber-700">Common misconception</p>
                            <p className="text-xs text-amber-600">
                              <span className="font-bold">{q.commonMisconception.count}</span> student{q.commonMisconception.count > 1 ? 's' : ''} ({q.commonMisconception.percentage}%) chose <span className="font-mono">"{q.commonMisconception.answer}"</span>
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Wrong answer distribution */}
                      {Object.keys(q.wrongDistribution).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                            Wrong answer distribution ({Object.keys(q.wrongDistribution).length} unique)
                          </summary>
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(q.wrongDistribution as Record<string, number>)
                              .sort(([, a], [, b]) => b - a)
                              .map(([answer, count]) => (
                                <div key={answer} className="flex justify-between px-2 py-0.5 rounded bg-muted/30">
                                  <span className="text-muted-foreground truncate max-w-[400px]">{answer}</span>
                                  <span className="font-medium ml-2">{count} student{count > 1 ? 's' : ''}</span>
                                </div>
                              ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ═══════════ STUDENTS TAB ═══════════ */}
        <TabsContent value="students" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                className="w-full h-9 pl-9 pr-3 rounded-md border bg-background text-sm"
                placeholder="Search students..."
                value={searchStudent}
                onChange={e => setSearchStudent(e.target.value)}
              />
            </div>
            <span className="text-xs text-muted-foreground">{filteredStudents.length} of {analytics.studentPerformance.length}</span>
          </div>

          <div className="overflow-x-auto">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <table className="w-full text-sm min-w-0">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground sticky top-0">
                      <th className="p-3 font-medium w-10">#</th>
                      <th className="p-3 font-medium">Student</th>
                      <th className="p-3 font-medium">Adm</th>
                      <th className="p-3 font-medium text-right">Score</th>
                      <th className="p-3 font-medium text-right">%</th>
                      <th className="p-3 font-medium text-center">Grade</th>
                      <th className="p-3 font-medium text-center">Correct</th>
                      <th className="p-3 font-medium text-right">Time</th>
                      <th className="p-3 font-medium text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s: any) => (
                      <tr key={s.studentId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3">
                          <span className={cn(
                            'inline-flex size-6 items-center justify-center rounded-full text-xs font-bold',
                            s.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                          )}>{s.rank}</span>
                        </td>
                        <td className="p-3 font-medium">{s.studentName}</td>
                        <td className="p-3 text-muted-foreground text-xs">{s.admissionNo}</td>
                        <td className="p-3 text-right font-semibold">{s.autoScore}/{analytics.exam.totalMarks}</td>
                        <td className="p-3 text-right font-bold">{s.percentage}%</td>
                        <td className="p-3 text-center">
                          <Badge className={s.grade === 'F' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'} variant="secondary">{s.grade}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <span className={cn('font-medium', s.correctedCount >= s.totalQuestions * 0.7 ? 'text-emerald-600' : 'text-amber-600')}>
                            {s.correctedCount}/{s.totalQuestions}
                          </span>
                        </td>
                        <td className="p-3 text-right text-muted-foreground text-xs">{fmtTime(s.timeTakenSeconds)}</td>
                        <td className="p-3 text-center">
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-blue-600"
                            onClick={() => setDrillDownStudent(s)}>
                            <Search className="size-3" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No students found</td></tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        {/* ═══════════ INSIGHTS TAB ═══════════ */}
        <TabsContent value="insights" className="space-y-4">
          {/* Subject Radar Chart (from actual subject breakdown data) */}
          {subjectBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="size-4 text-indigo-600" /> Subject Performance Radar
                </CardTitle>
                <CardDescription className="text-xs">
                  Class average score across subjects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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
                {subjectBreakdown.length > 1 && (
                  <div className="flex flex-wrap gap-2 mt-3 justify-center">
                    {subjectBreakdown.map((sb: any) => (
                      <Badge key={sb.subjectId} variant="outline" className={cn('text-[10px]', getMasteryBadgeClass(getMasteryLevel(sb.percentage)))}>
                        {sb.subjectName}: {fmtPct(sb.percentage)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {!subjectBreakdown.length && e?.subject?.name && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="size-4 text-indigo-600" /> Overall Performance Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={[
                    { subject: 'Class Avg', score: Math.round(cs.classAverage), fullMark: 100 },
                    { subject: 'Pass Rate', score: Math.round(cs.passRate), fullMark: 100 },
                    { subject: 'Highest', score: Math.round(cs.highestScore), fullMark: 100 },
                    { subject: 'Median', score: Math.round(cs.medianScore), fullMark: 100 },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Time vs Performance */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="size-3.5" /> Time vs Performance</CardTitle></CardHeader>
              <CardContent>
                {analytics.studentPerformance.filter((s: any) => s.timeTakenSeconds).length > 2 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="timeTakenSeconds" name="Time (s)" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="percentage" name="Score %" domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number, name: string) => [name === 'timeTakenSeconds' ? fmtTime(v) : `${v}%`, name === 'timeTakenSeconds' ? 'Time' : 'Score']} />
                        <Scatter data={analytics.studentPerformance.filter((s: any) => s.timeTakenSeconds)} fill="#059669" opacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Time-Score correlation: <span className={cn('font-semibold', Math.abs(cs.timeScoreCorrelation) > 0.3 ? 'text-emerald-600' : '')}>
                        {fmtNum(cs.timeScoreCorrelation)}
                      </span>
                      {cs.timeScoreCorrelation > 0.3 ? ' (students who spent more time scored higher)' :
                       cs.timeScoreCorrelation < -0.3 ? ' (students who spent less time scored higher)' :
                       ' (no strong correlation)'}
                    </p>
                  </>
                ) : <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Not enough time data</div>}
              </CardContent>
            </Card>

            {/* Question Difficulty Distribution */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="size-3.5" /> Question Difficulty Distribution</CardTitle></CardHeader>
              <CardContent>
                {sortedQuestions.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={sortedQuestions.map((q: any) => ({
                        q: `Q${q.index}`,
                        difficulty: Math.round(q.difficulty.index * 100),
                        label: q.difficulty.label,
                      }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="q" tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Correct']} />
                        <Bar dataKey="difficulty" name="% Correct">
                          {sortedQuestions.map((_: any, i: number) => (
                            <Cell key={i} fill={
                              sortedQuestions[i].difficulty.correctPercentage >= 70 ? '#059669' :
                              sortedQuestions[i].difficulty.correctPercentage >= 40 ? '#F59E0B' : '#EF4444'
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-3 text-[10px] text-muted-foreground">
                      <span><span className="inline-block size-2 rounded bg-emerald-600 mr-1" />Easy (≥70%)</span>
                      <span><span className="inline-block size-2 rounded bg-amber-500 mr-1" />Medium (40-70%)</span>
                      <span><span className="inline-block size-2 rounded bg-red-500 mr-1" />Hard (&lt;40%)</span>
                    </div>
                  </>
                ) : <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No data</div>}
              </CardContent>
            </Card>
          </div>

          {/* Question Type Breakdown */}
          {analytics.questionTypeBreakdown?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="size-4 text-purple-600" /> Question Type Performance Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-3">Type</th>
                        <th className="pb-2 pr-3 text-right">Count</th>
                        <th className="pb-2 pr-3 text-right">Marks</th>
                        <th className="pb-2 pr-3 text-right">Avg Difficulty</th>
                        <th className="pb-2 pr-3 text-right">Discrimination</th>
                        <th className="pb-2 pr-3 text-right">Correct %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.questionTypeBreakdown.map((t: any) => (
                        <tr key={t.type} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 font-medium">{TYPE_LABELS[t.type] || t.type}</td>
                          <td className="py-1.5 pr-3 text-right">{t.questionCount}</td>
                          <td className="py-1.5 pr-3 text-right">{t.totalMarks}</td>
                          <td className="py-1.5 pr-3 text-right">{fmtNum(t.avgDifficulty, 3)}</td>
                          <td className="py-1.5 pr-3 text-right">{fmtNum(t.avgDiscrimination, 3)}</td>
                          <td className="py-1.5 pr-3 text-right font-semibold">{t.correctPercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subject-Specific Recommendations */}
          {subjectRecs.subjectRecommendations.filter(sr => sr.recommendations.length > 0).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="size-4 text-amber-600" /> Subject Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {subjectRecs.subjectRecommendations.filter(sr => sr.recommendations.length > 0).map(sr => (
                  <div key={sr.subjectId} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold">{sr.subjectName}</span>
                      <Badge variant="outline" className={cn('text-[10px]', getMasteryBadgeClass(getMasteryLevel(sr.percentage)))}>
                        {fmtPct(sr.percentage)}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {sr.recommendations.map((r, ri) => (
                        <div key={ri} className="flex items-start gap-2 text-xs">
                          <span className={cn(
                            'mt-0.5 size-4 rounded-full flex items-center justify-center text-white shrink-0',
                            r.type === 'danger' ? 'bg-red-500' : r.type === 'warning' ? 'bg-amber-500' : r.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500',
                          )}>!</span>
                          <div>
                            <p className="font-medium">{r.title}</p>
                            <p className="text-muted-foreground">{r.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Insights Panel */}
          <InsightsPanel
            title="Exam Performance Insights"
            averageScore={cs.classAverage}
            passRate={cs.passRate}
            totalStudents={analytics.totalStudents}
            strengths={(() => {
              const top = [...analytics.studentPerformance].sort((a: any, b: any) => b.percentage - a.percentage).slice(0, 3);
              return top.map((s: any) => ({ name: s.studentName, score: s.percentage, average: cs.classAverage }));
            })()}
            weaknesses={(() => {
              const bottom = [...analytics.studentPerformance].sort((a: any, b: any) => a.percentage - b.percentage).slice(0, 3);
              return bottom.map((s: any) => ({ name: s.studentName, score: s.percentage, average: cs.classAverage }));
            })()}
            recommendations={(() => {
              const recs: any[] = [...subjectRecs.generalRecommendations];
              const hardQ = sortedQuestions.filter((q: any) => q.difficulty.correctPercentage < 40);
              const poorDiscQ = sortedQuestions.filter((q: any) => q.discrimination.index < 0.2);
              const misconcQ = sortedQuestions.filter((q: any) => q.commonMisconception);
              if (hardQ.length > 0) recs.push({ type: 'danger' as const, title: `Challenging Questions (${hardQ.length})`, description: `Q${hardQ.map((q: any) => q.index).join(', ')} had fewer than 40% correct. Review these topics.` });
              if (poorDiscQ.length > 0) recs.push({ type: 'warning' as const, title: 'Poor Discrimination', description: `${poorDiscQ.length} question(s) with discrimination below 0.2 — they don't differentiate well.` });
              if (misconcQ.length > 0) recs.push({ type: 'info' as const, title: 'Common Misconceptions', description: misconcQ.map((q: any) => `Q${q.index}: "${q.commonMisconception.answer}"`).join('. ') });
              if (cs.timeScoreCorrelation > 0.3) recs.push({ type: 'success' as const, title: 'Time Management', description: 'Students who spent more time scored higher. Encourage thoroughness.' });
              if (cs.passRate < 50) recs.push({ type: 'danger' as const, title: 'Low Pass Rate', description: `Only ${cs.passRate.toFixed(1)}% passed. Consider intervention strategies.` });
              if (hardQ.length === 0 && poorDiscQ.length === 0 && misconcQ.length === 0 && cs.passRate >= 50) recs.push({ type: 'success' as const, title: 'Well-Designed Assessment', description: 'Questions are well-balanced with good psychometric properties.' });
              return recs;
            })()}
            topicBreakdown={(() => {
              const topics: any[] = [];
              for (const sb of subjectBreakdown) {
                for (const tb of sb.topicBreakdown || []) {
                  topics.push({ topic: `${sb.subjectName}: ${tb.topic}`, score: tb.percentage, totalMarks: tb.totalMarks || 0, totalQuestions: tb.totalQuestions, correctCount: tb.correctCount, masteryLevel: getMasteryLevel(tb.percentage) });
                }
              }
              return topics;
            })()}
            questionAnalysis={sortedQuestions.map((q: any) => ({
              questionNumber: q.index,
              questionText: q.questionText,
              type: q.type,
              marks: q.marks,
              correctRate: q.difficulty.correctPercentage,
              difficulty: q.difficulty.label,
              discrimination: q.discrimination.index,
              commonMisconception: q.commonMisconception || undefined,
              subjectId: q.subjectId,
              topic: q.topic,
            }))}
          />
        </TabsContent>
      </Tabs>

      {/* ── Student Drill-Down Dialog ── */}
      <Dialog open={!!drillDownStudent} onOpenChange={(o) => { if (!o) setDrillDownStudent(null); }}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <User className="size-4 text-emerald-600" />
              {drillDownStudent?.studentName} — Detailed Question Analysis
            </DialogTitle>
          </DialogHeader>
          <div className="px-2 sm:px-4 pb-4">
            <ScrollArea className="max-h-[calc(90vh-100px)]">
              {drillDownStudent && (
                <div className="space-y-4 p-4">
                  {/* Summary */}
                  <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-muted/30 text-sm">
                    <div><span className="text-muted-foreground">Rank:</span> <span className="font-bold">#{drillDownStudent.rank}</span></div>
                    <div><span className="text-muted-foreground">Score:</span> <span className="font-bold">{drillDownStudent.autoScore}/{analytics.exam.totalMarks}</span></div>
                    <div><span className="text-muted-foreground">Percentage:</span> <span className={cn('font-bold', drillDownStudent.percentage >= 70 ? 'text-emerald-600' : 'text-red-600')}>{fmtPct(drillDownStudent.percentage)}</span></div>
                    <div><span className="text-muted-foreground">Grade:</span> <Badge className={drillDownStudent.grade === 'F' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'} variant="secondary">{drillDownStudent.grade}</Badge></div>
                    <div><span className="text-muted-foreground">Correct:</span> <span className="font-bold">{drillDownStudent.correctedCount}/{drillDownStudent.totalQuestions}</span></div>
                    <div><span className="text-muted-foreground">Time:</span> <span className="font-bold">{fmtTime(drillDownStudent.timeTakenSeconds)}</span></div>
                  </div>

                  {/* Per-question cards */}
                  <div className="space-y-2">
                    {sortedQuestions.map((q: any) => {
                      const pq = drillDownStudent.perQuestion?.find((p: any) => p.questionId === q.questionId);
                      const isCorrect = pq?.isCorrect ?? false;
                      const studentAnswer = q.studentAnswers?.find((sa: any) => sa.studentId === drillDownStudent.studentId);
                      const classCorrectPct = q.difficulty.correctPercentage;
                      const comparedToClass = isCorrect ? 100 : 0;
                      const isAboveAvg = isCorrect && classCorrectPct < 100;

                      return (
                        <div key={q.questionId} className={cn(
                          'rounded-lg border p-3',
                          isCorrect ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'
                        )}>
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-full',
                              isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            )}>
                              {isCorrect ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <p className="text-sm font-medium">Q{q.index}. {q.questionText}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-[10px] px-1.5">{TYPE_LABELS[q.type] || q.type}</Badge>
                                <span>{pq?.marksAwarded ?? 0}/{q.marks} marks</span>
                              </div>

                              {/* Answer comparison */}
                              {q.type !== 'ESSAY' && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="rounded-md bg-white border p-2">
                                    <p className="font-medium text-muted-foreground mb-0.5">Student's Answer</p>
                                    <p className={isCorrect ? 'text-emerald-700' : 'text-red-700'}>
                                      {studentAnswer?.answerFormatted || <span className="italic">Not answered</span>}
                                    </p>
                                  </div>
                                  <div className={cn('rounded-md border p-2', !isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-white')}>
                                    <p className="font-medium text-muted-foreground mb-0.5">Correct Answer</p>
                                    <p className={!isCorrect ? 'text-emerald-700 font-medium' : ''}>{q.correctAnswerFormatted}</p>
                                  </div>
                                </div>
                              )}

                              {q.type === 'ESSAY' && (
                                <div className="text-xs rounded-md bg-white border p-2">
                                  <p className="font-medium text-muted-foreground mb-0.5">Student's Answer</p>
                                  <p className="whitespace-pre-wrap">{studentAnswer?.answerFormatted || <span className="italic">Not answered</span>}</p>
                                </div>
                              )}

                              {/* Comparison to class */}
                              <div className="flex items-center gap-3 text-[10px]">
                                <span className="text-muted-foreground">Class: {fmtPct(classCorrectPct)} correct</span>
                                {isAboveAvg && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200">
                                    Above class average
                                  </Badge>
                                )}
                                {!isCorrect && classCorrectPct > 50 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 bg-amber-100 text-amber-700 border-amber-200">
                                    Most classmates got this right
                                  </Badge>
                                )}
                              </div>

                              {q.explanation && (
                                <div className={cn('rounded-md border p-2 text-xs', isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
                                  <p className={cn('font-medium mb-0.5', isCorrect ? 'text-emerald-700' : 'text-amber-700')}>
                                    {isCorrect ? 'Explanation' : 'Why this is wrong'}
                                  </p>
                                  <p className={isCorrect ? 'text-emerald-600' : 'text-amber-600'}>{q.explanation}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
