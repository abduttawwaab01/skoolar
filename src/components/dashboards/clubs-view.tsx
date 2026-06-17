'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Users, Calendar, Clock, MapPin, UserCheck, Loader2, Trash2, Pencil, X, UserPlus, ChevronLeft, Activity, DollarSign, Check, Search } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface ClubRecord {
  id: string;
  name: string;
  description: string | null;
  mission: string | null;
  patronName: string | null;
  meetingDay: string;
  meetingTime: string;
  meetingVenue: string | null;
  membershipFee: number | null;
  isActive: boolean;
  logo: string | null;
  socialLink: string | null;
  memberCount: number;
}

interface ClubMember {
  id: string;
  role: string;
  joinedDate: string;
  student: {
    id: string;
    admissionNo: string;
    photo: string | null;
    user: { name: string; email: string; avatar: string | null };
  };
}

interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
}

interface StudentRecord {
  id: string;
  admissionNo: string;
  user: { name: string; email: string };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function ClubsView() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [clubs, setClubs] = React.useState<ClubRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [selectedClub, setSelectedClub] = React.useState<ClubRecord | null>(null);
  const [editClub, setEditClub] = React.useState<ClubRecord | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [members, setMembers] = React.useState<ClubMember[]>([]);
  const [events, setEvents] = React.useState<ClubEvent[]>([]);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [loadingEvents, setLoadingEvents] = React.useState(false);

  const [students, setStudents] = React.useState<StudentRecord[]>([]);
  const [addMemberOpen, setAddMemberOpen] = React.useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<Set<string>>(new Set());
  const [memberSearchQuery, setMemberSearchQuery] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState('member');
  const [addingMember, setAddingMember] = React.useState(false);
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  const [addEventOpen, setAddEventOpen] = React.useState(false);
  const [addingEvent, setAddingEvent] = React.useState(false);

  const loadClubs = React.useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/clubs?schoolId=${schoolId}`);
      const json = await res.json();
      const items = json.data || json || [];
      setClubs(items.map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        description: c.description || null,
        mission: c.mission || null,
        patronName: c.patronName || null,
        meetingDay: c.meetingDay,
        meetingTime: c.meetingTime,
        meetingVenue: c.meetingVenue || null,
        membershipFee: c.membershipFee ?? null,
        isActive: c.isActive as boolean,
        logo: c.logo || null,
        socialLink: c.socialLink || null,
        memberCount: (c.memberCount as number) || 0,
      })));
    } catch {
      toast.error('Failed to load clubs');
      setClubs([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const loadMembers = React.useCallback(async (clubId: string) => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/members`);
      const json = await res.json();
      setMembers(json.data || []);
    } catch {
      toast.error('Failed to load members');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const loadEvents = React.useCallback(async (clubId: string) => {
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/events`);
      const json = await res.json();
      setEvents(json.data || []);
    } catch {
      toast.error('Failed to load events');
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  React.useEffect(() => { loadClubs(); }, [loadClubs]);

  React.useEffect(() => {
    if (schoolId) {
      fetch(`/api/students?schoolId=${schoolId}&limit=500`)
        .then(r => r.json())
        .then(j => {
          const s = (j.data || j || []).map((st: Record<string, unknown>) => ({
            id: st.id,
            admissionNo: st.admissionNo,
            user: (st.user as Record<string, unknown>) || { name: 'Unknown', email: '' },
          }));
          setStudents(s);
        })
        .catch(() => setStudents([]));
    }
  }, [schoolId]);

  const handleSelectClub = async (club: ClubRecord) => {
    setSelectedClub(club);
    loadMembers(club.id);
    loadEvents(club.id);
  };

  const handleAddClub = async () => {
    if (!schoolId) { toast.error('No school selected'); return; }
    const form = document.querySelector('[data-club-form]') as HTMLFormElement;
    if (!form) return;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    if (!name) { toast.error('Club name is required'); return; }

    setAdding(true);
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          name,
          description: formData.get('description') || null,
          mission: formData.get('mission') || null,
          patronName: formData.get('patronName') || null,
          meetingDay: formData.get('meetingDay') || 'Monday',
          meetingTime: formData.get('meetingTime') || '15:00',
          meetingVenue: formData.get('meetingVenue') || null,
          membershipFee: formData.get('membershipFee') ? parseFloat(formData.get('membershipFee') as string) : 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create club');
      toast.success('Club created successfully');
      setAddOpen(false);
      await loadClubs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create club');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateClub = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editClub) return;
    setSaving(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch(`/api/clubs/${editClub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description') || null,
          mission: formData.get('mission') || null,
          patronName: formData.get('patronName') || null,
          meetingDay: formData.get('meetingDay') || 'Monday',
          meetingTime: formData.get('meetingTime') || '15:00',
          meetingVenue: formData.get('meetingVenue') || null,
          membershipFee: formData.get('membershipFee') ? parseFloat(formData.get('membershipFee') as string) : 0,
          isActive: formData.get('isActive') === 'true',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message);
      toast.success('Club updated successfully');
      setEditClub(null);
      await loadClubs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update club');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClub = async (clubId: string) => {
    setDeleting(clubId);
    try {
      const res = await fetch(`/api/clubs/${clubId}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to delete club'); }
      toast.success('Club deleted successfully');
      setSelectedClub(null);
      await loadClubs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete club');
    } finally {
      setDeleting(null);
    }
  };

  const handleAddMember = async () => {
    if (!selectedClub || selectedStudentIds.size === 0) { toast.error('Select at least one student'); return; }
    setAddingMember(true);
    try {
      const res = await fetch(`/api/clubs/${selectedClub.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selectedStudentIds), role: selectedRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add members');
      toast.success(`Added ${json.data?.added || 0} member(s) successfully`);
      setAddMemberOpen(false);
      setSelectedStudentIds(new Set());
      setMemberSearchQuery('');
      setSelectedRole('member');
      loadMembers(selectedClub.id);
      loadClubs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add members');
    } finally {
      setAddingMember(false);
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredStudents = students.filter(s =>
    !memberSearchQuery || s.user.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || s.admissionNo.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.has(s.id));

  const handleRemoveMember = async (studentId: string) => {
    if (!selectedClub) return;
    try {
      const res = await fetch(`/api/clubs/${selectedClub.id}/members?studentId=${studentId}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to remove member'); }
      toast.success('Member removed successfully');
      loadMembers(selectedClub.id);
      loadClubs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleAddEvent = async () => {
    if (!selectedClub) return;
    const form = document.querySelector('[data-event-form]') as HTMLFormElement;
    if (!form) return;
    const formData = new FormData(form);
    const title = formData.get('title') as string;
    const eventDate = formData.get('eventDate') as string;
    if (!title || !eventDate) { toast.error('Title and event date are required'); return; }

    setAddingEvent(true);
    try {
      const res = await fetch(`/api/clubs/${selectedClub.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: formData.get('description') || null,
          eventDate,
          location: formData.get('location') || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create event');
      toast.success('Event created successfully');
      setAddEventOpen(false);
      loadEvents(selectedClub.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setAddingEvent(false);
    }
  };

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Users className="size-12 opacity-30" />
        <p className="mt-3 text-sm">Select a school to view clubs</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (selectedClub) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedClub(null)}>
            <ChevronLeft className="size-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{selectedClub.name}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedClub.memberCount} members &middot; {events.length} events
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => { setEditClub(selectedClub); setSelectedClub(null); }}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        </div>

        {selectedClub.description && (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">{selectedClub.description}</CardContent></Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 text-center"><Calendar className="size-4 mx-auto mb-1 text-muted-foreground" /><p className="text-xs font-medium">{selectedClub.meetingDay}</p><p className="text-xs text-muted-foreground">Day</p></Card>
          <Card className="p-3 text-center"><Clock className="size-4 mx-auto mb-1 text-muted-foreground" /><p className="text-xs font-medium">{selectedClub.meetingTime}</p><p className="text-xs text-muted-foreground">Time</p></Card>
          <Card className="p-3 text-center"><MapPin className="size-4 mx-auto mb-1 text-muted-foreground" /><p className="text-xs font-medium">{selectedClub.meetingVenue || 'TBD'}</p><p className="text-xs text-muted-foreground">Venue</p></Card>
          <Card className="p-3 text-center"><DollarSign className="size-4 mx-auto mb-1 text-muted-foreground" /><p className="text-xs font-medium">{selectedClub.membershipFee ? `$${selectedClub.membershipFee}` : 'Free'}</p><p className="text-xs text-muted-foreground">Fee</p></Card>
        </div>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members" className="gap-1"><Users className="size-3.5" /> Members ({members.length})</TabsTrigger>
            <TabsTrigger value="events" className="gap-1"><Calendar className="size-3.5" /> Events ({events.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={() => setAddMemberOpen(true)}>
                <UserPlus className="size-3.5" /> Add Member
              </Button>
            </div>
            {loadingMembers ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground"><Users className="size-8 opacity-30" /><p className="mt-2 text-sm">No members yet</p></div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-card border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium uppercase">
                        {m.student.user.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.student.user.name}</p>
                        <p className="text-xs text-muted-foreground">{m.student.admissionNo} &middot; {m.role}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleRemoveMember(m.student.id)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={() => setAddEventOpen(true)}>
                <Plus className="size-3.5" /> Add Event
              </Button>
            </div>
            {loadingEvents ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground"><Calendar className="size-8 opacity-30" /><p className="mt-2 text-sm">No events scheduled</p></div>
            ) : (
              <div className="space-y-2">
                {events.map((e) => (
                  <div key={e.id} className="p-3 bg-card border rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{e.title}</p>
                      <Badge variant="outline" className="text-xs">{new Date(e.eventDate).toLocaleDateString()}</Badge>
                    </div>
                    {e.description && <p className="text-xs text-muted-foreground mt-1">{e.description}</p>}
                    {e.location && <p className="text-xs text-muted-foreground mt-1"><MapPin className="size-3 inline mr-1" />{e.location}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={deleting === selectedClub.id}>
              {deleting === selectedClub.id ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              Delete Club
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Club</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete "{selectedClub.name}"? This will remove all memberships and events.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteClub(selectedClub.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={addMemberOpen} onOpenChange={(o) => { if (!o) { setAddMemberOpen(false); setSelectedStudentIds(new Set()); setMemberSearchQuery(''); } }}>
          <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Members</DialogTitle><DialogDescription>Select students to add to this club. You can select multiple.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Role (applied to all selected)</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="president">President</SelectItem>
                    <SelectItem value="vice_president">Vice President</SelectItem>
                    <SelectItem value="secretary">Secretary</SelectItem>
                    <SelectItem value="treasurer">Treasurer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input value={memberSearchQuery} onChange={e => setMemberSearchQuery(e.target.value)} placeholder="Search students..." className="pl-10" />
                </div>
              </div>
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No students found</div>
                ) : (
                  <div className="divide-y">
                    <label className="flex items-center gap-3 p-2.5 bg-muted/50 cursor-pointer hover:bg-muted/80 sticky top-0">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="size-4 rounded border-gray-300"
                        checked={allFilteredSelected && filteredStudents.length > 0}
                        onChange={() => {
                          if (allFilteredSelected) {
                            setSelectedStudentIds(new Set());
                          } else {
                            setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
                          }
                        }}
                      />
                      <span className="text-sm font-medium">{allFilteredSelected ? 'Deselect all' : 'Select all'} ({filteredStudents.length})</span>
                    </label>
                    {filteredStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-gray-300"
                          checked={selectedStudentIds.has(s.id)}
                          onChange={() => toggleStudentSelection(s.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.admissionNo}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{selectedStudentIds.size} student(s) selected</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddMemberOpen(false); setSelectedStudentIds(new Set()); setMemberSearchQuery(''); }}>Cancel</Button>
              <Button onClick={handleAddMember} disabled={addingMember || selectedStudentIds.size === 0}>
                {addingMember && <Loader2 className="size-4 animate-spin mr-1" />}
                {addingMember ? 'Adding...' : `Add ${selectedStudentIds.size} Member(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Event</DialogTitle><DialogDescription>Schedule a new club event.</DialogDescription></DialogHeader>
            <form data-event-form onSubmit={(e) => { e.preventDefault(); handleAddEvent(); }}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Title</Label><Input name="title" placeholder="Event title" required /></div>
                <div className="grid gap-2"><Label>Date</Label><Input name="eventDate" type="datetime-local" required /></div>
                <div className="grid gap-2"><Label>Description</Label><Textarea name="description" placeholder="Event description" /></div>
                <div className="grid gap-2"><Label>Location</Label><Input name="location" placeholder="Event location" /></div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddEventOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addingEvent}>
                  {addingEvent && <Loader2 className="size-4 animate-spin mr-1" />}Create Event
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">Clubs & Societies</h2>
          <p className="text-sm text-muted-foreground">{clubs.length} clubs configured</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add Club
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club, idx) => (
          <motion.div key={club.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} whileHover={{ scale: 1.02 }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectClub(club)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{club.name}</h3>
                    {club.patronName && <p className="text-xs text-muted-foreground">Patron: {club.patronName}</p>}
                  </div>
                  <Badge variant={club.isActive ? 'default' : 'secondary'} className="text-xs">
                    {club.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {club.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{club.description}</p>}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="size-3.5" />{club.memberCount}</span>
                  <span className="flex items-center gap-1"><Calendar className="size-3.5" />{club.meetingDay}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3.5" />{club.meetingTime}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {clubs.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="size-10 opacity-40" />
          <p className="mt-2 text-sm">No clubs configured yet</p>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Club</DialogTitle><DialogDescription>Create a new club or society.</DialogDescription></DialogHeader>
          <form data-club-form onSubmit={(e) => { e.preventDefault(); handleAddClub(); }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Club Name</Label><Input name="name" placeholder="e.g. Debate Club" required /></div>
                <div className="grid gap-2"><Label>Patron Name</Label><Input name="patronName" placeholder="Teacher name" /></div>
              </div>
              <div className="grid gap-2"><Label>Description</Label><Textarea name="description" placeholder="Brief description of the club" /></div>
              <div className="grid gap-2"><Label>Mission</Label><Textarea name="mission" placeholder="Club mission statement" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Meeting Day</Label>
                  <Select name="meetingDay" defaultValue="Monday">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Time</Label><Input name="meetingTime" type="time" defaultValue="15:00" /></div>
                <div className="grid gap-2"><Label>Venue</Label><Input name="meetingVenue" placeholder="Room / Hall" /></div>
              </div>
              <div className="grid gap-2"><Label>Membership Fee ($)</Label><Input name="membershipFee" type="number" min="0" step="0.01" placeholder="0.00" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={adding}>{adding && <Loader2 className="size-4 animate-spin mr-1" />}Create Club</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editClub} onOpenChange={(o) => { if (!o) setEditClub(null); }}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Club</DialogTitle><DialogDescription>Update club details.</DialogDescription></DialogHeader>
          {editClub && (
            <form onSubmit={handleUpdateClub}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Club Name</Label><Input name="name" defaultValue={editClub.name} required /></div>
                  <div className="grid gap-2"><Label>Patron Name</Label><Input name="patronName" defaultValue={editClub.patronName || ''} /></div>
                </div>
                <div className="grid gap-2"><Label>Description</Label><Textarea name="description" defaultValue={editClub.description || ''} /></div>
                <div className="grid gap-2"><Label>Mission</Label><Textarea name="mission" defaultValue={editClub.mission || ''} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="grid gap-2"><Label>Meeting Day</Label>
                    <Select name="meetingDay" defaultValue={editClub.meetingDay}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Time</Label><Input name="meetingTime" type="time" defaultValue={editClub.meetingTime} /></div>
                  <div className="grid gap-2"><Label>Venue</Label><Input name="meetingVenue" defaultValue={editClub.meetingVenue || ''} /></div>
                </div>
                <div className="grid gap-2"><Label>Membership Fee ($)</Label><Input name="membershipFee" type="number" min="0" step="0.01" defaultValue={editClub.membershipFee ?? ''} /></div>
                <div className="grid gap-2"><Label>Status</Label>
                  <Select name="isActive" defaultValue={editClub.isActive ? 'true' : 'false'}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditClub(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin mr-1" />}Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
