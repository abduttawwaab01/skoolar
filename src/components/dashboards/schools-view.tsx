'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Building2,
  GraduationCap,
  Users,
  Pencil,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Eye,
  MapPin,
  Globe,
  Phone,
  Mail,
  Palette,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  address: string | null;
  motto: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primaryColor: string;
  secondaryColor: string;
  region: string | null;
  plan: string;
  isActive: boolean;
  maxStudents: number;
  maxTeachers: number;
  foundedDate: string | null;
  createdAt: string;
  _count: { students: number; teachers: number; classes: number };
}

const planColors: Record<string, string> = {
  enterprise: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pro: 'bg-blue-100 text-blue-700 border-blue-200',
  basic: 'bg-gray-100 text-gray-700 border-gray-200',
  premium: 'bg-violet-100 text-violet-700 border-violet-200',
};

interface SchoolFormData {
  name: string;
  slug: string;
  region: string;
  plan: string;
  maxStudents: string;
  maxTeachers: string;
  primaryColor: string;
  secondaryColor: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  motto: string;
}

const defaultSchoolForm: SchoolFormData = {
  name: '', slug: '', region: '', plan: 'basic', maxStudents: '500', maxTeachers: '50',
  primaryColor: '#059669', secondaryColor: '#10B981', address: '', phone: '', email: '', website: '', motto: '',
};

function SchoolFormDialog({
  open,
  onOpenChange,
  editingSchool,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSchool: SchoolRecord | null;
  onSubmit: (data: SchoolFormData) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = React.useState<SchoolFormData>(defaultSchoolForm);
  const isEdit = !!editingSchool;

  React.useEffect(() => {
    if (editingSchool) {
      setForm({
        name: editingSchool.name,
        slug: editingSchool.slug,
        region: editingSchool.region || '',
        plan: editingSchool.plan,
        maxStudents: String(editingSchool.maxStudents),
        maxTeachers: String(editingSchool.maxTeachers),
        primaryColor: editingSchool.primaryColor,
        secondaryColor: editingSchool.secondaryColor,
        address: editingSchool.address || '',
        phone: editingSchool.phone || '',
        email: editingSchool.email || '',
        website: editingSchool.website || '',
        motto: editingSchool.motto || '',
      });
    } else {
      setForm(defaultSchoolForm);
    }
  }, [editingSchool, open]);

  const update = (field: keyof SchoolFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'name' && !isEdit) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setForm(prev => ({ ...prev, slug }));
    }
  };

  const handleSubmit = () => {
    if (!form.name || !form.region || !form.plan) {
      toast.error('Please fill in name, region, and plan');
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="size-5" /> : <Building2 className="size-5" />}
            {isEdit ? 'Edit School' : 'Create New School'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update school details below.' : 'Fill in the details to register a new school.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>School Name *</Label>
                <Input placeholder="Enter school name" value={form.name} onChange={e => update('name', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input placeholder="auto-generated" value={form.slug} onChange={e => update('slug', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Region *</Label>
                <Select value={form.region} onValueChange={v => update('region', v)}>
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>
                    {['Southwest', 'North Central', 'Southeast', 'South-South', 'Northwest', 'Northeast'].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Plan *</Label>
                <Select value={form.plan} onValueChange={v => update('plan', v)}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Max Students</Label>
                <Input type="number" value={form.maxStudents} onChange={e => update('maxStudents', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Max Teachers</Label>
                <Input type="number" value={form.maxTeachers} onChange={e => update('maxTeachers', e.target.value)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                <Palette className="size-4" /> Branding
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)} className="size-8 rounded cursor-pointer border" />
                    <Input value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.secondaryColor} onChange={e => update('secondaryColor', e.target.value)} className="size-8 rounded cursor-pointer border" />
                    <Input value={form.secondaryColor} onChange={e => update('secondaryColor', e.target.value)} className="flex-1" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                <Building2 className="size-4" /> Contact Information
              </p>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Input placeholder="Full address" value={form.address} onChange={e => update('address', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input placeholder="+234-..." value={form.phone} onChange={e => update('phone', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="info@school.com" value={form.email} onChange={e => update('email', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Website</Label>
                    <Input placeholder="www.school.com" value={form.website} onChange={e => update('website', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Motto</Label>
                    <Input placeholder="School motto" value={form.motto} onChange={e => update('motto', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update School' : 'Create School'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SchoolsView() {
  const [schoolList, setSchoolList] = React.useState<SchoolRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editSchool, setEditSchool] = React.useState<SchoolRecord | null>(null);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('');

  const fetchSchools = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/schools?limit=50');
      if (!res.ok) throw new Error('Failed to fetch schools');
      const json = await res.json();
      setSchoolList(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchSchools(); }, [fetchSchools]);

  const filtered = schoolList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.region || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filter || s.plan === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: schoolList.length,
    active: schoolList.filter(s => s.isActive).length,
    totalStudents: schoolList.reduce((sum, s) => sum + (s._count?.students || 0), 0),
    totalTeachers: schoolList.reduce((sum, s) => sum + (s._count?.teachers || 0), 0),
    enterprise: schoolList.filter(s => s.plan === 'enterprise').length,
    pro: schoolList.filter(s => s.plan === 'pro').length,
    basic: schoolList.filter(s => s.plan === 'basic').length,
  };

  const handleCreate = async (data: SchoolFormData) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          region: data.region,
          plan: data.plan,
          maxStudents: parseInt(data.maxStudents) || 500,
          maxTeachers: parseInt(data.maxTeachers) || 50,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          website: data.website || null,
          motto: data.motto || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create school');
      }
      toast.success(`School "${data.name}" created successfully`);
      setCreateOpen(false);
      fetchSchools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create school');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: SchoolFormData) => {
    if (!editSchool) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/schools/${editSchool.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          region: data.region,
          plan: data.plan,
          maxStudents: parseInt(data.maxStudents) || editSchool.maxStudents,
          maxTeachers: parseInt(data.maxTeachers) || editSchool.maxTeachers,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          website: data.website || null,
          motto: data.motto || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update school');
      }
      toast.success(`School "${data.name}" updated successfully`);
      setEditSchool(null);
      fetchSchools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update school');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (schoolId: string) => {
    const school = schoolList.find(s => s.id === schoolId);
    if (!school) return;
    try {
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !school.isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      toast.success(`${school.name} ${school.isActive ? 'deactivated' : 'activated'}`);
      fetchSchools();
    } catch (err) {
      toast.error('Failed to update school status');
    }
  };

  const columns: ColumnDef<SchoolRecord>[] = [
    {
      accessorKey: 'name',
      header: 'School',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl text-white font-bold text-xs" style={{ backgroundColor: row.original.primaryColor }}>
            {row.original.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-medium">{row.original.name}</span>
            <p className="text-xs text-muted-foreground">{row.original.address}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'region',
      header: 'Region',
      cell: ({ row }) => <span className="text-sm">{row.original.region || '-'}</span>,
    },
    {
      accessorKey: 'plan',
      header: 'Plan',
      cell: ({ row }) => (
        <Badge className={planColors[row.original.plan] + ' text-xs border'}>
          {row.original.plan}
        </Badge>
      ),
    },
    {
      accessorKey: 'studentCount',
      header: 'Students',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <GraduationCap className="size-3.5 text-muted-foreground" />
          <span className="text-sm">{row.original._count?.students || 0}/{row.original.maxStudents}</span>
        </div>
      ),
    },
    {
      accessorKey: 'teacherCount',
      header: 'Teachers',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 text-muted-foreground" />
          <span className="text-sm">{row.original._count?.teachers || 0}/{row.original.maxTeachers}</span>
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge variant={row.original.isActive ? 'success' : 'error'} size="sm" pulse={row.original.isActive}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{new Date(row.original.createdAt).toISOString().split('T')[0]}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const school = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditSchool(school)}>
                <Pencil className="size-4" /> Edit School
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleStatus(school.id)}>
                {school.isActive ? <XCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                {school.isActive ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (error && schoolList.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Schools Management</h2>
            <p className="text-sm text-muted-foreground">Manage all registered schools</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="size-12 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="size-6 text-red-600" /></div>
          <div className="text-center">
            <p className="text-sm font-medium">Failed to load schools</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSchools}><RefreshCw className="size-3.5 mr-1.5" /> Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-12" /></Card>)
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="size-3.5" /> Total Schools</div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-500" /> Active</div>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.active}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><GraduationCap className="size-3.5" /> Students</div>
              <p className="text-2xl font-bold mt-1">{stats.totalStudents.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="size-3.5" /> Teachers</div>
              <p className="text-2xl font-bold mt-1">{stats.totalTeachers}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="text-xs px-1 py-0">E</Badge> Enterprise</div>
              <p className="text-2xl font-bold mt-1">{stats.enterprise}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="text-xs px-1 py-0">P</Badge> Pro</div>
              <p className="text-2xl font-bold mt-1">{stats.pro}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="text-xs px-1 py-0">B</Badge> Basic</div>
              <p className="text-2xl font-bold mt-1">{stats.basic}</p>
            </Card>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search schools..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filter} onValueChange={v => setFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Plans" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Plans</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create School
        </Button>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="name"
          searchPlaceholder="Search schools..."
          emptyMessage="No schools found."
        />
      )}

      {/* Create Dialog */}
      <SchoolFormDialog open={createOpen} onOpenChange={setCreateOpen} editingSchool={null} onSubmit={handleCreate} isSubmitting={submitting} />
      {/* Edit Dialog */}
      <SchoolFormDialog open={!!editSchool} onOpenChange={(open) => { if (!open) setEditSchool(null); }} editingSchool={editSchool} onSubmit={handleEdit} isSubmitting={submitting} />
    </div>
  );
}
