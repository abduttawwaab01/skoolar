'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Printer,
  Download,
  Send,
  FileText,
  Award,
  ChevronLeft,
  ChevronRight,
  Loader2,
  XCircle,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  Pencil,
  Palette,
  MessageCircle,
  ExternalLink,
  Archive,
  Send as SendIcon,
  CheckCircle,
  Ban,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { cn } from '@/lib/utils';
import { ReportCard, type ReportCardData as RenderCardData } from './report-card-renderer';
import { ReportCardDesigner } from './report-card-designer';

// ---- Image Resolution ----

async function resolveImageUrl(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json?.dataUri) return json.dataUri;
    }
  } catch {}
  return url;
}

// ---- Types ----

interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  caScore: number;
  examScore: number;
  total: number;
  percentage: number;
  grade: string;
  remark: string;
  scoresByType?: Record<string, { raw: number; max: number; normalized: number }>;
}

interface AttendanceData {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  daysLate?: number;
  percentage: number;
}

interface DomainGradeData {
  id?: string;
  cognitive: { reasoning?: string; memory?: string; concentration?: string; problemSolving?: string; initiative?: string; average?: string };
  psychomotor: { handwriting?: string; sports?: string; drawing?: string; practical?: string; average?: string };
  affective: { punctuality?: string; neatness?: string; honesty?: string; leadership?: string; cooperation?: string; attentiveness?: string; obedience?: string; selfControl?: string; politeness?: string; average?: string };
  classTeacherComment?: string;
  classTeacherName?: string;
  principalComment?: string;
  principalName?: string;
}

interface ReportCardData {
  id: string;
  schoolId: string;
  studentId: string;
  termId: string;
  classId: string;
  totalScore: number;
  averageScore: number;
  grade: string;
  classRank?: number;
  totalStudents?: number;
  teacherComment?: string;
  principalComment?: string;
  attendanceSummary?: string;
  approvalStatus: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  student: {
    id: string;
    name: string;
    admissionNo: string;
    gender?: string;
    dateOfBirth?: string;
    bloodGroup?: string;
    photo?: string;
    classPosition?: string;
    parents?: string;
  };
  subjectResults: SubjectResult[];
  numSubjects: number;
  grandTotal: number;
  grandPossible: number;
  overallGrade: { grade: string; remark: string };
  attendance: AttendanceData;
  domainGrade: DomainGradeData | null;
}

interface MetaData {
  school: {
    id: string;
    name: string;
    logo?: string;
    address?: string;
    motto?: string;
    phone?: string;
    email?: string;
    website?: string;
    primaryColor: string;
    secondaryColor: string;
  };
  settings: {
    scoreSystem?: string;
    fontFamily?: string;
    schoolMotto?: string;
    schoolVision?: string;
    schoolMission?: string;
    principalName?: string;
    vicePrincipalName?: string;
    nextTermBegins?: string;
    academicSession?: string;
  } | null;
  term: {
    id: string;
    name: string;
    order: number;
    startDate: string;
    endDate: string;
    academicYear: string;
  };
  class: {
    id: string;
    name: string;
    section?: string;
    grade?: string;
    classTeacher?: string;
  };
  totalStudents: number;
  generatedAt: string;
}

// ---- Rating Options for Domain Grading ----
const RATING_OPTIONS = [
  { label: 'Excellent', value: '5' },
  { label: 'Very Good', value: '4' },
  { label: 'Good', value: '3' },
  { label: 'Fair', value: '2' },
  { label: 'Poor', value: '1' },
];

function ratingToLabel(val?: string): string {
  if (!val) return '';
  const found = RATING_OPTIONS.find(r => r.value === val);
  return found ? found.label : val;
}

function calcAverage(values: (string | undefined)[]): string {
  const nums = values.map(v => parseInt(v || '0')).filter(n => n > 0);
  if (nums.length === 0) return '';
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return String(Math.round(avg));
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ---- Skeleton ----

function ReportCardSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-3 p-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-4 w-56 mx-auto" />
      <div className="border rounded-lg p-3">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3" />
          ))}
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Skeleton className="h-7 w-full bg-gray-200" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full border-b" />
        ))}
      </div>
    </div>
  );
}

// ---- Domain Grade Editor Dialog ----

function DomainGradeEditorDialog({
  open,
  onOpenChange,
  reportCard,
  meta,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportCard: ReportCardData;
  meta: MetaData;
  onSave: (data: ReportCardData) => void;
}) {
  const [saving, setSaving] = useState(false);
  const dg = reportCard.domainGrade;

  const [cognitive, setCognitive] = useState({
    reasoning: dg?.cognitive.reasoning || '',
    memory: dg?.cognitive.memory || '',
    concentration: dg?.cognitive.concentration || '',
    problemSolving: dg?.cognitive.problemSolving || '',
    initiative: dg?.cognitive.initiative || '',
  });
  const [psychomotor, setPsychomotor] = useState({
    handwriting: dg?.psychomotor.handwriting || '',
    sports: dg?.psychomotor.sports || '',
    drawing: dg?.psychomotor.drawing || '',
    practical: dg?.psychomotor.practical || '',
  });
  const [affective, setAffective] = useState({
    punctuality: dg?.affective.punctuality || '',
    neatness: dg?.affective.neatness || '',
    honesty: dg?.affective.honesty || '',
    leadership: dg?.affective.leadership || '',
    cooperation: dg?.affective.cooperation || '',
    attentiveness: dg?.affective.attentiveness || '',
    obedience: dg?.affective.obedience || '',
    selfControl: dg?.affective.selfControl || '',
    politeness: dg?.affective.politeness || '',
  });
  const [classTeacherComment, setClassTeacherComment] = useState(dg?.classTeacherComment || '');
  const [classTeacherName, setClassTeacherName] = useState(dg?.classTeacherName || meta.class.classTeacher || '');
  const [principalComment, setPrincipalComment] = useState(dg?.principalComment || '');
  const [principalName, setPrincipalName] = useState(dg?.principalName || meta.settings?.principalName || '');

  const cogAvg = calcAverage([cognitive.reasoning, cognitive.memory, cognitive.concentration, cognitive.problemSolving, cognitive.initiative]);
  const psyAvg = calcAverage([psychomotor.handwriting, psychomotor.sports, psychomotor.drawing, psychomotor.practical]);
  const affAvg = calcAverage([affective.punctuality, affective.neatness, affective.honesty, affective.leadership, affective.cooperation, affective.attentiveness, affective.obedience, affective.selfControl, affective.politeness]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        schoolId: reportCard.schoolId,
        studentId: reportCard.studentId,
        termId: reportCard.termId,
        classId: reportCard.classId,
        cognitiveReasoning: cognitive.reasoning,
        cognitiveMemory: cognitive.memory,
        cognitiveConcentration: cognitive.concentration,
        cognitiveProblemSolving: cognitive.problemSolving,
        cognitiveInitiative: cognitive.initiative,
        cognitiveAverage: cogAvg,
        psychomotorHandwriting: psychomotor.handwriting,
        psychomotorSports: psychomotor.sports,
        psychomotorDrawing: psychomotor.drawing,
        psychomotorPractical: psychomotor.practical,
        psychomotorAverage: psyAvg,
        affectivePunctuality: affective.punctuality,
        affectiveNeatness: affective.neatness,
        affectiveHonesty: affective.honesty,
        affectiveLeadership: affective.leadership,
        affectiveCooperation: affective.cooperation,
        affectiveAttentiveness: affective.attentiveness,
        affectiveObedience: affective.obedience,
        affectiveSelfControl: affective.selfControl,
        affectivePoliteness: affective.politeness,
        affectiveAverage: affAvg,
        classTeacherComment,
        classTeacherName,
        principalComment,
        principalName,
      };

      const url = dg?.id ? '/api/domain-grades' : '/api/domain-grades';
      const method = dg?.id ? 'PUT' : 'POST';
      const body = dg?.id ? { id: dg.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error || 'Failed to save domain grades');
        return;
      }

      toast.success('Domain grades saved successfully');

      onSave({
        ...reportCard,
        domainGrade: {
          id: dg?.id,
          cognitive: { ...cognitive, average: cogAvg },
          psychomotor: { ...psychomotor, average: psyAvg },
          affective: { ...affective, average: affAvg },
          classTeacherComment,
          classTeacherName,
          principalComment,
          principalName,
        },
      });
      onOpenChange(false);
    } catch (error: unknown) { handleSilentError(error);
      toast.error('Failed to save domain grades');
    } finally {
      setSaving(false);
    }
  };

  const color = meta.school?.primaryColor || '#059669';

  const RatingSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        {RATING_OPTIONS.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label} ({opt.value})</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl max-h-[85vh] overflow-y-auto w-full shadow-xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Pencil className="size-5 text-emerald-600" />
              Edit Domain Grades - {reportCard.student.name}
            </h3>
            <p className="text-sm text-gray-500">Rate each skill from Poor (1) to Excellent (5)</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-gray-400 hover:text-gray-600">
            <XCircle className="size-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Cognitive Domain */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-bold mb-3" style={{ color }}>Cognitive Domain</h4>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['reasoning', 'Reasoning'],
                ['memory', 'Memory'],
                ['concentration', 'Concentration'],
                ['problemSolving', 'Problem Solving'],
                ['initiative', 'Initiative'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <RatingSelect value={cognitive[key]} onChange={(v) => setCognitive(p => ({ ...p, [key]: v }))} />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs font-bold">Average (Auto)</Label>
                <div className="h-8 flex items-center text-sm font-bold" style={{ color }}>{cogAvg || '-'}</div>
              </div>
            </div>
          </div>

          {/* Psychomotor Domain */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-bold mb-3" style={{ color }}>Psychomotor Domain</h4>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['handwriting', 'Handwriting'],
                ['sports', 'Sports'],
                ['drawing', 'Drawing'],
                ['practical', 'Practical'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <RatingSelect value={psychomotor[key]} onChange={(v) => setPsychomotor(p => ({ ...p, [key]: v }))} />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs font-bold">Average (Auto)</Label>
                <div className="h-8 flex items-center text-sm font-bold" style={{ color }}>{psyAvg || '-'}</div>
              </div>
            </div>
          </div>

          {/* Affective Domain */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-bold mb-3" style={{ color }}>Affective Domain</h4>
            <div className="grid grid-cols-3 gap-3">
              {([
                ['punctuality', 'Punctuality'],
                ['neatness', 'Neatness'],
                ['honesty', 'Honesty'],
                ['leadership', 'Leadership'],
                ['cooperation', 'Cooperation'],
                ['attentiveness', 'Attentiveness'],
                ['obedience', 'Obedience'],
                ['selfControl', 'Self Control'],
                ['politeness', 'Politeness'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <RatingSelect value={affective[key]} onChange={(v) => setAffective(p => ({ ...p, [key]: v }))} />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs font-bold">Average (Auto)</Label>
                <div className="h-8 flex items-center text-sm font-bold" style={{ color }}>{affAvg || '-'}</div>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-bold" style={{ color }}>Comments</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Class Teacher</Label>
                <Input value={classTeacherName} onChange={(e) => setClassTeacherName(e.target.value)} placeholder="Teacher name" className="h-8 text-xs" />
                <Textarea value={classTeacherComment} onChange={(e) => setClassTeacherComment(e.target.value)} placeholder="Teacher comment..." rows={2} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Principal</Label>
                <Input value={principalName} onChange={(e) => setPrincipalName(e.target.value)} placeholder="Principal name" className="h-8 text-xs" />
                <Textarea value={principalComment} onChange={(e) => setPrincipalComment(e.target.value)} placeholder="Principal comment..." rows={2} className="text-xs" />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} style={{ backgroundColor: color }}>
            {saving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
            Save Domain Grades
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----

export function ReportCardManager() {
  const { currentUser, selectedSchoolId: storeSchoolId } = useAppStore();
  const schoolId = storeSchoolId || currentUser.schoolId;

  // Tab state
  const [activeTab, setActiveTab] = useState<'generate' | 'design'>('generate');

  // Generate workflow state
  const [classes, setClasses] = useState<{ id: string; name: string; section?: string }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string; order: number; isCurrent: boolean }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; admissionNo: string }[]>([]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');


  const [generating, setGenerating] = useState(false);
  const [reportCards, setReportCards] = useState<ReportCardData[]>([]);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isGeneratingReportCards, setIsGeneratingReportCards] = useState(false);

  const [teacherComment, setTeacherComment] = useState('');
  const [principalComment, setPrincipalComment] = useState('');

  // Domain grade editor
  const [domainEditorOpen, setDomainEditorOpen] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const reportCardRef = useRef<HTMLDivElement>(null);
  const bulkRenderRef = useRef<HTMLDivElement>(null);
  const [bulkRenderCard, setBulkRenderCard] = useState<RenderCardData | null>(null);

  const [resolvedLogo, setResolvedLogo] = useState<string | undefined>(undefined);
  const [resolvedPhotos, setResolvedPhotos] = useState<Map<string, string>>(new Map());

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      if (!schoolId) { setLoading(false); return; }
      try {
        const [classesRes, termsRes] = await Promise.all([
          fetch(`/api/classes?schoolId=${schoolId}&limit=100`),
          fetch(`/api/terms?schoolId=${schoolId}&limit=20`),
        ]);
        if (classesRes.ok) {
          const json = await classesRes.json();
          setClasses((json.data || []).map((c: { id: string; name: string; section?: string }) => ({ id: c.id, name: c.name, section: c.section })));
        }
        if (termsRes.ok) {
          const json = await termsRes.json();
          const termsData: { id: string; name: string; order: number; isCurrent: boolean }[] = (json.data || json.terms || []).map((t: any) => ({ id: t.id, name: t.name, order: t.order, isCurrent: t.isCurrent }));
          setTerms(termsData);
          if (termsData.length > 0 && !selectedTermId) {
            const currentTerm = termsData.find((t: any) => t.isCurrent === true);
            setSelectedTermId(currentTerm?.id || termsData[0].id);
          }
        }
      } catch (error: unknown) { handleSilentError(error); toast.error('Failed to load data'); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [schoolId]);

  // Fetch students when class changes
  useEffect(() => {
    async function fetchStudents() {
      if (!selectedClassId) { setStudents([]); return; }
      try {
        const res = await fetch(`/api/students?schoolId=${schoolId}&classId=${selectedClassId}&limit=200`);
        if (res.ok) {
          const json = await res.json();
          setStudents((json.data || []).map((s: { id: string; name: string; admissionNo: string; user?: { name: string } }) => ({
            id: s.id, name: s.user?.name || s.name, admissionNo: s.admissionNo,
          })));
        }
      } catch (error: unknown) { handleSilentError(error); }
    }
    fetchStudents();
  }, [selectedClassId, schoolId]);

  // Load comments when current report card changes
  useEffect(() => {
    if (reportCards.length > 0 && reportCards[currentIndex]) {
      setTeacherComment(reportCards[currentIndex].teacherComment || '');
      setPrincipalComment(reportCards[currentIndex].principalComment || '');
    }
  }, [reportCards, currentIndex]);

  // Resolve school logo to data URI when meta changes
  useEffect(() => {
    if (!meta?.school?.logo) { setResolvedLogo(undefined); return; }
    let cancelled = false;
    resolveImageUrl(meta.school.logo).then(uri => { if (!cancelled) setResolvedLogo(uri); });
    return () => { cancelled = true; };
  }, [meta?.school?.logo]);

  // Resolve student photos to data URIs when report cards change
  useEffect(() => {
    if (reportCards.length === 0) { setResolvedPhotos(new Map()); return; }
    let cancelled = false;
    const photoUrls = new Map<string, string>();
    reportCards.forEach(card => {
      if (card.student?.photo) photoUrls.set(card.student.id, card.student.photo);
    });
    if (photoUrls.size === 0) { setResolvedPhotos(new Map()); return; }
    const promises = Array.from(photoUrls.entries()).map(([id, url]) =>
      resolveImageUrl(url).then(resolved => ({ id, resolved }))
    );
    Promise.all(promises).then(results => {
      if (cancelled) return;
      const map = new Map<string, string>();
      results.forEach(r => { if (r.resolved) map.set(r.id, r.resolved); });
      setResolvedPhotos(map);
    });
    return () => { cancelled = true; };
  }, [reportCards]);

  // Generate report cards
  const handleGenerate = useCallback(async () => {
    if (!schoolId || !selectedClassId || !selectedTermId) {
      toast.error('Please select class and term');
      return;
    }
    if (generating || isGeneratingReportCards) return;

    setIsGeneratingReportCards(true);
    setGenerating(true);
    try {
      const payload: Record<string, string> = { schoolId, termId: selectedTermId, classId: selectedClassId };
      if (selectedStudentId) payload.studentId = selectedStudentId;

      const res = await fetch('/api/report-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Generation failed'); return; }

      setReportCards(json.data || []);
      setMeta(json.meta || null);
      setCurrentIndex(0);
      toast.success(json.message || `Generated ${(json.data || []).length} report card(s)`);
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to generate report cards'); }
    finally {
      setGenerating(false);
      setIsGeneratingReportCards(false);
    }
  }, [schoolId, selectedClassId, selectedTermId, selectedStudentId, generating, isGeneratingReportCards]);

  // Save comment
  const handleSaveComment = useCallback(async (type: 'teacher' | 'principal') => {
    if (reportCards.length === 0 || !reportCards[currentIndex]) return;
    const rc = reportCards[currentIndex];
    try {
      const res = await fetch(`/api/report-cards/${rc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherComment: type === 'teacher' ? teacherComment : undefined,
          principalComment: type === 'principal' ? principalComment : undefined,
        }),
      });
      if (res.ok) {
        toast.success(`${type === 'teacher' ? 'Teacher' : 'Principal'} comment saved`);
        setReportCards(prev => prev.map((card, i) => {
          if (i === currentIndex) return { ...card, teacherComment: type === 'teacher' ? teacherComment : card.teacherComment, principalComment: type === 'principal' ? principalComment : card.principalComment };
          return card;
        }));
      }
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to save comment'); }
  }, [reportCards, currentIndex, teacherComment, principalComment]);

  // Submit for approval
  const handleSubmitForApproval = useCallback(async () => {
    if (reportCards.length === 0 || !reportCards[currentIndex]) return;
    const rc = reportCards[currentIndex];
    try {
      const res = await fetch(`/api/report-cards/${rc.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Submit failed'); return; }
      toast.success('Report card submitted for approval');
      setReportCards(prev => prev.map((card, i) => i === currentIndex ? { ...card, approvalStatus: 'submitted' } : card));
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to submit'); }
  }, [reportCards, currentIndex]);

  // Approve
  const handleApprove = useCallback(async () => {
    if (reportCards.length === 0 || !reportCards[currentIndex]) return;
    const rc = reportCards[currentIndex];
    try {
      const res = await fetch(`/api/report-cards/${rc.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Approve failed'); return; }
      toast.success('Report card approved');
      setReportCards(prev => prev.map((card, i) => i === currentIndex ? { ...card, approvalStatus: 'approved' } : card));
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to approve'); }
  }, [reportCards, currentIndex]);

  // Reject
  const handleReject = useCallback(async () => {
    if (reportCards.length === 0 || !reportCards[currentIndex]) return;
    const rc = reportCards[currentIndex];
    try {
      const res = await fetch(`/api/report-cards/${rc.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Reject failed'); return; }
      toast.success('Report card rejected');
      setReportCards(prev => prev.map((card, i) => i === currentIndex ? { ...card, approvalStatus: 'draft' } : card));
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to reject'); }
  }, [reportCards, currentIndex]);

  // Publish
  const handlePublish = useCallback(async () => {
    if (reportCards.length === 0 || !reportCards[currentIndex]) return;
    const rc = reportCards[currentIndex];
    try {
      const res = await fetch(`/api/report-cards/${rc.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Publish failed'); return; }
      toast.success('Report card published');
      setReportCards(prev => prev.map((card, i) => i === currentIndex ? { ...card, approvalStatus: 'published', isPublished: true } : card));
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to publish'); }
  }, [reportCards, currentIndex]);

  // Unpublish
  const handleUnpublish = useCallback(async () => {
    if (reportCards.length === 0 || !reportCards[currentIndex]) return;
    const rc = reportCards[currentIndex];
    try {
      const res = await fetch(`/api/report-cards/${rc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: false }),
      });
      if (res.ok) {
        toast.success('Report card unpublished');
        setReportCards(prev => prev.map((card, i) => i === currentIndex ? { ...card, isPublished: false } : card));
      }
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to unpublish'); }
  }, [reportCards, currentIndex]);

  // Print
  const handlePrint = useCallback(async () => {
    const el = printRef.current;
    if (!el) { toast.error('No report card to print'); return; }
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
      const win = window.open('', '_blank');
      if (!win) { toast.error('Please allow popups to print'); return; }
      win.document.write(`<!DOCTYPE html><html><head><title>Report Card</title><style>@page{size:A4 landscape;margin:8mm;}body{margin:0;display:flex;justify-content:center;align-items:flex-start;}img{max-width:100%;height:auto;}</style></head><body><img src="${dataUrl}" onload="setTimeout(()=>{window.print();window.close()},300);" /></body></html>`);
      win.document.close();
    } catch (err) {
      console.error('[ReportCard] Print failed:', err);
      toast.error('Failed to prepare print');
    }
  }, []);

  // Download PDF
  const [sendingParentEmail, setSendingParentEmail] = useState(false);
  const [whatsappUrls, setWhatsappUrls] = useState<{name: string; phone: string; url: string}[]>([]);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleDownloadPdf = useCallback(async (reportCardId: string) => {
    if (!reportCardId) { toast.error('No report card selected'); return; }
    const el = printRef.current;
    if (!el) { toast.error('No report card rendered'); return; }
    try {
      const { toPng } = await import('html-to-image');
      const { default: jsPDF } = await import('jspdf');

      const dataUrl = await toPng(el, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
      const img = new Image();
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = dataUrl; });

      const pw = 297, ph = 210;
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgW = img.naturalWidth, imgH = img.naturalHeight;
      const mmW = (imgW / 96) * 25.4, mmH = (imgH / 96) * 25.4;
      const scale = Math.min(pw / mmW, ph / mmH);
      const finalW = mmW * scale, finalH = mmH * scale;
      pdf.addImage(dataUrl, 'PNG', (pw - finalW) / 2, (ph - finalH) / 2, finalW, finalH, undefined, 'FAST');
      pdf.save(`report-card-${reportCardId}.pdf`);
    } catch (err) { console.error('[ReportCard] PDF export failed:', err); toast.error('Failed to generate PDF'); }
  }, []);

  // Download PNG
  const handleDownloadPng = useCallback(async (reportCardId: string) => {
    if (!reportCardId) { toast.error('No report card selected'); return; }
    const el = printRef.current;
    if (!el) { toast.error('No report card rendered'); return; }
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `report-card-${reportCardId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error('[ReportCard] PNG export failed:', err); toast.error('Failed to generate PNG'); }
  }, []);

  const currentCard = reportCards[currentIndex];
  const primaryColor = meta?.school?.primaryColor || '#059669';

  // Transform internal ReportCardData to RenderCardData for the React renderer
  const toRenderData = useCallback((card: ReportCardData): RenderCardData => {
    return {
      schoolName: meta?.school?.name || '',
      schoolLogo: resolvedLogo || meta?.school?.logo || undefined,
      schoolMotto: meta?.school?.motto || meta?.settings?.schoolMotto || '',
      schoolAddress: meta?.school?.address || '',
      schoolPhone: meta?.school?.phone || '',
      schoolEmail: meta?.school?.email || '',
      studentName: card.student?.name || '',
      studentId: card.student?.admissionNo || card.studentId,
      studentPhoto: resolvedPhotos.get(card.studentId) || card.student?.photo || undefined,
      studentGender: card.student?.gender || undefined,
      studentDOB: card.student?.dateOfBirth || undefined,
      className: meta?.class?.name || '',
      classSection: meta?.class?.section || '',
      term: meta?.term?.name || '',
      session: meta?.term?.academicYear || '',
      subjects: (card.subjectResults || []).map((r) => ({
        subject: r.subjectName || 'Unknown',
        score: Math.round(r.total ?? 0),
        total: 100,
        grade: r.grade || '',
        remark: r.remark || '',
        caScore: r.caScore ?? undefined,
        examScore: r.examScore ?? undefined,
        caTotal: 40,
        examTotal: 60,
      })),
      domains: card.domainGrade ? [
        { name: 'Cognitive', score: parseInt(card.domainGrade.cognitive?.average || '0') || 0, max: 5 },
        { name: 'Psychomotor', score: parseInt(card.domainGrade.psychomotor?.average || '0') || 0, max: 5 },
        { name: 'Affective', score: parseInt(card.domainGrade.affective?.average || '0') || 0, max: 5 },
      ] : [],
      attendance: {
        present: card.attendance?.presentDays ?? 0,
        absent: card.attendance?.absentDays ?? 0,
        late: card.attendance?.daysLate ?? 0,
        total: card.attendance?.totalDays ?? 0,
      },
      teacherComment: card.teacherComment || card.domainGrade?.classTeacherComment || '',
      teacherName: card.domainGrade?.classTeacherName || meta?.class?.classTeacher || '',
      principalComment: card.principalComment || card.domainGrade?.principalComment || '',
      nextTerm: meta?.settings?.nextTermBegins || '',
      position: card.classRank ? `${card.classRank}${card.classRank === 1 ? 'st' : card.classRank === 2 ? 'nd' : card.classRank === 3 ? 'rd' : 'th'}` : '',
      totalStudents: meta?.totalStudents,
      generatedAt: card.createdAt || new Date().toISOString(),
    };
  }, [meta, resolvedLogo, resolvedPhotos]);

  // Download All as ZIP (client-side rendering)
  const handleDownloadAll = useCallback(async () => {
    if (reportCards.length === 0) { toast.error('No report cards available'); return; }
    setDownloadingAll(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { toPng } = await import('html-to-image');
      const zip = new JSZip();
      const folder = zip.folder('report-cards');
      if (!folder) return;

      const container = bulkRenderRef.current;
      if (!container) { toast.error('Bulk render container not ready'); return; }

      for (let i = 0; i < reportCards.length; i++) {
        const card = reportCards[i];
        const renderData = toRenderData(card);
        setBulkRenderCard(renderData);

        // Wait for React to render the card into the hidden container
        await new Promise<void>(resolve => {
          const check = () => {
            const img = container.querySelector('img');
            if (img && img.complete && img.naturalWidth > 0) { resolve(); return; }
            const svgs = container.querySelectorAll('svg');
            if (svgs.length > 0) { setTimeout(resolve, 100); return; }
            setTimeout(check, 50);
          };
          // Give React time to render first
          requestAnimationFrame(() => requestAnimationFrame(check));
        });

        // Extra settle time for fonts/images
        await new Promise(r => setTimeout(r, 200));

        const dataUrl = await toPng(container.firstElementChild as HTMLElement, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });

        const base64 = dataUrl.split(',')[1];
        const studentName = card.student?.name || card.studentId;
        const filename = `${studentName.replace(/[^a-zA-Z0-9]/g, '_')}-${card.id.slice(0, 8)}.png`;
        folder.file(filename, base64, { base64: true });

        toast.info(`Captured ${i + 1}/${reportCards.length}: ${studentName}`);
      }

      setBulkRenderCard(null);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-cards-all-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${reportCards.length} report cards`);
    } catch (err) {
      console.error('[ReportCard] Bulk download failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to download all report cards');
      setBulkRenderCard(null);
    } finally {
      setDownloadingAll(false);
    }
  }, [reportCards, toRenderData]);

  // Send to Parent
  const handleSendToParent = useCallback(async (reportCardId: string) => {
    if (!reportCardId) { toast.error('No report card selected'); return; }
    try {
      setSendingParentEmail(true);
      setWhatsappUrls([]);
      const res = await fetch(`/api/report-cards/${reportCardId}/send-to-parent`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      toast.success(json.message || `Report card sent to ${json.sentCount || 0} parent(s)`);
      if (json.whatsappUrls && json.whatsappUrls.length > 0) {
        setWhatsappUrls(json.whatsappUrls);
        setShowWhatsAppDialog(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSendingParentEmail(false);
    }
  }, []);

  // Domain grade save
  const handleDomainGradeSave = useCallback((updatedCard: ReportCardData) => {
    setReportCards(prev => prev.map((card, i) => i === currentIndex ? updatedCard : card));
  }, [currentIndex]);

  // Status badge helper
  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary" className="bg-gray-100 text-gray-600"><XCircle className="size-3 mr-1" /> Draft</Badge>;
      case 'submitted': return <Badge variant="secondary" className="bg-blue-100 text-blue-600"><SendIcon className="size-3 mr-1" /> Submitted</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-600"><CheckCircle className="size-3 mr-1" /> Approved</Badge>;
      case 'published': return <Badge variant="default" className="bg-emerald-600"><Eye className="size-3 mr-1" /> Published</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Report Cards</h2>
            <p className="text-sm text-muted-foreground">
              <Palette className="size-4 mr-1 inline-block align-middle" /> Loading...
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-6">
          <ReportCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Report Cards</h2>
            <p className="text-sm text-muted-foreground">
              <Palette className="size-4 mr-1 inline-block align-middle" /> Generate, review, and publish report cards
            </p>
          </div>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              className={cn('px-3 py-1.5 text-sm font-medium transition-colors', activeTab === 'generate' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100')}
              onClick={() => setActiveTab('generate')}
            >
              <FileText className="size-3.5 mr-1 inline" />
              Generate & Review
            </button>
            <button
              className={cn('px-3 py-1.5 text-sm font-medium transition-colors', activeTab === 'design' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100')}
              onClick={() => setActiveTab('design')}
            >
              <Palette className="size-3.5 mr-1 inline" />
              Design
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'design' ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="w-full lg:w-80 lg:border-r lg:flex-shrink-0 overflow-y-auto">
            <ReportCardDesigner />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Preview placeholder */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {currentCard && meta ? (
                <div className="mx-auto print:mx-0 overflow-auto" ref={reportCardRef}>
                  <ReportCard data={toRenderData(currentCard)} design={{ primary: primaryColor }} />
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <Award className="size-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm">Generate report cards first to see a preview here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Top Action Bar */}
          {reportCards.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setSelectedStudentId(''); handleGenerate(); }}>
                  <RefreshCw className="size-3.5 mr-1" />
                  Regenerate All
                </Button>
                <Button size="sm" onClick={handlePrint}>
                  <Printer className="size-3.5 mr-1" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(currentCard?.id || '')} disabled={!currentCard?.id}>
                  <Download className="size-3.5 mr-1" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadPng(currentCard?.id || '')} disabled={!currentCard?.id}>
                  <FileText className="size-3.5 mr-1" />
                  PNG
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadAll} disabled={reportCards.length === 0 || downloadingAll}>
                  {downloadingAll ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Archive className="size-3.5 mr-1" />}
                  {downloadingAll ? 'Zipping...' : `All (${reportCards.length})`}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSendToParent(currentCard?.id || '')} disabled={!currentCard?.id || sendingParentEmail}>
                  <Send className="size-3.5 mr-1" />
                  {sendingParentEmail ? 'Sending...' : 'Send to Parents'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDomainEditorOpen(true)} style={{ borderColor: primaryColor, color: primaryColor }}>
                  <Pencil className="size-3.5 mr-1" />
                  Domain Grades
                </Button>
              </div>
            </div>
          )}

          {/* Configuration Card */}
          <Card className="print:hidden">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Class</Label>
                  <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedStudentId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Term</Label>
                  <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                    <SelectTrigger><SelectValue placeholder="Select a term" /></SelectTrigger>
                    <SelectContent>
                      {terms.sort((a, b) => a.order - b.order).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Single Student (Optional)</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!selectedClassId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={selectedClassId ? 'All students' : 'Select class first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.admissionNo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium invisible">Action</Label>
                  <Button className="w-full" onClick={handleGenerate} disabled={generating || !selectedClassId || !selectedTermId}>
                    {generating ? (<><Loader2 className="size-4 mr-2 animate-spin" /> Generating...</>) : (<><FileText className="size-4 mr-2" /> {selectedStudentId ? 'Generate for Student' : 'Generate All'}</>)}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Card Output */}
          {generating && <ReportCardSkeleton />}

          {!generating && reportCards.length === 0 && (
            <Card>
              <CardContent className="py-16">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Award className="size-8 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700">No Report Cards Generated</h3>
                    <p className="text-sm text-gray-500 mt-1">Select a class and term, then click &quot;Generate&quot; to create report cards.</p>
                  </div>
                  {!schoolId && (
                    <div className="flex items-center justify-center gap-2 text-amber-600 text-sm">
                      <AlertCircle className="size-4" />
                      <span>No school selected. Please select a school first.</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!generating && reportCards.length > 0 && currentCard && (
            <>
              {/* Student Navigation + Status */}
              <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Student <span className="font-semibold">{currentIndex + 1}</span> of <span className="font-semibold">{reportCards.length}</span>
                  </span>
                  <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentIndex(Math.min(reportCards.length - 1, currentIndex + 1))} disabled={currentIndex === reportCards.length - 1}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={currentCard.approvalStatus} />
                  <Badge variant="outline">{meta?.class?.name}{meta?.class?.section ? ` (${meta?.class?.section})` : ''}</Badge>
                  <Badge variant="outline">{meta?.term?.name}</Badge>
                </div>
              </div>

              {/* Quick Student Selector */}
              <div className="flex items-center gap-2 flex-wrap print:hidden">
                {reportCards.slice(0, 20).map((rc, i) => (
                  <button key={rc.id} className={cn('text-xs px-2.5 py-1 rounded-full transition-all', i === currentIndex ? 'text-white font-semibold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')} style={i === currentIndex ? { backgroundColor: primaryColor } : {}} onClick={() => setCurrentIndex(i)}>
                    {rc.student.name.split(' ')[0]}
                  </button>
                ))}
                {reportCards.length > 20 && <span className="text-xs text-gray-400">+{reportCards.length - 20} more</span>}
              </div>

              {/* Workflow Actions */}
              <Card className="print:hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Workflow Actions</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentCard.approvalStatus === 'draft' && (
                      <Button size="sm" onClick={handleSubmitForApproval} className="bg-blue-600 hover:bg-blue-700">
                        <SendIcon className="size-3.5 mr-1" /> Submit for Approval
                      </Button>
                    )}
                    {currentCard.approvalStatus === 'submitted' && (
                      <>
                        <Button size="sm" onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="size-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleReject}>
                          <Ban className="size-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {currentCard.approvalStatus === 'approved' && (
                      <Button size="sm" onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700">
                        <Eye className="size-3.5 mr-1" /> Publish
                      </Button>
                    )}
                    {currentCard.approvalStatus === 'published' && (
                      <Button size="sm" variant="outline" onClick={handleUnpublish}>
                        <EyeOff className="size-3.5 mr-1" /> Unpublish
                      </Button>
                    )}
                    {currentCard.approvalStatus !== 'draft' && currentCard.approvalStatus !== 'published' && (
                      <span className="text-xs text-gray-500 ml-2">Status: {currentCard.approvalStatus}</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Report Card Preview */}
              <div ref={printRef} className="print:overflow-visible w-full max-w-full flex justify-center" style={{ overflow: 'hidden auto' }}>
                <div className="relative">
                  <ReportCard data={toRenderData(currentCard)} design={{ primary: primaryColor }} />
                </div>
              </div>

              {/* Comment Editor */}
              <Card className="print:hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Edit Remarks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Teacher&apos;s Comment</Label>
                      <Textarea placeholder="Enter class teacher&apos;s remarks..." value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)} rows={3} />
                      <Button size="sm" variant="outline" onClick={() => handleSaveComment('teacher')}>Save Teacher Comment</Button>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Principal&apos;s Comment</Label>
                      <Textarea placeholder="Enter principal&apos;s remarks..." value={principalComment} onChange={(e) => setPrincipalComment(e.target.value)} rows={3} />
                      <Button size="sm" variant="outline" onClick={() => handleSaveComment('principal')}>Save Principal Comment</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Domain Grade Editor Dialog */}
          {currentCard && meta && (
            <DomainGradeEditorDialog
              open={domainEditorOpen}
              onOpenChange={setDomainEditorOpen}
              reportCard={currentCard}
              meta={meta}
              onSave={handleDomainGradeSave}
            />
          )}

          {/* WhatsApp Share Dialog */}
          <div className={cn('fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4', showWhatsAppDialog ? '' : 'hidden')} onClick={() => setShowWhatsAppDialog(false)}>
            <div className="bg-white rounded-lg max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="size-5 text-emerald-600" />
                  Share via WhatsApp
                </h3>
                <p className="text-sm text-gray-500 mt-1">Click a parent&apos;s link to open WhatsApp with a pre-filled message.</p>
              </div>
              <div className="p-4 space-y-3 max-h-60 overflow-y-auto">
                {whatsappUrls.length === 0 && (
                  <p className="text-sm text-gray-500">No parent phone numbers available.</p>
                )}
                {whatsappUrls.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MessageCircle className="size-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.phone}</p>
                      </div>
                    </div>
                    <ExternalLink className="size-4 text-gray-400" />
                  </a>
                ))}
              </div>
              <div className="p-4 border-t flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowWhatsAppDialog(false)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden container for bulk export rendering */}
      <div ref={bulkRenderRef} style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}>
        {bulkRenderCard && (
          <ReportCard data={bulkRenderCard} design={{ primary: primaryColor }} />
        )}
      </div>
    </div>
  );
}
