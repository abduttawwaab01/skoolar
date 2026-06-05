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
    schoolMotto?: string | null;
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
  teacherComment?: string | null;
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

const ratingColor = (val?: string | null): { bg: string; fg: string } => {
  switch (val) {
    case '5': return { bg: '#d1fae5', fg: '#065f46' };
    case '4': return { bg: '#dbeafe', fg: '#1e40af' };
    case '3': return { bg: '#fef3c7', fg: '#92400e' };
    case '2': return { bg: '#ffedd5', fg: '#9a3412' };
    case '1': return { bg: '#fee2e2', fg: '#991b1b' };
    default: return { bg: '#f3f4f6', fg: '#6b7280' };
  }
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

// ═══════════════════════════════════════════════════════════════
// Lucide-style icon paths (24×24 viewBox)
// ═══════════════════════════════════════════════════════════════
const ICON = {
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  hash: 'M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  school: 'M22 10v6 M2 10l10-5 10 5-10 5Z M6 12v5c3 3 10 3 12 0v-5',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M8.21 13.89 7 22l5-3 5 3-1.21-8.11',
  clipboard: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z M8 10h8 M8 14h6 M8 18h4',
  barChart: 'M3 3v18h18 M7 16V8 M11 16v-4 M15 16v-6 M19 16v-2',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0V4Z M17 4h3v2a4 4 0 0 1-4 4 M7 4H4v2a4 4 0 0 0 4 4',
  star: 'M12 2l3 7h7l-5.5 4 2 7-6.5-4-6.5 4 2-7L2 9h7Z',
};

const renderIcon = (path: string, x: number, y: number, size: number, color: string) =>
  `<g transform="translate(${x},${y}) scale(${(size / 24).toFixed(4)})" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></g>`;

function buildReportCardSvg(ctx: Ctx): string {
  const { W, H, M, color, input } = ctx;
  const m = (mm: number) => Math.round((mm / 25.4) * 96);
  const ctrX = W / 2;
  const innerW = W - 2 * M;
  const footerReserveH = m(9);
  const maxContentY = H - footerReserveH;

  const parts: string[] = [];
  const hCells: string[] = [];
  let y = 0;

  // ═════════════════════════════════════════════════════════════
  // SECTION 1: Top accent bar
  // ═════════════════════════════════════════════════════════════
  parts.push(`<rect x="0" y="0" width="${W}" height="${m(2.5)}" fill="${color}"/>`);
  y = m(2.5) + m(2);

  // ═════════════════════════════════════════════════════════════
  // SECTION 2: Header (centered logo + school name + address + contact + motto)
  // ═════════════════════════════════════════════════════════════
  const logoSize = m(13);
  parts.push(`<circle cx="${ctrX}" cy="${y + logoSize / 2}" r="${logoSize / 2 + m(0.8)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.25"/>`);
  if (input.school.logoBase64) {
    parts.push(`<image href="${input.school.logoBase64}" x="${ctrX - logoSize / 2}" y="${y}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`);
  } else {
    const initial = esc((input.school.name || 'S').charAt(0).toUpperCase());
    parts.push(`<text x="${ctrX}" y="${y + logoSize / 2 + m(3.5)}" font-size="${m(6.5)}" font-weight="700" fill="${color}" text-anchor="middle">${initial}</text>`);
  }
  y += logoSize + m(1.8);

  const schoolName = esc(input.school.name || '').toUpperCase();
  parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(5.4)}" font-weight="700" fill="#111827" text-anchor="middle" letter-spacing="0.5">${trunc(schoolName, 55)}</text>`);
  y += m(5.5) + m(1.2);

  if (input.school.address) {
    parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(2.8)}" fill="#6b7280" text-anchor="middle">${trunc(esc(input.school.address), 95)}</text>`);
    y += m(3) + m(0.4);
  }

  const contactParts = [input.school.phone, input.school.email].filter(Boolean);
  if (contactParts.length > 0) {
    parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(2.4)}" fill="#9ca3af" text-anchor="middle">${trunc(esc(contactParts.join(' | ')), 110)}</text>`);
    y += m(2.6) + m(0.4);
  }

  const mottoText = input.school.motto || input.settings?.schoolMotto;
  if (mottoText) {
    parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(2.8)}" font-style="italic" fill="${color}" text-anchor="middle">* ${trunc(esc(mottoText), 80)} *</text>`);
    y += m(3) + m(1.4);
  } else {
    y += m(1);
  }

  // ═════════════════════════════════════════════════════════════
  // SECTION 3: Session / Term line
  // ═════════════════════════════════════════════════════════════
  const academicSession = input.settings?.academicSession || input.term.academicYear || '—';
  const termName = input.term.name || '—';
  parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(2.8)}" fill="#374151" text-anchor="middle">Academic Session: <tspan font-weight="700" fill="#111827">${esc(academicSession)}</tspan>    Term: <tspan font-weight="700" fill="#111827">${esc(termName)}</tspan></text>`);
  y += m(3) + m(1.5);

  // ═════════════════════════════════════════════════════════════
  // SECTION 4: Title in green pill badge
  // ═════════════════════════════════════════════════════════════
  const pillH = m(7.2);
  const pillW = m(105);
  const pillX = ctrX - pillW / 2;
  parts.push(`<rect x="${pillX}" y="${y}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${color}"/>`);
  parts.push(`<rect x="${pillX + m(0.3)}" y="${y + m(0.3)}" width="${pillW - m(0.6)}" height="${pillH - m(0.6)}" rx="${(pillH - m(0.6)) / 2}" fill="none" stroke="#ffffff" stroke-width="0.4" stroke-opacity="0.5"/>`);
  const termAbbr = esc(termLabel(input.term.name));
  parts.push(`<text x="${ctrX}" y="${y + pillH / 2 + m(1.3)}" font-size="${m(3.6)}" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">END OF ${termAbbr} TERM REPORT CARD</text>`);
  y += pillH + m(3.5);

  // ═════════════════════════════════════════════════════════════
  // SECTION 5: STUDENT INFORMATION section header
  // ═════════════════════════════════════════════════════════════
  parts.push(renderIcon(ICON.users, M, y - m(2.8), m(3.2), color));
  parts.push(`<text x="${M + m(4.2)}" y="${y}" font-size="${m(3.2)}" font-weight="700" fill="${color}" letter-spacing="1.2">STUDENT INFORMATION</text>`);
  parts.push(`<line x1="${M + m(46)}" y1="${y - m(1.2)}" x2="${W - M}" y2="${y - m(1.2)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.3"/>`);
  y += m(3) + m(1);

  // ═════════════════════════════════════════════════════════════
  // SECTION 6: Student info card (3-col grid + photo)
  // ═════════════════════════════════════════════════════════════
  const infoX = M;
  const infoY = y;
  const photoSize = m(22);
  const photoReservedW = photoSize + m(8);
  const gridW = innerW - photoReservedW;
  const colW = gridW / 3;
  const infoFieldH = m(5.6);
  const infoRows = 3;
  const infoH = infoRows * infoFieldH + m(3);
  const infoPadX = m(3);

  parts.push(`<rect x="${infoX}" y="${infoY}" width="${innerW}" height="${infoH}" rx="${m(1.5)}" fill="#f9fafb" stroke="#d1d5db" stroke-width="0.7"/>`);

  const fields: [string, string, string][] = [
    [ICON.user, 'Student Name:', input.student.name || '—'],
    [ICON.users, 'No. in Class:', String(input.totals.totalStudents || '—')],
    [ICON.calendar, 'Term Begins:', fmtDate(input.settings?.nextTermBegins)],
    [ICON.hash, 'Admission No:', input.student.admissionNo || '—'],
    [ICON.school, 'Class:', `${input.cls.name || '—'}${input.cls.section ? ` (${input.cls.section})` : ''}`],
    [ICON.award, 'Position:', input.totals.classRank
      ? `${input.totals.classRank}${input.totals.classRank === 1 ? 'st' : input.totals.classRank === 2 ? 'nd' : input.totals.classRank === 3 ? 'rd' : 'th'} of ${input.totals.totalStudents || '—'}`
      : '—'],
    [ICON.user, 'Gender:', input.student.gender || '—'],
    [ICON.calendar, 'Date of Birth:', fmtDate(input.student.dateOfBirth)],
    [ICON.user, 'Blood Group:', input.student.bloodGroup || '—'],
  ];

  fields.forEach(([iconPath, label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const fieldX = infoX + infoPadX + col * colW;
    const fieldY = infoY + m(3.5) + row * infoFieldH;
    parts.push(renderIcon(iconPath, fieldX, fieldY - m(2.4), m(2.8), '#9ca3af'));
    parts.push(`<text x="${fieldX + m(4)}" y="${fieldY - m(0.2)}" font-size="${m(2.2)}" fill="#9ca3af" letter-spacing="0.3">${esc(label)}</text>`);
    parts.push(`<text x="${fieldX + m(4)}" y="${fieldY + m(2.8)}" font-size="${m(2.8)}" font-weight="600" fill="#111827">${trunc(esc(value), 26)}</text>`);
  });

  const photoX = infoX + innerW - m(2) - photoSize;
  const photoY = infoY + (infoH - photoSize) / 2;
  const pcx = photoX + photoSize / 2;
  const pcy = photoY + photoSize / 2;
  const pr = photoSize / 2;
  if (input.student.photoBase64) {
    parts.push(`<defs><clipPath id="rc-photo"><circle cx="${pcx}" cy="${pcy}" r="${pr}"/></clipPath></defs>`);
    parts.push(`<image href="${input.student.photoBase64}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#rc-photo)"/>`);
  } else {
    parts.push(`<circle cx="${pcx}" cy="${pcy}" r="${pr}" fill="${color}15"/>`);
    const ini = esc((input.student.name || 'NA').split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase());
    parts.push(`<text x="${pcx}" y="${pcy + m(3.5)}" font-size="${m(8)}" font-weight="700" fill="${color}" text-anchor="middle">${ini}</text>`);
  }
  parts.push(`<circle cx="${pcx}" cy="${pcy}" r="${pr}" fill="none" stroke="${color}" stroke-width="1.2"/>`);

  y = infoY + infoH + m(3);

  // ═════════════════════════════════════════════════════════════
  // SECTION 7: Score table
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
    ? Math.min(m(13), Math.max(m(9), (tableW - snW - subjectW - totalW - gradeW - remarkW) / numScoreCols))
    : 0;

  const colXs: number[] = [];
  let cx = tableX;
  colXs.push(cx); cx += snW;
  colXs.push(cx); cx += subjectW;
  for (let i = 0; i < numScoreCols; i++) { colXs.push(cx); cx += dynamicW; }
  colXs.push(cx); cx += totalW;
  colXs.push(cx); cx += gradeW;
  const remarkColX = cx;
  const remarkColW = tableX + tableW - remarkColX;

  const headerH = m(5.2);
  const rowH = m(3.7);

  parts.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${headerH}" fill="${color}"/>`);

  const cellText = (x: number, w: number, txt: string, fs = m(2.6), align = 'center', color2 = '#ffffff', weight = '700') =>
    `<text x="${x + w / 2}" y="${y + headerH / 2 + m(1.2)}" font-size="${fs}" font-weight="${weight}" fill="${color2}" text-anchor="${align}">${txt}</text>`;

  hCells.push(cellText(colXs[0] + snW / 2, 0, 'S/N', m(2.6), 'middle', '#ffffff'));
  hCells.push(`<text x="${colXs[1] + m(1.5)}" y="${y + headerH / 2 + m(1.2)}" font-size="${m(2.6)}" font-weight="700" fill="#ffffff">Subject</text>`);
  scoreTypeCols.forEach((st, i) => {
    hCells.push(cellText(colXs[2 + i] + dynamicW / 2, 0, `${trunc(esc(st.name), 10)} (${st.weight})`, m(2.4), 'middle', '#ffffff'));
  });

  if (hasDynamicCols) {
    hCells.push(cellText(colXs[2 + numScoreCols] + totalW / 2, 0, 'Total', m(2.6), 'middle', '#ffffff'));
  } else {
    const caStart = colXs[2];
    const examStart = colXs[3];
    hCells.push(cellText(caStart + (examStart - caStart) / 2, 0, 'Mid-Term CA', m(2.4), 'middle', '#ffffff'));
    hCells.push(cellText(examStart + (colXs[4] - examStart) / 2, 0, 'Exam', m(2.4), 'middle', '#ffffff'));
    hCells.push(cellText(colXs[4] + totalW / 2, 0, 'Total', m(2.6), 'middle', '#ffffff'));
  }
  const grX = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
  hCells.push(cellText(grX + gradeW / 2, 0, 'Grade', m(2.6), 'middle', '#ffffff'));
  hCells.push(cellText(remarkColX + remarkColW / 2, 0, 'Remark', m(2.6), 'middle', '#ffffff'));

  const tRows: string[] = [];
  let rowIdx = 0;
  for (const sr of input.subjectResults) {
    const yy = y + headerH + rowIdx * rowH;
    const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH}" fill="${bg}" stroke="#d1d5db" stroke-width="0.4"/>`);
    tRows.push(`<text x="${colXs[0] + snW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.5)}" fill="#6b7280" text-anchor="middle">${rowIdx + 1}</text>`);
    tRows.push(`<text x="${colXs[1] + m(1.5)}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.7)}" font-weight="500" fill="#111827">${trunc(esc(sr.subjectName), 22)}</text>`);
    if (hasDynamicCols) {
      scoreTypeCols.forEach((st, i) => {
        const v = sr.scoresByType?.[st.id];
        const display = v && v.max > 0 ? String(Math.round(v.normalized)) : '—';
        tRows.push(`<text x="${colXs[2 + i] + dynamicW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.5)}" fill="#374151" text-anchor="middle">${display}</text>`);
      });
      tRows.push(`<text x="${colXs[2 + numScoreCols] + totalW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.7)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    } else {
      const caStart = colXs[2];
      const examStart = colXs[3];
      tRows.push(`<text x="${caStart + (examStart - caStart) / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.5)}" fill="#374151" text-anchor="middle">${Math.round(sr.caScore || 0)}</text>`);
      tRows.push(`<text x="${examStart + (colXs[4] - examStart) / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.5)}" fill="#374151" text-anchor="middle">${Math.round(sr.examScore || 0)}</text>`);
      tRows.push(`<text x="${colXs[4] + totalW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.7)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    }
    const grX2 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
    tRows.push(`<text x="${grX2 + gradeW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.7)}" font-weight="700" fill="${gradeColor(sr.grade)}" text-anchor="middle">${esc(sr.grade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(1.5)}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.5)}" fill="#6b7280">${trunc(esc(sr.remark), 18)}</text>`);
    rowIdx++;
  }

  if (input.subjectResults.length > 0) {
    const yy = y + headerH + rowIdx * rowH;
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH + m(0.4)}" fill="#f3f4f6" stroke="#d1d5db" stroke-width="0.5"/>`);
    const totalSubjects = input.subjectResults.length;
    const labelEndX = hasDynamicCols ? (colXs[2 + numScoreCols]) : colXs[4];
    tRows.push(`<text x="${labelEndX - m(1)}" y="${yy + (rowH + m(0.4)) / 2 + m(1.1)}" font-size="${m(2.7)}" font-weight="700" fill="#374151" text-anchor="end">Total / ${totalSubjects * 100}</text>`);
    const tx = hasDynamicCols ? colXs[2 + numScoreCols] : colXs[4];
    tRows.push(`<text x="${tx + totalW / 2}" y="${yy + (rowH + m(0.4)) / 2 + m(1.1)}" font-size="${m(2.7)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(input.totals.grandTotal)}</text>`);
    const grX3 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
    tRows.push(`<text x="${grX3 + gradeW / 2}" y="${yy + (rowH + m(0.4)) / 2 + m(1.1)}" font-size="${m(2.7)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(input.totals.overallGrade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(1.5)}" y="${yy + (rowH + m(0.4)) / 2 + m(1.1)}" font-size="${m(2.5)}" fill="#374151">${trunc(esc(input.totals.overallRemark), 18)}</text>`);
    rowIdx++;
  }

  const tableH = headerH + rowIdx * rowH;
  parts.push(tRows.join('\n'));
  parts.push(`<line x1="${tableX}" y1="${y}" x2="${tableX + tableW}" y2="${y}" stroke="${color}" stroke-width="0.5"/>`);
  parts.push(`<line x1="${tableX}" y1="${y + tableH}" x2="${tableX + tableW}" y2="${y + tableH}" stroke="${color}" stroke-width="0.5"/>`);
  y += tableH + m(3);

  // ═════════════════════════════════════════════════════════════
  // SECTION 8: 4-Card Stat Summary (with icons)
  // ═════════════════════════════════════════════════════════════
  const sumH = m(13);
  const sumGap = m(2);
  const sumCellW = (tableW - 3 * sumGap) / 4;
  const totalSubjects = input.subjectResults.length;
  const maxPossible = totalSubjects * 100;
  const avg = input.totals.averageScore;
  const summary = [
    { icon: ICON.clipboard, label: 'TOTAL SCORE', value: String(Math.round(input.totals.grandTotal)), sub: `out of ${maxPossible}` },
    { icon: ICON.barChart, label: 'AVERAGE', value: `${avg.toFixed(1)}%`, sub: `${totalSubjects} subjects` },
    { icon: ICON.award, label: 'GRADE', value: input.totals.overallGrade, sub: input.totals.overallRemark },
    { icon: ICON.trophy, label: 'POSITION', value: String(input.totals.classRank || '—'), sub: `out of ${input.totals.totalStudents || '—'}` },
  ];

  summary.forEach((s, i) => {
    const x = tableX + i * (sumCellW + sumGap);
    parts.push(`<rect x="${x}" y="${y}" width="${sumCellW}" height="${sumH}" rx="${m(1.5)}" fill="${color}08" stroke="${color}" stroke-width="0.6" stroke-opacity="0.25"/>`);
    const iconSize = m(3.6);
    parts.push(renderIcon(s.icon, x + sumCellW / 2 - iconSize / 2, y + m(2), iconSize, color));
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(7.2)}" font-size="${m(2.2)}" fill="#6b7280" text-anchor="middle" letter-spacing="0.8">${esc(s.label)}</text>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(10.5)}" font-size="${m(4.2)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(s.value)}</text>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(12.5)}" font-size="${m(2)}" fill="#9ca3af" text-anchor="middle">${esc(s.sub)}</text>`);
  });
  y += sumH + m(3);

  // ═════════════════════════════════════════════════════════════
  // SECTION 9: Color-coded 2×3 Grading Key grid
  // ═════════════════════════════════════════════════════════════
  const gkOuterH = m(15);
  const gkPad = m(2);
  const gkTitleH = m(3.5);
  const gkGridH = gkOuterH - gkTitleH - gkPad * 2;
  const gkGridGap = m(1.2);
  const gkColW = (innerW - gkPad * 2 - gkGridGap) / 3;
  const gkRowH = (gkGridH - gkGridGap) / 2;
  parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${gkOuterH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);
  parts.push(renderIcon(ICON.star, M + gkPad, y + gkPad, m(3), color));
  parts.push(`<text x="${M + gkPad + m(4)}" y="${y + gkPad + m(2.5)}" font-size="${m(2.8)}" font-weight="700" fill="${color}" letter-spacing="0.8">GRADING KEY</text>`);

  const gradeCells: { grade: string; range: string; remark: string; bg: string; fg: string }[] = [
    { grade: 'A', range: '70 - 100', remark: 'Excellent', bg: '#d1fae5', fg: '#065f46' },
    { grade: 'B', range: '60 - 69', remark: 'Very Good', bg: '#dbeafe', fg: '#1e40af' },
    { grade: 'C', range: '50 - 59', remark: 'Good', bg: '#fef3c7', fg: '#92400e' },
    { grade: 'D', range: '40 - 49', remark: 'Fair', bg: '#ffedd5', fg: '#9a3412' },
    { grade: 'E', range: '30 - 39', remark: 'Poor', bg: '#fee2e2', fg: '#991b1b' },
    { grade: 'F', range: '0 - 29', remark: 'Fail', bg: '#fecaca', fg: '#7f1d1d' },
  ];
  gradeCells.forEach((g, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cgx = M + gkPad + col * (gkColW + gkGridGap);
    const cgy = y + gkTitleH + gkPad + row * (gkRowH + gkGridGap);
    parts.push(`<rect x="${cgx}" y="${cgy}" width="${gkColW}" height="${gkRowH}" rx="${m(0.8)}" fill="${g.bg}"/>`);
    parts.push(`<text x="${cgx + m(1.5)}" y="${cgy + gkRowH / 2 + m(1.5)}" font-size="${m(3.6)}" font-weight="700" fill="${g.fg}">${g.grade}</text>`);
    parts.push(`<text x="${cgx + m(7.5)}" y="${cgy + gkRowH / 2 - m(0.3)}" font-size="${m(2.3)}" font-weight="600" fill="${g.fg}">${g.range}</text>`);
    parts.push(`<text x="${cgx + m(7.5)}" y="${cgy + gkRowH / 2 + m(1.8)}" font-size="${m(2.1)}" fill="${g.fg}" fill-opacity="0.85">${g.remark}</text>`);
  });

  y += gkOuterH + m(3);

  // ═════════════════════════════════════════════════════════════
  // SECTION 10: Attendance Summary
  // ═════════════════════════════════════════════════════════════
  parts.push(renderIcon(ICON.calendar, M, y - m(2.8), m(3.2), color));
  parts.push(`<text x="${M + m(4.2)}" y="${y}" font-size="${m(3.2)}" font-weight="700" fill="${color}" letter-spacing="1.2">ATTENDANCE SUMMARY</text>`);
  parts.push(`<line x1="${M + m(50)}" y1="${y - m(1.2)}" x2="${W - M}" y2="${y - m(1.2)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.3"/>`);
  y += m(3) + m(1);

  const attH = m(11);
  parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${attH}" rx="${m(1.5)}" fill="#f9fafb" stroke="#d1d5db" stroke-width="0.7"/>`);
  const attItems = [
    { lbl: 'Total School Days', val: String(input.attendance.totalDays), color: '#111827' },
    { lbl: 'Days Present', val: String(input.attendance.presentDays), color: '#047857' },
    { lbl: 'Days Absent', val: String(input.attendance.absentDays), color: '#dc2626' },
    { lbl: 'Attendance %', val: `${input.attendance.percentage}%`, color: color },
  ];
  const attColW = (innerW - m(4)) / 4;
  attItems.forEach((item, i) => {
    const ax = M + m(2) + i * attColW;
    parts.push(`<text x="${ax + attColW / 2}" y="${y + m(3.5)}" font-size="${m(2.4)}" fill="#9ca3af" text-anchor="middle" letter-spacing="0.5">${esc(item.lbl.toUpperCase())}</text>`);
    parts.push(`<text x="${ax + attColW / 2}" y="${y + m(8)}" font-size="${m(4.2)}" font-weight="700" fill="${item.color}" text-anchor="middle">${esc(item.val)}</text>`);
  });
  y += attH + m(3);

  // ═════════════════════════════════════════════════════════════
  // SECTION 11: Remarks (teacher + principal)
  // ═════════════════════════════════════════════════════════════
  parts.push(renderIcon(ICON.user, M, y - m(2.8), m(3.2), color));
  parts.push(`<text x="${M + m(4.2)}" y="${y}" font-size="${m(3.2)}" font-weight="700" fill="${color}" letter-spacing="1.2">REMARKS &amp; SIGNATURES</text>`);
  parts.push(`<line x1="${M + m(50)}" y1="${y - m(1.2)}" x2="${W - M}" y2="${y - m(1.2)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.3"/>`);
  y += m(3) + m(1);

  const remGap = m(3);
  const remW = (innerW - remGap) / 2;
  const remH = m(19);

  const teacherComment = input.teacherComment || input.domainGrade?.classTeacherComment || 'No comment yet.';
  const teacherName2 = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Class Teacher';
  const principalComment = input.domainGrade?.principalComment || 'No comment yet.';
  const principalName2 = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';

  const rem1X = M;
  parts.push(`<rect x="${rem1X}" y="${y}" width="${remW}" height="${remH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);
  parts.push(`<text x="${rem1X + m(2)}" y="${y + m(3.5)}" font-size="${m(2.8)}" font-weight="700" fill="${color}" letter-spacing="0.6">TEACHER&apos;S REMARKS</text>`);
  parts.push(`<text x="${rem1X + m(2)}" y="${y + m(7.5)}" font-size="${m(2.6)}" font-style="italic" fill="#374151">${trunc(esc(teacherComment), 200)}</text>`);
  parts.push(`<line x1="${rem1X + m(2)}" y1="${y + remH - m(6.5)}" x2="${rem1X + remW - m(2)}" y2="${y + remH - m(6.5)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>`);
  parts.push(`<text x="${rem1X + m(2) + (remW - m(4)) / 2}" y="${y + remH - m(3.8)}" font-size="${m(2.4)}" font-weight="600" fill="#374151" text-anchor="middle">${esc(teacherName2)}</text>`);
  parts.push(`<text x="${rem1X + m(2) + (remW - m(4)) / 2}" y="${y + remH - m(1.5)}" font-size="${m(2)}" fill="#9ca3af" text-anchor="middle">Class Teacher</text>`);

  const rem2X = M + remW + remGap;
  parts.push(`<rect x="${rem2X}" y="${y}" width="${remW}" height="${remH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);
  parts.push(`<text x="${rem2X + m(2)}" y="${y + m(3.5)}" font-size="${m(2.8)}" font-weight="700" fill="${color}" letter-spacing="0.6">PRINCIPAL&apos;S REMARKS</text>`);
  parts.push(`<text x="${rem2X + m(2)}" y="${y + m(7.5)}" font-size="${m(2.6)}" font-style="italic" fill="#374151">${trunc(esc(principalComment), 200)}</text>`);
  parts.push(`<line x1="${rem2X + m(2)}" y1="${y + remH - m(6.5)}" x2="${rem2X + remW - m(2)}" y2="${y + remH - m(6.5)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>`);
  parts.push(`<text x="${rem2X + m(2) + (remW - m(4)) / 2}" y="${y + remH - m(3.8)}" font-size="${m(2.4)}" font-weight="600" fill="#374151" text-anchor="middle">${esc(principalName2)}</text>`);
  parts.push(`<text x="${rem2X + m(2) + (remW - m(4)) / 2}" y="${y + remH - m(1.5)}" font-size="${m(2)}" fill="#9ca3af" text-anchor="middle">Principal</text>`);

  y += remH + m(3);

  // ═════════════════════════════════════════════════════════════
  // SECTION 12: Domain Grading (3rd term only) — with Average row + rating badges
  // ═════════════════════════════════════════════════════════════
  if (input.isThirdTerm && input.domainGrade) {
    const dg = input.domainGrade;
    parts.push(renderIcon(ICON.star, M, y - m(2.8), m(3.2), color));
    parts.push(`<text x="${M + m(4.2)}" y="${y}" font-size="${m(3.2)}" font-weight="700" fill="${color}" letter-spacing="1.2">AFFECTIVE, PSYCHOMOTOR &amp; COGNITIVE DOMAIN GRADING</text>`);
    parts.push(`<line x1="${M + m(86)}" y1="${y - m(1.2)}" x2="${W - M}" y2="${y - m(1.2)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.3"/>`);
    y += m(3) + m(1);

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

    const domPad = m(2);
    const domGap = m(2);
    const domColW = (innerW - domPad * 2 - domGap * 2) / 3;
    const domTitleH = m(3.5);
    const maxRows = Math.max(...domains.map(d => d.keys.length));

    let domRowH = m(2.7);
    let domOuterH = m(28);
    let neededH = domPad * 2 + domTitleH + maxRows * domRowH + m(4);
    if (y + neededH > maxContentY) {
      domRowH = m(2.2);
      neededH = domPad * 2 + domTitleH + maxRows * domRowH + m(4);
      if (y + neededH > maxContentY) {
        domRowH = m(1.9);
        neededH = domPad * 2 + domTitleH + maxRows * domRowH + m(4);
      }
      domOuterH = neededH;
    }

    parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${domOuterH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);

    domains.forEach((dom, di) => {
      const dx = M + domPad + di * (domColW + domGap);
      parts.push(`<rect x="${dx}" y="${y + domPad}" width="${domColW}" height="${domTitleH}" fill="${color}15"/>`);
      parts.push(`<text x="${dx + domColW / 2}" y="${y + domPad + domTitleH - m(1)}" font-size="${m(2.4)}" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="0.8">${dom.title}</text>`);
      let lastY = y + domPad + domTitleH;
      dom.keys.forEach((k, i) => {
        const v = dom.data[k];
        const yPos = lastY + domRowH * 0.7;
        parts.push(`<text x="${dx + m(1.5)}" y="${yPos}" font-size="${m(2.3)}" fill="#374151">${esc(labelMap[k] || k)}</text>`);
        if (v) {
          const rc = ratingColor(v);
          const badgeText = `${ratingLabel(v)} (${v})`;
          const badgeW = Math.max(m(18), badgeText.length * m(1.5));
          parts.push(`<rect x="${dx + domColW - badgeW - m(1.2)}" y="${yPos - m(2)}" width="${badgeW}" height="${m(2.4)}" rx="${m(0.5)}" fill="${rc.bg}"/>`);
          parts.push(`<text x="${dx + domColW - badgeW - m(1.2) + badgeW / 2}" y="${yPos - m(0.4)}" font-size="${m(1.9)}" font-weight="600" fill="${rc.fg}" text-anchor="middle">${esc(badgeText)}</text>`);
        } else {
          parts.push(`<text x="${dx + domColW - m(1.2)}" y="${yPos}" font-size="${m(2.1)}" fill="#d1d5db" text-anchor="end">—</text>`);
        }
        lastY += domRowH;
      });
      const avgY = y + domOuterH - domPad - m(1.5);
      const avgVal = dom.data.average;
      parts.push(`<line x1="${dx + m(1)}" y1="${avgY - m(2.5)}" x2="${dx + domColW - m(1)}" y2="${avgY - m(2.5)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.4"/>`);
      parts.push(`<text x="${dx + m(1.5)}" y="${avgY}" font-size="${m(2.4)}" font-weight="700" fill="${color}">AVERAGE</text>`);
      if (avgVal) {
        const rc = ratingColor(avgVal);
        const badgeText = `${ratingLabel(avgVal)} (${avgVal})`;
        const badgeW = Math.max(m(18), badgeText.length * m(1.5));
        parts.push(`<rect x="${dx + domColW - badgeW - m(1.2)}" y="${avgY - m(2)}" width="${badgeW}" height="${m(2.4)}" rx="${m(0.5)}" fill="${rc.bg}"/>`);
        parts.push(`<text x="${dx + domColW - badgeW - m(1.2) + badgeW / 2}" y="${avgY - m(0.4)}" font-size="${m(1.9)}" font-weight="700" fill="${rc.fg}" text-anchor="middle">${esc(badgeText)}</text>`);
      } else {
        parts.push(`<text x="${dx + domColW - m(1.2)}" y="${avgY}" font-size="${m(2.1)}" fill="#d1d5db" text-anchor="end">—</text>`);
      }
    });

    y += domOuterH + m(3);
  }

  // ═════════════════════════════════════════════════════════════
  // SECTION 13: Footer
  // ═════════════════════════════════════════════════════════════
  const footerY = H - m(7);
  const nextTerm = input.settings?.nextTermBegins
    ? (() => {
        try { return new Date(input.settings!.nextTermBegins!).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
        catch { return ''; }
      })()
    : '';
  const printDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  parts.push(`<line x1="${M}" y1="${footerY - m(2.5)}" x2="${W - M}" y2="${footerY - m(2.5)}" stroke="#d1d5db" stroke-width="0.5"/>`);
  if (nextTerm) {
    parts.push(`<text x="${M}" y="${footerY}" font-size="${m(2.6)}" fill="#374151">Next Term Begins: <tspan font-weight="700" fill="${color}">${esc(nextTerm)}</tspan></text>`);
    parts.push(`<text x="${W - M}" y="${footerY}" font-size="${m(2.4)}" fill="#9ca3af" text-anchor="end">Printed: ${esc(printDate)}</text>`);
  } else {
    parts.push(`<text x="${M}" y="${footerY}" font-size="${m(2.4)}" fill="#9ca3af">Printed: ${esc(printDate)}</text>`);
  }
  parts.push(`<text x="${ctrX}" y="${footerY + m(4)}" font-size="${m(2.2)}" fill="#d1d5db" text-anchor="middle" letter-spacing="2">SKOOLAR · SCHOOL MANAGEMENT</text>`);

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
