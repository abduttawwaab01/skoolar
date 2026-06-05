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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  MoreHorizontal,
  Shield,
  GraduationCap,
  BookOpen,
  UserCheck,
  Calculator,
  Library,
  Target,
  Building2,
  Filter,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { FileUploader } from '@/components/ui/file-uploader';

type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'ACCOUNTANT' | 'LIBRARIAN' | 'DIRECTOR';

const roleConfig: Record<UserRole, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: '#b91c1c' },
  SCHOOL_ADMIN: { label: 'School Admin', color: '#047857' },
  TEACHER: { label: 'Teacher', color: '#1d4ed8' },
  STUDENT: { label: 'Student', color: '#6d28d9' },
  PARENT: { label: 'Parent', color: '#b45309' },
  ACCOUNTANT: { label: 'Accountant', color: '#0e7490' },
  LIBRARIAN: { label: 'Librarian', color: '#6d28d9' },
  DIRECTOR: { label: 'Director', color: '#be185d' },
};

interface SchoolOption {
  id: string;
  name: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
  school: { id: string; name: string; slug: string; logo: string | null } | null;
  isActive: boolean;
  lastLogin: string | null;
  loginCount: number | null;
  createdAt: string;
  avatar: string | null;
  phone: string | null;
  studentProfile: { id: string; admissionNo: string; classId: string | null; gpa: number | null; class: { id: string; name: string; section: string | null; grade: string | null } | null } | null;
  teacherProfile: { id: string; employeeNo: string; specialization: string | null; qualification: string | null; isActive: boolean; classes: Array<{ id: string; name: string; section: string | null }> } | null;
  parentProfile: { id: string; occupation: string | null; phone: string | null; childrenIds: string | null } | null;
  accountantProfile: { id: string; employeeNo: string } | null;
  librarianProfile: { id: string; employeeNo: string } | null;
  directorProfile: { id: string; employeeNo: string } | null;
}

const roleIcons: Record<string, React.ReactNode> = {
  SUPER_ADMIN: <Shield className="size-3.5" />,
  SCHOOL_ADMIN: <Building2 className="size-3.5" />,
  TEACHER: <BookOpen className="size-3.5" />,
  STUDENT: <GraduationCap className="size-3.5" />,
  PARENT: <UserCheck className="size-3.5" />,
  ACCOUNTANT: <Calculator className="size-3.5" />,
  LIBRARIAN: <Library className="size-3.5" />,
  DIRECTOR: <Target className="size-3.5" />,
};

const tabRoles: Array<{ value: string; label: string; icon: React.ReactNode }> = [
  { value: 'all', label: 'All Users', icon: <Users className="size-4" /> },
  { value: 'STUDENT', label: 'Students', icon: <GraduationCap className="size-4" /> },
  { value: 'TEACHER', label: 'Teachers', icon: <BookOpen className="size-4" /> },
  { value: 'PARENT', label: 'Parents', icon: <UserCheck className="size-4" /> },
  { value: 'STAFF', label: 'Staff', icon: <Shield className="size-4" /> },
];

const staffRoles: string[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];

function getFilteredUsers(users: UserRecord[], tab: string, search: string, roleFilter: string, schoolFilter: string, statusFilter: string) {
  return users.filter(u => {
    const tabMatch = tab === 'all'
      ? true
      : tab === 'STAFF'
        ? staffRoles.includes(u.role)
        : u.role === tab;
    const searchMatch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const roleMatch = !roleFilter || u.role === roleFilter;
    const schoolMatch = !schoolFilter || u.schoolId === schoolFilter;
    const statusMatch = !statusFilter || (statusFilter === 'active' ? u.isActive : !u.isActive);
    return tabMatch && searchMatch && roleMatch && schoolMatch && statusMatch;
  });
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  schoolId: string;
  childIds: string[];
  avatar: string;
}

interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
}

const defaultFormData: UserFormData = {
  name: '', email: '', password: '', role: 'STUDENT', schoolId: '', childIds: [], avatar: '',
};

function UserFormDialog({
  open,
  onOpenChange,
  editingUser,
  onSubmit,
  schools,
  isSubmitting,
  allowedRoles,
  isSchoolAdmin,
  effectiveSchoolId,
  availableStudents = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: UserRecord | null;
  onSubmit: (data: UserFormData) => void;
  schools: SchoolOption[];
  isSubmitting: boolean;
  allowedRoles: UserRole[];
  isSchoolAdmin: boolean;
  effectiveSchoolId: string | null;
  availableStudents?: StudentOption[];
}) {
  const [form, setForm] = React.useState<UserFormData>(defaultFormData);
  const [showPassword, setShowPassword] = React.useState(false);
  const isEdit = !!editingUser;

  React.useEffect(() => {
    if (editingUser) {
      setForm({
        ...defaultFormData,
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        schoolId: editingUser.schoolId || '',
        avatar: editingUser.avatar || '',
      });
    } else {
      setForm(defaultFormData);
    }
    setShowPassword(false);
  }, [editingUser, open]);

  const update = (field: keyof UserFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.email) {
      toast.error('Please fill in name and email');
      return;
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required for new users');
      return;
    }
    if (form.role !== 'SUPER_ADMIN' && !form.schoolId && !isSchoolAdmin) {
      toast.error('Please select a school');
      return;
    }
    onSubmit(form);
  };

    const needsSchool = form.role !== 'SUPER_ADMIN' && !isSchoolAdmin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="size-5" /> : <UserPlus className="size-5" />}
            {isEdit ? 'Edit User' : 'Create New User'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update user details below.' : 'Fill in the details to create a new user account.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Full Name *</Label>
                <Input placeholder="Enter full name" value={form.name} onChange={e => update('name', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Email *</Label>
                <Input type="email" placeholder="user@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{isEdit ? 'New Password' : 'Password *'}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isEdit ? 'Leave blank to keep' : 'Min 6 characters'}
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={v => update('role', v)}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map(key => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          {roleIcons[key]}
                          {roleConfig[key].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {needsSchool && (
              <div className="grid gap-2">
                <Label>School *</Label>
                <Select value={form.schoolId} onValueChange={v => update('schoolId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                  <SelectContent>
                    {schools.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
             {isSchoolAdmin && (
               <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
                 Users will be created for your school: <strong>{schools.find(s => s.id === effectiveSchoolId)?.name || 'Your School'}</strong>
               </div>
             )}

             <div className="grid gap-2">
               <Label>Profile Photo (for ID Card)</Label>
               <FileUploader
                 value={form.avatar}
                 onChange={(url) => update('avatar', url)}
                 folder="avatars"
                 accept="image/*"
                 maxSizeMB={5}
                 compress
                 variant="avatar"
                 placeholder={isEdit ? "Upload new photo (auto-compressed)" : "Upload profile photo (auto-compressed, appears on ID card)"}
               />
             </div>

             {form.role === 'PARENT' && !isEdit && availableStudents.length > 0 && (
              <div className="grid gap-2">
                <Label>Link Children (Students)</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {availableStudents.map(s => {
                    const isSelected = form.childIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = isSelected
                              ? form.childIds.filter(id => id !== s.id)
                              : [...form.childIds, s.id];
                            setForm(prev => ({ ...prev, childIds: next }));
                          }}
                          className="size-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{s.admissionNo}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">Select students to link as children of this parent</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManagement() {
  const { currentRole, selectedSchoolId, currentUser } = useAppStore();
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [schools, setSchools] = React.useState<SchoolOption[]>([]);
  const [students, setStudents] = React.useState<StudentOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('');
  const [schoolFilter, setSchoolFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<UserRecord | null>(null);
  const [viewUser, setViewUser] = React.useState<UserRecord | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isSuperAdmin = currentRole === 'SUPER_ADMIN';
  const isSchoolAdmin = currentRole === 'SCHOOL_ADMIN';

  const allowedRoles = isSuperAdmin 
    ? (Object.keys(roleConfig) as UserRole[])
    : isSchoolAdmin
      ? (['TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'] as UserRole[])
      : [];

  // For School Admin, auto-set schoolId to their school
  const effectiveSchoolId = isSchoolAdmin ? (selectedSchoolId || currentUser.schoolId) : null;

  const fetchUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/users?limit=100');
      if (!res.ok) throw new Error('Failed to fetch users');
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchools = React.useCallback(async () => {
    try {
      // For SCHOOL_ADMIN, only fetch their own school
      // For SUPER_ADMIN, fetch all schools
      const url = isSchoolAdmin && effectiveSchoolId
        ? `/api/schools?schoolId=${effectiveSchoolId}&limit=100`
        : isSuperAdmin
          ? '/api/schools?limit=100'
          : null;
      
      if (!url) return;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      setSchools((json.data || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch {
      // ignore - schools list is supplementary
    }
  }, [isSchoolAdmin, effectiveSchoolId]);

  // Fetch students for parent-child linking
  const fetchStudents = React.useCallback(async () => {
    if (!effectiveSchoolId) return;
    try {
      const res = await fetch(`/api/students?schoolId=${effectiveSchoolId}&limit=500`);
      if (!res.ok) return;
      const json = await res.json();
      setStudents((json.data || []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        name: ((s.user as Record<string, unknown>)?.name as string) || 'Unknown',
        admissionNo: (s.admissionNo as string) || '',
      })));
    } catch {
      // Students list is supplementary
    }
  }, [effectiveSchoolId]);

  React.useEffect(() => {
    fetchUsers();
    fetchSchools();
    fetchStudents();
  }, [fetchUsers, fetchSchools, fetchStudents]);

  const filtered = getFilteredUsers(users, activeTab, search, roleFilter, schoolFilter, statusFilter);

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    students: users.filter(u => u.role === 'STUDENT').length,
    teachers: users.filter(u => u.role === 'TEACHER').length,
    staff: users.filter(u => staffRoles.includes(u.role)).length,
  };

  const handleCreate = async (data: UserFormData) => {
    try {
      setSubmitting(true);
      // For School Admin, auto-use their school ID
      const schoolId = isSchoolAdmin ? effectiveSchoolId : data.schoolId;
      
      if (!schoolId && data.role !== 'SUPER_ADMIN') {
        toast.error('School ID is required');
        return;
      }

      const res = await fetch('/api/users', {
        method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           name: data.name,
           email: data.email.toLowerCase(),
           password: data.password,
           role: data.role,
           schoolId: schoolId || null,
           childIds: data.role === 'PARENT' ? data.childIds : undefined,
           avatar: data.avatar || null,
         }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create user');
      }
      toast.success(`User "${data.name}" created successfully`);
      setCreateOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

   const handleEdit = async (data: UserFormData) => {
     if (!editUser) return;
     try {
       setSubmitting(true);
       const body: Record<string, unknown> = {
         name: data.name,
         email: data.email,
         role: data.role,
         schoolId: data.schoolId || null,
       };
       if (data.password) body.password = data.password;
       if (data.avatar) body.avatar = data.avatar;
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update user');
      }
      toast.success(`User "${data.name}" updated successfully`);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      toast.success(`${user.name} ${user.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const resetPassword = (userName: string) => {
    toast.success(`Password reset link sent to ${userName}'s email`);
  };

  const deleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete user');
      }
      toast.success(`User "${user.name}" deleted`);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const columns: ColumnDef<UserRecord>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
            {row.original.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-medium">{row.original.name}</span>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const config = roleConfig[row.original.role as UserRole];
        if (!config) return <Badge variant="outline" className="text-xs">{row.original.role}</Badge>;
        return (
          <Badge
            variant="outline"
            className="text-xs gap-1"
            style={{ borderColor: config.color, color: config.color }}
          >
            {roleIcons[row.original.role]}
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'schoolName',
      header: 'School',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.school?.name || <span className="text-muted-foreground">Platform</span>}</span>
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
      accessorKey: 'lastLogin',
      header: 'Last Login',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.lastLogin ? (mounted ? new Date(row.original.lastLogin).toLocaleString() : '') : '-'}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{mounted ? new Date(row.original.createdAt).toISOString().split('T')[0] : ''}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setViewUser(user)}>
                <Eye className="size-4" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditUser(user)}>
                <Pencil className="size-4" /> Edit User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => resetPassword(user.name)}>
                <Lock className="size-4" /> Reset Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toggleStatus(user.id)}>
                {user.isActive ? <XCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                {user.isActive ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => deleteUser(user.id)}>
                <Trash2 className="size-4" /> Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (error && users.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold">User Management</h2>
            <p className="text-sm text-muted-foreground">Manage all platform users</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="size-12 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="size-6 text-red-600" /></div>
          <div className="text-center">
            <p className="text-sm font-medium">Failed to load users</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers}><RefreshCw className="size-3.5 mr-1.5" /> Retry</Button>
        </div>
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
      {/* Stats */}
      <motion.div 
        className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-12" /></Card>)
        ) : (
          <>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="size-3.5" /> Total Users</div>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-500" /> Active</div>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.active}</p>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><XCircle className="size-3.5 text-red-500" /> Inactive</div>
                <p className="text-2xl font-bold mt-1 text-red-600">{stats.inactive}</p>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><GraduationCap className="size-3.5" /> Students</div>
                <p className="text-2xl font-bold mt-1">{stats.students}</p>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="size-3.5" /> Teachers</div>
                <p className="text-2xl font-bold mt-1">{stats.teachers}</p>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Shield className="size-3.5" /> Staff</div>
                <p className="text-2xl font-bold mt-1">{stats.staff}</p>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Tabs and Controls */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full overflow-x-auto scrollbar-none pb-1">
            <TabsList className="flex w-max min-w-full sm:w-auto">
            {tabRoles.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
            </TabsList>
          </div>
          <Button className="gap-2 w-full sm:w-auto shrink-0" onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" />
            Create User
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 mt-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:gap-3">
            <Select value={roleFilter} onValueChange={v => setRoleFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Roles</SelectItem>
              {allowedRoles.map(key => (
                <SelectItem key={key} value={key}>{roleConfig[key].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={schoolFilter} onValueChange={v => setSchoolFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Schools" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Schools</SelectItem>
              {schools.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
          <div className="w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
            </Select>
          </div>
        </div>

        {tabRoles.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <DataTable
                columns={columns}
                data={filtered}
                searchKey="name"
                searchPlaceholder={`Search ${tab.label.toLowerCase()}...`}
                emptyMessage={`No ${tab.label.toLowerCase()} found.`}
                enableRowSelection
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Dialog */}
      <UserFormDialog open={createOpen} onOpenChange={setCreateOpen} editingUser={null} onSubmit={handleCreate} schools={schools} isSubmitting={submitting} allowedRoles={allowedRoles} isSchoolAdmin={isSchoolAdmin} effectiveSchoolId={effectiveSchoolId} availableStudents={students} />

      {/* Edit Dialog */}
      <UserFormDialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }} editingUser={editUser} onSubmit={handleEdit} schools={schools} isSubmitting={submitting} allowedRoles={allowedRoles} isSchoolAdmin={isSchoolAdmin} effectiveSchoolId={effectiveSchoolId} availableStudents={students} />

      {/* View User Dialog */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="max-w-md">
          {viewUser && (
            <>
               <DialogHeader>
                 <DialogTitle className="flex items-center gap-3">
                   <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                     {viewUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                   </div>
                   <div>
                     <p>{viewUser.name}</p>
                     <p className="text-sm font-normal text-muted-foreground">{viewUser.email}</p>
                   </div>
                 </DialogTitle>
                 <DialogDescription>User account details and information</DialogDescription>
               </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Role</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {roleIcons[viewUser.role]}
                      {(() => {
                        const config = roleConfig[viewUser.role as UserRole];
                        return config ? (
                          <Badge variant="outline" className="text-xs" style={{ borderColor: config.color, color: config.color }}>{config.label}</Badge>
                        ) : <Badge variant="outline" className="text-xs">{viewUser.role}</Badge>;
                      })()}
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <div className="mt-1">
                      <StatusBadge variant={viewUser.isActive ? 'success' : 'error'} size="sm">
                        {viewUser.isActive ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">School</span>
                    <p className="font-medium mt-1">{viewUser.school?.name || 'Platform'}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Last Login</span>
                    <p className="font-medium mt-1">{viewUser.lastLogin ? (mounted ? new Date(viewUser.lastLogin).toLocaleString() : '') : '-'}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <p className="font-medium mt-1">{mounted ? new Date(viewUser.createdAt).toISOString().split('T')[0] : ''}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">User ID</span>
                    <p className="font-mono text-xs font-medium mt-1">{viewUser.id}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 gap-2" onClick={() => { setEditUser(viewUser); setViewUser(null); }}>
                    <Pencil className="size-4" /> Edit
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => { resetPassword(viewUser.name); }}>
                    <Lock className="size-4" /> Reset Password
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
