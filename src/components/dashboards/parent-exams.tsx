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
  GraduationCap, Clock, AlertTriangle, CheckCircle2, FileText,
  CalendarDays, Award, Eye, BarChart3, CircleX,
} from 'lucide-react';

interface ExamItem {
  id: string;
  name: string;
  type: string;
  totalMarks: number;
  passingMarks: number;
  date: string | null;
  duration: number | null;
  isLocked: boolean;
  isPublished: boolean;
  subject: { id: string; name: string; code: string } | null;
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  term: { id: string; name: string } | null;
  studentHasScore?: boolean;
  _count?: { scores: number };
}

interface ApiStudent {
  id: string;
  admissionNo: string;
  user: { name: string };
  class: { id: string; name: string } | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ParentExams() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [children, setChildren] = useState<ApiStudent[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [childrenLoading, setChildrenLoading] = useState(true);

  const [examList, setExamList] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailExam, setDetailExam] = useState<ExamItem | null>(null);

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        setChildrenLoading(true);
        const res = await fetch(`/api/parent/children?schoolId=${schoolId}`);
        if (res.ok) {
          const json = await res.json();
          setChildren(json.data || []);
        }
      } catch {
        toast.error('Failed to load children');
      } finally {
        setChildrenLoading(false);
      }
    };
    if (schoolId) fetchChildren();
  }, [currentUser.id, schoolId]);

  const fetchExams = useCallback(async () => {
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
      const res = await fetch(`/api/exams?${params}`);
      if (res.ok) {
        const json = await res.json();
        setExamList(json.data || []);
      }
    } catch {
      toast.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  }, [children, selectedChildIndex, schoolId]);

  useEffect(() => {
    if (children.length > 0) fetchExams();
  }, [fetchExams, children]);

  const selectedChild = children[selectedChildIndex] || null;
  const childName = selectedChild?.user?.name || 'Child';
  const childClass = selectedChild?.class?.name || '—';

  const hasScore = (exam: ExamItem): boolean =>
    exam.studentHasScore !== undefined ? exam.studentHasScore : (exam._count?.scores ?? 0) > 0;

  const filteredList = examList.filter(exam => {
    const scored = hasScore(exam);
    switch (statusFilter) {
      case 'upcoming':
        return !scored && (!exam.date || new Date(exam.date) >= new Date());
      case 'completed':
        return scored;
      case 'pending':
        return !scored && exam.date && new Date(exam.date) < new Date();
      default:
        return true;
    }
  });

  const completedCount = examList.filter(hasScore).length;
  const upcomingCount = examList.filter(e => !hasScore(e) && (!e.date || new Date(e.date) >= new Date())).length;
  const pendingCount = examList.filter(e => !hasScore(e) && e.date && new Date(e.date) < new Date()).length;

  if (childrenLoading || (loading && children.length > 0)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tests &amp; Exams Overview</h1>
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
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <KpiCard title="Completed" value={completedCount} icon={CheckCircle2} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard title="Upcoming" value={upcomingCount} icon={CalendarDays} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Pending" value={pendingCount} icon={AlertTriangle} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
      </div>

      {filteredList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <GraduationCap className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">
              {statusFilter === 'all' ? 'No exams scheduled' :
               statusFilter === 'upcoming' ? 'No upcoming exams' :
               statusFilter === 'completed' ? 'No completed exams' :
               'No pending exams'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Nothing to show in this category.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredList.map(exam => {
            const scored = hasScore(exam);
            return (
              <Card key={exam.id} className={cn(
                'hover:shadow-md transition-shadow',
                scored && 'border-emerald-200 bg-emerald-50/30'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl mt-0.5',
                        scored ? 'bg-emerald-100 text-emerald-600' :
                        'bg-slate-100 text-slate-600'
                      )}>
                        {scored ? <CheckCircle2 className="size-5" /> : <BarChart3 className="size-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm leading-tight">{exam.name}</h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                          {exam.subject && <Badge variant="outline" className="text-[10px]">{exam.subject.name}</Badge>}
                          {exam.class && <span>{exam.class.name}</span>}
                          {exam.date && (
                            <span className="flex items-center gap-0.5">
                              <CalendarDays className="size-3" /> {formatDate(exam.date)}
                            </span>
                          )}
                          {exam.duration && <span>{exam.duration} min</span>}
                          <span>{exam.totalMarks} marks</span>
                        </div>
                        {scored && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px] mt-1.5 hover:bg-emerald-100">
                            Completed
                          </Badge>
                        )}
                        {!scored && exam.date && new Date(exam.date) < new Date() && (
                          <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                            <Clock className="size-3" /> Awaiting result
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDetailExam(exam); setDetailOpen(true); }}
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                    >
                      <Eye className="size-4 mr-1" /> View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {detailExam && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="size-5 text-emerald-600" /> {detailExam.name}
                </DialogTitle>
                <DialogDescription>
                  {detailExam.subject?.name && `${detailExam.subject.name} · `}
                  {detailExam.class?.name && `${detailExam.class.name} · `}
                  {detailExam.date && `${formatDate(detailExam.date)} · `}
                  {detailExam.totalMarks} marks{detailExam.passingMarks ? ` · Pass: ${detailExam.passingMarks}` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 text-sm border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Type</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{detailExam.type}</Badge>
                  </div>
                  {detailExam.duration && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Duration</span>
                      <span className="text-sm font-medium">{detailExam.duration} minutes</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Total Marks</span>
                    <span className="text-sm font-medium">{detailExam.totalMarks}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Passing Marks</span>
                    <span className="text-sm font-medium">{detailExam.passingMarks}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Status</span>
                    {hasScore(detailExam) ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Completed</Badge>
                    ) : detailExam.isPublished ? (
                      <Badge className="bg-blue-100 text-blue-700 text-[10px]">Published</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Draft</Badge>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
