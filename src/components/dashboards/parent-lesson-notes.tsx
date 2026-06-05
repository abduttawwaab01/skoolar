'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BookText, Trophy, FileText, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface ChildData {
  id: string;
  admissionNo: string;
  user: { name: string; email: string; phone?: string | null };
  class?: { id: string; name: string; section?: string | null } | null;
}

interface LessonNote {
  id: string;
  topic: string;
  subject: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
}

interface StudentAttemptSummary {
  planId: string;
  topic: string;
  subjectName: string;
  className: string;
  bestScore: number;
  totalMarks: number;
  bestMastery: string;
  totalAttempts: number;
  lastAttemptDate: string;
}

const MASTERY_COLORS: Record<string, string> = {
  beginner: 'bg-gray-100 text-gray-700 border-gray-300',
  intermediate: 'bg-blue-100 text-blue-700 border-blue-300',
  advanced: 'bg-purple-100 text-purple-700 border-purple-300',
  mastered: 'bg-amber-100 text-amber-700 border-amber-300',
};

export function ParentLessonNotes() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';
  const userId = currentUser?.id || '';

  const [children, setChildren] = useState<ChildData[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [allNotes, setAllNotes] = useState<LessonNote[]>([]);
  const [attemptSummaries, setAttemptSummaries] = useState<Map<string, StudentAttemptSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  // Fetch parent's children
  useEffect(() => {
    if (!schoolId || !userId) return;
    fetch(`/api/parent/children?schoolId=${schoolId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => {
        const kids = j.data || j || [];
        setChildren(kids);
        if (kids.length > 0) setSelectedChild(kids[0].id);
      })
      .catch(() => toast.error('Failed to load children'))
      .finally(() => setLoading(false));
  }, [schoolId, userId]);

  // Fetch all published lesson notes
  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/lesson-plans?schoolId=${schoolId}&limit=100`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => {
        const plans = (j.data || []).filter((p: { status: string }) => p.status === 'published' || p.status === 'active');
        setAllNotes(plans);
      })
      .catch(() => {});
  }, [schoolId]);

  // Fetch attempt results for selected child
  useEffect(() => {
    if (!selectedChild || allNotes.length === 0) return;
    const loadingId = setTimeout(() => setLoadingResults(true), 0);
    const summaries = new Map<string, StudentAttemptSummary>();

    Promise.all(allNotes.map(async (note) => {
      try {
        const res = await fetch(`/api/lesson-plans/${note.id}/attempt?studentId=${selectedChild}`);
        if (res.ok) {
          const json = await res.json();
          const attempts = json.data?.attempts || [];
          if (attempts.length > 0) {
            const bestAttempt = attempts.reduce((best: typeof attempts[0], a: typeof attempts[0]) =>
              (a.score || 0) > (best.score || 0) ? a : best
            , attempts[0]);
            summaries.set(note.id, {
              planId: note.id,
              topic: note.topic,
              subjectName: note.subject?.name || '',
              className: note.class?.name || '',
              bestScore: bestAttempt.score || 0,
              totalMarks: bestAttempt.totalMarks,
              bestMastery: bestAttempt.masteryLevel || 'beginner',
              totalAttempts: attempts.length,
              lastAttemptDate: bestAttempt.completedAt || '',
            });
          }
        }
      } catch { /* ignore */ }
    })).then(() => {
      clearTimeout(loadingId);
      setAttemptSummaries(summaries);
      setLoadingResults(false);
    });
  }, [selectedChild, allNotes]);



  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-64" /></div>;
  }

  if (children.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No children linked</p>
        <p className="text-sm mt-1">No children are linked to your parent account.</p>
      </div>
    );
  }

  const attemptedNotes = Array.from(attemptSummaries.values());
  const unattemptedNotes = allNotes.filter(n => !attemptSummaries.has(n.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lesson Notes</h1>
          <p className="text-muted-foreground text-sm">View your child&apos;s lesson notes and quiz results</p>
        </div>
        <Select value={selectedChild} onValueChange={setSelectedChild}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Select child" />
          </SelectTrigger>
          <SelectContent>
            {children.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.user?.name || 'Child'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingResults ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-1/2 mt-2" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          {/* Completed Notes */}
          {attemptedNotes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Completed ({attemptedNotes.length})
              </h3>
              <div className="space-y-2">
                {attemptedNotes.map(n => (
                  <Card key={n.planId} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                          <p className="font-medium text-sm truncate">{n.topic}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{n.subjectName}</span>
                          {n.className && <><span>·</span><span>{n.className}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold">{n.bestScore}/{n.totalMarks}</p>
                          <p className="text-[10px] text-muted-foreground">{n.totalAttempts} attempt{n.totalAttempts !== 1 ? 's' : ''}</p>
                        </div>
                        {n.bestMastery && (
                          <Badge variant="outline" className={`text-[10px] ${MASTERY_COLORS[n.bestMastery] || ''}`}>
                            {n.bestMastery}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Unattempted Notes */}
          {unattemptedNotes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Not Yet Attempted ({unattemptedNotes.length})
              </h3>
              <div className="space-y-2">
                {unattemptedNotes.map(n => (
                  <Card key={n.id} className="hover:shadow-sm transition-shadow opacity-70">
                    <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium text-sm truncate">{n.topic}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-4">
                        <span>{n.subject?.name}</span>
                        {n.class?.name && <><span>·</span><span>{n.class.name}</span></>}
                        <Badge variant="outline" className="text-[10px]">Not attempted</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {attemptedNotes.length === 0 && unattemptedNotes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No lesson notes available</p>
              <p className="text-sm mt-1">Teachers haven&apos;t published any lesson notes yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
