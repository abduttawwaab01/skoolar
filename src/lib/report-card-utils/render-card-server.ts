import { Resvg } from '@resvg/resvg-wasm';
import { ensureResvgInit } from '@/lib/id-card-utils/init-resvg';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { A4, FONT_SIZES, SECTION_SPACING, TABLE_ROW_HEIGHT } from './constants';
import { generateSubjectBarChart, generateAttendanceGauge, generateGradeDistribution } from './svg-charts';
import type { GradeThreshold } from './grade-calculator';

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

export interface ResolvedImage {
  buffer: Buffer;
  contentType: string;
}

export interface ReportCardRenderInput {
  student: {
    name: string;
    admissionNo: string;
    gender?: string | null;
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
    photoBase64?: string | null;
    parents?: string | null;
    age?: string | null;
  };
  school: {
    name: string;
    logoBase64?: string | null;
    address?: string | null;
    motto?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
  };
  settings: {
    principalName?: string | null;
    nextTermBegins?: string | null;
    academicSession?: string | null;
  };
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
}

const HEADER_H = 28;
const PHOTO_SIZE = 22;
const STUDENT_INFO_H = 32;
const TABLE_HEADER_H = 7;
const SUMMARY_H = 20;
const DOMAIN_H = 55;
const REMARKS_H = 30;
const FOOTER_H = 12;
const PAGE_W = A4.WIDTH_MM;
const PAGE_H = A4.HEIGHT_MM;

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function getGradeColor(grade: string): string {
  const map: Record<string, string> = { 'A+': '#065f46', 'A': '#059669', 'A-': '#10b981', 'B+': '#0369a1', 'B': '#0284c7', 'C': '#d97706', 'D': '#ea580c', 'E': '#dc2626', 'F': '#991b1b' };
  return map[grade] || '#6b7280';
}

function renderRatingDots(value: string | null, max = 5): string {
  const v = parseInt(value || '0', 10);
  const dots: string[] = [];
  for (let i = 1; i <= max; i++) {
    dots.push(`<circle cx="${i * 5}" cy="3" r="2" fill="${i <= v ? '#059669' : '#e2e8f0'}"/>`);
  }
  return dots.join('');
}

function renderRatingBadge(value: string | null): string {
  const v = parseInt(value || '0', 10);
  const labels: Record<number, string> = { 5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Fair', 1: 'Poor' };
  const colors: Record<number, string> = { 5: '#065f46', 4: '#059669', 3: '#d97706', 2: '#ea580c', 1: '#dc2626' };
  if (!v || v < 1) return `<text x="0" y="4" font-size="6" fill="#94a3b8" font-family="Inter">—</text>`;
  return `<rect x="0" y="-2" width="36" height="10" rx="5" fill="${colors[v]}" opacity="0.15"/>
<text x="18" y="5" text-anchor="middle" font-size="5.5" fill="${colors[v]}" font-family="Inter" font-weight="600">${labels[v]}</text>`;
}

export async function renderReportCardSVG(input: ReportCardRenderInput): Promise<string> {
  const fs = FONT_SIZES[input.settings.academicSession ? 'md' : 'md'];
  const pc = input.school.primaryColor || '#059669';
  const sc = input.school.secondaryColor || '#ffffff';
  const tc = '#1e293b';
  const muted = '#64748b';

  let yPos = 6;
  const sx = 12;
  const contentW = PAGE_W - 24;

  const els: string[] = [];
  els.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" style="font-family:Inter,sans-serif">
<defs><style>@font-face{font-family:'Inter';src:url(data:font/woff2;base64,${GEIST_REGULAR_BASE64}) format('woff2');}</style></defs>
<rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>`);

  // --- Header ---
  els.push(`<rect x="0" y="${yPos}" width="${PAGE_W}" height="${HEADER_H}" fill="${pc}"/>
<rect x="0" y="${yPos}" width="${PAGE_W}" height="${HEADER_H}" fill="url(#headerGrad)" opacity="0.3"/>`);
  if (input.school.logoBase64) {
    els.push(`<image href="${input.school.logoBase64}" x="${sx + 2}" y="${yPos + 3}" width="22" height="22" preserveAspectRatio="xMidYMid meet"/>`);
  }
  const logoOffset = input.school.logoBase64 ? 28 : 0;
  els.push(`<text x="${sx + logoOffset}" y="${yPos + 9}" font-size="${fs.header}" font-weight="700" fill="#ffffff" font-family="Inter">${esc(input.school.name)}</text>`);
  if (input.school.motto) {
    els.push(`<text x="${sx + logoOffset}" y="${yPos + 20}" font-size="6" fill="#ffffff" opacity="0.85" font-family="Inter">${esc(input.school.motto)}</text>`);
  }
  const contacts = [input.school.address, input.school.phone, input.school.email].filter(Boolean).join(' · ');
  if (contacts) {
    els.push(`<text x="${PAGE_W - sx}" y="${yPos + 14}" text-anchor="end" font-size="5" fill="#ffffff" opacity="0.8" font-family="Inter">${esc(contacts)}</text>`);
  }
  yPos += HEADER_H + 3;

  // --- Title ---
  els.push(`<text x="${sx}" y="${yPos}" font-size="${fs.title}" font-weight="700" fill="${tc}" font-family="Inter">${esc(input.term.name)} Term Students Report</text>
<text x="${PAGE_W - sx}" y="${yPos}" text-anchor="end" font-size="7" fill="${muted}" font-family="Inter">Session: ${esc(input.settings.academicSession || 'N/A')}</text>`);
  yPos += 10;

  // --- Student Info ---
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${STUDENT_INFO_H}" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5"/>`);
  if (input.student.photoBase64) {
    els.push(`<clipPath id="photoClip"><circle cx="${sx + 16}" cy="${yPos + STUDENT_INFO_H / 2}" r="${PHOTO_SIZE / 2 - 1}"/></clipPath>
<image href="${input.student.photoBase64}" x="${sx + 5}" y="${yPos + (STUDENT_INFO_H - PHOTO_SIZE) / 2}" width="${PHOTO_SIZE}" height="${PHOTO_SIZE}" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>`);
  }
  const infoX = sx + (input.student.photoBase64 ? 30 : 6);
  const infoFields = [
    { label: 'Name', value: input.student.name },
    { label: 'Admission No', value: input.student.admissionNo },
    { label: 'Class', value: `${esc(input.cls.name)}${input.cls.section ? ' · ' + esc(input.cls.section) : ''}` },
    { label: 'Gender', value: input.student.gender },
    { label: 'Date of Birth', value: input.student.dateOfBirth },
    { label: 'Term', value: `${esc(input.term.name)} Term` },
    { label: 'Session', value: esc(input.settings.academicSession || '') },
    { label: 'Age', value: input.student.age },
    { label: 'Parents', value: input.student.parents },
  ].filter(f => f.value);
  const infoCols = Math.min(3, infoFields.length);
  const colW = (contentW - (infoX - sx + 5)) / infoCols;
  infoFields.forEach((f, i) => {
    const col = i % infoCols;
    const row = Math.floor(i / infoCols);
    const x = infoX + col * colW;
    const ly = yPos + 6 + row * 9;
    els.push(`<text x="${x}" y="${ly}" font-size="5" fill="${muted}" font-family="Inter">${esc(f.label)}</text>
<text x="${x}" y="${ly + 6}" font-size="6.5" fill="${tc}" font-family="Inter" font-weight="500">${esc(f.value)}</text>`);
  });
  yPos += STUDENT_INFO_H + 4;

  // --- Subjects Table ---
  els.push(`<text x="${sx}" y="${yPos}" font-size="7.5" font-weight="600" fill="${tc}" font-family="Inter">Academic Performance</text>`);
  yPos += 9;

  const tableW = contentW;
  const colDefs = [
    { w: 5, align: 'center' }, { w: 38, align: 'left' },
    { w: 10, align: 'center' }, { w: 10, align: 'center' },
    { w: 10, align: 'center' }, { w: 10, align: 'center' },
    { w: 12, align: 'right' }, { w: 10, align: 'center' },
    { w: 20, align: 'left' },
  ];
  let hX = sx;
  const headers = ['#', 'Subject', 'CA 1', 'CA 2', 'Assign.', 'Project', 'Total', 'Grade', 'Remark'];
  const gradeScaleMap = new Map(input.gradeScale.map(g => [g.grade, g]));

  els.push(`<rect x="${sx}" y="${yPos}" width="${tableW}" height="${TABLE_HEADER_H}" rx="2" fill="${pc}"/>`);
  headers.forEach((h, i) => {
    const a = colDefs[i].align;
    const xa = a === 'right' ? hX + colDefs[i].w - 2 : a === 'center' ? hX + colDefs[i].w / 2 : hX + 2;
    els.push(`<text x="${xa}" y="${yPos + 5}" text-anchor="${a === 'center' ? 'middle' : a === 'right' ? 'end' : 'start'}" font-size="5.5" fill="#ffffff" font-family="Inter" font-weight="600">${h}</text>`);
    hX += colDefs[i].w;
  });
  yPos += TABLE_HEADER_H + 1;

  input.subjectResults.forEach((r, i) => {
    const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const rowH = TABLE_ROW_HEIGHT;
    const gc = getGradeColor(r.grade);
    els.push(`<rect x="${sx}" y="${yPos}" width="${tableW}" height="${rowH}" fill="${rowBg}"/>`);
    if (i === 0) els.push(`<line x1="${sx}" y1="${yPos}" x2="${sx + tableW}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.3"/>`);

    let cX = sx;
    const vals = [String(i + 1), r.subjectName,
      r.scoresByType?.ca1 ? String(Math.round(r.scoresByType.ca1.raw)) : String(Math.round(r.caScore)),
      r.scoresByType?.ca2 ? String(Math.round(r.scoresByType.ca2.raw)) : '—',
      r.scoresByType?.assignment ? String(Math.round(r.scoresByType.assignment.raw)) : '—',
      r.scoresByType?.project ? String(Math.round(r.scoresByType.project.raw)) : '—',
      String(Math.round(r.total)), r.grade, r.remark,
    ];
    colDefs.forEach((cd, j) => {
      const a = cd.align;
      const xa = a === 'right' ? cX + cd.w - 2 : a === 'center' ? cX + cd.w / 2 : cX + 2;
      const color = j === 7 ? gc : tc;
      const weight = j === 7 ? '700' : '400';
      els.push(`<text x="${xa}" y="${yPos + rowH - 2.5}" text-anchor="${a === 'center' ? 'middle' : a === 'right' ? 'end' : 'start'}" font-size="5.5" fill="${color}" font-family="Inter" font-weight="${weight}">${esc(vals[j])}</text>`);
      cX += cd.w;
    });
    yPos += rowH;
  });

  yPos += 4;

  // --- Performance Summary ---
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${SUMMARY_H}" rx="3" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="0.5"/>`);
  const sumItems = [
    { label: 'Total Score', value: String(Math.round(input.totals.grandTotal)) },
    { label: 'Average', value: `${Math.round(input.totals.averageScore)}%` },
    { label: 'Grade', value: input.totals.overallGrade },
    { label: 'Class Rank', value: input.totals.classRank ? `${input.totals.classRank}/${input.totals.totalStudents}` : '—' },
    { label: 'Remark', value: input.totals.overallRemark },
  ];
  const sumColW = contentW / sumItems.length;
  sumItems.forEach((si, i) => {
    const xx = sx + i * sumColW + sumColW / 2;
    const color = i === 2 ? getGradeColor(si.value) : tc;
    els.push(`<text x="${xx}" y="${yPos + 8}" text-anchor="middle" font-size="5.5" fill="${muted}" font-family="Inter">${esc(si.label)}</text>
<text x="${xx}" y="${yPos + 17}" text-anchor="middle" font-size="8" font-weight="700" fill="${color}" font-family="Inter">${esc(si.value)}</text>`);
  });
  yPos += SUMMARY_H + 4;

  // --- Chart ---
  if (input.showChart !== false && input.subjectResults.length > 0) {
    const chartData = input.subjectResults.map(r => ({ label: r.subjectName.length > 6 ? r.subjectName.slice(0, 6) : r.subjectName, value: Math.round(r.percentage), color: getGradeColor(r.grade) }));
    const chartSvg = generateSubjectBarChart(chartData, contentW, 100);
    els.push(`<text x="${sx}" y="${yPos}" font-size="7.5" font-weight="600" fill="${tc}" font-family="Inter">Performance Chart</text>`);
    yPos += 8;
    const chartSvgInlined = chartSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    els.push(chartSvgInlined);
    yPos += 108;
  }

  // --- Domain Grades ---
  if (input.showDomains !== false && input.domainGrade) {
    const domainGroups: { title: string; traits: { key: string; label: string; value: string | null }[] }[] = [];
    if (input.domainGrade.cognitive) {
      domainGroups.push({
        title: 'Cognitive Domain',
        traits: Object.entries(input.domainGrade.cognitive)
          .filter(([k]) => k !== 'average')
          .map(([k, v]) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
      });
    }
    if (input.domainGrade.psychomotor) {
      domainGroups.push({
        title: 'Psychomotor Domain',
        traits: Object.entries(input.domainGrade.psychomotor)
          .filter(([k]) => k !== 'average')
          .map(([k, v]) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
      });
    }
    if (input.domainGrade.affective) {
      domainGroups.push({
        title: 'Affective Domain',
        traits: Object.entries(input.domainGrade.affective)
          .filter(([k]) => k !== 'average')
          .map(([k, v]) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
      });
    }

    if (domainGroups.length > 0) {
      const domColW = contentW / domainGroups.length;
      els.push(`<text x="${sx}" y="${yPos}" font-size="7.5" font-weight="600" fill="${tc}" font-family="Inter">Domain Assessment</text>`);
      yPos += 9;
      domainGroups.forEach((dg, gi) => {
        const xx = sx + gi * domColW;
        els.push(`<rect x="${xx}" y="${yPos}" width="${domColW - 2}" height="${DOMAIN_H}" rx="2" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.3"/>
<text x="${xx + 4}" y="${yPos + 6}" font-size="5.5" font-weight="600" fill="${tc}" font-family="Inter">${esc(dg.title)}</text>`);
        dg.traits.slice(0, 5).forEach((t, ti) => {
          const ty = yPos + 10 + ti * 9;
          els.push(`<text x="${xx + 4}" y="${ty + 4}" font-size="4.5" fill="${muted}" font-family="Inter">${esc(t.label)}</text>
<g transform="translate(${xx + domColW - 42}, ${ty - 1})">${renderRatingBadge(t.value)}</g>`);
        });
      });
      yPos += DOMAIN_H + 4;
    }
  }

  // --- Attendance ---
  if (input.showAttendance !== false && input.attendance) {
    const att = input.attendance;
    const gaugeSvg = generateAttendanceGauge(att.percentage, 60, 50);
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="38" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.3"/>`);
    const gaugeInlined = gaugeSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    els.push(`<g transform="translate(${sx + 8}, ${yPos - 4})">${gaugeInlined}</g>`);
    const attX = sx + 74;
    const attItems = [
      { label: 'Days Open', value: String(att.totalDays) },
      { label: 'Present', value: String(att.daysPresent) },
      { label: 'Absent', value: String(att.daysAbsent) },
      { label: 'Attendance %', value: `${att.percentage}%` },
    ];
    const attColW = (contentW - 80) / attItems.length;
    attItems.forEach((ai, i) => {
      const xx = attX + i * attColW + attColW / 2;
      els.push(`<text x="${xx}" y="${yPos + 12}" text-anchor="middle" font-size="5.5" fill="${muted}" font-family="Inter">${esc(ai.label)}</text>
<text x="${xx}" y="${yPos + 24}" text-anchor="middle" font-size="8" font-weight="700" fill="${tc}" font-family="Inter">${esc(ai.value)}</text>`);
    });
    yPos += 42;
  }

  // --- Remarks ---
  els.push(`<text x="${sx}" y="${yPos}" font-size="7.5" font-weight="600" fill="${tc}" font-family="Inter">Remarks</text>`);
  yPos += 9;

  const remarkH = 22;
  const remarks = [
    { label: "Teacher's Remark", value: input.teacherComment, signLabel: 'Class Teacher', signName: input.domainGrade?.classTeacherName },
    { label: "Principal's Remark", value: input.principalComment || input.domainGrade?.principalComment, signLabel: 'Principal', signName: input.settings.principalName },
  ];
  remarks.forEach((r) => {
    if (!r.value) return;
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${remarkH}" rx="2" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.3"/>`);
    const lines = wrapText(r.value, 80);
    lines.forEach((l, i) => {
      els.push(`<text x="${sx + 4}" y="${yPos + 6 + i * 5}" font-size="5.5" fill="#475569" font-family="Inter">${esc(l)}</text>`);
    });
    if (r.signName) {
      els.push(`<text x="${sx + contentW - 4}" y="${yPos + remarkH - 4}" text-anchor="end" font-size="5" fill="${muted}" font-family="Inter">${esc(r.signLabel)}: ${esc(r.signName)}</text>`);
    }
    yPos += remarkH + 3;
  });

  // --- Signatures ---
  els.push(`<line x1="${sx}" y1="${yPos}" x2="${sx + contentW}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.3"/>`);
  yPos += 4;
  els.push(`<text x="${sx}" y="${yPos}" font-size="5" fill="${muted}" font-family="Inter">Class Teacher: _________________</text>
<text x="${sx + contentW / 2}" y="${yPos}" font-size="5" fill="${muted}" font-family="Inter">Principal: _________________</text>`);
  yPos += 2;

  // <signature> section added, but just text lines
  yPos += 4;

  // --- Footer ---
  const footerY = PAGE_H - FOOTER_H;
  els.push(`<line x1="${sx}" y1="${footerY}" x2="${sx + contentW}" y2="${footerY}" stroke="#e2e8f0" stroke-width="0.3"/>`);
  els.push(`<text x="${sx}" y="${footerY + 9}" font-size="5" fill="${muted}" font-family="Inter">Generated by Skoolar · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</text>`);
  if (input.settings.nextTermBegins) {
    els.push(`<text x="${PAGE_W - sx}" y="${footerY + 9}" text-anchor="end" font-size="5" fill="${muted}" font-family="Inter">Next Term Begins: ${esc(input.settings.nextTermBegins)}</text>`);
  }

  // --- Watermark ---
  if (input.watermarkText) {
    els.push(`<text x="${PAGE_W / 2}" y="${PAGE_H / 2}" text-anchor="middle" dominant-baseline="central" font-size="36" fill="${pc}" opacity="0.04" font-family="Inter" font-weight="700" transform="rotate(-30, ${PAGE_W / 2}, ${PAGE_H / 2})">${esc(input.watermarkText)}</text>`);
  }

  els.push('</svg>');
  return els.join('\n');
}

export async function renderReportCardPng(svg: string, scale = A4.EXPORT_SCALE): Promise<Buffer> {
  await ensureResvgInit();
  const width = Math.round(A4.WIDTH_MM * scale);
  const height = Math.round(A4.HEIGHT_MM * scale);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: [], loadSystemFonts: false, defaultFontFamily: 'Inter' },
    dpi: 300,
    background: '#ffffff',
  });
  const render = resvg.render();
  return render.asPng();
}

export async function renderReportCardPdf(svg: string): Promise<Buffer> {
  const pngBuffer = await renderReportCardPng(svg);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4.WIDTH_MM * 2.83465, A4.HEIGHT_MM * 2.83465]); // mm to pt
  const { width, height } = page.getSize();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  page.drawImage(pngImage, { x: 0, y: 0, width, height });
  return Buffer.from(await pdfDoc.save());
}
