/**
 * Report Card PDF generator.
 *
 * Renders a full A4 report card as SVG, rasterises to PNG with @resvg/resvg-wasm,
 * then embeds the PNG into a PDF document with pdf-lib.
 *
 * This pipeline is stream-free and works in Cloudflare Workers (the previous
 * implementation relied on pdfkit's Node.js streams which are not reliably
 * supported in the Workers runtime).
 */

import { Resvg } from '@resvg/resvg-wasm';
import { ensureResvgInit } from '@/lib/id-card-utils/init-resvg';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';
import { REPORT_CARD_SCALE } from '@/lib/grade-calculator';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReportCardSubjectResult {
  subjectId: string;
  subjectName: string;
  caScore: number;
  examScore: number;
  total: number;
  grade: string;
  remark: string;
  scoresByType?: Record<string, { raw: number; max: number; normalized: number }>;
}

export interface ReportCardDomainGrade {
  cognitive: Record<string, string | null>;
  psychomotor: Record<string, string | null>;
  affective: Record<string, string | null>;
  classTeacherComment?: string | null;
  classTeacherName?: string | null;
  principalComment?: string | null;
  principalName?: string | null;
}

export interface ReportCardScoreType {
  id: string;
  name: string;
  weight: number;
}

export interface ReportCardPdfInput {
  student: {
    name: string;
    admissionNo: string;
    gender?: string | null;
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
    photoBase64?: string | null;
    classPosition?: string;
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
    vicePrincipalName?: string | null;
    nextTermBegins?: string | null;
    academicSession?: string | null;
  } | null;
  term: {
    name: string;
    academicYear: string;
  };
  cls: {
    name: string;
    section?: string | null;
    grade?: string | null;
    classTeacher?: string | null;
  };
  subjectResults: ReportCardSubjectResult[];
  scoreTypes: ReportCardScoreType[];
  attendance: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    percentage: number;
  };
  domainGrade: ReportCardDomainGrade | null;
  isThirdTerm: boolean;
  totals: {
    grandTotal: number;
    averageScore: number;
    overallGrade: string;
    overallRemark: string;
    classRank: number | null;
    totalStudents: number;
    passed: number;
    failed: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MM = (mm: number) => Math.round((mm / 25.4) * 96);
const PX = (pt: number) => Math.round(pt * (96 / 72));

const esc = (s: unknown): string => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const truncate = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s;

const adj = (c: string, a: number): string => {
  const h = c.replace('#', '');
  const cl = (x: number) => Math.max(0, Math.min(255, x));
  const r = cl(parseInt(h.slice(0, 2), 16) + a);
  const g = cl(parseInt(h.slice(2, 4), 16) + a);
  const b = cl(parseInt(h.slice(4, 6), 16) + a);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const gradeColor = (grade: string): string => {
  switch (grade) {
    case 'A':
    case 'A+':
      return '#047857';
    case 'B':
      return '#2563eb';
    case 'C':
      return '#d97706';
    case 'D':
      return '#ea580c';
    case 'E':
      return '#ef4444';
    case 'F':
      return '#b91c1c';
    default:
      return '#4b5563';
  }
};

const termLabel = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('first') || lower.includes('1st')) return '1ST';
  if (lower.includes('second') || lower.includes('2nd')) return '2ND';
  if (lower.includes('third') || lower.includes('3rd')) return '3RD';
  return name.toUpperCase();
};

const ratingLabel = (val?: string | null): string => {
  if (!val) return '';
  const map: Record<string, string> = {
    '5': 'Excellent',
    '4': 'Very Good',
    '3': 'Good',
    '2': 'Fair',
    '1': 'Poor',
  };
  return map[val] || val;
};

const formatDate = (d?: string | null): string => {
  if (!d) return '—';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

// ─── Shared helpers for SVG builder ──────────────────────────────────────

interface SvgBuildCtx {
  W: number; H: number; M: number;
  color: string; colorDk: string; colorLt: string;
  colorFaint: string; colorBg: string;
  fontStack: string; style: string;
  input: ReportCardPdfInput;
}

function buildSvgContext(input: ReportCardPdfInput): SvgBuildCtx {
  const W = MM(210);
  const H = MM(297);
  const M = MM(12);
  const color = input.school.primaryColor || '#059669';
  const colorDk = adj(color, -25);
  const colorLt = adj(color, 35);
  const colorFaint = adj(color, 70);
  const colorBg = adj(color, 85);
  const fontStack = `'${GEIST_FONT_FAMILY}', 'Inter', 'Segoe UI', Arial, sans-serif`;
  const style = `<style>
    * { font-family: ${fontStack}; }
    text { font-family: ${fontStack}; }
  </style>`;
  return { W, H, M, color, colorDk, colorLt, colorFaint, colorBg, fontStack, style, input };
}

function pageFooter(ctx: SvgBuildCtx, y: number, showNextTerm: boolean): string {
  const { M, W, color } = ctx;
  const nextTerm = showNextTerm && ctx.input.settings?.nextTermBegins
    ? (() => {
        try {
          return new Date(ctx.input.settings!.nextTermBegins!).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
        } catch { return ''; }
      })()
    : '';
  return `
    <line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="#d1d5af" stroke-width="0.5"/>
    ${nextTerm ? `<text x="${M}" y="${y + MM(4)}" font-size="${MM(3.2)}" font-weight="600" fill="#374151">Next Term Begins: <tspan fill="${color}">${esc(nextTerm)}</tspan></text>` : ''}
    <text x="${W - M}" y="${y + MM(4)}" font-size="${MM(2.8)}" fill="#9ca3af" text-anchor="end">Printed: ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</text>
    <text x="${W / 2}" y="${y + MM(8)}" font-size="${MM(2.4)}" fill="#d1d5db" text-anchor="middle" letter-spacing="2">SKOOLAR • SCHOOL MANAGEMENT</text>
  `;
}

// ─── Page 1 SVG Builder (Header + Banner + Student Info + Score Table + Summary) ───

function buildPage1Svg(ctx: SvgBuildCtx): string {
  const { W, H, M, color, colorDk, colorLt, colorFaint, colorBg, fontStack, style, input } = ctx;
  const MM2 = (mm: number) => Math.round((mm / 25.4) * 96);

  // ── HEADER ──
  const logoSize = MM2(18);
  const headerY = M;
  const headerH = MM2(22);
  const logoX = W / 2 - MM2(45);
  const logoY = headerY + (headerH - logoSize) / 2;

  let logoBlock = '';
  if (input.school.logoBase64) {
    logoBlock = `<image href="${input.school.logoBase64}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    const initials = esc((input.school.name || 'S').charAt(0).toUpperCase());
    logoBlock = `
      <circle cx="${logoX + logoSize / 2}" cy="${logoY + logoSize / 2}" r="${logoSize / 2}" fill="${color}"/>
      <text x="${logoX + logoSize / 2}" y="${logoY + logoSize / 2 + MM2(2.5)}" font-size="${MM2(6.5)}" font-weight="700" fill="#ffffff" text-anchor="middle">${initials}</text>
    `;
  }

  const headerText = `
    <text x="${W / 2 + MM2(8)}" y="${headerY + MM2(7)}" font-size="${MM2(5.2)}" font-weight="700" fill="#111827" text-anchor="middle">${truncate(esc(input.school.name || 'School Name').toUpperCase(), 40)}</text>
    ${input.school.address ? `<text x="${W / 2 + MM2(8)}" y="${headerY + MM2(11)}" font-size="${MM2(3.4)}" fill="#6b7280" text-anchor="middle">${truncate(esc(input.school.address), 60)}</text>` : ''}
    ${input.school.motto ? `<text x="${W / 2 + MM2(8)}" y="${headerY + MM2(15)}" font-size="${MM2(3.4)}" font-style="italic" fill="${color}" text-anchor="middle">"${truncate(esc(input.school.motto), 60)}"</text>` : ''}
    ${(input.school.phone || input.school.email || input.school.website) ? `<text x="${W / 2 + MM2(8)}" y="${headerY + MM2(19)}" font-size="${MM2(3.2)}" fill="#9ca3af" text-anchor="middle">${esc([input.school.phone, input.school.email, input.school.website].filter(Boolean).join(' | '))}</text>` : ''}
  `;

  // ── BANNER ──
  const bannerY = headerY + headerH + MM2(3);
  const academicSession = input.settings?.academicSession || input.term.academicYear || '—';
  const bannerBlock = `
    <text x="${W / 2}" y="${bannerY}" font-size="${MM2(3.6)}" fill="#6b7280" text-anchor="middle">Academic Session: ${esc(academicSession)}</text>
    <rect x="${W / 2 - MM2(40)}" y="${bannerY + MM2(2)}" width="${MM2(80)}" height="${MM2(7.5)}" fill="${color}" rx="1"/>
    <text x="${W / 2}" y="${bannerY + MM2(6.8)}" font-size="${MM2(4.2)}" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">END OF ${esc(termLabel(input.term.name))} TERM REPORT CARD</text>
  `;

  // ── STUDENT INFO ──
  const infoY = bannerY + MM2(14);
  const infoH = MM2(34);
  const photoSize = MM2(22);
  const infoX = M;
  const infoW = W - M * 2;
  const photoX = infoX + infoW - photoSize - MM2(2);
  const photoY = infoY + (infoH - photoSize) / 2;
  const textX = infoX + MM2(2);
  const textW = infoW - photoSize - MM2(6);
  const col1X = textX;
  const col2X = textX + textW / 2;
  const rowH = MM2(5.5);

  const fieldsLeft: [string, string][] = [
    ['Student Name:', input.student.name || '—'],
    ['Admission No:', input.student.admissionNo || '—'],
    ['Class:', `${input.cls.name || '—'}${input.cls.section ? ` (${input.cls.section})` : ''}`],
    ['Gender:', input.student.gender || '—'],
    ['Term Begins:', formatDate(null)],
  ];
  const fieldsRight: [string, string][] = [
    ['Date of Birth:', formatDate(input.student.dateOfBirth)],
    ['Blood Group:', input.student.bloodGroup || '—'],
    ['No. in Class:', String(input.totals.totalStudents || '—')],
    ['Position:', input.totals.classRank
      ? `${input.totals.classRank}${input.totals.classRank === 1 ? 'st' : input.totals.classRank === 2 ? 'nd' : input.totals.classRank === 3 ? 'rd' : 'th'} of ${input.totals.totalStudents || '—'}`
      : '—'],
  ];

  const studentInfoRows = (cols: [string, string][], xBase: number): string => {
    return cols.map(([lbl, val], i) => {
      const yy = infoY + MM2(4) + i * rowH;
      return `
        <text x="${xBase}" y="${yy}" font-size="${MM2(3.2)}" fill="#9ca3af">${esc(lbl)}</text>
        <text x="${xBase + MM2(20)}" y="${yy}" font-size="${MM2(3.6)}" font-weight="600" fill="#111827">${truncate(esc(val), 28)}</text>
      `;
    }).join('\n');
  };

  let studentPhoto = '';
  if (input.student.photoBase64) {
    studentPhoto = `<image href="${input.student.photoBase64}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice"/>`;
  } else {
    const ini = esc((input.student.name || 'NA').split(' ').map((s) => s[0] || '').join('').slice(0, 2).toUpperCase());
    studentPhoto = `
      <circle cx="${photoX + photoSize / 2}" cy="${photoY + photoSize / 2}" r="${photoSize / 2}" fill="${colorBg}"/>
      <text x="${photoX + photoSize / 2}" y="${photoY + photoSize / 2 + MM2(3)}" font-size="${MM2(7)}" font-weight="700" fill="${color}" text-anchor="middle">${ini}</text>
    `;
  }

  const studentInfoBlock = `
    <rect x="${infoX}" y="${infoY}" width="${infoW}" height="${infoH}" rx="${MM2(2)}" fill="#f9fafb" stroke="${color}" stroke-width="0.75" stroke-opacity="0.25"/>
    ${studentInfoRows(fieldsLeft, col1X)}
    ${studentInfoRows(fieldsRight, col2X)}
    ${studentPhoto}
  `;

  // ── SCORE TABLE (same logic as original) ──
  const tableY = infoY + infoH + MM2(3);
  const tableX = M;
  const tableW = W - M * 2;
  const tablePadX = MM2(4);

  const hasDynamicCols = input.scoreTypes.length > 0;
  const scoreTypeCols = hasDynamicCols ? input.scoreTypes : [];
  const numScoreCols = scoreTypeCols.length;
  const snW = MM2(7);
  const subjectW = MM2(38);
  const gradeW = MM2(9);
  const remarkW = MM2(20);
  const totalW = MM2(10);
  const dynamicW = numScoreCols > 0 ? Math.min(MM2(14), (tableW - snW - subjectW - totalW - gradeW - remarkW) / numScoreCols) : 0;

  const colXs: number[] = [];
  let cx = tableX;
  colXs.push(cx); cx += snW;
  colXs.push(cx); cx += subjectW;
  for (let i = 0; i < numScoreCols; i++) { colXs.push(cx); cx += dynamicW; }
  colXs.push(cx); cx += totalW;
  colXs.push(cx); cx += gradeW;

  const headerH2 = MM2(8);
  const rowH2 = MM2(5.5);

  const headerCells: string[] = [];
  headerCells.push(`<rect x="${colXs[0]}" y="${tableY}" width="${snW}" height="${headerH2}" fill="${color}"/>`);
  headerCells.push(`<text x="${colXs[0] + snW / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">S/N</text>`);
  headerCells.push(`<text x="${colXs[1] + tablePadX / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#ffffff" text-anchor="start">Subject</text>`);
  scoreTypeCols.forEach((st, i) => {
    const x = colXs[2 + i];
    headerCells.push(`<text x="${x + dynamicW / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(2.8)}" font-weight="700" fill="#ffffff" text-anchor="middle">${truncate(esc(st.name), 10)} (${st.weight})</text>`);
  });
  if (hasDynamicCols) {
    const x = colXs[2 + numScoreCols];
    headerCells.push(`<text x="${x + totalW / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Total (100)</text>`);
  } else {
    const caX = colXs[2];
    const exX = caX + (tableW - snW - subjectW - totalW - gradeW - remarkW) / 2;
    headerCells.push(`<text x="${caX + (exX - caX) / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">CA (40)</text>`);
    headerCells.push(`<text x="${exX + (colXs[3] - exX) / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Exam (60)</text>`);
  }
  const grX = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
  headerCells.push(`<text x="${grX + totalW / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Total</text>`);
  const gradeColX = hasDynamicCols ? colXs[4 + numScoreCols] : colXs[6];
  headerCells.push(`<text x="${gradeColX + gradeW / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Grade</text>`);
  const remarkColX = gradeColX + gradeW;
  const remarkColW = tableX + tableW - remarkColX;
  headerCells.push(`<text x="${remarkColX + remarkColW / 2}" y="${tableY + headerH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Remark</text>`);

  const tableRows: string[] = [];
  let rowIdx = 0;
  for (const sr of input.subjectResults) {
    const yy = tableY + headerH2 + rowIdx * rowH2;
    const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
    tableRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH2}" fill="${bg}"/>`);
    tableRows.push(`<text x="${colXs[0] + snW / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" fill="#6b7280" text-anchor="middle">${rowIdx + 1}</text>`);
    tableRows.push(`<text x="${colXs[1] + tablePadX / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.4)}" font-weight="500" fill="#111827" text-anchor="start">${truncate(esc(sr.subjectName), 22)}</text>`);
    if (hasDynamicCols) {
      scoreTypeCols.forEach((st, i) => {
        const x = colXs[2 + i];
        const v = sr.scoresByType?.[st.id];
        const display = v && v.max > 0 ? String(Math.round(v.normalized)) : '—';
        tableRows.push(`<text x="${x + dynamicW / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" fill="#374151" text-anchor="middle">${display}</text>`);
      });
      const tx = colXs[2 + numScoreCols];
      tableRows.push(`<text x="${tx + totalW / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    } else {
      const caX = colXs[2];
      const exX = caX + (tableW - snW - subjectW - totalW - gradeW - remarkW) / 2;
      tableRows.push(`<text x="${caX + (exX - caX) / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" fill="#374151" text-anchor="middle">${Math.round(sr.caScore || 0)}</text>`);
      tableRows.push(`<text x="${exX + (colXs[3] - exX) / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" fill="#374151" text-anchor="middle">${Math.round(sr.examScore || 0)}</text>`);
      const tx = colXs[5];
      tableRows.push(`<text x="${tx + totalW / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    }
    const grX2 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
    tableRows.push(`<text x="${grX2 + gradeW / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.4)}" font-weight="700" fill="${gradeColor(sr.grade)}" text-anchor="middle">${esc(sr.grade)}</text>`);
    tableRows.push(`<text x="${remarkColX + MM2(2)}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" fill="#6b7280" text-anchor="start">${truncate(esc(sr.remark), 18)}</text>`);
    rowIdx++;
  }
  if (input.subjectResults.length > 0) {
    const yy = tableY + headerH2 + rowIdx * rowH2;
    tableRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH2}" fill="${colorFaint}"/>`);
    const totalSubjects = input.subjectResults.length;
    const labelX = colXs[0];
    const labelW = hasDynamicCols ? (colXs[2 + numScoreCols] - colXs[0]) : (colXs[4] - colXs[0]);
    tableRows.push(`<text x="${labelX + labelW - MM2(2)}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.4)}" font-weight="700" fill="#111827" text-anchor="end">Total / ${totalSubjects * 100}</text>`);
    const tx = hasDynamicCols ? colXs[2 + numScoreCols] : colXs[5];
    tableRows.push(`<text x="${tx + totalW / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.4)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(input.totals.grandTotal)}</text>`);
    const grX3 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
    tableRows.push(`<text x="${grX3 + gradeW / 2}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.4)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(input.totals.overallGrade)}</text>`);
    tableRows.push(`<text x="${remarkColX + MM2(2)}" y="${yy + rowH2 / 2 + MM2(1)}" font-size="${MM2(3.2)}" fill="#374151" text-anchor="start">${truncate(esc(input.totals.overallRemark), 18)}</text>`);
  }

  const tableBlock = `
    <rect x="${tableX}" y="${tableY}" width="${tableW}" height="${headerH2 + rowIdx * rowH2 + (input.subjectResults.length > 0 ? rowH2 : 0)}" rx="${MM2(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.75" stroke-opacity="0.25"/>
    ${headerCells.join('\n')}
    ${tableRows.join('\n')}
  `;

  // ── SUMMARY GRID ──
  const summaryY = tableY + headerH2 + rowIdx * rowH2 + (input.subjectResults.length > 0 ? rowH2 : 0) + MM2(3);
  const summaryH = MM2(16);
  const sumCellW = (tableW - MM2(3) * 3) / 4;
  const summary = [
    { label: 'Total Score', value: String(Math.round(input.totals.grandTotal)), sub: `out of ${input.subjectResults.length * 100}` },
    { label: 'Average', value: `${input.totals.averageScore.toFixed(1)}%`, sub: `${input.subjectResults.length} subjects` },
    { label: 'Grade', value: input.totals.overallGrade, sub: input.totals.overallRemark },
    { label: 'Position', value: String(input.totals.classRank || '—'), sub: `out of ${input.totals.totalStudents || '—'}` },
  ];
  const summaryBlock = summary.map((s, i) => {
    const x = tableX + i * (sumCellW + MM2(3));
    return `
      <rect x="${x}" y="${summaryY}" width="${sumCellW}" height="${summaryH}" rx="${MM2(1.5)}" fill="${colorBg}" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
      <text x="${x + sumCellW / 2}" y="${summaryY + MM2(4)}" font-size="${MM2(2.8)}" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">${esc(s.label.toUpperCase())}</text>
      <text x="${x + sumCellW / 2}" y="${summaryY + MM2(9.5)}" font-size="${MM2(5.5)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(s.value)}</text>
      <text x="${x + sumCellW / 2}" y="${summaryY + MM2(13)}" font-size="${MM2(2.6)}" fill="#9ca3af" text-anchor="middle">${esc(s.sub)}</text>
    `;
  }).join('\n');

  // ── Footer for Page 1 ──
  const footerY = H - MM2(10);
  const footer = pageFooter(ctx, footerY, false);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${style}
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${W}" height="${MM2(3)}" fill="${color}"/>
    ${logoBlock}
    ${headerText}
    ${bannerBlock}
    ${studentInfoBlock}
    ${tableBlock}
    ${summaryBlock}
    ${footer}
  </svg>`;
}

// ─── Page 2 SVG Builder (Attendance + Grading Key + Comments + Domain Grading) ───

function buildPage2Svg(ctx: SvgBuildCtx): string {
  const { W, H, M, color, colorDk, colorLt, colorFaint, colorBg, fontStack, style, input } = ctx;
  const MM2 = (mm: number) => Math.round((mm / 25.4) * 96);

  const tableX = M;
  const tableW = W - M * 2;
  const halfW = (tableW - MM2(3)) / 2;
  const gradeKeyX = tableX + halfW + MM2(3);

  // ── Header for page 2 (compact continuation label) ──
  const topY = M + MM2(3);
  const headerBlock = `
    <text x="${W / 2}" y="${topY}" font-size="${MM2(4)}" font-weight="700" fill="${color}" text-anchor="middle">CONTINUATION — REPORT CARD SUMMARY</text>
    <text x="${W / 2}" y="${topY + MM2(5)}" font-size="${MM2(3.2)}" fill="#6b7280" text-anchor="middle">${esc(input.student.name)} · ${esc(input.cls.name || '')} · ${esc(input.term.name)} Term ${input.term.academicYear}</text>
    <line x1="${M}" y1="${topY + MM2(7)}" x2="${W - M}" y2="${topY + MM2(7)}" stroke="${color}" stroke-width="0.5"/>
  `;

  // ── ATTENDANCE ──
  const attendanceY = topY + MM2(10);
  const lowerH = MM2(22);
  const attendanceBlock = `
    <rect x="${tableX}" y="${attendanceY}" width="${halfW}" height="${lowerH}" rx="${MM2(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
    <text x="${tableX + MM2(3)}" y="${attendanceY + MM2(4.5)}" font-size="${MM2(3.4)}" font-weight="700" fill="${color}" letter-spacing="0.5">ATTENDANCE</text>
    <text x="${tableX + MM2(3)}" y="${attendanceY + MM2(9.5)}" font-size="${MM2(3.2)}" fill="#6b7280">Total School Days:</text>
    <text x="${tableX + MM2(38)}" y="${attendanceY + MM2(9.5)}" font-size="${MM2(3.2)}" font-weight="600" fill="#111827">${input.attendance.totalDays}</text>
    <text x="${tableX + MM2(3)}" y="${attendanceY + MM2(13.5)}" font-size="${MM2(3.2)}" fill="#6b7280">Days Present:</text>
    <text x="${tableX + MM2(38)}" y="${attendanceY + MM2(13.5)}" font-size="${MM2(3.2)}" font-weight="600" fill="#047857">${input.attendance.presentDays}</text>
    <text x="${tableX + MM2(3)}" y="${attendanceY + MM2(17.5)}" font-size="${MM2(3.2)}" fill="#6b7280">Days Absent:</text>
    <text x="${tableX + MM2(38)}" y="${attendanceY + MM2(17.5)}" font-size="${MM2(3.2)}" font-weight="600" fill="#dc2626">${input.attendance.absentDays}</text>
    <text x="${tableX + MM2(halfW - MM2(3))}" y="${attendanceY + MM2(13.5)}" font-size="${MM2(3.4)}" font-weight="700" fill="${color}" text-anchor="end">${input.attendance.percentage}%</text>
  `;

  // ── GRADING KEY ──
  const grades = [
    { grade: 'A', range: '70 - 100', remark: 'Excellent' },
    { grade: 'B', range: '60 - 69', remark: 'Very Good' },
    { grade: 'C', range: '50 - 59', remark: 'Good' },
    { grade: 'D', range: '40 - 49', remark: 'Fair' },
    { grade: 'E', range: '30 - 39', remark: 'Poor' },
    { grade: 'F', range: '0 - 29', remark: 'Fail' },
  ];
  const gradeRows = grades.map((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cellW = (halfW - MM2(4)) / 2;
    const cellX = gradeKeyX + MM2(2) + col * (cellW + MM2(2));
    const cellY = attendanceY + MM2(7) + row * MM2(5);
    return `
      <rect x="${cellX}" y="${cellY}" width="${cellW}" height="${MM2(4.2)}" rx="${MM2(0.8)}" fill="${colorBg}"/>
      <text x="${cellX + MM2(1.5)}" y="${cellY + MM2(2.9)}" font-size="${MM2(3)}" font-weight="700" fill="${color}">${g.grade}</text>
      <text x="${cellX + MM2(5)}" y="${cellY + MM2(2.9)}" font-size="${MM2(2.6)}" fill="#6b7280">${g.range} · ${g.remark}</text>
    `;
  }).join('\n');
  const gradingKeyBlock = `
    <rect x="${gradeKeyX}" y="${attendanceY}" width="${halfW}" height="${lowerH}" rx="${MM2(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
    <text x="${gradeKeyX + MM2(3)}" y="${attendanceY + MM2(4.5)}" font-size="${MM2(3.4)}" font-weight="700" fill="${color}" letter-spacing="0.5">GRADING KEY</text>
    ${gradeRows}
  `;

  // ── COMMENTS ──
  const commentsY = attendanceY + lowerH + MM2(3);
  const commentsH = MM2(24);
  const teacherComment = input.domainGrade?.classTeacherComment || '';
  const teacherName = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Class Teacher';
  const principalComment = input.domainGrade?.principalComment || '';
  const principalName = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';

  const commentBlock = `
    <rect x="${tableX}" y="${commentsY}" width="${halfW}" height="${commentsH}" rx="${MM2(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
    <text x="${tableX + MM2(3)}" y="${commentsY + MM2(4.5)}" font-size="${MM2(3.4)}" font-weight="700" fill="${color}">CLASS TEACHER&apos;S REMARKS</text>
    <text x="${tableX + MM2(3)}" y="${commentsY + MM2(9.5)}" font-size="${MM2(3.2)}" font-style="italic" fill="#374151">${truncate(esc(teacherComment || 'No comment yet.'), 80)}</text>
    <line x1="${tableX + MM2(3)}" y1="${commentsY + MM2(18)}" x2="${tableX + halfW - MM2(3)}" y2="${commentsY + MM2(18)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>
    <text x="${tableX + halfW / 2}" y="${commentsY + MM2(21)}" font-size="${MM2(2.8)}" fill="#6b7280" text-anchor="middle">${esc(teacherName)}</text>
  `;

  const principalBlock = `
    <rect x="${gradeKeyX}" y="${commentsY}" width="${halfW}" height="${commentsH}" rx="${MM2(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
    <text x="${gradeKeyX + MM2(3)}" y="${commentsY + MM2(4.5)}" font-size="${MM2(3.4)}" font-weight="700" fill="${color}">PRINCIPAL&apos;S REMARKS</text>
    <text x="${gradeKeyX + MM2(3)}" y="${commentsY + MM2(9.5)}" font-size="${MM2(3.2)}" font-style="italic" fill="#374151">${truncate(esc(principalComment || 'No comment yet.'), 80)}</text>
    <line x1="${gradeKeyX + MM2(3)}" y1="${commentsY + MM2(18)}" x2="${gradeKeyX + halfW - MM2(3)}" y2="${commentsY + MM2(18)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>
    <text x="${gradeKeyX + halfW / 2}" y="${commentsY + MM2(21)}" font-size="${MM2(2.8)}" fill="#6b7280" text-anchor="middle">${esc(principalName)}</text>
  `;

  // ── 3RD TERM DOMAIN GRADING ──
  let domainBlock = '';
  if (input.isThirdTerm && input.domainGrade) {
    const dg = input.domainGrade;
    const domains: { title: string; data: Record<string, string | null>; keys: string[] }[] = [
      { title: 'COGNITIVE', data: dg.cognitive, keys: ['reasoning', 'memory', 'concentration', 'problemSolving', 'initiative'] },
      { title: 'PSYCHOMOTOR', data: dg.psychomotor, keys: ['handwriting', 'sports', 'drawing', 'practical'] },
      { title: 'AFFECTIVE', data: dg.affective, keys: ['punctuality', 'neatness', 'honesty', 'leadership', 'cooperation', 'attentiveness', 'obedience', 'selfControl', 'politeness'] },
    ];
    const dStartY = commentsY + commentsH + MM2(3);
    const dHeight = MM2(30);
    const dColW = (tableW - MM2(4)) / 3;
    const labelMap: Record<string, string> = {
      reasoning: 'Reasoning', memory: 'Memory', concentration: 'Concentration', problemSolving: 'Problem Solving', initiative: 'Initiative',
      handwriting: 'Handwriting', sports: 'Sports', drawing: 'Drawing', practical: 'Practical',
      punctuality: 'Punctuality', neatness: 'Neatness', honesty: 'Honesty', leadership: 'Leadership', cooperation: 'Cooperation',
      attentiveness: 'Attentiveness', obedience: 'Obedience', selfControl: 'Self Control', politeness: 'Politeness',
    };
    domainBlock = `
      <rect x="${tableX}" y="${dStartY}" width="${tableW}" height="${dHeight}" rx="${MM2(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.4"/>
      <text x="${tableX + tableW / 2}" y="${dStartY + MM2(4.5)}" font-size="${MM2(3.4)}" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="0.5">AFFECTIVE, PSYCHOMOTOR &amp; COGNITIVE DOMAIN GRADING</text>
      ${domains.map((dom, di) => {
        const dx = tableX + MM2(1) + di * (dColW + MM2(1));
        const rowItems = dom.keys.slice(0, 9).map((k, i) => {
          const v = dom.data[k];
          const yPos = dStartY + MM2(10) + i * MM2(2);
          return `
            <text x="${dx + MM2(1.5)}" y="${yPos}" font-size="${MM2(2.8)}" fill="#374151">${esc(labelMap[k] || k)}:</text>
            <text x="${dx + dColW - MM2(1.5)}" y="${yPos}" font-size="${MM2(2.8)}" font-weight="600" fill="${v ? color : '#d1d5db'}" text-anchor="end">${v ? esc(ratingLabel(v)) : '—'}</text>
          `;
        }).join('\n');
        const avgY = dStartY + dHeight - MM2(3);
        return `
          <text x="${dx + dColW / 2}" y="${dStartY + MM2(8)}" font-size="${MM2(2.8)}" font-weight="700" fill="${color}" text-anchor="middle">${dom.title}</text>
          ${rowItems}
          <line x1="${dx + MM2(1.5)}" y1="${avgY - MM2(1.5)}" x2="${dx + dColW - MM2(1.5)}" y2="${avgY - MM2(1.5)}" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
          <text x="${dx + dColW / 2}" y="${avgY}" font-size="${MM2(3)}" font-weight="700" fill="${color}" text-anchor="middle">Avg: ${dom.data.average ? esc(ratingLabel(dom.data.average)) + ' (' + dom.data.average + ')' : '—'}</text>
        `;
      }).join('\n')}
    `;
  }

  // ── Footer for Page 2 ──
  const footerY = H - MM2(10);
  const footer = pageFooter(ctx, footerY, true);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${style}
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${W}" height="${MM2(3)}" fill="${color}"/>
    ${headerBlock}
    ${attendanceBlock}
    ${gradingKeyBlock}
    ${commentBlock}
    ${principalBlock}
    ${domainBlock}
    ${footer}
  </svg>`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Render a report card as a PDF buffer.
 *
 * Pipeline: build SVG → rasterise to PNG via @resvg/resvg-wasm → embed PNG into a
 * single A4 page via pdf-lib. No Node.js streams are used so this is safe to
 * run inside Cloudflare Workers.
 */
export async function renderReportCardPdf(input: ReportCardPdfInput): Promise<Buffer> {
  await ensureResvgInit();

  const ctx = buildSvgContext(input);

  // Load fonts
  const geistBuffer = Buffer.from(GEIST_REGULAR_BASE64, 'base64');
  let arabicBuffer: Buffer | null = null;
  try {
    const { ARABIC_FONT_BASE64 } = await import('@/lib/id-card-utils/arabic-font-data');
    arabicBuffer = Buffer.from(ARABIC_FONT_BASE64, 'base64');
  } catch {
    // Arabic font not available — continue without it
  }
  const fontBuffers = arabicBuffer
    ? [new Uint8Array(arabicBuffer), new Uint8Array(geistBuffer)]
    : [new Uint8Array(geistBuffer)];

  // Update the SVG font-family to include Arabic font
  const fontStack = arabicBuffer
    ? `'Noto Naskh Arabic', '${GEIST_FONT_FAMILY}', 'Inter', 'Segoe UI', Arial, sans-serif`
    : ctx.fontStack;
  const style = `<style>
    * { font-family: ${fontStack}; }
    text { font-family: ${fontStack}; }
  </style>`;
  const enrichedCtx = { ...ctx, fontStack, style };

  const page1Svg = buildPage1Svg(enrichedCtx);
  const page2Svg = buildPage2Svg(enrichedCtx);

  // Render SVG → PNG helpers
  const renderSvgToPng = (svg: string): Buffer => {
    const r = new Resvg(svg, {
      background: 'white',
      fitTo: { mode: 'width', value: MM(210) },
      font: { fontBuffers, defaultFontFamily: GEIST_FONT_FAMILY },
    });
    return Buffer.from(r.render().asPng());
  };

  const png1 = renderSvgToPng(page1Svg);
  const png2 = renderSvgToPng(page2Svg);

  // Embed PNGs into a 2-page A4 PDF
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const a4w = PX(595);
  const a4h = PX(842);

  const embedAndDraw = async (pngBuf: Buffer): Promise<void> => {
    const page = pdfDoc.addPage([a4w, a4h]);
    const img = await pdfDoc.embedPng(pngBuf);
    page.drawImage(img, { x: 0, y: 0, width: a4w, height: a4h });
  };

  await embedAndDraw(png1);
  await embedAndDraw(png2);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
