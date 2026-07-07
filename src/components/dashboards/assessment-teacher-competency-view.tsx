'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { CompetencyHeatmap } from '@/components/assessment-hub/competency-heatmap';
import { DomainCard } from '@/components/assessment-hub/domain-card';
import { MasteryBadge } from '@/components/assessment-hub/mastery-badge';
import { ExportMenu } from '@/components/shared/export-menu';
import { ArrowLeft, User, ClipboardList, MessageSquare } from 'lucide-react';

export function AssessmentTeacherCompetencyView() {
  const { currentUser, currentRole, setCurrentView } = useAppStore();
  const [competency, setCompetency] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const schoolId = currentUser.schoolId || '';

  const fetchCompetency = useCallback(async () => {
    try {
      let teacherId = '';
      if (currentRole === 'TEACHER') {
      const res = await fetch(`/api/teachers?userId=${currentUser.id}&schoolId=${schoolId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
        teacherId = data.data?.[0]?.id || '';
      }
      if (!teacherId) { setLoading(false); return; }
      const res = await fetch(`/api/assessment-hub/teacher/competency/${teacherId}`);
      if (res.ok) setCompetency(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [currentUser, schoolId]);

  useEffect(() => { fetchCompetency(); }, [fetchCompetency]);

  if (loading) return <div className="space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  if (!competency) return (
    <div className="flex flex-col items-center justify-center py-20">
      <User className="h-12 w-12 text-muted-foreground mb-3" />
      <p className="text-muted-foreground">No competency data found</p>
    </div>
  );

  const heatmapData = (competency.competencies || []).reduce((acc: any[], c: any) => {
    const existing = acc.find((d) => d.domain === c.domain);
    if (existing) existing.competencies.push({ name: c.competencyName, score: c.score });
    else acc.push({ domain: c.domain, competencies: [{ name: c.competencyName, score: c.score }] });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView('assessment-teacher-list')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Teacher Competency Profile</h1>
          <p className="text-muted-foreground">Comprehensive view across all 7 domains</p>
        </div>
        {competency && (
          <ExportMenu options={{
            title: 'Teacher Competency Profile',
            subtitle: `Overall: ${competency.overallMastery || 'N/A'} (${competency.overallScore || 0}%)`,
            fileName: 'teacher-competency-profile',
            columns: [
              { header: 'Domain', key: 'Domain' },
              { header: 'Competency', key: 'Competency' },
              { header: 'Score', key: 'Score' },
            ],
            data: (competency.competencies || []).map((c: any) => ({
              Domain: c.domain.replace(/_/g, ' '),
              Competency: c.competencyName,
              Score: `${c.score}%`,
            })),
            summaryRows: [
              { label: 'Competencies', value: String(competency.competencies?.length || 0) },
              { label: 'Observations', value: String(competency.observations?.length || 0) },
              { label: 'Feedback', value: String(competency.feedbackCount || 0) },
              { label: 'Overall', value: `${competency.overallScore || 0}%` },
            ],
            chartDescriptions: [
              `Observations: ${(competency.observations || []).length} recorded`,
              `Feedback: ${competency.feedbackCount || 0} entries from 360-degree reviews`,
            ],
          }} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Competencies</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{competency.competencies?.length || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Observations</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{competency.observations?.length || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Feedback Entries</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{competency.feedbackCount || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Overall</CardTitle></CardHeader><CardContent><MasteryBadge level={competency.overallMastery || 'BEGINNER'} score={competency.overallScore} /></CardContent></Card>
      </div>

      <Tabs defaultValue="domains">
        <TabsList>
          <TabsTrigger value="domains">Domain Scores</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="observations">Observations</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {heatmapData.map((d: any) => (
              <DomainCard
                key={d.domain}
                domain={d.domain.replace(/_/g, ' ')}
                score={d.competencies.reduce((s: number, c: any) => s + c.score, 0) / d.competencies.length}
                masteryLevel={d.competencies.every((c: any) => c.score >= 80) ? 'EXEMPLARY' : d.competencies.every((c: any) => c.score >= 60) ? 'ADVANCED' : d.competencies.every((c: any) => c.score >= 40) ? 'PROFICIENT' : 'DEVELOPING'}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Competency Heatmap</CardTitle></CardHeader>
            <CardContent>
              <CompetencyHeatmap data={heatmapData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="observations" className="mt-4">
          <div className="space-y-3">
            {(competency.observations || []).length === 0 ? (
              <Card><CardContent className="py-8 text-center"><ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No observations yet</p></CardContent></Card>
            ) : (
              (competency.observations || []).map((o: any) => (
                <Card key={o.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{o.observerName || 'Observation'}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{o.comments}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span>Domain: {o.domain?.replace(/_/g, ' ')}</span>
                      {o.score && <span>Score: {o.score}/10</span>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <Card><CardContent className="py-8 text-center"><MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">View feedback in the 360 Feedback section</p></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
