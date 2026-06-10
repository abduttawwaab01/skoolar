'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { TimetableBuilder } from './timetable-builder';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Clock, Calendar, Users, MapPin, Plus, Trash2,
  BookText, AlertTriangle, Eye, EyeOff, Loader2, CheckCircle2, Ban,
} from 'lucide-react';

interface TimetableSlot {
  id: string; dayOfWeek: number; period: number; startTime: string; endTime: string;
  classId: string; subjectId: string; teacherId: string | null; room: string | null;
  isBreak: boolean; isCancelled: boolean; cancelReason: string | null; location: string | null;
  schemeOfWorkEntryId: string | null;
  class?: { id: string; name: string; section: string | null; grade: string | null };
  subject?: { id: string; name: string; code: string | null };
  teacher?: { id: string; user: { name: string } } | null;
  schemeOfWorkEntry?: {
    id: string; weekNumber: number; topic: string; subTopic: string | null;
    learningObjectives: string | null; status: string;
    schemeOfWork: { id: string; subjectId: string; classId: string };
  } | null;
}

interface TimetableInfo {
  id: string; name: string; isActive: boolean; isPublished: boolean;
  description: string | null; weekStartDate: string | null; weekEndDate: string | null;
  termId: string | null; academicYearId: string;
  _count?: { slots: number };
  academicYear?: { id: string; name: string };
  term?: { id: string; name: string };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PERIOD_COLORS = [
  'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
  'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800',
  'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800',
  'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800',
  'bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:border-fuchsia-800',
  'bg-lime-50 border-lime-200 dark:bg-lime-950/30 dark:border-lime-800',
  'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
  'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800',
];

function getSubjectColor(subjectId: string): string {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) {
    hash = ((hash << 5) - hash) + subjectId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PERIOD_COLORS.length;
  return PERIOD_COLORS[index];
}

function SlotCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border animate-pulse">
      <Skeleton className="h-10 w-12 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

function TimetableGridSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <SlotCardSkeleton key={i} />)}
      </CardContent>
    </Card>
  );
}

export function TimetableView() {
  const { currentUser, selectedSchoolId, currentRole } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const queryClient = useQueryClient();

  const [selectedTimetable, setSelectedTimetable] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');
  const [showConflicts, setShowConflicts] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [detailSlot, setDetailSlot] = useState<TimetableSlot | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const timetableQuery = useQuery({
    queryKey: ['timetable-init', schoolId],
    queryFn: async () => {
      const res = await fetch(`/api/timetable?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    enabled: !!schoolId,
  });

  const slotsQuery = useQuery({
    queryKey: ['timetable-slots', selectedTimetable],
    queryFn: async () => {
      const res = await fetch(`/api/timetable/${selectedTimetable}`);
      if (!res.ok) throw new Error('Failed to load slots');
      return res.json();
    },
    enabled: !!selectedTimetable,
  });

  const conflictsQuery = useQuery({
    queryKey: ['timetable-conflicts', schoolId, selectedTimetable],
    queryFn: async () => {
      const params = new URLSearchParams({ schoolId });
      if (selectedTimetable) params.set('timetableId', selectedTimetable);
      const res = await fetch(`/api/timetable/conflicts?${params}`);
      if (!res.ok) throw new Error('Failed to check conflicts');
      return res.json();
    },
    enabled: !!schoolId,
    refetchInterval: 30000,
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/timetable/${selectedTimetable}/publish`, { method: 'POST' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['timetable-init'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const res = await fetch(`/api/timetable/${selectedTimetable}/slots/${slotId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete slot');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Slot deleted');
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-init'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ slotId, isCancelled, cancelReason }: { slotId: string; isCancelled: boolean; cancelReason?: string }) => {
      const res = await fetch(`/api/timetable/${selectedTimetable}/slots/${slotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCancelled, cancelReason }),
      });
      if (!res.ok) throw new Error('Failed to update slot');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Slot updated');
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] });
      setDetailDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const timetables: TimetableInfo[] = timetableQuery.data?.data || [];
  const classes = timetableQuery.data?.classes || [];
  const subjects = timetableQuery.data?.subjects || [];
  const teachers = timetableQuery.data?.teachers || [];
  const userProfile = timetableQuery.data?.userProfile || null;
  const slots: TimetableSlot[] = slotsQuery.data?.slots || [];

  const activeTimetable = timetables.find(t => t.id === selectedTimetable);
  const conflictCounts = conflictsQuery.data?.counts || { total: 0 };
  const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR'].includes(currentRole);
  const isTeacher = currentRole === 'TEACHER';

  useEffect(() => {
    if (timetables.length > 0 && !selectedTimetable) {
      setSelectedTimetable(timetables[0].id);
    }
    if (userProfile?.classId && currentRole === 'STUDENT') {
      setSelectedClass(userProfile.classId);
    } else if (classes.length > 0 && !selectedClass && currentRole !== 'TEACHER') {
      setSelectedClass(classes[0]?.id || '');
    }
  }, [timetables, userProfile, currentRole]);

  const filteredSlots = useMemo(() => {
    let filtered = slots;
    if (currentRole === 'TEACHER' && userProfile?.teacherId) {
      filtered = filtered.filter(s => s.teacherId === userProfile.teacherId);
    } else if (selectedClass) {
      filtered = filtered.filter(s => s.classId === selectedClass);
    }
    return filtered.filter(s => s.dayOfWeek === selectedDay).sort((a, b) => a.period - b.period);
  }, [slots, selectedClass, selectedDay, currentRole, userProfile]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 1; i <= 5; i++) days.push(i);
    return days;
  }, []);

  const getSubjectName = useCallback((subjectId: string) => {
    return subjects.find((s: { id: string; name: string }) => s.id === subjectId)?.name || '—';
  }, [subjects]);

  const getTeacherName = useCallback((teacherId: string | null) => {
    if (!teacherId) return null;
    return teachers.find((t: { id: string; user: { name: string } }) => t.id === teacherId)?.user?.name || null;
  }, [teachers]);

  const getClassName = useCallback((classId: string) => {
    return classes.find((c: { id: string; name: string }) => c.id === classId)?.name || '—';
  }, [classes]);

  const getSlotsForDay = useCallback((day: number) => {
    let daySlots = slots.filter(s => s.dayOfWeek === day);
    if (currentRole === 'TEACHER' && userProfile?.teacherId) {
      daySlots = daySlots.filter(s => s.teacherId === userProfile.teacherId);
    } else if (selectedClass) {
      daySlots = daySlots.filter(s => s.classId === selectedClass);
    }
    return daySlots;
  }, [slots, selectedClass, currentRole, userProfile]);

  if (!schoolId || timetableQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        </div>
        <TimetableGridSkeleton />
      </div>
    );
  }

  if (timetableQuery.error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Timetable</h1></div>
        <Card><CardContent className="p-12 text-center">
          <AlertTriangle className="size-12 mx-auto text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">Failed to load timetable data</p>
          <Button onClick={() => timetableQuery.refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  if (viewMode === 'edit') {
    return (
      <TimetableBuilder
        schoolId={schoolId}
        timetables={timetables}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        academicYears={timetableQuery.data?.academicYears || []}
        terms={timetableQuery.data?.terms || []}
        onSaved={() => { setViewMode('view'); queryClient.invalidateQueries(); }}
        onCancel={() => setViewMode('view')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Timetable</h1>
          <p className="text-muted-foreground">
            {isTeacher ? 'Your teaching schedule' : activeTimetable?.isPublished ? 'Published schedule' : 'Draft timetable'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setShowConflicts(true); conflictsQuery.refetch(); }}>
                <AlertTriangle className="size-4 mr-1" />
                {conflictCounts.total > 0 ? `${conflictCounts.total} Conflicts` : 'No Conflicts'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => publishMutation.mutate()}>
                {activeTimetable?.isPublished ? <><EyeOff className="size-4 mr-1" /> Unpublish</> : <><Eye className="size-4 mr-1" /> Publish</>}
              </Button>
              <Button variant="default" size="sm" onClick={() => setViewMode('edit')}>
                <Plus className="size-4 mr-1" /> Edit
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Timetable</CardDescription></CardHeader>
          <CardContent>
            <Select value={selectedTimetable} onValueChange={setSelectedTimetable}>
              <SelectTrigger><SelectValue placeholder="Select timetable" /></SelectTrigger>
              <SelectContent>
                {timetables.map((t: TimetableInfo) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      {t.name}
                      {t.isPublished ? <CheckCircle2 className="size-3 text-green-500" /> : <EyeOff className="size-3 text-muted-foreground" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {timetables.length === 0 && <p className="text-xs text-muted-foreground mt-2">No timetables yet</p>}
          </CardContent>
        </Card>

        {!isTeacher && currentRole !== 'STUDENT' && (
          <Card>
            <CardHeader className="pb-2"><CardDescription>Class</CardDescription></CardHeader>
            <CardContent>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Classes</SelectItem>
                  {classes.map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardDescription>Day</CardDescription></CardHeader>
          <CardContent>
            <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
              <SelectContent>
                {weekDays.map((d) => (
                  <SelectItem key={d} value={String(d)}>{DAYS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardDescription>Periods</CardDescription></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSlots.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeTimetable?._count ? `${activeTimetable._count.slots} total slots` : 'slots scheduled'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-2">
        {weekDays.map((d) => {
          const daySlots = getSlotsForDay(d);
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={cn(
                "p-2 rounded-lg text-center transition-all",
                selectedDay === d ? "bg-primary text-primary-foreground shadow-md" : "bg-muted hover:bg-muted/80"
              )}
            >
              <div className="text-xs font-medium">{DAYS_SHORT[d]}</div>
              <div className="text-lg font-bold">{daySlots.length}</div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={selectedDay} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5" />
                {DAYS[selectedDay]}
              </CardTitle>
              <CardDescription>
                {selectedClass ? getClassName(selectedClass) : (isTeacher ? 'My schedule' : 'All classes')}
                {activeTimetable && ` · ${activeTimetable.name}`}
                {activeTimetable?.description && ` · ${activeTimetable.description}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slotsQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <SlotCardSkeleton key={i} />)}
                </div>
              ) : filteredSlots.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="size-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No classes scheduled for this day</p>
                  {isAdmin && (
                    <Button className="mt-4" variant="outline" onClick={() => setViewMode('edit')}>
                      <Plus className="size-4 mr-2" /> Add Slots
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSlots.map((slot) => (
                    <motion.div
                      key={slot.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md",
                        slot.isCancelled ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800 opacity-60" : "",
                        slot.isBreak ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" : getSubjectColor(slot.subjectId)
                      )}
                      onClick={() => { setDetailSlot(slot); setDetailDialogOpen(true); }}
                    >
                      <div className="w-16 text-center shrink-0">
                        <div className={cn("text-lg font-bold", slot.isCancelled && "line-through")}>P{slot.period}</div>
                        <div className="text-xs text-muted-foreground font-mono">{slot.startTime}-{slot.endTime}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {slot.isBreak ? (
                          <div className="font-medium text-amber-700">Break / Assembly</div>
                        ) : (
                          <>
                            <div className={cn("font-bold", slot.isCancelled && "line-through text-muted-foreground")}>
                              {getSubjectName(slot.subjectId)}
                              {slot.isCancelled && <span className="ml-2 text-xs text-red-500">(Cancelled)</span>}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                              {slot.teacherId && (
                                <span className="flex items-center gap-1"><Users className="size-3" />{getTeacherName(slot.teacherId)}</span>
                              )}
                              {slot.room && (
                                <span className="flex items-center gap-1"><MapPin className="size-3" />{slot.room}</span>
                              )}
                            </div>
                          </>
                        )}
                        {slot.schemeOfWorkEntry?.topic && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-purple-600 cursor-help">
                                  <BookText className="size-3" />
                                  <span className="line-clamp-1">{slot.schemeOfWorkEntry.topic}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <div className="space-y-1 text-xs">
                                  <p className="font-semibold">Week {slot.schemeOfWorkEntry.weekNumber}: {slot.schemeOfWorkEntry.topic}</p>
                                  {slot.schemeOfWorkEntry.subTopic && <p className="text-muted-foreground">{slot.schemeOfWorkEntry.subTopic}</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {slot.isBreak && <Badge variant="secondary">Break</Badge>}
                        {slot.isCancelled ? <Badge variant="destructive">Cancelled</Badge> : <Badge>{getClassName(slot.classId)}</Badge>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Week at a Glance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-medium text-muted-foreground w-20">Period</th>
                  {weekDays.map(d => (
                    <th key={d} className={cn("p-2 text-center font-medium", selectedDay === d && "text-primary")}>
                      {DAYS_SHORT[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(period => (
                  <tr key={period} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground font-mono text-xs">P{period}</td>
                    {weekDays.map(d => {
                      const slot = slots.find(s => s.dayOfWeek === d && s.period === period && (!selectedClass || s.classId === selectedClass) && (!userProfile?.teacherId || s.teacherId === userProfile.teacherId));
                      return (
                        <td key={d} className="p-1">
                          {slot && (
                            <div
                              className={cn(
                                "text-xs p-1.5 rounded cursor-pointer truncate max-w-[120px]",
                                slot.isCancelled ? "bg-red-100 text-red-700 line-through" : "",
                                slot.isBreak ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary",
                              )}
                              onClick={() => { setDetailSlot(slot); setDetailDialogOpen(true); }}
                              title={slot.isBreak ? 'Break' : `${getSubjectName(slot.subjectId)}${slot.teacherId ? ` - ${getTeacherName(slot.teacherId)}` : ''}`}
                            >
                              {slot.isBreak ? 'Break' : getSubjectName(slot.subjectId)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Slot Details</DialogTitle>
            <DialogDescription>Period {detailSlot?.period} · {detailSlot ? DAYS[detailSlot.dayOfWeek] : ''}</DialogDescription>
          </DialogHeader>
          {detailSlot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Time:</span><br /><span className="font-mono font-medium">{detailSlot.startTime} - {detailSlot.endTime}</span></div>
                <div><span className="text-muted-foreground">Subject:</span><br /><span className="font-medium">{getSubjectName(detailSlot.subjectId)}</span></div>
                <div><span className="text-muted-foreground">Class:</span><br /><span className="font-medium">{getClassName(detailSlot.classId)}</span></div>
                <div><span className="text-muted-foreground">Teacher:</span><br /><span className="font-medium">{getTeacherName(detailSlot.teacherId) || 'Not assigned'}</span></div>
                <div><span className="text-muted-foreground">Room:</span><br /><span className="font-medium">{detailSlot.room || 'Not specified'}</span></div>
                {detailSlot.location && <div><span className="text-muted-foreground">Location:</span><br /><span className="font-medium">{detailSlot.location}</span></div>}
                <div><span className="text-muted-foreground">Break:</span><br /><span>{detailSlot.isBreak ? 'Yes' : 'No'}</span></div>
                <div><span className="text-muted-foreground">Status:</span><br />
                  {detailSlot.isCancelled
                    ? <Badge variant="destructive">Cancelled{detailSlot.cancelReason ? `: ${detailSlot.cancelReason}` : ''}</Badge>
                    : <Badge variant="default">Active</Badge>
                  }
                </div>
              </div>
              {detailSlot.schemeOfWorkEntry && (
                <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
                  <p className="text-sm font-medium text-purple-700 flex items-center gap-1"><BookText className="size-4" />Scheme of Work</p>
                  <p className="text-xs text-purple-600 mt-1">Week {detailSlot.schemeOfWorkEntry.weekNumber}: {detailSlot.schemeOfWorkEntry.topic}</p>
                </div>
              )}
              {isAdmin && (
                <div className="flex gap-2 pt-2 border-t">
                  {detailSlot.isCancelled ? (
                    <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate({ slotId: detailSlot.id, isCancelled: false })}>
                      <CheckCircle2 className="size-4 mr-1" /> Restore Slot
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-amber-600" onClick={() => cancelMutation.mutate({ slotId: detailSlot.id, isCancelled: true, cancelReason: 'Cancelled by admin' })}>
                      <Ban className="size-4 mr-1" /> Cancel Slot
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => { setDeleteConfirm(detailSlot.id); setDetailDialogOpen(false); }}>
                    <Trash2 className="size-4 mr-1" /> Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Slot?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The slot will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => { if (deleteConfirm) deleteSlotMutation.mutate(deleteConfirm); setDeleteConfirm(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Schedule Conflicts
            </DialogTitle>
            <DialogDescription>
              {conflictCounts.total > 0 ? `${conflictCounts.total} conflict(s) detected` : 'No conflicts found'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {conflictsQuery.isLoading && <div className="text-center py-4"><Loader2 className="size-6 animate-spin mx-auto" /></div>}
            {conflictsQuery.data?.conflicts?.teacher?.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2">Teacher Conflicts ({conflictCounts.teacher})</h4>
                {conflictsQuery.data.conflicts.teacher.map((c: { teacherId: string; teacherName: string; dayOfWeek: number; slots: Array<{ startTime: string; endTime: string; subject: string; class: string; timetable: string }> }, i: number) => (
                  <div key={i} className="text-sm bg-red-50 dark:bg-red-950/20 p-2 rounded mb-2">
                    <p className="font-medium">{c.teacherName} — {DAYS[c.dayOfWeek]}</p>
                    {c.slots.map((s, j) => (
                      <p key={j} className="text-muted-foreground ml-2 text-xs">{s.startTime}-{s.endTime}: {s.subject} ({s.class}) [{s.timetable}]</p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {conflictsQuery.data?.conflicts?.room?.length > 0 && (
              <div>
                <h4 className="font-medium text-amber-600 mb-2">Room Conflicts ({conflictCounts.room})</h4>
                {conflictsQuery.data.conflicts.room.map((c: { room: string; dayOfWeek: number; slots: Array<{ startTime: string; endTime: string; subject: string; class: string }> }, i: number) => (
                  <div key={i} className="text-sm bg-amber-50 dark:bg-amber-950/20 p-2 rounded mb-2">
                    <p className="font-medium">Room {c.room} — {DAYS[c.dayOfWeek]}</p>
                    {c.slots.map((s, j) => (
                      <p key={j} className="text-muted-foreground ml-2 text-xs">{s.startTime}-{s.endTime}: {s.subject} ({s.class})</p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {conflictsQuery.data?.conflicts?.class?.length > 0 && (
              <div>
                <h4 className="font-medium text-blue-600 mb-2">Class Double-Booking ({conflictCounts.class})</h4>
                {conflictsQuery.data.conflicts.class.map((c: { classId: string; className: string; dayOfWeek: number; slots: Array<{ startTime: string; endTime: string; subject: string }> }, i: number) => (
                  <div key={i} className="text-sm bg-blue-50 dark:bg-blue-950/20 p-2 rounded mb-2">
                    <p className="font-medium">{c.className} — {DAYS[c.dayOfWeek]}</p>
                    {c.slots.map((s, j) => (
                      <p key={j} className="text-muted-foreground ml-2 text-xs">{s.startTime}-{s.endTime}: {s.subject}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {conflictCounts.total === 0 && !conflictsQuery.isLoading && (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="size-8 mx-auto mb-2 text-green-500" />
                <p>No scheduling conflicts detected. Everything looks good!</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
