'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { SkillRadarChart } from '@/components/assessment-hub/skill-radar-chart';
import { DomainCard } from '@/components/assessment-hub/domain-card';
import { LearningStyleChart } from '@/components/assessment-hub/learning-style-chart';
import { RecommendationCard } from '@/components/assessment-hub/recommendation-card';
import { GrowthTimeline } from '@/components/assessment-hub/growth-timeline';
import { MasteryBadge } from '@/components/assessment-hub/mastery-badge';
import { useCompleteStudentRecommendation } from '@/hooks/use-assessment-api';
import { ExportMenu } from '@/components/shared/export-menu';
import { ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';

export function AssessmentStudentProfileView() {
  const { currentUser, currentRole, setCurrentView } = useAppStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const completeMutation = useCompleteStudentRecommendation();

  const schoolId = currentUser.schoolId || '';

  const fetchProfile = useCallback(async () => {
    try {
      let studentId = '';
      if (currentRole === 'STUDENT') {
        const res = await fetch(`/api/student?userId=${currentUser.id}&schoolId=${schoolId}`);
        const data = await res.json();
        studentId = data.data?.[0]?.id || '';
      }
      if (!studentId) { setLoading(false); return; }
      const res = await fetch(`/api/assessment-hub/student/profile/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [currentUser, schoolId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleCompleteRecommendation = async (id: string) => {
    try {
      await completeMutation.mutateAsync(id);
      toast.success('Recommendation marked as complete');
      fetchProfile();
    } catch { toast.error('Failed to update'); }
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <User className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No assessment profile found. Complete an assessment first.</p>
        <Button variant="outline" className="mt-4" onClick={() => setCurrentView('assessment-student-take')}>
          Take Assessment
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView('assessment-student-list')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Student Profile</h1>
          <p className="text-muted-foreground">Comprehensive skill profile across all domains</p>
        </div>
        {profile && (
          <ExportMenu options={{
            title: 'Student Assessment Profile',
            subtitle: `Overall Mastery: ${profile.overallMastery || 'N/A'} (${profile.overallScore || 0}%)`,
            fileName: 'student-assessment-profile',
            columns: [
              { header: 'Domain', key: 'Domain' },
              { header: 'Score', key: 'Score' },
              { header: 'Level', key: 'Level' },
            ],
            data: (profile.domains || []).map((d: any) => ({
              Domain: d.domain.replace(/_/g, ' '),
              Score: `${d.score}%`,
              Level: d.masteryLevel,
            })),
            summaryRows: [
              { label: 'Domains Assessed', value: String(profile.domains?.length || 0) },
              { label: 'Skills Tracked', value: String(profile.skills?.length || 0) },
              { label: 'Overall Mastery', value: profile.overallMastery || 'N/A' },
              { label: 'Growth Records', value: String(profile.growthRecords?.length || 0) },
            ],
          }} />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Overall Mastery</CardTitle></CardHeader>
          <CardContent>
            <MasteryBadge level={profile.overallMastery || 'BEGINNER'} score={profile.overallScore} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Domains Assessed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{profile.domains?.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Skills Tracked</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{profile.skills?.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Growth Records</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{profile.growthRecords?.length || 0}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="domains">
        <TabsList>
          <TabsTrigger value="domains">Domain Scores</TabsTrigger>
          <TabsTrigger value="radar">Radar View</TabsTrigger>
          <TabsTrigger value="learning">Learning Style</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(profile.domains || []).map((d: any) => (
              <DomainCard
                key={d.id}
                domain={d.domain.replace(/_/g, ' ')}
                score={d.score}
                masteryLevel={d.masteryLevel}
                strengths={d.strengths}
                weaknesses={d.weaknesses}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="radar" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <SkillRadarChart
                data={(profile.domains || []).map((d: any) => ({ domain: d.domain, score: d.score }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {profile.learningStyle ? (
                <LearningStyleChart style={profile.learningStyle} />
              ) : (
                <p className="text-muted-foreground text-center py-8">No learning style data yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <div className="space-y-3">
            {(profile.recommendations || []).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No recommendations yet</p>
            ) : (
              (profile.recommendations || []).map((r: any) => (
                <RecommendationCard
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  description={r.description}
                  priority={r.priority}
                  category={r.category}
                  isCompleted={r.isCompleted}
                  onComplete={handleCompleteRecommendation}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="growth" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <GrowthTimeline
                records={(profile.growthRecords || []).map((r: any) => ({
                  ...r,
                  assessmentDate: r.assessmentDate || r.createdAt,
                }))}
                domains={(profile.domains || []).map((d: any) => d.domain)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
