'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, AlertCircle, Loader2, Copy, Eye, Trash2, ClipboardCheck,
  CheckCircle2, Users, FileQuestion, Shield, Link2, Briefcase,
  Timer, ToggleLeft, ArrowUpDown, RefreshCw, Pencil, MapPin,
  Building2, DollarSign, Globe, UserCheck, X
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { motion } from 'framer-motion';
import { useConfirm } from '@/components/confirm-dialog';

interface JobPostingRecord {
  id: string;
  title: string;
  department: string | null;
  description: string;
  requirements: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  location: string | null;
  type: string;
  experience: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  isRemote: boolean;
  isActive: boolean;
  expiresAt: string | null;
  code: string;
  createdAt: string;
  _count: { applications: number };
}

interface JobApplicationRecord {
  id: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  applicantAddress: string | null;
  resumeUrl: string | null;
  coverLetter: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  yearsExperience: number | null;
  status: string;
  interviewScore: number | null;
  finalScore: number | null;
  aiSuggestion: string | null;
  notes: string | null;
  interviewDate: string | null;
  interviewNotes: string | null;
  offeredSalary: number | null;
  rejectedAt: string | null;
  hiredAt: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#6b7280' },
  reviewed: { label: 'Reviewed', color: '#3b82f6' },
  interview_scheduled: { label: 'Interview Scheduled', color: '#8b5cf6' },
  interviewed: { label: 'Interviewed', color: '#f59e0b' },
  offered: { label: 'Offered', color: '#10b981' },
  hired: { label: 'Hired', color: '#059448' },
  rejected: { label: 'Rejected', color: '#dc2626' },
  withdrawn: { label: 'Withdrawn', color: '#6b7280' },
};

const jobTypeOptions = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
];

const experienceOptions = [
  { value: 'none', label: 'No Experience Required' },
  { value: '1-2', label: '1-2 Years' },
  { value: '3-5', label: '3-5 Years' },
  { value: '5-10', label: '5-10 Years' },
  { value: '10+', label: '10+ Years' },
];

function generateColumns(
  onEdit: (job: JobPostingRecord) => void,
  onDelete: (job: JobPostingRecord) => void,
  onViewApplications: (job: JobPostingRecord) => void
): ColumnDef<JobPostingRecord>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4 h-8 data-[state=open]:bg-accent"
        >
          Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.title}</span>
          {row.original.department && (
            <span className="text-xs text-muted-foreground">{row.original.department}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.type.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {row.original.location || 'Not specified'}
          {row.original.isRemote && (
            <Badge variant="secondary" className="ml-1 text-xs">Remote</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'salaryMin',
      header: 'Salary Range',
      cell: ({ row }) => {
        const { salaryMin, salaryMax, salaryCurrency } = row.original;
        if (!salaryMin && !salaryMax) return <span className="text-muted-foreground">Not disclosed</span>;
        const currency = salaryCurrency || '$';
        return <span>{currency}{salaryMin || '?'} - {currency}{salaryMax || '?'}</span>;
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: '_count.applications',
      header: 'Applications',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          className="h-8 px-2 font-medium"
          onClick={() => onViewApplications(row.original)}
        >
          <Users className="mr-1 h-4 w-4" />
          {row.original._count.applications}
        </Button>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}

interface JobFormData {
  title: string;
  department: string;
  description: string;
  requirements: string;
  responsibilities: string;
  qualifications: string;
  location: string;
  type: string;
  experience: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  isRemote: boolean;
  expiresAt: string;
}

const defaultJobFormData: JobFormData = {
  title: '',
  department: '',
  description: '',
  requirements: '',
  responsibilities: '',
  qualifications: '',
  location: '',
  type: 'full_time',
  experience: '',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'USD',
  isRemote: false,
  expiresAt: '',
};

function JobFormDialog({
  open,
  onOpenChange,
  editingJob,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingJob: JobPostingRecord | null;
  onSubmit: (data: JobFormData) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = React.useState<JobFormData>(defaultJobFormData);
  const isEdit = !!editingJob;

  React.useEffect(() => {
    if (editingJob) {
      setForm({
        title: editingJob.title,
        department: editingJob.department || '',
        description: editingJob.description || '',
        requirements: editingJob.requirements || '',
        responsibilities: editingJob.responsibilities || '',
        qualifications: editingJob.qualifications || '',
        location: editingJob.location || '',
        type: editingJob.type || 'full_time',
        experience: editingJob.experience || '',
        salaryMin: editingJob.salaryMin?.toString() || '',
        salaryMax: editingJob.salaryMax?.toString() || '',
        salaryCurrency: editingJob.salaryCurrency || 'USD',
        isRemote: editingJob.isRemote,
        expiresAt: editingJob.expiresAt ? editingJob.expiresAt.split('T')[0] : '',
      });
    } else {
      setForm(defaultJobFormData);
    }
  }, [editingJob, open]);

  const update = (field: keyof JobFormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.title || !form.description) {
      toast.error('Please fill in title and description');
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="size-5" /> : <Plus className="size-5" />}
            {isEdit ? 'Edit Job Posting' : 'Create New Job Posting'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update job details below.' : 'Fill in the details to create a new job posting.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Job Title *</Label>
                <Input
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  placeholder="e.g., Mathematics Teacher"
                />
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={e => update('department', e.target.value)}
                  placeholder="e.g., Science Department"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Job Description *</Label>
              <Textarea
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="Describe the role and responsibilities..."
                className="min-h-[100px]"
              />
            </div>

            <div className="grid gap-2">
              <Label>Requirements</Label>
              <Textarea
                value={form.requirements}
                onChange={e => update('requirements', e.target.value)}
                placeholder="List key requirements..."
                className="min-h-[80px]"
              />
            </div>

            <div className="grid gap-2">
              <Label>Responsibilities</Label>
              <Textarea
                value={form.responsibilities}
                onChange={e => update('responsibilities', e.target.value)}
                placeholder="List key responsibilities..."
                className="min-h-[80px]"
              />
            </div>

            <div className="grid gap-2">
              <Label>Qualifications</Label>
              <Textarea
                value={form.qualifications}
                onChange={e => update('qualifications', e.target.value)}
                placeholder="Required qualifications..."
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={e => update('location', e.target.value)}
                  placeholder="e.g., Nairobi, Kenya"
                />
              </div>
              <div className="grid gap-2">
                <Label>Job Type</Label>
                <Select value={form.type} onValueChange={v => update('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {jobTypeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Experience Required</Label>
                <Select value={form.experience} onValueChange={v => update('experience', v)}>
                  <SelectTrigger><SelectValue placeholder="Select experience" /></SelectTrigger>
                  <SelectContent>
                    {experienceOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Expires At</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={e => update('expiresAt', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Min Salary</Label>
                <Input
                  type="number"
                  value={form.salaryMin}
                  onChange={e => update('salaryMin', e.target.value)}
                  placeholder="e.g., 30000"
                />
              </div>
              <div className="grid gap-2">
                <Label>Max Salary</Label>
                <Input
                  type="number"
                  value={form.salaryMax}
                  onChange={e => update('salaryMax', e.target.value)}
                  placeholder="e.g., 50000"
                />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select value={form.salaryCurrency} onValueChange={v => update('salaryCurrency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="KES">KES</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.isRemote}
                onCheckedChange={v => update('isRemote', v)}
              />
              <Label>Remote Position</Label>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationReviewDialog({
  open,
  onOpenChange,
  application,
  onUpdate,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: JobApplicationRecord | null;
  onUpdate: (data: { status: string; interviewScore?: number; notes?: string }) => void;
  isSubmitting: boolean;
}) {
  const [status, setStatus] = React.useState('');
  const [interviewScore, setInterviewScore] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (application) {
      setStatus(application.status);
      setInterviewScore(application.interviewScore?.toString() || '');
      setNotes(application.notes || '');
    }
  }, [application]);

  const handleSubmit = () => {
    onUpdate({
      status,
      interviewScore: interviewScore ? parseInt(interviewScore) : undefined,
      notes: notes || undefined,
    });
  };

  if (!application) return null;

  const config = statusConfig[application.status] || { label: application.status, color: '#6b7280' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="size-5" />
            Application Review
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] pr-2">
          <div className="grid gap-4 py-4">
            <div className="rounded-lg border p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Applicant Name</Label>
                  <p className="font-medium">{application.applicantName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{application.applicantEmail}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{application.applicantPhone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Years Experience</Label>
                  <p className="font-medium">{application.yearsExperience || 'N/A'}</p>
                </div>
              </div>
              {application.resumeUrl && (
                <div className="mt-4">
                  <Label className="text-muted-foreground">Resume</Label>
                  <a
                    href={application.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline block"
                  >
                    View Resume
                  </a>
                </div>
              )}
              {application.coverLetter && (
                <div className="mt-4">
                  <Label className="text-muted-foreground">Cover Letter</Label>
                  <p className="text-sm mt-1">{application.coverLetter}</p>
                </div>
              )}
              {application.linkedinUrl && (
                <div className="mt-4">
                  <Label className="text-muted-foreground">LinkedIn</Label>
                  <a
                    href={application.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline block"
                  >
                    View Profile
                  </a>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([value, cfg]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: cfg.color }}
                        />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Interview Score (0-100)</Label>
              <Input
                type="number"
                value={interviewScore}
                onChange={e => setInterviewScore(e.target.value)}
                placeholder="e.g., 85"
              />
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add evaluation notes..."
                className="min-h-[100px]"
              />
            </div>

            {application.aiSuggestion && (
              <div className="rounded-lg bg-muted p-4">
                <Label className="text-muted-foreground">AI Recommendation</Label>
                <p className="text-sm mt-1">{application.aiSuggestion}</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JobPostingsManagement() {
  const { currentRole, selectedSchoolId } = useAppStore();
  const [jobs, setJobs] = React.useState<JobPostingRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editJob, setEditJob] = React.useState<JobPostingRecord | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<JobPostingRecord | null>(null);
  const [applications, setApplications] = React.useState<JobApplicationRecord[]>([]);
  const [applicationsLoading, setApplicationsLoading] = React.useState(false);
  const [reviewApplication, setReviewApplication] = React.useState<JobApplicationRecord | null>(null);

  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'SCHOOL_ADMIN' || currentRole === 'DIRECTOR';

  const confirmDelete = useConfirm();

  const fetchJobs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      params.set('limit', '100');
      const res = await fetch(`/api/job-postings?${params}`);
      if (!res.ok) throw new Error('Failed to fetch job postings');
      const data = await res.json();
      setJobs(data.data);
    } catch (err) {
      handleSilentError(err);
      setError('Failed to load job postings');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  React.useEffect(() => {
    if (isAdmin && selectedSchoolId) {
      fetchJobs();
    }
  }, [isAdmin, selectedSchoolId, fetchJobs]);

  const handleCreate = async (form: JobFormData) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/job-postings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          schoolId: selectedSchoolId,
          salaryMin: form.salaryMin ? parseInt(form.salaryMin) : null,
          salaryMax: form.salaryMax ? parseInt(form.salaryMax) : null,
          expiresAt: form.expiresAt || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      toast.success('Job posting created successfully');
      setCreateOpen(false);
      fetchJobs();
    } catch (err) {
      handleSilentError(err);
      toast.error('Failed to create job posting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (form: JobFormData) => {
    if (!editJob) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/job-postings/${editJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          salaryMin: form.salaryMin ? parseInt(form.salaryMin) : null,
          salaryMax: form.salaryMax ? parseInt(form.salaryMax) : null,
          expiresAt: form.expiresAt || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Job posting updated successfully');
      setEditJob(null);
      fetchJobs();
    } catch (err) {
      handleSilentError(err);
      toast.error('Failed to update job posting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (job: JobPostingRecord) => {
    const confirmed = await confirmDelete('Delete Job Posting', 'Are you sure you want to delete this job posting? This action cannot be undone.');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/job-postings/${job.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Job posting deleted');
      fetchJobs();
    } catch (err) {
      handleSilentError(err);
      toast.error('Failed to delete job posting');
    }
  };

  const handleViewApplications = async (job: JobPostingRecord) => {
    setSelectedJob(job);
    setApplicationsLoading(true);
    try {
      const res = await fetch(`/api/job-postings/${job.id}/applications`);
      if (!res.ok) throw new Error('Failed to fetch applications');
      const data = await res.json();
      setApplications(data.data);
    } catch (err) {
      handleSilentError(err);
      toast.error('Failed to load applications');
    } finally {
      setApplicationsLoading(false);
    }
  };

  const handleUpdateApplication = async (data: { status: string; interviewScore?: number; notes?: string }) => {
    if (!reviewApplication || !selectedJob) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/job-postings/${selectedJob.id}/applications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: reviewApplication.id,
          ...data,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Application updated');
      setReviewApplication(null);
      handleViewApplications(selectedJob);
    } catch (err) {
      handleSilentError(err);
      toast.error('Failed to update application');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You do not have permission to view this page.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const applicationColumns: ColumnDef<JobApplicationRecord>[] = [
    { accessorKey: 'applicantName', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.applicantName}</span> },
    { accessorKey: 'applicantEmail', header: 'Email' },
    { accessorKey: 'applicantPhone', header: 'Phone', cell: ({ row }) => row.original.applicantPhone || '-' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const config = statusConfig[row.original.status] || { label: row.original.status, color: '#6b7280' };
        return (
          <Badge style={{ backgroundColor: config.color + '20', color: config.color }}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'finalScore',
      header: 'Score',
      cell: ({ row }) => row.original.finalScore ? `${row.original.finalScore}%` : '-',
    },
    {
      accessorKey: 'createdAt',
      header: 'Applied',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" onClick={() => setReviewApplication(row.original)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Job Postings
          </h1>
          <p className="text-muted-foreground">Manage job openings and track applications</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Job
            </Button>
          </DialogTrigger>
          <JobFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            editingJob={null}
            onSubmit={handleCreate}
            isSubmitting={submitting}
          />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Search jobs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Types</SelectItem>
                {jobTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchJobs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No job postings found. Create one to get started.
            </div>
          ) : (
            <DataTable
              columns={generateColumns(setEditJob, handleDelete, handleViewApplications)}
              data={jobs}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editJob} onOpenChange={open => { if (!open) setEditJob(null); }}>
        <JobFormDialog
          open={!!editJob}
          onOpenChange={open => { if (!open) setEditJob(null); }}
          editingJob={editJob}
          onSubmit={handleEdit}
          isSubmitting={submitting}
        />
      </Dialog>

      <Dialog open={!!selectedJob} onOpenChange={open => { if (!open) setSelectedJob(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Applications - {selectedJob?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedJob?._count.applications || 0} application(s)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-2">
            {applicationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No applications yet.
              </div>
            ) : (
              <DataTable columns={applicationColumns} data={applications} />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewApplication} onOpenChange={open => { if (!open) setReviewApplication(null); }}>
        <ApplicationReviewDialog
          open={!!reviewApplication}
          onOpenChange={open => { if (!open) setReviewApplication(null); }}
          application={reviewApplication}
          onUpdate={handleUpdateApplication}
          isSubmitting={submitting}
        />
      </Dialog>
    </div>
  );
}