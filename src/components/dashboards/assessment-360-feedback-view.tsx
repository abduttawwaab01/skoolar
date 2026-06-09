'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';

const TEACHER_DOMAINS = [
  'LEADERSHIP_ADMIN', 'PEDAGOGICAL_COMPETENCY', 'CLASSROOM_MANAGEMENT',
  'SUBJECT_EXPERTISE', 'PROFESSIONAL_DEVELOPMENT', 'INTERPERSONAL_COMMUNICATION',
];

export function Assessment360FeedbackView() {
  const { currentUser, currentRole, setCurrentView } = useAppStore();
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [domain, setDomain] = useState('PEDAGOGICAL_COMPETENCY');
  const [rating, setRating] = useState('5');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const schoolId = currentUser.schoolId || '';
  const role = currentRole || 'SCHOOL_ADMIN';
  const canApprove = role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [feedbackRes, teacherRes] = await Promise.all([
        fetch(`/api/assessment-hub/teacher/feedback?schoolId=${schoolId}`),
        fetch(`/api/teachers?schoolId=${schoolId}`),
      ]);
      if (feedbackRes.ok) {
        const data = await feedbackRes.json();
        setFeedbackList(data.data || []);
      }
      if (teacherRes.ok) {
        const data = await teacherRes.json();
        setTeachers(data.data || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!selectedTeacher || !comments.trim()) {
      toast.error('Please select a teacher and provide comments');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/assessment-hub/teacher/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId, teacherId: selectedTeacher, domain, rating: parseInt(rating),
          comments, respondentId: currentUser.id, respondentRole: role,
        }),
      });
      if (res.ok) {
        toast.success('Feedback submitted!');
        setShowForm(false);
        setSelectedTeacher(''); setComments(''); setRating('5');
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to submit');
      }
    } catch { toast.error('Failed'); } finally { setSubmitting(false); }
  };

  const handleApprove = async (id: string, approvalStatus: string) => {
    try {
      const res = await fetch(`/api/assessment-hub/teacher/feedback/${id}/approve`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus }),
      });
      if (res.ok) { toast.success(`Feedback ${approvalStatus}`); fetchData(); }
      else { const err = await res.json(); toast.error(err.error || 'Failed'); }
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">360-Degree Feedback</h1>
          <p className="text-muted-foreground">Multi-source feedback for teacher development</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <MessageSquare className="h-4 w-4 mr-2" /> {showForm ? 'Cancel' : 'Submit Feedback'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Feedback</CardTitle></CardHeader>
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
                    {TEACHER_DOMAINS.map((d) => <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rating (1-10)</Label>
              <Input type="number" min={1} max={10} value={rating} onChange={(e) => setRating(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={4} placeholder="Provide constructive feedback..." />
            </div>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Feedback'}</Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Feedback</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {renderFeedbackList(feedbackList, loading, canApprove, handleApprove)}
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          {renderFeedbackList(feedbackList.filter((f: any) => f.approvalStatus === 'PENDING'), loading, canApprove, handleApprove)}
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          {renderFeedbackList(feedbackList.filter((f: any) => f.approvalStatus === 'APPROVED'), loading, canApprove, handleApprove)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function renderFeedbackList(list: any[], loading: boolean, canApprove: boolean, handleApprove: (id: string, status: string) => void) {
  if (loading) return <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (list.length === 0) return <Card><CardContent className="py-8 text-center"><MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No feedback entries</p></CardContent></Card>;
  return (
    <div className="space-y-3">
      {list.map((f: any) => (
        <Card key={f.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">
                  Feedback for {f.teacher?.firstName} {f.teacher?.lastName || 'Teacher'}
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">{f.domain?.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn('text-[10px]', f.approvalStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : f.approvalStatus === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}>
                  {f.approvalStatus}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">Rating: {f.rating}/10</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{f.comments}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">
                From: {f.respondentRole} - {new Date(f.createdAt).toLocaleDateString()}
              </span>
              {canApprove && f.approvalStatus === 'PENDING' && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => handleApprove(f.id, 'APPROVED')}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => handleApprove(f.id, 'REJECTED')}>
                    <XCircle className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


