'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/shared/kpi-card';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen, Clock, AlertTriangle, CheckCircle2, FileText,
  MessageSquare, CalendarDays, Award, Eye, Users,
  ClipboardList, CircleX,
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
  submissions?: HomeworkSubmission[];
}

interface ApiStudent {
  id: string;
  admissionNo: string;
  parentIds: string | null;
  user: { name: string };
  class: { id: string; name: string } | null;
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

// ---- Component ----
export function ParentHomework() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  // Children
  const [children, setChildren] = useState<ApiStudent[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [childrenLoading, setChildrenLoading] = useState(true);

  // Homework data
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [childSubmissions, setChildSubmissions] = useState<Record<string, HomeworkSubmission>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailHw, setDetailHw] = useState<HomeworkItem | null>(null);

  // ---- Fetch children ----
  useEffect(() => {
    const fetchChildren = async () => {
      try {
        setChildrenLoading(true);
        const res = await fetch(`/api/students?schoolId=${schoolId}&limit=200`);
        if (res.ok) {
          const json = await res.json();
          const allStudents: ApiStudent[] = json.data || json || [];
          const myChildren = allStudents.filter(s =>
            s.parentIds && s.parentIds.includes(currentUser.id)
          );
          setChildren(myChildren.length > 0 ? myChildren : allStudents.slice(0, 3));
        }
      } catch {
        toast.error('Failed to load children');
      } finally {
        setChildrenLoading(false);
      }
    };
    if (schoolId) fetchChildren();
  }, [currentUser.id, schoolId]);

  // ---- Fetch homework ----
  const fetchHomework = useCallback(async () => {
    if (children.length === 0) return;
    const child = children[selectedChildIndex];
    if (!child) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        schoolId,
        studentId: child.id,
        limit: '100',
      });
      const res = await fetch(`/api/homework?${params}`);
      if (res.ok) {
        const json = await res.json();
        const hwList: HomeworkItem[] = json.data || [];
        setHomeworkList(hwList);

        // Build submission map from the submissions field
        const subMap: Record<string, HomeworkSubmission> = {};
        hwList.forEach(hw => {
          if (hw.submissions && hw.submissions.length > 0) {
            subMap[hw.id] = hw.submissions[0];
          }
        });
        setChildSubmissions(subMap);
      }
    } catch {
      toast.error('Failed to load homework');
    } finally {
      setLoading(false);
    }
  }, [children, selectedChildIndex, schoolId]);

  useEffect(() => {
    if (children.length > 0) fetchHomework();
  }, [fetchHomework, children]);

  // ---- Derived data ----
  const selectedChild = children[selectedChildIndex] || null;
  const childName = selectedChild?.user?.name || 'Child';
  const childClass = selectedChild?.class?.name || '—';

  const getSubmission = (hwId: string): HomeworkSubmission | null => {
    return childSubmissions[hwId] || null;
  };

  const filteredList = homeworkList.filter(hw => {
    const sub = getSubmission(hw.id);
    switch (statusFilter) {
      case 'submitted':
        return sub !== null;
      case 'graded':
        return sub !== null && sub.status === 'graded';
      case 'overdue':
        return sub === null && isOverdue(hw.dueDate, hw.status);
      case 'active':
        return sub === null && !isOverdue(hw.dueDate, hw.status);
      default:
        return true;
    }
  });

  // Stats
  const activeCount = homeworkList.filter(hw => !getSubmission(hw.id) && !isOverdue(hw.dueDate, hw.status)).length;
  const submittedCount = homeworkList.filter(hw => getSubmission(hw.id) !== null).length;
  const gradedCount = homeworkList.filter(hw => { const s = getSubmission(hw.id); return s && s.status === 'graded'; }).length;
  const overdueCount = homeworkList.filter(hw => !getSubmission(hw.id) && isOverdue(hw.dueDate, hw.status)).length;

  // ---- Skeleton ----
  if (childrenLoading || (loading && children.length > 0)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Homework Overview</h1>
          <p className="text-muted-foreground">
            {childName} — {childClass}
            {children.length > 1 && (
              <span className="ml-2 flex gap-1 inline-flex">
                {children.map((child, i) => (
                  <Badge
                    key={child.id}
                    variant={i === selectedChildIndex ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => { setSelectedChildIndex(i); setStatusFilter('all'); }}
                  >
                    {child.user.name.split(' ')[0]}
                  </Badge>
                ))}
              </span>
            )}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="graded">Graded</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard title="Active" value={activeCount} icon={BookOpen} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Submitted" value={submittedCount} icon={CheckCircle2} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard title="Graded" value={gradedCount} icon={Award} iconBgColor="bg-purple-100" iconColor="text-purple-600" />
        <KpiCard title="Overdue" value={overdueCount} icon={AlertTriangle} iconBgColor="bg-red-100" iconColor="text-red-600" />
      </div>

      {/* Homework Cards */}
      {filteredList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <BookOpen className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">
              {statusFilter === 'all' ? 'No homework assigned' :
               statusFilter === 'active' ? 'No active homework' :
               statusFilter === 'submitted' ? 'No submitted homework' :
               statusFilter === 'graded' ? 'No graded homework yet' :
               'No overdue homework'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {statusFilter === 'all'
                ? `${childName} hasn't been assigned any homework yet.`
                : 'Nothing to show in this category.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredList.map(hw => {
            const sub = getSubmission(hw.id);
            const overdue = isOverdue(hw.dueDate, hw.status);
            const dueSoon = isDueSoon(hw.dueDate);
            const days = getDaysRemaining(hw.dueDate);

            return (
              <Card key={hw.id} className={cn(
                'hover:shadow-md transition-shadow',
                overdue && !sub && 'border-red-200 bg-red-50/30',
                sub && sub.status === 'graded' && 'border-emerald-200 bg-emerald-50/30'
              )}>
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
                        {overdue && !sub ? <CircleX className="size-5" /> :
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

                        {/* Status line */}
                        {!sub && overdue && (
                          <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                            <CircleX className="size-3" /> Overdue — not submitted
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
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] hover:bg-emerald-100">
                              Score: {sub.score}/{hw.totalMarks}
                            </Badge>
                            {sub.grade && (
                              <Badge className="bg-emerald-600 text-[10px]">{sub.grade}</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* View button */}
                    {sub && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDetailHw(hw); setDetailOpen(true); }}
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                      >
                        <Eye className="size-4 mr-1" /> View
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog (Read-only) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {detailHw && (() => {
            const sub = getSubmission(detailHw.id);
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
                  {/* Instructions */}
                  {detailHw.description && (
                    <div className="rounded-lg bg-muted/50 p-4 text-sm border">
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2">
                        <FileText className="size-3" /> Instructions
                      </div>
                      {detailHw.description}
                    </div>
                  )}

                  {/* Child's Submission */}
                  {sub && (
                    <Card className={cn(sub.status === 'graded' && 'border-emerald-200 bg-emerald-50/30')}>
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="size-4 text-emerald-600" /> {childName}&apos;s Submission
                        </CardTitle>
                        <CardDescription className="text-xs">Submitted on {formatDateTime(sub.submittedAt)}</CardDescription>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        {sub.content && (
                          <div className="rounded-lg bg-white p-3 text-sm border">
                            {sub.content}
                          </div>
                        )}

                        {sub.status === 'graded' && (
                          <div className="border-t pt-3 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
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
                            <span>Awaiting grading by teacher...</span>
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
