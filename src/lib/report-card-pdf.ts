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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
  colorFaint: string; colorBg: string;
  fontStack: string; style: string;
  input: ReportCardPdfInput;
}

function buildCtx(input: ReportCardPdfInput): Ctx {
  const W = MM(210);
  const H = MM(297);
  const M = MM(10);
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

function buildReportCardSvg(ctx: Ctx): string {
  const { W, H, M, color, colorDk, colorLt, colorFaint, colorBg, input } = ctx;
  const m = (mm: number) => Math.round((mm / 25.4) * 96);

  const parts: string[] = [];
  let y = 0;

  // ═══════════════════════════════════════════════════════════
  // TOP COLOR BAR
  // ═══════════════════════════════════════════════════════════
  parts.push(`<rect x="0" y="0" width="${W}" height="${m(3)}" fill="${color}"/>`);
  y = m(3);

  // ═══════════════════════════════════════════════════════════
  // HEADER — Logo + School Name + Address + Motto + Contact
  // ═══════════════════════════════════════════════════════════
  const logoSize = m(13);
  const headerPad = m(1);
  const headerY = y + m(2);

  let logoBlock = '';
  if (input.school.logoBase64) {
    logoBlock = `<image href="${input.school.logoBase64}" x="${M}" y="${headerY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    const initials = esc((input.school.name || 'S').charAt(0).toUpperCase());
    logoBlock = `
      <circle cx="${M + logoSize / 2}" cy="${headerY + logoSize / 2}" r="${logoSize / 2}" fill="${color}"/>
      <text x="${M + logoSize / 2}" y="${headerY + logoSize / 2 + m(2.5)}" font-size="${m(6)}" font-weight="700" fill="#ffffff" text-anchor="middle">${initials}</text>`;
  }

  const textL = M + logoSize + m(3);
  const textW = W - textL - M;
  const schoolName = trunc(esc(input.school.name || 'School Name').toUpperCase(), 50);
  const schoolAddr = input.school.address ? trunc(esc(input.school.address), 80) : '';
  const schoolMotto = input.school.motto ? trunc(esc(input.school.motto), 70) : '';
  const contactParts = [input.school.phone, input.school.email, input.school.website].filter(Boolean);
  const contactStr = contactParts.length > 0 ? esc(contactParts.join(' | ')) : '';

  const headerEls: string[] = [];
  headerEls.push(`<text x="${textL}" y="${headerY + m(4.5)}" font-size="${m(4.8)}" font-weight="700" fill="#111827">${schoolName}</text>`);
  if (schoolAddr) headerEls.push(`<text x="${textL}" y="${headerY + m(9)}" font-size="${m(3)}" fill="#6b7280">${schoolAddr}</text>`);
  if (schoolMotto) headerEls.push(`<text x="${textL}" y="${headerY + m(12.5)}" font-size="${m(2.8)}" font-style="italic" fill="${color}">${schoolMotto}</text>`);
  if (contactStr) headerEls.push(`<text x="${textL}" y="${headerY + m(16)}" font-size="${m(2.6)}" fill="#9ca3af">${contactStr}</text>`);

  const headerH = m(18);
  parts.push(headerEls.join('\n'));
  parts.push(logoBlock);
  y = headerY + headerH;

  // ═══════════════════════════════════════════════════════════
  // BANNER — Session + Term
  // ═══════════════════════════════════════════════════════════
  const academicSession = input.settings?.academicSession || input.term.academicYear || '—';
  parts.push(`<text x="${W / 2}" y="${y + m(2)}" font-size="${m(2.8)}" fill="#6b7280" text-anchor="middle">Academic Session: ${esc(academicSession)}</text>`);
  y += m(4);
  parts.push(`<rect x="${M}" y="${y}" width="${W - 2 * M}" height="${m(7)}" fill="${color}" rx="${m(0.8)}"/>`);
  parts.push(`<text x="${W / 2}" y="${y + m(4.8)}" font-size="${m(3.8)}" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">END OF ${esc(termLabel(input.term.name))} TERM REPORT CARD</text>`);
  y += m(7) + m(2);

  // ═══════════════════════════════════════════════════════════
  // STUDENT INFO — Two columns + Photo
  // ═══════════════════════════════════════════════════════════
  const infoH = m(22);
  const photoSize = m(16);
  const infoX = M;
  const infoW = W - 2 * M;
  const photoX = infoX + infoW - photoSize - m(2);
  const photoY = y + (infoH - photoSize) / 2;
  const colW = (infoW - photoSize - m(6)) / 2;

  const leftFields: [string, string][] = [
    ['Student:', input.student.name || '—'],
    ['Admission No:', input.student.admissionNo || '—'],
    ['Class:', `${input.cls.name || '—'}${input.cls.section ? ` (${input.cls.section})` : ''}`],
    ['Gender:', input.student.gender || '—'],
  ];
  const rightFields: [string, string][] = [
    ['Date of Birth:', fmtDate(input.student.dateOfBirth)],
    ['Blood Group:', input.student.bloodGroup || '—'],
    ['No. in Class:', String(input.totals.totalStudents || '—')],
    ['Position:', input.totals.classRank
      ? `${input.totals.classRank}${input.totals.classRank === 1 ? 'st' : input.totals.classRank === 2 ? 'nd' : input.totals.classRank === 3 ? 'rd' : 'th'} of ${input.totals.totalStudents || '—'}`
      : '—'],
  ];

  let studentPhoto = '';
  if (input.student.photoBase64) {
    studentPhoto = `<image href="${input.student.photoBase64}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" rx="${photoSize / 2}"/>`;
  } else {
    const ini = esc((input.student.name || 'NA').split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase());
    studentPhoto = `
      <circle cx="${photoX + photoSize / 2}" cy="${photoY + photoSize / 2}" r="${photoSize / 2}" fill="${colorBg}"/>
      <text x="${photoX + photoSize / 2}" y="${photoY + photoSize / 2 + m(2.5)}" font-size="${m(6)}" font-weight="700" fill="${color}" text-anchor="middle">${ini}</text>`;
  }

  const renderFields = (fields: [string, string][], xBase: number): string =>
    fields.map(([lbl, val], i) => {
      const yy = y + m(3.5) + i * m(4.8);
      return `<text x="${xBase}" y="${yy}" font-size="${m(2.6)}" fill="#9ca3af">${esc(lbl)}</text>
        <text x="${xBase + m(12)}" y="${yy}" font-size="${m(3)}" font-weight="600" fill="#111827">${trunc(esc(val), 26)}</text>`;
    }).join('\n');

  parts.push(`<rect x="${infoX}" y="${y}" width="${infoW}" height="${infoH}" rx="${m(1.5)}" fill="#f9fafb" stroke="${color}" stroke-width="0.6" stroke-opacity="0.2"/>`);
  parts.push(renderFields(leftFields, infoX + m(2)));
  parts.push(renderFields(rightFields, infoX + colW + m(2)));
  parts.push(studentPhoto);
  y += infoH + m(2.5);

  // ═══════════════════════════════════════════════════════════
  // SCORE TABLE
  // ═══════════════════════════════════════════════════════════
  const tableX = M;
  const tableW = W - 2 * M;
  const hasDynamicCols = input.scoreTypes.length > 0;
  const scoreTypeCols = hasDynamicCols ? input.scoreTypes : [];
  const numScoreCols = scoreTypeCols.length;

  const snW = m(6);
  const subjectW = m(34);
  const gradeW = m(8);
  const remarkW = m(18);
  const totalW = m(9);
  const dynamicW = numScoreCols > 0
    ? Math.min(m(12), (tableW - snW - subjectW - totalW - gradeW - remarkW) / numScoreCols)
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

  const headerH2 = m(5);
  const rowH = m(3.5);

  // Header cells
  const hCells: string[] = [];
  hCells.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${headerH2}" fill="${color}" rx="${m(0.5)}"/>`);

  const hText = (x: number, w: number, txt: string, fs = m(2.8)) =>
    `<text x="${x + w / 2}" y="${y + headerH2 / 2 + m(1)}" font-size="${fs}" font-weight="700" fill="#ffffff" text-anchor="middle">${txt}</text>`;

  hCells.push(hText(colXs[0], snW, 'S/N'));
  hCells.push(`<text x="${colXs[1] + m(1)}" y="${y + headerH2 / 2 + m(1)}" font-size="${m(2.8)}" font-weight="700" fill="#ffffff">Subject</text>`);
  scoreTypeCols.forEach((st, i) => {
    hCells.push(hText(colXs[2 + i], dynamicW, `${trunc(esc(st.name), 8)} (${st.weight})`, m(2.5)));
  });
  if (hasDynamicCols) {
    hCells.push(hText(colXs[2 + numScoreCols], totalW, 'Total'));
  } else {
    const caX = colXs[2];
    const exX = caX + (tableW - snW - subjectW - totalW - gradeW - remarkW) / 2;
    hCells.push(hText(caX, exX - caX, 'CA (40)'));
    hCells.push(hText(exX, colXs[3] - exX, 'Exam (60)'));
    hCells.push(hText(colXs[5], totalW, 'Total'));
  }
  const grX = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
  hCells.push(hText(grX, gradeW, 'Grade'));
  hCells.push(`<text x="${remarkColX + remarkColW / 2}" y="${y + headerH2 / 2 + m(1)}" font-size="${m(2.8)}" font-weight="700" fill="#ffffff" text-anchor="middle">Remark</text>`);

  const tRows: string[] = [];
  let rowIdx = 0;
  for (const sr of input.subjectResults) {
    const yy = y + headerH2 + rowIdx * rowH;
    const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH}" fill="${bg}"/>`);
    tRows.push(`<text x="${colXs[0] + snW / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.8)}" fill="#6b7280" text-anchor="middle">${rowIdx + 1}</text>`);
    tRows.push(`<text x="${colXs[1] + m(1)}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.8)}" font-weight="500" fill="#111827" clip-path="url(#sClip)">${trunc(esc(sr.subjectName), 22)}</text>`);

    if (hasDynamicCols) {
      scoreTypeCols.forEach((st, i) => {
        const v = sr.scoresByType?.[st.id];
        const display = v && v.max > 0 ? String(Math.round(v.normalized)) : '—';
        tRows.push(`<text x="${colXs[2 + i] + dynamicW / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.6)}" fill="#374151" text-anchor="middle">${display}</text>`);
      });
      tRows.push(`<text x="${colXs[2 + numScoreCols] + totalW / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.8)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    } else {
      const caX = colXs[2];
      const exX = caX + (tableW - snW - subjectW - totalW - gradeW - remarkW) / 2;
      tRows.push(`<text x="${caX + (exX - caX) / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.6)}" fill="#374151" text-anchor="middle">${Math.round(sr.caScore || 0)}</text>`);
      tRows.push(`<text x="${exX + (colXs[3] - exX) / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.6)}" fill="#374151" text-anchor="middle">${Math.round(sr.examScore || 0)}</text>`);
      tRows.push(`<text x="${colXs[5] + totalW / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.8)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    }
    const grX2 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
    tRows.push(`<text x="${grX2 + gradeW / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.8)}" font-weight="700" fill="${gradeColor(sr.grade)}" text-anchor="middle">${esc(sr.grade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(1)}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.6)}" fill="#6b7280">${trunc(esc(sr.remark), 16)}</text>`);
    rowIdx++;
  }

  // Total row
  if (input.subjectResults.length > 0) {
    const yy = y + headerH2 + rowIdx * rowH;
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH}" fill="${colorFaint}"/>`);
    const totalSubjects = input.subjectResults.length;
    const labelX = colXs[0];
    const labelW = hasDynamicCols ? (colXs[2 + numScoreCols] - colXs[0]) : (colXs[4] - colXs[0]);
    tRows.push(`<text x="${labelX + labelW - m(1)}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.8)}" font-weight="700" fill="#111827" text-anchor="end">Total / ${totalSubjects * 100}</text>`);
    const tx = hasDynamicCols ? colXs[2 + numScoreCols] : colXs[5];
    tRows.push(`<text x="${tx + totalW / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.8)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(input.totals.grandTotal)}</text>`);
    const grX3 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
    tRows.push(`<text x="${grX3 + gradeW / 2}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.8)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(input.totals.overallGrade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(1)}" y="${yy + rowH / 2 + m(1)}" font-size="${m(2.6)}" fill="#374151">${trunc(esc(input.totals.overallRemark), 16)}</text>`);
    rowIdx++;
  }

  const tableH = headerH2 + rowIdx * rowH;
  parts.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${tableH}" rx="${m(0.8)}" fill="#ffffff" stroke="${color}" stroke-width="0.6" stroke-opacity="0.2"/>`);
  parts.push(hCells.join('\n'));
  parts.push(tRows.join('\n'));
  y += tableH + m(2.5);

  // ═══════════════════════════════════════════════════════════
  // SUMMARY CARDS — Total / Average / Grade / Position
  // ═══════════════════════════════════════════════════════════
  const summaryH = m(11);
  const sumGap = m(2);
  const sumCellW = (tableW - 3 * sumGap) / 4;
  const summary = [
    { label: 'Total Score', value: String(Math.round(input.totals.grandTotal)), sub: `/ ${input.subjectResults.length * 100}` },
    { label: 'Average', value: `${input.totals.averageScore.toFixed(1)}%`, sub: `${input.subjectResults.length} subjects` },
    { label: 'Grade', value: input.totals.overallGrade, sub: input.totals.overallRemark },
    { label: 'Position', value: String(input.totals.classRank || '—'), sub: `of ${input.totals.totalStudents || '—'}` },
  ];

  summary.forEach((s, i) => {
    const x = tableX + i * (sumCellW + sumGap);
    parts.push(`<rect x="${x}" y="${y}" width="${sumCellW}" height="${summaryH}" rx="${m(1)}" fill="${colorBg}" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(3.2)}" font-size="${m(2.4)}" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">${esc(s.label.toUpperCase())}</text>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(7.2)}" font-size="${m(4.5)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(s.value)}</text>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(9.5)}" font-size="${m(2.4)}" fill="#9ca3af" text-anchor="middle">${esc(s.sub)}</text>`);
  });
  y += summaryH + m(2.5);

  // ═══════════════════════════════════════════════════════════
  // DIVIDER
  // ═══════════════════════════════════════════════════════════
  parts.push(`<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="#d1d5db" stroke-width="0.5"/>`);
  y += m(2);

  // ═══════════════════════════════════════════════════════════
  // BOTTOM TWO-COLUMN SECTION
  // ═══════════════════════════════════════════════════════════
  const col2Gap = m(3);
  const leftW = (tableW - col2Gap) / 2;
  const rightW = leftW;

  // Remaining space to bottom
  const footerH = m(10);
  const bottomAvailable = H - M - footerH - y;
  const bottomRows = input.isThirdTerm && input.domainGrade ? 3 : 2;
  const rowH2 = bottomAvailable / bottomRows;

  // ─── LEFT: Attendance ───
  const attH = rowH2;
  const attX = M;
  parts.push(`<rect x="${attX}" y="${y}" width="${leftW}" height="${attH - m(1)}" rx="${m(1)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.25"/>`);
  parts.push(`<text x="${attX + m(1.5)}" y="${y + m(3)}" font-size="${m(2.8)}" font-weight="700" fill="${color}">ATTENDANCE</text>`);
  const attY = y + m(5);
  const attData = [
    { lbl: 'Total School Days:', val: String(input.attendance.totalDays), col: '#111827' },
    { lbl: 'Days Present:', val: String(input.attendance.presentDays), col: '#047857' },
    { lbl: 'Days Absent:', val: String(input.attendance.absentDays), col: '#dc2626' },
  ];
  attData.forEach((d, i) => {
    const yy = attY + i * m(3.2);
    parts.push(`<text x="${attX + m(1.5)}" y="${yy}" font-size="${m(2.5)}" fill="#6b7280">${esc(d.lbl)}</text>`);
    parts.push(`<text x="${attX + m(15)}" y="${yy}" font-size="${m(2.5)}" font-weight="600" fill="${d.col}">${esc(d.val)}</text>`);
  });
  parts.push(`<text x="${attX + leftW - m(1.5)}" y="${attY + m(3.2)}" font-size="${m(3)}" font-weight="700" fill="${color}" text-anchor="end">${input.attendance.percentage}%</text>`);

  // ─── LEFT: Teacher Comment ───
  const teacherY = y + attH;
  const teacherH = bottomRows === 3 ? rowH2 : rowH2 + (bottomAvailable - 2 * rowH2);
  const teacherComment = input.domainGrade?.classTeacherComment || '';
  const teacherName = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Class Teacher';
  parts.push(`<rect x="${attX}" y="${teacherY}" width="${leftW}" height="${teacherH - m(1)}" rx="${m(1)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.25"/>`);
  parts.push(`<text x="${attX + m(1.5)}" y="${teacherY + m(3)}" font-size="${m(2.8)}" font-weight="700" fill="${color}">CLASS TEACHER&apos;S COMMENT</text>`);
  parts.push(`<text x="${attX + m(1.5)}" y="${teacherY + m(6)}" font-size="${m(2.6)}" font-style="italic" fill="#374151">${trunc(esc(teacherComment || 'No comment yet.'), 90)}</text>`);
  parts.push(`<line x1="${attX + m(1.5)}" y1="${teacherY + teacherH - m(6)}" x2="${attX + leftW - m(1.5)}" y2="${teacherY + teacherH - m(6)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>`);
  parts.push(`<text x="${attX + leftW / 2}" y="${teacherY + teacherH - m(3)}" font-size="${m(2.5)}" fill="#6b7280" text-anchor="middle">${esc(teacherName)}</text>`);

  // ─── LEFT: Principal Comment (only if 3 rows) ───
  if (bottomRows === 3) {
    const prinY = teacherY + teacherH;
    const prinH = rowH2;
    const principalComment = input.domainGrade?.principalComment || '';
    const principalName = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';
    parts.push(`<rect x="${attX}" y="${prinY}" width="${leftW}" height="${prinH - m(1)}" rx="${m(1)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.25"/>`);
    parts.push(`<text x="${attX + m(1.5)}" y="${prinY + m(3)}" font-size="${m(2.8)}" font-weight="700" fill="${color}">PRINCIPAL&apos;S COMMENT</text>`);
    parts.push(`<text x="${attX + m(1.5)}" y="${prinY + m(6)}" font-size="${m(2.6)}" font-style="italic" fill="#374151">${trunc(esc(principalComment || 'No comment yet.'), 90)}</text>`);
    parts.push(`<line x1="${attX + m(1.5)}" y1="${prinY + prinH - m(6)}" x2="${attX + leftW - m(1.5)}" y2="${prinY + prinH - m(6)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>`);
    parts.push(`<text x="${attX + leftW / 2}" y="${prinY + prinH - m(3)}" font-size="${m(2.5)}" fill="#6b7280" text-anchor="middle">${esc(principalName)}</text>`);
  }

  // ─── RIGHT: Grading Key ───
  const rightX = M + leftW + col2Gap;
  const gkH = bottomRows === 3 ? rowH2 : rowH2 + (bottomAvailable - 2 * rowH2) * 0.4;
  const grades = [
    { grade: 'A', range: '70-100', remark: 'Excellent' },
    { grade: 'B', range: '60-69', remark: 'Very Good' },
    { grade: 'C', range: '50-59', remark: 'Good' },
    { grade: 'D', range: '40-49', remark: 'Fair' },
    { grade: 'E', range: '30-39', remark: 'Poor' },
    { grade: 'F', range: '0-29', remark: 'Fail' },
  ];
  const gradeCells = grades.map((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cw = (rightW - m(4)) / 2;
    const cx2 = rightX + m(1.5) + col * (cw + m(2));
    const cy = y + m(6) + row * m(3.8);
    return `<rect x="${cx2}" y="${cy}" width="${cw}" height="${m(3.2)}" rx="${m(0.5)}" fill="${colorBg}"/>
      <text x="${cx2 + m(1)}" y="${cy + m(2.2)}" font-size="${m(2.6)}" font-weight="700" fill="${color}">${g.grade}</text>
      <text x="${cx2 + m(4.5)}" y="${cy + m(2.2)}" font-size="${m(2.4)}" fill="#6b7280">${g.range} · ${g.remark}</text>`;
  }).join('\n');
  parts.push(`<rect x="${rightX}" y="${y}" width="${rightW}" height="${gkH - m(1)}" rx="${m(1)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.25"/>`);
  parts.push(`<text x="${rightX + m(1.5)}" y="${y + m(3)}" font-size="${m(2.8)}" font-weight="700" fill="${color}">GRADING KEY</text>`);
  parts.push(gradeCells);

  // ─── RIGHT: Domain Grading (3rd term only) ───
  if (input.isThirdTerm && input.domainGrade) {
    const dg = input.domainGrade;
    const domY = y + gkH;
    const domH = bottomAvailable - gkH + m(1);

    const domains: { title: string; data: Record<string, string | null>; keys: string[] }[] = [
      { title: 'COGNITIVE', data: dg.cognitive, keys: ['reasoning', 'memory', 'concentration', 'problemSolving', 'initiative'] },
      { title: 'PSYCHOMOTOR', data: dg.psychomotor, keys: ['handwriting', 'sports', 'drawing', 'practical'] },
      { title: 'AFFECTIVE', data: dg.affective, keys: ['punctuality', 'neatness', 'honesty', 'leadership', 'cooperation', 'attentiveness', 'obedience', 'selfControl', 'politness'] },
    ];
    const labelMap: Record<string, string> = {
      reasoning: 'Reasoning', memory: 'Memory', concentration: 'Concentration', problemSolving: 'Problem Solving', initiative: 'Initiative',
      handwriting: 'Handwriting', sports: 'Sports', drawing: 'Drawing', practical: 'Practical',
      punctuality: 'Punctuality', neatness: 'Neatness', honesty: 'Honesty', leadership: 'Leadership', cooperation: 'Cooperation',
      attentiveness: 'Attentiveness', obedience: 'Obedience', selfControl: 'Self Control', politness: 'Politeness',
    };

    const domColW = (rightW - m(4)) / 3;
    const domTitleY = domY + m(3.5);
    const domRowYs = (start: number): number[] =>
      domains[0].keys.concat(domains[1].keys).concat(domains[2].keys).map((_, i) => start + i * m(2));

    parts.push(`<rect x="${rightX}" y="${domY}" width="${rightW}" height="${domH - m(0.5)}" rx="${m(1)}" fill="#ffffff" stroke="${color}" stroke-width="0.5" stroke-opacity="0.25"/>`);
    parts.push(`<text x="${rightX + m(1.5)}" y="${domY + m(2.5)}" font-size="${m(2.4)}" font-weight="700" fill="${color}">DOMAIN GRADING</text>`);

    domains.forEach((dom, di) => {
      const dx = rightX + m(1.5) + di * (domColW + m(1));
      parts.push(`<text x="${dx + domColW / 2}" y="${domTitleY}" font-size="${m(2.4)}" font-weight="700" fill="${color}" text-anchor="middle">${dom.title}</text>`);
      dom.keys.slice(0, 9).forEach((k, i) => {
        const v = dom.data[k];
        const yPos = domY + m(4.5) + i * m(2.2);
        parts.push(`<text x="${dx + m(1)}" y="${yPos}" font-size="${m(2.2)}" fill="#374151">${esc(labelMap[k] || k)}:</text>`);
        parts.push(`<text x="${dx + domColW - m(1)}" y="${yPos}" font-size="${m(2.2)}" font-weight="600" fill="${v ? color : '#d1d5db'}" text-anchor="end">${v ? esc(ratingLabel(v)) : '—'}</text>`);
      });
      const avgY = domY + domH - m(3);
      parts.push(`<text x="${dx + domColW / 2}" y="${avgY}" font-size="${m(2.3)}" font-weight="700" fill="${color}" text-anchor="middle">Avg: ${dom.data.average ? `${esc(ratingLabel(dom.data.average))} (${dom.data.average})` : '—'}</text>`);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════
  const nextTerm = input.settings?.nextTermBegins
    ? (() => {
        try { return new Date(input.settings!.nextTermBegins!).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
        catch { return ''; }
      })()
    : '';
  const printDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const footerY2 = H - M + m(1);

  parts.push(`<line x1="${M}" y1="${footerY2 - m(2)}" x2="${W - M}" y2="${footerY2 - m(2)}" stroke="#d1d5db" stroke-width="0.5"/>`);
  if (nextTerm) {
    parts.push(`<text x="${M}" y="${footerY2}" font-size="${m(2.6)}" font-weight="600" fill="#374151">Next Term Begins: <tspan fill="${color}">${esc(nextTerm)}</tspan></text>`);
  }
  parts.push(`<text x="${W - M}" y="${footerY2}" font-size="${m(2.4)}" fill="#9ca3af" text-anchor="end">Printed: ${esc(printDate)}</text>`);
  parts.push(`<text x="${W / 2}" y="${footerY2 + m(3.5)}" font-size="${m(2.2)}" fill="#d1d5db" text-anchor="middle" letter-spacing="1.5">SKOOLAR • SCHOOL MANAGEMENT</text>`);

  // ═══════════════════════════════════════════════════════════
  // ASSEMBLE SVG
  // ═══════════════════════════════════════════════════════════
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
