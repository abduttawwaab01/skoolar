'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/shared/kpi-card';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  BookOpen, Users, Award, TrendingUp, AlertTriangle,
  ArrowLeft, BarChart3, PieChart as PieChartIcon, Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const MASTERY_COLORS: Record<string, string> = {
  mastered: '#059669', advanced: '#2563eb', intermediate: '#d97706', beginner: '#dc2626',
};

interface Props {
  planId: string;
  onBack?: () => void;
}

export function LessonPlanAnalyticsView({ planId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [studentSearch, setStudentSearch] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/lesson-plans/${planId}/analytics`);
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      toast.error('Failed to load lesson plan analytics');
    } finally {
      setLoading(false);
    }
  }, [planId]);

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

  const { lessonPlan, overview, masteryDistribution, perQuestionAnalytics, perStudentPerformance } = data;

  const overviewCards = [
    { title: 'Total Students', value: overview.totalStudents, icon: Users, iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: 'Total Attempts', value: overview.totalAttempts, icon: BookOpen, iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { title: 'Completed', value: overview.completedAttempts, icon: Award, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { title: 'Avg Score', value: `${overview.averageScore}`, icon: TrendingUp, iconBgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
  ];

  const masteryData = Object.entries(masteryDistribution || {}).map(([name, value]) => ({ name, value }));
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
              {lessonPlan?.topic || 'Lesson Plan Analytics'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lessonPlan?.questionCount} questions · {overview.totalStudents} students
            </p>
          </div>
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
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChartIcon className="size-4" /> Mastery Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {masteryData.every(d => d.value === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No completed attempts yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={masteryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                        {masteryData.map((entry) => (
                          <Cell key={entry.name} fill={MASTERY_COLORS[entry.name] || '#9ca3af'} />
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
              <CardHeader><CardTitle className="text-sm">Key Statistics</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Average Score</span><span className="font-semibold">{overview.averageScore}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Total Possible</span><span className="font-semibold">{overview.totalPossible}</span></div>
                  <div className="flex justify-between py-2"><span className="text-muted-foreground">Status</span><Badge variant={lessonPlan?.status === 'published' ? 'default' : 'secondary'}>{lessonPlan?.status}</Badge></div>
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
                <Card key={q.questionIndex}>
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
                        <p className="text-xs text-muted-foreground mt-1">Attempt #{s.attemptNumber} · {new Date(s.completedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">{s.score}/{s.totalMarks}</span>
                        <div className="flex items-center gap-1 mt-1">
                          {s.masteryLevel && (
                            <Badge className={
                              s.masteryLevel === 'mastered' ? 'bg-emerald-100 text-emerald-700 text-[10px]' :
                              s.masteryLevel === 'advanced' ? 'bg-blue-100 text-blue-700 text-[10px]' :
                              s.masteryLevel === 'intermediate' ? 'bg-amber-100 text-amber-700 text-[10px]' :
                              'bg-red-100 text-red-700 text-[10px]'
                            }>
                              {s.masteryLevel}
                            </Badge>
                          )}
                          {s.passed && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Passed</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
