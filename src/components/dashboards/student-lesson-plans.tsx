'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BookText, BookOpen, Target, Lightbulb, Search, Loader2, FileText,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface LessonPlan {
  id: string;
  subjectId: string | null;
  classId: string | null;
  topic: string;
  objectives: string | null;
  activities: string | null;
  resources: string | null;
  quiz: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  subject: { id: string; name: string; code?: string | null } | null;
  class: { id: string; name: string; section?: string | null } | null;
}

export function StudentLessonPlans() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';

  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [subjectOptions, setSubjectOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/subjects?schoolId=${schoolId}&limit=50`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setSubjectOptions(j.data || []))
      .catch(() => {});
  }, [schoolId]);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId, limit: '100' });
      const res = await fetch(`/api/lesson-plans?${params}`);
      if (res.ok) {
        const json = await res.json();
        const all = json.data || [];
        setPlans(all.filter((p: LessonPlan) => p.status === 'published' || p.status === 'active'));
      }
    } catch {
      toast.error('Failed to load lesson plans');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const filteredPlans = plans.filter(p => {
    if (subjectFilter !== 'all' && p.subject?.name !== subjectFilter) return false;
    if (search && !p.topic.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openDetail = (plan: LessonPlan) => {
    setSelectedPlan(plan);
    setDetailOpen(true);
  };

  if (!schoolId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Select a school to view lesson plans</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Lesson Plans</h2>
        <p className="text-sm text-muted-foreground">Study materials prepared by your teachers</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search topics..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjectOptions.map(s => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <Card className="py-12 text-center">
          <BookText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No lesson plans available</p>
          <p className="text-sm text-muted-foreground mt-1">Your teachers haven't published any lesson plans yet</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlans.map(plan => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(plan)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <BookText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm leading-tight truncate">{plan.topic}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {plan.subject && (
                        <Badge variant="secondary" className="text-[10px]">{plan.subject.name}</Badge>
                      )}
                      {plan.class && (
                        <Badge variant="outline" className="text-[10px]">{plan.class.name}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {plan.objectives && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{plan.objectives}</p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t">
                  <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {plan.objectives ? 'Has objectives' : 'No objectives'}</span>
                  <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> {plan.activities ? 'Has activities' : 'No activities'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookText className="h-5 w-5" />
              {selectedPlan?.topic}
            </DialogTitle>
            <DialogDescription>
              {selectedPlan?.subject?.name}{selectedPlan?.class ? ` — ${selectedPlan.class.name}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-5">
              {selectedPlan.objectives && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"><Target className="h-4 w-4 text-indigo-500" /> Objectives</h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedPlan.objectives}</div>
                </div>
              )}
              {selectedPlan.activities && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"><Lightbulb className="h-4 w-4 text-amber-500" /> Activities</h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedPlan.activities}</div>
                </div>
              )}
              {selectedPlan.resources && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"><BookOpen className="h-4 w-4 text-emerald-500" /> Resources</h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedPlan.resources}</div>
                </div>
              )}
              {selectedPlan.quiz && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"><FileText className="h-4 w-4 text-purple-500" /> Quiz</h4>
                  <p className="text-sm text-muted-foreground">This lesson plan includes a quiz.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
