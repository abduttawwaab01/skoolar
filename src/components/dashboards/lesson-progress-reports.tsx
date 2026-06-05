'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, Users, CheckCircle2, AlertTriangle, TrendingUp, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

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
          </Tabs>
        </>
      )}
    </div>
  );
}
