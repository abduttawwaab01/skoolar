'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAppStore } from '@/store/app-store';
import {
  Trophy, Star, CalendarCheck, Medal, Target, Users, Lock, Award, Zap, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface RankedStudent {
  rank: number;
  id: string;
  admissionNo: string;
  userId: string;
  classId: string | null;
  gpa: number | null;
  cumulativeGpa: number | null;
  user: { name: string | null; avatar: string | null };
  class: { name: string; section: string | null } | null;
  totalScore: number;
  examCount: number;
}

// Real achievement data will be fetched from API - placeholder for now
const defaultXpData = null; // Will be populated from API
const defaultAchievements = null; // Will be populated from API

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Card><CardContent className="p-6"><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div></CardContent></Card>
      <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
    </div>
  );
}

export function StudentAchievements() {
  const selectedSchoolId = useAppStore((s) => s.selectedSchoolId);
  const currentUser = useAppStore((s) => s.currentUser);
  const [loading, setLoading] = React.useState(true);
  const [leaderboard, setLeaderboard] = React.useState<RankedStudent[]>([]);

  const fetchLeaderboard = React.useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?schoolId=${selectedSchoolId}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const json = await res.json();
      const ranking: RankedStudent[] = json.data?.studentRanking || [];
      setLeaderboard(ranking);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load achievement data');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  React.useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Get real XP and achievements from student's results
  const xpData = leaderboard.find(s => s.userId === currentUser?.id)
    ? { current: Math.round((leaderboard.find(s => s.userId === currentUser?.id)?.cumulativeGpa || 0) * 1000), total: 3000, level: Math.floor((leaderboard.find(s => s.userId === currentUser?.id)?.cumulativeGpa || 0) * 10) }
    : { current: 0, total: 3000, level: 1 };
  const earnedCount = leaderboard.filter(s => s.userId === currentUser?.id).length;

  const xpProgress = xpData.total > 0 ? (xpData.current / xpData.total) * 100 : 0;

  if (loading) return <LoadingSkeleton />;

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Trophy className="size-10 mb-3" />
        <p className="text-sm font-medium">No school selected</p>
        <p className="text-xs mt-1">Please select a school to view achievements</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="text-muted-foreground">Track your accomplishments and compete with peers</p>
      </div>

      {/* XP Progress */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50/50 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 ring-2 ring-amber-300">
              <Zap className="size-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold">Level {xpData.level}</p>
                  <p className="text-xs text-muted-foreground">Earn XP by completing tasks and achievements</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-700">{xpData.current} / {xpData.total} XP</p>
                  <p className="text-xs text-muted-foreground">{xpData.total - xpData.current} XP to Level {xpData.level + 1}</p>
                </div>
              </div>
              <Progress value={xpProgress} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievement Badges - Show based on student rank */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Achievement Badges</CardTitle>
              <CardDescription>Earn badges by excelling in your studies!</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {leaderboard.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(() => {
                const myRank = leaderboard.find(s => s.userId === currentUser?.id)?.rank || 0;
                const myGpa = leaderboard.find(s => s.userId === currentUser?.id)?.gpa || 0;
                const badges = [
                  { name: 'Top Student', icon: Trophy, earned: myRank === 1, xp: 500, description: myRank === 1 ? 'Ranked #1 in class' : 'Achieve first position' },
                  { name: 'Excellent Performance', icon: Star, earned: myGpa >= 3.5, xp: 400, description: myGpa >= 3.5 ? 'GPA 3.5 or above' : 'Maintain high GPA' },
                  { name: 'Improver', icon: TrendingUp, earned: myRank <= 10, xp: 300, description: myRank <= 10 ? 'Top 10 in class' : 'Keep improving' },
                  { name: 'Active Learner', icon: Target, earned: true, xp: 200, description: 'Using the platform regularly' },
                ];
                return badges.map(badge => (
                  <div
                    key={badge.name}
                    className={`flex items-center gap-4 rounded-xl border p-4 transition-shadow hover:shadow-md ${
                      badge.earned ? 'border-amber-200 bg-amber-50/30' : 'border-muted bg-muted/30 opacity-60'
                    }`}
                  >
                    <div className={`flex size-14 shrink-0 items-center justify-center rounded-full ${
                      badge.earned ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-300' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {badge.earned ? <badge.icon className="size-7" /> : <Lock className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{badge.name}</h3>
                        {badge.earned && (
                          <Badge className="bg-amber-500 text-white text-[10px]">+{badge.xp} XP</Badge>
                        )}
                        {!badge.earned && (
                          <Badge variant="outline" className="text-[10px] text-gray-400">{badge.xp} XP</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
                    </div>
                    {badge.earned && (
                      <Award className="size-5 text-amber-400 shrink-0" />
                    )}
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="size-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No achievements to display yet</p>
              <p className="text-xs mt-1">Complete exams to appear on the leaderboard</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-amber-500" /> School Leaderboard
          </CardTitle>
          <CardDescription>Top performing students this term</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Trophy className="size-8 mb-2" />
                <p className="text-sm font-medium">No ranking data available yet</p>
                <p className="text-xs mt-1">Student rankings will appear once exam results are available</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-center">GPA</TableHead>
                    <TableHead className="text-center">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map(student => {
                    const studentName = student.user?.name || 'Unknown';
                    const className = student.class?.name || 'Unassigned';
                    const gpaValue = student.gpa ?? student.cumulativeGpa ?? 0;
                    const isMe = currentUser.id === student.userId;
                    return (
                      <TableRow key={student.id} className={isMe ? 'bg-amber-50/50' : ''}>
                        <TableCell className="text-center">
                          <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                            student.rank === 1 ? 'bg-amber-100 text-amber-700' :
                            student.rank === 2 ? 'bg-gray-200 text-gray-600' :
                            student.rank === 3 ? 'bg-orange-100 text-orange-700' :
                            'bg-muted'
                          }`}>
                            {student.rank}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {studentName}
                          {isMe && <Badge variant="outline" className="ml-2 text-[10px] bg-amber-50 text-amber-700 border-amber-200">You</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{className}</TableCell>
                        <TableCell className="text-center font-semibold">{gpaValue.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{student.totalScore}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
