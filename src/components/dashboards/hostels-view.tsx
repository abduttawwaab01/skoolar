'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';

import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, User, Plus, Search, Loader2, Bed, DoorOpen,
  ArrowLeft, X, AlertCircle,
  Ban, ArrowRightFromLine, UserPlus, Check,
} from 'lucide-react';

interface Hostel {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  gender: string;
  capacity: number;
  wardenName: string | null;
  wardenPhone: string | null;
  wardenEmail: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { rooms: number; allocations: number };
  rooms: HostelRoom[];
}

interface HostelRoom {
  id: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  isActive: boolean;
  _count: { beds: number };
  beds: HostelBed[];
}

interface HostelBed {
  id: string;
  bedNumber: string;
  isOccupied: boolean;
  allocation: { id: string; studentId: string; student: { id: string; admissionNo: string; user: { name: string; avatar: string | null } } } | null;
}

interface Student {
  id: string;
  admissionNo: string;
  user: { id: string; name: string; email: string };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function HostelsView() {
  const { selectedSchoolId, currentUser, currentRole } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [page, setPage] = useState(1);

  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);
  const [hostelDetail, setHostelDetail] = useState<Hostel | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editHostel, setEditHostel] = useState<Hostel | null>(null);
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState('mixed');
  const [formCapacity, setFormCapacity] = useState('50');
  const [formWardenName, setFormWardenName] = useState('');
  const [formWardenPhone, setFormWardenPhone] = useState('');
  const [formWardenEmail, setFormWardenEmail] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomFloor, setRoomFloor] = useState('1');
  const [roomCapacity, setRoomCapacity] = useState('4');
  const [roomSubmitting, setRoomSubmitting] = useState(false);

  const [allocateOpen, setAllocateOpen] = useState(false);
  const [selectedRoomForAllocation, setSelectedRoomForAllocation] = useState<HostelRoom | null>(null);
  const [selectedBedForAllocation, setSelectedBedForAllocation] = useState<HostelBed | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearching, setStudentSearching] = useState(false);
  const [allocating, setAllocating] = useState(false);

  const [vacateDialog, setVacateDialog] = useState<{ open: boolean; allocationId: string; studentName: string }>({ open: false, allocationId: '', studentName: '' });
  const [vacating, setVacating] = useState(false);

  const [transferDialog, setTransferDialog] = useState<{ open: boolean; allocationId: string; studentName: string; hostelId: string }>({ open: false, allocationId: '', studentName: '', hostelId: '' });
  const [transferring, setTransferring] = useState(false);
  const [transferTargetBed, setTransferTargetBed] = useState('');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'hostel' | 'room'; id: string; name: string }>({ open: false, type: 'hostel', id: '', name: '' });
  const [deleting, setDeleting] = useState(false);

  const fetchHostels = useCallback(async () => {
    if (!schoolId) {
      setError('No school selected');
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      setIsLoading(true);
      const params = new URLSearchParams({ schoolId, limit: '50', page: page.toString() });
      if (search) params.set('search', search);
      if (genderFilter) params.set('gender', genderFilter);
      const res = await fetch(`/api/hostels?${params}`);
      if (!res.ok) throw new Error('Failed to fetch hostels');
      const json = await res.json();
      setHostels(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load hostels';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, search, genderFilter, page]);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  const fetchHostelDetail = useCallback(async (hostelId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/hostels/${hostelId}?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to fetch hostel details');
      const json = await res.json();
      setHostelDetail(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load hostel');
    } finally {
      setDetailLoading(false);
    }
  }, [schoolId]);

  const handleSelectHostel = (hostel: Hostel) => {
    if (selectedHostel?.id === hostel.id) {
      setSelectedHostel(null);
      setHostelDetail(null);
      return;
    }
    setSelectedHostel(hostel);
    fetchHostelDetail(hostel.id);
  };

  const resetForm = () => {
    setFormName('');
    setFormGender('mixed');
    setFormCapacity('50');
    setFormWardenName('');
    setFormWardenPhone('');
    setFormWardenEmail('');
    setFormDescription('');
    setFormAddress('');
    setEditHostel(null);
  };

  const openEditDialog = (hostel: Hostel) => {
    setEditHostel(hostel);
    setFormName(hostel.name);
    setFormGender(hostel.gender);
    setFormCapacity(hostel.capacity.toString());
    setFormWardenName(hostel.wardenName || '');
    setFormWardenPhone(hostel.wardenPhone || '');
    setFormWardenEmail(hostel.wardenEmail || '');
    setFormDescription(hostel.description || '');
    setFormAddress(hostel.address || '');
    setAddOpen(true);
  };

  const handleSubmitHostel = async () => {
    if (!formName.trim()) {
      toast.error('Hostel name is required');
      return;
    }
    setFormSubmitting(true);
    try {
      const url = editHostel
        ? `/api/hostels/${editHostel.id}?schoolId=${schoolId}`
        : `/api/hostels?schoolId=${schoolId}`;
      const method = editHostel ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          gender: formGender,
          capacity: parseInt(formCapacity) || 50,
          wardenName: formWardenName || null,
          wardenPhone: formWardenPhone || null,
          wardenEmail: formWardenEmail || null,
          description: formDescription || null,
          address: formAddress || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save hostel');
      toast.success(editHostel ? 'Hostel updated' : 'Hostel created');
      setAddOpen(false);
      resetForm();
      fetchHostels();
      if (selectedHostel?.id === editHostel?.id) {
        fetchHostelDetail(editHostel!.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save hostel');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteHostel = async () => {
    if (deleteDialog.type !== 'hostel') return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hostels/${deleteDialog.id}?schoolId=${schoolId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      toast.success('Hostel deleted');
      setDeleteDialog({ open: false, type: 'hostel', id: '', name: '' });
      if (selectedHostel?.id === deleteDialog.id) {
        setSelectedHostel(null);
        setHostelDetail(null);
      }
      fetchHostels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddRoom = async () => {
    if (!roomNumber.trim() || !selectedHostel) {
      toast.error('Room number is required');
      return;
    }
    setRoomSubmitting(true);
    try {
      const res = await fetch(`/api/hostels/${selectedHostel.id}/rooms?schoolId=${schoolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber: roomNumber.trim(),
          floor: parseInt(roomFloor) || 1,
          capacity: parseInt(roomCapacity) || 4,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create room');
      toast.success('Room created');
      setAddRoomOpen(false);
      setRoomNumber('');
      setRoomFloor('1');
      setRoomCapacity('4');
      fetchHostelDetail(selectedHostel.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setRoomSubmitting(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (deleteDialog.type !== 'room') return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hostels/${selectedHostel?.id}/rooms/${deleteDialog.id}?schoolId=${schoolId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete room');
      toast.success('Room deleted');
      setDeleteDialog({ open: false, type: 'room', id: '', name: '' });
      if (selectedHostel) fetchHostelDetail(selectedHostel.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete room');
    } finally {
      setDeleting(false);
    }
  };

  const searchStudents = async (query: string) => {
    setStudentSearch(query);
    if (!query.trim() || query.length < 2) {
      setStudentResults([]);
      return;
    }
    setStudentSearching(true);
    try {
      const res = await fetch(`/api/students?schoolId=${schoolId}&search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setStudentResults(json.data || []);
      }
    } catch {
      setStudentResults([]);
    } finally {
      setStudentSearching(false);
    }
  };

  const openAllocateDialog = (room: HostelRoom, bed: HostelBed) => {
    setSelectedRoomForAllocation(room);
    setSelectedBedForAllocation(bed);
    setStudentSearch('');
    setStudentResults([]);
    setSelectedStudent(null);
    setAllocateOpen(true);
  };

  const handleAllocate = async () => {
    if (!selectedStudent || !selectedBedForAllocation || !selectedHostel || !selectedRoomForAllocation) {
      toast.error('Please select a student and a bed');
      return;
    }
    setAllocating(true);
    try {
      const res = await fetch(`/api/hostel-allocations?schoolId=${schoolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          hostelId: selectedHostel.id,
          roomId: selectedRoomForAllocation.id,
          bedId: selectedBedForAllocation.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to allocate');
      toast.success(`${selectedStudent.user.name} allocated to Bed ${selectedBedForAllocation.bedNumber}`);
      setAllocateOpen(false);
      fetchHostelDetail(selectedHostel.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Allocation failed');
    } finally {
      setAllocating(false);
    }
  };

  const handleVacate = async () => {
    setVacating(true);
    try {
      const res = await fetch(`/api/hostel-allocations?schoolId=${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocationId: vacateDialog.allocationId,
          action: 'vacate',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to vacate');
      toast.success(`${vacateDialog.studentName} vacated successfully`);
      setVacateDialog({ open: false, allocationId: '', studentName: '' });
      if (selectedHostel) fetchHostelDetail(selectedHostel.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to vacate');
    } finally {
      setVacating(false);
    }
  };

  const openTransferDialog = (allocation: { id: string; student: { user: { name: string } } }, hostelId: string) => {
    setTransferDialog({ open: true, allocationId: allocation.id, studentName: allocation.student.user.name, hostelId });
    setTransferTargetBed('');
  };

  const handleTransfer = async () => {
    if (!transferTargetBed) {
      toast.error('Please select a target bed');
      return;
    }
    setTransferring(true);
    try {
      const res = await fetch(`/api/hostel-allocations?schoolId=${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocationId: transferDialog.allocationId,
          action: 'transfer',
          newBedId: transferTargetBed,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to transfer');
      toast.success(`${transferDialog.studentName} transferred successfully`);
      setTransferDialog({ open: false, allocationId: '', studentName: '', hostelId: '' });
      if (selectedHostel) fetchHostelDetail(selectedHostel.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const availableTransferBeds = hostelDetail?.rooms.flatMap(r =>
    r.beds.filter(b => !b.isOccupied && b.id !== transferTargetBed).map(b => ({
      ...b,
      roomNumber: r.roomNumber,
    }))
  ) || [];

  const canEdit = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(currentRole);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Hostel Management</h2>
            <p className="text-sm text-muted-foreground">Manage dormitories, rooms, and student allocations</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Hostel Management</h2>
            <p className="text-sm text-muted-foreground">Manage dormitories, rooms, and student allocations</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchHostels} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h2 className="text-lg font-semibold">Hostel Management</h2>
          <p className="text-sm text-muted-foreground">Manage dormitories, rooms, and student allocations</p>
        </div>
        {canEdit && (
          <Button onClick={() => { resetForm(); setAddOpen(true); }}>
            <Plus className="size-4 mr-2" />Add Hostel
          </Button>
        )}
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search hostels by name or warden..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={genderFilter} onValueChange={v => { setGenderFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Genders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">All Genders</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hostels.length === 0 ? (
        <Card>
          <CardContent className="pt-12 text-center">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground mb-1">No hostels found</p>
            <p className="text-sm text-muted-foreground/60 mb-4">
              {search || genderFilter ? 'Try adjusting your search filters.' : 'Get started by adding your first hostel.'}
            </p>
            {canEdit && !search && !genderFilter && (
              <Button onClick={() => { resetForm(); setAddOpen(true); }}>
                <Plus className="size-4 mr-2" />Add Hostel
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="popLayout">
            {hostels.map((hostel) => (
              <motion.div
                key={hostel.id}
                layout
                variants={itemVariants}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    selectedHostel?.id === hostel.id && 'ring-2 ring-primary shadow-lg'
                  )}
                  onClick={() => handleSelectHostel(hostel)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'flex size-10 items-center justify-center rounded-xl',
                          hostel.gender === 'male' ? 'bg-blue-100 text-blue-700' :
                          hostel.gender === 'female' ? 'bg-pink-100 text-pink-700' :
                          'bg-purple-100 text-purple-700'
                        )}>
                          <Building2 className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{hostel.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{hostel.gender} {hostel.gender !== 'mixed' ? 'dormitory' : ''}</p>
                        </div>
                      </div>
                      <Badge variant={hostel.isActive ? 'default' : 'secondary'} className="text-[10px]">
                        {hostel.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="space-y-1">
                        <span className="text-muted-foreground block">Capacity</span>
                        <span className="font-medium flex items-center gap-1">
                          <Users className="size-3" /> {hostel.capacity}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground block">Rooms</span>
                        <span className="font-medium flex items-center gap-1">
                          <DoorOpen className="size-3" /> {hostel._count.rooms}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground block">Allocated</span>
                        <span className="font-medium flex items-center gap-1">
                          <User className="size-3" /> {hostel._count.allocations}
                        </span>
                      </div>
                    </div>
                    {hostel.wardenName && (
                      <div className="mt-2 pt-2 border-t flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="size-3" />
                        <span>Warden: {hostel.wardenName}</span>
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60">
                        {hostel._count.allocations}/{hostel.capacity} occupied
                      </span>
                      {canEdit && (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => openEditDialog(hostel)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => setDeleteDialog({ open: true, type: 'hostel', id: hostel.id, name: hostel.name })}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {selectedHostel && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setSelectedHostel(null); setHostelDetail(null); }}>
                    <ArrowLeft className="size-4" />
                  </Button>
                  <div>
                    <CardTitle className="text-base">{selectedHostel.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{selectedHostel.description || 'No description'}</p>
                  </div>
                </div>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setAddRoomOpen(true)}>
                    <Plus className="size-4 mr-1" />Add Room
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {detailLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : hostelDetail && hostelDetail.rooms.length === 0 ? (
                <div className="text-center py-8">
                  <DoorOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No rooms in this hostel yet.</p>
                  {canEdit && (
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddRoomOpen(true)}>
                      <Plus className="size-4 mr-1" />Add First Room
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {hostelDetail?.rooms.map(room => (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Card className="border-l-4" style={{
                        borderLeftColor: room.beds.every(b => b.isOccupied) ? '#ef4444' :
                          room.beds.some(b => b.isOccupied) ? '#f59e0b' : '#22c55e',
                      }}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold">Room {room.roomNumber}</p>
                              <p className="text-[10px] text-muted-foreground">Floor {room.floor}</p>
                            </div>
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-[10px]">
                                {room.beds.filter(b => b.isOccupied).length}/{room.beds.length}
                              </Badge>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-destructive"
                                  onClick={() => setDeleteDialog({ open: true, type: 'room', id: room.id, name: `Room ${room.roomNumber}` })}
                                >
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {room.beds.map(bed => (
                              <div
                                key={bed.id}
                                className={cn(
                                  'relative flex items-center gap-1.5 rounded-md border p-1.5 text-xs transition-colors',
                                  bed.isOccupied
                                    ? 'bg-destructive/5 border-destructive/30 text-destructive'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800',
                                  canEdit && !bed.isOccupied && 'cursor-pointer hover:border-primary'
                                )}
                                onClick={() => {
                                  if (!canEdit || bed.isOccupied) return;
                                  openAllocateDialog(room, bed);
                                }}
                              >
                                <Bed className="size-3 shrink-0" />
                                <span className="truncate">{bed.bedNumber}</span>
                                {bed.allocation && (
                                  <span className="absolute -top-1 -right-1">
                                    <span className="relative flex size-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/40 opacity-75" />
                                      <span className="relative inline-flex rounded-full size-2 bg-destructive" />
                                    </span>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          {room.beds.some(b => b.allocation) && (
                            <div className="mt-2 space-y-1">
                              {room.beds.filter(b => b.allocation).map(bed => (
                                <div key={bed.id} className="flex items-center justify-between text-[10px] bg-muted/50 rounded px-1.5 py-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <User className="size-3 shrink-0 text-muted-foreground" />
                                    <span className="truncate font-medium">
                                      {bed.allocation!.student.user.name}
                                    </span>
                                    <span className="text-muted-foreground/60">(Bed {bed.bedNumber})</span>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {canEdit && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 px-1.5 text-[10px]"
                                          onClick={() => openTransferDialog(bed.allocation!, selectedHostel.id)}
                                        >
                                          <ArrowRightFromLine className="size-3 mr-0.5" />Transfer
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 px-1.5 text-[10px] text-destructive"
                                          onClick={() => setVacateDialog({
                                            open: true,
                                            allocationId: bed.allocation!.id,
                                            studentName: bed.allocation!.student.user.name,
                                          })}
                                        >
                                          <Ban className="size-3 mr-0.5" />Vacate
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add/Edit Hostel Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editHostel ? 'Edit Hostel' : 'Add New Hostel'}</DialogTitle>
            <DialogDescription>
              {editHostel ? 'Update the hostel details below.' : 'Fill in the details to create a new hostel.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Hostel Name *</Label>
              <Input placeholder="e.g. Red House" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={formGender} onValueChange={setFormGender}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" min="1" value={formCapacity} onChange={e => setFormCapacity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Warden Name</Label>
              <Input placeholder="Full name" value={formWardenName} onChange={e => setFormWardenName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Warden Phone</Label>
                <Input placeholder="Phone number" value={formWardenPhone} onChange={e => setFormWardenPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Warden Email</Label>
                <Input placeholder="Email address" type="email" value={formWardenEmail} onChange={e => setFormWardenEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Brief description" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input placeholder="Physical address" value={formAddress} onChange={e => setFormAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmitHostel} disabled={formSubmitting}>
              {formSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              {editHostel ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Room Dialog */}
      <Dialog open={addRoomOpen} onOpenChange={setAddRoomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Room to {selectedHostel?.name}</DialogTitle>
            <DialogDescription>Create a new room with auto-generated beds.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Room Number *</Label>
              <Input placeholder="e.g. 101A" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input type="number" min="1" value={roomFloor} onChange={e => setRoomFloor(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bed Capacity</Label>
                <Input type="number" min="1" max="20" value={roomCapacity} onChange={e => setRoomCapacity(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoomOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRoom} disabled={roomSubmitting}>
              {roomSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Create Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Student Dialog */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Student</DialogTitle>
            <DialogDescription>
              {selectedHostel?.name} &mdash; Room {selectedRoomForAllocation?.roomNumber}, Bed {selectedBedForAllocation?.bedNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Type student name or admission no..."
                  value={studentSearch}
                  onChange={e => searchStudents(e.target.value)}
                />
              </div>
              {studentSearching && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Loader2 className="size-3 animate-spin" /> Searching...
                </div>
              )}
            </div>
            {studentResults.length > 0 && (
              <ScrollArea className="h-40 border rounded-md">
                <div className="p-1 space-y-1">
                  {studentResults.map(student => (
                    <button
                      key={student.id}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2',
                        selectedStudent?.id === student.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => {
                        setSelectedStudent(student);
                        setStudentResults([]);
                        setStudentSearch(student.user.name);
                      }}
                    >
                      <User className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{student.user.name}</p>
                        <p className="text-xs text-muted-foreground">{student.admissionNo}</p>
                      </div>
                      {selectedStudent?.id === student.id && (
                        <Check className="size-4 ml-auto shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
            {selectedStudent && (
              <div className="flex items-center gap-2 bg-primary/5 border rounded-md p-3">
                <User className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{selectedStudent.user.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedStudent.admissionNo}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 w-7 p-0"
                  onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateOpen(false)}>Cancel</Button>
            <Button onClick={handleAllocate} disabled={!selectedStudent || allocating}>
              {allocating && <Loader2 className="size-4 mr-2 animate-spin" />}
              <UserPlus className="size-4 mr-2" />Allocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vacate Confirmation */}
      <AlertDialog open={vacateDialog.open} onOpenChange={open => setVacateDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vacate Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to vacate <strong>{vacateDialog.studentName}</strong>? This will free up their bed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVacate} disabled={vacating} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {vacating && <Loader2 className="size-4 mr-2 animate-spin" />}
              Vacate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialog.open} onOpenChange={open => setTransferDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Student</DialogTitle>
            <DialogDescription>
              Move <strong>{transferDialog.studentName}</strong> to a different bed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Target Bed</Label>
              <ScrollArea className="h-48 border rounded-md">
                <div className="p-1 space-y-1">
                  {availableTransferBeds.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No available beds for transfer.</p>
                  ) : (
                    availableTransferBeds.map(bed => (
                      <button
                        key={bed.id}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2',
                          transferTargetBed === bed.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => setTransferTargetBed(bed.id)}
                      >
                        <Bed className="size-4 shrink-0" />
                        <div>
                          <p className="font-medium">Bed {bed.bedNumber}</p>
                          <p className="text-xs text-muted-foreground">Room {(bed as any).roomNumber}</p>
                        </div>
                        {transferTargetBed === bed.id && (
                          <Check className="size-4 ml-auto shrink-0 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialog({ open: false, allocationId: '', studentName: '', hostelId: '' })}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferTargetBed || transferring}>
              {transferring && <Loader2 className="size-4 mr-2 animate-spin" />}
              <ArrowRightFromLine className="size-4 mr-2" />Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.type === 'hostel' ? 'Hostel' : 'Room'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.name}</strong>? This action cannot be undone.
              {deleteDialog.type === 'hostel' && ' All rooms and beds will be archived.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDialog.type === 'hostel' ? handleDeleteHostel : handleDeleteRoom} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
