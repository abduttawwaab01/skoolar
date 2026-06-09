'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Plus, Eye, Play, Users } from 'lucide-react';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-blue-100 text-blue-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-600',
  COMPLETED: 'bg-emerald-100 text-emerald-600',
  ARCHIVED: 'bg-red-100 text-red-600',
};

export function AssessmentTeacherListView() {
  const { currentUser, currentRole, setCurrentView } = useAppStore();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const schoolId = currentUser.schoolId || '';
  const role = currentRole || 'TEACHER';
  const canManage = role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';

  const fetchAssessments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/assessment-hub/teacher?schoolId=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setAssessments(data.data || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Assessments</h1>
          <p className="text-muted-foreground">Manage diagnostic assessments across all 7 competency domains</p>
        </div>
        {canManage && (
          <Button onClick={() => setCurrentView('assessment-teacher-create')}>
            <Plus className="h-4 w-4 mr-2" /> Create Assessment
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : assessments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No teacher assessments found</p>
            {canManage && (
              <Button variant="outline" className="mt-4" onClick={() => setCurrentView('assessment-teacher-create')}>
                <Plus className="h-4 w-4 mr-2" /> Create First Assessment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assessments.map((a: any) => (
            <Card key={a.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    <Badge className={cn('text-[10px]', statusColors[a.status] || '')}>{a.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentView('assessment-teacher-take')}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentView('assessment-teacher-results')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{a.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Sections: {a.sections?.length || 0}</span>
                  <span>Questions: {a.totalQuestions || 0}</span>
                  <span>Attempts: {a.attemptCount || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


