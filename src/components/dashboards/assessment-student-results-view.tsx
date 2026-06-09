'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { DomainCard } from '@/components/assessment-hub/domain-card';
import { MasteryBadge } from '@/components/assessment-hub/mastery-badge';
import { SkillRadarChart } from '@/components/assessment-hub/skill-radar-chart';
import { LearningStyleChart } from '@/components/assessment-hub/learning-style-chart';
import { ExportMenu } from '@/components/shared/export-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3 } from 'lucide-react';

export function AssessmentStudentResultsView() {
  const { currentUser, currentRole, setCurrentView } = useAppStore();
  const [results, setResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resultLoading, setResultLoading] = useState(false);

  const schoolId = currentUser.schoolId || '';

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      const studentId = currentRole === 'STUDENT' ? await getStudentId() : '';
      const sp = new URLSearchParams({ schoolId });
      if (studentId) sp.set('studentId', studentId);
      const res = await fetch(`/api/assessment-hub/student/results?${sp}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId, currentRole]);

  const fetchResultDetail = useCallback(async (id: string) => {
    try {
      setResultLoading(true);
      const res = await fetch(`/api/assessment-hub/student/results/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedResult(data);
      }
    } catch { /* ignore */ } finally { setResultLoading(false); }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const getStudentId = async (): Promise<string> => {
    try {
      const res = await fetch(`/api/students?userId=${currentUser.id}&schoolId=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        return data.data?.[0]?.id || '';
      }
    } catch { /* ignore */ }
    return '';
  };

  if (selectedResult) {
    const domains = selectedResult.domainResults || [];
    const profile = selectedResult.profile;
    const learningStyle = selectedResult.learningStyle;

    const exportData = useMemo(() => domains.map((d: any) => ({
      Domain: d.domain.replace(/_/g, ' '),
      Score: `${d.score}%`,
      Level: d.masteryLevel,
    })), [domains]);

    const exportColumns = useMemo(() => [
      { header: 'Domain', key: 'Domain' },
      { header: 'Score (%)', key: 'Score' },
      { header: 'Mastery Level', key: 'Level' },
    ], []);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedResult(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Assessment Results</h1>
            <p className="text-muted-foreground">{selectedResult.assessment?.title}</p>
          </div>
          <ExportMenu options={{
            title: `${selectedResult.assessment?.title || 'Assessment'} Results`,
            subtitle: `Student: ${selectedResult.student?.firstName || ''} ${selectedResult.student?.lastName || ''}`,
            fileName: `assessment-results-${selectedResult.assessment?.title?.toLowerCase().replace(/\s+/g, '-') || 'report'}`,
            columns: exportColumns,
            data: exportData,
            summaryRows: [
              { label: 'Overall Score', value: `${selectedResult.overallScore ?? '-'}%` },
              { label: 'Mastery Level', value: selectedResult.masteryLevel || 'N/A' },
              { label: 'Completed', value: new Date(selectedResult.completedAt).toLocaleDateString() },
              ...(selectedResult.timeTakenSeconds ? [{ label: 'Time Taken', value: `${Math.round(selectedResult.timeTakenSeconds / 60)} min` }] : []),
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Overall Score</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{selectedResult.overallScore ?? '-'}%</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Status</CardTitle></CardHeader>
            <CardContent><MasteryBadge level={selectedResult.masteryLevel || 'BEGINNER'} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Completed</CardTitle></CardHeader>
            <CardContent><p className="text-lg font-semibold">{new Date(selectedResult.completedAt).toLocaleDateString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Time Taken</CardTitle></CardHeader>
            <CardContent><p className="text-lg font-semibold">{selectedResult.timeTakenSeconds ? `${Math.round(selectedResult.timeTakenSeconds / 60)} min` : '-'}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="domains">
          <TabsList>
            <TabsTrigger value="domains">Domain Scores</TabsTrigger>
            <TabsTrigger value="radar">Radar View</TabsTrigger>
            {learningStyle && <TabsTrigger value="learning-style">Learning Style</TabsTrigger>}
          </TabsList>
          <TabsContent value="domains" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {domains.map((d: any) => (
                <DomainCard
                  key={d.id}
                  domain={d.domain.replace(/_/g, ' ')}
                  score={d.score}
                  masteryLevel={d.masteryLevel}
                  strengths={d.strengths}
                  weaknesses={d.weaknesses}
                  subDomains={d.subDomains}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="radar" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <SkillRadarChart
                  data={domains.map((d: any) => ({ domain: d.domain, score: d.score }))}
                />
              </CardContent>
            </Card>
          </TabsContent>
          {learningStyle && (
            <TabsContent value="learning-style" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <LearningStyleChart style={learningStyle} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assessment Results</h1>
        <p className="text-muted-foreground">View completed assessment results and domain scores</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No results yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((r: any) => (
            <Card key={r.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => fetchResultDetail(r.id)}>
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
                  <span>Score: {r.overallScore ?? '-'}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
