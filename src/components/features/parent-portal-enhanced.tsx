'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users, MessageSquare, Wallet, BarChart3, GraduationCap,
  CreditCard, Calendar, CheckCircle, TrendingUp, TrendingDown,
  FileText, Star, AlertCircle, Loader2, BookOpen, Award, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

interface ChildData {
  id: string;
  admissionNo: string;
  user: { name: string | null; email: string | null; avatar: string | null };
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  gpa: number | null;
  behaviorScore: number | null;
}

interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  isPublished: boolean;
  createdAt: string;
}

interface HomeworkData {
  id: string;
  title: string;
  subject: { name: string } | null;
  class: { name: string } | null;
  dueDate: string;
  totalMarks: number;
  status: string;
  _count: { submissions: number };
  submissions: Array<{
    id: string;
    status: string;
    score: number | null;
    grade: string | null;
    teacherComment: string | null;
    submittedAt: string | null;
  }>;
}

interface AttendanceRecord {
  date: string;
  status: string;
}

interface GpaTrendItem {
  termName: string;
  gpa: number | null;
  average: number | null;
}

interface ParentAnalyticsData {
  attendance: { present: number; absent: number; late: number; total: number; rate: number };
  gpaTrend: GpaTrendItem[];
  behaviorScore: number;
  subjectAnalysis: Array<{
    subjectName: string;
    studentAverage: number;
    classAverage: number;
    difference: number;
    comparison: string;
    examsTaken: number;
  }>;
  academicPerformance: { gpa: number; cumulativeGpa: number; ranking: { classRank: number; totalInClass: number; percentile: number } };
  weeklyEvaluation: { averageScore: number; trend: string } | null;
}

export default function ParentPortalEnhanced() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;
  const parentId = currentUser.id;

  const [children, setChildren] = useState<ChildData[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [homework, setHomework] = useState<HomeworkData[]>([]);
  const [analytics, setAnalytics] = useState<ParentAnalyticsData | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedChild, setSelectedChild] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    if (!schoolId) {
      setError('No school selected');
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      setIsLoading(true);
      const [parentStudentsRes, announcementsRes] = await Promise.all([
        parentId ? fetch(`/api/parent-students?parentId=${parentId}`) : Promise.resolve(null),
        fetch(`/api/announcements?schoolId=${schoolId}&limit=10&isPublished=true`),
      ]);

      if (parentStudentsRes && parentStudentsRes.ok) {
        const parentJson = await parentStudentsRes.json();
        if (parentJson.data) {
          setChildren(parentJson.data);
          if (parentJson.data.length > 0 && !selectedChild) {
            setSelectedChild(parentJson.data[0].id);
          }
        }
      }

      if (announcementsRes.ok) {
        const annJson = await announcementsRes.json();
        if (annJson.data) {
          setAnnouncements(annJson.data);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, parentId, selectedChild]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch analytics for selected child
  useEffect(() => {
    if (!selectedChild) return;
    const fetchAnalytics = async () => {
      try {
        const [analyticsRes, attendanceRes] = await Promise.all([
          fetch(`/api/parent-analytics?studentId=${selectedChild}`),
          fetch(`/api/attendance?studentId=${selectedChild}&limit=60`),
        ]);
        if (analyticsRes.ok) {
          const json = await analyticsRes.json();
          if (json.data) setAnalytics(json.data);
        }
        if (attendanceRes.ok) {
          const json = await attendanceRes.json();
          const records: AttendanceRecord[] = (json.data || []).map((r: { date: string; status: string }) => ({
            date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            status: r.status,
          }));
          setAttendanceRecords(records.slice(-30));
        }
      } catch {
        // skip
      }
    };
    fetchAnalytics();
  }, [selectedChild]);

  // Fetch homework for selected child
  useEffect(() => {
    if (!schoolId || !selectedChild) return;
    const fetchHomework = async () => {
      try {
        const res = await fetch(`/api/homework?schoolId=${schoolId}&studentId=${selectedChild}&includeSubmissions=true&limit=20`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) setHomework(json.data);
        }
      } catch {
        // skip
      }
    };
    fetchHomework();
  }, [schoolId, selectedChild]);

  const selectedChildData = children.find(c => c.id === selectedChild);

  const gpaTrend = analytics?.gpaTrend || [];

  const subjectColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#6366f1'];

  const pendingHomework = homework.filter(h => {
    if (!h.submissions || h.submissions.length === 0) return true;
    return h.submissions[0]?.status !== 'submitted' && h.submissions[0]?.status !== 'graded';
  }).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Users className="h-6 w-6 text-orange-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Parent Portal</h2>
            <p className="text-sm text-gray-500">Monitor your child&apos;s academic progress and school activities</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchData} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Users className="h-6 w-6 text-orange-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Parent Portal</h2>
            <p className="text-sm text-gray-500">Monitor your child&apos;s academic progress and school activities</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No children linked to your account yet. Please contact the school administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentGPA = analytics?.academicPerformance?.gpa || selectedChildData?.gpa || 0;
  const attendanceRate = analytics?.attendance?.rate || 0;
  const behaviorScore = analytics?.behaviorScore || selectedChildData?.behaviorScore || 0;
  const classRank = analytics?.academicPerformance?.ranking?.classRank;
  const totalInClass = analytics?.academicPerformance?.ranking?.totalInClass;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Users className="h-6 w-6 text-orange-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Parent Portal</h2>
            <p className="text-sm text-gray-500">Monitor your child&apos;s academic progress and school activities</p>
          </div>
        </div>

        {/* Children Selector */}
        <div className="flex gap-2">
          {children.map(child => (
            <Button
              key={child.id}
              variant={selectedChild === child.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedChild(child.id)}
              className="gap-2"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{(child.user.name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
              </Avatar>
              {(child.user.name || 'Student').split(' ')[0]}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-gray-500">Current GPA</span>
            </div>
            <p className="text-2xl font-bold">{currentGPA > 0 ? currentGPA.toFixed(1) : 'N/A'}</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <TrendingUp className="h-3 w-3" />
              {classRank ? `Rank #${classRank}${totalInClass ? ` of ${totalInClass}` : ''}` : selectedChildData?.class?.name || ''}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-500">Attendance</span>
            </div>
            <p className="text-2xl font-bold">{attendanceRate > 0 ? `${attendanceRate}%` : 'N/A'}</p>
            <div className="flex items-center gap-1 text-xs mt-1">
              {attendanceRate >= 90 ? (
                <span className="text-emerald-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Excellent</span>
              ) : attendanceRate >= 75 ? (
                <span className="text-amber-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Good</span>
              ) : attendanceRate > 0 ? (
                <span className="text-red-600 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Needs improvement</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-gray-500">Pending Homework</span>
            </div>
            <p className="text-2xl font-bold">{pendingHomework}</p>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
              {pendingHomework > 0 ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
              {pendingHomework > 0 ? `${pendingHomework} pending` : 'All done'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-gray-500">Behavior</span>
            </div>
            <p className="text-2xl font-bold">{behaviorScore > 0 ? `${behaviorScore}/100` : 'N/A'}</p>
            <div className="flex items-center gap-1 text-xs mt-1">
              {behaviorScore >= 90 ? (
                <span className="text-emerald-600"><TrendingUp className="h-3 w-3 inline" /> Excellent</span>
              ) : behaviorScore >= 75 ? (
                <span className="text-amber-600"><TrendingUp className="h-3 w-3 inline" /> Good</span>
              ) : behaviorScore > 0 ? (
                <span className="text-red-600"><TrendingDown className="h-3 w-3 inline" /> Needs attention</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Progress</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Announcements</TabsTrigger>
          <TabsTrigger value="homework" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Homework</TabsTrigger>
        </TabsList>

        {/* Progress Reports */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GPA Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">GPA Trend</CardTitle>
                <CardDescription>Academic performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                {gpaTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={gpaTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="termName" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 5]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="gpa" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">No GPA data available yet</div>
                )}
              </CardContent>
            </Card>

            {/* Attendance Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance (Last 30 Days)</CardTitle>
                <CardDescription>
                  <span className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500" /> Present</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-400" /> Absent</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-400" /> Late</span>
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {attendanceRecords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {attendanceRecords.map((day, i) => (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-sm flex items-center justify-center text-xs font-medium ${
                          day.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                          day.status === 'late' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}
                        title={`${day.date}: ${day.status}`}
                      >
                        {day.date.split(' ')[1]}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">No attendance records available yet</div>
                )}
              </CardContent>
            </Card>

            {/* Subject Analysis / Performance by Subject */}
            {analytics?.subjectAnalysis && analytics.subjectAnalysis.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Performance by Subject</CardTitle>
                  <CardDescription>Comparison with class average</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.subjectAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subjectName" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="studentAverage" name="Student Avg" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="classAverage" name="Class Avg" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Behavior Score */}
            {behaviorScore > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Behavior & Conduct</CardTitle>
                  <CardDescription>Overall behavior assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="relative size-32">
                      <svg className="size-32 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke={behaviorScore >= 90 ? '#10b981' : behaviorScore >= 75 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${behaviorScore}, 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold">{behaviorScore}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Star className="size-4 text-purple-500" />
                        <span className="text-sm font-medium">
                          {behaviorScore >= 90 ? 'Excellent Conduct' : behaviorScore >= 75 ? 'Good Conduct' : behaviorScore >= 60 ? 'Fair Conduct' : 'Needs Improvement'}
                        </span>
                      </div>
                      <Progress value={behaviorScore} className="h-2 w-48" />
                      <p className="text-xs text-gray-400">Overall behavior rating based on school records</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Announcements */}
        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">School Announcements</CardTitle>
              <CardDescription>Latest announcements from the school</CardDescription>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No announcements yet.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-4">
                    {announcements.map(ann => (
                      <div key={ann.id} className="p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{ann.title}</p>
                            <p className="text-xs text-gray-400">{new Date(ann.createdAt).toLocaleDateString()}</p>
                          </div>
                          <Badge variant={
                            ann.priority === 'urgent' ? 'destructive' :
                            ann.priority === 'high' ? 'default' : 'secondary'
                          } className="text-xs">
                            {ann.priority || 'normal'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Homework */}
        <TabsContent value="homework">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Child&apos;s Homework</CardTitle>
              <CardDescription>Homework assignments and submissions for {selectedChildData?.user?.name || 'your child'}</CardDescription>
            </CardHeader>
            <CardContent>
              {homework.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No homework assigned yet.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-3">
                    {homework.map(hw => {
                      const submission = hw.submissions && hw.submissions.length > 0 ? hw.submissions[0] : null;
                      const isOverdue = new Date(hw.dueDate) < new Date() && (!submission || submission.status !== 'graded');
                      return (
                        <div key={hw.id} className={`p-4 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">{hw.title}</p>
                              <p className="text-xs text-gray-400">
                                {hw.subject?.name || 'No Subject'} &bull; {hw.class?.name || ''} &bull; Due: {new Date(hw.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={
                              submission?.status === 'graded' ? 'default' :
                              submission?.status === 'submitted' ? 'secondary' :
                              isOverdue ? 'destructive' : 'outline'
                            } className="text-xs">
                              {submission?.status === 'graded' ? 'Graded' :
                               submission?.status === 'submitted' ? 'Submitted' :
                               isOverdue ? 'Overdue' : 'Pending'}
                            </Badge>
                          </div>
                          {submission && (
                            <div className="text-xs text-gray-500 mt-2">
                              {submission.score !== null && <span>Score: {submission.score}/{hw.totalMarks}</span>}
                              {submission.grade && <span> &bull; Grade: {submission.grade}</span>}
                              {submission.teacherComment && <p className="mt-1 italic">Teacher: {submission.teacherComment}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
