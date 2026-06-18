import { Resvg } from '@resvg/resvg-js';
import { GEIST_REGULAR_BASE64, GEIST_BOLD_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from '@/lib/id-card-utils/arabic-font-data';
import { getFontFiles } from '@/lib/font-loader';
import { PDFDocument } from 'pdf-lib';
import { A4 } from './constants';
import { generateSubjectBarChart, generateAttendanceGauge, generateDomainRadarChart } from './svg-charts';
import type { GradeThreshold } from '@/lib/grade-calculator';
import { getScoreDisplay } from './score-type-utils';
import { computeCumulativeAverage, type TermAverage } from './cumulative-averaging';
import { analyzeAttendanceCorrelation, generateAttendanceCorrelationSVG } from './attendance-correlation';

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  caScore: number;
  examScore: number;
  total: number;
  percentage: number;
  grade: string;
  remark: string;
  scoresByType?: Record<string, { raw: number; max: number; normalized: number }>;
}

export interface DomainData {
  cognitive: Record<string, string | null>;
  psychomotor: Record<string, string | null>;
  affective: Record<string, string | null>;
  classTeacherComment?: string | null;
  classTeacherName?: string | null;
  principalComment?: string | null;
  principalName?: string | null;
}

export interface ReportCardRenderInput {
  student: { name: string; admissionNo: string; gender?: string | null; dateOfBirth?: string | null; bloodGroup?: string | null; photoBase64?: string | null; parents?: string | null; age?: string | null };
  school: { name: string; logoBase64?: string | null; address?: string | null; motto?: string | null; phone?: string | null; email?: string | null; website?: string | null; primaryColor?: string; secondaryColor?: string };
  settings: { principalName?: string | null; nextTermBegins?: string | null; academicSession?: string | null };
  term: { name: string; order: number };
  cls: { name: string; section?: string | null };
  subjectResults: SubjectResult[];
  attendance: { daysPresent: number; daysAbsent: number; percentage: number; totalDays: number };
  domainGrade: DomainData;
  gradeScale: GradeThreshold[];
  totals: { grandTotal: number; averageScore: number; totalStudents: number; classRank?: number; overallGrade: string; overallRemark: string };
  teacherComment?: string | null;
  principalComment?: string | null;
  reportCardId?: string;
  watermarkText?: string | null;
  showChart?: boolean;
  showDomains?: boolean;
  showAttendance?: boolean;
  showLegend?: boolean;
  cumulativeTerms?: TermAverage[];
  showCumulative?: boolean;
  showCorrelation?: boolean;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getGradeColor(grade: string): string {
  const map: Record<string, string> = { 
    'A+': '#065f46', 'A': '#059669', 'A-': '#10b981', 
    'B+': '#0369a1', 'B': '#0284c7', 'B-': '#38bdf8',
    'C+': '#d97706', 'C': '#f59e0b', 'C-': '#fbbf24',
    'D+': '#ea580c', 'D': '#f97316', 'E': '#dc2626', 'F': '#991b1b' 
  };
  return map[grade] || '#6b7280';
}

function getGradeBgColor(grade: string): string {
  const map: Record<string, string> = { 
    'A+': '#ecfdf5', 'A': '#ecfdf5', 'A-': '#ecfdf5',
    'B+': '#eff6ff', 'B': '#eff6ff', 'B-': '#eff6ff',
    'C+': '#fffbeb', 'C': '#fffbeb', 'C-': '#fffbeb',
    'D+': '#fff7ed', 'D': '#fff7ed', 'E': '#fef2f2', 'F': '#fef2f2' 
  };
  return map[grade] || '#f8fafc';
}

function wrapText(text: string | null | undefined, maxChars: number): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      lines.push(current.trim());
      current = w;
    } else {
      current += ' ' + w;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

function renderRatingBadge(value: string | null): string {
  const v = parseInt(value || '0', 10);
  const labels: Record<number, string> = { 5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Fair', 1: 'Poor' };
  const colors: Record<number, string> = { 5: '#065f46', 4: '#059669', 3: '#d97706', 2: '#ea580c', 1: '#dc2626' };
  if (!v || v < 1) return `<text x="0" y="4" font-size="6.5" fill="#94a3b8" font-family="${GEIST_FONT_FAMILY}">—</text>`;
  return `<rect x="0" y="-3" width="38" height="12" rx="6" fill="${colors[v]}" opacity="0.12"/>
    <text x="19" y="5.5" text-anchor="middle" font-size="6" fill="${colors[v]}" font-family="${GEIST_FONT_FAMILY}" font-weight="600">${labels[v]}</text>`;
}

function renderGradeChip(grade: string): string {
  const color = getGradeColor(grade);
  const bgColor = getGradeBgColor(grade);
  return `<rect x="0" y="-4" width="20" height="10" rx="4" fill="${bgColor}" stroke="${color}" stroke-width="0.5"/>
    <text x="10" y="4.5" text-anchor="middle" font-size="6" fill="${color}" font-family="${GEIST_FONT_FAMILY}" font-weight="700">${esc(grade)}</text>`;
}

function renderSubjectRow(
  index: number, 
  subject: SubjectResult, 
  yPos: number, 
  rowHeight: number, 
  isEven: boolean,
  columns: { w: number; a: string }[],
  sx: number,
  contentW: number
): string {
  const bg = isEven ? '#ffffff' : '#f8fafc';
  const els: string[] = [];
  
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${rowHeight}" fill="${bg}"/>`);
  els.push(`<rect x="${sx}" y="${yPos}" width="1.5" height="${rowHeight}" fill="${getGradeColor(subject.grade)}" opacity="0.25"/>`);
  
  const ca1Val = getScoreDisplay(subject.scoresByType, 'ca1', String(Math.round(subject.caScore)));
  const vals = [
    String(index + 1),
    subject.subjectName,
    ca1Val,
    getScoreDisplay(subject.scoresByType, 'ca2'),
    getScoreDisplay(subject.scoresByType, 'assignment'),
    getScoreDisplay(subject.scoresByType, 'project'),
    String(Math.round(subject.total)),
    subject.grade,
    subject.remark,
  ];
  
  let cx = sx;
  columns.forEach((cd, j) => {
    const val = vals[j] || '';
    const isGrade = j === 7;
    const isSubject = j === 1;
    
    if (isGrade) {
      els.push(`<g transform="translate(${cx + (cd.w - 18) / 2}, ${yPos + 0.5}) scale(0.85)">${renderGradeChip(val)}</g>`);
    } else {
      const xa = cd.a === 'r' ? cx + cd.w - 2 : cd.a === 'c' ? cx + cd.w / 2 : cx + 2;
      const anchor = cd.a === 'c' ? 'middle' : cd.a === 'r' ? 'end' : 'start';
      const color = isSubject ? '#0f172a' : '#1e293b';
      const weight = isSubject ? '600' : '400';
      const size = isSubject ? '3.8' : '3.5';
      
      els.push(`<text x="${xa}" y="${yPos + rowHeight - 3}" text-anchor="${anchor}" 
        font-size="${size}" fill="${color}" font-family="${GEIST_FONT_FAMILY}" 
        font-weight="${weight}"${j === 0 ? ' opacity="0.4"' : ''}>${esc(val)}</text>`);
    }
    cx += cd.w;
  });
  
  return els.join('\n');
}

export async function renderReportCardSVG(input: ReportCardRenderInput): Promise<string> {
  const pc = input.school.primaryColor || '#0f3b5e';
  const sc = input.school.secondaryColor || '#2d7a8a';
  const tc = '#0f172a';
  const muted = '#64748b';
  const lightBg = '#f1f5f9';
  const PAGE_W = A4.WIDTH_MM;
  const PAGE_H = A4.HEIGHT_MM;
  const sx = 10;
  const contentW = PAGE_W - 20;

  const els: string[] = [];
  els.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" style="font-family:'${ARABIC_FONT_FAMILY}','${GEIST_FONT_FAMILY}',sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
    <defs>
      <style>
        @font-face {
          font-family:'${GEIST_FONT_FAMILY}';
          src:url(data:font/truetype;base64,${GEIST_REGULAR_BASE64}) format('truetype');
          font-weight: 400;
          font-style: normal;
        }
        @font-face {
          font-family:'${GEIST_FONT_FAMILY}';
          src:url(data:font/truetype;base64,${GEIST_BOLD_BASE64}) format('truetype');
          font-weight: 600;
          font-style: normal;
        }
        @font-face {
          font-family:'${GEIST_FONT_FAMILY}';
          src:url(data:font/truetype;base64,${GEIST_BOLD_BASE64}) format('truetype');
          font-weight: 700;
          font-style: normal;
        }
        @font-face {
          font-family:'${ARABIC_FONT_FAMILY}';
          src:url(data:font/truetype;base64,${ARABIC_FONT_BASE64}) format('truetype');
          font-weight: 400;
          font-style: normal;
        }
        text {
          shape-rendering: geometricPrecision;
          text-rendering: geometricPrecision;
        }
      </style>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${pc}"/>
        <stop offset="50%" stop-color="${sc}"/>
        <stop offset="100%" stop-color="${pc}"/>
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${pc}" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="${pc}" stop-opacity="0.02"/>
      </linearGradient>
      <filter id="shadow-sm">
        <feDropShadow dx="0" dy="0.5" stdDeviation="0.5" flood-color="#000" flood-opacity="0.06"/>
      </filter>
      <filter id="shadow-md">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.08"/>
      </filter>
    </defs>
    
    <!-- Background -->
    <rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${PAGE_W}" height="4" fill="${pc}"/>
  `);

  // --- HEADER SECTION ---
  const HEADER_H = 21;
  let yPos = 4;
  
  // Header background
  els.push(`<rect x="0" y="${yPos}" width="${PAGE_W}" height="${HEADER_H}" fill="url(#headerGrad)"/>`);
  els.push(`<rect x="0" y="${yPos + HEADER_H - 1.5}" width="${PAGE_W}" height="1.5" fill="#ffffff" opacity="0.1"/>`);
  
  // Logo
  if (input.school.logoBase64) {
    els.push(`<image href="${input.school.logoBase64}" x="${sx + 2}" y="${yPos + 1.5}" width="18" height="18" preserveAspectRatio="xMidYMid meet" filter="url(#shadow-sm)"/>`);
  }
  const logoOff = input.school.logoBase64 ? 24 : 0;
  
  // School name
  els.push(`<text x="${sx + logoOff}" y="${yPos + 7.5}" font-size="10" font-weight="700" fill="#ffffff" font-family="${GEIST_FONT_FAMILY}" letter-spacing="0.4">${esc(input.school.name)}</text>`);
  
  // Motto
  if (input.school.motto) {
    els.push(`<text x="${sx + logoOff}" y="${yPos + 14.5}" font-size="5" fill="#ffffff" opacity="0.8" font-family="${GEIST_FONT_FAMILY}" font-style="italic">${esc(input.school.motto)}</text>`);
  }
  
  // Contact info
  const contacts = [input.school.address, input.school.phone, input.school.email].filter(Boolean).join(' · ');
  if (contacts) {
    els.push(`<text x="${PAGE_W - sx}" y="${yPos + 7}" text-anchor="end" font-size="4" fill="#ffffff" opacity="0.75" font-family="${GEIST_FONT_FAMILY}">${esc(contacts)}</text>`);
  }
  yPos += HEADER_H + 2;

  // --- TITLE SECTION ---
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="10" rx="2" fill="url(#accentGrad)"/>`);
  els.push(`<text x="${sx + 5}" y="${yPos + 7}" font-size="8" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">${esc(input.term.name)} Term Academic Report</text>`);
  els.push(`<text x="${PAGE_W - sx - 5}" y="${yPos + 7}" text-anchor="end" font-size="5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="500">Session: ${esc(input.settings.academicSession || 'N/A')}</text>`);
  yPos += 13;

  // --- STUDENT INFO ---
  const STUDENT_INFO_H = 18;
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${STUDENT_INFO_H}" rx="3" fill="${lightBg}" stroke="#e2e8f0" stroke-width="0.5" filter="url(#shadow-sm)"/>`);
  
  // Photo
  if (input.student.photoBase64) {
    els.push(`<clipPath id="pc"><circle cx="${sx + 13}" cy="${yPos + 9}" r="7.5"/></clipPath>`);
    els.push(`<image href="${input.student.photoBase64}" x="${sx + 5.5}" y="${yPos + 1.5}" width="15" height="15" clip-path="url(#pc)" preserveAspectRatio="xMidYMid slice"/>`);
    els.push(`<circle cx="${sx + 13}" cy="${yPos + 9}" r="7.5" fill="none" stroke="${pc}" stroke-width="0.8" opacity="0.3"/>`);
  }
  
  const infoX = sx + (input.student.photoBase64 ? 22 : 6);
  const infoFields = [
    { l: 'Student Name', v: input.student.name, w: 6 },
    { l: 'Admission No', v: input.student.admissionNo, w: 4 },
    { l: 'Class', v: `${input.cls.name}${input.cls.section ? ' · ' + input.cls.section : ''}`, w: 4 },
    { l: 'Gender', v: input.student.gender, w: 3 },
    { l: 'Date of Birth', v: input.student.dateOfBirth, w: 4 },
    { l: 'Age', v: input.student.age, w: 2 },
    { l: 'Parents', v: input.student.parents, w: 5 },
    { l: 'Term', v: `${input.term.name} Term`, w: 3 },
  ].filter(f => f.v);
  
  const cols = 4;
  const cw = (contentW - (infoX - sx + 2)) / cols;
  infoFields.forEach((f, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = infoX + col * cw;
    const ly = yPos + 3 + row * 7;
    els.push(`<text x="${x}" y="${ly}" font-size="3.2" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="500">${esc(f.l)}</text>`);
    els.push(`<text x="${x}" y="${ly + 4.5}" font-size="4.2" fill="${tc}" font-family="${GEIST_FONT_FAMILY}" font-weight="600">${esc(f.v || '')}</text>`);
  });
  yPos += STUDENT_INFO_H + 3;

  // --- PERFORMANCE TABLE ---
  els.push(`<text x="${sx}" y="${yPos}" font-size="6.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Academic Performance</text>`);
  els.push(`<line x1="${sx}" y1="${yPos + 1}" x2="${sx + 28}" y2="${yPos + 1}" stroke="${pc}" stroke-width="1.2"/>`);
  yPos += 6;

  const hasNoScores = input.subjectResults.length === 0;
  if (hasNoScores) {
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="12" rx="3" fill="#fef2f2" stroke="#fecaca" stroke-width="0.5"/>`);
    els.push(`<text x="${sx + contentW/2}" y="${yPos + 7}" text-anchor="middle" font-size="5" fill="#dc2626" font-family="${GEIST_FONT_FAMILY}" font-style="italic">No assessment data available for this term</text>`);
    yPos += 15;
  } else {
    // Table columns
    const colsDef = [
      { w: 4.5, a: 'c' },   // #
      { w: 33, a: 'l' },    // Subject
      { w: 9, a: 'c' },     // CA 1
      { w: 9, a: 'c' },     // CA 2
      { w: 9, a: 'c' },     // Assign.
      { w: 9, a: 'c' },     // Project
      { w: 9, a: 'c' },     // Total
      { w: 18, a: 'c' },    // Grade
      { w: 19.5, a: 'l' },  // Remark
    ];
    const headers = ['#', 'Subject', 'CA 1', 'CA 2', 'Assign.', 'Project', 'Total', 'Grade', 'Remark'];
    
    // Table header
    let hx = sx;
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="5.5" rx="2" fill="${pc}"/>`);
    els.push(`<rect x="${sx}" y="${yPos + 5}" width="${contentW}" height="0.4" fill="#ffffff" opacity="0.1"/>`);
    
    headers.forEach((h, i) => {
      const cd = colsDef[i];
      const xa = cd.a === 'r' ? hx + cd.w - 2 : cd.a === 'c' ? hx + cd.w / 2 : hx + 2;
      const anchor = cd.a === 'c' ? 'middle' : cd.a === 'r' ? 'end' : 'start';
      els.push(`<text x="${xa}" y="${yPos + 4}" text-anchor="${anchor}" font-size="3.8" fill="#ffffff" font-family="${GEIST_FONT_FAMILY}" font-weight="600">${h}</text>`);
      hx += cd.w;
    });
    yPos += 5.5;

    // Table rows
    const rowHeight = 5.5;
    input.subjectResults.forEach((r, i) => {
      const isEven = i % 2 === 0;
      els.push(renderSubjectRow(i, r, yPos, rowHeight, isEven, colsDef, sx, contentW));
      yPos += rowHeight;
    });
    
    // Table footer line
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="0.4" fill="#e2e8f0"/>`);
    yPos += 1.5;
  }

  // --- SUMMARY SECTION ---
  const SUMMARY_H = 13;
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${SUMMARY_H}" rx="3" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="0.5" filter="url(#shadow-sm)"/>`);
  
  const summaryItems = [
    { l: 'Total', v: hasNoScores ? '—' : String(Math.round(input.totals.grandTotal)) },
    { l: 'Average', v: hasNoScores ? '—' : `${Math.round(input.totals.averageScore)}%` },
    { l: 'Grade', v: hasNoScores ? '—' : input.totals.overallGrade, c: getGradeColor(input.totals.overallGrade) },
    { l: 'Rank', v: input.totals.classRank ? `${input.totals.classRank}/${input.totals.totalStudents}` : '—' },
    { l: 'Remark', v: hasNoScores ? '—' : input.totals.overallRemark },
  ];
  
  const sw = contentW / summaryItems.length;
  summaryItems.forEach((si, i) => {
    const xx = sx + i * sw + sw / 2;
    const color = si.c || tc;
    const isGrade = i === 2;
    
    if (isGrade && si.v !== '—') {
      els.push(`<text x="${xx}" y="${yPos + 4}" text-anchor="middle" font-size="3.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="500">${esc(si.l)}</text>`);
      els.push(`<g transform="translate(${xx - 10}, ${yPos + 5.5}) scale(0.85)">${renderGradeChip(si.v)}</g>`);
    } else {
      els.push(`<text x="${xx}" y="${yPos + 4}" text-anchor="middle" font-size="3.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="500">${esc(si.l)}</text>`);
      els.push(`<text x="${xx}" y="${yPos + 11}" text-anchor="middle" font-size="5.5" font-weight="700" fill="${color}" font-family="${GEIST_FONT_FAMILY}">${esc(si.v)}</text>`);
    }
  });
  yPos += SUMMARY_H + 3;

  // --- CHART ---
  if (input.showChart !== false && !hasNoScores) {
    const chartData = input.subjectResults.map(r => ({
      label: r.subjectName.length > 8 ? r.subjectName.slice(0, 8) + '…' : r.subjectName,
      value: Math.round(r.percentage),
      color: getGradeColor(r.grade),
    }));
    const chartSvg = generateSubjectBarChart(chartData, contentW, 65);
    
      els.push(`<text x="${sx}" y="${yPos}" font-size="6" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Performance</text>`);
      els.push(`<line x1="${sx}" y1="${yPos + 1}" x2="${sx + 25}" y2="${yPos + 1}" stroke="${pc}" stroke-width="1"/>`);
      yPos += 5;
    
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="65" rx="3" fill="${lightBg}" stroke="#e2e8f0" stroke-width="0.5"/>`);
    els.push(chartSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''));
    yPos += 69;
  }

  // --- DOMAIN ASSESSMENT + RADAR ---
  if (input.showDomains !== false && input.domainGrade) {
    const groups: { title: string; items: { label: string; value: string | null }[] }[] = [];
    const mapDomain = (src: Record<string, string | null>, title: string) => {
      const entries = Object.entries(src).filter(([k]) => k !== 'average');
      if (entries.length) {
        groups.push({ 
          title, 
          items: entries.map(([k, v]) => ({ 
            label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), 
            value: v 
          }))
        });
      }
    };
    if (input.domainGrade.cognitive) mapDomain(input.domainGrade.cognitive, 'Cognitive');
    if (input.domainGrade.psychomotor) mapDomain(input.domainGrade.psychomotor, 'Psychomotor');
    if (input.domainGrade.affective) mapDomain(input.domainGrade.affective, 'Affective');

    if (groups.length) {
      const radarData: { domain: string; average: number }[] = [];
      if (input.domainGrade.cognitive?.average) radarData.push({ domain: 'Cognitive', average: parseInt(input.domainGrade.cognitive.average) });
      if (input.domainGrade.psychomotor?.average) radarData.push({ domain: 'Psychomotor', average: parseInt(input.domainGrade.psychomotor.average) });
      if (input.domainGrade.affective?.average) radarData.push({ domain: 'Affective', average: parseInt(input.domainGrade.affective.average) });

      const hasRadarData = radarData.length >= 2;
      const domainSectionH = hasRadarData ? 50 : 42;
      const domainColW = hasRadarData ? Math.floor((contentW - 72) / groups.length) : Math.floor(contentW / groups.length);

      els.push(`<text x="${sx}" y="${yPos}" font-size="6" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Domain Assessment</text>`);
      els.push(`<line x1="${sx}" y1="${yPos + 1}" x2="${sx + 30}" y2="${yPos + 1}" stroke="${pc}" stroke-width="1"/>`);
      yPos += 5;

      els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${domainSectionH}" rx="3" fill="${lightBg}" stroke="#e2e8f0" stroke-width="0.5" filter="url(#shadow-sm)"/>`);

      groups.forEach((g, gi) => {
        const xx = sx + 2 + gi * domainColW;
        const w = domainColW - 2;
        els.push(`<text x="${xx + 4}" y="${yPos + 6}" font-size="4.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">${esc(g.title)}</text>`);
        g.items.slice(0, 5).forEach((t, ti) => {
          const ty = yPos + 9 + ti * 6.5;
          els.push(`<text x="${xx + 4}" y="${ty + 3}" font-size="3.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(t.label)}</text>`);
          els.push(`<g transform="translate(${xx + w - 38}, ${ty - 1})">${renderRatingBadge(t.value)}</g>`);
        });
      });

      if (hasRadarData) {
        const radarSvg = generateDomainRadarChart(radarData, 70, domainSectionH, pc);
        els.push(`<g transform="translate(${sx + contentW - 72}, ${yPos})">${radarSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`);
      }
      yPos += domainSectionH + 4;
    }
  }

  // --- CUMULATIVE AVERAGE ---
  if (input.showCumulative !== false && input.cumulativeTerms && input.cumulativeTerms.length > 1) {
    const cumulative = computeCumulativeAverage(input.cumulativeTerms);
    const trendIcon = cumulative.trend === 'improving' ? '↑' : cumulative.trend === 'declining' ? '↓' : '→';
    const trendColor = cumulative.trend === 'improving' ? '#059669' : cumulative.trend === 'declining' ? '#dc2626' : '#d97706';

    els.push(`<text x="${sx}" y="${yPos}" font-size="6" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Cumulative Performance</text>`);
    els.push(`<line x1="${sx}" y1="${yPos + 1}" x2="${sx + 28}" y2="${yPos + 1}" stroke="${pc}" stroke-width="1"/>`);
    yPos += 5;

    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="20" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5" filter="url(#shadow-sm)"/>`);

    const termW = contentW / (cumulative.terms.length + 1);
    cumulative.terms.forEach((t, i) => {
      const xx = sx + i * termW + termW / 2;
      els.push(`<text x="${xx}" y="${yPos + 5}" text-anchor="middle" font-size="3.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(t.termName)}</text>`);
      els.push(`<text x="${xx}" y="${yPos + 13.5}" text-anchor="middle" font-size="5.5" font-weight="700" fill="${pc}" font-family="${GEIST_FONT_FAMILY}">${Math.round(t.averageScore)}%</text>`);
    });

    const cumX = sx + cumulative.terms.length * termW + termW / 2;
    els.push(`<text x="${cumX}" y="${yPos + 5}" text-anchor="middle" font-size="3.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="600">Cumulative</text>`);
    els.push(`<text x="${cumX}" y="${yPos + 13.5}" text-anchor="middle" font-size="5.5" font-weight="700" fill="${trendColor}" font-family="${GEIST_FONT_FAMILY}">${Math.round(cumulative.cumulativeAverage)}% ${trendIcon}</text>`);
    yPos += 23;
  }

  // --- ATTENDANCE + CORRELATION ---
  if (input.showAttendance !== false && input.attendance) {
    const att = input.attendance;
    const showCorr = input.showCorrelation !== false && input.totals.averageScore > 0;
    const gaugeSvg = generateAttendanceGauge(att.percentage, 48, 42);
    const attBlockH = showCorr ? 40 : 30;

    els.push(`<text x="${sx}" y="${yPos}" font-size="6" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Attendance Record</text>`);
    els.push(`<line x1="${sx}" y1="${yPos + 1}" x2="${sx + 28}" y2="${yPos + 1}" stroke="${pc}" stroke-width="1"/>`);
    yPos += 5;

    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${attBlockH}" rx="3" fill="${lightBg}" stroke="#e2e8f0" stroke-width="0.5" filter="url(#shadow-sm)"/>`);

    // Gauge
    els.push(`<g transform="translate(${sx + 6}, ${yPos + 1})">${gaugeSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`);

    const attItemsWidth = showCorr ? contentW - 58 - 60 : contentW - 56;
    const attItems = [
      { l: 'Days', v: String(att.totalDays) },
      { l: 'Present', v: String(att.daysPresent), c: '#059669' },
      { l: 'Absent', v: String(att.daysAbsent), c: '#dc2626' },
      { l: 'Rate', v: `${att.percentage}%`, c: att.percentage >= 80 ? '#059669' : att.percentage >= 60 ? '#d97706' : '#dc2626' },
    ];

    const aiw = attItemsWidth / attItems.length;
    attItems.forEach((ai, i) => {
      const xx = sx + 58 + i * aiw + aiw / 2;
      const color = ai.c || tc;
      els.push(`<text x="${xx}" y="${yPos + 7}" text-anchor="middle" font-size="3.2" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(ai.l)}</text>`);
      els.push(`<text x="${xx}" y="${yPos + 17}" text-anchor="middle" font-size="6" font-weight="700" fill="${color}" font-family="${GEIST_FONT_FAMILY}">${esc(ai.v)}</text>`);
    });

    // Correlation mini-chart
    if (showCorr) {
      const corr = analyzeAttendanceCorrelation({ attendancePercentage: att.percentage, academicAverage: input.totals.averageScore, totalDays: att.totalDays });
      const corrSvg = generateAttendanceCorrelationSVG(att.percentage, input.totals.averageScore, 56, attBlockH - 4, pc);
      els.push(`<g transform="translate(${sx + contentW - 58}, ${yPos + 2})">${corrSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`);
    }
    yPos += attBlockH + 3;
  }

  // --- REMARKS ---
  els.push(`<text x="${sx}" y="${yPos}" font-size="6.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}" letter-spacing="0.4">Comments & Remarks</text>`);
  els.push(`<line x1="${sx}" y1="${yPos + 1.5}" x2="${sx + 35}" y2="${yPos + 1.5}" stroke="${pc}" stroke-width="1.5"/>`);
  yPos += 6;

  const remarks = [
    { l: "Teacher's Comment", v: input.teacherComment, sn: input.domainGrade?.classTeacherName },
    { l: "Principal's Comment", v: input.principalComment || input.domainGrade?.principalComment, sn: input.settings.principalName },
  ];
  
  let remarkCount = 0;
  remarks.forEach((r, idx) => {
    if (!r.v) return;
    remarkCount++;
    const rh = 14;
    const bg = idx === 0 ? '#ffffff' : '#f8fafc';
    
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${rh}" rx="3" fill="${bg}" stroke="#e2e8f0" stroke-width="0.5" filter="url(#shadow-sm)"/>`);
    els.push(`<rect x="${sx}" y="${yPos}" width="3" height="${rh}" rx="1.5" fill="${idx === 0 ? pc : sc}" opacity="0.3"/>`);
    
    // Label
    els.push(`<text x="${sx + 8}" y="${yPos + 4.5}" font-size="4" font-weight="600" fill="${pc}" font-family="${GEIST_FONT_FAMILY}">${esc(r.l)}</text>`);
    
    // Comment text
    wrapText(r.v, 100).forEach((l, i) => {
      els.push(`<text x="${sx + 8}" y="${yPos + 10.5 + i * 4}" font-size="4" fill="#334155" font-family="${GEIST_FONT_FAMILY}">${esc(l)}</text>`);
    });
    
    // Signatory name
    if (r.sn) {
      els.push(`<text x="${sx + contentW - 6}" y="${yPos + rh - 3}" text-anchor="end" font-size="3.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-style="italic">— ${esc(r.sn)}</text>`);
    }
    yPos += rh + 2;
  });
  
  if (remarkCount === 0) {
    yPos += 6;
  }

  // --- FOOTER ---
  const footerY = PAGE_H - 8;
  els.push(`<rect x="0" y="${footerY - 1.5}" width="${PAGE_W}" height="1.5" fill="${pc}" opacity="0.08"/>`);
  els.push(`<line x1="${sx}" y1="${footerY}" x2="${sx + contentW}" y2="${footerY}" stroke="#e2e8f0" stroke-width="0.3"/>`);
  
  // Left footer
  els.push(`<text x="${sx}" y="${footerY + 4.5}" font-size="3.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" opacity="0.7">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</text>`);
  
  // Report ID
  if (input.reportCardId) {
    els.push(`<text x="${sx + contentW / 2}" y="${footerY + 4.5}" text-anchor="middle" font-size="3.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" opacity="0.5">ID: ${esc(input.reportCardId)}</text>`);
  }
  
  // Right footer
  if (input.settings.nextTermBegins) {
    els.push(`<text x="${PAGE_W - sx}" y="${footerY + 4.5}" text-anchor="end" font-size="4" fill="${pc}" font-family="${GEIST_FONT_FAMILY}">Next Term: ${esc(input.settings.nextTermBegins)}</text>`);
  }

  // --- WATERMARK ---
  if (input.watermarkText) {
    els.push(`<text x="${PAGE_W / 2}" y="${PAGE_H / 2}" text-anchor="middle" dominant-baseline="central" 
      font-size="42" fill="${pc}" opacity="0.035" font-family="${GEIST_FONT_FAMILY}" font-weight="700" 
      letter-spacing="8" transform="rotate(-30, ${PAGE_W / 2}, ${PAGE_H / 2})">${esc(input.watermarkText)}</text>`);
  }

  els.push('</svg>');
  return els.join('\n');
}

export async function renderReportCardPng(svg: string, scale?: number): Promise<Uint8Array> {
  const s = scale ?? A4.EXPORT_SCALE;
  const w = Math.round(A4.WIDTH_MM * s);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: w },
    font: { fontFiles: getFontFiles(), defaultFontFamily: `'${ARABIC_FONT_FAMILY}', '${GEIST_FONT_FAMILY}'` },
    dpi: 300,
    background: '#ffffff',
  });
  return resvg.render().asPng();
}

export async function renderReportCardPdf(svg: string): Promise<Buffer> {
  const pngBuffer = await renderReportCardPng(svg);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4.WIDTH_MM * 2.83465, A4.HEIGHT_MM * 2.83465]);
  const { width, height } = page.getSize();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  page.drawImage(pngImage, { x: 0, y: 0, width, height });
  return Buffer.from(await pdfDoc.save());
}