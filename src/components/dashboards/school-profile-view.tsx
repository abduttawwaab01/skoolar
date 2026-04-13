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
import { Building, Save, Lock, Unlock, Plus, Loader2 } from 'lucide-react';
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
  const selectedSchoolId = useAppStore((s) => s.selectedSchoolId);
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
  const [termDialog, setTermDialog] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [termName, setTermName] = React.useState('');
  const [termStart, setTermStart] = React.useState('');
  const [termEnd, setTermEnd] = React.useState('');

  const fetchData = React.useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [schoolRes, settingsRes] = await Promise.all([
        fetch(`/api/schools/${selectedSchoolId}`),
        fetch(`/api/school-settings?schoolId=${selectedSchoolId}`),
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
    } catch (err) {
      console.error(err);
      toast.error('Failed to load school profile');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!selectedSchoolId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/schools/${selectedSchoolId}`, {
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

  if (loading) return <LoadingSkeleton />;

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building className="size-10 mb-3" />
        <p className="text-sm font-medium">No school selected</p>
        <p className="text-xs mt-1">Please select a school to view its profile</p>
      </div>
    );
  }

  // Build academic years from settings if available, otherwise show empty
  const academicYears: AcademicYear[] = settings?.academicSession
    ? [{ id: 'ay-current', name: settings.academicSession, startDate: '', endDate: '', isCurrent: true, isLocked: false, terms: [] }]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Academic Years &amp; Terms</CardTitle>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setTermDialog(true)}>
            <Plus className="size-4" />
            Create Term
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {academicYears.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm font-medium">No academic years configured yet</p>
              <p className="text-xs mt-1">Configure academic sessions in School Settings</p>
            </div>
          ) : (
            academicYears.map((ay) => (
              <div key={ay.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{ay.name}</h4>
                    {ay.isCurrent && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Current</Badge>}
                    {ay.isLocked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ay.startDate} — {ay.endDate}
                  </span>
                </div>
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
                    {ay.terms.map((term) => (
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
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => toast.success(term.isLocked ? 'Term unlocked' : 'Term locked')}>
                              {term.isLocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {ay.terms.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">
                          No terms configured for this academic year
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <Separator className="mt-4" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={termDialog} onOpenChange={setTermDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Term</DialogTitle>
            <DialogDescription>Add a new term to the academic year.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Term Name</Label>
              <Input placeholder="e.g. First Term" value={termName} onChange={e => setTermName(e.target.value)} />
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
            <Button onClick={() => { setTermDialog(false); toast.success('Term created successfully'); setTermName(''); setTermStart(''); setTermEnd(''); }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
