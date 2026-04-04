'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock,
  MapPin, Users, Check, HelpCircle, X, Sparkles,
  Palette, CalendarDays, GraduationCap, Trophy, BookOpen,
  FileText, MessageSquare, Heart, Trash2, CalendarRange
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== TYPES ====================
interface CalendarEvent {
  id: string; schoolId: string; title: string; description: string | null;
  startDate: string; endDate: string | null; location: string | null;
  type: string; isAllDay: boolean; color: string;
  createdBy: string | null; createdAt: string; updatedAt: string;
  rsvps?: EventRSVP[];
  _rsvpStatus?: string;
}

interface EventRSVP {
  id: string; eventId: string; userId: string; status: string; createdAt: string;
}

// ==================== CONSTANTS ====================
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EVENT_TYPES = [
  { value: 'academic', label: 'Academic', icon: <GraduationCap className="h-3.5 w-3.5" />, color: '#0891B2' },
  { value: 'sports', label: 'Sports', icon: <Trophy className="h-3.5 w-3.5" />, color: '#059669' },
  { value: 'cultural', label: 'Cultural', icon: <Sparkles className="h-3.5 w-3.5" />, color: '#7C3AED' },
  { value: 'holiday', label: 'Holiday', icon: <CalendarDays className="h-3.5 w-3.5" />, color: '#DC2626' },
  { value: 'exam', label: 'Exam', icon: <FileText className="h-3.5 w-3.5" />, color: '#D97706' },
  { value: 'meeting', label: 'Meeting', icon: <Users className="h-3.5 w-3.5" />, color: '#7C3AED' },
  { value: 'ptc', label: 'Parent-Teacher', icon: <MessageSquare className="h-3.5 w-3.5" />, color: '#BE185D' },
  { value: 'general', label: 'General', icon: <CalendarRange className="h-3.5 w-3.5" />, color: '#059669' },
];

const COLOR_OPTIONS = [
  '#059669', '#0891B2', '#7C3AED', '#DC2626', '#D97706',
  '#BE185D', '#2563EB', '#4F46E5', '#EA580C', '#0D9488',
  '#65A30D', '#A21CAF',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ==================== HELPERS ====================
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday=0
}

function formatDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatEventDate(dateStr: string, allDay: boolean): string {
  const d = new Date(dateStr);
  if (allDay) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getEventTypeConfig(type: string) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

// ==================== COMPONENT ====================
export function CalendarView() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;
  const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER'].includes(currentRole);

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filterType, setFilterType] = useState('all');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formType, setFormType] = useState('general');
  const [formColor, setFormColor] = useState('#059669');
  const [formLocation, setFormLocation] = useState('');
  const [formAllDay, setFormAllDay] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const params = new URLSearchParams({ schoolId, month: monthStr });
      if (filterType !== 'all') params.set('type', filterType);
      const res = await fetch(`/api/calendar?${params}`);
      const json = await res.json();
      if (json.data) setEvents(json.data);
    } catch { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  }, [schoolId, year, month, filterType]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Calendar cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Events map for quick lookup
  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(ev => {
      const startDate = new Date(ev.startDate);
      const endDate = ev.endDate ? new Date(ev.endDate) : startDate;
      let current = new Date(startDate);
      while (current <= endDate) {
        const key = formatDateStr(current.getFullYear(), current.getMonth(), current.getDate());
        if (!map[key]) map[key] = [];
        map[key].push(ev);
        current.setDate(current.getDate() + 1);
      }
    });
    return map;
  }, [events]);

  const getEventsForDay = (day: number) => {
    const dateStr = formatDateStr(year, month, day);
    return eventsMap[dateStr] || [];
  };

  // Upcoming events (next 30 days from today)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 86400000);
    return events
      .filter(ev => {
        const start = new Date(ev.startDate);
        return start >= now && start <= thirtyDays;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 8);
  }, [events]);

  // Stats
  const thisMonthEvents = events.length;
  const eventTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(ev => { counts[ev.type] = (counts[ev.type] || 0) + 1; });
    return counts;
  }, [events]);

  // Create event
  const handleCreate = async () => {
    if (!formTitle.trim() || !formDate) { toast.error('Title and date are required'); return; }
    setSubmitting(true);
    try {
      const startDate = formAllDay ? formDate : `${formDate}T${formTime}:00`;
      const endDate = formEndDate ? (formAllDay ? formEndDate : `${formEndDate}T${formEndTime}:00`) : null;
      const res = await fetch('/api/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId, title: formTitle, description: formDescription || null,
          startDate, endDate, location: formLocation || null,
          type: formType, isAllDay: formAllDay, color: formColor,
          createdBy: currentUser.id,
        }),
      });
      const json = await res.json();
      if (json.error) toast.error(json.error);
      else { toast.success('Event created'); setAddOpen(false); resetForm(); fetchEvents(); }
    } catch { toast.error('Failed to create event'); }
    finally { setSubmitting(false); }
  };

  // Delete event
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/calendar', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, schoolId }),
      });
      const json = await res.json();
      if (json.error) toast.error(json.error);
      else { toast.success('Event deleted'); setSelectedEvent(null); fetchEvents(); }
    } catch { toast.error('Failed to delete'); }
  };

  // RSVP
  const handleRSVP = async (eventId: string, status: string) => {
    try {
      const res = await fetch('/api/calendar', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rsvp', eventId, userId: currentUser.id, status, schoolId }),
      });
      const json = await res.json();
      if (json.error) toast.error(json.error);
      else { toast.success(`RSVP: ${status}`); fetchEvents(); }
    } catch { toast.error('Failed to RSVP'); }
  };

  // Reset form
  const resetForm = () => {
    setFormTitle(''); setFormDescription(''); setFormDate('');
    setFormEndDate(''); setFormTime('09:00'); setFormEndTime('10:00');
    setFormType('general'); setFormColor('#059669');
    setFormLocation(''); setFormAllDay(false);
  };

  // Days until event
  const daysUntil = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil((eventDate.getTime() - now.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return `${Math.abs(diff)}d ago`;
    return `In ${diff}d`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-emerald-600" /> Calendar
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {MONTHS[month]} {year} &middot; {thisMonthEvents} events this month
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-sm">
                <Plus className="size-4" /> Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarIcon className="size-5 text-emerald-600" /> Create Event
                </DialogTitle>
                <DialogDescription>Schedule a new event on the calendar.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Event Title *</Label>
                  <Input placeholder="e.g. Science Fair, Parent-Teacher Meeting" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Event details..." value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} className="resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Start Date *</Label>
                    <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date (optional)</Label>
                    <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
                  </div>
                </div>
                {!formAllDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Start Time</Label>
                      <Input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>End Time</Label>
                      <Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Switch checked={formAllDay} onCheckedChange={setFormAllDay} />
                  <Label className="text-sm">All-day event</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Event Type</Label>
                    <Select value={formType} onValueChange={v => { setFormType(v); const cfg = getEventTypeConfig(v); if (cfg) setFormColor(cfg.color); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <span className="flex items-center gap-1.5">{t.icon} {t.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Location</Label>
                    <Input placeholder="e.g. School Hall, Field" value={formLocation} onChange={e => setFormLocation(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        className={cn('w-7 h-7 rounded-full border-2 transition-all hover:scale-110', formColor === c ? 'border-gray-800 scale-110 ring-2 ring-offset-2 ring-gray-300' : 'border-transparent')}
                        style={{ backgroundColor: c }}
                        onClick={() => setFormColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { resetForm(); setAddOpen(false); }}>Cancel</Button>
                <Button onClick={handleCreate} disabled={submitting || !formTitle.trim() || !formDate} className="bg-emerald-600 hover:bg-emerald-700">
                  {submitting && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />}
                  Create Event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats + Type Filter */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-muted rounded-lg p-0.5 mr-2">
          {EVENT_TYPES.map(t => {
            const count = eventTypes[t.value] || 0;
            return (
              <button
                key={t.value}
                className={cn(
                  'px-2.5 py-1.5 text-xs rounded-md transition-all flex items-center gap-1',
                  filterType === t.value ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setFilterType(filterType === t.value ? 'all' : t.value)}
              >
                {t.icon} {t.label} {count > 0 && <Badge className="text-xs px-1 py-0 h-3 min-w-3">{count}</Badge>}
              </button>
            );
          })}
        </div>
        {filterType !== 'all' && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setFilterType('all')}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-3 border">
          <CardContent className="p-4">
            {/* Calendar Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="size-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={goToToday}>
                  <CalendarDays className="h-3 w-3" /> Today
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="size-4" /></Button>
              </div>
              <h3 className="font-bold text-base text-gray-900">
                {MONTHS[month]} {year}
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground">Events</span>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {DAYS.map(day => (
                <div key={day} className="text-center py-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{day}</span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            {loading ? (
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
                {cells.map((day, idx) => {
                  const dayEvents = day ? getEventsForDay(day) : [];
                  const todayMarker = day ? isToday(day) : false;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        'bg-card p-1.5 min-h-[90px] md:min-h-[110px] transition-colors relative cursor-pointer',
                        day && 'hover:bg-muted/40',
                        !day && 'bg-muted/20',
                        todayMarker && 'bg-emerald-50/50'
                      )}
                      onClick={() => { if (day && !addOpen) { setFormDate(formatDateStr(year, month, day)); setAddOpen(true); } }}
                    >
                      {day && (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                              'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                              todayMarker && 'bg-emerald-600 text-white font-bold shadow-sm',
                              !todayMarker && 'text-gray-700'
                            )}>
                              {day}
                            </span>
                            {todayMarker && (
                              <span className="text-xs text-emerald-600 font-bold">TODAY</span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map(ev => (
                              <div
                                key={ev.id}
                                className="text-[10px] leading-tight px-1.5 py-0.5 rounded truncate font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: ev.color }}
                                onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                                title={ev.title}
                              >
                                {ev.isAllDay ? '' : new Date(ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' '}
                                {ev.title}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <div
                                className="text-[10px] text-muted-foreground font-medium px-1.5 cursor-pointer hover:text-foreground"
                                onClick={(e) => { e.stopPropagation(); toast.info(`${dayEvents.length} events on this day`); }}
                              >
                                +{dayEvents.length - 3} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events Sidebar */}
        <div className="space-y-4">
          <Card className="border">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" /> Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-6">
                  <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No upcoming events in the next 30 days</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2">
                    {upcomingEvents.map(ev => {
                      const typeCfg = getEventTypeConfig(ev.type);
                      return (
                        <div
                          key={ev.id}
                          className="p-3 rounded-lg border hover:shadow-sm transition-all cursor-pointer group"
                          onClick={() => setSelectedEvent(ev)}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: ev.color }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">{ev.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {formatEventDate(ev.startDate, ev.isAllDay)}</span>
                              </div>
                              {ev.location && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" /> {ev.location}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <Badge variant="outline" className={cn('text-xs px-1.5 py-0', typeCfg.color.replace('text-', 'bg-').replace('-700', '-50'))}>
                                  {typeCfg.icon} {typeCfg.label}
                                </Badge>
                                <Badge variant="outline" className="text-xs px-1.5 py-0 text-emerald-600 border-emerald-200 bg-emerald-50">
                                  {daysUntil(ev.startDate)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Event Types Legend */}
          <Card className="border">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Palette className="h-4 w-4 text-emerald-600" /> Event Types
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5">
                {EVENT_TYPES.map(t => (
                  <div key={t.value} className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-xs text-gray-600">{t.label}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">{eventTypes[t.value] || 0}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
        <DialogContent className="max-w-lg">
          {selectedEvent && (() => {
            const typeCfg = getEventTypeConfig(selectedEvent.type);
            const rsvpCounts = { going: 0, maybe: 0, not_going: 0 };
            (selectedEvent.rsvps || []).forEach((r: EventRSVP) => {
              if (r.status === 'going') rsvpCounts.going++;
              else if (r.status === 'maybe') rsvpCounts.maybe++;
              else if (r.status === 'not_going') rsvpCounts.not_going++;
            });

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={cn('text-[10px] px-2 py-0.5 text-white', '')} style={{ backgroundColor: selectedEvent.color }}>
                      {typeCfg.icon} {typeCfg.label}
                    </Badge>
                    {selectedEvent.isAllDay && <Badge variant="outline" className="text-[10px]">All Day</Badge>}
                  </div>
                  <DialogTitle className="text-lg">{selectedEvent.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {selectedEvent.description && (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedEvent.description}</p>
                  )}
                  <div className="grid gap-2.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{formatEventDate(selectedEvent.startDate, selectedEvent.isAllDay)}</p>
                        {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate && (
                          <p className="text-xs text-muted-foreground">to {formatEventDate(selectedEvent.endDate, selectedEvent.isAllDay)}</p>
                        )}
                        <p className="text-xs text-emerald-600 font-medium">{daysUntil(selectedEvent.startDate)}</p>
                      </div>
                    </div>
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-gray-700">{selectedEvent.location}</p>
                      </div>
                    )}
                  </div>

                  {/* RSVP Section */}
                  <Separator />
                  <div>
                    <p className="text-sm font-semibold mb-2">RSVP</p>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-gray-600">Going: {rsvpCounts.going}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-xs text-gray-600">Maybe: {rsvpCounts.maybe}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-xs text-gray-600">Not Going: {rsvpCounts.not_going}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {[
                        { status: 'going', label: 'Going', icon: <Check className="h-3.5 w-3.5" />, color: 'bg-emerald-600 hover:bg-emerald-700 text-white', activeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                        { status: 'maybe', label: 'Maybe', icon: <HelpCircle className="h-3.5 w-3.5" />, color: 'bg-amber-500 hover:bg-amber-600 text-white', activeColor: 'bg-amber-100 text-amber-700 border-amber-300' },
                        { status: 'not_going', label: 'Not Going', icon: <X className="h-3.5 w-3.5" />, color: 'bg-gray-500 hover:bg-gray-600 text-white', activeColor: 'bg-gray-100 text-gray-600 border-gray-300' },
                      ].map(btn => {
                        const isActive = selectedEvent._rsvpStatus === btn.status;
                        return (
                          <Button
                            key={btn.status}
                            size="sm"
                            className={cn('gap-1.5 text-xs flex-1', isActive ? btn.activeColor : 'border ' + btn.color)}
                            variant={isActive ? 'outline' : 'default'}
                            onClick={() => handleRSVP(selectedEvent.id, btn.status)}
                          >
                            {btn.icon} {btn.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <DialogFooter className="gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDelete(selectedEvent.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </DialogFooter>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
