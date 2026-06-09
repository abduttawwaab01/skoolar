'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { DomainCard } from '@/components/assessment-hub/domain-card';
import { MasteryBadge } from '@/components/assessment-hub/mastery-badge';
import { ExportMenu } from '@/components/shared/export-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, BarChart3 } from 'lucide-react';

export function AssessmentTeacherResultsView() {
  const { currentUser, currentRole, setCurrentView } = useAppStore();
  const [results, setResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const schoolId = currentUser.schoolId || '';

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      let teacherId = '';
      if (currentRole === 'TEACHER') {
        const res = await fetch(`/api/teacher?userId=${currentUser.id}&schoolId=${schoolId}`);
        const data = await res.json();
        teacherId = data.data?.[0]?.id || '';
      }
      const sp = new URLSearchParams({ schoolId });
      if (teacherId) sp.set('teacherId', teacherId);
      const res = await fetch(`/api/assessment-hub/teacher/results?${sp}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId, currentUser]);

  const fetchResultDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/assessment-hub/teacher/results/${id}`);
      if (res.ok) setSelectedResult(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  if (selectedResult) {
    const domains = selectedResult.domainResults || [];

    const exportData = useMemo(() => domains.map((d: any) => ({
      Domain: d.domain.replace(/_/g, ' '),
      Score: `${d.score}%`,
      Level: d.masteryLevel,
    })), [domains]);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedResult(null)}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Teacher Results</h1>
            <p className="text-muted-foreground">{selectedResult.assessment?.title}</p>
          </div>
          <ExportMenu options={{
            title: `${selectedResult.assessment?.title || 'Teacher Assessment'} Results`,
            subtitle: `Teacher Assessment Report`,
            fileName: `teacher-assessment-results`,
            columns: [{ header: 'Domain', key: 'Domain' }, { header: 'Score (%)', key: 'Score' }, { header: 'Mastery Level', key: 'Level' }],
            data: exportData,
            summaryRows: [
              { label: 'Overall Score', value: `${selectedResult.overallScore ?? '-'}%` },
              { label: 'Mastery Level', value: selectedResult.masteryLevel || 'N/A' },
              { label: 'Completed', value: new Date(selectedResult.completedAt).toLocaleDateString() },
            ],
            sections: domains.map((d: any) => ({
              heading: d.domain.replace(/_/g, ' '),
              content: [
                `Score: ${d.score}% - ${d.masteryLevel}`,
                ...(d.strengths || []).map((s: string) => `Strength: ${s}`),
                ...(d.weaknesses || []).map((w: string) => `Area to Improve: ${w}`),
              ],
            })),
          }} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Overall</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{selectedResult.overallScore ?? '-'}%</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Mastery</CardTitle></CardHeader><CardContent><MasteryBadge level={selectedResult.masteryLevel || 'BEGINNER'} /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold">{new Date(selectedResult.completedAt).toLocaleDateString()}</p></CardContent></Card>
        </div>
        <Tabs defaultValue="domains">
          <TabsList><TabsTrigger value="domains">Domain Scores</TabsTrigger></TabsList>
          <TabsContent value="domains" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {domains.map((d: any) => (
                <DomainCard key={d.id} domain={d.domain.replace(/_/g, ' ')} score={d.score} masteryLevel={d.masteryLevel} strengths={d.strengths} weaknesses={d.weaknesses} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teacher Assessment Results</h1>
        <p className="text-muted-foreground">View completed teacher assessments and domain scores</p>
      </div>
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : results.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No results yet</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {results.map((r: any) => (
            <Card key={r.id} className="cursor-pointer hover:shadow-sm" onClick={() => fetchResultDetail(r.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{r.assessment?.title || 'Assessment'}</CardTitle>
                  <MasteryBadge level={r.masteryLevel || 'BEGINNER'} score={r.overallScore} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Completed: {new Date(r.completedAt).toLocaleDateString()}</span>
                  <span>Domains: {r.domainResults?.length || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
