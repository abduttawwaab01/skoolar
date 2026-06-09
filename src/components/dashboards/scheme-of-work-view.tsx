'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  BookOpen, Plus, FileText, ChevronLeft, ChevronDown, ChevronUp, ChevronRight,
  Calendar, Monitor, CheckCircle2, Clock, AlertCircle,
  Download, Eye, Pencil, Trash2, Sparkles, GraduationCap,
  BookText, ListChecks, Target, Activity, Wrench, BookCheck, ClipboardList,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ClassRecord {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
}

interface SubjectRecord {
  id: string;
  name: string;
  code: string | null;
}

interface TermRecord {
  id: string;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
}

interface AcademicYearRecord {
  id: string;
  name: string;
}

interface SchemeEntry {
  id?: string;
  weekNumber: number;
  topic: string;
  subTopic: string;
  learningObjectives: string;
  teachingActivities: string;
  learningActivities: string;
  resources: string;
  assessmentMethod: string;
  duration: number | null;
  status: string;
  completedAt: string | null;
  _count?: { timetableSlots: number };
}

interface SchemeSummary {
  id: string;
  title: string | null;
  description: string | null;
  isPublished: boolean;
  createdBy: string;
  class: { id: string; name: string; section: string | null };
  subject: { id: string; name: string; code: string | null };
  term: { id: string; name: string; order: number };
  academicYear: { id: string; name: string };
  _count: { entries: number };
}

interface SchemeDetail {
  id: string;
  title: string | null;
  description: string | null;
  isPublished: boolean;
  class: { id: string; name: string; section: string | null; grade: string | null };
  subject: { id: string; name: string; code: string | null; type: string };
  term: { id: string; name: string; order: number; startDate: string; endDate: string };
  academicYear: { id: string; name: string };
  entries: SchemeEntry[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  in_progress: <Activity className="h-3.5 w-3.5" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5" />,
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><Skeleton className="h-7 w-40 mb-2" /><Skeleton className="h-4 w-60" /></div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-5">
        <BookText className="h-10 w-10 text-purple-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No Scheme of Work Yet</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Create a scheme of work to outline topics, objectives, and activities for each week of the term.
      </p>
      <Button onClick={onCreate} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
        <Plus className="h-4 w-4" /> Create Scheme of Work
      </Button>
    </div>
  );
}

export function SchemeOfWorkView() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser?.schoolId;

  const [schemes, setSchemes] = useState<SchemeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScheme, setSelectedScheme] = useState<SchemeDetail | null>(null);
  const [schemeLoading, setSchemeLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  // Reference data
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);

  // Create form
  const [formData, setFormData] = useState({
    classId: '',
    subjectId: '',
    termId: '',
    academicYearId: '',
    title: '',
    description: '',
  });

  const fetchReferenceData = useCallback(async () => {
    if (!schoolId) return;
    try {
      const [classesRes, subjectsRes, termsRes, yearsRes] = await Promise.all([
        fetch(`/api/classes?schoolId=${schoolId}&limit=100`),
        fetch(`/api/subjects?schoolId=${schoolId}&limit=100`),
        fetch(`/api/terms?schoolId=${schoolId}`),
        fetch(`/api/academic-years?schoolId=${schoolId}&limit=10`),
      ]);
      const classesJson = await classesRes.json();
      const subjectsJson = await subjectsRes.json();
      const termsJson = await termsRes.json();
      const yearsJson = await yearsRes.json();

      if (classesJson.data) setClasses(classesJson.data);
      if (subjectsJson.data) setSubjects(subjectsJson.data);
      if (termsJson.data) setTerms(termsJson.data);
      if (yearsJson.data) setAcademicYears(yearsJson.data);
    } catch { /* silent */ }
  }, [schoolId]);

  const fetchSchemes = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ schoolId, limit: '50' });
      if (classFilter) params.set('classId', classFilter);
      if (subjectFilter) params.set('subjectId', subjectFilter);
      const res = await fetch(`/api/scheme-of-work?${params}`);
      const json = await res.json();
      if (json.data) setSchemes(json.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [schoolId, classFilter, subjectFilter]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  const fetchSchemeDetail = async (id: string) => {
    setSchemeLoading(true);
    try {
      const res = await fetch(`/api/scheme-of-work/${id}`);
      const json = await res.json();
      if (json.data) setSelectedScheme(json.data);
    } catch { toast.error('Failed to load scheme'); }
    finally { setSchemeLoading(false); }
  };

  const handleCreate = async () => {
    if (!schoolId || !formData.classId || !formData.subjectId || !formData.termId || !formData.academicYearId) {
      toast.error('Please fill all required fields');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/scheme-of-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, schoolId }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Scheme of work created!');
        setCreateOpen(false);
        setFormData({ classId: '', subjectId: '', termId: '', academicYearId: '', title: '', description: '' });
        fetchSchemes();
        fetchSchemeDetail(json.data.id);
      } else {
        toast.error(json.error || 'Failed to create');
      }
    } catch { toast.error('Failed to create scheme'); }
    finally { setCreating(false); }
  };

  const handleSaveEntries = async () => {
    if (!selectedScheme) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/scheme-of-work/${selectedScheme.id}/entries`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: selectedScheme.entries }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Entries saved!');
        fetchSchemeDetail(selectedScheme.id);
      } else {
        toast.error(json.error || 'Failed to save');
      }
    } catch { toast.error('Failed to save entries'); }
    finally { setSaving(false); }
  };

  const updateEntry = (weekNumber: number, field: string, value: string | number | null) => {
    if (!selectedScheme) return;
    setSelectedScheme({
      ...selectedScheme,
      entries: selectedScheme.entries.map(e =>
        e.weekNumber === weekNumber ? { ...e, [field]: value } : e
      ),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scheme of work? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/scheme-of-work/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Scheme deleted');
        if (selectedScheme?.id === id) setSelectedScheme(null);
        fetchSchemes();
      }
    } catch { toast.error('Failed to delete'); }
  };

  const handlePublish = async (id: string, isPublished: boolean) => {
    try {
      const res = await fetch(`/api/scheme-of-work/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished }),
      });
      if (res.ok) {
        toast.success(isPublished ? 'Scheme published' : 'Scheme unpublished');
        fetchSchemes();
        if (selectedScheme?.id === id) setSelectedScheme({ ...selectedScheme, isPublished });
      }
    } catch { toast.error('Failed to update'); }
  };

  // View: scheme detail/edit
  if (selectedScheme) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedScheme(null)} className="gap-1.5 text-gray-500">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {selectedScheme.subject.name}
                {selectedScheme.subject.code ? ` (${selectedScheme.subject.code})` : ''}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedScheme.class.name}{selectedScheme.class.section ? ` - ${selectedScheme.class.section}` : ''}
                {' '}&middot; {selectedScheme.term.name} &middot; {selectedScheme.academicYear.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/scheme-of-work/${selectedScheme.id}/export`, '_blank')} className="gap-1.5">
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const w = window.open(`/api/scheme-of-work/${selectedScheme.id}/export`, '_blank'); setTimeout(() => w?.print(), 1000); }} className="gap-1.5">
              <Download className="h-4 w-4" /> Print
            </Button>
            <Button
              variant={selectedScheme.isPublished ? 'outline' : 'default'}
              size="sm"
              onClick={() => handlePublish(selectedScheme.id, !selectedScheme.isPublished)}
              className="gap-1.5"
            >
              {selectedScheme.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        </div>

        {schemeLoading ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-6">
            {/* Description */}
            {selectedScheme.description && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                <p className="text-sm text-gray-700">{selectedScheme.description}</p>
              </div>
            )}

            {/* Week Entries */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-purple-500" />
                  Weekly Breakdown ({selectedScheme.entries.length} weeks)
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-500" /> {selectedScheme.entries.filter(e => e.status === 'pending').length} Pending</span>
                  <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-blue-500" /> {selectedScheme.entries.filter(e => e.status === 'in_progress').length} In Progress</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {selectedScheme.entries.filter(e => e.status === 'completed').length} Completed</span>
                </div>
              </div>

              {selectedScheme.entries.map((entry) => (
                <motion.div
                  key={entry.weekNumber}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                        {entry.weekNumber}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {entry.topic || <span className="text-gray-400 italic">Week {entry.weekNumber}</span>}
                        </div>
                        {entry.subTopic && <div className="text-xs text-gray-500">{entry.subTopic}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={entry.status}
                        onValueChange={(v) => updateEntry(entry.weekNumber, 'status', v)}
                      >
                        <SelectTrigger className={`h-7 text-xs gap-1 w-full sm:w-32 ${statusColors[entry.status] || 'bg-gray-100'}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Pending</span>
                          </SelectItem>
                          <SelectItem value="in_progress">
                            <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> In Progress</span>
                          </SelectItem>
                          <SelectItem value="completed">
                            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Completed</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                          <BookOpen className="h-3 w-3" /> Topic
                        </Label>
                        <Input
                          value={entry.topic}
                          onChange={(e) => updateEntry(entry.weekNumber, 'topic', e.target.value)}
                          placeholder="Enter topic"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                          <ChevronRight className="h-3 w-3" /> Sub-Topic
                        </Label>
                        <Input
                          value={entry.subTopic || ''}
                          onChange={(e) => updateEntry(entry.weekNumber, 'subTopic', e.target.value)}
                          placeholder="Enter sub-topic (optional)"
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                          <Target className="h-3 w-3" /> Learning Objectives
                        </Label>
                        <Textarea
                          value={entry.learningObjectives || ''}
                          onChange={(e) => updateEntry(entry.weekNumber, 'learningObjectives', e.target.value)}
                          placeholder="What students should learn..."
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                          <Wrench className="h-3 w-3" /> Teaching Activities
                        </Label>
                        <Textarea
                          value={entry.teachingActivities || ''}
                          onChange={(e) => updateEntry(entry.weekNumber, 'teachingActivities', e.target.value)}
                          placeholder="What the teacher will do..."
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                          <BookCheck className="h-3 w-3" /> Learning Activities
                        </Label>
                        <Textarea
                          value={entry.learningActivities || ''}
                          onChange={(e) => updateEntry(entry.weekNumber, 'learningActivities', e.target.value)}
                          placeholder="What students will do..."
                          className="text-sm min-h-[50px]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                          <ClipboardList className="h-3 w-3" /> Assessment Method
                        </Label>
                        <Textarea
                          value={entry.assessmentMethod || ''}
                          onChange={(e) => updateEntry(entry.weekNumber, 'assessmentMethod', e.target.value)}
                          placeholder="Quiz, assignment, oral..."
                          className="text-sm min-h-[50px]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                          <Monitor className="h-3 w-3" /> Resources
                        </Label>
                        <Textarea
                          value={entry.resources || ''}
                          onChange={(e) => updateEntry(entry.weekNumber, 'resources', e.target.value)}
                          placeholder="Textbooks, materials, links..."
                          className="text-sm min-h-[50px]"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-white py-4 border-t">
              <Button variant="outline" onClick={() => fetchSchemeDetail(selectedScheme.id)}>
                Reset
              </Button>
              <Button onClick={handleSaveEntries} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                {saving ? (
                  <>Saving...</>
                ) : (
                  <><FileText className="h-4 w-4" /> Save All Entries</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // View: scheme list
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookText className="h-6 w-6 text-purple-500" />
            Scheme of Work
          </h2>
          <p className="text-sm text-gray-500">Manage weekly topic breakdowns for each subject, class, and term.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
          <Plus className="h-4 w-4" /> Create Scheme
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-48">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.section ? ` - ${c.section}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.code ? ` (${s.code})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {classFilter && (
          <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => setClassFilter('')}>
            Clear filters <span className="text-xs">&times;</span>
          </Badge>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : schemes.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-3">
          {schemes.map((scheme) => (
            <motion.div
              key={scheme.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => fetchSchemeDetail(scheme.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {scheme.subject.name}{scheme.subject.code ? ` (${scheme.subject.code})` : ''}
                    </h3>
                    {scheme.isPublished && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Published</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {scheme.class.name}{scheme.class.section ? ` - ${scheme.class.section}` : ''}
                    {' '}&middot; {scheme.term.name} &middot; {scheme.academicYear.name}
                  </p>
                  {scheme.title && <p className="text-sm text-gray-600 mt-1">{scheme.title}</p>}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant="outline" className="text-xs gap-1">
                    <FileText className="h-3 w-3" /> {scheme._count.entries} weeks
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => { e.stopPropagation(); handleDelete(scheme.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookText className="h-5 w-5 text-purple-500" />
              Create Scheme of Work
            </DialogTitle>
            <DialogDescription>
              Select a class, subject, term, and academic year. Weekly entries will be auto-generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Select value={formData.subjectId} onValueChange={(v) => setFormData({ ...formData, subjectId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Academic Year *</Label>
                <Select value={formData.academicYearId} onValueChange={(v) => setFormData({ ...formData, academicYearId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>
                    {academicYears.map(y => (
                      <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Term *</Label>
                <Select value={formData.termId} onValueChange={(v) => setFormData({ ...formData, termId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    {terms.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. SS1 Mathematics First Term Scheme"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Overview of what this scheme covers..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
              {creating ? 'Creating...' : <><Plus className="h-4 w-4" /> Create</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
