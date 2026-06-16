'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, Users, CheckCircle2, AlertTriangle, TrendingUp, Eye, Brain, Target, Award } from 'lucide-react';
import { ExportMenu } from '@/components/shared/export-menu';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { SendToParent } from '@/components/shared/send-to-parent';
import { InsightsPanel } from '@/components/shared/insights-panel';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface StudentReport {
  studentName: string;
  admissionNo: string;
  className: string;
  progress: number;
  completed: boolean;
  lastWatched: string | null;
  checkpoints: { id: string; question: string; timestamp: number; correct: boolean; answered: boolean }[];
  quizScore: number | null;
  quizTotal: number | null;
  quizPassed: boolean | null;
}

interface CheckpointPassRate {
  checkpointId: string;
  question: string;
  timestamp: number;
  totalAnswers: number;
  correctCount: number;
  passRate: number;
}

export function LessonProgressReports() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';

  const [lessons, setLessons] = useState<{ id: string; title: string; duration: number }[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [report, setReport] = useState<{
    lesson: { id: string; title: string; duration: number };
    summary: { totalStudents: number; completedCount: number; completionRate: number; avgProgress: number };
    checkpointPassRates: CheckpointPassRate[];
    students: StudentReport[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(true);

  // Load lessons
  useEffect(() => {
    if (!schoolId) { setLoadingLessons(false); return; }
    fetch(`/api/video-lessons?schoolId=${schoolId}&limit=100`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => {
        const items = json.data || [];
        setLessons(items.map((l: Record<string, unknown>) => ({ id: l.id as string, title: l.title as string, duration: (l.duration as number) || 0 })));
      })
      .catch(() => {})
      .finally(() => setLoadingLessons(false));
  }, [schoolId]);

  const fetchReport = useCallback(async () => {
    if (!selectedLessonId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/lesson-progress?lessonId=${selectedLessonId}&schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json();
      setReport(json.data || json);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedLessonId, schoolId]);

  useEffect(() => {
    if (selectedLessonId) fetchReport();
    else setReport(null);
  }, [selectedLessonId, fetchReport]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const insightsData = useMemo(() => {
    if (!report) return null;
    const students = report.students || [];
    const sortedByProgress = [...students].sort((a, b) => b.progress - a.progress);
    const topStudents = sortedByProgress.slice(0, 3);
    const bottomStudents = sortedByProgress.slice(-3).reverse();

    const strengths = topStudents.map(s => ({
      name: s.studentName,
      score: s.progress,
      average: report.summary.avgProgress,
    }));

    const weaknesses = bottomStudents.map(s => ({
      name: s.studentName,
      score: s.progress,
      average: report.summary.avgProgress,
    }));

    const recommendations: any[] = [];
    if (report.summary.completionRate < 50) {
      recommendations.push({ type: 'warning' as const, title: 'Low Completion Rate', description: `Only ${report.summary.completionRate}% of students completed this lesson.` });
    }
    if (report.summary.avgProgress < 50) {
      recommendations.push({ type: 'danger' as const, title: 'Low Average Progress', description: `Average progress is only ${report.summary.avgProgress}%. Consider breaking the lesson into shorter segments.` });
    }
    const lowCheckpoints = report.checkpointPassRates.filter(c => c.passRate < 40);
    if (lowCheckpoints.length > 0) {
      recommendations.push({ type: 'warning' as const, title: `Challenging Checkpoints (${lowCheckpoints.length})`, description: `${lowCheckpoints.length} checkpoint(s) had pass rates below 40%. Review these concepts.` });
    }
    if (report.summary.completionRate >= 80 && report.summary.avgProgress >= 80) {
      recommendations.push({ type: 'success' as const, title: 'High Engagement', description: 'Students are highly engaged with this lesson content.' });
    }

    return { strengths, weaknesses, recommendations, averageScore: report.summary.avgProgress };
  }, [report]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-600" />
            Lesson Progress Reports
          </h2>
          <p className="text-sm text-gray-500">
            Track student engagement and checkpoint mastery per lesson
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedLessonId && (
            <SendToParent
              endpoint={`/api/video-lessons/${selectedLessonId}/send-to-parent`}
              label="Send to Parents"
              variant="outline"
              size="sm"
              assessmentName={report?.lesson?.title}
            />
          )}
          <ExportMenu options={{
            title: 'Lesson Progress Reports',
            subtitle: `Students: ${report?.summary?.totalStudents || 0}`,
            fileName: 'lesson-progress-reports',
            summaryRows: [
              { label: 'Students', value: `${report?.summary?.totalStudents || 0}` },
              { label: 'Avg Progress', value: `${report?.summary?.avgProgress || 0}%` },
              { label: 'Completed', value: `${report?.summary?.completedCount || 0}/${report?.summary?.totalStudents || 0}` },
            ],
          }} />
          <div className="w-full md:w-72">
            <Select value={selectedLessonId} onValueChange={setSelectedLessonId} disabled={loadingLessons}>
            <SelectTrigger>
              <SelectValue placeholder={loadingLessons ? 'Loading lessons...' : 'Select a lesson'} />
            </SelectTrigger>
            <SelectContent>
              {lessons.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        </div>
      </div>

      {!selectedLessonId && !loadingLessons && (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Select a lesson to view its progress report</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {report && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{report.summary.totalStudents}</p>
                  <p className="text-xs text-gray-500">Students</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{report.summary.avgProgress}%</p>
                  <p className="text-xs text-gray-500">Avg Progress</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{report.summary.completedCount}/{report.summary.totalStudents}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{report.summary.completionRate}%</p>
                  <p className="text-xs text-gray-500">Completion Rate</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="students">
            <TabsList>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="checkpoints">Checkpoint Analysis</TabsTrigger>
              <TabsTrigger value="insights" className="flex items-center gap-1.5">
                <Brain className="size-3.5" /> Insights
              </TabsTrigger>
            </TabsList>

            {/* Students Tab */}
            <TabsContent value="students" className="space-y-3">
              {report.students.length === 0 ? (
                <p className="text-center py-8 text-gray-400">No student activity recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 px-2">Student</th>
                        <th className="py-2 px-2">Class</th>
                        <th className="py-2 px-2">Progress</th>
                        <th className="py-2 px-2">Checkpoints</th>
                        <th className="py-2 px-2">Quiz</th>
                        <th className="py-2 px-2">Last Watched</th>
                        <th className="py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.students.map((s, i) => {
                        const answered = s.checkpoints.filter(c => c.answered).length;
                        const correct = s.checkpoints.filter(c => c.correct).length;
                        return (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2 font-medium">{s.studentName}</td>
                            <td className="py-2 px-2 text-gray-500">{s.className}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <Progress value={s.progress} className="h-2 w-20" />
                                <span className="text-xs">{s.progress}%</span>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <span className={`text-xs font-medium ${correct > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {correct}/{answered} correct
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              {s.quizTotal ? (
                                <Badge variant={s.quizPassed ? 'default' : 'destructive'} className="text-xs">
                                  {s.quizScore}/{s.quizTotal}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-500">{formatTime(s.lastWatched)}</td>
                            <td className="py-2 px-2">
                              {s.completed ? (
                                <Badge className="bg-emerald-600 text-xs">Done</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">In Progress</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Checkpoints Tab */}
            <TabsContent value="checkpoints" className="space-y-3">
              {report.checkpointPassRates.length === 0 ? (
                <p className="text-center py-8 text-gray-400">No checkpoints defined for this lesson</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 px-2">#</th>
                        <th className="py-2 px-2">Timestamp</th>
                        <th className="py-2 px-2">Question</th>
                        <th className="py-2 px-2">Answers</th>
                        <th className="py-2 px-2">Correct</th>
                        <th className="py-2 px-2">Pass Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.checkpointPassRates.map((cp, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2">{i + 1}</td>
                          <td className="py-2 px-2 text-xs text-gray-500">
                            {Math.floor(cp.timestamp / 60)}:{String(cp.timestamp % 60).padStart(2, '0')}
                          </td>
                          <td className="py-2 px-2 max-w-xs truncate">{cp.question}</td>
                          <td className="py-2 px-2">{cp.totalAnswers}</td>
                          <td className="py-2 px-2">{cp.correctCount}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Progress value={cp.passRate} className={`h-2 w-16 ${cp.passRate >= 60 ? 'bg-emerald-100' : 'bg-red-100'}`} />
                              <span className={`text-xs font-medium ${cp.passRate >= 60 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {cp.passRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-4">
              {report.checkpointPassRates.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="size-4 text-indigo-600" /> Checkpoint Pass Rates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={report.checkpointPassRates.map((cp, i) => ({
                        name: `CP${i + 1}`,
                        rate: cp.passRate,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip formatter={(val: number) => [`${val}%`, 'Pass Rate']} />
                        <Bar dataKey="rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Progress Distribution Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="size-4 text-emerald-600" /> Student Progress Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={(() => {
                      const ranges = [
                        { range: '0-20%', count: 0 }, { range: '21-40%', count: 0 },
                        { range: '41-60%', count: 0 }, { range: '61-80%', count: 0 },
                        { range: '81-100%', count: 0 },
                      ];
                      report.students.forEach((s: StudentReport) => {
                        if (s.progress <= 20) ranges[0].count++;
                        else if (s.progress <= 40) ranges[1].count++;
                        else if (s.progress <= 60) ranges[2].count++;
                        else if (s.progress <= 80) ranges[3].count++;
                        else ranges[4].count++;
                      });
                      return ranges;
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {insightsData && (
                <InsightsPanel
                  title="Lesson Engagement Insights"
                  averageScore={insightsData.averageScore}
                  passRate={report.summary.completionRate}
                  totalStudents={report.summary.totalStudents}
                  strengths={insightsData.strengths}
                  weaknesses={insightsData.weaknesses}
                  recommendations={insightsData.recommendations}
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
