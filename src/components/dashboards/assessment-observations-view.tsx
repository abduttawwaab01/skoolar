'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ClipboardList, Plus, Eye } from 'lucide-react';

const OBSERVATION_DOMAINS = [
  'CLASSROOM_MANAGEMENT', 'PEDAGOGICAL_COMPETENCY', 'SUBJECT_EXPERTISE',
  'LEADERSHIP_ADMIN', 'INTERPERSONAL_COMMUNICATION',
];

export function AssessmentObservationsView() {
  const { currentUser, setCurrentView } = useAppStore();
  const [observations, setObservations] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [domain, setDomain] = useState('CLASSROOM_MANAGEMENT');
  const [score, setScore] = useState('7');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const schoolId = currentUser.schoolId || '';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [obsRes, teacherRes] = await Promise.all([
        fetch(`/api/assessment-hub/teacher/observations?schoolId=${schoolId}`),
        fetch(`/api/teachers?schoolId=${schoolId}`),
      ]);
      if (obsRes.ok) { const d = await obsRes.json(); setObservations(d.data || []); }
      if (teacherRes.ok) { const d = await teacherRes.json(); setTeachers(d.data || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!selectedTeacher || !comments.trim()) { toast.error('Select a teacher and provide comments'); return; }
    try {
      setSubmitting(true);
      const res = await fetch('/api/assessment-hub/teacher/observations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId, teacherId: selectedTeacher, domain, observerId: currentUser.id,
          observerName: currentUser.name, score: parseInt(score), comments,
        }),
      });
      if (res.ok) { toast.success('Observation recorded'); setShowForm(false); setSelectedTeacher(''); setComments(''); setScore('7'); fetchData(); }
      else { const err = await res.json(); toast.error(err.error || 'Failed'); }
    } catch { toast.error('Failed'); } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classroom Observations</h1>
          <p className="text-muted-foreground">Record and track teacher observations</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" /> {showForm ? 'Cancel' : 'New Observation'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Record Observation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Domain</Label>
                <Select value={domain} onValueChange={setDomain}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBSERVATION_DOMAINS.map((d) => <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Score (1-10)</Label>
              <Input type="number" min={1} max={10} value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={4} placeholder="Observation notes..." />
            </div>
            <Button onClick={handleCreate} disabled={submitting}>{submitting ? 'Saving...' : 'Save Observation'}</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : observations.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No observations yet</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {observations.map((o: any) => (
            <Card key={o.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">
                      {o.teacher?.firstName} {o.teacher?.lastName || 'Teacher'}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">{o.domain?.replace(/_/g, ' ')}</Badge>
                  </div>
                  <Badge className={cn('text-[10px]', o.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600')}>{o.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{o.comments}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Observer: {o.observerName}</span>
                  <span>Score: {o.score}/10</span>
                  <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


