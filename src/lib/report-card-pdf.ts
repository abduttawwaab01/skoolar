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

// ─── SVG Builder ────────────────────────────────────────────────────────────

function buildReportCardSvg(input: ReportCardPdfInput): string {
  const W = MM(210); // A4 width
  const H = MM(297); // A4 height
  const M = MM(12); // page margin

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

  // ── HEADER ─────────────────────────────────────────────────────────────
  const logoSize = MM(18);
  const headerY = M;
  const headerH = MM(22);
  const logoX = W / 2 - MM(45);
  const logoY = headerY + (headerH - logoSize) / 2;

  let logoBlock = '';
  if (input.school.logoBase64) {
    logoBlock = `<image href="${input.school.logoBase64}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    const initials = esc((input.school.name || 'S').charAt(0).toUpperCase());
    logoBlock = `
      <circle cx="${logoX + logoSize / 2}" cy="${logoY + logoSize / 2}" r="${logoSize / 2}" fill="${color}"/>
      <text x="${logoX + logoSize / 2}" y="${logoY + logoSize / 2 + MM(2.5)}" font-size="${MM(6.5)}" font-weight="700" fill="#ffffff" text-anchor="middle">${initials}</text>
    `;
  }

  const headerText = `
    <text x="${W / 2 + MM(8)}" y="${headerY + MM(7)}" font-size="${MM(5.2)}" font-weight="700" fill="#111827" text-anchor="middle">${truncate(esc(input.school.name || 'School Name').toUpperCase(), 40)}</text>
    ${input.school.address ? `<text x="${W / 2 + MM(8)}" y="${headerY + MM(11)}" font-size="${MM(3.4)}" fill="#6b7280" text-anchor="middle">${truncate(esc(input.school.address), 60)}</text>` : ''}
    ${input.school.motto ? `<text x="${W / 2 + MM(8)}" y="${headerY + MM(15)}" font-size="${MM(3.4)}" font-style="italic" fill="${color}" text-anchor="middle">"${truncate(esc(input.school.motto), 60)}"</text>` : ''}
    ${(input.school.phone || input.school.email || input.school.website) ? `<text x="${W / 2 + MM(8)}" y="${headerY + MM(19)}" font-size="${MM(3.2)}" fill="#9ca3af" text-anchor="middle">${esc([input.school.phone, input.school.email, input.school.website].filter(Boolean).join(' | '))}</text>` : ''}
  `;

  // ── BANNER ────────────────────────────────────────────────────────────
  const bannerY = headerY + headerH + MM(3);
  const academicSession = input.settings?.academicSession || input.term.academicYear || '—';

  const bannerBlock = `
    <text x="${W / 2}" y="${bannerY}" font-size="${MM(3.6)}" fill="#6b7280" text-anchor="middle">Academic Session: ${esc(academicSession)}</text>
    <rect x="${W / 2 - MM(40)}" y="${bannerY + MM(2)}" width="${MM(80)}" height="${MM(7.5)}" fill="${color}" rx="1"/>
    <text x="${W / 2}" y="${bannerY + MM(6.8)}" font-size="${MM(4.2)}" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">END OF ${esc(termLabel(input.term.name))} TERM REPORT CARD</text>
  `;

  // ── STUDENT INFO ──────────────────────────────────────────────────────
  const infoY = bannerY + MM(14);
  const infoH = MM(34);
  const photoSize = MM(22);
  const infoX = M;
  const infoW = W - M * 2;
  const photoX = infoX + infoW - photoSize - MM(2);
  const photoY = infoY + (infoH - photoSize) / 2;
  const textX = infoX + MM(2);
  const textW = infoW - photoSize - MM(6);
  const col1X = textX;
  const col2X = textX + textW / 2;
  const rowH = MM(5.5);

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
    return cols.map(([label, value], i) => {
      const yy = infoY + MM(4) + i * rowH;
      return `
        <text x="${xBase}" y="${yy}" font-size="${MM(3.2)}" fill="#9ca3af">${esc(label)}</text>
        <text x="${xBase + MM(20)}" y="${yy}" font-size="${MM(3.6)}" font-weight="600" fill="#111827">${truncate(esc(value), 28)}</text>
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
      <text x="${photoX + photoSize / 2}" y="${photoY + photoSize / 2 + MM(3)}" font-size="${MM(7)}" font-weight="700" fill="${color}" text-anchor="middle">${ini}</text>
    `;
  }

  const studentInfoBlock = `
    <rect x="${infoX}" y="${infoY}" width="${infoW}" height="${infoH}" rx="${MM(2)}" fill="#f9fafb" stroke="${color}" stroke-width="0.75" stroke-opacity="0.25"/>
    ${studentInfoRows(fieldsLeft, col1X)}
    ${studentInfoRows(fieldsRight, col2X)}
    ${studentPhoto}
  `;

  // ── SCORE TABLE ───────────────────────────────────────────────────────
  const tableY = infoY + infoH + MM(3);
  const tableX = M;
  const tableW = W - M * 2;
  const tablePadX = MM(4);

  const hasDynamicCols = input.scoreTypes.length > 0;
  const scoreTypeCols = hasDynamicCols ? input.scoreTypes : [];
  const numScoreCols = scoreTypeCols.length;
  const totalCols = 2 + numScoreCols + 3; // S/N + Subject + scores + Total + Grade + Remark
  const snW = MM(7);
  const subjectW = MM(38);
  const gradeW = MM(9);
  const remarkW = MM(20);
  const totalW = MM(10);
  const dynamicW = numScoreCols > 0 ? Math.min(MM(14), (tableW - snW - subjectW - totalW - gradeW - remarkW) / numScoreCols) : 0;
  const remainingW = tableW - snW - subjectW - totalW - gradeW - remarkW - (numScoreCols * dynamicW);

  const colXs: number[] = [];
  let cx = tableX;
  colXs.push(cx); cx += snW;
  colXs.push(cx); cx += subjectW;
  for (let i = 0; i < numScoreCols; i++) { colXs.push(cx); cx += dynamicW; }
  // If no score types, push the remaining width into the subject column for CA/Exam split
  if (numScoreCols === 0) {
    // We'll use a fixed CA + Exam split
  }
  colXs.push(cx); cx += totalW;
  colXs.push(cx); cx += gradeW;
  // Remark takes the remaining

  const headerH2 = MM(8);
  const rowH2 = MM(5.5);

  const headerCells: string[] = [];
  // S/N
  headerCells.push(`<rect x="${colXs[0]}" y="${tableY}" width="${snW}" height="${headerH2}" fill="${color}"/>`);
  headerCells.push(`<text x="${colXs[0] + snW / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">S/N</text>`);
  // Subject
  headerCells.push(`<text x="${colXs[1] + tablePadX / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#ffffff" text-anchor="start">Subject</text>`);
  // Score types
  scoreTypeCols.forEach((st, i) => {
    const x = colXs[2 + i];
    headerCells.push(`<text x="${x + dynamicW / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(2.8)}" font-weight="700" fill="#ffffff" text-anchor="middle">${truncate(esc(st.name), 10)} (${st.weight})</text>`);
  });
  // Total
  if (hasDynamicCols) {
    const x = colXs[2 + numScoreCols];
    headerCells.push(`<text x="${x + totalW / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Total (100)</text>`);
  } else {
    // Two fixed columns: CA (40) and Exam (60)
    const caX = colXs[2];
    const exX = caX + (tableW - snW - subjectW - totalW - gradeW - remarkW) / 2;
    headerCells.push(`<text x="${caX + (exX - caX) / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">CA (40)</text>`);
    headerCells.push(`<text x="${exX + (colXs[3] - exX) / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Exam (60)</text>`);
  }
  // Grade
  const grX = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
  const grW = hasDynamicCols ? totalW : totalW;
  headerCells.push(`<text x="${grX + grW / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Total</text>`);

  const gradeColX = hasDynamicCols ? colXs[4 + numScoreCols] : colXs[6];
  headerCells.push(`<text x="${gradeColX + gradeW / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Grade</text>`);
  // Remark takes remaining width
  const remarkColX = gradeColX + gradeW;
  const remarkColW = tableX + tableW - remarkColX;
  headerCells.push(`<text x="${remarkColX + remarkColW / 2}" y="${tableY + headerH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">Remark</text>`);

  const tableRows: string[] = [];
  let rowIdx = 0;
  for (const sr of input.subjectResults) {
    const yy = tableY + headerH2 + rowIdx * rowH2;
    const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
    tableRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH2}" fill="${bg}"/>`);
    tableRows.push(`<text x="${colXs[0] + snW / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.2)}" fill="#6b7280" text-anchor="middle">${rowIdx + 1}</text>`);
    tableRows.push(`<text x="${colXs[1] + tablePadX / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.4)}" font-weight="500" fill="#111827" text-anchor="start">${truncate(esc(sr.subjectName), 22)}</text>`);

    if (hasDynamicCols) {
      scoreTypeCols.forEach((st, i) => {
        const x = colXs[2 + i];
        const v = sr.scoresByType?.[st.id];
        const display = v && v.max > 0 ? String(Math.round(v.normalized)) : '—';
        tableRows.push(`<text x="${x + dynamicW / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.2)}" fill="#374151" text-anchor="middle">${display}</text>`);
      });
      const tx = colXs[2 + numScoreCols];
      tableRows.push(`<text x="${tx + totalW / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    } else {
      const caX = colXs[2];
      const exX = caX + (tableW - snW - subjectW - totalW - gradeW - remarkW) / 2;
      tableRows.push(`<text x="${caX + (exX - caX) / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.2)}" fill="#374151" text-anchor="middle">${Math.round(sr.caScore || 0)}</text>`);
      tableRows.push(`<text x="${exX + (colXs[3] - exX) / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.2)}" fill="#374151" text-anchor="middle">${Math.round(sr.examScore || 0)}</text>`);
      const tx = colXs[5];
      tableRows.push(`<text x="${tx + totalW / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.2)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    }

    const grX2 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
    tableRows.push(`<text x="${grX2 + gradeW / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.4)}" font-weight="700" fill="${gradeColor(sr.grade)}" text-anchor="middle">${esc(sr.grade)}</text>`);
    tableRows.push(`<text x="${remarkColX + MM(2)}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.2)}" fill="#6b7280" text-anchor="start">${truncate(esc(sr.remark), 18)}</text>`);
    rowIdx++;
  }

  // Totals row
  if (input.subjectResults.length > 0) {
    const yy = tableY + headerH2 + rowIdx * rowH2;
    tableRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH2}" fill="${colorFaint}"/>`);
    const totalSubjects = input.subjectResults.length;
    const spanCols = hasDynamicCols ? (2 + numScoreCols) : 4;
    const labelX = hasDynamicCols ? colXs[0] : colXs[0];
    const labelW = hasDynamicCols ? (colXs[2 + numScoreCols] - colXs[0]) : (colXs[4] - colXs[0]);
    tableRows.push(`<text x="${labelX + labelW - MM(2)}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.4)}" font-weight="700" fill="#111827" text-anchor="end">Total / ${totalSubjects * 100}</text>`);
    const tx = hasDynamicCols ? colXs[2 + numScoreCols] : colXs[5];
    tableRows.push(`<text x="${tx + totalW / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.4)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(input.totals.grandTotal)}</text>`);
    const grX2 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
    tableRows.push(`<text x="${grX2 + gradeW / 2}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.4)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(input.totals.overallGrade)}</text>`);
    tableRows.push(`<text x="${remarkColX + MM(2)}" y="${yy + rowH2 / 2 + MM(1)}" font-size="${MM(3.2)}" fill="#374151" text-anchor="start">${truncate(esc(input.totals.overallRemark), 18)}</text>`);
  }

  const tableBlock = `
    <rect x="${tableX}" y="${tableY}" width="${tableW}" height="${headerH2 + rowIdx * rowH2 + (input.subjectResults.length > 0 ? rowH2 : 0)}" rx="${MM(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.75" stroke-opacity="0.25"/>
    ${headerCells.join('\n')}
    ${tableRows.join('\n')}
  `;

  // ── SUMMARY GRID ──────────────────────────────────────────────────────
  const summaryY = tableY + headerH2 + rowIdx * rowH2 + (input.subjectResults.length > 0 ? rowH2 : 0) + MM(3);
  const summaryH = MM(16);
  const sumCellW = (tableW - MM(3) * 3) / 4;

  const summary = [
    { label: 'Total Score', value: String(Math.round(input.totals.grandTotal)), sub: `out of ${input.subjectResults.length * 100}` },
    { label: 'Average', value: `${input.totals.averageScore.toFixed(1)}%`, sub: `${input.subjectResults.length} subjects` },
    { label: 'Grade', value: input.totals.overallGrade, sub: input.totals.overallRemark },
    { label: 'Position', value: String(input.totals.classRank || '—'), sub: `out of ${input.totals.totalStudents || '—'}` },
  ];

  const summaryBlock = summary.map((s, i) => {
    const x = tableX + i * (sumCellW + MM(3));
    return `
      <rect x="${x}" y="${summaryY}" width="${sumCellW}" height="${summaryH}" rx="${MM(1.5)}" fill="${colorBg}" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
      <text x="${x + sumCellW / 2}" y="${summaryY + MM(4)}" font-size="${MM(2.8)}" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">${esc(s.label.toUpperCase())}</text>
      <text x="${x + sumCellW / 2}" y="${summaryY + MM(9.5)}" font-size="${MM(5.5)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(s.value)}</text>
      <text x="${x + sumCellW / 2}" y="${summaryY + MM(13)}" font-size="${MM(2.6)}" fill="#9ca3af" text-anchor="middle">${esc(s.sub)}</text>
    `;
  }).join('\n');

  // ── ATTENDANCE + GRADING KEY ──────────────────────────────────────────
  const lowerY = summaryY + summaryH + MM(3);
  const lowerH = MM(22);
  const halfW = (tableW - MM(3)) / 2;

  const attendanceBlock = `
    <rect x="${tableX}" y="${lowerY}" width="${halfW}" height="${lowerH}" rx="${MM(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
    <text x="${tableX + MM(3)}" y="${lowerY + MM(4.5)}" font-size="${MM(3.4)}" font-weight="700" fill="${color}" letter-spacing="0.5">ATTENDANCE</text>
    <text x="${tableX + MM(3)}" y="${lowerY + MM(9.5)}" font-size="${MM(3.2)}" fill="#6b7280">Total School Days:</text>
    <text x="${tableX + MM(38)}" y="${lowerY + MM(9.5)}" font-size="${MM(3.2)}" font-weight="600" fill="#111827">${input.attendance.totalDays}</text>
    <text x="${tableX + MM(3)}" y="${lowerY + MM(13.5)}" font-size="${MM(3.2)}" fill="#6b7280">Days Present:</text>
    <text x="${tableX + MM(38)}" y="${lowerY + MM(13.5)}" font-size="${MM(3.2)}" font-weight="600" fill="#047857">${input.attendance.presentDays}</text>
    <text x="${tableX + MM(3)}" y="${lowerY + MM(17.5)}" font-size="${MM(3.2)}" fill="#6b7280">Days Absent:</text>
    <text x="${tableX + MM(38)}" y="${lowerY + MM(17.5)}" font-size="${MM(3.2)}" font-weight="600" fill="#dc2626">${input.attendance.absentDays}</text>
    <text x="${tableX + MM(halfW - MM(3))}" y="${lowerY + MM(13.5)}" font-size="${MM(3.4)}" font-weight="700" fill="${color}" text-anchor="end">${input.attendance.percentage}%</text>
  `;

  const grades = [
    { grade: 'A', range: '70 - 100', remark: 'Excellent' },
    { grade: 'B', range: '60 - 69', remark: 'Very Good' },
    { grade: 'C', range: '50 - 59', remark: 'Good' },
    { grade: 'D', range: '40 - 49', remark: 'Fair' },
    { grade: 'E', range: '30 - 39', remark: 'Poor' },
    { grade: 'F', range: '0 - 29', remark: 'Fail' },
  ];
  const gradeKeyX = tableX + halfW + MM(3);
  const gradeRows = grades.map((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cellW = (halfW - MM(4)) / 2;
    const cellX = gradeKeyX + MM(2) + col * (cellW + MM(2));
    const cellY = lowerY + MM(7) + row * MM(5);
    return `
      <rect x="${cellX}" y="${cellY}" width="${cellW}" height="${MM(4.2)}" rx="${MM(0.8)}" fill="${colorBg}"/>
      <text x="${cellX + MM(1.5)}" y="${cellY + MM(2.9)}" font-size="${MM(3)}" font-weight="700" fill="${color}">${g.grade}</text>
      <text x="${cellX + MM(5)}" y="${cellY + MM(2.9)}" font-size="${MM(2.6)}" fill="#6b7280">${g.range} · ${g.remark}</text>
    `;
  }).join('\n');

  const gradingKeyBlock = `
    <rect x="${gradeKeyX}" y="${lowerY}" width="${halfW}" height="${lowerH}" rx="${MM(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
    <text x="${gradeKeyX + MM(3)}" y="${lowerY + MM(4.5)}" font-size="${MM(3.4)}" font-weight="700" fill="${color}" letter-spacing="0.5">GRADING KEY</text>
    ${gradeRows}
  `;

  // ── COMMENTS ──────────────────────────────────────────────────────────
  const commentsY = lowerY + lowerH + MM(3);
  const commentsH = MM(20);
  const teacherComment = input.domainGrade?.classTeacherComment || '';
  const teacherName = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Class Teacher';
  const principalComment = input.domainGrade?.principalComment || '';
  const principalName = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';

  const commentBlock = `
    <rect x="${tableX}" y="${commentsY}" width="${halfW}" height="${commentsH}" rx="${MM(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
    <text x="${tableX + MM(3)}" y="${commentsY + MM(4.5)}" font-size="${MM(3.4)}" font-weight="700" fill="${color}">CLASS TEACHER&apos;S REMARKS</text>
    <text x="${tableX + MM(3)}" y="${commentsY + MM(9.5)}" font-size="${MM(3.2)}" font-style="italic" fill="#374151">${truncate(esc(teacherComment || 'No comment yet.'), 60)}</text>
    <line x1="${tableX + MM(3)}" y1="${commentsY + MM(15)}" x2="${tableX + halfW - MM(3)}" y2="${commentsY + MM(15)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>
    <text x="${tableX + halfW / 2}" y="${commentsY + MM(17.5)}" font-size="${MM(2.8)}" fill="#6b7280" text-anchor="middle">${esc(teacherName)}</text>
  `;

  const principalBlock = `
    <rect x="${gradeKeyX}" y="${commentsY}" width="${halfW}" height="${commentsH}" rx="${MM(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
    <text x="${gradeKeyX + MM(3)}" y="${commentsY + MM(4.5)}" font-size="${MM(3.4)}" font-weight="700" fill="${color}">PRINCIPAL&apos;S REMARKS</text>
    <text x="${gradeKeyX + MM(3)}" y="${commentsY + MM(9.5)}" font-size="${MM(3.2)}" font-style="italic" fill="#374151">${truncate(esc(principalComment || 'No comment yet.'), 60)}</text>
    <line x1="${gradeKeyX + MM(3)}" y1="${commentsY + MM(15)}" x2="${gradeKeyX + halfW - MM(3)}" y2="${commentsY + MM(15)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>
    <text x="${gradeKeyX + halfW / 2}" y="${commentsY + MM(17.5)}" font-size="${MM(2.8)}" fill="#6b7280" text-anchor="middle">${esc(principalName)}</text>
  `;

  // ── 3RD TERM DOMAIN GRADING (compact horizontal) ──────────────────────
  let domainBlock = '';
  if (input.isThirdTerm && input.domainGrade) {
    const dg = input.domainGrade;
    const domains: { title: string; data: Record<string, string | null>; keys: string[] }[] = [
      { title: 'COGNITIVE', data: dg.cognitive, keys: ['reasoning', 'memory', 'concentration', 'problemSolving', 'initiative'] },
      { title: 'PSYCHOMOTOR', data: dg.psychomotor, keys: ['handwriting', 'sports', 'drawing', 'practical'] },
      { title: 'AFFECTIVE', data: dg.affective, keys: ['punctuality', 'neatness', 'honesty', 'leadership', 'cooperation', 'attentiveness', 'obedience', 'selfControl', 'politeness'] },
    ];

    const dStartY = commentsY + commentsH + MM(3);
    const dHeight = MM(28);
    const dColW = (tableW - MM(4)) / 3;
    const labelMap: Record<string, string> = {
      reasoning: 'Reasoning', memory: 'Memory', concentration: 'Concentration', problemSolving: 'Problem Solving', initiative: 'Initiative',
      handwriting: 'Handwriting', sports: 'Sports', drawing: 'Drawing', practical: 'Practical',
      punctuality: 'Punctuality', neatness: 'Neatness', honesty: 'Honesty', leadership: 'Leadership', cooperation: 'Cooperation',
      attentiveness: 'Attentiveness', obedience: 'Obedience', selfControl: 'Self Control', politeness: 'Politeness',
    };

    domainBlock = `
      <rect x="${tableX}" y="${dStartY}" width="${tableW}" height="${dHeight}" rx="${MM(1.5)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.4"/>
      <text x="${tableX + tableW / 2}" y="${dStartY + MM(4.5)}" font-size="${MM(3.4)}" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="0.5">AFFECTIVE, PSYCHOMOTOR &amp; COGNITIVE DOMAIN GRADING</text>
      ${domains.map((dom, di) => {
        const dx = tableX + MM(1) + di * (dColW + MM(1));
        const maxRows = 9;
        const rowItems = dom.keys.slice(0, maxRows).map((k, i) => {
          const v = dom.data[k];
          const yPos = dStartY + MM(10) + i * MM(1.9);
          return `
            <text x="${dx + MM(1.5)}" y="${yPos}" font-size="${MM(2.6)}" fill="#374151">${esc(labelMap[k] || k)}:</text>
            <text x="${dx + dColW - MM(1.5)}" y="${yPos}" font-size="${MM(2.6)}" font-weight="600" fill="${v ? color : '#d1d5db'}" text-anchor="end">${v ? esc(ratingLabel(v)) : '—'}</text>
          `;
        }).join('\n');
        // Average row
        const avgY = dStartY + dHeight - MM(3);
        return `
          <text x="${dx + dColW / 2}" y="${dStartY + MM(8)}" font-size="${MM(2.8)}" font-weight="700" fill="${color}" text-anchor="middle">${dom.title}</text>
          ${rowItems}
          <line x1="${dx + MM(1.5)}" y1="${avgY - MM(1.5)}" x2="${dx + dColW - MM(1.5)}" y2="${avgY - MM(1.5)}" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
          <text x="${dx + dColW / 2}" y="${avgY}" font-size="${MM(3)}" font-weight="700" fill="${color}" text-anchor="middle">Avg: ${dom.data.average ? esc(ratingLabel(dom.data.average)) + ' (' + dom.data.average + ')' : '—'}</text>
        `;
      }).join('\n')}
    `;
  }

  // ── FOOTER ────────────────────────────────────────────────────────────
  const footerY = H - MM(12);
  const nextTerm = input.settings?.nextTermBegins
    ? (() => {
        try {
          return new Date(input.settings.nextTermBegins).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
        } catch { return ''; }
      })()
    : '';

  const footerBlock = `
    <line x1="${M}" y1="${footerY}" x2="${W - M}" y2="${footerY}" stroke="#d1d5af" stroke-width="0.5"/>
    ${nextTerm ? `<text x="${M}" y="${footerY + MM(4)}" font-size="${MM(3.2)}" font-weight="600" fill="#374151">Next Term Begins: <tspan fill="${color}">${esc(nextTerm)}</tspan></text>` : ''}
    <text x="${W - M}" y="${footerY + MM(4)}" font-size="${MM(2.8)}" fill="#9ca3af" text-anchor="end">Printed: ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</text>
    <text x="${W / 2}" y="${footerY + MM(8)}" font-size="${MM(2.4)}" fill="#d1d5db" text-anchor="middle" letter-spacing="2">SKOOLAR • SCHOOL MANAGEMENT</text>
  `;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${style}
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${W}" height="${MM(3)}" fill="${color}"/>
    ${logoBlock}
    ${headerText}
    ${bannerBlock}
    ${studentInfoBlock}
    ${tableBlock}
    ${summaryBlock}
    ${attendanceBlock}
    ${gradingKeyBlock}
    ${commentBlock}
    ${principalBlock}
    ${domainBlock}
    ${footerBlock}
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

  const svg = buildReportCardSvg(input);
  const geistBuffer = Buffer.from(GEIST_REGULAR_BASE64, 'base64');

  // Render SVG → PNG
  const resvg = new Resvg(svg, {
    background: 'white',
    fitTo: { mode: 'width', value: MM(210) },
    font: {
      fontBuffers: [new Uint8Array(geistBuffer)],
      defaultFontFamily: GEIST_FONT_FAMILY,
    },
  });
  const pngBuffer = Buffer.from(resvg.render().asPng());

  // Embed PNG into a single A4 page
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();

  // A4 in points: 595 x 842
  const page = pdfDoc.addPage([PX(595), PX(842)]);
  const png = await pdfDoc.embedPng(pngBuffer);
  const { width: pw, height: ph } = page.getSize();
  page.drawImage(png, { x: 0, y: 0, width: pw, height: ph });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
