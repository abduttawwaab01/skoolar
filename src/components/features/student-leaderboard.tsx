'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, Medal, Crown, TrendingUp, Users, Calendar,
  Award, Star, ArrowUp, ArrowDown, RefreshCw, BookOpen,
  Smile, Clock, Target, Zap, GraduationCap
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StudentAward {
  type: string;
  title: string;
  icon: string;
  description: string;
}

interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  avatar: string | null;
  className: string;
  score: number;
  details: {
    attendance?: number;
    homework?: number;
    evaluation?: number;
    gpa?: number;
    behavior?: number;
  };
}

interface LeaderboardData {
  type: string;
  period: string;
  data: LeaderboardEntry[];
  top10?: LeaderboardEntry[];
  myPosition?: LeaderboardEntry;
  myChildren?: LeaderboardEntry[];
  totalStudents: number;
}

const STUDENT_AWARDS = [
  { type: 'BEST_OVERALL', title: 'Best Overall', icon: '🏆', description: 'Top performer overall' },
  { type: 'MOST_PUNCTUAL', title: 'Most Punctual', icon: '⏰', description: 'Best attendance record' },
  { type: 'BEST_IN_SUBJECT', title: 'Subject Champion', icon: '📚', description: 'Best in specific subject' },
  { type: 'MOST_BEHAVED', title: 'Most Well-Behaved', icon: '😊', description: 'Highest behavior score' },
  { type: 'MOST_IMPROVED', title: 'Most Improved', icon: '📈', description: 'Biggest improvement' },
  { type: 'HOMEWORK_HERO', title: 'Homework Hero', icon: '📝', description: 'Best homework completion' },
  { type: 'ATTENDANCE_STAR', title: 'Attendance Star', icon: '⭐', description: 'Perfect attendance' },
  { type: 'WEEKLY_CHAMPION', title: 'Weekly Champion', icon: '🏅', description: 'Best weekly performance' },
];

export function StudentLeaderboard() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const role = currentRole || '';
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [type, setType] = useState<string>('weekly');
  const [refreshing, setRefreshing] = useState(false);
  const [awards, setAwards] = useState<StudentAward[]>([]);

  useEffect(() => {
    fetchLeaderboard();
  }, [schoolId, type]);

  async function fetchLeaderboard() {
    try {
      setLoading(true);
      const res = await fetch(`/api/leaderboard?type=${type}&schoolId=${schoolId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || json);
        calculateAwards(json.data || json);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateAwards(leaderboardData: LeaderboardData) {
    const entries = leaderboardData.data || leaderboardData.top10 || [];
    if (entries.length === 0) return;

    const newAwards: StudentAward[] = [];

    // Best Overall
    if (entries[0]) {
      newAwards.push({
        type: 'BEST_OVERALL',
        title: `Best Overall - ${entries[0].studentName}`,
        icon: '🏆',
        description: `Score: ${entries[0].score}`,
      });
    }

    // Most Punctual (highest attendance score)
    const bestAttendance = entries.reduce((max, e) => 
      (e.details.attendance || 0) > (max?.details.attendance || 0) ? e : max, entries[0]);
    if (bestAttendance) {
      newAwards.push({
        type: 'MOST_PUNCTUAL',
        title: `Most Punctual - ${bestAttendance.studentName}`,
        icon: '⏰',
        description: `${bestAttendance.details.attendance || 0}% attendance`,
      });
    }

    // Most Behaved (highest behavior score)
    const bestBehavior = entries.reduce((max, e) => 
      (e.details.behavior || 0) > (max?.details.behavior || 0) ? e : max, entries[0]);
    if (bestBehavior) {
      newAwards.push({
        type: 'MOST_BEHAVED',
        title: `Most Well-Behaved - ${bestBehavior.studentName}`,
        icon: '😊',
        description: `Behavior score: ${bestBehavior.details.behavior || 0}`,
      });
    }

    // Homework Hero (highest homework score)
    const bestHomework = entries.reduce((max, e) => 
      (e.details.homework || 0) > (max?.details.homework || 0) ? e : max, entries[0]);
    if (bestHomework) {
      newAwards.push({
        type: 'HOMEWORK_HERO',
        title: `Homework Hero - ${bestHomework.studentName}`,
        icon: '📝',
        description: `${bestHomework.details.homework || 0}% completion`,
      });
    }

    // Weekly Champion (highest evaluation score)
    const bestEval = entries.reduce((max, e) => 
      (e.details.evaluation || 0) > (max?.details.evaluation || 0) ? e : max, entries[0]);
    if (bestEval) {
      newAwards.push({
        type: 'WEEKLY_CHAMPION',
        title: `Weekly Champion - ${bestEval.studentName}`,
        icon: '🏅',
        description: `Eval score: ${bestEval.details.evaluation || 0}`,
      });
    }

    // 2nd and 3rd place
    if (entries[1]) {
      newAwards.push({
        type: 'SECOND_PLACE',
        title: `2nd Place - ${entries[1].studentName}`,
        icon: '🥈',
        description: `Score: ${entries[1].score}`,
      });
    }
    if (entries[2]) {
      newAwards.push({
        type: 'THIRD_PLACE',
        title: `3rd Place - ${entries[2].studentName}`,
        icon: '🥉',
        description: `Score: ${entries[2].score}`,
      });
    }

    setAwards(newAwards);
  }

  async function refreshLeaderboard() {
    try {
      setRefreshing(true);
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, schoolId }),
      });

      if (res.ok) {
        toast.success('Leaderboard refreshed');
        fetchLeaderboard();
      }
    } catch (error) {
      console.error('Failed to refresh leaderboard:', error);
      toast.error('Failed to refresh leaderboard');
    } finally {
      setRefreshing(false);
    }
  }

  const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR'].includes(role);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No leaderboard data available</p>
        {isAdmin && (
          <Button onClick={refreshLeaderboard} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Leaderboard
          </Button>
        )}
      </div>
    );
  }

  const displayData = data.data || data.top10 || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Student Leaderboard
          </h2>
          <p className="text-muted-foreground">
            {type === 'daily' ? 'Daily' : type === 'weekly' ? 'Weekly' : type === 'termly' ? 'Termly' : 'Yearly'} Rankings - {data.period}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="termly">Termly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button onClick={refreshLeaderboard} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Awards Section */}
      <Card className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Award className="h-6 w-6" />
            🏆 Awards & Recognitions 🏆
          </CardTitle>
          <CardDescription className="text-white/80">
            Congratulations to our top performers this {type}!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {awards.map((award, i) => (
              <div 
                key={i} 
                className={cn(
                  "p-4 rounded-lg text-center",
                  award.type === 'BEST_OVERALL' ? "bg-yellow-400/30" :
                  award.type === 'SECOND_PLACE' ? "bg-gray-400/30" :
                  award.type === 'THIRD_PLACE' ? "bg-orange-400/30" :
                  "bg-white/10"
                )}
              >
                <div className="text-3xl mb-2">{award.icon}</div>
                <p className="font-bold text-sm">{award.title}</p>
                <p className="text-xs text-white/70">{award.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* My Position (for students/parents) */}
      {data.myPosition && !isAdmin && (
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-primary-foreground/80 font-medium">Your Position</p>
                <p className="text-4xl font-bold mt-1">
                  #{data.myPosition.rank}
                  <span className="text-lg font-normal text-primary-foreground/80"> of {data.totalStudents}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-primary-foreground/80 text-sm">Total Score</p>
                <p className="text-3xl font-bold">{data.myPosition.score}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Children positions (for parents) */}
      {data.myChildren && data.myChildren.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Children</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.myChildren.map((child, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg border flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{child.studentName}</p>
                      <p className="text-sm text-muted-foreground">{child.className}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">#{child.rank}</p>
                    <p className="text-sm text-muted-foreground">{child.score} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 10 with Awards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Top 10 Performers
          </CardTitle>
          <CardDescription>Best performing students this {type}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayData.slice(0, 10).map((entry, i) => (
              <div 
                key={entry.studentId} 
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border transition-all",
                  i === 0 && "bg-yellow-50 border-yellow-200",
                  i === 1 && "bg-gray-50 border-gray-200",
                  i === 2 && "bg-orange-50 border-orange-200",
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center font-bold",
                  i === 0 ? "bg-yellow-400 text-white" :
                  i === 1 ? "bg-gray-400 text-white" :
                  i === 2 ? "bg-orange-400 text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i === 0 ? <Crown className="h-5 w-5" /> : i === 1 ? <Medal className="h-5 w-5" /> : i === 2 ? <Medal className="h-5 w-5" /> : entry.rank}
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {entry.avatar ? (
                    <img src={entry.avatar} alt="" className="h-12 w-12 object-cover" />
                  ) : (
                    <Users className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{entry.studentName}</p>
                  <p className="text-sm text-muted-foreground">{entry.className}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{entry.score}</p>
                  <p className="text-xs text-muted-foreground">points</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full Rankings (Admin only) */}
      {isAdmin && displayData.length > 10 && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Rankings</CardTitle>
            <CardDescription>All {data.totalStudents} students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {displayData.slice(10).map(entry => (
                <div key={entry.studentId} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50">
                  <div className="w-8 text-center font-medium text-muted-foreground">{entry.rank}</div>
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{entry.studentName}</p>
                  </div>
                  <div className="text-muted-foreground">{entry.className}</div>
                  <div className="font-bold">{entry.score}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StudentLeaderboard;