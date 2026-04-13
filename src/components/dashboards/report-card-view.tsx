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
} from 'lucide-react';
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

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-600 font-bold';
    case 'B': return 'text-blue-600 font-bold';
    case 'C': return 'text-amber-600 font-bold';
    case 'D': return 'text-orange-600 font-bold';
    case 'E': return 'text-red-500 font-bold';
    case 'F': return 'text-red-700 font-bold';
    default: return 'text-gray-600';
  }
}

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
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ---- Shared Report Card Renderer ----
export function ReportCardRenderer({
  currentCard,
  meta,
  primaryColor,
}: {
  currentCard: ReportCardData;
  meta: MetaData;
  primaryColor?: string;
}) {
  const color = primaryColor || meta?.school?.primaryColor || '#059669';
  const school = meta.school;
  const settings = meta.settings;
  const term = meta.term;
  const cls = meta.class;
  const scoreTypes = meta.scoreTypes || [];

  // Determine column headers
  const hasDynamicColumns = scoreTypes.length > 0;
  const scoreTypeColumns = hasDynamicColumns ? scoreTypes : [];
  const numDynamicCols = scoreTypeColumns.length;
  const totalTableCols = 2 + numDynamicCols + 2 + 1; // S/N + Subject + score types + Total + Grade + Remark

  return (
    <div className="bg-white shadow-2xl rounded-lg overflow-hidden border" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* HEADER */}
      <div className="relative">
        <div className="h-2" style={{ backgroundColor: color }} />
        <div className="px-6 pt-4 pb-3">
          <div className="flex items-center justify-center gap-4">
            {school.logo ? (
              <img src={school.logo} alt={school.name} className="h-16 w-16 rounded-full object-cover border-2" style={{ borderColor: color }} />
            ) : (
              <div className="h-16 w-16 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: color }}>
                {school.name.charAt(0)}
              </div>
            )}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 tracking-wide">{school.name.toUpperCase()}</h1>
              {school.address && <p className="text-xs text-gray-500">{school.address}</p>}
              {(school.phone || school.email) && (
                <p className="text-xs text-gray-500">
                  {[school.phone, school.email, school.website].filter(Boolean).join(' | ')}
                </p>
              )}
              {(school.motto || settings?.schoolMotto) && (
                <p className="text-xs italic mt-0.5" style={{ color: color }}>
                  &ldquo;{school.motto || settings?.schoolMotto}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="text-center pb-3">
          {settings?.academicSession && (
            <p className="text-xs text-gray-500 mb-1">Academic Session: {settings.academicSession}</p>
          )}
          <div className="inline-block px-6 py-2 text-white font-bold tracking-widest rounded-sm" style={{ backgroundColor: color }}>
            END OF {getTermLabel(term.name)} TERM REPORT CARD
          </div>
          <p className="text-xs text-gray-500 mt-1">{term.academicYear}</p>
        </div>
      </div>

      {/* STUDENT INFO */}
      <div className="mx-6 mb-4">
        <div className="border-2 rounded-lg p-4" style={{ borderColor: color + '40' }}>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">Student Name:</span>
                  <p className="font-semibold text-gray-900">{currentCard.student.name}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Admission No:</span>
                  <p className="font-semibold text-gray-900">{currentCard.student.admissionNo}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Class:</span>
                  <p className="font-semibold text-gray-900">{cls.name}{cls.section ? ` (${cls.section})` : ''}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Gender:</span>
                  <p className="font-semibold text-gray-900">{currentCard.student.gender || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Date of Birth:</span>
                  <p className="font-semibold text-gray-900">{formatDate(currentCard.student.dateOfBirth)}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Blood Group:</span>
                  <p className="font-semibold text-gray-900">{currentCard.student.bloodGroup || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">No. in Class:</span>
                  <p className="font-semibold text-gray-900">{currentCard.totalStudents || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Position:</span>
                  <p className="font-semibold" style={{ color }}>
                    {currentCard.student.classPosition || currentCard.classRank
                      ? `${currentCard.classRank}${currentCard.classRank === 1 ? 'st' : currentCard.classRank === 2 ? 'nd' : currentCard.classRank === 3 ? 'rd' : 'th'} out of ${currentCard.totalStudents || '—'}`
                      : '—'
                    }
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Term Begins:</span>
                  <p className="font-semibold text-gray-900">{formatDate(term.startDate)}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Term Ends:</span>
                  <p className="font-semibold text-gray-900">{formatDate(term.endDate)}</p>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              {currentCard.student.photo ? (
                <img src={currentCard.student.photo} alt={currentCard.student.name} className="h-24 w-24 rounded-full object-cover border-2" style={{ borderColor: color + '60' }} />
              ) : (
                <div className="h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-bold" style={{ backgroundColor: color + '30', color }}>
                  {currentCard.student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SCORE TABLE */}
      <div className="mx-6 mb-4">
        <div className="border-2 rounded-lg overflow-hidden" style={{ borderColor: color + '30' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: color }}>
                  <th className="py-2.5 px-2 text-left text-white font-semibold text-xs w-10">S/N</th>
                  <th className="py-2.5 px-2 text-left text-white font-semibold text-xs">Subject</th>
                  {hasDynamicColumns ? (
                    scoreTypeColumns.map(st => (
                      <th key={st.id} className="py-2.5 px-2 text-center text-white font-semibold text-xs whitespace-nowrap">
                        {st.name} ({st.weight})
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="py-2.5 px-2 text-center text-white font-semibold text-xs w-20">CA Score (40)</th>
                      <th className="py-2.5 px-2 text-center text-white font-semibold text-xs w-20">Exam (60)</th>
                    </>
                  )}
                  <th className="py-2.5 px-2 text-center text-white font-semibold text-xs w-20">Total (100)</th>
                  <th className="py-2.5 px-2 text-center text-white font-semibold text-xs w-12">Grade</th>
                  <th className="py-2.5 px-2 text-center text-white font-semibold text-xs w-20">Remark</th>
                </tr>
              </thead>
              <tbody>
                {currentCard.subjectResults.map((sr, i) => (
                  <tr
                    key={sr.subjectId}
                    className={cn(
                      'border-b last:border-b-0',
                      i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    )}
                  >
                    <td className="py-2 px-2 text-xs text-gray-600">{i + 1}</td>
                    <td className="py-2 px-2 text-xs font-medium text-gray-900">{sr.subjectName}</td>
                    {hasDynamicColumns ? (
                      scoreTypeColumns.map(st => (
                        <td key={st.id} className="py-2 px-2 text-xs text-center text-gray-700">
                          {sr.scoresByType?.[st.id] != null ? Math.round(sr.scoresByType[st.id]) : '—'}
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="py-2 px-2 text-xs text-center text-gray-700">{Math.round(sr.caScore)}</td>
                        <td className="py-2 px-2 text-xs text-center text-gray-700">{Math.round(sr.examScore)}</td>
                      </>
                    )}
                    <td className="py-2 px-2 text-xs text-center font-bold text-gray-900">{Math.round(sr.totalScore)}</td>
                    <td className="py-2 px-2 text-xs text-center">
                      <span className={getGradeColor(sr.grade)}>{sr.grade}</span>
                    </td>
                    <td className="py-2 px-2 text-xs text-center text-gray-600">{sr.remark}</td>
                  </tr>
                ))}
                {currentCard.subjectResults.length === 0 && (
                  <tr>
                    <td colSpan={totalTableCols} className="py-6 text-center text-gray-400 text-sm">
                      No scores available for this term
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-bold" style={{ backgroundColor: color + '15' }}>
                  <td colSpan={2 + numDynamicCols} className="py-2.5 px-2 text-xs text-right text-gray-700">
                    Total Score / {currentCard.subjectResults.length * 100}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-center text-gray-900">
                    {Math.round(currentCard.grandTotal)}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-center">
                    <span style={{ color, fontWeight: 700 }}>
                      {currentCard.overallGrade?.grade || currentCard.grade || '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-xs text-center text-gray-700">
                    {currentCard.overallGrade?.remark || '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* GRADE SUMMARY */}
      <div className="mx-6 mb-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Score', value: String(Math.round(currentCard.grandTotal)), sub: `out of ${currentCard.subjectResults.length * 100}` },
            { label: 'Average', value: `${currentCard.averageScore.toFixed(1)}%`, sub: `${currentCard.numSubjects} subjects` },
            { label: 'Grade', value: currentCard.overallGrade?.grade || currentCard.grade || '—', sub: currentCard.overallGrade?.remark || '—' },
            { label: 'Position', value: String(currentCard.classRank || '—'), sub: `out of ${currentCard.totalStudents || '—'}` },
          ].map(item => (
            <div key={item.label} className="border-2 rounded-lg p-3 text-center" style={{ borderColor: color + '30', backgroundColor: color + '08' }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{item.label}</p>
              <p className="text-xl font-bold mt-0.5" style={{ color }}>{item.value}</p>
              <p className="text-[10px] text-gray-400">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ATTENDANCE + GRADING KEY */}
      <div className="mx-6 mb-4 grid grid-cols-2 gap-3">
        <div className="border-2 rounded-lg p-4" style={{ borderColor: color + '30' }}>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>Attendance Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total School Days:</span>
              <span className="font-semibold">{currentCard.attendance.totalDays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Days Present:</span>
              <span className="font-semibold text-emerald-600">{currentCard.attendance.presentDays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Days Absent:</span>
              <span className="font-semibold text-red-500">{currentCard.attendance.absentDays}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Attendance %:</span>
              <span className="font-bold" style={{ color }}>{currentCard.attendance.percentage}%</span>
            </div>
          </div>
        </div>
        <div className="border-2 rounded-lg p-4" style={{ borderColor: color + '30' }}>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>Grading Key</h4>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {[
              { grade: 'A', range: '70 - 100', color: 'bg-emerald-100 text-emerald-700' },
              { grade: 'B', range: '60 - 69', color: 'bg-blue-100 text-blue-700' },
              { grade: 'C', range: '50 - 59', color: 'bg-amber-100 text-amber-700' },
              { grade: 'D', range: '40 - 49', color: 'bg-orange-100 text-orange-700' },
              { grade: 'E', range: '30 - 39', color: 'bg-red-100 text-red-600' },
              { grade: 'F', range: '0 - 29', color: 'bg-red-200 text-red-800' },
            ].map(g => (
              <div key={g.grade} className={cn('px-2 py-1 rounded text-center font-medium', g.color)}>
                <span className="font-bold">{g.grade}</span> ({g.range})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TEACHER & PRINCIPAL REMARKS */}
      <div className="mx-6 mb-4 grid grid-cols-2 gap-3">
        <div className="border-2 rounded-lg p-4" style={{ borderColor: color + '30' }}>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>Class Teacher&apos;s Remarks</h4>
          <p className="text-xs italic text-gray-700 min-h-[60px]">
            {currentCard.teacherComment || (cls.classTeacher ? `Comments by ${cls.classTeacher} pending.` : 'No comment yet.')}
          </p>
          <div className="mt-4">
            <div className="border-b border-dashed border-gray-300 h-8" />
            <p className="text-[10px] text-gray-500 text-center mt-1">{cls.classTeacher || 'Class Teacher'}</p>
          </div>
        </div>
        <div className="border-2 rounded-lg p-4" style={{ borderColor: color + '30' }}>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>Principal&apos;s Remarks</h4>
          <p className="text-xs italic text-gray-700 min-h-[60px]">
            {currentCard.principalComment || (settings?.principalName ? `Comments by ${settings.principalName} pending.` : 'No comment yet.')}
          </p>
          <div className="mt-4">
            <div className="border-b border-dashed border-gray-300 h-8" />
            <p className="text-[10px] text-gray-500 text-center mt-1">{settings?.principalName || 'Principal'}</p>
          </div>
        </div>
      </div>

      {/* 3RD TERM - DOMAIN GRADING */}
      {currentCard.isThirdTerm && currentCard.domainGrade && (
        <div className="mx-6 mb-4">
          <div className="border-2 rounded-lg p-4" style={{ borderColor: color + '40' }}>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3 text-center" style={{ color }}>
              Affective, Psychomotor &amp; Cognitive Domain Grading
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {renderDomainTable('COGNITIVE DOMAIN', [
                { label: 'Reasoning', value: currentCard.domainGrade.cognitive.reasoning },
                { label: 'Memory', value: currentCard.domainGrade.cognitive.memory },
                { label: 'Concentration', value: currentCard.domainGrade.cognitive.concentration },
                { label: 'Problem Solving', value: currentCard.domainGrade.cognitive.problemSolving },
                { label: 'Initiative', value: currentCard.domainGrade.cognitive.initiative },
                { label: 'Average', value: currentCard.domainGrade.cognitive.average, isAverage: true },
              ], color)}
              {renderDomainTable('PSYCHOMOTOR DOMAIN', [
                { label: 'Handwriting', value: currentCard.domainGrade.psychomotor.handwriting },
                { label: 'Sports', value: currentCard.domainGrade.psychomotor.sports },
                { label: 'Drawing', value: currentCard.domainGrade.psychomotor.drawing },
                { label: 'Practical', value: currentCard.domainGrade.psychomotor.practical },
                { label: 'Average', value: currentCard.domainGrade.psychomotor.average, isAverage: true },
              ], color)}
              {renderDomainTable('AFFECTIVE DOMAIN', [
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
              ], color)}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="mx-6 mb-4">
        <div className="border-t-2 pt-3" style={{ borderColor: color + '40' }}>
          <div className="flex items-center justify-between">
            <div>
              {settings?.nextTermBegins && (
                <p className="text-xs font-semibold text-gray-700">
                  Next Term Begins: <span style={{ color }}>{settings.nextTermBegins}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                Printed: {new Date().toLocaleString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Watermark */}
      <div className="bg-gray-100 py-1.5 px-4 text-center border-t">
        <p className="text-xs text-gray-300 opacity-60">
          Powered by Skoolar || Odebunmi Tawwāb
        </p>
      </div>
    </div>
  );
}

// Domain table helper
function renderDomainTable(
  title: string,
  skills: { label: string; value?: string; isAverage?: boolean }[],
  color: string
) {
  return (
    <div>
      <h5 className="text-[10px] font-bold text-center mb-1.5 uppercase tracking-wider" style={{ color }}>{title}</h5>
      <table className="w-full text-[11px] border rounded overflow-hidden">
        <thead>
          <tr style={{ backgroundColor: color + '20' }}>
            <th className="py-1 px-2 text-left font-semibold" style={{ color }}>Skill</th>
            <th className="py-1 px-2 text-center font-semibold w-16" style={{ color }}>Rating</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr
              key={skill.label}
              className={cn('border-t', skill.isAverage ? 'font-bold' : '')}
              style={skill.isAverage ? { backgroundColor: color + '10' } : {}}
            >
              <td className="py-1 px-2 text-gray-700">{skill.label}</td>
              <td className="py-1 px-2 text-center">
                {skill.value ? (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: color + '20', color }}>
                    {ratingToLabel(skill.value)} ({skill.value})
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

      // Try PUT first if we have an ID, otherwise POST
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

      // Update local report card data
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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

          {/* Comments and Names */}
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
  const [terms, setTerms] = useState<{ id: string; name: string; order: number }[]>([]);
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
          setTerms((json.data || json.terms || []).map((t: { id: string; name: string; order: number }) => ({ id: t.id, name: t.name, order: t.order })));
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
          <div className="grid grid-cols-3 gap-4">
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
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="size-6 text-emerald-600" />
            Report Cards
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate and manage student report cards</p>
        </div>
        {reportCards.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSelectedStudentId(''); handleGenerate(); }}>
              <RefreshCw className="size-3.5 mr-1.5" /> Regenerate All
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="size-3.5 mr-1.5" /> Print
            </Button>
            {currentCard?.isThirdTerm && (
              <Button variant="outline" size="sm" onClick={() => setDomainEditorOpen(true)} style={{ borderColor: primaryColor, color: primaryColor }}>
                <Pencil className="size-3.5 mr-1.5" /> Edit Domain Grades
              </Button>
            )}
            <Button size="sm" variant={currentCard?.isPublished ? 'outline' : 'default'} onClick={handleTogglePublish}>
              {currentCard?.isPublished ? (<><EyeOff className="size-3.5 mr-1.5" /> Unpublish</>) : (<><Eye className="size-3.5 mr-1.5" /> Publish</>)}
            </Button>
          </div>
        )}
      </div>

      {/* Configuration Card - Hidden in print */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div ref={printRef}>
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
    </div>
  );
}
