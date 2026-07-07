'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { GrowthTimeline } from '@/components/assessment-hub/growth-timeline';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function AssessmentStudentGrowthView() {
  const { currentUser, currentRole, setCurrentView } = useAppStore();
  const [growth, setGrowth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const schoolId = currentUser.schoolId || '';

  const fetchGrowth = useCallback(async () => {
    try {
      let studentId = '';
      if (currentRole === 'STUDENT') {
      const res = await fetch(`/api/students?userId=${currentUser.id}&schoolId=${schoolId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
        studentId = data.data?.[0]?.id || '';
      }
      if (!studentId) { setLoading(false); return; }
      const res = await fetch(`/api/assessment-hub/student/growth/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setGrowth(data);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [currentUser, schoolId]);

  useEffect(() => { fetchGrowth(); }, [fetchGrowth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView('assessment-student-list')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Growth Over Time</h1>
          <p className="text-muted-foreground">Track your progress across multiple assessments</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2].map((i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      ) : !growth || growth.records?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No growth data yet. Complete multiple assessments to see trends.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Overall Growth</CardTitle></CardHeader>
              <CardContent>
                <p className={cn('text-2xl font-bold flex items-center gap-2',
                  growth.growthScore > 0 ? 'text-emerald-600' : growth.growthScore < 0 ? 'text-red-600' : '')}>
                  {growth.growthScore > 0 ? <TrendingUp className="h-5 w-5" /> : growth.growthScore < 0 ? <TrendingDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                  {growth.growthScore ?? 0}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Assessments Taken</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{growth.records?.length || 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Trend</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg font-semibold capitalize">{growth.trend || 'stable'}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score Progression</CardTitle>
            </CardHeader>
            <CardContent>
              <GrowthTimeline
                records={(growth.records || []).map((r: any) => ({
                  ...r,
                  assessmentDate: r.assessmentDate || r.createdAt,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}


