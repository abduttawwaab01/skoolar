'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/shared/kpi-card';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  BookOpen, Send, Clock, AlertTriangle, CheckCircle2,
  FileText, Star, MessageSquare, CalendarDays, Upload,
  ClipboardList, Award, Hourglass, CircleX,
} from 'lucide-react';

// ---- Types ----
interface HomeworkSubmission {
  id: string;
  studentId: string;
  status: string;
  score: number | null;
  grade: string | null;
  teacherComment: string | null;
  submittedAt: string;
  gradedAt: string | null;
  content: string | null;
}

interface HomeworkItem {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  subjectId: string | null;
  classId: string | null;
  teacherId: string | null;
  dueDate: string;
  totalMarks: number;
  status: string;
  attachments: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  subject: { id: string; name: string; code: string | null } | null;
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  submissions: HomeworkSubmission[];
}

// ---- Helpers ----
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getDaysRemaining(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdue(dueDate: string, status: string) {
  if (status === 'closed' || status === 'completed') return false;
  return new Date(dueDate) < new Date();
}

function isDueSoon(dueDate: string) {
  const days = getDaysRemaining(dueDate);
  return days >= 0 && days <= 2;
}

type FilterTab = 'all' | 'pending' | 'submitted' | 'graded' | 'overdue';

// ---- Component ----
export function StudentHomework() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const studentId = currentUser.id;

  // Data
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedHw, setSelectedHw] = useState<HomeworkItem | null>(null);
  const [answerContent, setAnswerContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailHw, setDetailHw] = useState<HomeworkItem | null>(null);

  // ---- Fetch homework ----
  const fetchHomework = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        schoolId,
        studentId,
        limit: '100',
      });
      const res = await fetch(`/api/homework?${params}`);
      if (res.ok) {
        const json = await res.json();
        setHomeworkList(json.data || []);
      }
    } catch {
      toast.error('Failed to load homework');
    } finally {
      setLoading(false);
    }
  }, [schoolId, studentId]);

  useEffect(() => {
    if (schoolId && studentId) fetchHomework();
  }, [fetchHomework, schoolId, studentId]);

  // ---- Derived data ----
  const getSubmissionStatus = (hw: HomeworkItem) => {
    if (!hw.submissions || hw.submissions.length === 0) return null;
    return hw.submissions[0];
  };

  const filteredList = homeworkList.filter(hw => {
    const sub = getSubmissionStatus(hw);
    switch (activeTab) {
      case 'pending':
        return !sub && !isOverdue(hw.dueDate, hw.status);
      case 'submitted':
        return sub && sub.status === 'submitted';
      case 'graded':
        return sub && sub.status === 'graded';
      case 'overdue':
        return !sub && isOverdue(hw.dueDate, hw.status);
      default:
        return true;
    }
  });

  // Stats
  const totalAssigned = homeworkList.length;
  const submittedCount = homeworkList.filter(hw => { const s = getSubmissionStatus(hw); return s && s.status === 'submitted'; }).length;
  const gradedCount = homeworkList.filter(hw => { const s = getSubmissionStatus(hw); return s && s.status === 'graded'; }).length;
  const pendingCount = homeworkList.filter(hw => !getSubmissionStatus(hw) && !isOverdue(hw.dueDate, hw.status)).length;

  // ---- Submit homework ----
  const handleSubmit = async () => {
    if (!selectedHw || !answerContent.trim()) {
      toast.error('Please write your answer before submitting');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/homework', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedHw.id,
          action: 'submit',
          studentId,
          content: answerContent,
        }),
      });
      if (res.ok) {
        toast.success('Homework submitted successfully!');
        setSubmitOpen(false);
        setAnswerContent('');
        setSelectedHw(null);
        fetchHomework();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to submit homework');
      }
    } catch {
      toast.error('Failed to submit homework');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- View helpers ----
  const openSubmitDialog = (hw: HomeworkItem) => {
    setSelectedHw(hw);
    setAnswerContent('');
    setSubmitOpen(true);
  };

  const openDetail = (hw: HomeworkItem) => {
    setDetailHw(hw);
    setDetailOpen(true);
  };

  // ---- Render card ----
  const renderHomeworkCard = (hw: HomeworkItem) => {
    const sub = getSubmissionStatus(hw);
    const overdue = isOverdue(hw.dueDate, hw.status);
    const dueSoon = isDueSoon(hw.dueDate);
    const days = getDaysRemaining(hw.dueDate);
    const canSubmit = !sub && !overdue;

    return (
      <Card key={hw.id} className={cn('hover:shadow-md transition-shadow', overdue && !sub && 'border-red-200 bg-red-50/30')}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl mt-0.5',
                overdue && !sub ? 'bg-red-100 text-red-600' :
                sub?.status === 'graded' ? 'bg-emerald-100 text-emerald-600' :
                sub?.status === 'submitted' ? 'bg-blue-100 text-blue-600' :
                dueSoon ? 'bg-amber-100 text-amber-600' :
                'bg-slate-100 text-slate-600'
              )}>
                {overdue && !sub ? <AlertTriangle className="size-5" /> :
                 sub?.status === 'graded' ? <Award className="size-5" /> :
                 sub?.status === 'submitted' ? <CheckCircle2 className="size-5" /> :
                 <BookOpen className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm leading-tight">{hw.title}</h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                  {hw.subject && <Badge variant="outline" className="text-[10px]">{hw.subject.name}</Badge>}
                  {hw.class && <span>{hw.class.name}</span>}
                  <span className="flex items-center gap-0.5">
                    <CalendarDays className="size-3" /> {formatDate(hw.dueDate)}
                  </span>
                  <span>{hw.totalMarks} marks</span>
                </div>

                {/* Status indicators */}
                {!sub && overdue && (
                  <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                    <CircleX className="size-3" /> Overdue
                  </p>
                )}
                {!sub && !overdue && dueSoon && (
                  <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <Clock className="size-3" /> Due {days === 0 ? 'today' : `in ${days} day${days !== 1 ? 's' : ''}`}
                  </p>
                )}
                {!sub && !overdue && !dueSoon && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="size-3" /> Due in {days} days
                  </p>
                )}

                {/* Submission info */}
                {sub && sub.status === 'submitted' && (
                  <p className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Submitted on {formatDateTime(sub.submittedAt)}
                  </p>
                )}
                {sub && sub.status === 'graded' && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] hover:bg-emerald-100">
                        Score: {sub.score}/{hw.totalMarks}
                      </Badge>
                      {sub.grade && (
                        <Badge className="bg-emerald-600 text-[10px]">{sub.grade}</Badge>
                      )}
                    </div>
                    {sub.teacherComment && (
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <MessageSquare className="size-3 mt-0.5 shrink-0" />
                        {sub.teacherComment}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex flex-col gap-2">
              {canSubmit && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => openSubmitDialog(hw)}>
                  <Send className="size-3 mr-1" /> Submit
                </Button>
              )}
              {sub && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(hw)}>
                  <FileText className="size-3 mr-1" /> View
                </Button>
              )}
              {!sub && overdue && (
                <Badge variant="destructive" className="text-[10px]">Missed</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ---- Skeleton ----
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-36 mt-2" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Homework</h1>
        <p className="text-muted-foreground">View assignments, submit your work, and check grades</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard title="Total Assigned" value={totalAssigned} icon={ClipboardList} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Pending" value={pendingCount} icon={Clock} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
        <KpiCard title="Submitted" value={submittedCount} icon={Send} iconBgColor="bg-sky-100" iconColor="text-sky-600" />
        <KpiCard title="Graded" value={gradedCount} icon={Award} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All ({homeworkList.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="submitted">Submitted ({submittedCount})</TabsTrigger>
          <TabsTrigger value="graded">Graded ({gradedCount})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({homeworkList.filter(hw => !getSubmissionStatus(hw) && isOverdue(hw.dueDate, hw.status)).length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredList.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <BookOpen className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">
                  {activeTab === 'all' ? 'No homework assigned' :
                   activeTab === 'pending' ? 'No pending homework' :
                   activeTab === 'submitted' ? 'No submitted homework' :
                   activeTab === 'graded' ? 'No graded homework yet' :
                   'No overdue homework'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {activeTab === 'all'
                    ? 'Your teachers haven\'t assigned any homework yet.'
                    : 'Nothing to show in this category.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredList.map(renderHomeworkCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Submit Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-emerald-600" /> Submit Homework
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{selectedHw?.title}</span>
              {selectedHw?.subject && ` — ${selectedHw.subject.name}`}
              {' · '}Due: {selectedHw ? formatDate(selectedHw.dueDate) : ''}
              {' · '}{selectedHw?.totalMarks} marks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Homework description */}
            {selectedHw?.description && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm border">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <FileText className="size-3" /> Instructions
                </div>
                {selectedHw.description}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="answer-content">Your Answer *</Label>
              <Textarea
                id="answer-content"
                placeholder="Write your answer here..."
                value={answerContent}
                onChange={e => setAnswerContent(e.target.value)}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">Attachment (optional)</Label>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-6 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="text-center">
                  <Upload className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload or drag files</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, Images up to 10MB</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !answerContent.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Submitting...' : <><Send className="size-4 mr-2" /> Submit Homework</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {detailHw && (() => {
            const sub = getSubmissionStatus(detailHw);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="size-5 text-emerald-600" /> {detailHw.title}
                  </DialogTitle>
                  <DialogDescription>
                    {detailHw.subject?.name && `${detailHw.subject.name} · `}
                    {detailHw.class?.name && `${detailHw.class.name} · `}
                    Due: {formatDate(detailHw.dueDate)} · {detailHw.totalMarks} marks
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Description */}
                  {detailHw.description && (
                    <div className="rounded-lg bg-muted/50 p-4 text-sm border">
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2">
                        <FileText className="size-3" /> Instructions
                      </div>
                      {detailHw.description}
                    </div>
                  )}

                  {/* My Submission */}
                  {sub && (
                    <Card className={cn(sub.status === 'graded' && 'border-emerald-200 bg-emerald-50/30')}>
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-emerald-600" /> My Submission
                        </CardTitle>
                        <CardDescription className="text-xs">Submitted on {formatDateTime(sub.submittedAt)}</CardDescription>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        {sub.content && (
                          <div className="rounded-lg bg-white p-3 text-sm border">
                            {sub.content}
                          </div>
                        )}

                        {/* Grading result */}
                        {sub.status === 'graded' && (
                          <div className="border-t pt-3 space-y-2">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-emerald-600 text-[10px]">Graded</Badge>
                              <span className="text-sm font-bold text-emerald-700">{sub.score}/{detailHw.totalMarks}</span>
                              {sub.grade && <Badge variant="outline" className="text-[10px]">{sub.grade}</Badge>}
                              {sub.gradedAt && (
                                <span className="text-xs text-muted-foreground">
                                  Graded on {formatDateTime(sub.gradedAt)}
                                </span>
                              )}
                            </div>
                            {sub.teacherComment && (
                              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                                <div className="flex items-center gap-1 text-xs font-medium text-emerald-700 mb-1">
                                  <MessageSquare className="size-3" /> Teacher&apos;s Feedback
                                </div>
                                <p className="text-sm">{sub.teacherComment}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {sub.status === 'submitted' && (
                          <div className="flex items-center gap-2 text-sm text-blue-600">
                            <Clock className="size-4" />
                            <span>Awaiting grading...</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
