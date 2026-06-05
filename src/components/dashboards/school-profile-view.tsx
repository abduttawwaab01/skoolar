'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Building, Save, Lock, Unlock, Plus, Loader2, CheckCircle2, Pencil } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface SchoolData {
  id: string;
  name: string;
  address?: string | null;
  motto?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  slug?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  region?: string | null;
  plan?: string | null;
  isActive?: boolean;
  maxStudents?: number | null;
  maxTeachers?: number | null;
  foundedDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    students?: number;
    teachers?: number;
    classes?: number;
    subjects?: number;
    academicYears?: number;
  };
}

interface SchoolSettingsData {
  id?: string;
  schoolId?: string;
  scoreSystem?: string;
  fontFamily?: string;
  theme?: string;
  schoolMotto?: string | null;
  schoolVision?: string | null;
  schoolMission?: string | null;
  principalName?: string | null;
  vicePrincipalName?: string | null;
  nextTermBegins?: string | null;
  academicSession?: string | null;
}

interface AcademicTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isLocked: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isLocked: boolean;
  terms: AcademicTerm[];
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-56 mt-1" /></div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Card><CardContent className="p-6"><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></CardContent></Card>
      <Card><CardHeader className="pb-3"><Skeleton className="h-5 w-48" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
    </div>
  );
}

export function SchoolProfileView() {
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedSchoolId = useAppStore((s) => s.selectedSchoolId);
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [school, setSchool] = React.useState<SchoolData | null>(null);
  const [settings, setSettings] = React.useState<SchoolSettingsData | null>(null);
  const [form, setForm] = React.useState({
    name: '',
    address: '',
    motto: '',
    phone: '',
    email: '',
    website: '',
  });
  const [academicYears, setAcademicYears] = React.useState<AcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState<string>('');
  const [termDialog, setTermDialog] = React.useState(false);
  const [creatingTerm, setCreatingTerm] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [termName, setTermName] = React.useState('');
  const [termOrder, setTermOrder] = React.useState('');
  const [termStart, setTermStart] = React.useState('');
  const [termEnd, setTermEnd] = React.useState('');

  // Academic year edit dialog
  const [yearEditDialog, setYearEditDialog] = React.useState(false);
  const [savingYear, setSavingYear] = React.useState(false);
  const [yearEditName, setYearEditName] = React.useState('');
  const [yearEditStart, setYearEditStart] = React.useState('');
  const [yearEditEnd, setYearEditEnd] = React.useState('');
  const [yearEditIsCurrent, setYearEditIsCurrent] = React.useState(false);

  // Term edit dialog
  const [termEditDialog, setTermEditDialog] = React.useState(false);
  const [savingTermEdit, setSavingTermEdit] = React.useState(false);
  const [editingTermId, setEditingTermId] = React.useState('');
  const [termEditName, setTermEditName] = React.useState('');
  const [termEditOrder, setTermEditOrder] = React.useState('');
  const [termEditStart, setTermEditStart] = React.useState('');
  const [termEditEnd, setTermEditEnd] = React.useState('');

  const fetchData = React.useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [schoolRes, settingsRes, yearsRes] = await Promise.all([
        fetch(`/api/schools/${schoolId}`),
        fetch(`/api/school-settings?schoolId=${schoolId}`),
        fetch(`/api/academic-years?schoolId=${schoolId}&limit=10`),
      ]);

      if (!schoolRes.ok) throw new Error('Failed to fetch school data');
      const schoolJson = await schoolRes.json();
      const schoolData: SchoolData = schoolJson.data;
      setSchool(schoolData);
      setForm({
        name: schoolData.name || '',
        address: schoolData.address || '',
        motto: schoolData.motto || '',
        phone: schoolData.phone || '',
        email: schoolData.email || '',
        website: schoolData.website || '',
      });

      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        setSettings(settingsJson.data);
      }

      if (yearsRes.ok) {
        const yearsJson = await yearsRes.json();
        const toDateInput = (d: string | Date | null | undefined) => {
          if (!d) return '';
          const date = new Date(d);
          if (isNaN(date.getTime())) return '';
          return date.toISOString().split('T')[0];
        };
        const years: AcademicYear[] = (yearsJson.data || []).map((y: any) => ({
          id: y.id,
          name: y.name,
          startDate: toDateInput(y.startDate),
          endDate: toDateInput(y.endDate),
          isCurrent: y.isCurrent,
          isLocked: y.isLocked,
          terms: (y.terms || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            startDate: toDateInput(t.startDate),
            endDate: toDateInput(t.endDate),
            isCurrent: t.isCurrent,
            isLocked: t.isLocked,
          })),
        }));
        setAcademicYears(years);
        setAcademicYears(years);
        const currentYear = years.find((y) => y.isCurrent);
        if (currentYear) {
          setSelectedAcademicYearId(currentYear.id);
        } else if (years.length > 0) {
          setSelectedAcademicYearId(years[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load school profile');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          motto: form.motto,
          phone: form.phone,
          email: form.email,
          website: form.website,
        }),
      });
      if (!res.ok) throw new Error('Failed to save school profile');
      setSaved(true);
      toast.success('School profile saved successfully');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save school profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrentYear = async (yearId: string) => {
    try {
      const res = await fetch(`/api/academic-years/${yearId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCurrent: true }),
      });
      if (!res.ok) throw new Error('Failed to set current academic year');
      toast.success('Current academic year updated');
      fetchData();
    } catch {
      toast.error('Failed to set current academic year');
    }
  };

  const handleToggleLockTerm = async (termId: string, currentlyLocked: boolean) => {
    try {
      const res = await fetch(`/api/terms/${termId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !currentlyLocked }),
      });
      if (!res.ok) throw new Error('Failed to update term');
      toast.success(currentlyLocked ? 'Term unlocked' : 'Term locked');
      fetchData();
    } catch {
      toast.error('Failed to update term');
    }
  };

  const handleSetCurrentTerm = async (termId: string) => {
    try {
      const res = await fetch(`/api/terms/${termId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCurrent: true }),
      });
      if (!res.ok) throw new Error('Failed to set current term');
      toast.success('Current term updated');
      fetchData();
    } catch {
      toast.error('Failed to set current term');
    }
  };

  const handleCreateTerm = async () => {
    if (!termName || !termOrder || !termStart || !termEnd || !selectedAcademicYearId) {
      toast.error('Please fill all fields');
      return;
    }
    setCreatingTerm(true);
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYearId: selectedAcademicYearId,
          schoolId,
          name: termName,
          order: parseInt(termOrder),
          startDate: termStart,
          endDate: termEnd,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create term');
      }
      toast.success('Term created successfully');
      setTermDialog(false);
      setTermName('');
      setTermOrder('');
      setTermStart('');
      setTermEnd('');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create term';
      toast.error(msg);
    } finally {
      setCreatingTerm(false);
    }
  };

  const handleEditYear = (year: AcademicYear) => {
    setYearEditName(year.name);
    setYearEditStart(year.startDate);
    setYearEditEnd(year.endDate);
    setYearEditIsCurrent(year.isCurrent);
    setYearEditDialog(true);
  };

  const handleSaveYearEdit = async () => {
    if (!selectedAcademicYearId || !yearEditName) {
      toast.error('Name is required');
      return;
    }
    setSavingYear(true);
    try {
      const res = await fetch(`/api/academic-years/${selectedAcademicYearId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: yearEditName,
          startDate: yearEditStart,
          endDate: yearEditEnd,
          isCurrent: yearEditIsCurrent,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update academic year');
      }
      toast.success('Academic year updated');
      setYearEditDialog(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update academic year');
    } finally {
      setSavingYear(false);
    }
  };

  const handleEditTerm = (term: AcademicTerm) => {
    setEditingTermId(term.id);
    setTermEditName(term.name);
    setTermEditOrder('');
    setTermEditStart(term.startDate);
    setTermEditEnd(term.endDate);
    setTermEditDialog(true);
  };

  const handleSaveTermEdit = async () => {
    if (!editingTermId || !termEditName) {
      toast.error('Name is required');
      return;
    }
    setSavingTermEdit(true);
    try {
      const body: Record<string, unknown> = { name: termEditName };
      if (termEditOrder) body.order = parseInt(termEditOrder);
      if (termEditStart) body.startDate = termEditStart;
      if (termEditEnd) body.endDate = termEditEnd;

      const res = await fetch(`/api/terms/${editingTermId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update term');
      }
      toast.success('Term updated');
      setTermEditDialog(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update term');
    } finally {
      setSavingTermEdit(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building className="size-10 mb-3" />
        <p className="text-sm font-medium">No school selected</p>
        <p className="text-xs mt-1">Please select a school to view its profile</p>
      </div>
    );
  }

  const selectedYear = academicYears.find((y) => y.id === selectedAcademicYearId);
  const displayTerms = selectedYear?.terms || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building className="size-5" />
            School Profile
          </h2>
          <p className="text-sm text-muted-foreground">Manage your school&apos;s information</p>
        </div>
        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>School Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>School Motto</Label>
            <Input
              value={form.motto}
              onChange={(e) => setForm({ ...form, motto: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* School Settings Summary */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">School Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Academic Session</Label>
              <p className="text-sm font-medium">{settings.academicSession || 'Not set'}</p>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Score System</Label>
              <p className="text-sm font-medium capitalize">{settings.scoreSystem?.replace('_', ' ') || 'Midterm + Exam'}</p>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Principal Name</Label>
              <p className="text-sm font-medium">{settings.principalName || 'Not set'}</p>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Vice Principal Name</Label>
              <p className="text-sm font-medium">{settings.vicePrincipalName || 'Not set'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Academic Years &amp; Terms</CardTitle>
          <div className="flex items-center gap-2">
            {academicYears.length > 0 && (
              <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name} {y.isCurrent ? '(Current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setTermDialog(true)} disabled={!selectedAcademicYearId}>
              <Plus className="size-4" />
              Create Term
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {academicYears.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm font-medium">No academic years configured yet</p>
              <p className="text-xs mt-1">Configure academic sessions in School Settings</p>
            </div>
          ) : selectedYear ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{selectedYear.name}</h4>
                  {selectedYear.isCurrent && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Current</Badge>}
                  {selectedYear.isLocked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
                  {!selectedYear.isCurrent && (
                    <Button variant="ghost" size="icon" className="size-7" title="Set as current academic year" onClick={() => handleSetCurrentYear(selectedYear.id)}>
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="size-7" title="Edit academic year" onClick={() => handleEditYear(selectedYear)}>
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {selectedYear.startDate} — {selectedYear.endDate}
                </span>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Term</TableHead>
                    <TableHead className="text-xs">Period</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayTerms.map((term) => (
                    <TableRow key={term.id}>
                      <TableCell className="text-sm">{term.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {term.startDate} — {term.endDate}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {term.isCurrent && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Active</Badge>}
                          {term.isLocked && <Badge variant="secondary" className="text-[10px]">Locked</Badge>}
                          {!term.isCurrent && !term.isLocked && <Badge variant="outline" className="text-[10px]">Upcoming</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-7" title="Edit term" onClick={() => handleEditTerm(term)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {!term.isCurrent && (
                            <Button variant="ghost" size="icon" className="size-7" title="Set as current term" onClick={() => handleSetCurrentTerm(term.id)}>
                              <CheckCircle2 className="size-3.5 text-emerald-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="size-7" title={term.isLocked ? 'Unlock term' : 'Lock term'} onClick={() => handleToggleLockTerm(term.id, term.isLocked)}>
                            {term.isLocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {displayTerms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">
                        No terms configured for this academic year
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm font-medium">Select an academic year</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={termDialog} onOpenChange={setTermDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Term</DialogTitle>
            <DialogDescription>
              Add a new term to {selectedYear?.name || 'the selected academic year'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Term Name</Label>
              <Input placeholder="e.g. First Term" value={termName} onChange={e => setTermName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Order (1, 2, 3...)</Label>
                <Input type="number" min="1" placeholder="e.g. 1" value={termOrder} onChange={e => setTermOrder(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Academic Year</Label>
                <Input value={selectedYear?.name || ''} disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={termStart} onChange={e => setTermStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input type="date" value={termEnd} onChange={e => setTermEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTermDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTerm} disabled={creatingTerm}>
              {creatingTerm ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Academic Year Dialog */}
      <Dialog open={yearEditDialog} onOpenChange={setYearEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Academic Year</DialogTitle>
            <DialogDescription>Update the academic year details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Year Name</Label>
              <Input placeholder="e.g. 2025/2026" value={yearEditName} onChange={e => setYearEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={yearEditStart} onChange={e => setYearEditStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input type="date" value={yearEditEnd} onChange={e => setYearEditEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Input type="checkbox" checked={yearEditIsCurrent} onChange={e => setYearEditIsCurrent(e.target.checked)} />
              Set as current academic year
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveYearEdit} disabled={savingYear}>
              {savingYear ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Term Dialog */}
      <Dialog open={termEditDialog} onOpenChange={setTermEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Term</DialogTitle>
            <DialogDescription>Update the term details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Term Name</Label>
              <Input placeholder="e.g. First Term" value={termEditName} onChange={e => setTermEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Order (1, 2, 3...)</Label>
                <Input type="number" min="1" placeholder="e.g. 1" value={termEditOrder} onChange={e => setTermEditOrder(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Academic Year</Label>
                <Input value={selectedYear?.name || ''} disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={termEditStart} onChange={e => setTermEditStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input type="date" value={termEditEnd} onChange={e => setTermEditEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTermEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTermEdit} disabled={savingTermEdit}>
              {savingTermEdit ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
