'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Printer,
  Download,
  Send,
  FileText,
  Award,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  GraduationCap,
  User,
  Calendar,
  Search,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  Users,
  BookOpen,
  Pencil,
  Save,
  Brain,
  MessageCircle,
  ExternalLink,
  School,
  Clipboard,
  BarChart3,
  Trophy,
  Star,
  IdCard,
  ListOrdered,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { cn } from '@/lib/utils';

// ---- Types ----

export interface ScoreTypeMeta {
  id: string;
  name: string;
  type: string;
  maxMarks: number;
  weight: number;
  position: number;
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  caScore: number;
  examScore: number;
  totalScore: number;
  maxPossible: number;
  grade: string;
  remark: string;
  scoresByType?: Record<string, number>;
}

export interface AttendanceData {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  percentage: number;
}

export interface DomainGradeData {
  id?: string;
  cognitive: { reasoning?: string; memory?: string; concentration?: string; problemSolving?: string; initiative?: string; average?: string };
  psychomotor: { handwriting?: string; sports?: string; drawing?: string; practical?: string; average?: string };
  affective: { punctuality?: string; neatness?: string; honesty?: string; leadership?: string; cooperation?: string; attentiveness?: string; obedience?: string; selfControl?: string; politeness?: string; average?: string };
  classTeacherComment?: string;
  classTeacherName?: string;
  principalComment?: string;
  principalName?: string;
}

export interface ReportCardData {
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
  };
  subjectResults: SubjectResult[];
  numSubjects: number;
  grandTotal: number;
  grandPossible: number;
  overallGrade: { grade: string; remark: string };
  attendance: AttendanceData;
  domainGrade: DomainGradeData | null;
  isThirdTerm: boolean;
}

export interface MetaData {
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
  scoreTypes?: ScoreTypeMeta[];
  totalStudents: number;
  isThirdTerm: boolean;
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

// ---- Helpers ----

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (error: unknown) { handleSilentError(error);
    return dateStr;
  }
}

function getTermLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('first') || lower.includes('1st') || lower.includes('1')) return '1ST';
  if (lower.includes('second') || lower.includes('2nd') || lower.includes('2')) return '2ND';
  if (lower.includes('third') || lower.includes('3rd') || lower.includes('3')) return '3RD';
  return name.toUpperCase();
}

// ---- Grading Key (color-coded 3×2 grid) ----
const GRADING_KEY = [
  { grade: 'A', range: '70-100', remark: 'Excellent', bg: 'bg-emerald-100', fg: 'text-emerald-800', border: 'border-emerald-200' },
  { grade: 'B', range: '60-69', remark: 'Very Good', bg: 'bg-blue-100', fg: 'text-blue-800', border: 'border-blue-200' },
  { grade: 'C', range: '50-59', remark: 'Good', bg: 'bg-amber-100', fg: 'text-amber-800', border: 'border-amber-200' },
  { grade: 'D', range: '40-49', remark: 'Fair', bg: 'bg-orange-100', fg: 'text-orange-800', border: 'border-orange-200' },
  { grade: 'E', range: '30-39', remark: 'Poor', bg: 'bg-red-100', fg: 'text-red-700', border: 'border-red-200' },
  { grade: 'F', range: '0-29', remark: 'Fail', bg: 'bg-red-200', fg: 'text-red-900', border: 'border-red-300' },
];

function getGradeBgClass(grade: string): string {
  switch (grade) {
    case 'A': case 'A+': return 'bg-emerald-100 text-emerald-700';
    case 'B': case 'B+': return 'bg-blue-100 text-blue-700';
    case 'C': return 'bg-amber-100 text-amber-700';
    case 'D': return 'bg-orange-100 text-orange-700';
    case 'E': return 'bg-red-100 text-red-700';
    case 'F': return 'bg-red-200 text-red-900';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getRatingBadgeClass(value: string): string {
  switch (value) {
    case '5': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case '4': return 'bg-blue-100 text-blue-800 border-blue-200';
    case '3': return 'bg-amber-100 text-amber-800 border-amber-200';
    case '2': return 'bg-orange-100 text-orange-800 border-orange-200';
    case '1': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

// ---- Sub-components used inside the report card ----
function Field({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] text-gray-500 uppercase tracking-wider">
        <Icon className="size-2.5" />
        {label}
      </div>
      <div className="text-[11px] font-semibold text-gray-900 truncate">{value || '—'}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, cardColor }: { icon: LucideIcon; label: string; value: string; sub: string; color: string; cardColor?: string }) {
  const c = cardColor || color;
  return (
    <div className="border rounded-xl px-2.5 py-2 bg-white flex items-center gap-2.5" style={{ borderColor: '#e2e8f0' }}>
      <Icon className="size-5 shrink-0" style={{ color: c }} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-gray-500 tracking-wider uppercase font-semibold leading-tight">{label}</p>
        <p className="text-base font-bold leading-tight" style={{ color: c }}>{value}</p>
        <p className="text-[8px] text-gray-400 leading-tight">{sub}</p>
      </div>
    </div>
  );
}

function AttendanceCell({ label, value, valueClass, color }: { label: string; value: string; valueClass: string; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-[9px] text-gray-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-base font-bold ${valueClass}`} style={valueClass === '' && color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function RemarksCard({ title, comment, name, role, color, accentColor, heightClass, icon: Icon }: { title: string; comment: string; name: string; role: string; color: string; accentColor?: string; heightClass?: string; icon?: LucideIcon }) {
  const cardAccent = accentColor || color;
  const IconComp = Icon;
  return (
    <div className={cn('border rounded-xl bg-white flex flex-col', heightClass)} style={{ borderColor: '#e2e8f0' }}>
      <div className="rounded-t-xl px-3 pt-2 pb-1" style={{ backgroundColor: `${cardAccent}10` }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          {IconComp && <IconComp className="size-3.5" style={{ color: cardAccent }} />}
          <h3 className="text-[11px] font-bold tracking-wider" style={{ color: cardAccent }}>{title}</h3>
        </div>
        <div className="h-0.5 rounded" style={{ backgroundColor: `${cardAccent}20` }} />
      </div>
      <div className="flex-1 px-3 py-2 flex flex-col">
        <p className="italic text-[11px] text-gray-700 min-h-[36px] leading-relaxed flex-1">{comment}</p>
        <div className="border-b border-dashed border-gray-300 mt-auto mb-1" style={{ borderColor: '#cbd5e1' }} />
        <p className="text-[10px] font-semibold text-gray-800 text-center">{name}</p>
        <p className="text-[8px] text-gray-400 text-center uppercase tracking-wider">{role}</p>
      </div>
    </div>
  );
}

// ---- Loading Skeleton ----

function ReportCardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="text-center space-y-2 p-4">
        <div className="flex items-center justify-center gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-4 w-64 mx-auto" />
        <Skeleton className="h-8 w-72 mx-auto rounded" />
      </div>
      <div className="border rounded-lg p-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Skeleton className="h-8 w-full bg-gray-200" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full border-b" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ---- Shared Report Card Renderer ----
function SectionHeader({ icon: Icon, title, color }: { icon: LucideIcon; title: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5 print:mb-1">
      <Icon className="size-4 shrink-0" style={{ color }} />
      <h2 className="text-[13px] font-bold tracking-wider" style={{ color }}>{title}</h2>
      <div className="flex-1 h-px" style={{ backgroundColor: `${color}30` }} />
    </div>
  );
}

function GradientPill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      className="px-6 py-1.5 rounded-full text-white text-[13px] font-bold tracking-widest border-2 relative overflow-hidden"
      style={{
        background: `linear-gradient(90deg, ${color}, ${adjustHex(color, 40)})`,
        borderColor: '#ffffff',
      }}
    >
      <div className="absolute inset-[2px] rounded-full border border-white/30" />
      {children}
    </div>
  );
}

function adjustHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const cl = (x: number) => Math.max(0, Math.min(255, x));
  const r = cl(parseInt(h.slice(0, 2), 16) + amount);
  const g = cl(parseInt(h.slice(2, 4), 16) + amount);
  const b = cl(parseInt(h.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function ReportCardRenderer({
  currentCard,
  meta,
  primaryColor,
}: {
  currentCard: ReportCardData;
  meta: MetaData;
  primaryColor?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  function fmtDate(dateStr?: string): string {
    if (!mounted) return '';
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (error: unknown) { handleSilentError(error);
      return dateStr;
    }
  }

  const school = meta.school;
  const settings = meta.settings;
  const term = meta.term;
  const cls = meta.class;
  const scoreTypes = meta.scoreTypes || [];
  const color = primaryColor || school?.primaryColor || '#059669';
  const lightColor = adjustHex(color, 40);
  const extraLightColor = adjustHex(color, 70);
  const accentColor = '#f59e0b';

  const hasDynamicColumns = scoreTypes.length > 0;
  const scoreTypeColumns = hasDynamicColumns ? scoreTypes : [];
  const numDynamicCols = scoreTypeColumns.length;
  const totalTableCols = hasDynamicColumns ? 4 + numDynamicCols : 7;

  const totalMarks = Math.round(currentCard.grandTotal || 0);
  const maxPossible = currentCard.subjectResults.length * 100;
  const avgScore = currentCard.averageScore || 0;
  const totalSubjects = currentCard.numSubjects || currentCard.subjectResults.length;
  const classRank = currentCard.classRank;
  const totalStudents = currentCard.totalStudents || 0;
  const overallGrade = currentCard.overallGrade?.grade || currentCard.grade || '—';
  const overallRemark = currentCard.overallGrade?.remark || '—';
  const termAbbr = getTermLabel(term.name);
  const studentName = currentCard.student.name || '—';
  const initials = studentName.split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase() || 'NA';
  const ordSuffix = (n: number) => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
  };
  const positionText = classRank
    ? `${classRank}${ordSuffix(classRank)} of ${totalStudents || '—'}`
    : '—';
  const teacherCommentText = currentCard.teacherComment
    || currentCard.domainGrade?.classTeacherComment
    || (cls.classTeacher ? `Comments by ${cls.classTeacher} pending.` : 'No comment yet.');
  const teacherName = currentCard.domainGrade?.classTeacherName || cls.classTeacher || 'Class Teacher';
  const principalCommentText = currentCard.principalComment
    || currentCard.domainGrade?.principalComment
    || (settings?.principalName ? `Comments by ${settings.principalName} pending.` : 'No comment yet.');
  const principalName = currentCard.domainGrade?.principalName || settings?.principalName || 'Principal';

  const isThird = currentCard.isThirdTerm;

  return (
    <div
      className="print-container w-[210mm] min-h-[297mm] bg-white shadow-2xl rounded-none print:shadow-none flex flex-col"
      style={{ fontFamily: 'Arial, Tahoma, sans-serif' }}
    >
      {/* ===== TOP GRADIENT BAR ===== */}
      <div
        className="h-2 shrink-0"
        style={{ background: `linear-gradient(90deg, ${color}, ${lightColor})` }}
      />

      <div className="px-4 py-3 print:px-4 print:py-2 flex flex-col gap-1 print:gap-0.5" id="report-card-content">
        {/* ===== HEADER (logo + school info) ===== */}
        <div className="flex items-center gap-4">
          {/* Logo with decorative double-ring */}
          <div className="relative shrink-0 flex items-center justify-center"
            style={{ width: 72, height: 72 }}>
            <div className="absolute rounded-full"
              style={{ width: 72, height: 72, backgroundColor: extraLightColor, border: `1.5px solid ${lightColor}` }}
            />
            <div className="absolute rounded-full bg-white" style={{ width: 64, height: 64 }} />
            <div className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
              style={{ width: 56, height: 56 }}>
              {school.logo ? (
                <img src={school.logo} alt={school.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xl font-bold" style={{ color }}>
                  {(school.name || 'S').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* School name & details */}
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-[16px] font-bold uppercase tracking-wide text-gray-900 leading-tight">
              {(school.name?.toUpperCase() || 'School Name').slice(0, 55)}
            </h1>
            {(school.motto || settings?.schoolMotto) && (
              <p className="text-[10px] font-semibold italic leading-tight" style={{ color }}>
                — {school.motto || settings?.schoolMotto} —
              </p>
            )}
            {school.address && <p className="text-[10px] text-gray-600 leading-tight">{school.address}</p>}
            {(school.phone || school.email) && (
              <p className="text-[9px] text-gray-500">
                {[school.phone, school.email].filter(Boolean).join(' | ')}
              </p>
            )}
          </div>
        </div>

        {/* ===== GRADIENT TERM PILL ===== */}
        <div className="flex justify-center">
          <GradientPill color={color}>
            {settings?.academicSession || term.academicYear || '—'} — {termAbbr} TERM REPORT
          </GradientPill>
        </div>

        {/* ===== STUDENT INFORMATION ===== */}
        <SectionHeader icon={User} title="STUDENT INFORMATION" color={color} />

        <div className="relative border rounded-xl bg-white p-2.5" style={{ borderColor: '#e2e8f0' }}>
          <div className="absolute top-0 left-0 right-0 h-4 rounded-t-xl" style={{ backgroundColor: `${color}08` }} />
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pr-[80px] relative">
            <Field icon={User} label="Student Name" value={studentName} />
            <Field icon={Users} label="Gender / Blood" value={`${currentCard.student.gender || '—'}${currentCard.student.bloodGroup ? ` / ${currentCard.student.bloodGroup}` : ''}`} />
            <Field icon={IdCard} label="Admission No" value={currentCard.student.admissionNo} />
            <Field icon={School} label="Class" value={`${cls.name || '—'}${cls.section ? ` (${cls.section})` : ''}`} />
            <Field icon={Calendar} label="Date of Birth" value={fmtDate(currentCard.student.dateOfBirth)} />
            <Field icon={ListOrdered} label="Position" value={positionText} />
            <Field icon={Calendar} label="Term Period" value={`${fmtDate(term.startDate)} — ${fmtDate(term.endDate)}`} />
            <Field icon={Users} label="Class Size" value={`${totalStudents || '—'} Students`} />
          </div>

          {/* Photo with decorative double-ring */}
          <div className="absolute right-1 top-0 bottom-0 flex items-center">
            <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
              <div className="absolute rounded-full" style={{ width: 68, height: 68, backgroundColor: extraLightColor, border: `1.5px solid ${color}` }} />
              <div className="absolute rounded-full bg-white" style={{ width: 60, height: 60 }} />
              <div className="relative z-10 rounded-full overflow-hidden flex items-center justify-center" style={{ width: 52, height: 52 }}>
                {currentCard.student.photo ? (
                  <img src={currentCard.student.photo} alt={studentName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: `${color}15`, color }}>
                    {initials}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== SCORE TABLE ===== */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-white font-semibold w-6 text-center rounded-tl-xl"
                  style={{ backgroundColor: color }}>S/N</th>
                <th className="px-2 py-1.5 text-left text-white font-semibold"
                  style={{ backgroundColor: color }}>SUBJECT</th>
                {hasDynamicColumns ? (
                  scoreTypeColumns.map(st => (
                    <th key={st.id} className="px-2 py-1.5 text-center text-white font-semibold whitespace-nowrap"
                      style={{ backgroundColor: color }}>
                      {st.name} ({st.weight}%)
                    </th>
                  ))
                ) : (
                  <>
                    <th className="px-2 py-1.5 text-center text-white font-semibold"
                      style={{ backgroundColor: color }}>CA (40%)</th>
                    <th className="px-2 py-1.5 text-center text-white font-semibold"
                      style={{ backgroundColor: color }}>EXAM (60%)</th>
                  </>
                )}
                <th className="px-2 py-1.5 text-center text-white font-semibold w-10"
                  style={{ backgroundColor: color }}>TOTAL</th>
                <th className="px-2 py-1.5 text-center text-white font-semibold w-10"
                  style={{ backgroundColor: color }}>GRADE</th>
                <th className="px-2 py-1.5 text-center text-white font-semibold w-20 rounded-tr-xl"
                  style={{ backgroundColor: color }}>REMARK</th>
              </tr>
            </thead>
            <tbody>
              {currentCard.subjectResults.map((sr, i) => (
                <tr key={sr.subjectId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border-x border-gray-200 px-1.5 py-1 text-center text-gray-600 text-[10px]">{i + 1}</td>
                  <td className="border-x border-gray-200 px-1.5 py-1 font-medium text-gray-900 text-[11px]">{sr.subjectName}</td>
                  {hasDynamicColumns ? (
                    scoreTypeColumns.map(st => (
                      <td key={st.id} className="border-x border-gray-200 px-1.5 py-1 text-center text-gray-700 text-[11px]">
                        {sr.scoresByType?.[st.id] != null ? Math.round(sr.scoresByType[st.id]) : '—'}
                      </td>
                    ))
                  ) : (
                    <>
                      <td className="border-x border-gray-200 px-1.5 py-1 text-center text-gray-700 text-[11px]">{Math.round(sr.caScore)}</td>
                      <td className="border-x border-gray-200 px-1.5 py-1 text-center text-gray-700 text-[11px]">{Math.round(sr.examScore)}</td>
                    </>
                  )}
                  <td className="border-x border-gray-200 px-1.5 py-1 text-center font-bold text-gray-900 text-[11px]">{Math.round(sr.totalScore)}</td>
                  <td className="border-x border-gray-200 px-1.5 py-1 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${getGradeBgClass(sr.grade)}`}>{sr.grade}</span>
                  </td>
                  <td className="border-x border-gray-200 px-1.5 py-1 text-center text-gray-600 text-[10px]">{sr.remark}</td>
                </tr>
              ))}
              {currentCard.subjectResults.length === 0 && (
                <tr>
                  <td colSpan={totalTableCols} className="py-3 text-center text-gray-400 text-[11px] border border-gray-200">
                    No scores available for this term
                  </td>
                </tr>
              )}
            </tbody>
            {currentCard.subjectResults.length > 0 && (
              <tfoot>
                <tr className="font-semibold" style={{ backgroundColor: `${color}10` }}>
                  <td colSpan={2 + numDynamicCols} className="border border-gray-200 px-2 py-1.5 text-right text-gray-700 text-[11px]">
                    TOTAL / {maxPossible}
                  </td>
                  <td className="border border-gray-200 px-2 py-1.5 text-center font-bold text-gray-900">{totalMarks}</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-center">
                    <span className="inline-block px-2 py-0.5 rounded font-bold text-[10px]"
                      style={{ backgroundColor: `${color}20`, color }}>{overallGrade}</span>
                  </td>
                  <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-700 text-[11px]">{overallRemark}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ===== 4-CARD STAT SUMMARY ===== */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard icon={Clipboard} label="TOTAL SCORE" value={String(totalMarks)} sub={`out of ${maxPossible}`} color={color} cardColor={color} />
          <StatCard icon={BarChart3} label="AVERAGE" value={`${avgScore.toFixed(1)}%`} sub={`${totalSubjects} subjects`} color={color} cardColor="#3b82f6" />
          <StatCard icon={Award} label="GRADE" value={overallGrade} sub={overallRemark} color={color} cardColor={accentColor} />
          <StatCard icon={Trophy} label="POSITION" value={String(classRank || '—')} sub={`out of ${totalStudents || '—'}`} color={color} cardColor="#8b5cf6" />
        </div>

        {/* ===== ATTENDANCE + GRADING SCALE (side by side) ===== */}
        <div className="grid grid-cols-5 gap-1.5 print:gap-1">
          {/* Attendance — 2/5 width */}
          <div className="col-span-2">
            <div className="border rounded-xl bg-white" style={{ borderColor: '#e2e8f0' }}>
              <div className="rounded-t-xl px-2 pt-1.5 pb-0.5" style={{ backgroundColor: `${color}08` }}>
                <div className="flex items-center gap-1">
                  <Calendar className="size-3" style={{ color }} />
                  <h3 className="text-[11px] font-bold tracking-wider" style={{ color }}>ATTENDANCE</h3>
                </div>
                <div className="h-[1.5px] rounded mt-0.5" style={{ backgroundColor: `${color}15` }} />
              </div>
              <div className="px-2 py-1 space-y-0">
                {([
                  { label: 'Total School Days', value: String(currentCard.attendance.totalDays), color: '#475569' },
                  { label: 'Days Present', value: String(currentCard.attendance.presentDays), color: '#059669' },
                  { label: 'Days Absent', value: String(currentCard.attendance.absentDays), color: '#ef4444' },
                  { label: 'Attendance Rate', value: `${currentCard.attendance.percentage}%`, color: color },
                ] as const).map((item, i) => (
                  <div key={item.label}>
                    {i > 0 && <div className="h-px" style={{ backgroundColor: '#f1f5f9' }} />}
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-[10px] text-gray-600">{item.label}</span>
                      <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grading Scale — 3/5 width */}
          <div className="col-span-3">
            <div className="border rounded-xl bg-white" style={{ borderColor: '#e2e8f0' }}>
              <div className="rounded-t-xl px-2 pt-1.5 pb-0.5" style={{ backgroundColor: `${accentColor}08` }}>
                <div className="flex items-center gap-1">
                  <Star className="size-3" style={{ color: accentColor }} />
                  <h3 className="text-[11px] font-bold tracking-wider" style={{ color: accentColor }}>GRADING SCALE</h3>
                </div>
                <div className="h-[1.5px] rounded mt-0.5" style={{ backgroundColor: `${accentColor}15` }} />
              </div>
              <div className="p-1">
                <div className="grid grid-cols-3 gap-0.5">
                  {GRADING_KEY.map(g => (
                    <div key={g.grade} className={`flex items-center gap-0.5 px-1 py-0.5 rounded-lg border ${g.bg} ${g.border}`}>
                      <span className={`text-xs font-bold ${g.fg} w-3.5 text-center leading-none`}>{g.grade}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[7px] font-semibold ${g.fg} leading-tight`}>{g.range}</p>
                        <p className={`text-[6px] ${g.fg} opacity-80 leading-tight`}>{g.remark}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== REMARKS & SIGNATURES ===== */}
        <SectionHeader icon={User} title="REMARKS &amp; SIGNATURES" color={color} />

        <div className="grid grid-cols-2 gap-2">
          <RemarksCard
            title="TEACHER'S ASSESSMENT"
            comment={teacherCommentText}
            name={teacherName}
            role="Class Teacher"
            color={color}
            icon={User}
            heightClass="min-h-[22mm]"
          />
          <RemarksCard
            title="PRINCIPAL'S REMARKS"
            comment={principalCommentText}
            name={principalName}
            role="Principal"
            color={color}
            accentColor={accentColor}
            icon={Award}
            heightClass="min-h-[22mm]"
          />
        </div>

        {/* ===== 3RD TERM — DOMAIN GRADING ===== */}
        {isThird && currentCard.domainGrade && (
          <div>
            <SectionHeader icon={Star} title="AFFECTIVE, PSYCHOMOTOR &amp; COGNITIVE DOMAIN" color={color} />
            <div className="border rounded-xl bg-white" style={{ borderColor: '#e2e8f0' }}>
              <div className="p-1.5">
                <div className="grid grid-cols-3 gap-1.5">
                  {renderDomainTable('COGNITIVE', [
                    { label: 'Reasoning', value: currentCard.domainGrade.cognitive.reasoning },
                    { label: 'Memory', value: currentCard.domainGrade.cognitive.memory },
                    { label: 'Concentration', value: currentCard.domainGrade.cognitive.concentration },
                    { label: 'Problem Solving', value: currentCard.domainGrade.cognitive.problemSolving },
                    { label: 'Initiative', value: currentCard.domainGrade.cognitive.initiative },
                    { label: 'Average', value: currentCard.domainGrade.cognitive.average, isAverage: true },
                  ], color, true)}
                  {renderDomainTable('PSYCHOMOTOR', [
                    { label: 'Handwriting', value: currentCard.domainGrade.psychomotor.handwriting },
                    { label: 'Sports', value: currentCard.domainGrade.psychomotor.sports },
                    { label: 'Drawing', value: currentCard.domainGrade.psychomotor.drawing },
                    { label: 'Practical', value: currentCard.domainGrade.psychomotor.practical },
                    { label: 'Average', value: currentCard.domainGrade.psychomotor.average, isAverage: true },
                  ], color, true)}
                  {renderDomainTable('AFFECTIVE', [
                    { label: 'Punctuality', value: currentCard.domainGrade.affective.punctuality },
                    { label: 'Neatness', value: currentCard.domainGrade.affective.neatness },
                    { label: 'Honesty', value: currentCard.domainGrade.affective.honesty },
                    { label: 'Leadership', value: currentCard.domainGrade.affective.leadership },
                    { label: 'Cooperation', value: currentCard.domainGrade.affective.cooperation },
                    { label: 'Attentiveness', value: currentCard.domainGrade.affective.attentiveness },
                    { label: 'Obedience', value: currentCard.domainGrade.affective.obedience },
                    { label: 'Self Control', value: currentCard.domainGrade.affective.selfControl },
                    { label: 'Politeness', value: currentCard.domainGrade.affective.politeness },
                    { label: 'Average', value: currentCard.domainGrade.affective.average, isAverage: true },
                  ], color, true)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== FOOTER ===== */}
        <div className="flex justify-between items-center text-[10px] text-gray-600 pt-1.5 mt-auto"
          style={{ borderTop: '1px solid #e2e8f0' }}>
          <span>
            Next Term Begins:{' '}
            <span className="font-semibold" style={{ color }}>
              {settings?.nextTermBegins ? fmtDate(settings.nextTermBegins) : '—'}
            </span>
          </span>
          <span className="text-[7px] text-gray-400 tracking-[2px] uppercase font-semibold">
            SKOOLAR · ACADEMIC MANAGEMENT SYSTEM
          </span>
          <span>
            Generated:{' '}
            <span className="font-medium text-gray-700">
              {mounted
                ? new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Domain table helper with card-style header
function renderDomainTable(
  title: string,
  skills: { label: string; value?: string; isAverage?: boolean }[],
  color: string,
  compact?: boolean
) {
  const labelSize = compact ? 'text-[9px]' : 'text-[10px]';
  const badgeSize = compact ? 'text-[8px]' : 'text-[9px]';
  const rowPy = compact ? 'py-0.5' : 'py-1';
  return (
    <div className="border rounded-lg bg-gray-50/50" style={{ borderColor: '#e2e8f0' }}>
      <div className="rounded-t-lg px-2 pt-1.5 pb-1" style={{ backgroundColor: `${color}08` }}>
        <h5 className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-bold text-center uppercase tracking-wider`}
          style={{ color }}>
          {title}
        </h5>
      </div>
      <div className="space-y-0.5 p-1.5">
        {skills.map((skill) => (
          <div
            key={skill.label}
            className={cn(
              `flex items-center justify-between ${labelSize} px-1.5 ${rowPy} rounded-sm`,
              skill.isAverage ? 'font-bold border-t mt-0.5 pt-1' : ''
            )}
            style={skill.isAverage ? { color, borderTopColor: '#e2e8f0' } : undefined}
          >
            <span className="text-gray-700">{skill.label}</span>
            {skill.value ? (
              <span className={`px-1.5 py-0.5 rounded ${badgeSize} font-bold border whitespace-nowrap ${getRatingBadgeClass(skill.value)}`}>
                {ratingToLabel(skill.value)} ({skill.value})
              </span>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </div>
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

  // Auto-calculated averages
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-5 text-emerald-600" />
            Edit Domain Grades — {reportCard.student.name}
          </DialogTitle>
          <DialogDescription>
            Rate each skill from Poor (1) to Excellent (5). Averages are auto-calculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
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
                <div className="h-8 rounded-md border bg-emerald-50 flex items-center justify-center text-sm font-bold text-emerald-700">
                  {cogAvg ? `${ratingToLabel(cogAvg)} (${cogAvg})` : '—'}
                </div>
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
                <div className="h-8 rounded-md border bg-emerald-50 flex items-center justify-center text-sm font-bold text-emerald-700">
                  {psyAvg ? `${ratingToLabel(psyAvg)} (${psyAvg})` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Affective Domain */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-bold mb-3" style={{ color }}>Affective Domain</h4>
            <div className="grid grid-cols-2 gap-3">
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
                <div className="h-8 rounded-md border bg-emerald-50 flex items-center justify-center text-sm font-bold text-emerald-700">
                  {affAvg ? `${ratingToLabel(affAvg)} (${affAvg})` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Comments and Signatures */}
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-bold" style={{ color }}>Comments &amp; Signatures</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Class Teacher Name</Label>
                <Input className="h-8 text-sm" value={classTeacherName} onChange={e => setClassTeacherName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Class Teacher Comment</Label>
                <Textarea className="text-sm" rows={2} value={classTeacherComment} onChange={e => setClassTeacherComment(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Principal Name</Label>
                <Input className="h-8 text-sm" value={principalName} onChange={e => setPrincipalName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Principal Comment</Label>
                <Textarea className="text-sm" rows={2} value={principalComment} onChange={e => setPrincipalComment(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
            Save Domain Grades
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Component ----

export function ReportCardView() {
  const { currentUser, selectedSchoolId: storeSchoolId } = useAppStore();

  // State
  const [classes, setClasses] = useState<{ id: string; name: string; section?: string }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string; order: number; isCurrent: boolean }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; admissionNo: string }[]>([]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const [generating, setGenerating] = useState(false);
  const [reportCards, setReportCards] = useState<ReportCardData[]>([]);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const [teacherComment, setTeacherComment] = useState('');
  const [principalComment, setPrincipalComment] = useState('');

  // Domain grade editor
  const [domainEditorOpen, setDomainEditorOpen] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const schoolId = storeSchoolId || currentUser.schoolId;


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

  // Generate report cards
  const handleGenerate = useCallback(async () => {
    if (!schoolId || !selectedClassId || !selectedTermId) {
      toast.error('Please select class and term');
      return;
    }
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
    finally { setGenerating(false); }
  }, [schoolId, selectedClassId, selectedTermId, selectedStudentId]);

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

  // Publish/Unpublish
  const handleTogglePublish = useCallback(async () => {
    if (reportCards.length === 0 || !reportCards[currentIndex]) return;
    const rc = reportCards[currentIndex];
    const newStatus = !rc.isPublished;
    try {
      const res = await fetch(`/api/report-cards/${rc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: newStatus }),
      });
      if (res.ok) {
        toast.success(newStatus ? 'Report card published' : 'Report card unpublished');
        setReportCards(prev => prev.map((card, i) => i === currentIndex ? { ...card, isPublished: newStatus } : card));
      }
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to update publish status'); }
  }, [reportCards, currentIndex]);

  // Print
  const handlePrint = useCallback(() => { window.print(); }, []);

  // Download PDF
  const [sendingParentEmail, setSendingParentEmail] = useState(false);
  const [whatsappUrls, setWhatsappUrls] = useState<{name: string; phone: string; url: string}[]>([]);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);

  const handleDownloadPdf = useCallback(async (reportCardId: string) => {
    if (!reportCardId) { toast.error('No report card selected'); return; }
    try {
      const res = await fetch(`/api/report-cards/${reportCardId}/pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${reportCardId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PDF'); }
  }, []);

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

  // Handle domain grade save callback
  const handleDomainGradeSave = useCallback((updatedCard: ReportCardData) => {
    setReportCards(prev => prev.map((card, i) => i === currentIndex ? updatedCard : card));
  }, [currentIndex]);

  // Filter students by search
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admissionNo.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const currentCard = reportCards[currentIndex];
  const primaryColor = meta?.school?.primaryColor || '#059669';

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
        <ReportCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4 print:p-0 print:m-0">
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="size-6 text-emerald-600" />
            Report Cards
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate and manage student report cards</p>
        </div>
        {reportCards.length > 0 && (
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setSelectedStudentId(''); handleGenerate(); }}>
              <RefreshCw className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Regenerate All</span>
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(currentCard?.id || '')} disabled={!currentCard?.id}>
              <Download className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSendToParent(currentCard?.id || '')} disabled={!currentCard?.id || sendingParentEmail}>
              <Send className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{sendingParentEmail ? 'Sending...' : 'Send to Parents'}</span>
            </Button>
            {currentCard?.isThirdTerm && (
              <Button variant="outline" size="sm" onClick={() => setDomainEditorOpen(true)} style={{ borderColor: primaryColor, color: primaryColor }}>
                <Pencil className="size-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Edit Domain Grades</span>
              </Button>
            )}
            <Button size="sm" variant={currentCard?.isPublished ? 'outline' : 'default'} onClick={handleTogglePublish}>
              {currentCard?.isPublished ? <><EyeOff className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Unpublish</span></> : <><Eye className="size-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Publish</span></>}
            </Button>
          </div>
        )}
      </div>

      {/* Configuration Card - Hidden in print */}
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
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-gray-400" />
                <Input placeholder="Search by name or ID..." className="pl-8 h-9 text-sm" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} disabled={!selectedClassId} />
              </div>
              {studentSearch && filteredStudents.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto bg-white mt-1 shadow-lg">
                  {filteredStudents.slice(0, 8).map(s => (
                    <button key={s.id} className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors', selectedStudentId === s.id ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700')} onClick={() => { setSelectedStudentId(s.id); setStudentSearch(''); }}>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gray-400 ml-2">({s.admissionNo})</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedStudentId && (
                <div className="flex items-center justify-between bg-emerald-50 rounded px-2 py-1 mt-1">
                  <span className="text-xs text-emerald-700 truncate">{students.find(s => s.id === selectedStudentId)?.name}</span>
                  <button onClick={() => { setSelectedStudentId(''); setStudentSearch(''); }} className="text-emerald-500 hover:text-emerald-700"><XCircle className="size-3" /></button>
                </div>
              )}
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

      {!generating && reportCards.length > 0 && meta && currentCard && (
        <>
          {/* Student Navigation */}
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
              <Badge variant={currentCard?.isPublished ? 'default' : 'secondary'}>
                {currentCard?.isPublished ? (<><CheckCircle2 className="size-3 mr-1" /> Published</>) : (<><XCircle className="size-3 mr-1" /> Draft</>)}
              </Badge>
              <Badge variant="outline">{meta.class.name}{meta.class.section ? ` (${meta.class.section})` : ''}</Badge>
              <Badge variant="outline">{meta.term.name}</Badge>
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

          {/* Report Card */}
          <div ref={printRef} className="overflow-x-auto print:overflow-visible">
            <ReportCardRenderer currentCard={currentCard} meta={meta} primaryColor={primaryColor} />
          </div>

          {/* Comment Editor - Hidden in print */}
          <Card className="print:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Edit Remarks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Teacher&apos;s Comment</Label>
                  <Textarea placeholder="Enter class teacher's remarks..." value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)} rows={3} />
                  <Button size="sm" variant="outline" onClick={() => handleSaveComment('teacher')}>Save Teacher Comment</Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Principal&apos;s Comment</Label>
                  <Textarea placeholder="Enter principal's remarks..." value={principalComment} onChange={(e) => setPrincipalComment(e.target.value)} rows={3} />
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
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="size-5 text-emerald-600" />
              Share via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Click a parent&apos;s WhatsApp link below to open WhatsApp with a pre-filled report card message. You will need to press Send manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
