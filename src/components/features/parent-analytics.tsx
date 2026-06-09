'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, TrendingDown, Minus, Award, BookOpen, Target, 
  Calendar, Star, ArrowUp, ArrowDown, Users, BarChart3,
  GraduationCap, Activity, Crown, Medal
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { ExportMenu } from '@/components/shared/export-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SubjectAnalysis {
  subjectName: string;
  studentAverage: number;
  classAverage: number;
  difference: number;
  comparison: 'above' | 'below' | 'average';
  examsTaken: number;
}

interface GpaTrend {
  termId: string;
  termName: string;
  gpa: number | null;
  average: number | null;
}

interface ParentAnalyticsData {
  student: {
    id: string;
    name: string;
    avatar: string | null;
    class: string;
    level: string;
    section: string | null;
    schoolName: string;
  };
  currentTerm: { id: string; name: string } | null;
  academicPerformance: {
    gpa: number;
    cumulativeGpa: number;
    ranking: {
      classRank: number | null;
      totalInClass: number;
      percentile: number;
      position: number;
    };
  };
  subjectAnalysis: SubjectAnalysis[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    rate: number;
  };
  gpaTrend: GpaTrend[];
  weeklyEvaluation: {
    averageScore: number;
    latestWeek: string | null;
    trend: 'improving' | 'declining' | 'stable';
  } | null;
  behaviorScore: number;
  achievements: Array<{
    id: string;
    title: string;
    type: string;
    date: Date | null;
    badgeIcon: string | null;
  }>;
}

export function ParentAnalytics() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ParentAnalyticsData | null>(null);
  const [children, setChildren] = useState<Array<{id: string; name: string}>>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  useEffect(() => {
    fetchChildren();
  }, [schoolId]);

  useEffect(() => {
    if (selectedChildId) {
      fetchAnalytics(selectedChildId);
    }
  }, [selectedChildId]);

  async function fetchChildren() {
    try {
      const res = await fetch(`/api/parent/children?schoolId=${schoolId}`);
      if (res.ok) {
        const json = await res.json();
        const childList = json.data || json || [];
        setChildren(childList);
        if (childList.length > 0 && !selectedChildId) {
          setSelectedChildId(childList[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch children:', error);
    }
  }

  async function fetchAnalytics(studentId: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/parent-analytics?studentId=${studentId}&schoolId=${schoolId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || json);
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to fetch analytics');
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-20 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  const { student, academicPerformance, subjectAnalysis, attendance, gpaTrend, weeklyEvaluation, behaviorScore, achievements } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="size-6 text-emerald-600" />
            Parent Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            {student?.name ? `Viewing analytics for ${student.name}` : 'Student performance overview'}
          </p>
        </div>
        <ExportMenu options={{
          title: 'Parent Analytics',
          subtitle: student?.name || 'Student Performance',
          fileName: `parent_analytics_${student?.name?.replace(/\s+/g, '_') || 'student'}`,
          summaryRows: [
            { label: 'GPA', value: `${academicPerformance.gpa.toFixed(1)}/5.0` },
            { label: 'Rank', value: `${academicPerformance.ranking.position}/${academicPerformance.ranking.totalInClass}` },
            { label: 'Attendance', value: `${(attendance.rate * 100).toFixed(0)}%` },
            { label: 'Behavior', value: `${behaviorScore}/100` },
          ],
        }} />
      </div>
      {/* Child Selector */}
      {children.length > 1 && (
        <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="font-medium">Viewing Analytics for:</span>
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger className="w-full sm:w-64 bg-white/20 border-white/30 text-white">
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map(child => (
                    <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-blue-100 text-sm font-medium">Current GPA</p>
                <p className="text-3xl font-bold mt-1">{academicPerformance.gpa.toFixed(1)}</p>
                <p className="text-blue-100 text-xs mt-1">out of 5.0</p>
              </div>
              <GraduationCap className="h-12 w-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-purple-100 text-sm font-medium">Class Rank</p>
                <p className="text-3xl font-bold mt-1">
                  {academicPerformance.ranking.position}
                  <span className="text-lg text-purple-200">/{academicPerformance.ranking.totalInClass}</span>
                </p>
                <p className="text-purple-100 text-xs mt-1">Top {academicPerformance.ranking.percentile}%</p>
              </div>
              <Crown className="h-12 w-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Attendance</p>
                <p className="text-3xl font-bold mt-1">{attendance.rate}%</p>
                <p className="text-emerald-100 text-xs mt-1">{attendance.present} of {attendance.total} days</p>
              </div>
              <Calendar className="h-12 w-12 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-amber-100 text-sm font-medium">Behavior</p>
                <p className="text-3xl font-bold mt-1">{behaviorScore}</p>
                <p className="text-amber-100 text-xs mt-1">out of 100</p>
              </div>
              <Target className="h-12 w-12 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="subjects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subjects">Subject Performance</TabsTrigger>
          <TabsTrigger value="progress">Academic Progress</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Subject Performance Analysis
              </CardTitle>
              <CardDescription>
                Compare {student.name}'s performance in each subject against class average
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subjectAnalysis.map((subject, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{subject.subjectName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={subject.comparison === 'above' ? 'default' : subject.comparison === 'below' ? 'destructive' : 'secondary'}>
                            {subject.comparison === 'above' && <ArrowUp className="h-3 w-3 mr-1" />}
                            {subject.comparison === 'below' && <ArrowDown className="h-3 w-3 mr-1" />}
                            {subject.difference > 0 ? `+${subject.difference}%` : subject.difference === 0 ? 'Average' : `${subject.difference}%`}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-sm text-muted-foreground">
                        <span>Your Average: <strong className="text-foreground">{subject.studentAverage}%</strong></span>
                        <span>Class Average: <strong>{subject.classAverage}%</strong></span>
                        <span>{subject.examsTaken} exams</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                GPA Trend Across Terms
              </CardTitle>
              <CardDescription>
                Track academic performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-48">
                {gpaTrend.filter(t => t.gpa !== null).map((term, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-primary rounded-t-md"
                      style={{ height: `${(term.gpa || 0) / 5 * 100}%` }}
                    />
                    <div className="text-xs text-muted-foreground mt-2 text-center">
                      {term.termName}
                      <br />
                      <span className="font-semibold">{term.gpa}</span>
                    </div>
                  </div>
                ))}
              </div>
              {weeklyEvaluation && (
                <div className="mt-6 p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="font-medium">Weekly Evaluation Trend</p>
                      <p className="text-sm text-muted-foreground">
                        Latest: {weeklyEvaluation.latestWeek} • Avg Score: {weeklyEvaluation.averageScore.toFixed(1)}/5
                      </p>
                    </div>
                    <Badge variant={
                      weeklyEvaluation.trend === 'improving' ? 'default' : 
                      weeklyEvaluation.trend === 'declining' ? 'destructive' : 'secondary'
                    }>
                      {weeklyEvaluation.trend === 'improving' && <TrendingUp className="h-3 w-3 mr-1" />}
                      {weeklyEvaluation.trend === 'declining' && <TrendingDown className="h-3 w-3 mr-1" />}
                      {weeklyEvaluation.trend === 'stable' && <Minus className="h-3 w-3 mr-1" />}
                      {weeklyEvaluation.trend}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Attendance Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Present</span>
                    <span className="font-medium">{attendance.present} days</span>
                  </div>
                  <Progress value={(attendance.present / attendance.total) * 100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Late</span>
                    <span className="font-medium">{attendance.late} days</span>
                  </div>
                  <Progress value={(attendance.late / attendance.total) * 100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Absent</span>
                    <span className="font-medium">{attendance.absent} days</span>
                  </div>
                  <Progress value={(attendance.absent / attendance.total) * 100} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Achievements & Badges
              </CardTitle>
            </CardHeader>
            <CardContent>
              {achievements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {achievements.map((achievement, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl">{achievement.badgeIcon || '🏆'}</span>
                      </div>
                      <div>
                        <p className="font-medium">{achievement.title}</p>
                        <p className="text-sm text-muted-foreground capitalize">{achievement.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Medal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No achievements yet. Keep working hard!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ParentAnalytics;