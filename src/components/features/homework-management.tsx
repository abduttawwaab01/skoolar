'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/app-store';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  GraduationCap,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Star,
  AlertTriangle,
  Users,
  X,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface HomeworkItem {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  subjectId: string | null;
  classId: string | null;
  teacherId: string | null;
  dueDate: string;
  totalMarks: number;
  status: string;
  attachments: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  subject: { id: string; name: string; code: string | null } | null;
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  _count: { submissions: number };
  submissions?: HomeworkSubmission[];
}

interface HomeworkSubmission {
  id: string;
  studentId: string;
  status: string;
  score: number | null;
  grade: string | null;
  teacherComment: string | null;
  submittedAt: string;
  gradedAt: string | null;
  content?: string | null;
  student?: {
    id: string;
    admissionNo: string;
    user: { name: string; avatar: string | null };
  };
}

interface SubjectItem {
  id: string;
  name: string;
  code: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
}

// Status badge config
const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  active: { label: 'Active', variant: 'default', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  pending: { label: 'Pending', variant: 'secondary', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  submitted: { label: 'Submitted', variant: 'default', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  graded: { label: 'Graded', variant: 'default', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  overdue: { label: 'Overdue', variant: 'destructive', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  closed: { label: 'Closed', variant: 'outline', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
};

export default function HomeworkManagement() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  // Data state
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [activeTab, setActiveTab] = useState('assignments');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    subjectId: '',
    classId: '',
    dueDate: '',
    totalMarks: '100',
    attachments: '',
  });
  const [creating, setCreating] = useState(false);

  // Grade dialog state
  const [gradeOpen, setGradeOpen] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<HomeworkItem | null>(null);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState<Record<string, { score: string; comment: string; grade: string }>>({});

  // Fetch subjects and classes
  const fetchSubjectsAndClasses = useCallback(async () => {
    if (!schoolId) return;
    try {
      const [subjRes, classRes] = await Promise.all([
        fetch(`/api/subjects?schoolId=${schoolId}&limit=100`),
        fetch(`/api/classes?schoolId=${schoolId}&limit=100`),
      ]);
      if (subjRes.ok) {
        const subjData = await subjRes.json();
        setSubjects(subjData.data || []);
      }
      if (classRes.ok) {
        const classData = await classRes.json();
        setClasses(classData.data || []);
      }
    } catch {
      // Silently fail - filters just won't populate
    }
  }, [schoolId]);

  // Fetch homeworks
  const fetchHomeworks = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        schoolId,
        limit: '100',
        page: '1',
      });
      if (searchQuery) params.set('search', searchQuery);
      if (filterSubject) params.set('subjectId', filterSubject);
      if (filterClass) params.set('classId', filterClass);
      if (filterStatus) params.set('status', filterStatus);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (activeTab === 'submissions' && currentRole === 'STUDENT') {
        params.set('studentId', currentUser.id);
        params.set('includeSubmissions', 'true');
      }
      if (activeTab === 'grade') {
        params.set('includeSubmissions', 'true');
      }

      const res = await fetch(`/api/homework?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHomeworks(data.data || []);
        setTotalItems(data.total || 0);
      }
    } catch {
      toast.error('Failed to load homework data');
    } finally {
      setLoading(false);
    }
  }, [schoolId, searchQuery, filterSubject, filterClass, filterStatus, dateFrom, dateTo, activeTab, currentRole, currentUser.id]);

  useEffect(() => {
    fetchSubjectsAndClasses();
  }, [fetchSubjectsAndClasses]);

  useEffect(() => {
    fetchHomeworks();
  }, [fetchHomeworks]);

  // Compute stats
  const stats = {
    total: totalItems,
    active: homeworks.filter(h => h.status === 'active').length,
    pending: homeworks.filter(h => h.status === 'pending').length,
    submitted: homeworks.filter(h => {
      if (h.submissions && h.submissions.length > 0) {
        return h.submissions[0].status === 'submitted';
      }
      return false;
    }).length,
    graded: homeworks.filter(h => {
      if (h.submissions && h.submissions.length > 0) {
        return h.submissions[0].status === 'graded';
      }
      return h._count.submissions > 0 && h.status === 'closed';
    }).length,
    overdue: homeworks.filter(h => new Date(h.dueDate) < new Date() && h.status !== 'closed').length,
  };

  // Determine effective status for display
  const getEffectiveStatus = (hw: HomeworkItem) => {
    if (hw.submissions && hw.submissions.length > 0) {
      return hw.submissions[0].status;
    }
    if (new Date(hw.dueDate) < new Date() && hw.status !== 'closed') return 'overdue';
    return hw.status;
  };

  // Create homework handler
  const handleCreate = async () => {
    if (!createForm.title || !createForm.dueDate) {
      toast.error('Title and due date are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          title: createForm.title,
          description: createForm.description,
          subjectId: createForm.subjectId || undefined,
          classId: createForm.classId || undefined,
          dueDate: createForm.dueDate,
          totalMarks: parseInt(createForm.totalMarks) || 100,
          attachments: createForm.attachments || undefined,
          createdBy: currentUser.id,
        }),
      });
      if (res.ok) {
        toast.success('Homework assignment created successfully');
        setCreateOpen(false);
        setCreateForm({ title: '', description: '', subjectId: '', classId: '', dueDate: '', totalMarks: '100', attachments: '' });
        fetchHomeworks();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create homework');
      }
    } catch {
      toast.error('Failed to create homework');
    } finally {
      setCreating(false);
    }
  };

  // Submit homework handler
  const handleSubmitHomework = async (hw: HomeworkItem) => {
    try {
      const res = await fetch('/api/homework', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: hw.id,
          action: 'submit',
          studentId: currentUser.id,
          content: '',
        }),
      });
      if (res.ok) {
        toast.success('Homework submitted successfully');
        fetchHomeworks();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to submit');
      }
    } catch {
      toast.error('Failed to submit homework');
    }
  };

  // Open grade dialog
  const openGradeDialog = async (hw: HomeworkItem) => {
    setSelectedHomework(hw);
    setGradeOpen(true);
    setLoadingSubmissions(true);
    setGradeForm({});
    try {
      const params = new URLSearchParams({
        schoolId,
        limit: '1',
        includeSubmissions: 'true',
      });
      const res = await fetch(`/api/homework?${params}`);
      if (res.ok) {
        const data = await res.json();
        const fullHw = data.data?.find((h: HomeworkItem) => h.id === hw.id);
        if (fullHw?.submissions) {
          setSubmissions(fullHw.submissions);
          // Initialize grade form
          const initForm: Record<string, { score: string; comment: string; grade: string }> = {};
          fullHw.submissions.forEach((s: HomeworkSubmission) => {
            initForm[s.id] = {
              score: s.score?.toString() || '',
              comment: s.teacherComment || '',
              grade: s.grade || '',
            };
          });
          setGradeForm(initForm);
        } else {
          setSubmissions([]);
        }
      }
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Grade submission handler
  const handleGrade = async (submissionId: string) => {
    const formData = gradeForm[submissionId];
    if (!formData || !formData.score) {
      toast.error('Score is required');
      return;
    }
    if (!selectedHomework) return;
    setGradingSubmission(submissionId);
    try {
      const res = await fetch('/api/homework', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedHomework.id,
          action: 'grade',
          submissionId,
          score: parseFloat(formData.score),
          grade: formData.grade || undefined,
          teacherComment: formData.comment || undefined,
          status: 'graded',
        }),
      });
      if (res.ok) {
        toast.success('Submission graded successfully');
        openGradeDialog(selectedHomework);
        fetchHomeworks();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to grade');
      }
    } catch {
      toast.error('Failed to grade submission');
    } finally {
      setGradingSubmission(null);
    }
  };

  // Auto-generate letter grade from score
  const autoGrade = (score: string, totalMarks: number) => {
    const pct = (parseFloat(score) / totalMarks) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 85) return 'A';
    if (pct >= 80) return 'A-';
    if (pct >= 75) return 'B+';
    if (pct >= 70) return 'B';
    if (pct >= 65) return 'B-';
    if (pct >= 60) return 'C+';
    if (pct >= 55) return 'C';
    if (pct >= 50) return 'C-';
    if (pct >= 45) return 'D';
    return 'F';
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterSubject('');
    setFilterClass('');
    setFilterStatus('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = searchQuery || filterSubject || filterClass || filterStatus || dateFrom || dateTo;

  const isTeacher = currentRole === 'TEACHER' || currentRole === 'SCHOOL_ADMIN' || currentRole === 'SUPER_ADMIN';
  const isStudent = currentRole === 'STUDENT';
  const isParent = currentRole === 'PARENT';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <BookOpen className="h-6 w-6 text-violet-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Homework Management</h2>
            <p className="text-sm text-gray-500">Create, track, and grade homework assignments</p>
          </div>
        </div>
        {isTeacher && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Homework Assignment</DialogTitle>
                <DialogDescription>
                  Assign homework to students with details and due date.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="hw-title">Title *</Label>
                  <Input
                    id="hw-title"
                    placeholder="e.g., Chapter 5 - Algebra Practice"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hw-description">Description</Label>
                  <Textarea
                    id="hw-description"
                    placeholder="Describe the homework task, instructions, and expectations..."
                    rows={4}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Subject</Label>
                    <Select value={createForm.subjectId} onValueChange={(v) => setCreateForm({ ...createForm, subjectId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}{s.code ? ` (${s.code})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Class</Label>
                    <Select value={createForm.classId} onValueChange={(v) => setCreateForm({ ...createForm, classId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}{c.section ? ` - ${c.section}` : ''}{c.grade ? ` (${c.grade})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="hw-due">Due Date *</Label>
                    <Input
                      id="hw-due"
                      type="datetime-local"
                      value={createForm.dueDate}
                      onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="hw-marks">Total Marks</Label>
                    <Input
                      id="hw-marks"
                      type="number"
                      value={createForm.totalMarks}
                      onChange={(e) => setCreateForm({ ...createForm, totalMarks: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hw-attachments">Attachments (URLs, comma-separated)</Label>
                  <Input
                    id="hw-attachments"
                    placeholder="https://example.com/file.pdf, https://example.com/doc.docx"
                    value={createForm.attachments}
                    onChange={(e) => setCreateForm({ ...createForm, attachments: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !createForm.title || !createForm.dueDate} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Assignment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <BookOpen className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active + stats.pending}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Send className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.submitted}</p>
              <p className="text-xs text-gray-500">Submitted</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.graded}</p>
              <p className="text-xs text-gray-500">Graded</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overdue}</p>
              <p className="text-xs text-gray-500">Overdue</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100">
              <GraduationCap className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {homeworks.reduce((acc, h) => acc + h._count.submissions, 0)}
              </p>
              <p className="text-xs text-gray-500">Submissions</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="assignments" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          {isStudent && (
            <TabsTrigger value="submissions" className="gap-2">
              <Send className="h-4 w-4" />
              My Submissions
            </TabsTrigger>
          )}
          {isTeacher && (
            <TabsTrigger value="grade" className="gap-2">
              <Star className="h-4 w-4" />
              Grade
            </TabsTrigger>
          )}
          {isParent && (
            <TabsTrigger value="submissions" className="gap-2">
              <Users className="h-4 w-4" />
              Child&apos;s Status
            </TabsTrigger>
          )}
        </TabsList>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search assignments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={filterSubject} onValueChange={(v) => setFilterSubject(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="All Subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Subjects</SelectItem>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterClass} onValueChange={(v) => setFilterClass(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Classes</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[140px]"
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[140px]"
                    placeholder="To"
                  />
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                      <X className="h-3 w-3" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Homework List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
            </div>
          ) : homeworks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-gray-100 mb-4">
                  <BookOpen className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-1">No Assignments Found</h3>
                <p className="text-sm text-gray-500">
                  {hasActiveFilters ? 'Try adjusting your filters' : 'No homework assignments have been created yet'}
                </p>
                {isTeacher && !hasActiveFilters && (
                  <Button className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Create First Assignment
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {homeworks.map((hw) => {
                const effectiveStatus = getEffectiveStatus(hw);
                const statusCfg = statusConfig[effectiveStatus] || statusConfig.active;
                const isOverdue = new Date(hw.dueDate) < new Date() && hw.status !== 'closed';
                const canSubmit = isStudent && hw.submissions && hw.submissions.length === 0 && !isOverdue;

                return (
                  <Card key={hw.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <h3 className="font-semibold text-gray-900 text-base">{hw.title}</h3>
                            <Badge className={statusCfg.className} variant={statusCfg.variant}>
                              {statusCfg.label}
                            </Badge>
                            {isOverdue && effectiveStatus !== 'overdue' && (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100" variant="destructive">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 line-clamp-2">{hw.description}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            {hw.subject && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                {hw.subject.name}
                              </span>
                            )}
                            {hw.class && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {hw.class.name}{hw.class.section ? ` - ${hw.class.section}` : ''}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {new Date(hw.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {isOverdue && <span className="text-red-500 font-medium"> (Overdue)</span>}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {hw.totalMarks} marks
                            </span>
                            <span className="flex items-center gap-1">
                              <Send className="h-3 w-3" />
                              {hw._count.submissions} submitted
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Created: {new Date(hw.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {hw.submissions && hw.submissions.length > 0 && hw.submissions[0].score !== null && (
                            <div className="flex items-center gap-2 mt-1 p-2 rounded-lg bg-emerald-50 w-fit">
                              <Star className="h-4 w-4 text-emerald-600" />
                              <span className="text-sm font-semibold text-emerald-700">
                                Score: {hw.submissions[0].score}/{hw.totalMarks}
                              </span>
                              {hw.submissions[0].grade && (
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-700">
                                  {hw.submissions[0].grade}
                                </Badge>
                              )}
                            </div>
                          )}
                          {hw.submissions && hw.submissions.length > 0 && hw.submissions[0].teacherComment && (
                            <div className="flex items-start gap-2 mt-1 p-2 rounded-lg bg-blue-50 w-fit">
                              <MessageSquare className="h-4 w-4 text-blue-600 mt-0.5" />
                              <span className="text-sm text-blue-700">{hw.submissions[0].teacherComment}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {canSubmit && (
                            <Button size="sm" className="gap-1" onClick={() => handleSubmitHomework(hw)}>
                              <Send className="h-3 w-3" />
                              Submit
                            </Button>
                          )}
                          {isTeacher && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openGradeDialog(hw)}
                            >
                              <Star className="h-3 w-3" />
                              {hw._count.submissions > 0 ? 'Grade' : 'View'}
                            </Button>
                          )}
                          {hw.attachments && (
                            <Button size="sm" variant="ghost" className="gap-1">
                              <Paperclip className="h-3 w-3" />
                              Files
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* My Submissions / Child Status Tab */}
        {(isStudent || isParent) && (
          <TabsContent value="submissions" className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
              </div>
            ) : homeworks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-gray-100 mb-4">
                    <Send className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No Submissions</h3>
                  <p className="text-sm text-gray-500">No homework submissions found</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {homeworks.map((hw) => {
                        const effectiveStatus = getEffectiveStatus(hw);
                        const statusCfg = statusConfig[effectiveStatus] || statusConfig.pending;
                        const submission = hw.submissions?.[0];
                        const isOverdue = new Date(hw.dueDate) < new Date() && !submission;

                        return (
                          <TableRow key={hw.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{hw.title}</TableCell>
                            <TableCell>{hw.subject?.name || '-'}</TableCell>
                            <TableCell>
                              {hw.class?.name || '-'}
                              {hw.class?.section ? ` - ${hw.class.section}` : ''}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                  {new Date(hw.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusCfg.className} variant={statusCfg.variant}>
                                {statusCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {submission?.score !== null && submission?.score !== undefined ? (
                                <span className="font-semibold">
                                  {submission.score}/{hw.totalMarks}
                                  {submission.grade && (
                                    <Badge variant="outline" className="ml-1 text-xs">
                                      {submission.grade}
                                    </Badge>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {submission ? (
                                <span className="text-sm text-gray-600">
                                  {new Date(submission.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Grade Tab (Teacher only) */}
        {isTeacher && (
          <TabsContent value="grade" className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
              </div>
            ) : homeworks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-gray-100 mb-4">
                    <Star className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No Assignments to Grade</h3>
                  <p className="text-sm text-gray-500">Homework assignments will appear here for grading</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Assignments Pending Review</CardTitle>
                  <CardDescription>
                    Select an assignment to view and grade submissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Submissions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {homeworks.map((hw) => {
                        const isOverdue = new Date(hw.dueDate) < new Date() && hw.status !== 'closed';
                        return (
                          <TableRow key={hw.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{hw.title}</TableCell>
                            <TableCell>{hw.subject?.name || '-'}</TableCell>
                            <TableCell>
                              {hw.class?.name || 'All'}
                              {hw.class?.section ? ` - ${hw.class.section}` : ''}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                  {new Date(hw.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {hw._count.submissions} / {hw.class ? '?' : '-'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={hw.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-100'}>
                                {hw.status === 'active' ? 'Active' : 'Closed'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={hw._count.submissions > 0 ? 'default' : 'outline'}
                                className="gap-1"
                                onClick={() => openGradeDialog(hw)}
                                disabled={hw._count.submissions === 0}
                              >
                                <Star className="h-3 w-3" />
                                {hw._count.submissions > 0 ? `Grade (${hw._count.submissions})` : 'No Submissions'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Grade Submission Dialog */}
      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-violet-600" />
              Grade Submissions
            </DialogTitle>
            <DialogDescription>
              {selectedHomework?.title} — {selectedHomework?.subject?.name || 'No Subject'} — {selectedHomework?.totalMarks} marks
            </DialogDescription>
          </DialogHeader>

          {loadingSubmissions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-violet-600 animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Send className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No submissions yet for this assignment</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-4">
                {submissions.map((sub) => {
                  const formData = gradeForm[sub.id] || { score: '', comment: '', grade: '' };
                  const isGraded = sub.status === 'graded';

                  return (
                    <Card key={sub.id} className={`p-4 ${isGraded ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-sm font-semibold text-violet-700">
                                {sub.student?.user?.name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{sub.student?.user?.name || 'Unknown Student'}</p>
                                <p className="text-xs text-gray-500">{sub.student?.admissionNo || ''}</p>
                              </div>
                            </div>
                            <Badge className={isGraded ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
                              {isGraded ? 'Graded' : 'Pending'}
                            </Badge>
                          </div>

                          {sub.content && (
                            <p className="text-sm text-gray-600 bg-white rounded-lg p-2 border">
                              {sub.content}
                            </p>
                          )}

                          <p className="text-xs text-gray-400">
                            Submitted: {new Date(sub.submittedAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>

                          <Separator />

                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Score (/{selectedHomework?.totalMarks})</Label>
                              <Input
                                type="number"
                                min="0"
                                max={selectedHomework?.totalMarks || 100}
                                placeholder="0"
                                value={formData.score}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGradeForm(prev => ({
                                    ...prev,
                                    [sub.id]: {
                                      ...formData,
                                      score: val,
                                      grade: val ? autoGrade(val, selectedHomework?.totalMarks || 100) : '',
                                    },
                                  }));
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Grade</Label>
                              <Input
                                placeholder="Auto"
                                value={formData.grade}
                                onChange={(e) => setGradeForm(prev => ({
                                  ...prev,
                                  [sub.id]: { ...formData, grade: e.target.value },
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Comment</Label>
                              <Input
                                placeholder="Feedback..."
                                value={formData.comment}
                                onChange={(e) => setGradeForm(prev => ({
                                  ...prev,
                                  [sub.id]: { ...formData, comment: e.target.value },
                                }))}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => handleGrade(sub.id)}
                              disabled={gradingSubmission === sub.id || !formData.score}
                            >
                              {gradingSubmission === sub.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {isGraded ? 'Update Grade' : 'Submit Grade'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
