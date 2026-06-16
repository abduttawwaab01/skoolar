'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer } from '@/lib/motion-variants';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  GraduationCap, Search, Plus, Users, Calendar, MapPin, Globe, Linkedin, Facebook,
  Mail, Phone, Briefcase, Building, ChevronRight, Clock, UserPlus, ExternalLink,
  Loader2, AlertCircle, CheckCircle, XCircle,
} from 'lucide-react';

interface AlumniRecord {
  id: string;
  schoolId: string;
  studentId: string;
  graduationYear: number;
  graduationTerm: string | null;
  finalClass: string | null;
  finalGpa: number | null;
  currentOccupation: string | null;
  employer: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  newsletterOptIn: boolean;
  isActive: boolean;
  notes: string | null;
  student: {
    id: string;
    admissionNo: string;
    photo: string | null;
    user: { id: string; name: string; email: string; phone: string | null; avatar: string | null };
  };
  rsvps?: { id: string; eventId: string; status: string }[];
}

interface AlumniEventRecord {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  isVirtual: boolean;
  meetingLink: string | null;
  organizer: string | null;
  rsvpDeadline: string | null;
  maxAttendees: number | null;
  rsvpCount: number;
  attending: number;
}

interface RSVPRecord {
  id: string;
  eventId: string;
  alumniId: string;
  status: string;
  guests: number;
  message: string | null;
  alumni: {
    id: string;
    currentOccupation: string | null;
    employer: string | null;
    student: {
      user: { id: string; name: string; email: string; phone: string | null; avatar: string | null };
    };
  };
}

function AlumniSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32 ml-auto" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function AlumniView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [alumni, setAlumni] = useState<AlumniRecord[]>([]);
  const [events, setEvents] = useState<AlumniEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedAlumni, setSelectedAlumni] = useState<AlumniRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AlumniEventRecord | null>(null);
  const [eventRsvps, setEventRsvps] = useState<RSVPRecord[]>([]);

  const [search, setSearch] = useState('');
  const [gradYearFilter, setGradYearFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    studentId: '', graduationYear: new Date().getFullYear().toString(), graduationTerm: '',
    finalClass: '', finalGpa: '', currentOccupation: '', employer: '',
    email: '', phone: '', address: '', city: '', country: '',
    linkedinUrl: '', facebookUrl: '', notes: '',
  });

  const [eventForm, setEventForm] = useState({
    title: '', description: '', eventDate: '', location: '',
    isVirtual: false, meetingLink: '', organizer: '',
    rsvpDeadline: '', maxAttendees: '',
  });

  const [rsvpStatus, setRsvpStatus] = useState('attending');
  const [rsvpGuests, setRsvpGuests] = useState('0');
  const [rsvpMessage, setRsvpMessage] = useState('');

  const fetchAlumni = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ schoolId, page: page.toString(), limit: '20' });
      if (search) params.set('search', search);
      if (gradYearFilter && gradYearFilter !== 'all') params.set('graduationYear', gradYearFilter);
      const res = await fetch(`/api/alumni?${params}`);
      if (!res.ok) throw new Error('Failed to load alumni');
      const json = await res.json();
      setAlumni(json.data || []);
      setTotalPages(json.totalPages || 1);
    } catch {
      toast.error('Failed to load alumni');
    } finally {
      setLoading(false);
    }
  }, [schoolId, page, search, gradYearFilter]);

  const fetchEvents = useCallback(async () => {
    if (!schoolId) return;
    try {
      setEventsLoading(true);
      const res = await fetch(`/api/alumni/events?schoolId=${schoolId}&limit=50`);
      if (!res.ok) throw new Error('Failed to load events');
      const json = await res.json();
      setEvents(json.data || []);
    } catch {
      toast.error('Failed to load events');
    } finally {
      setEventsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchAlumni(); }, [fetchAlumni]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const fetchRsvps = async (eventId: string) => {
    try {
      const res = await fetch(`/api/alumni/events/${eventId}/rsvp?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to load RSVPs');
      const json = await res.json();
      setEventRsvps(json.data || []);
    } catch {
      toast.error('Failed to load RSVPs');
    }
  };

  const handleViewDetail = async (alum: AlumniRecord) => {
    try {
      const res = await fetch(`/api/alumni/${alum.id}?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to load details');
      const json = await res.json();
      setSelectedAlumni(json.data);
      setDetailOpen(true);
    } catch {
      toast.error('Failed to load alumni details');
    }
  };

  const handleAddAlumni = async () => {
    if (!formData.studentId) {
      toast.error('Student ID is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, schoolId, graduationYear: parseInt(formData.graduationYear), finalGpa: formData.finalGpa ? parseFloat(formData.finalGpa) : null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create alumni');
      }
      toast.success('Alumni added successfully');
      setAddOpen(false);
      setFormData({ studentId: '', graduationYear: new Date().getFullYear().toString(), graduationTerm: '', finalClass: '', finalGpa: '', currentOccupation: '', employer: '', email: '', phone: '', address: '', city: '', country: '', linkedinUrl: '', facebookUrl: '', notes: '' });
      fetchAlumni();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAlumni = async () => {
    if (!selectedAlumni) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/alumni/${selectedAlumni.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentOccupation: formData.currentOccupation,
          employer: formData.employer,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          linkedinUrl: formData.linkedinUrl,
          facebookUrl: formData.facebookUrl,
          notes: formData.notes,
          graduationYear: parseInt(formData.graduationYear),
          finalClass: formData.finalClass,
          finalGpa: formData.finalGpa ? parseFloat(formData.finalGpa) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update alumni');
      }
      toast.success('Alumni updated successfully');
      setEditOpen(false);
      fetchAlumni();
      if (selectedAlumni) handleViewDetail(selectedAlumni);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAlumni = async (id: string) => {
    if (!confirm('Are you sure you want to remove this alumni record?')) return;
    try {
      const res = await fetch(`/api/alumni/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete alumni');
      toast.success('Alumni removed');
      setDetailOpen(false);
      fetchAlumni();
    } catch {
      toast.error('Failed to delete alumni');
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.eventDate) {
      toast.error('Title and event date are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/alumni/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventForm, schoolId, maxAttendees: eventForm.maxAttendees || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create event');
      }
      toast.success('Event created successfully');
      setEventOpen(false);
      setEventForm({ title: '', description: '', eventDate: '', location: '', isVirtual: false, meetingLink: '', organizer: '', rsvpDeadline: '', maxAttendees: '' });
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRsvp = async (eventId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/alumni/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: rsvpStatus, guests: parseInt(rsvpGuests), message: rsvpMessage || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to RSVP');
      }
      toast.success('RSVP updated');
      setRsvpOpen(false);
      setRsvpStatus('attending');
      setRsvpGuests('0');
      setRsvpMessage('');
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (alum: AlumniRecord) => {
    setSelectedAlumni(alum);
    setFormData({
      studentId: alum.studentId,
      graduationYear: alum.graduationYear.toString(),
      graduationTerm: alum.graduationTerm || '',
      finalClass: alum.finalClass || '',
      finalGpa: alum.finalGpa?.toString() || '',
      currentOccupation: alum.currentOccupation || '',
      employer: alum.employer || '',
      email: alum.email || '',
      phone: alum.phone || '',
      address: alum.address || '',
      city: alum.city || '',
      country: alum.country || '',
      linkedinUrl: alum.linkedinUrl || '',
      facebookUrl: alum.facebookUrl || '',
      notes: alum.notes || '',
    });
    setEditOpen(true);
  };

  const upcomingEvents = events.filter((e) => new Date(e.eventDate) >= new Date());
  const pastEvents = events.filter((e) => new Date(e.eventDate) < new Date());

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <GraduationCap className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Select a school to view alumni</p>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alumni Management</h1>
          <p className="text-sm text-muted-foreground">Manage school graduates, events, and engagement</p>
        </div>
      </div>

      <Tabs defaultValue="alumni" className="space-y-6">
        <TabsList>
          <TabsTrigger value="alumni" className="gap-2">
            <Users className="h-4 w-4" /> Alumni
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Calendar className="h-4 w-4" /> Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alumni" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search alumni by name, occupation, employer..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={gradYearFilter} onValueChange={(v) => { setGradYearFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Graduation Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Alumni
            </Button>
          </div>

          {loading ? <AlumniSkeleton /> : alumni.length === 0 ? (
            <motion.div variants={fadeIn} className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <GraduationCap className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No alumni found</p>
              <p className="text-sm">Add alumni to start building your network</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add First Alumni
              </Button>
            </motion.div>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                <motion.div variants={staggerContainer} className="space-y-2">
                  {alumni.map((alum) => (
                    <motion.div key={alum.id} variants={slideUp} layout
                      className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => handleViewDetail(alum)}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={alum.student.user.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {alum.student.user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{alum.student.user.name}</span>
                          <Badge variant="secondary" className="text-xs">{alum.graduationYear}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          {alum.currentOccupation && (
                            <span className="flex items-center gap-1 truncate">
                              <Briefcase className="h-3.5 w-3.5" /> {alum.currentOccupation}
                            </span>
                          )}
                          {alum.employer && (
                            <span className="flex items-center gap-1 truncate">
                              <Building className="h-3.5 w-3.5" /> {alum.employer}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditClick(alum); }}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Alumni Events</h3>
            <Button onClick={() => setEventOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create Event
            </Button>
          </div>

          {eventsLoading ? <EventCardSkeleton /> : events.length === 0 ? (
            <motion.div variants={fadeIn} className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Calendar className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No events yet</p>
              <p className="text-sm">Create your first alumni event to get started</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setEventOpen(true)}>
                <Plus className="h-4 w-4" /> Create Event
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {upcomingEvents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Upcoming Events ({upcomingEvents.length})
                  </h4>
                  <div className="grid gap-3">
                    {upcomingEvents.map((ev) => (
                      <EventCard key={ev.id} ev={ev} onRsvp={() => { setSelectedEvent(ev); setRsvpOpen(true); }} />
                    ))}
                  </div>
                </div>
              )}

              {pastEvents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Past Events ({pastEvents.length})
                  </h4>
                  <div className="grid gap-3">
                    {pastEvents.map((ev) => (
                      <EventCard key={ev.id} ev={ev} past onViewRsvps={() => { setSelectedEvent(ev); fetchRsvps(ev.id); }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedEvent && rsvpOpen && (
            <Dialog open={rsvpOpen} onOpenChange={setRsvpOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>RSVP for {selectedEvent.title}</DialogTitle>
                  <DialogDescription>Confirm your attendance for this event</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={rsvpStatus} onValueChange={setRsvpStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attending">Attending</SelectItem>
                        <SelectItem value="not_attending">Not Attending</SelectItem>
                        <SelectItem value="pending">Maybe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Number of guests</Label>
                    <Input type="number" min="0" max="10" value={rsvpGuests} onChange={(e) => setRsvpGuests(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Message (optional)</Label>
                    <Textarea value={rsvpMessage} onChange={(e) => setRsvpMessage(e.target.value)} placeholder="Any message for the organizer..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRsvpOpen(false)}>Cancel</Button>
                  <Button onClick={() => handleRsvp(selectedEvent.id)} disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Submit RSVP
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {selectedEvent && !rsvpOpen && eventRsvps.length > 0 && (
            <Dialog open={!!selectedEvent && !rsvpOpen && eventRsvps.length > 0}
              onOpenChange={(o) => { if (!o) { setEventRsvps([]); setSelectedEvent(null); } }}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>RSVPs for {selectedEvent.title}</DialogTitle>
                  <DialogDescription>{eventRsvps.length} response(s)</DialogDescription>
                </DialogHeader>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {eventRsvps.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={r.alumni.student.user.avatar || undefined} />
                        <AvatarFallback>{r.alumni.student.user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{r.alumni.student.user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.alumni.currentOccupation}{r.alumni.employer ? ` at ${r.alumni.employer}` : ''}
                        </p>
                      </div>
                      <Badge variant={r.status === 'attending' ? 'default' : r.status === 'not_attending' ? 'destructive' : 'secondary'}>
                        {r.status === 'attending' ? 'Attending' : r.status === 'not_attending' ? 'Not Attending' : 'Maybe'}
                      </Badge>
                      {r.guests > 0 && <span className="text-xs text-muted-foreground">+{r.guests} guest(s)</span>}
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Alumni</DialogTitle>
            <DialogDescription>Link a student to the alumni network</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Student ID *</Label>
              <Input value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} placeholder="Enter student ID" />
            </div>
            <div className="space-y-2">
              <Label>Graduation Year</Label>
              <Input type="number" value={formData.graduationYear} onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Graduation Term</Label>
              <Input value={formData.graduationTerm} onChange={(e) => setFormData({ ...formData, graduationTerm: e.target.value })} placeholder="e.g. 1st Term" />
            </div>
            <div className="space-y-2">
              <Label>Final Class</Label>
              <Input value={formData.finalClass} onChange={(e) => setFormData({ ...formData, finalClass: e.target.value })} placeholder="e.g. SS3" />
            </div>
            <div className="space-y-2">
              <Label>Final GPA</Label>
              <Input type="number" step="0.01" value={formData.finalGpa} onChange={(e) => setFormData({ ...formData, finalGpa: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Current Occupation</Label>
              <Input value={formData.currentOccupation} onChange={(e) => setFormData({ ...formData, currentOccupation: e.target.value })} placeholder="e.g. Software Engineer" />
            </div>
            <div className="space-y-2">
              <Label>Employer</Label>
              <Input value={formData.employer} onChange={(e) => setFormData({ ...formData, employer: e.target.value })} placeholder="Company name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>LinkedIn URL</Label>
              <Input value={formData.linkedinUrl} onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Facebook URL</Label>
              <Input value={formData.facebookUrl} onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })} placeholder="https://facebook.com/..." />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAlumni} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Alumni
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Alumni</DialogTitle>
            <DialogDescription>Update alumni information</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Graduation Year</Label>
              <Input type="number" value={formData.graduationYear} onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Final Class</Label>
              <Input value={formData.finalClass} onChange={(e) => setFormData({ ...formData, finalClass: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Current Occupation</Label>
              <Input value={formData.currentOccupation} onChange={(e) => setFormData({ ...formData, currentOccupation: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Employer</Label>
              <Input value={formData.employer} onChange={(e) => setFormData({ ...formData, employer: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>LinkedIn URL</Label>
              <Input value={formData.linkedinUrl} onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Facebook URL</Label>
              <Input value={formData.facebookUrl} onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditAlumni} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Alumni Event</DialogTitle>
            <DialogDescription>Organize an event for alumni</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Event title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} rows={3} placeholder="Event description..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Date *</Label>
                <Input type="datetime-local" value={eventForm.eventDate} onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>RSVP Deadline</Label>
                <Input type="datetime-local" value={eventForm.rsvpDeadline} onChange={(e) => setEventForm({ ...eventForm, rsvpDeadline: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Venue or address" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isVirtual" checked={eventForm.isVirtual} onChange={(e) => setEventForm({ ...eventForm, isVirtual: e.target.checked })} className="rounded border-gray-300" />
              <Label htmlFor="isVirtual">Virtual event</Label>
            </div>
            {eventForm.isVirtual && (
              <div className="space-y-2">
                <Label>Meeting Link</Label>
                <Input value={eventForm.meetingLink} onChange={(e) => setEventForm({ ...eventForm, meetingLink: e.target.value })} placeholder="https://meet.google.com/..." />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organizer</Label>
                <Input value={eventForm.organizer} onChange={(e) => setEventForm({ ...eventForm, organizer: e.target.value })} placeholder="Organizer name" />
              </div>
              <div className="space-y-2">
                <Label>Max Attendees</Label>
                <Input type="number" value={eventForm.maxAttendees} onChange={(e) => setEventForm({ ...eventForm, maxAttendees: e.target.value })} placeholder="No limit" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedAlumni && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedAlumni.student.user.avatar || undefined} />
                    <AvatarFallback>{selectedAlumni.student.user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {selectedAlumni.student.user.name}
                </DialogTitle>
                <DialogDescription>Alumni since {selectedAlumni.graduationYear}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedAlumni.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedAlumni.email}</span>
                      </div>
                    )}
                    {selectedAlumni.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedAlumni.phone}</span>
                      </div>
                    )}
                    {(selectedAlumni.city || selectedAlumni.country) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{[selectedAlumni.city, selectedAlumni.country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Professional Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedAlumni.currentOccupation && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedAlumni.currentOccupation}</span>
                      </div>
                    )}
                    {selectedAlumni.employer && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedAlumni.employer}</span>
                      </div>
                    )}
                    {selectedAlumni.finalClass && (
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span>Final Class: {selectedAlumni.finalClass} {selectedAlumni.finalGpa ? `(GPA: ${selectedAlumni.finalGpa})` : ''}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {(selectedAlumni.linkedinUrl || selectedAlumni.facebookUrl) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Social Links</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-3">
                      {selectedAlumni.linkedinUrl && (
                        <a href={selectedAlumni.linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                          <Linkedin className="h-4 w-4" /> LinkedIn
                        </a>
                      )}
                      {selectedAlumni.facebookUrl && (
                        <a href={selectedAlumni.facebookUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                          <Facebook className="h-4 w-4" /> Facebook
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}

                {selectedAlumni.notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedAlumni.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); handleEditClick(selectedAlumni); }}>
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteAlumni(selectedAlumni.id)}>
                  Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function EventCard({ ev, past, onRsvp, onViewRsvps }: {
  ev: AlumniEventRecord;
  past?: boolean;
  onRsvp?: () => void;
  onViewRsvps?: () => void;
}) {
  const eventDate = new Date(ev.eventDate);
  const isRsvpDeadlinePassed = ev.rsvpDeadline ? new Date(ev.rsvpDeadline) < new Date() : false;

  return (
    <Card className={past ? 'opacity-70' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{ev.title}</h4>
              {ev.isVirtual && <Badge variant="secondary" className="text-xs">Virtual</Badge>}
            </div>
            {ev.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {ev.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {ev.location}
                </span>
              )}
              {ev.organizer && (
                <span className="flex items-center gap-1">
                  <UserPlus className="h-3.5 w-3.5" /> {ev.organizer}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground">{ev.attending} attending</span>
              {ev.maxAttendees && (
                <span className="text-xs text-muted-foreground">(max {ev.maxAttendees})</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {!past && (
              <Button size="sm" onClick={onRsvp} disabled={isRsvpDeadlinePassed} className="gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> RSVP
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onViewRsvps} className="gap-1">
              <Users className="h-3.5 w-3.5" /> RSVPs
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
