import { Resvg } from '@resvg/resvg-js';
import { GEIST_REGULAR_BASE64, GEIST_BOLD_BASE64, GEIST_FONT_FAMILY } from '@/lib/fonts/geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from '@/lib/fonts/arabic-font-data';
import { getFontFiles } from '@/lib/font-loader';
import { PDFDocument } from 'pdf-lib';
import { A4 } from './constants';
import { generateSubjectBarChart, generateAttendanceGauge } from './svg-charts';
import type { GradeThreshold } from '@/lib/grade-calculator';

export interface ScoreTypeInfo {
  id: string;
  name: string;
  maxMarks: number;
  weight: number;
  position: number;
}

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
  scoreTypes?: ScoreTypeInfo[];
}

function esc(s: string | number | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  if (!v || v < 1) return `<text x="0" y="4" font-size="5.5" fill="#94a3b8" font-family="${GEIST_FONT_FAMILY}">—</text>`;
  return `<rect x="0" y="-3" width="34" height="11" rx="5" fill="${colors[v]}" opacity="0.12"/>
    <text x="17" y="5" text-anchor="middle" font-size="5" fill="${colors[v]}" font-family="${GEIST_FONT_FAMILY}" font-weight="600">${labels[v]}</text>`;
}

function renderGradeChip(grade: string, scale = 1): string {
  const color = getGradeColor(grade);
  const bgColor = getGradeBgColor(grade);
  const w = 18 * scale;
  const h = 9 * scale;
  const fs = 5.5 * scale;
  return `<rect x="0" y="${-3.5 * scale}" width="${w}" height="${h}" rx="${3 * scale}" fill="${bgColor}" stroke="${color}" stroke-width="${0.4 * scale}"/>
    <text x="${w / 2}" y="${3.5 * scale}" text-anchor="middle" font-size="${fs}" fill="${color}" font-family="${GEIST_FONT_FAMILY}" font-weight="700">${esc(grade)}</text>`;
}

function getScoreTypeValue(
  scoresByType: Record<string, { raw: number; max: number; normalized: number }> | undefined,
  scoreTypeId: string,
  scoreTypeName: string,
): number | null {
  if (!scoresByType) return null;
  if (scoresByType[scoreTypeId]?.raw !== undefined) {
    return Math.round(scoresByType[scoreTypeId].raw);
  }
  const normalized = scoreTypeName.toLowerCase().replace(/\s+/g, '');
  for (const [key, val] of Object.entries(scoresByType)) {
    if (key.toLowerCase().replace(/\s+/g, '') === normalized) {
      return Math.round(val.raw);
    }
  }
  return null;
}

interface ColumnDef {
  key: string;
  label: string;
  w: number;
  align: 'l' | 'c' | 'r';
  isGrade?: boolean;
  isScoreType?: boolean;
}

function buildColumnDefs(
  subjectResults: SubjectResult[],
  scoreTypes?: ScoreTypeInfo[],
  contentW = 190,
): ColumnDef[] {
  const hasScores = subjectResults.length > 0 && subjectResults.some(r => r.scoresByType && Object.keys(r.scoresByType).length > 0);

  const cols: ColumnDef[] = [
    { key: 'index', label: '#', w: 4, align: 'c' },
    { key: 'subject', label: 'Subject', w: 0, align: 'l' },
  ];

  if (hasScores && scoreTypes && scoreTypes.length > 0) {
    const activeTypes = scoreTypes.filter(st =>
      subjectResults.some(r => {
        if (!r.scoresByType) return false;
        const val = getScoreTypeValue(r.scoresByType, st.id, st.name);
        return val !== null;
      })
    );
    if (activeTypes.length > 0) {
      const eachW = Math.min(12, Math.max(7, (contentW - 62) / activeTypes.length));
      for (const st of activeTypes) {
        cols.push({ key: st.id, label: st.name, w: eachW, align: 'c', isScoreType: true });
      }
    }
  }

  cols.push({ key: 'total', label: 'Total', w: 8, align: 'c' });
  cols.push({ key: 'grade', label: 'Grade', w: 9, align: 'c', isGrade: true });
  cols.push({ key: 'remark', label: 'Remark', w: 0, align: 'l' });

  const fixedW = cols.reduce((s, c) => s + (c.w > 0 ? c.w : 0), 0);
  const flexCount = cols.filter(c => c.w === 0).length;
  const flexW = flexCount > 0 ? (contentW - fixedW) / flexCount : 0;

  for (const c of cols) {
    if (c.w === 0) c.w = flexW;
  }

  if (cols.find(c => c.key === 'subject')) {
    const idx = cols.findIndex(c => c.key === 'subject');
    cols[idx].w = Math.max(cols[idx].w, 25);
    const remarkIdx = cols.findIndex(c => c.key === 'remark');
    if (remarkIdx >= 0) {
      cols[remarkIdx].w = contentW - cols.reduce((s, c) => s + c.w, 0);
    }
  }

  return cols;
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
        text { shape-rendering: geometricPrecision; text-rendering: geometricPrecision; }
      </style>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${pc}"/>
        <stop offset="50%" stop-color="${sc}"/>
        <stop offset="100%" stop-color="${pc}"/>
      </linearGradient>
      <filter id="shadow-sm">
        <feDropShadow dx="0" dy="0.5" stdDeviation="0.5" flood-color="#000" flood-opacity="0.06"/>
      </filter>
    </defs>
    <rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${PAGE_W}" height="3" fill="${pc}"/>
  `);

  let yPos = 3;
  const maxY = PAGE_H - 6;
  const hasScores = input.subjectResults.length > 0;

  // ===== HEADER =====
  const HEADER_H = 17;
  els.push(`<rect x="0" y="${yPos}" width="${PAGE_W}" height="${HEADER_H}" fill="url(#headerGrad)"/>`);
  if (input.school.logoBase64) {
    els.push(`<image href="${input.school.logoBase64}" x="${sx + 1}" y="${yPos + 1.5}" width="13" height="13" preserveAspectRatio="xMidYMid meet" filter="url(#shadow-sm)"/>`);
  }
  const logoOff = input.school.logoBase64 ? 17 : 0;
  els.push(`<text x="${sx + logoOff}" y="${yPos + 6.5}" font-size="7.5" font-weight="700" fill="#ffffff" font-family="${GEIST_FONT_FAMILY}" letter-spacing="0.3">${esc(input.school.name)}</text>`);
  if (input.school.motto) {
    els.push(`<text x="${sx + logoOff}" y="${yPos + 11.5}" font-size="3.2" fill="#ffffff" opacity="0.7" font-family="${GEIST_FONT_FAMILY}" font-style="italic">${esc(input.school.motto)}</text>`);
  }
  const contacts = [input.school.address, input.school.phone, input.school.email].filter(Boolean).join('  |  ');
  if (contacts) {
    els.push(`<text x="${PAGE_W - sx - 1}" y="${yPos + 6}" text-anchor="end" font-size="3" fill="#ffffff" opacity="0.8" font-family="${GEIST_FONT_FAMILY}">${esc(contacts)}</text>`);
  }
  yPos += HEADER_H + 1.5;

  // ===== TITLE ROW =====
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="7.5" rx="1.5" fill="${lightBg}"/>`);
  els.push(`<text x="${sx + 3}" y="${yPos + 5}" font-size="5.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">${esc(input.term.name)} Term · ${esc(input.cls.name)}${input.cls.section ? ' · ' + esc(input.cls.section) : ''}</text>`);
  els.push(`<text x="${PAGE_W - sx - 3}" y="${yPos + 5}" text-anchor="end" font-size="3.8" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(input.settings.academicSession || '')}</text>`);
  yPos += 9;

  // ===== STUDENT INFO =====
  const STUDENT_INFO_H = 12;
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${STUDENT_INFO_H}" rx="2" fill="${lightBg}" stroke="#e2e8f0" stroke-width="0.3"/>`);
  const photoExists = input.student.photoBase64;
  if (photoExists) {
    els.push(`<clipPath id="pc"><circle cx="${sx + 7}" cy="${yPos + 6}" r="5"/></clipPath>`);
    els.push(`<image href="${input.student.photoBase64}" x="${sx + 2}" y="${yPos + 1}" width="10" height="10" clip-path="url(#pc)" preserveAspectRatio="xMidYMid slice"/>`);
  }
  const infoStartX = sx + (photoExists ? 16 : 3);
  const infoCols = [
    { l: 'Name', v: input.student.name },
    { l: 'Adm No', v: input.student.admissionNo },
    { l: 'Class', v: input.cls.name + (input.cls.section ? ' ' + input.cls.section : '') },
    { l: 'Gender', v: input.student.gender },
    { l: 'Term', v: input.term.name },
  ].filter(f => f.v);
  const infoW = (contentW - (infoStartX - sx)) / infoCols.length;
  infoCols.forEach((item, i) => {
    const ix = infoStartX + i * infoW;
    els.push(`<text x="${ix}" y="${yPos + 3.5}" font-size="2.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="500">${esc(item.l)}</text>`);
    els.push(`<text x="${ix}" y="${yPos + 7.5}" font-size="3.8" fill="${tc}" font-family="${GEIST_FONT_FAMILY}" font-weight="600">${esc(item.v)}</text>`);
  });
  yPos += STUDENT_INFO_H + 1.5;

  // ===== SPACE BUDGETING =====
  const remainingForRest = maxY - yPos;
  const numSubjects = input.subjectResults.length;

  const minRowH = 3.8;
  const maxRowH = 5;
  const tableHeaderH = 4.2;
  const sectionTitleH = 4.5;
  const summaryH = 8;
  const chartH = 30;
  const domainH = 13;
  const attH = 13;
  const remarksH = 12;
  const footerH = 5;

  const fixedAfterTable = summaryH + footerH;
  let optionalSpace = 0;

  const showChart = input.showChart !== false && hasScores;
  const showDomains = !!(input.showDomains !== false && input.domainGrade);
  const showAttendance = !!(input.showAttendance !== false && input.attendance && input.attendance.totalDays > 0);
  const showTeacherRemark = !!(input.teacherComment || input.principalComment);

  const optionalSections: { key: string; h: number; condition: boolean }[] = [
    { key: 'chart', h: chartH, condition: showChart },
    { key: 'domains', h: domainH, condition: showDomains },
    { key: 'attendance', h: attH, condition: showAttendance },
    { key: 'remarks', h: remarksH, condition: showTeacherRemark },
  ];

  const allOptionalH = optionalSections
    .filter(s => s.condition)
    .reduce((sum, s) => sum + s.h + sectionTitleH, 0);

  const tableContentH = tableHeaderH + sectionTitleH + numSubjects * maxRowH;
  const neededH = tableContentH + fixedAfterTable + allOptionalH;
  const scaleFactor = neededH > remainingForRest ? Math.max(0.75, remainingForRest / neededH) : 1;
  const rowH = Math.max(minRowH, Math.min(maxRowH, maxRowH * scaleFactor));

  let sectionsToShow = optionalSections.map(s => ({ ...s }));
  let usedTableH = sectionTitleH + tableHeaderH + numSubjects * rowH + 1;

  if (usedTableH + fixedAfterTable + sectionsToShow.filter(s => s.condition).reduce((sum, s) => sum + s.h + sectionTitleH * 0.7, 0) > remainingForRest) {
    let budget = remainingForRest - usedTableH - fixedAfterTable - 2;
    for (const sec of sectionsToShow) {
      const needed = sec.h + sectionTitleH * 0.7;
      if (sec.condition && budget >= needed) {
        budget -= needed;
      } else {
        sec.condition = false;
      }
    }
  }

  // ===== ACADEMIC PERFORMANCE TABLE =====
  if (hasScores) {
    els.push(`<text x="${sx}" y="${yPos}" font-size="5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Academic Performance</text>`);
    els.push(`<line x1="${sx}" y1="${yPos + 0.7}" x2="${sx + 22}" y2="${yPos + 0.7}" stroke="${pc}" stroke-width="0.6"/>`);
    yPos += sectionTitleH;

    const cols = buildColumnDefs(input.subjectResults, input.scoreTypes, contentW);

    // Table header
    let hx = sx;
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${tableHeaderH}" fill="${pc}" rx="1"/>`);
    cols.forEach((cd) => {
      const xa = cd.align === 'r' ? hx + cd.w - 1.5 : cd.align === 'c' ? hx + cd.w / 2 : hx + 1.5;
      const anchor = cd.align === 'c' ? 'middle' : cd.align === 'r' ? 'end' : 'start';
      els.push(`<text x="${xa}" y="${yPos + 2.8}" text-anchor="${anchor}" font-size="2.8" fill="#ffffff" font-family="${GEIST_FONT_FAMILY}" font-weight="600">${esc(cd.label)}</text>`);
      hx += cd.w;
    });
    yPos += tableHeaderH;

    // Table rows
    input.subjectResults.forEach((r, i) => {
      if (yPos >= maxY - summaryH - footerH - 2) return;
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      let cx = sx;

      els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${rowH}" fill="${bg}"/>`);
      els.push(`<rect x="${sx}" y="${yPos}" width="1" height="${rowH}" fill="${getGradeColor(r.grade)}" opacity="0.25"/>`);

      cols.forEach((cd) => {
        const xa = cd.align === 'r' ? cx + cd.w - 1.5 : cd.align === 'c' ? cx + cd.w / 2 : cx + 1.5;
        const anchor = cd.align === 'c' ? 'middle' : cd.align === 'r' ? 'end' : 'start';

        if (cd.isGrade) {
          const chipScale = Math.min(1, rowH / 5);
          els.push(`<g transform="translate(${xa - 6 * chipScale}, ${yPos + (rowH - 7 * chipScale) / 2}) scale(${chipScale})">${renderGradeChip(r.grade, chipScale)}</g>`);
        } else if (cd.isScoreType) {
          const val = getScoreTypeValue(r.scoresByType, cd.key, cd.label);
          const display = val !== null ? String(val) : '—';
          els.push(`<text x="${xa}" y="${yPos + rowH - 2}" text-anchor="${anchor}" font-size="3" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="400">${esc(display)}</text>`);
        } else {
          let val = '';
          let size = 3;
          let weight = '400';
          let color = muted;
          let maxLen = Math.floor(cd.w / 2);

          if (cd.key === 'index') { val = String(i + 1); size = 2.8; color = muted; }
          else if (cd.key === 'subject') { val = r.subjectName; size = 3.2; weight = '600'; color = tc; maxLen = Math.floor(cd.w / 1.8); }
          else if (cd.key === 'total') { val = String(Math.round(r.total)); size = 3.2; weight = '700'; color = tc; }
          else if (cd.key === 'remark') { val = r.remark; size = 2.8; maxLen = Math.floor(cd.w / 1.8); }

          if (val.length > maxLen) val = val.slice(0, maxLen - 1) + '…';
          els.push(`<text x="${xa}" y="${yPos + rowH - 2}" text-anchor="${anchor}" font-size="${size}" fill="${color}" font-family="${GEIST_FONT_FAMILY}" font-weight="${weight}">${esc(val)}</text>`);
        }
        cx += cd.w;
      });
      yPos += rowH;
    });
    yPos += 1;
  }

  // ===== SUMMARY BAR =====
  const summaryItems = [
    { l: 'Average', v: hasScores ? `${Math.round(input.totals.averageScore)}%` : '—' },
    { l: 'Grade', v: hasScores ? input.totals.overallGrade : '—' },
    { l: 'Rank', v: input.totals.classRank ? `${input.totals.classRank}/${input.totals.totalStudents}` : '—' },
    { l: 'Total', v: hasScores ? String(Math.round(input.totals.grandTotal)) : '—' },
  ];

  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${summaryH}" rx="1.5" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="0.3"/>`);
  const sumW = contentW / summaryItems.length;
  summaryItems.forEach((si, i) => {
    const xx = sx + i * sumW + sumW / 2;
    const isGrade = i === 1;
    els.push(`<text x="${xx}" y="${yPos + 2.5}" text-anchor="middle" font-size="2.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="500">${esc(si.l)}</text>`);
    if (isGrade && si.v !== '—') {
      els.push(`<g transform="translate(${xx - 6}, ${yPos + 3.5}) scale(0.6)">${renderGradeChip(si.v)}</g>`);
    } else {
      els.push(`<text x="${xx}" y="${yPos + 6.5}" text-anchor="middle" font-size="4.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">${esc(si.v)}</text>`);
    }
  });
  yPos += summaryH + 1;

  // ===== OPTIONAL SECTIONS =====
  for (const sec of sectionsToShow) {
    if (!sec.condition || yPos >= maxY - sec.h - footerH - 2) continue;

    if (sec.key === 'chart') {
      const chartData = input.subjectResults.map(r => ({
        label: r.subjectName.length > 5 ? r.subjectName.slice(0, 5) + '.' : r.subjectName,
        value: Math.round(r.percentage),
        color: getGradeColor(r.grade),
      }));
      const chartSvg = generateSubjectBarChart(chartData, contentW, 28);
      els.push(`<text x="${sx}" y="${yPos}" font-size="4.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Performance Chart</text>`);
      yPos += 3;
      els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="25" rx="1.5" fill="${lightBg}" stroke="#e2e8f0" stroke-width="0.3"/>`);
      els.push(`<g transform="translate(${sx}, ${yPos})">`);
      els.push(chartSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''));
      els.push('</g>');
      yPos += 27;
    }

    if (sec.key === 'domains') {
      const cogAvg = input.domainGrade.cognitive?.average ? parseInt(input.domainGrade.cognitive.average) : 0;
      const psyAvg = input.domainGrade.psychomotor?.average ? parseInt(input.domainGrade.psychomotor.average) : 0;
      const affAvg = input.domainGrade.affective?.average ? parseInt(input.domainGrade.affective.average) : 0;
      const domainItems = [
        { title: 'Cognitive', avg: cogAvg, traits: input.domainGrade.cognitive },
        { title: 'Psychomotor', avg: psyAvg, traits: input.domainGrade.psychomotor },
        { title: 'Affective', avg: affAvg, traits: input.domainGrade.affective },
      ].filter(d => d.avg > 0);

      if (domainItems.length > 0) {
        els.push(`<text x="${sx}" y="${yPos}" font-size="4.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Domain Assessment</text>`);
        yPos += 3;
        const dh = domainH - 3;
        els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${dh}" rx="1.5" fill="${lightBg}" stroke="#e2e8f0" stroke-width="0.3"/>`);
        const dw = contentW / domainItems.length;
        domainItems.forEach((d, i) => {
          const dx = sx + i * dw + dw / 2;
          els.push(`<text x="${dx}" y="${yPos + 3}" text-anchor="middle" font-size="3.2" font-weight="600" fill="${pc}" font-family="${GEIST_FONT_FAMILY}">${esc(d.title)}</text>`);
          if (d.traits) {
            const traitEntries = Object.entries(d.traits).filter(([k]) => k !== 'average').slice(0, 3);
            traitEntries.forEach(([k, v], ti) => {
              const tlabel = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
              els.push(`<text x="${dx - dw / 2 + 2}" y="${yPos + 5.5 + ti * 2.5}" font-size="2.2" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(tlabel)}: ${v || '—'}</text>`);
            });
          }
        });
        yPos += dh + 1;
      }
    }

    if (sec.key === 'attendance') {
      els.push(`<text x="${sx}" y="${yPos}" font-size="4.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Attendance</text>`);
      yPos += 3;
      const ah = attH - 3;
      els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${ah}" rx="1.5" fill="${lightBg}" stroke="#e2e8f0" stroke-width="0.3"/>`);

      const attGauge = generateAttendanceGauge(input.attendance.percentage, 28, 24);
      els.push(`<g transform="translate(${sx + 2}, ${yPos + 1}) scale(0.38)">${attGauge.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`);

      const attStats = [
        { l: 'Days Open', v: String(input.attendance.totalDays) },
        { l: 'Present', v: String(input.attendance.daysPresent) },
        { l: 'Absent', v: String(input.attendance.daysAbsent) },
        { l: 'Attendance', v: `${input.attendance.percentage}%` },
      ];
      const statW = (contentW - 18) / attStats.length;
      attStats.forEach((st, i) => {
        const sx2 = sx + 16 + i * statW + statW / 2;
        els.push(`<text x="${sx2}" y="${yPos + 3}" text-anchor="middle" font-size="2.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" font-weight="500">${esc(st.l)}</text>`);
        els.push(`<text x="${sx2}" y="${yPos + 7.5}" text-anchor="middle" font-size="4.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">${esc(st.v)}</text>`);
      });
      yPos += ah + 1;
    }

    if (sec.key === 'remarks') {
      els.push(`<text x="${sx}" y="${yPos}" font-size="4.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Comments</text>`);
      yPos += 3;
      const remarks = [
        { l: "Teacher's Remark", v: input.teacherComment, sn: input.domainGrade?.classTeacherName },
        { l: "Principal's Remark", v: input.principalComment || input.domainGrade?.principalComment, sn: input.settings.principalName },
      ].filter(r => r.v);

      remarks.forEach((r, idx) => {
        if (yPos >= maxY - footerH - 4) return;
        const rh = 4.5;
        const bg = idx === 0 ? '#ffffff' : '#f8fafc';
        els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${rh}" rx="1" fill="${bg}" stroke="#e2e8f0" stroke-width="0.3"/>`);
        els.push(`<text x="${sx + 1.5}" y="${yPos + 2}" font-size="2.5" font-weight="600" fill="${pc}" font-family="${GEIST_FONT_FAMILY}">${esc(r.l)}</text>`);
        const commentTrim = r.v && r.v.length > 85 ? r.v.slice(0, 84) + '…' : (r.v || '');
        els.push(`<text x="${sx + 1.5}" y="${yPos + 4}" font-size="2.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(commentTrim)}</text>`);
        yPos += rh + 0.5;
      });
    }
  }

  // ===== SIGNATURES =====
  if (yPos < maxY - footerH - 3) {
    els.push(`<line x1="${sx}" y1="${yPos + 1}" x2="${sx + contentW}" y2="${yPos + 1}" stroke="#e2e8f0" stroke-width="0.3"/>`);
    yPos += 2;
    els.push(`<text x="${sx}" y="${yPos}" font-size="2.8" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">Class Teacher: _________________</text>`);
    els.push(`<text x="${PAGE_W - sx}" y="${yPos}" text-anchor="end" font-size="2.8" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">Principal: _________________</text>`);
    yPos += 4;
  }

  // ===== FOOTER =====
  const footerY = PAGE_H - 5;
  els.push(`<line x1="${sx}" y1="${footerY}" x2="${sx + contentW}" y2="${footerY}" stroke="#e2e8f0" stroke-width="0.3"/>`);
  els.push(`<text x="${sx}" y="${footerY + 3}" font-size="2.8" fill="${muted}" font-family="${GEIST_FONT_FAMILY}" opacity="0.7">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</text>`);
  if (input.settings.nextTermBegins) {
    els.push(`<text x="${PAGE_W - sx}" y="${footerY + 3}" text-anchor="end" font-size="3" fill="${pc}" font-family="${GEIST_FONT_FAMILY}" font-weight="600">Next Term: ${esc(input.settings.nextTermBegins)}</text>`);
  }

  // ===== WATERMARK =====
  if (input.watermarkText) {
    els.push(`<text x="${PAGE_W / 2}" y="${PAGE_H / 2}" text-anchor="middle" dominant-baseline="central"
      font-size="36" fill="${pc}" opacity="0.04" font-family="${GEIST_FONT_FAMILY}" font-weight="700"
      letter-spacing="5" transform="rotate(-30, ${PAGE_W / 2}, ${PAGE_H / 2})">${esc(input.watermarkText)}</text>`);
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
