'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Calendar, MapPin, Users, BookText } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PERIOD_COLORS = [
  'border-l-blue-400 bg-blue-50/50',
  'border-l-emerald-400 bg-emerald-50/50',
  'border-l-violet-400 bg-violet-50/50',
  'border-l-rose-400 bg-rose-50/50',
  'border-l-amber-400 bg-amber-50/50',
  'border-l-cyan-400 bg-cyan-50/50',
  'border-l-fuchsia-400 bg-fuchsia-50/50',
];

function getColor(subjectId: string): string {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) { hash = ((hash << 5) - hash) + subjectId.charCodeAt(i); hash |= 0; }
  return PERIOD_COLORS[Math.abs(hash) % PERIOD_COLORS.length];
}

interface StudentSlot {
  student: { id: string; firstName: string; lastName: string; classId: string | null; class?: { id: string; name: string } | null };
  slots: Array<{
    id: string; dayOfWeek: number; period: number; startTime: string; endTime: string;
    subjectId: string; teacherId: string | null; room: string | null; isBreak: boolean;
    isCancelled: boolean;
    subject?: { id: string; name: string; code: string | null };
    teacher?: { id: string; user: { name: string } } | null;
  }>;
}

export function ParentTimetable() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || '';
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedChild, setSelectedChild] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-schedule', schoolId],
    queryFn: async () => {
      const res = await fetch(`/api/timetable/my-schedule?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    enabled: !!schoolId,
  });

  const children = data?.children || [];
  const scheduleData: StudentSlot[] = data?.data || [];

  useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [children, selectedChild]);

  const activeChildData = useMemo(() => {
    return scheduleData.find((s: StudentSlot) => s.student.id === selectedChild);
  }, [scheduleData, selectedChild]);

  const activeChild = useMemo(() => {
    return children.find((c: { id: string }) => c.id === selectedChild);
  }, [children, selectedChild]);

  const slots = activeChildData?.slots || [];
  const weekDays = [1, 2, 3, 4, 5];

  const getSlotsForDay = (day: number) =>
    slots.filter((s) => s.dayOfWeek === day && !s.isCancelled)
      .sort((a, b) => a.period - b.period);

  const currentDaySlots = useMemo(() => getSlotsForDay(selectedDay), [slots, selectedDay]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-1" />
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent></Card>
      </div>
    );
  }

  if (error) {
    return <Card><CardContent className="p-12 text-center"><p className="text-muted-foreground">Could not load timetable</p></CardContent></Card>;
  }

  if (children.length === 0) {
    return (
      <Card><CardContent className="p-12 text-center">
        <Calendar className="size-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">No children found. Link your children to see their timetables.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Children Timetables</h1>
          <p className="text-muted-foreground">View your children&apos;s weekly class schedules</p>
        </div>
        {children.length > 1 && (
          <div className="w-60">
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
              <SelectContent>
                {children.map((c: { id: string; firstName: string; lastName: string; class?: { name: string } | null }) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} {c.class ? `(${c.class.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {activeChild && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm py-1.5">
            {activeChild.firstName} {activeChild.lastName}
          </Badge>
          {activeChild.class && <Badge variant="secondary">{activeChild.class.name}</Badge>}
        </div>
      )}

      <div className="grid grid-cols-5 gap-2">
        {weekDays.map((d) => {
          const count = slots.filter((s) => s.dayOfWeek === d && !s.isCancelled).length;
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={cn("p-3 rounded-lg text-center transition-all", selectedDay === d ? "bg-primary text-primary-foreground shadow" : "bg-muted hover:bg-muted/80")}
            >
              <div className="text-xs font-medium">{DAYS_SHORT[d]}</div>
              <div className="text-lg font-bold">{count}</div>
            </button>
          );
        })}
      </div>

      <motion.div key={`${selectedChild}-${selectedDay}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2"><Calendar className="size-5" />{DAYS[selectedDay]}</CardTitle>
            <CardDescription>{currentDaySlots.length} class(es) scheduled</CardDescription>
          </CardHeader>
          <CardContent>
            {currentDaySlots.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No classes on this day</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentDaySlots.map((slot) => (
                  <motion.div
                    key={slot.id}
                    layout
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-l-4 transition-all",
                      slot.isBreak ? "border-l-amber-400 bg-amber-50/50" : getColor(slot.subjectId)
                    )}
                  >
                    <div className="w-14 text-center shrink-0">
                      <div className="text-base font-bold">P{slot.period}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{slot.startTime}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {slot.isBreak ? (
                        <div className="font-medium text-amber-700">Break</div>
                      ) : (
                        <>
                          <div className="font-semibold">{slot.subject?.name || 'Subject'}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                            {slot.teacher && <span className="flex items-center gap-1"><Users className="size-3" />{slot.teacher.user.name}</span>}
                            {slot.room && <span className="flex items-center gap-1"><MapPin className="size-3" />{slot.room}</span>}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{slot.endTime}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
