import { Resvg } from '@resvg/resvg-wasm';
import { ensureResvgInit } from '@/lib/id-card-utils/init-resvg';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';
import { REPORT_CARD_SCALE } from '@/lib/grade-calculator';

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

const MM = (mm: number) => Math.round((mm / 25.4) * 96);
const PX = (pt: number) => Math.round(pt * (96 / 72));

const esc = (s: unknown): string => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const trunc = (s: string, max: number): string =>
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
    case 'A': case 'A+': return '#047857';
    case 'B': return '#2563eb';
    case 'C': return '#d97706';
    case 'D': return '#ea580c';
    case 'E': return '#ef4444';
    case 'F': return '#b91c1c';
    default: return '#4b5563';
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
  const map: Record<string, string> = { '5': 'Excellent', '4': 'Very Good', '3': 'Good', '2': 'Fair', '1': 'Poor' };
  return map[val] || val;
};

const fmtDate = (d?: string | null): string => {
  if (!d) return '—';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

interface Ctx {
  W: number; H: number; M: number;
  color: string; colorDk: string; colorLt: string;
  colorFaint: string; colorBg: string; colorAlpha: string;
  fontStack: string; style: string;
  input: ReportCardPdfInput;
}

function buildCtx(input: ReportCardPdfInput): Ctx {
  const W = MM(210);
  const H = MM(297);
  const M = MM(10);
  const color = input.school.primaryColor || '#059669';
  const colorDk = adj(color, -30);
  const colorLt = adj(color, 40);
  const colorFaint = adj(color, 75);
  const colorBg = adj(color, 88);
  const colorAlpha = `${color}40`;
  const fontStack = `'${GEIST_FONT_FAMILY}', 'Inter', 'Segoe UI', Arial, sans-serif`;
  const style = `<style>
    * { font-family: ${fontStack}; }
    text { font-family: ${fontStack}; }
  </style>`;
  return { W, H, M, color, colorDk, colorLt, colorFaint, colorBg, colorAlpha, fontStack, style, input };
}

function buildReportCardSvg(ctx: Ctx): string {
  const { W, H, M, color, input } = ctx;
  const m = (mm: number) => Math.round((mm / 25.4) * 96);
  const ctrX = W / 2;
  const innerW = W - 2 * M;

  const parts: string[] = [];
  let y = m(3);

  // ═════════════════════════════════════════════════════════════
  // HEADER — centered logo, school name, address, contact, motto
  // ═════════════════════════════════════════════════════════════
  const logoSize = m(15);
  if (input.school.logoBase64) {
    parts.push(`<image href="${input.school.logoBase64}" x="${ctrX - logoSize / 2}" y="${y}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`);
  } else {
    parts.push(`<circle cx="${ctrX}" cy="${y + logoSize / 2}" r="${logoSize / 2}" fill="#e5e7eb"/>`);
    parts.push(`<text x="${ctrX}" y="${y + logoSize / 2 + m(4)}" font-size="${m(7)}" font-weight="700" fill="#6b7280" text-anchor="middle">${esc((input.school.name || 'S').charAt(0).toUpperCase())}</text>`);
  }
  y += logoSize + m(2.5);

  const schoolName = esc(input.school.name || '').toUpperCase();
  parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(5)}" font-weight="700" fill="#111827" text-anchor="middle">${trunc(schoolName, 55)}</text>`);
  y += m(5.5) + m(1.5);

  if (input.school.address) {
    parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(3.2)}" fill="#6b7280" text-anchor="middle">${trunc(esc(input.school.address), 90)}</text>`);
    y += m(3.5) + m(1);
  }

  const contactParts = [input.school.phone, input.school.email, input.school.website].filter(Boolean);
  if (contactParts.length > 0) {
    parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(2.8)}" fill="#9ca3af" text-anchor="middle">${trunc(esc(contactParts.join(' | ')), 110)}</text>`);
    y += m(3) + m(1);
  }

  if (input.school.motto) {
    parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(3)}" font-style="italic" fill="#6b7280" text-anchor="middle">"${trunc(esc(input.school.motto), 80)}"</text>`);
    y += m(3.2) + m(2);
  } else {
    y += m(2);
  }

  y += m(1);
  const academicSession = input.settings?.academicSession || input.term.academicYear || '—';
  const termName = input.term.name || '—';
  parts.push(`<text x="${M}" y="${y}" font-size="${m(3)}" font-weight="500" fill="#374151">Academic Session: <tspan font-weight="700">${esc(academicSession)}</tspan></text>`);
  parts.push(`<text x="${W - M}" y="${y}" font-size="${m(3)}" font-weight="500" fill="#374151" text-anchor="end">Term: <tspan font-weight="700">${esc(termName)}</tspan></text>`);
  y += m(3.5) + m(2);

  const termAbbr = esc(termLabel(input.term.name));
  const titleFontSize = m(4.2);
  parts.push(`<text x="${ctrX}" y="${y}" font-size="${titleFontSize}" font-weight="700" fill="#111827" text-anchor="middle" text-decoration="underline">END OF ${termAbbr} TERM REPORT CARD</text>`);
  const titleBottom = y + m(1.5);
  parts.push(`<line x1="${M}" y1="${titleBottom}" x2="${W - M}" y2="${titleBottom}" stroke="#d1d5db" stroke-width="0.8"/>`);
  y = titleBottom + m(3);

  // ═════════════════════════════════════════════════════════════
  // STUDENT INFO — bordered card with gray-50 bg, 2 columns, optional photo
  // ═════════════════════════════════════════════════════════════
  const infoPadX = m(3);
  const infoPadY = m(2.5);
  const infoColGap = m(4);
  const infoFieldGap = m(4.2);
  const photoSize = m(18);
  const hasPhoto = !!input.student.photoBase64;
  const infoFieldsLeft = 5;
  const infoFieldsRight = 4;
  const infoRows = Math.max(infoFieldsLeft, infoFieldsRight);
  const photoReserveW = hasPhoto ? photoSize + m(3) : 0;
  const infoH = Math.max(m(24), infoPadY * 2 + infoRows * infoFieldGap);
  const colW = (innerW - photoReserveW - infoPadX * 2 - infoColGap) / 2;
  const infoX = M;
  const infoY = y;

  const leftFields: [string, string][] = [
    ['Student Name:', input.student.name || '—'],
    ['Admission No:', input.student.admissionNo || '—'],
    ['Class:', `${input.cls.name || '—'}${input.cls.section ? ` (${input.cls.section})` : ''}`],
    ['Gender:', input.student.gender || '—'],
    ['Date of Birth:', fmtDate(input.student.dateOfBirth)],
  ];
  const rightFields: [string, string][] = [
    ['Blood Group:', input.student.bloodGroup || '—'],
    ['No. in Class:', String(input.totals.totalStudents || '—')],
    ['Position:', input.totals.classRank
      ? `${input.totals.classRank}${input.totals.classRank === 1 ? 'st' : input.totals.classRank === 2 ? 'nd' : input.totals.classRank === 3 ? 'rd' : 'th'} of ${input.totals.totalStudents || '—'}`
      : '—'],
    ['Term Begins:', fmtDate(input.settings?.nextTermBegins)],
  ];

  parts.push(`<rect x="${infoX}" y="${infoY}" width="${innerW}" height="${infoH}" rx="${m(1)}" fill="#f9fafb" stroke="#d1d5db" stroke-width="0.8"/>`);

  const renderInfoFields = (fields: [string, string][], xBase: number) =>
    fields.map(([lbl, val], i) => {
      const fy = infoY + infoPadY + i * infoFieldGap;
      return `<text x="${xBase}" y="${fy}" font-size="${m(2.8)}" fill="#6b7280">${esc(lbl)}</text>
        <text x="${xBase + m(14)}" y="${fy}" font-size="${m(3)}" font-weight="600" fill="#111827">${trunc(esc(val), 30)}</text>`;
    }).join('\n');

  parts.push(renderInfoFields(leftFields, infoX + infoPadX));
  parts.push(renderInfoFields(rightFields, infoX + infoPadX + colW + infoColGap));

  if (hasPhoto) {
    const pcx = infoX + innerW - infoPadX - photoSize / 2;
    const pcy = infoY + infoH / 2;
    const pr = photoSize / 2;
    parts.push(`<clipPath id="pc"><circle cx="${pcx}" cy="${pcy}" r="${pr}"/></clipPath>`);
    parts.push(`<image href="${input.student.photoBase64!}" x="${pcx - pr}" y="${pcy - pr}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>`);
  }

  y = infoY + infoH + m(3);

  // ═════════════════════════════════════════════════════════════
  // SCORE TABLE — full bordered, gray header, alternating rows
  // ═════════════════════════════════════════════════════════════
  const tableX = M;
  const tableW = innerW;
  const hasDynamicCols = input.scoreTypes.length > 0;
  const scoreTypeCols = hasDynamicCols ? input.scoreTypes : [];
  const numScoreCols = scoreTypeCols.length;

  const snW = m(7);
  const subjectW = m(34);
  const totalW = m(9);
  const gradeW = m(8);
  const remarkW = m(20);
  const dynamicW = numScoreCols > 0
    ? Math.min(m(14), Math.max(m(10), (tableW - snW - subjectW - totalW - gradeW - remarkW) / numScoreCols))
    : 0;

  const colXs: number[] = [];
  let cx = tableX + m(1);
  colXs.push(cx); cx += snW;
  colXs.push(cx); cx += subjectW;
  for (let i = 0; i < numScoreCols; i++) { colXs.push(cx); cx += dynamicW; }
  colXs.push(cx); cx += totalW;
  colXs.push(cx); cx += gradeW;
  const remarkColX = cx;
  const remarkColW = tableX + tableW - remarkColX - m(1);

  const headerH = m(5);
  const rowH = m(3.8);

  // Table border
  parts.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${headerH}" fill="#f3f4f6" stroke="#d1d5db" stroke-width="0.8"/>`);

  const cellText = (x: number, w: number, txt: string, fs = m(2.8), align = 'center', color = '#374151', weight = '600') =>
    `<text x="${x + w / 2}" y="${y + headerH / 2 + m(1.2)}" font-size="${fs}" font-weight="${weight}" fill="${color}" text-anchor="${align}">${txt}</text>`;

  const hCells: string[] = [];
  hCells.push(cellText(snW / 2 + tableX + m(1), 0, 'S/N', m(2.8), 'middle', '#374151'));
  hCells.push(`<text x="${colXs[1] + m(1.5)}" y="${y + headerH / 2 + m(1.2)}" font-size="${m(2.8)}" font-weight="600" fill="#374151">Subject</text>`);
  scoreTypeCols.forEach((st, i) => {
    hCells.push(cellText(colXs[2 + i], dynamicW, `${trunc(esc(st.name), 10)}`, m(2.5), 'middle', '#374151'));
  });

  if (hasDynamicCols) {
    hCells.push(cellText(colXs[2 + numScoreCols], totalW, 'Total', m(2.8), 'middle', '#374151'));
  } else {
    const caStart = colXs[2];
    const examStart = colXs[3];
    hCells.push(cellText(caStart, examStart - caStart, 'M.T. CA', m(2.6), 'middle', '#374151'));
    hCells.push(cellText(examStart, colXs[4] - examStart, 'Exam', m(2.6), 'middle', '#374151'));
    hCells.push(cellText(colXs[4], totalW, 'Total', m(2.8), 'middle', '#374151'));
  }
  const grX = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
  hCells.push(cellText(grX, gradeW, 'Grade', m(2.8), 'middle', '#374151'));
  hCells.push(cellText(remarkColX + remarkColW / 2, 0, 'Remark', m(2.8), 'middle', '#374151'));

  const tRows: string[] = [];
  let rowIdx = 0;
  for (const sr of input.subjectResults) {
    const yy = y + headerH + rowIdx * rowH;
    const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH}" fill="${bg}" stroke="#d1d5db" stroke-width="0.5"/>`);
    tRows.push(`<text x="${colXs[0] + snW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.6)}" fill="#6b7280" text-anchor="middle">${rowIdx + 1}</text>`);
    tRows.push(`<text x="${colXs[1] + m(1.5)}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" font-weight="500" fill="#111827">${trunc(esc(sr.subjectName), 22)}</text>`);
    if (hasDynamicCols) {
      scoreTypeCols.forEach((st, i) => {
        const v = sr.scoresByType?.[st.id];
        const display = v && v.max > 0 ? String(Math.round(v.normalized)) : '—';
        tRows.push(`<text x="${colXs[2 + i] + dynamicW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.6)}" fill="#374151" text-anchor="middle">${display}</text>`);
      });
      tRows.push(`<text x="${colXs[2 + numScoreCols] + totalW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    } else {
      const caStart = colXs[2];
      const examStart = colXs[3];
      tRows.push(`<text x="${caStart + (examStart - caStart) / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.6)}" fill="#374151" text-anchor="middle">${Math.round(sr.caScore || 0)}</text>`);
      tRows.push(`<text x="${examStart + (colXs[4] - examStart) / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.6)}" fill="#374151" text-anchor="middle">${Math.round(sr.examScore || 0)}</text>`);
      tRows.push(`<text x="${colXs[4] + totalW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    }
    const grX2 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
    tRows.push(`<text x="${grX2 + gradeW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" font-weight="700" fill="${gradeColor(sr.grade)}" text-anchor="middle">${esc(sr.grade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(1.5)}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.6)}" fill="#6b7280">${trunc(esc(sr.remark), 18)}</text>`);
    rowIdx++;
  }

  if (input.subjectResults.length > 0) {
    const yy = y + headerH + rowIdx * rowH;
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH + m(0.5)}" fill="#f9fafb" stroke="#d1d5db" stroke-width="0.5"/>`);
    const totalSubjects = input.subjectResults.length;
    const labelEndX = hasDynamicCols ? (colXs[2 + numScoreCols]) : colXs[4];
    tRows.push(`<text x="${labelEndX - m(1)}" y="${yy + (rowH + m(0.5)) / 2 + m(1.1)}" font-size="${m(2.8)}" font-weight="700" fill="#374151" text-anchor="end">Total / ${totalSubjects * 100}</text>`);
    const tx = hasDynamicCols ? colXs[2 + numScoreCols] : colXs[4];
    tRows.push(`<text x="${tx + totalW / 2}" y="${yy + (rowH + m(0.5)) / 2 + m(1.1)}" font-size="${m(2.8)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(input.totals.grandTotal)}</text>`);
    const grX3 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
    tRows.push(`<text x="${grX3 + gradeW / 2}" y="${yy + (rowH + m(0.5)) / 2 + m(1.1)}" font-size="${m(2.8)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(input.totals.overallGrade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(1.5)}" y="${yy + (rowH + m(0.5)) / 2 + m(1.1)}" font-size="${m(2.6)}" fill="#374151">${trunc(esc(input.totals.overallRemark), 18)}</text>`);
    rowIdx++;
  }

  const tableH = headerH + rowIdx * rowH;
  parts.push(tRows.join('\n'));
  parts.push(`<line x1="${tableX}" y1="${y}" x2="${tableX + tableW}" y2="${y}" stroke="#d1d5db" stroke-width="0.8"/>`);
  parts.push(`<line x1="${tableX}" y1="${y + tableH}" x2="${tableX + tableW}" y2="${y + tableH}" stroke="#d1d5db" stroke-width="0.8"/>`);
  y += tableH + m(3);

  // ═════════════════════════════════════════════════════════════
  // SUMMARY — horizontal flex: Total / max | Average | subjects count
  // ═════════════════════════════════════════════════════════════
  parts.push(`<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="#d1d5db" stroke-width="0.8"/>`);
  y += m(2);
  const totalSubjects = input.subjectResults.length;
  const maxPossible = totalSubjects * 100;
  const avg = input.totals.averageScore;

  parts.push(`<text x="${M}" y="${y}" font-size="${m(3)}" font-weight="600" fill="#374151">Total / ${maxPossible}: <tspan font-size="${m(3.5)}" font-weight="700" fill="${color}">${Math.round(input.totals.grandTotal)}</tspan></text>`);
  parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(3)}" font-weight="600" fill="#374151" text-anchor="middle">Average: <tspan font-size="${m(3.5)}" font-weight="700" fill="${color}">${avg.toFixed(1)}%</tspan></text>`);
  parts.push(`<text x="${W - M}" y="${y}" font-size="${m(3)}" font-weight="600" fill="#374151" text-anchor="end">${totalSubjects} subjects</text>`);
  y += m(4.5);

  // ═════════════════════════════════════════════════════════════
  // GRADING KEY — inline text in bordered box
  // ═════════════════════════════════════════════════════════════
  const grades = [
    { grade: 'A', range: '70-100', remark: 'Excellent' },
    { grade: 'B', range: '60-69', remark: 'Very Good' },
    { grade: 'C', range: '50-59', remark: 'Good' },
    { grade: 'D', range: '40-49', remark: 'Fair' },
    { grade: 'E', range: '30-39', remark: 'Poor' },
    { grade: 'F', range: '0-29', remark: 'Fail' },
  ];
  const gkPad = m(2);
  const gkH = m(6);
  parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${gkH}" rx="${m(0.6)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.8"/>`);
  parts.push(`<text x="${M + gkPad}" y="${y + gkH / 2 + m(1.2)}" font-size="${m(2.8)}" font-weight="700" fill="#374151">GRADING KEY:</text>`);
  let gkX = M + gkPad + m(20);
  grades.forEach((g) => {
    const chunk = ` ${g.grade} (${g.range}) → ${g.remark}`;
    const chunkWidth = chunk.length * m(1.3);
    if (gkX + chunkWidth > W - M - gkPad) { gkX = M + gkPad; y += m(2.8); }
    parts.push(`<text x="${gkX}" y="${y + gkH / 2 + m(1.2)}" font-size="${m(2.5)}" fill="#6b7280">${g.grade} (<tspan font-weight="600">${g.range}</tspan>) → ${g.remark}</text>`);
    gkX += gkPad + grades.reduce((sum, g2) => sum + `${g2.grade} (${g2.range}) → ${g2.remark}`.length * m(1.2) + m(1.5), 0);
  });
  y += gkH + m(3);

  // ═════════════════════════════════════════════════════════════
  // ATTENDANCE — grid 4 in bordered gray-50 box
  // ═════════════════════════════════════════════════════════════
  const attPad = m(2);
  const attH = m(7);
  const attColW = (innerW - attPad * 2) / 4;
  parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${attH}" rx="${m(0.6)}" fill="#f9fafb" stroke="#d1d5db" stroke-width="0.8"/>`);

  const attItems = [
    { lbl: 'Total School Days:', val: String(input.attendance.totalDays) },
    { lbl: 'Days Present:', val: String(input.attendance.presentDays) },
    { lbl: 'Days Absent:', val: String(input.attendance.absentDays) },
    { lbl: 'Attendance %:', val: `${input.attendance.percentage}%` },
  ];
  const attColors = ['#6b7280', '#047857', '#dc2626', color];
  attItems.forEach((item, i) => {
    const ax = M + attPad + i * attColW;
    parts.push(`<text x="${ax + attColW / 2}" y="${y + attH / 2 - m(1)}" font-size="${m(2.5)}" fill="#6b7280" text-anchor="middle">${esc(item.lbl)}</text>`);
    parts.push(`<text x="${ax + attColW / 2}" y="${y + attH / 2 + m(1.6)}" font-size="${m(3.2)}" font-weight="700" fill="${attColors[i]}" text-anchor="middle">${esc(item.val)}</text>`);
  });
  y += attH + m(3);

  // ═════════════════════════════════════════════════════════════
  // REMARKS — 2-column grid with teacher & principal
  // ═════════════════════════════════════════════════════════════
  const remGap = m(3);
  const remW = (innerW - remGap) / 2;
  const remH = m(18);

  const teacherComment = input.domainGrade?.classTeacherComment || input.cls.classTeacher
    ? `Comments by ${esc(input.cls.classTeacher)} pending.`
    : 'No comment yet.';
  const teacherName2 = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Class Teacher';
  const principalComment = input.domainGrade?.principalComment || input.settings?.principalName
    ? `Comments by ${esc(input.settings?.principalName)} pending.`
    : 'No comment yet.';
  const principalName2 = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';

  // Teacher's Remarks
  const rem1X = M;
  parts.push(`<rect x="${rem1X}" y="${y}" width="${remW}" height="${remH}" rx="${m(0.6)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.8"/>`);
  parts.push(`<text x="${rem1X + m(2)}" y="${y + m(3)}" font-size="${m(3)}" font-weight="700" fill="#374151">Teacher&apos;s Remarks:</text>`);
  parts.push(`<text x="${rem1X + m(2)}" y="${y + m(6)}" font-size="${m(2.6)}" font-style="italic" fill="#374151">${trunc(esc(input.domainGrade?.classTeacherComment || 'No comment yet.'), 150)}</text>`);
  parts.push(`<line x1="${rem1X + m(2)}" y1="${y + remH - m(6)}" x2="${rem1X + remW - m(2)}" y2="${y + remH - m(6)}" stroke="#d1d5db" stroke-dasharray="3,3" stroke-width="0.6"/>`);
  parts.push(`<text x="${rem1X + m(2) + (remW - m(4)) / 2}" y="${y + remH - m(3.5)}" font-size="${m(2.5)}" fill="#6b7280" text-anchor="middle">${esc(teacherName2)}</text>`);

  // Principal's Remarks
  const rem2X = M + remW + remGap;
  parts.push(`<rect x="${rem2X}" y="${y}" width="${remW}" height="${remH}" rx="${m(0.6)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.8"/>`);
  parts.push(`<text x="${rem2X + m(2)}" y="${y + m(3)}" font-size="${m(3)}" font-weight="700" fill="#374151">Principal&apos;s Remarks:</text>`);
  parts.push(`<text x="${rem2X + m(2)}" y="${y + m(6)}" font-size="${m(2.6)}" font-style="italic" fill="#374151">${trunc(esc(input.domainGrade?.principalComment || 'No comment yet.'), 150)}</text>`);
  parts.push(`<line x1="${rem2X + m(2)}" y1="${y + remH - m(6)}" x2="${rem2X + remW - m(2)}" y2="${y + remH - m(6)}" stroke="#d1d5db" stroke-dasharray="3,3" stroke-width="0.6"/>`);
  parts.push(`<text x="${rem2X + m(2) + (remW - m(4)) / 2}" y="${y + remH - m(3.5)}" font-size="${m(2.5)}" fill="#6b7280" text-anchor="middle">${esc(principalName2)}</text>`);

  y += remH + m(3);

  // ═════════════════════════════════════════════════════════════
  // DOMAIN GRADING (3rd term only)
  // ═════════════════════════════════════════════════════════════
  if (input.isThirdTerm && input.domainGrade) {
    const dg = input.domainGrade;
    const domPad = m(2);
    const domGap = m(2);
    const domColW = (innerW - domPad * 2 - domGap * 2) / 3;

    const domains: { title: string; data: Record<string, string | null>; keys: string[] }[] = [
      { title: 'COGNITIVE', data: dg.cognitive, keys: ['reasoning', 'memory', 'concentration', 'problemSolving', 'initiative'] },
      { title: 'PSYCHOMOTOR', data: dg.psychomotor, keys: ['handwriting', 'sports', 'drawing', 'practical'] },
      { title: 'AFFECTIVE', data: dg.affective, keys: ['punctuality', 'neatness', 'honesty', 'leadership', 'cooperation', 'attentiveness', 'obedience', 'selfControl', 'politeness'] },
    ];
    const labelMap: Record<string, string> = {
      reasoning: 'Reasoning', memory: 'Memory', concentration: 'Concentration', problemSolving: 'Problem Solving', initiative: 'Initiative',
      handwriting: 'Handwriting', sports: 'Sports', drawing: 'Drawing', practical: 'Practical',
      punctuality: 'Punctuality', neatness: 'Neatness', honesty: 'Honesty', leadership: 'Leadership', cooperation: 'Cooperation',
      attentiveness: 'Attentiveness', obedience: 'Obedience', selfControl: 'Self Control', politeness: 'Politeness',
    };

    const domTitleH = m(4);
    const domRowH = m(3);
    const maxRows = Math.max(...domains.map(d => d.keys.length));
    const domH = domPad * 2 + domTitleH + maxRows * domRowH + m(3);

    parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${domH}" rx="${m(0.6)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.8"/>`);
    parts.push(`<text x="${ctrX}" y="${y + m(2.5)}" font-size="${m(3.2)}" font-weight="700" fill="#374151" text-anchor="middle">Affective, Psychomotor &amp; Cognitive Domain Grading</text>`);

    domains.forEach((dom, di) => {
      const dx = M + domPad + di * (domColW + domGap);
      parts.push(`<text x="${dx + domColW / 2}" y="${y + domPad + domTitleH}" font-size="${m(2.6)}" font-weight="700" fill="${color}" text-anchor="middle">${dom.title}</text>`);
      dom.keys.forEach((k, i) => {
        const v = dom.data[k];
        const yPos = y + domPad + domTitleH + m(1.5) + i * domRowH;
        parts.push(`<text x="${dx + m(1.5)}" y="${yPos}" font-size="${m(2.3)}" fill="#374151">${esc(labelMap[k] || k)}</text>`);
        parts.push(`<text x="${dx + domColW - m(1.5)}" y="${yPos}" font-size="${m(2.3)}" font-weight="600" fill="${v && v !== 'null' && v !== 'undefined' ? color : '#d1d5db'}" text-anchor="end">${v && v !== 'null' && v !== 'undefined' ? esc(ratingLabel(v)) : '—'}</text>`);
      });
    });

    y += domH + m(3);
  }

  // ═════════════════════════════════════════════════════════════
  // FOOTER — centered, top border, next term + print date
  // ═════════════════════════════════════════════════════════════
  const footerY = H - m(8);
  const nextTerm = input.settings?.nextTermBegins
    ? (() => {
        try { return new Date(input.settings!.nextTermBegins!).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
        catch { return ''; }
      })()
    : '';
  const printDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  parts.push(`<line x1="${M}" y1="${footerY - m(2.5)}" x2="${W - M}" y2="${footerY - m(2.5)}" stroke="#d1d5db" stroke-width="0.8"/>`);
  if (nextTerm) {
    parts.push(`<text x="${ctrX}" y="${footerY}" font-size="${m(2.8)}" font-weight="600" fill="#374151" text-anchor="middle">Next Term Begins: <tspan fill="${color}">${esc(nextTerm)}</tspan></text>`);
    parts.push(`<text x="${ctrX}" y="${footerY + m(4)}" font-size="${m(2.5)}" fill="#9ca3af" text-anchor="middle">Printed: ${esc(printDate)}</text>`);
  } else {
    parts.push(`<text x="${ctrX}" y="${footerY}" font-size="${m(2.5)}" fill="#9ca3af" text-anchor="middle">Printed: ${esc(printDate)}</text>`);
  }
  parts.push(`<text x="${ctrX}" y="${footerY + m(4)}" font-size="${m(2.3)}" fill="#d1d5db" text-anchor="middle" letter-spacing="2">SKOOLAR · SCHOOL MANAGEMENT</text>`);

  // ═══════════════════════════════════════════════════════════════
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${ctx.style}
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    ${parts.join('\n')}
  </svg>`;
}

export async function renderReportCardPdf(input: ReportCardPdfInput): Promise<Buffer> {
  await ensureResvgInit();

  const ctx = buildCtx(input);

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

  const fontStack = arabicBuffer
    ? `'Noto Naskh Arabic', '${GEIST_FONT_FAMILY}', 'Inter', 'Segoe UI', Arial, sans-serif`
    : ctx.fontStack;
  const style = `<style>
    * { font-family: ${fontStack}; }
    text { font-family: ${fontStack}; }
  </style>`;
  const enrichedCtx = { ...ctx, fontStack, style };

  const svg = buildReportCardSvg(enrichedCtx);

  const r = new Resvg(svg, {
    background: 'white',
    fitTo: { mode: 'width', value: MM(210) },
    font: { fontBuffers, defaultFontFamily: GEIST_FONT_FAMILY },
  });
  const png = Buffer.from(r.render().asPng());

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const a4w = PX(595);
  const a4h = PX(842);
  const page = pdfDoc.addPage([a4w, a4h]);
  const img = await pdfDoc.embedPng(png);
  page.drawImage(img, { x: 0, y: 0, width: a4w, height: a4h });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
