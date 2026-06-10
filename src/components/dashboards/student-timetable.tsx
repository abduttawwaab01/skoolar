'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Users, BookText, Calendar } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PERIOD_COLORS = [
  'border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/10',
  'border-l-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10',
  'border-l-violet-400 bg-violet-50/50 dark:bg-violet-950/10',
  'border-l-rose-400 bg-rose-50/50 dark:bg-rose-950/10',
  'border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/10',
  'border-l-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/10',
  'border-l-fuchsia-400 bg-fuchsia-50/50 dark:bg-fuchsia-950/10',
  'border-l-lime-400 bg-lime-50/50 dark:bg-lime-950/10',
  'border-l-orange-400 bg-orange-50/50 dark:bg-orange-950/10',
  'border-l-teal-400 bg-teal-50/50 dark:bg-teal-950/10',
];

function getColor(subjectId: string): string {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) { hash = ((hash << 5) - hash) + subjectId.charCodeAt(i); hash |= 0; }
  return PERIOD_COLORS[Math.abs(hash) % PERIOD_COLORS.length];
}

function getCurrentPeriod(periods: Array<{ period: number; startTime: string; endTime: string }>): number | null {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const current = `${hours}:${minutes}`;
  for (const p of periods) {
    if (current >= p.startTime && current < p.endTime) return p.period;
  }
  return null;
}

const DEFAULT_PERIODS = [
  { period: 1, startTime: '08:00', endTime: '08:40' },
  { period: 2, startTime: '08:40', endTime: '09:20' },
  { period: 3, startTime: '09:20', endTime: '10:00' },
  { period: 4, startTime: '10:00', endTime: '10:40' },
  { period: 5, startTime: '10:40', endTime: '11:20' },
  { period: 6, startTime: '11:20', endTime: '12:00' },
  { period: 7, startTime: '12:00', endTime: '12:40' },
  { period: 8, startTime: '12:40', endTime: '13:20' },
  { period: 9, startTime: '13:20', endTime: '14:00' },
  { period: 10, startTime: '14:00', endTime: '14:40' },
];

export function StudentTimetable() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || '';
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() || 1);
  const [currentPeriod, setCurrentPeriod] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-schedule', schoolId],
    queryFn: async () => {
      const res = await fetch(`/api/timetable/my-schedule?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    enabled: !!schoolId,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPeriod(getCurrentPeriod(DEFAULT_PERIODS));
    }, 60000);
    setCurrentPeriod(getCurrentPeriod(DEFAULT_PERIODS));
    return () => clearInterval(timer);
  }, []);

  const slots = data?.data || [];
  const weekDays = [1, 2, 3, 4, 5];

  const getSlotsForDay = (day: number) =>
    slots.filter((s: { dayOfWeek: number; isCancelled: boolean }) => s.dayOfWeek === day && !s.isCancelled)
      .sort((a: { period: number }, b: { period: number }) => a.period - b.period);

  const currentDaySlots = useMemo(() => getSlotsForDay(selectedDay), [slots, selectedDay]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-1" /></div>
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent></Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card><CardContent className="p-12 text-center">
        <p className="text-muted-foreground">Could not load your timetable</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Timetable</h1>
        <p className="text-muted-foreground">Your weekly class schedule</p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {weekDays.map((d) => {
          const count = slots.filter((s: { dayOfWeek: number; isCancelled: boolean }) => s.dayOfWeek === d && !s.isCancelled).length;
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={cn("p-3 rounded-lg text-center transition-all", selectedDay === d ? "bg-primary text-primary-foreground shadow" : "bg-muted hover:bg-muted/80")}
            >
              <div className="text-xs font-medium">{DAYS_SHORT[d]}</div>
              <div className="text-lg font-bold">{count}</div>
              <div className="text-[10px] opacity-70">classes</div>
            </button>
          );
        })}
      </div>

      <motion.div key={selectedDay} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2"><Calendar className="size-5" />{DAYS[selectedDay]}</CardTitle>
            <CardDescription>{currentDaySlots.length} class(es) scheduled</CardDescription>
          </CardHeader>
          <CardContent>
            {currentDaySlots.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No classes today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentDaySlots.map((slot: {
                  id: string; period: number; startTime: string; endTime: string;
                  subjectId: string; teacherId: string | null; room: string | null;
                  isBreak: boolean; location: string | null;
                  subject?: { id: string; name: string; code: string | null };
                  teacher?: { id: string; user: { name: string } } | null;
                  schemeOfWorkEntry?: { weekNumber: number; topic: string } | null;
                }) => {
                  const isCurrent = currentPeriod === slot.period;
                  return (
                    <motion.div
                      key={slot.id}
                      layout
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-l-4 transition-all",
                        slot.isBreak ? "border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/10" : getColor(slot.subjectId),
                        isCurrent && "ring-2 ring-primary/30 shadow-sm"
                      )}
                    >
                      <div className="w-14 text-center shrink-0">
                        <div className={cn("text-base font-bold", isCurrent && "text-primary")}>P{slot.period}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{slot.startTime}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {slot.isBreak ? (
                          <div className="font-medium text-amber-700">Break</div>
                        ) : (
                          <>
                            <div className="font-semibold">{slot.subject?.name || 'Subject'}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                              {slot.teacher && <span className="flex items-center gap-1"><Users className="size-3" />{slot.teacher.user.name}</span>}
                              {slot.room && <span className="flex items-center gap-1"><MapPin className="size-3" />{slot.room}</span>}
                            </div>
                            {slot.schemeOfWorkEntry?.topic && (
                              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-purple-600">
                                <BookText className="size-3" /><span className="line-clamp-1">{slot.schemeOfWorkEntry.topic}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{slot.endTime}</div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Week Overview</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="p-1.5 text-left text-muted-foreground">Period</th>
                {weekDays.map(d => <th key={d} className={cn("p-1.5 text-center", selectedDay === d && "text-primary font-bold")}>{DAYS_SHORT[d]}</th>)}
              </tr>
            </thead>
            <tbody>
              {DEFAULT_PERIODS.map(({ period }) => (
                <tr key={period} className="border-b last:border-0">
                  <td className="p-1 text-muted-foreground font-mono">P{period}</td>
                  {weekDays.map(d => {
                    const slot = slots.find((s: { dayOfWeek: number; period: number; isCancelled: boolean }) => s.dayOfWeek === d && s.period === period && !s.isCancelled);
                    return (
                      <td key={d} className="p-1">
                        {slot && (
                          <div className={cn("p-1 rounded text-center truncate max-w-[80px]", slot.isBreak ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary font-medium")}>
                            {slot.isBreak ? 'Break' : slot.subject?.name?.slice(0, 6) || ''}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
