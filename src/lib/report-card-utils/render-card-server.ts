import { Resvg } from '@resvg/resvg-wasm';
import { ensureResvgInit } from '@/lib/id-card-utils/init-resvg';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';
import { PDFDocument } from 'pdf-lib';
import { A4 } from './constants';
import { generateSubjectBarChart, generateAttendanceGauge } from './svg-charts';
import type { GradeThreshold } from '@/lib/grade-calculator';

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
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getGradeColor(grade: string): string {
  const map: Record<string, string> = { 'A+': '#065f46', 'A': '#059669', 'A-': '#10b981', 'B+': '#0369a1', 'B': '#0284c7', 'C': '#d97706', 'D': '#ea580c', 'E': '#dc2626', 'F': '#991b1b' };
  return map[grade] || '#6b7280';
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
  if (!v || v < 1) return `<text x="0" y="4" font-size="6" fill="#94a3b8" font-family="${GEIST_FONT_FAMILY}">—</text>`;
  return `<rect x="0" y="-2" width="36" height="10" rx="5" fill="${colors[v]}" opacity="0.15"/>
<text x="18" y="5" text-anchor="middle" font-size="5.5" fill="${colors[v]}" font-family="${GEIST_FONT_FAMILY}" font-weight="600">${labels[v]}</text>`;
}

export async function renderReportCardSVG(input: ReportCardRenderInput): Promise<string> {
  const pc = input.school.primaryColor || '#059669';
  const tc = '#1e293b';
  const muted = '#64748b';
  const PAGE_W = A4.WIDTH_MM;
  const PAGE_H = A4.HEIGHT_MM;
  const sx = 8;
  const contentW = PAGE_W - 16;

  const els: string[] = [];
  els.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" style="font-family:${GEIST_FONT_FAMILY},sans-serif">
<defs><style>@font-face{font-family:'${GEIST_FONT_FAMILY}';src:url(data:font/woff2;base64,${GEIST_REGULAR_BASE64}) format('woff2');}</style></defs>
<rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>`);

  // --- Header ---
  const HEADER_H = 22;
  let yPos = 4;
  els.push(`<rect x="0" y="${yPos}" width="${PAGE_W}" height="${HEADER_H}" fill="${pc}"/>`);
  if (input.school.logoBase64) {
    els.push(`<image href="${input.school.logoBase64}" x="${sx + 2}" y="${yPos + 2}" width="18" height="18" preserveAspectRatio="xMidYMid meet"/>`);
  }
  const logoOff = input.school.logoBase64 ? 24 : 0;
  els.push(`<text x="${sx + logoOff}" y="${yPos + 8}" font-size="10" font-weight="700" fill="#ffffff" font-family="${GEIST_FONT_FAMILY}">${esc(input.school.name)}</text>`);
  if (input.school.motto) {
    els.push(`<text x="${sx + logoOff}" y="${yPos + 16}" font-size="5" fill="#ffffff" opacity="0.8" font-family="${GEIST_FONT_FAMILY}" font-style="italic">${esc(input.school.motto)}</text>`);
  }
  const contacts = [input.school.address, input.school.phone, input.school.email].filter(Boolean).join(' · ');
  if (contacts) {
    els.push(`<text x="${PAGE_W - sx}" y="${yPos + 10}" text-anchor="end" font-size="4.5" fill="#ffffff" opacity="0.75" font-family="${GEIST_FONT_FAMILY}">${esc(contacts)}</text>`);
  }
  yPos += HEADER_H + 2;

  // --- Title ---
  els.push(`<text x="${sx}" y="${yPos}" font-size="8" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">${esc(input.term.name)} Term Students Report</text>
<text x="${PAGE_W - sx}" y="${yPos}" text-anchor="end" font-size="5.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">Session: ${esc(input.settings.academicSession || 'N/A')}</text>`);
  yPos += 7;

  // --- Student Info ---
  const STUDENT_INFO_H = 20;
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${STUDENT_INFO_H}" rx="2" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.3"/>`);
  if (input.student.photoBase64) {
    els.push(`<image href="${input.student.photoBase64}" x="${sx + 3}" y="${yPos + 2}" width="16" height="16" clip-path="url(#pc)" preserveAspectRatio="xMidYMid slice"/>
<clipPath id="pc"><circle cx="${sx + 11}" cy="${yPos + 10}" r="8"/></clipPath>`);
  }
  const infoX = sx + (input.student.photoBase64 ? 22 : 4);
  const infoFields = [
    { l: 'Name', v: input.student.name }, { l: 'Admission No', v: input.student.admissionNo },
    { l: 'Class', v: `${input.cls.name}${input.cls.section ? ' · ' + input.cls.section : ''}` },
    { l: 'Gender', v: input.student.gender }, { l: 'DOB', v: input.student.dateOfBirth },
    { l: 'Term', v: `${input.term.name} Term` }, { l: 'Session', v: input.settings.academicSession },
    { l: 'Age', v: input.student.age }, { l: 'Parents', v: input.student.parents },
  ].filter(f => f.v);
  const cols = Math.min(4, infoFields.length);
  const cw = (contentW - (infoX - sx + 2)) / cols;
  infoFields.forEach((f, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = infoX + col * cw;
    const ly = yPos + 4 + row * 8;
    els.push(`<text x="${x}" y="${ly}" font-size="4" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(f.l)}</text>
<text x="${x}" y="${ly + 4.5}" font-size="5" fill="${tc}" font-family="${GEIST_FONT_FAMILY}" font-weight="500">${esc(f.v || '')}</text>`);
  });
  yPos += STUDENT_INFO_H + 2;

  // --- Subjects Table ---
  els.push(`<text x="${sx}" y="${yPos}" font-size="6" font-weight="600" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Academic Performance</text>`);
  yPos += 6;

  const hasNoScores = input.subjectResults.length === 0;
  if (hasNoScores) {
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="14" rx="2" fill="#fef2f2" stroke="#fecaca" stroke-width="0.3"/>
<text x="${sx + contentW/2}" y="${yPos + 7}" text-anchor="middle" font-size="5" fill="#dc2626" font-family="${GEIST_FONT_FAMILY}" font-style="italic">No assessment data available yet</text>`);
    yPos += 16;
  } else {
    const colsDef = [
      { w: 4, a: 'c' }, { w: 32, a: 'l' }, { w: 7, a: 'c' }, { w: 7, a: 'c' },
      { w: 8, a: 'c' }, { w: 8, a: 'c' }, { w: 7, a: 'c' }, { w: 6, a: 'c' }, { w: 18, a: 'l' },
    ];
    const headers = ['#', 'Subject', 'CA 1', 'CA 2', 'Assign.', 'Project', 'Score', 'Grade', 'Remark'];
    let hx = sx;
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="5" rx="1.5" fill="${pc}"/>`);
    headers.forEach((h, i) => {
      const cd = colsDef[i];
      const xa = cd.a === 'r' ? hx + cd.w - 1 : cd.a === 'c' ? hx + cd.w / 2 : hx + 1;
      els.push(`<text x="${xa}" y="${yPos + 3.5}" text-anchor="${cd.a === 'c' ? 'middle' : cd.a === 'r' ? 'end' : 'start'}" font-size="3.8" fill="#ffffff" font-family="${GEIST_FONT_FAMILY}" font-weight="600">${h}</text>`);
      hx += cd.w;
    });
    yPos += 5.5;

    input.subjectResults.forEach((r, i) => {
      const rh = 4.2;
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      const gc = getGradeColor(r.grade);
      els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${rh}" fill="${bg}"/>`);
      let cx = sx;
      const vals = [String(i + 1), r.subjectName,
        r.scoresByType?.ca1 ? String(Math.round(r.scoresByType.ca1.raw)) : String(Math.round(r.caScore)),
        r.scoresByType?.ca2 ? String(Math.round(r.scoresByType.ca2.raw)) : '—',
        r.scoresByType?.assignment ? String(Math.round(r.scoresByType.assignment.raw)) : '—',
        r.scoresByType?.project ? String(Math.round(r.scoresByType.project.raw)) : '—',
        String(Math.round(r.total)), r.grade, r.remark,
      ];
      colsDef.forEach((cd, j) => {
        const xa = cd.a === 'r' ? cx + cd.w - 1 : cd.a === 'c' ? cx + cd.w / 2 : cx + 1;
        const col = j === 7 ? gc : tc;
        const wt = j === 7 ? '700' : '400';
        els.push(`<text x="${xa}" y="${yPos + rh - 1.5}" text-anchor="${cd.a === 'c' ? 'middle' : cd.a === 'r' ? 'end' : 'start'}" font-size="3.8" fill="${col}" font-family="${GEIST_FONT_FAMILY}" font-weight="${wt}">${esc(vals[j])}</text>`);
        cx += cd.w;
      });
      yPos += rh;
    });
    yPos += 1;
  }

  // --- Summary ---
  const SUMMARY_H = 14;
  els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${SUMMARY_H}" rx="2" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="0.3"/>`);
  const sumItems = [
    { l: 'Total', v: hasNoScores ? '—' : String(Math.round(input.totals.grandTotal)) },
    { l: 'Average', v: hasNoScores ? '—' : `${Math.round(input.totals.averageScore)}%` },
    { l: 'Grade', v: hasNoScores ? '—' : input.totals.overallGrade, c: getGradeColor(input.totals.overallGrade) },
    { l: 'Rank', v: input.totals.classRank ? `${input.totals.classRank}/${input.totals.totalStudents}` : '—' },
    { l: 'Remark', v: hasNoScores ? '—' : input.totals.overallRemark },
  ];
  const sw = contentW / sumItems.length;
  sumItems.forEach((si, i) => {
    const xx = sx + i * sw + sw / 2;
    const col = si.c || tc;
    els.push(`<text x="${xx}" y="${yPos + 5}" text-anchor="middle" font-size="4" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(si.l)}</text>
<text x="${xx}" y="${yPos + 12}" text-anchor="middle" font-size="6.5" font-weight="700" fill="${col}" font-family="${GEIST_FONT_FAMILY}">${esc(si.v)}</text>`);
  });
  yPos += SUMMARY_H + 2;

  // --- Chart ---
  if (input.showChart !== false && !hasNoScores) {
    const chartData = input.subjectResults.map(r => ({
      label: r.subjectName.length > 6 ? r.subjectName.slice(0, 6) : r.subjectName,
      value: Math.round(r.percentage), color: getGradeColor(r.grade),
    }));
    const chartSvg = generateSubjectBarChart(chartData, contentW, 80);
    els.push(`<text x="${sx}" y="${yPos}" font-size="6" font-weight="600" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Performance Chart</text>`);
    yPos += 6;
    els.push(chartSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''));
    yPos += 86;
  }

  // --- Domain Grades ---
  if (input.showDomains !== false && input.domainGrade) {
    const groups: { title: string; items: { label: string; value: string | null }[] }[] = [];
    const mapDomain = (src: Record<string, string | null>, title: string) => {
      const entries = Object.entries(src).filter(([k]) => k !== 'average');
      if (entries.length) groups.push({ title, items: entries.map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })) });
    };
    if (input.domainGrade.cognitive) mapDomain(input.domainGrade.cognitive, 'Cognitive');
    if (input.domainGrade.psychomotor) mapDomain(input.domainGrade.psychomotor, 'Psychomotor');
    if (input.domainGrade.affective) mapDomain(input.domainGrade.affective, 'Affective');

    if (groups.length) {
      const dh = 42;
      const dcw = contentW / groups.length;
      els.push(`<text x="${sx}" y="${yPos}" font-size="6" font-weight="600" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Domain Assessment</text>`);
      yPos += 6;
      groups.forEach((g, gi) => {
        const xx = sx + gi * dcw;
        els.push(`<rect x="${xx}" y="${yPos}" width="${dcw - 1}" height="${dh}" rx="1.5" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.2"/>
<text x="${xx + 3}" y="${yPos + 5}" font-size="4.5" font-weight="600" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">${esc(g.title)}</text>`);
        g.items.slice(0, 5).forEach((t, ti) => {
          const ty = yPos + 8 + ti * 6.5;
          els.push(`<text x="${xx + 3}" y="${ty + 3}" font-size="3.8" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(t.label)}</text>
<g transform="translate(${xx + dcw - 38}, ${ty - 1})">${renderRatingBadge(t.value)}</g>`);
        });
      });
      yPos += dh + 2;
    }
  }

  // --- Attendance ---
  if (input.showAttendance !== false && input.attendance) {
    const att = input.attendance;
    const gaugeSvg = generateAttendanceGauge(att.percentage, 50, 44);
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="30" rx="2" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.2"/>`);
    els.push(`<g transform="translate(${sx + 6}, ${yPos - 2})">${gaugeSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`);
    const attItems = [
      { l: 'Days Open', v: String(att.totalDays) },
      { l: 'Present', v: String(att.daysPresent) },
      { l: 'Absent', v: String(att.daysAbsent) },
      { l: 'Attendance %', v: `${att.percentage}%` },
    ];
    const acw = (contentW - 64) / attItems.length;
    attItems.forEach((ai, i) => {
      const xx = sx + 62 + i * acw + acw / 2;
      els.push(`<text x="${xx}" y="${yPos + 10}" text-anchor="middle" font-size="4" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(ai.l)}</text>
<text x="${xx}" y="${yPos + 20}" text-anchor="middle" font-size="6.5" font-weight="700" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">${esc(ai.v)}</text>`);
    });
    yPos += 34;
  }

  // --- Remarks ---
  els.push(`<text x="${sx}" y="${yPos}" font-size="6" font-weight="600" fill="${tc}" font-family="${GEIST_FONT_FAMILY}">Remarks</text>`);
  yPos += 6;

  const remarks = [
    { l: "Teacher's Remark", v: input.teacherComment, sn: input.domainGrade?.classTeacherName },
    { l: "Principal's Remark", v: input.principalComment || input.domainGrade?.principalComment, sn: input.settings.principalName },
  ];
  remarks.forEach((r) => {
    if (!r.v) return;
    const rh = 16;
    els.push(`<rect x="${sx}" y="${yPos}" width="${contentW}" height="${rh}" rx="1.5" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.2"/>`);
    wrapText(r.v, 90).forEach((l, i) => {
      els.push(`<text x="${sx + 3}" y="${yPos + 5 + i * 4.5}" font-size="4.5" fill="#475569" font-family="${GEIST_FONT_FAMILY}">${esc(l)}</text>`);
    });
    if (r.sn) {
      els.push(`<text x="${sx + contentW - 3}" y="${yPos + rh - 3}" text-anchor="end" font-size="4" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">${esc(r.l)}: ${esc(r.sn)}</text>`);
    }
    yPos += rh + 1;
  });

  // --- Signatures ---
  yPos += 1;
  els.push(`<line x1="${sx}" y1="${yPos}" x2="${sx + contentW}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.3"/>`);
  yPos += 3;
  els.push(`<text x="${sx}" y="${yPos}" font-size="4.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">Class Teacher: _________________</text>
<text x="${sx + contentW / 2}" y="${yPos}" font-size="4.5" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">Principal: _________________</text>`);

  // --- Footer ---
  const footerY = PAGE_H - 8;
  els.push(`<line x1="${sx}" y1="${footerY}" x2="${sx + contentW}" y2="${footerY}" stroke="#e2e8f0" stroke-width="0.3"/>`);
  els.push(`<text x="${sx}" y="${footerY + 6}" font-size="4" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">Generated by Skoolar · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</text>`);
  if (input.settings.nextTermBegins) {
    els.push(`<text x="${PAGE_W - sx}" y="${footerY + 6}" text-anchor="end" font-size="4" fill="${muted}" font-family="${GEIST_FONT_FAMILY}">Next Term Begins: ${esc(input.settings.nextTermBegins)}</text>`);
  }

  // --- Watermark ---
  if (input.watermarkText) {
    els.push(`<text x="${PAGE_W / 2}" y="${PAGE_H / 2}" text-anchor="middle" dominant-baseline="central" font-size="36" fill="${pc}" opacity="0.04" font-family="${GEIST_FONT_FAMILY}" font-weight="700" transform="rotate(-30, ${PAGE_W / 2}, ${PAGE_H / 2})">${esc(input.watermarkText)}</text>`);
  }

  els.push('</svg>');
  return els.join('\n');
}

export async function renderReportCardPng(svg: string): Promise<Uint8Array> {
  await ensureResvgInit();
  const w = Math.round(A4.WIDTH_MM * A4.EXPORT_SCALE);
  const h = Math.round(A4.HEIGHT_MM * A4.EXPORT_SCALE);
  const geistBytes = Buffer.from(GEIST_REGULAR_BASE64, 'base64');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: w },
    font: { fontBuffers: [new Uint8Array(geistBytes)], defaultFontFamily: GEIST_FONT_FAMILY },
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
