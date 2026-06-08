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
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getTermLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('first') || lower.includes('1st')) return 'First';
  if (lower.includes('second') || lower.includes('2nd')) return 'Second';
  if (lower.includes('third') || lower.includes('3rd')) return 'Third';
  return name;
}

const gradeColorMap: Record<string, string> = {
  'A1': '#0b5e42', 'A': '#059669', 'A+': '#059669',
  'B2': '#059669', 'B': '#3b82f6', 'B3': '#3b82f6',
  'C4': '#f59e0b', 'C': '#f59e0b', 'C5': '#ea580c', 'C6': '#d97706',
  'D7': '#ef4444', 'D': '#ef4444',
  'E8': '#dc2626', 'E': '#dc2626',
  'F9': '#991b1b', 'F': '#991b1b',
};

function gradeColor(grade: string): string {
  return gradeColorMap[grade] || '#6b7280';
}

function getGradeBgClass(grade: string): string {
  switch (grade) {
    case 'A': case 'A+': case 'A1': return 'bg-emerald-100 text-emerald-700';
    case 'B': case 'B+': case 'B2': case 'B3': return 'bg-blue-100 text-blue-700';
    case 'C': case 'C4': case 'C5': case 'C6': return 'bg-amber-100 text-amber-700';
    case 'D': case 'D7': return 'bg-orange-100 text-orange-700';
    case 'E': case 'E8': return 'bg-red-100 text-red-700';
    case 'F': case 'F9': return 'bg-red-200 text-red-900';
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

function adjustHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const cl = (x: number) => Math.max(0, Math.min(255, x));
  const r = cl(parseInt(h.slice(0, 2), 16) + amount);
  const g = cl(parseInt(h.slice(2, 4), 16) + amount);
  const b = cl(parseInt(h.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ---- Loading Skeleton ----

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

// ---- Report Card Renderer ----

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

  const school = meta.school;
  const settings = meta.settings;
  const term = meta.term;
  const cls = meta.class;
  const color = primaryColor || school?.primaryColor || '#059669';
  const lightColor = `${color}80`;
  const extraLightColor = `${color}15`;
  const accentColor = '#f59e0b';

  const totalMarks = Math.round(currentCard.grandTotal || 0);
  const totalObtainable = currentCard.grandPossible || currentCard.subjectResults.length * 100;
  const avgScore = currentCard.averageScore || 0;
  const totalSubjects = currentCard.numSubjects || currentCard.subjectResults.length;
  const classRank = currentCard.classRank;
  const totalStudents = currentCard.totalStudents || 0;
  const overallGrade = currentCard.overallGrade?.grade || currentCard.grade || '—';
  const overallRemark = currentCard.overallGrade?.remark || '—';
  const studentName = currentCard.student.name || '—';
  const initials = studentName.split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase() || 'NA';

  const ord = (n: number) => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
  };
  const positionText = classRank
    ? `${classRank}${ord(classRank)} of ${totalStudents || '—'}`
    : '—';

  const teacherComment = currentCard.teacherComment || currentCard.domainGrade?.classTeacherComment || '—';
  const teacherName = currentCard.domainGrade?.classTeacherName || cls.classTeacher || 'Form Master';
  const principalCommentText = currentCard.principalComment || currentCard.domainGrade?.principalComment || '—';
  const principalName = currentCard.domainGrade?.principalName || settings?.principalName || 'Principal';

  // Grade distribution for analysis
  const gradeDistribution: Record<string, number> = {};
  for (const sr of currentCard.subjectResults) {
    gradeDistribution[sr.grade] = (gradeDistribution[sr.grade] || 0) + 1;
  }
  const gradeOrder = ['A1', 'A', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];
  const maxCount = Math.max(...Object.values(gradeDistribution), 1);
  const visibleGrades = gradeOrder.filter(g => gradeDistribution[g] > 0).slice(0, 6);

  // Affective domain keys
  const affectiveKeys = currentCard.domainGrade?.affective || {};
  const aItems: { key: string; label: string }[] = [
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'neatness', label: 'Neatness' },
    { key: 'honesty', label: 'Honesty' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'cooperation', label: 'Cooperation' },
    { key: 'attentiveness', label: 'Attentiveness' },
    { key: 'obedience', label: 'Obedience' },
    { key: 'selfControl', label: 'Self Control' },
    { key: 'politeness', label: 'Politeness' },
  ];

  // Psychomotor keys
  const psyKeys = currentCard.domainGrade?.psychomotor || {};
  const pItems: { key: string; label: string }[] = [
    { key: 'handwriting', label: 'Handwriting' },
    { key: 'sports', label: 'Sports' },
    { key: 'drawing', label: 'Drawing' },
    { key: 'practical', label: 'Practical' },
  ];

  const genDate = mounted
    ? new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const nextTermDate = settings?.nextTermBegins ? formatDate(settings.nextTermBegins) : '';

  return (
    <div
      className="print-container w-[210mm] min-h-[297mm] bg-white shadow-2xl rounded-none print:shadow-none flex flex-col"
      style={{ fontFamily: 'Arial, Tahoma, sans-serif' }}
    >
      {/* TOP GRADIENT BAR */}
      <div
        className="h-[3px] shrink-0"
        style={{ background: `linear-gradient(90deg, ${color}, ${lightColor})` }}
      />

      <div className="px-[10px] py-[6px] print:px-[10px] print:py-[6px] flex flex-col gap-[4px] flex-1">

        {/* HEADER */}
        <div className="flex items-center gap-[12px]">
          <div
            className="flex items-center justify-center shrink-0 rounded-full"
            style={{ width: 52, height: 52, background: extraLightColor, border: `1.5px solid ${lightColor}` }}
          >
            <div className="rounded-full bg-white flex items-center justify-center overflow-hidden" style={{ width: 44, height: 44 }}>
              {school.logo ? (
                <img src={school.logo} alt={school.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-base font-bold" style={{ color }}>
                  {(school.name || 'S').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[11px] font-bold uppercase tracking-[0.5px] text-gray-900 leading-tight m-0">
              {(school.name?.toUpperCase() || 'School Name').slice(0, 55)}
            </h1>
            {(school.motto || settings?.schoolMotto) && (
              <p className="text-[8px] italic text-gray-600 leading-tight mt-[1px] mb-0">
                — {school.motto || settings?.schoolMotto} —
              </p>
            )}
            {school.address && <p className="text-[8px] text-gray-500 leading-tight mt-[1px] mb-0">{school.address}</p>}
            {(school.phone || school.email) && (
              <p className="text-[7px] text-gray-400 mt-[1px] mb-0">
                {[school.phone, school.email].filter(Boolean).join(' | ')}
              </p>
            )}
          </div>
        </div>

        {/* TITLE */}
        <div className="text-center py-[2px]">
          <span className="text-[10px] font-bold tracking-[0.5px]" style={{ color }}>
            {term.academicYear || settings?.academicSession ? `${settings?.academicSession || term.academicYear} — ` : ''}{getTermLabel(term.name)} Term Student&apos;s Report
          </span>
        </div>

        {/* STUDENT INFO */}
        <div className="border border-gray-200 rounded-lg px-[8px] py-[4px] relative" style={{ minHeight: 55 }}>
          <div className="absolute top-0 left-0 right-0 h-[8px] rounded-t-lg" style={{ backgroundColor: `${color}08` }} />
          <table className="w-full text-[8px] mt-[2px]">
            <tbody>
              <tr>
                <td className="px-[4px] py-[1px] w-1/2">
                  <span className="text-gray-500">Name:</span>{' '}
                  <span className="font-semibold text-gray-900">{studentName}</span>
                </td>
                <td className="px-[4px] py-[1px]">
                  <span className="text-gray-500">Session:</span>{' '}
                  <span className="font-semibold text-gray-900">{settings?.academicSession || term.academicYear || '—'}</span>
                </td>
              </tr>
              <tr>
                <td className="px-[4px] py-[1px]">
                  <span className="text-gray-500">Class:</span>{' '}
                  <span className="font-semibold text-gray-900">{cls.name || '—'}{cls.section ? ` (${cls.section})` : ''}</span>
                </td>
                <td className="px-[4px] py-[1px]">
                  <span className="text-gray-500">Term:</span>{' '}
                  <span className="font-semibold text-gray-900">{getTermLabel(term.name)}</span>
                </td>
              </tr>
              <tr>
                <td className="px-[4px] py-[1px]">
                  <span className="text-gray-500">Gender:</span>{' '}
                  <span className="font-semibold text-gray-900">{currentCard.student.gender || 'N/A'}</span>
                </td>
                <td className="px-[4px] py-[1px]">
                  <span className="text-gray-500">D.O.B:</span>{' '}
                  <span className="font-semibold text-gray-900">{formatDate(currentCard.student.dateOfBirth)}</span>
                </td>
              </tr>
              <tr>
                <td className="px-[4px] py-[1px]">
                  <span className="text-gray-500">Admission No:</span>{' '}
                  <span className="font-semibold text-gray-900">{currentCard.student.admissionNo || '—'}</span>
                </td>
                <td className="px-[4px] py-[1px]">
                  <span className="text-gray-500">Parent(s):</span>{' '}
                  <span className="font-semibold text-gray-900">{currentCard.student.parents || '—'}</span>
                </td>
              </tr>
            </tbody>
          </table>
          {/* Photo */}
          <div
            className="absolute right-[3px] top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center overflow-hidden"
            style={{ width: 42, height: 42, background: extraLightColor, border: `1px solid ${color}` }}
          >
            {currentCard.student.photo ? (
              <img src={currentCard.student.photo} alt={studentName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold" style={{ color }}>{initials}</span>
            )}
          </div>
        </div>

        {/* SCORE TABLE */}
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className="px-[6px] py-[3px] text-white font-semibold text-center w-[16px]" style={{ background: color }}>S/N</th>
                <th className="px-[6px] py-[3px] text-left text-white font-semibold" style={{ background: color }}>SUBJECT</th>
                <th className="px-[6px] py-[3px] text-center text-white font-semibold" style={{ background: color }}>MID-TERM</th>
                <th className="px-[6px] py-[3px] text-center text-white font-semibold" style={{ background: color }}>EXAM</th>
                <th className="px-[6px] py-[3px] text-center text-white font-semibold" style={{ background: color }}>TOTAL</th>
                <th className="px-[6px] py-[3px] text-center text-white font-semibold" style={{ background: color }}>GRADE</th>
                <th className="px-[6px] py-[3px] text-center text-white font-semibold" style={{ background: color }}>REMARK</th>
              </tr>
            </thead>
            <tbody>
              {currentCard.subjectResults.map((sr, i) => (
                <tr key={sr.subjectId} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td className="px-[4px] py-[2px] text-center text-gray-500 text-[9px] border border-gray-200">{i + 1}</td>
                  <td className="px-[4px] py-[2px] font-medium text-gray-900 text-[9px] border border-gray-200">{sr.subjectName}</td>
                  <td className="px-[4px] py-[2px] text-center text-gray-600 text-[9px] border border-gray-200">{Math.round(sr.caScore)}</td>
                  <td className="px-[4px] py-[2px] text-center text-gray-600 text-[9px] border border-gray-200">{Math.round(sr.examScore)}</td>
                  <td className="px-[4px] py-[2px] text-center font-bold text-gray-900 text-[9px] border border-gray-200">{Math.round(sr.totalScore)}</td>
                  <td className="px-[4px] py-[2px] text-center border border-gray-200">
                    <span className={`inline-block px-[5px] py-[1px] rounded-[3px] text-[8px] font-bold ${getGradeBgClass(sr.grade)}`}>{sr.grade}</span>
                  </td>
                  <td className="px-[4px] py-[2px] text-center text-gray-500 text-[8px] border border-gray-200">{sr.remark}</td>
                </tr>
              ))}
              {currentCard.subjectResults.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-gray-400 text-[9px] border border-gray-200">
                    No scores available for this term
                  </td>
                </tr>
              )}
            </tbody>
            {currentCard.subjectResults.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 600, background: `${color}08` }}>
                  <td colSpan={4} className="px-[6px] py-[3px] text-right text-gray-700 text-[9px] border border-gray-200">
                    TOTAL / {totalObtainable}
                  </td>
                  <td className="px-[6px] py-[3px] text-center font-bold text-gray-900 text-[9px] border border-gray-200">{totalMarks}</td>
                  <td className="px-[6px] py-[3px] text-center border border-gray-200">
                    <span className="inline-block px-[6px] py-[1px] rounded-[4px] font-bold text-[8px]" style={{ background: `${color}20`, color }}>{overallGrade}</span>
                  </td>
                  <td className="px-[6px] py-[3px] text-center text-gray-500 text-[8px] border border-gray-200">{overallRemark}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PERFORMANCE SUMMARY + GRADE ANALYSIS */}
        <div className="grid grid-cols-[2fr_3fr] gap-[3px]">
          <div className="border border-gray-200 rounded-lg">
            <div className="px-[6px] py-[3px] rounded-t-lg" style={{ background: `${color}08` }}>
              <span className="text-[9px] font-bold" style={{ color }}>Performance Summary</span>
            </div>
            <div className="px-[6px] py-[3px]">
              {([
                ['Total Marks Obtained', `${totalMarks}`, false],
                ['Total Marks Obtainable', `${totalObtainable}`, false],
                ['Average Score', `${avgScore.toFixed(2)}%`, true],
                ['Average Grade', overallGrade, true],
                ['Class Population', `${totalStudents || '—'}`, false],
                ['Position', positionText, true],
              ] as const).map(([label, value, bold], i) => (
                <div key={label} className="flex justify-between py-[1.5px] text-[8px]" style={i > 0 ? { borderTop: '0.5px solid #f1f5f9' } : undefined}>
                  <span className="text-gray-500">{label}</span>
                  <span style={{ fontWeight: bold ? 800 : 600, color: bold ? color : '#1e293b' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg">
            <div className="px-[6px] py-[3px] rounded-t-lg" style={{ background: `${accentColor}08` }}>
              <span className="text-[9px] font-bold" style={{ color: accentColor }}>Grade Analysis</span>
            </div>
            <div className="px-[6px] py-[3px]">
              {visibleGrades.length > 0 ? visibleGrades.map(grade => {
                const count = gradeDistribution[grade] || 0;
                const pct = maxCount > 0 ? count / maxCount : 0;
                const gc = gradeColor(grade);
                return (
                  <div key={grade} className="flex items-center gap-[3px] mb-[2px]">
                    <span className="text-[8px] font-bold" style={{ color: gc, width: 14, textAlign: 'right' }}>{grade}</span>
                    <div className="flex-1 h-[8px] rounded-[3px] bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-[3px]" style={{ width: `${pct * 100}%`, background: gc, opacity: 0.8 }} />
                    </div>
                    <span className="text-[8px] font-semibold text-gray-600" style={{ width: 12 }}>{count}</span>
                  </div>
                );
              }) : (
                <div className="text-[8px] text-gray-300 text-center py-1">No grade data</div>
              )}
            </div>
          </div>
        </div>

        {/* AFFECTIVE DOMAIN + PSYCHOMOTOR */}
        {currentCard.domainGrade && (
          <div className="grid grid-cols-2 gap-[3px]">
            <div className="border border-gray-200 rounded-lg">
              <div className="px-[6px] py-[3px] rounded-t-lg" style={{ background: `${color}08` }}>
                <span className="text-[9px] font-bold" style={{ color }}>Affective Domain</span>
              </div>
              <div className="px-[4px] py-[2px]">
                {aItems.map(({ key, label }) => {
                  const val = affectiveKeys[key];
                  return (
                    <div key={key} className="flex justify-between items-center py-[1.5px] px-[2px] text-[7px] border-b border-gray-50">
                      <span className="text-gray-600">{label}</span>
                      {val ? (
                        <span className={`inline-block px-[4px] py-[1px] rounded-[3px] text-[7px] font-semibold border ${getRatingBadgeClass(val)}`}>
                          {ratingToLabel(val)} ({val})
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[7px]">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg">
              <div className="px-[6px] py-[3px] rounded-t-lg" style={{ background: `${color}08` }}>
                <span className="text-[9px] font-bold" style={{ color }}>Psychomotor Skill</span>
              </div>
              <div className="px-[4px] py-[2px]">
                {pItems.map(({ key, label }) => {
                  const val = psyKeys[key];
                  return (
                    <div key={key} className="flex justify-between items-center py-[1.5px] px-[2px] text-[7px] border-b border-gray-50">
                      <span className="text-gray-600">{label}</span>
                      {val ? (
                        <span className={`inline-block px-[4px] py-[1px] rounded-[3px] text-[7px] font-semibold border ${getRatingBadgeClass(val)}`}>
                          {ratingToLabel(val)} ({val})
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[7px]">—</span>
                      )}
                    </div>
                  );
                })}
                <div className="px-[2px] pt-[2px] text-[7px] font-semibold text-gray-800 border-t border-gray-200 mt-[2px]">
                  Key: 5=Exc 4=V.Gd 3=Gd 2=Fair 1=Poor
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE + FORM MASTER'S REMARK */}
        <div className="grid grid-cols-[1fr_2fr] gap-[3px]">
          <div className="border border-gray-200 rounded-lg">
            <div className="px-[6px] py-[3px] rounded-t-lg" style={{ background: `${color}08` }}>
              <span className="text-[9px] font-bold" style={{ color }}>Attendance</span>
            </div>
            <div className="px-[6px] py-[2px]">
              {([
                ['Days Recorded', currentCard.attendance.totalDays],
                ['Present', currentCard.attendance.presentDays],
                ['Absent', currentCard.attendance.absentDays],
                ['Attendance Rate', `${currentCard.attendance.percentage}%`],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between py-[1.5px] text-[8px]">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg flex flex-col">
            <div className="px-[6px] py-[3px] rounded-t-lg" style={{ background: `${color}08` }}>
              <span className="text-[9px] font-bold" style={{ color }}>Form Master&apos;s Remark</span>
            </div>
            <div className="px-[6px] py-[3px] text-[8px] text-gray-600 flex-1">
              {teacherComment.substring(0, 120)}
            </div>
            <div className="border-t border-gray-200 px-[6px] py-[2px] mt-auto">
              <div className="border-t border-dashed border-gray-300 w-[60%] my-[2px]" />
              <span className="text-[8px] font-semibold text-gray-900">{teacherName}</span>
              <span className="text-[7px] text-gray-400"> — Form Master</span>
            </div>
          </div>
        </div>

        {/* PRINCIPAL'S REMARK */}
        <div className="border border-gray-200 rounded-lg">
          <div className="px-[6px] py-[3px] rounded-t-lg" style={{ background: `${accentColor}08` }}>
            <span className="text-[9px] font-bold" style={{ color: accentColor }}>Principal&apos;s Remark</span>
          </div>
          <div className="flex justify-between items-end px-[6px] py-[3px]">
            <div className="text-[8px] text-gray-600 flex-1">{principalCommentText.substring(0, 150)}</div>
            <div className="text-right shrink-0 ml-[8px]">
              <div className="border-t border-dashed border-gray-300 w-[80px] mb-[2px] ml-auto" />
              <div className="text-[8px] font-semibold text-gray-900">{principalName}</div>
              <div className="text-[7px] text-gray-400">Principal</div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-between items-center text-[8px] text-gray-500 pt-[4px] mt-auto border-t border-gray-200">
          <span>Next Term: <span className="font-semibold" style={{ color }}>{nextTermDate || '—'}</span></span>
          <span className="text-[6px] text-gray-300 tracking-[2px] font-semibold uppercase">SKOOLAR · ACADEMIC MANAGEMENT SYSTEM</span>
          <span>Generated: {genDate}</span>
        </div>
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

  // Download PNG
  const handleDownloadPng = useCallback(async (reportCardId: string) => {
    if (!reportCardId) { toast.error('No report card selected'); return; }
    try {
      const res = await fetch(`/api/report-cards/${reportCardId}/pdf?format=png`);
      if (!res.ok) throw new Error('Failed to generate PNG');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${reportCardId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PNG'); }
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
            <Button variant="outline" size="sm" onClick={() => handleDownloadPng(currentCard?.id || '')} disabled={!currentCard?.id}>
              <FileText className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Download PNG</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSendToParent(currentCard?.id || '')} disabled={!currentCard?.id || sendingParentEmail}>
              <Send className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{sendingParentEmail ? 'Sending...' : 'Send to Parents'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDomainEditorOpen(true)} style={{ borderColor: primaryColor, color: primaryColor }}>
              <Pencil className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Edit Domain Grades</span>
            </Button>
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
          <div ref={printRef} className="overflow-x-auto overflow-y-auto print:overflow-visible max-h-[80vh] md:max-h-none w-full max-w-full">
            <div className="mx-auto w-fit">
              <ReportCardRenderer currentCard={currentCard} meta={meta} primaryColor={primaryColor} />
            </div>
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
