'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Edit3, X, List, LayoutGrid, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  type: 'academic' | 'sports' | 'holiday' | 'exam' | 'meeting';
  startTime: string;
  endTime: string;
  location: string;
  color: string;
}

const typeColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  academic: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', label: 'Academic' },
  sports: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Sports' },
  holiday: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Holiday' },
  exam: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Exam' },
  meeting: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', label: 'Meeting' },
};

const initialEvents: CalendarEvent[] = [
  { id: 'ev-1', title: 'Inter-House Sports', description: 'Annual inter-house sports competition. All students participate.', date: '2025-04-15', type: 'sports', startTime: '08:00', endTime: '16:00', location: 'School Sports Field', color: '#f59e0b' },
  { id: 'ev-2', title: 'Mid-Term Break', description: 'Mid-term break for all students. School resumes on April 7.', date: '2025-03-31', endDate: '2025-04-04', type: 'holiday', startTime: '00:00', endTime: '23:59', location: '', color: '#ef4444' },
  { id: 'ev-3', title: 'PTA Meeting', description: 'Parent-Teacher Association meeting for all classes.', date: '2025-04-12', type: 'meeting', startTime: '10:00', endTime: '15:00', location: 'School Hall', color: '#8b5cf6' },
  { id: 'ev-4', title: 'Second Term Exams', description: 'Second term examination for all classes.', date: '2025-06-15', endDate: '2025-06-26', type: 'exam', startTime: '08:00', endTime: '15:00', location: 'Various Classrooms', color: '#3b82f6' },
  { id: 'ev-5', title: 'Science Fair', description: 'Annual science fair and exhibition.', date: '2025-05-20', type: 'academic', startTime: '09:00', endTime: '14:00', location: 'Science Laboratory', color: '#10b981' },
  { id: 'ev-6', title: 'Graduation Ceremony', description: 'SS 3 graduation ceremony.', date: '2025-07-18', type: 'academic', startTime: '10:00', endTime: '16:00', location: 'School Auditorium', color: '#10b981' },
  { id: 'ev-7', title: 'Staff Development Day', description: 'Professional development workshop for all teachers.', date: '2025-04-05', type: 'meeting', startTime: '09:00', endTime: '17:00', location: 'Conference Room', color: '#8b5cf6' },
  { id: 'ev-8', title: 'Mathematics Competition', description: 'Inter-school mathematics olympiad.', date: '2025-05-10', type: 'academic', startTime: '10:00', endTime: '13:00', location: 'Main Hall', color: '#10b981' },
  { id: 'ev-9', title: 'Independence Day Holiday', description: 'Public holiday - school closed.', date: '2025-10-01', type: 'holiday', startTime: '00:00', endTime: '23:59', location: '', color: '#ef4444' },
  { id: 'ev-10', title: 'Football Tournament', description: 'Inter-school football tournament semifinals.', date: '2025-05-30', type: 'sports', startTime: '14:00', endTime: '17:00', location: 'Sports Field', color: '#f59e0b' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function SchoolCalendar() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // New event form
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', date: '', endDate: '', type: 'academic' as CalendarEvent['type'],
    startTime: '09:00', endTime: '15:00', location: '',
  });

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter(e => e.type === filterType);
  }, [events, filterType]);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const getEventsForDate = (dateStr: string) => filteredEvents.filter(e => e.date === dateStr || (e.endDate && dateStr >= e.date && dateStr <= e.endDate));

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const formatDateStr = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const prevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const prevWeek = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
  const nextWeek = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
  const goToToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const upcomingEvents = useMemo(() => {
    const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());
    return events
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [events]);

  const handleAddEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date) {
      toast.error('Please fill in the event title and date');
      return;
    }
    const event: CalendarEvent = {
      id: `ev-${Date.now()}`,
      ...newEvent,
      color: typeColors[newEvent.type]?.bg === 'bg-emerald-100' ? '#10b981' :
             typeColors[newEvent.type]?.bg === 'bg-amber-100' ? '#f59e0b' :
             typeColors[newEvent.type]?.bg === 'bg-red-100' ? '#ef4444' :
             typeColors[newEvent.type]?.bg === 'bg-blue-100' ? '#3b82f6' : '#8b5cf6',
    };
    setEvents(prev => [...prev, event]);
    setShowAddEvent(false);
    setNewEvent({ title: '', description: '', date: '', endDate: '', type: 'academic', startTime: '09:00', endTime: '15:00', location: '' });
    toast.success('Event added successfully');
  };

  const handleEditEvent = () => {
    if (!editingEvent || !editingEvent.title.trim()) return;
    setEvents(prev => prev.map(e => e.id === editingEvent.id ? editingEvent : e));
    setSelectedEvent(null);
    setEditingEvent(null);
    toast.success('Event updated successfully');
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelectedEvent(null);
    toast.success('Event deleted');
  };

  const isToday = (day: number) => {
    return day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Calendar className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">School Calendar</h2>
            <p className="text-sm text-gray-500">Manage school events, holidays, and activities</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goToToday} className="gap-1">
            Today
          </Button>
          <Button size="sm" onClick={() => setShowAddEvent(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4">
          {/* Navigation */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={viewMode === 'month' ? prevMonth : prevWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-lg font-semibold min-w-[180px] text-center">
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h3>
                  <Button variant="ghost" size="icon" onClick={viewMode === 'month' ? nextMonth : nextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      {Object.entries(typeColors).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex rounded-md border overflow-hidden">
                    <Button
                      variant={viewMode === 'month' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none h-8 px-3"
                      onClick={() => setViewMode('month')}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={viewMode === 'week' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none h-8 px-3"
                      onClick={() => setViewMode('week')}
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Grid */}
          <Card>
            <CardContent className="p-4">
              {viewMode === 'month' ? (
                <div>
                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {WEEKDAYS.map(day => (
                      <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">{day}</div>
                    ))}
                  </div>
                  {/* Day Cells */}
                  <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                    {calendarDays.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="bg-gray-50 min-h-[100px] p-2" />;
                      }
                      const dateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), day);
                      const dayEvents = getEventsForDate(dateStr);
                      const todayHighlight = isToday(day);

                      return (
                        <div
                          key={dateStr}
                          className={`bg-white min-h-[100px] p-1.5 transition-colors hover:bg-gray-50 cursor-pointer ${todayHighlight ? 'ring-2 ring-emerald-500 ring-inset' : ''}`}
                          onClick={() => {
                            if (dayEvents.length > 0) {
                              setSelectedEvent(dayEvents[0]);
                            }
                          }}
                        >
                          <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${todayHighlight ? 'bg-emerald-500 text-white' : 'text-gray-700'}`}>
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map(ev => {
                              const tc = typeColors[ev.type];
                              return (
                                <div
                                  key={ev.id}
                                  className={`text-[10px] px-1.5 py-0.5 rounded truncate ${tc.bg} ${tc.text} font-medium cursor-pointer`}
                                  onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                                >
                                  {ev.title}
                                </div>
                              );
                            })}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] text-gray-500 px-1.5">+{dayEvents.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Week View */
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map(date => {
                      const dateStr = formatDateStr(date.getFullYear(), date.getMonth(), date.getDate());
                      const dayEvents = getEventsForDate(dateStr);
                      const todayHighlight = date.toDateString() === today.toDateString();
                      return (
                        <div key={dateStr} className="border rounded-lg p-2 min-h-[200px]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500">{WEEKDAYS[date.getDay()]}</span>
                            <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${todayHighlight ? 'bg-emerald-500 text-white' : 'text-gray-700'}`}>
                              {date.getDate()}
                            </span>
                          </div>
                          <ScrollArea className="max-h-[160px]">
                            <div className="space-y-1">
                              {dayEvents.map(ev => {
                                const tc = typeColors[ev.type];
                                return (
                                  <div
                                    key={ev.id}
                                    className={`text-[10px] p-1.5 rounded ${tc.bg} ${tc.text} cursor-pointer`}
                                    onClick={() => setSelectedEvent(ev)}
                                  >
                                    <p className="font-medium truncate">{ev.title}</p>
                                    <p className="opacity-70">{ev.startTime}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events Sidebar */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {upcomingEvents.map(ev => {
                  const tc = typeColors[ev.type];
                  const eventDate = new Date(ev.date);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${tc.bg} ${tc.text} text-[10px] border ${tc.border}`}>{tc.label}</Badge>
                      </div>
                      <p className="font-medium text-sm">{ev.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {ev.startTime}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {upcomingEvents.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No upcoming events</p>
                )}
              </div>
            </ScrollArea>

            {/* Legend */}
            <Separator className="my-4" />
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Event Types</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeColors).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${val.bg} ${val.text} border ${val.border}`} />
                    <span className="text-xs text-gray-500">{val.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => { setSelectedEvent(null); setEditingEvent(null); }}>
        <DialogContent className="sm:max-w-md">
          {editingEvent ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Title</label>
                  <Input value={editingEvent.title} onChange={(e) => setEditingEvent(prev => prev ? { ...prev, title: e.target.value } : null)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <Textarea value={editingEvent.description} onChange={(e) => setEditingEvent(prev => prev ? { ...prev, description: e.target.value } : null)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Start Time</label>
                    <Input type="time" value={editingEvent.startTime} onChange={(e) => setEditingEvent(prev => prev ? { ...prev, startTime: e.target.value } : null)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">End Time</label>
                    <Input type="time" value={editingEvent.endTime} onChange={(e) => setEditingEvent(prev => prev ? { ...prev, endTime: e.target.value } : null)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Location</label>
                  <Input value={editingEvent.location} onChange={(e) => setEditingEvent(prev => prev ? { ...prev, location: e.target.value } : null)} />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="destructive" size="sm" onClick={() => handleDeleteEvent(editingEvent.id)}>Delete</Button>
                <Button variant="outline" onClick={() => setEditingEvent(null)}>Cancel</Button>
                <Button size="sm" onClick={handleEditEvent}>Save Changes</Button>
              </DialogFooter>
            </>
          ) : selectedEvent ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className={`${typeColors[selectedEvent.type].bg} ${typeColors[selectedEvent.type].text} border ${typeColors[selectedEvent.type].border}`}>
                    {typeColors[selectedEvent.type].label}
                  </Badge>
                </div>
                <DialogTitle>{selectedEvent.title}</DialogTitle>
                <DialogDescription>{selectedEvent.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{selectedEvent.startTime} - {selectedEvent.endTime}</span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingEvent({ ...selectedEvent })} className="gap-2">
                  <Edit3 className="h-4 w-4" /> Edit
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
            <DialogDescription>Create a new event on the school calendar</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input value={newEvent.title} onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))} placeholder="Event title" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea value={newEvent.description} onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Event description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <Select value={newEvent.type} onValueChange={(v) => setNewEvent(prev => ({ ...prev, type: v as CalendarEvent['type'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeColors).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Date</label>
                <Input type="date" value={newEvent.date} onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Start Time</label>
                <Input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">End Time</label>
                <Input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Location</label>
              <Input value={newEvent.location} onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))} placeholder="Event location" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddEvent(false)}>Cancel</Button>
            <Button onClick={handleAddEvent}>Add Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
