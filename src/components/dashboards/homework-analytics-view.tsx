'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/shared/kpi-card';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  BookOpen, Users, Award, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, ArrowLeft, BarChart3, PieChart as PieChartIcon, Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

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

  const { homework, overview, gradeDistribution, scoreDistribution, perQuestionAnalytics, perStudentPerformance, submissionTimeline } = data;

  const overviewCards = [
    { title: 'Total Students', value: overview.totalStudents, icon: Users, iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: 'Graded', value: overview.gradedCount, icon: Award, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { title: 'Avg Score', value: `${overview.averageScore}/${overview.totalPossible}`, icon: TrendingUp, iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { title: 'Pass Rate', value: `${overview.passRate}%`, icon: CheckCircle2, iconBgColor: overview.passRate >= 50 ? 'bg-emerald-100' : 'bg-red-100', iconColor: overview.passRate >= 50 ? 'text-emerald-600' : 'text-red-600' },
  ];

  const gradeDistData = Object.entries(gradeDistribution).map(([name, value]) => ({ name, value }));
  const scoreDistData = Object.entries(scoreDistribution).map(([range, count]) => ({ range, count }));
  const timelineData = Object.entries(submissionTimeline).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  const filteredStudents = perStudentPerformance.filter((s: any) =>
    !studentSearch || s.studentName.toLowerCase().includes(studentSearch.toLowerCase()) || s.admissionNo.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
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
              {homework.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {homework.subject?.name && `${homework.subject.name} · `}
              {homework.class?.name && `${homework.class.name} · `}
              {homework.questionsCount} questions · {homework.totalMarks} marks
            </p>
          </div>
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
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Highest Score</span><span className="font-semibold text-emerald-600">{overview.highestScore}/{overview.totalPossible}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Lowest Score</span><span className="font-semibold text-red-600">{overview.lowestScore}/{overview.totalPossible}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Average Score</span><span className="font-semibold">{overview.averageScore}/{overview.totalPossible}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Pass Rate</span><span className="font-semibold">{overview.passRate}% ({overview.passedCount}/{overview.gradedCount})</span></div>
                  <div className="flex justify-between py-2"><span className="text-muted-foreground">Total Submissions</span><span className="font-semibold">{overview.totalStudents}</span></div>
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
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Status</span><Badge variant={homework.status === 'active' ? 'default' : 'secondary'}>{homework.status}</Badge></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Questions</span><span className="font-semibold">{homework.questionsCount}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Total Marks</span><span className="font-semibold">{homework.totalMarks}</span></div>
                  <div className="flex justify-between py-2"><span className="text-muted-foreground">Due Date</span><span className="font-semibold">{new Date(homework.dueDate).toLocaleDateString()}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── QUESTIONS TAB ─── */}
        <TabsContent value="questions" className="space-y-4 mt-4">
          {perQuestionAnalytics.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center"><BookOpen className="size-12 text-muted-foreground mx-auto mb-4" /><h3 className="font-semibold">No Questions</h3><p className="text-sm text-muted-foreground mt-1">This homework has no questions configured.</p></CardContent>
            </Card>
          ) : (
            perQuestionAnalytics.map((q: any, idx: number) => {
              const distEntries = Object.entries(q.answerDistribution).sort(([, a], [, b]) => (b as number) - (a as number));
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
            <span className="text-sm text-muted-foreground">{filteredStudents.length} of {perStudentPerformance.length} students</span>
          </div>

          {perQuestionAnalytics.length > 0 && (
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
                      {perQuestionAnalytics.map((q: any, i: number) => (
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
                        {perQuestionAnalytics.map((q: any) => {
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
      </Tabs>
    </div>
  );
}
