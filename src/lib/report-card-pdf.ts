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
  const { W, H, M, color, colorDk, colorLt, colorFaint, colorBg, colorAlpha, input } = ctx;
  const m = (mm: number) => Math.round((mm / 25.4) * 96);

  const parts: string[] = [];
  let y = 0;

  // █████████████████████████████████████████████████████████████
  // TOP COLOR BAR
  // █████████████████████████████████████████████████████████████
  parts.push(`<rect x="0" y="0" width="${W}" height="${m(2.5)}" fill="${color}"/>`);
  y = m(2.5) + m(1.5);

  // █████████████████████████████████████████████████████████████
  // HEADER — Logo (centered) + School Name + Address + Contact + Motto
  // █████████████████████████████████████████████████████████████
  const logoSize = m(15);
  const logoX = (W - logoSize) / 2;

  let logoBlock = '';
  if (input.school.logoBase64) {
    logoBlock = `<image href="${input.school.logoBase64}" x="${logoX}" y="${y}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    logoBlock = `
      <circle cx="${W / 2}" cy="${y + logoSize / 2}" r="${logoSize / 2}" fill="${color}"/>
      <text x="${W / 2}" y="${y + logoSize / 2 + m(3.5)}" font-size="${m(7)}" font-weight="700" fill="#ffffff" text-anchor="middle">${esc((input.school.name || 'S').charAt(0).toUpperCase())}</text>`;
  }

  const nameY = y + logoSize + m(3);
  const schoolName = trunc(esc(input.school.name || 'School Name').toUpperCase(), 50);
  const schoolAddr = input.school.address ? trunc(esc(input.school.address), 85) : '';
  const schoolMotto = input.school.motto ? trunc(esc(input.school.motto), 75) : '';
  const contactParts = [input.school.phone, input.school.email, input.school.website].filter(Boolean);
  const contactStr = contactParts.length > 0 ? esc(contactParts.join(' | ')) : '';

  parts.push(logoBlock);
  parts.push(`<text x="${W / 2}" y="${nameY}" font-size="${m(5.5)}" font-weight="700" fill="#111827" text-anchor="middle" letter-spacing="0.5">${schoolName}</text>`);
  if (schoolAddr) parts.push(`<text x="${W / 2}" y="${nameY + m(5)}" font-size="${m(3.2)}" fill="#6b7280" text-anchor="middle">${schoolAddr}</text>`);
  if (contactStr) parts.push(`<text x="${W / 2}" y="${nameY + m(8.5)}" font-size="${m(2.8)}" fill="#9ca3af" text-anchor="middle">${contactStr}</text>`);
  if (schoolMotto) parts.push(`<text x="${W / 2}" y="${nameY + m(12)}" font-size="${m(3)}" font-style="italic" fill="${color}" text-anchor="middle">"${schoolMotto}"</text>`);
  y = nameY + (schoolMotto ? m(15) : contactStr ? m(12) : schoolAddr ? m(9) : m(6));

  // █████████████████████████████████████████████████████████████
  // BANNER — Academic Session + Term
  // █████████████████████████████████████████████████████████████
  y += m(2);
  const academicSession = input.settings?.academicSession || input.term.academicYear || '—';
  parts.push(`<text x="${W / 2}" y="${y}" font-size="${m(3)}" fill="#6b7280" text-anchor="middle">Academic Session: ${esc(academicSession)}</text>`);
  y += m(4);
  const bannerH = m(8);
  parts.push(`<rect x="${M + m(5)}" y="${y}" width="${W - 2 * (M + m(5))}" height="${bannerH}" fill="${color}" rx="${m(1)}"/>`);
  parts.push(`<text x="${W / 2}" y="${y + bannerH / 2 + m(1.2)}" font-size="${m(4.2)}" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">END OF ${esc(termLabel(input.term.name))} TERM REPORT CARD</text>`);
  y += bannerH + m(3);

  // █████████████████████████████████████████████████████████████
  // STUDENT INFO — Bordered card, 2 columns + photo
  // █████████████████████████████████████████████████████████████
  const infoH = m(28);
  const photoSize = m(18);
  const infoX = M;
  const infoW = W - 2 * M;
  const photoX = infoX + infoW - photoSize - m(3);
  const photoY = y + (infoH - photoSize) / 2;
  const colW = (infoW - photoSize - m(8)) / 2;

  const leftFields: [string, string][] = [
    ['Student Name', input.student.name || '—'],
    ['Admission No', input.student.admissionNo || '—'],
    ['Class', `${input.cls.name || '—'}${input.cls.section ? ` (${input.cls.section})` : ''}`],
    ['Gender', input.student.gender || '—'],
    ['Date of Birth', fmtDate(input.student.dateOfBirth)],
  ];
  const rightFields: [string, string][] = [
    ['Blood Group', input.student.bloodGroup || '—'],
    ['No. in Class', String(input.totals.totalStudents || '—')],
    ['Position', input.totals.classRank
      ? `${input.totals.classRank}${input.totals.classRank === 1 ? 'st' : input.totals.classRank === 2 ? 'nd' : input.totals.classRank === 3 ? 'rd' : 'th'} of ${input.totals.totalStudents || '—'}`
      : '—'],
    ['Term Begins', fmtDate(input.settings?.nextTermBegins)],
  ];

  let studentPhoto = '';
  if (input.student.photoBase64) {
    const pcx = photoX + photoSize / 2;
    const pcy = photoY + photoSize / 2;
    const pr = photoSize / 2;
    studentPhoto = `
      <clipPath id="pc"><circle cx="${pcx}" cy="${pcy}" r="${pr}"/></clipPath>
      <image href="${input.student.photoBase64}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>`;
  } else {
    const ini = esc((input.student.name || 'NA').split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase());
    studentPhoto = `
      <circle cx="${photoX + photoSize / 2}" cy="${photoY + photoSize / 2}" r="${photoSize / 2}" fill="${colorBg}"/>
      <circle cx="${photoX + photoSize / 2}" cy="${photoY + photoSize / 2}" r="${photoSize / 2}" fill="none" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>
      <text x="${photoX + photoSize / 2}" y="${photoY + photoSize / 2 + m(3)}" font-size="${m(7)}" font-weight="700" fill="${color}" text-anchor="middle">${ini}</text>`;
  }

  const renderFields = (fields: [string, string][], xBase: number): string =>
    fields.map(([lbl, val], i) => {
      const yy = y + m(3) + i * m(4.6);
      return `<text x="${xBase}" y="${yy}" font-size="${m(2.8)}" fill="#9ca3af">${esc(lbl)}</text>
        <text x="${xBase + m(14)}" y="${yy}" font-size="${m(3.2)}" font-weight="600" fill="#111827">${trunc(esc(val), 28)}</text>`;
    }).join('\n');

  parts.push(`<rect x="${infoX}" y="${y}" width="${infoW}" height="${infoH}" rx="${m(2)}" fill="#ffffff" stroke="${color}" stroke-width="0.8" stroke-opacity="0.3"/>`);
  parts.push(renderFields(leftFields, infoX + m(3)));
  parts.push(renderFields(rightFields, infoX + colW + m(3)));
  parts.push(studentPhoto);
  y += infoH + m(3);

  // █████████████████████████████████████████████████████████████
  // SCORE TABLE
  // █████████████████████████████████████████████████████████████
  const tableX = M;
  const tableW = W - 2 * M;
  const hasDynamicCols = input.scoreTypes.length > 0;
  const scoreTypeCols = hasDynamicCols ? input.scoreTypes : [];
  const numScoreCols = scoreTypeCols.length;

  const snW = m(7);
  const subjectW = m(36);
  const gradeW = m(9);
  const remarkW = m(20);
  const totalW = m(10);
  const dynamicW = numScoreCols > 0
    ? Math.min(m(13), (tableW - snW - subjectW - totalW - gradeW - remarkW) / numScoreCols)
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

  const headerH2 = m(5.5);
  const rowH = m(4);

  const hCells: string[] = [];
  hCells.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${headerH2}" fill="${color}" rx="${m(0.6)}"/>`);

  const hText = (x: number, w: number, txt: string, fs = m(3)) =>
    `<text x="${x + w / 2}" y="${y + headerH2 / 2 + m(1.2)}" font-size="${fs}" font-weight="700" fill="#ffffff" text-anchor="middle">${txt}</text>`;

  hCells.push(hText(colXs[0], snW, 'S/N'));
  hCells.push(`<text x="${colXs[1] + m(1.5)}" y="${y + headerH2 / 2 + m(1.2)}" font-size="${m(3)}" font-weight="700" fill="#ffffff">Subject</text>`);
  scoreTypeCols.forEach((st, i) => {
    hCells.push(hText(colXs[2 + i], dynamicW, `${trunc(esc(st.name), 8)} (${st.weight})`, m(2.6)));
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
  hCells.push(hText(remarkColX, remarkColW, 'Remark'));

  const tRows: string[] = [];
  let rowIdx = 0;
  for (const sr of input.subjectResults) {
    const yy = y + headerH2 + rowIdx * rowH;
    const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafb';
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH}" fill="${bg}"/>`);
    tRows.push(`<text x="${colXs[0] + snW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" fill="#6b7280" text-anchor="middle">${rowIdx + 1}</text>`);
    tRows.push(`<text x="${colXs[1] + m(1.5)}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(3)}" font-weight="500" fill="#111827">${trunc(esc(sr.subjectName), 24)}</text>`);
    if (hasDynamicCols) {
      scoreTypeCols.forEach((st, i) => {
        const v = sr.scoresByType?.[st.id];
        const display = v && v.max > 0 ? String(Math.round(v.normalized)) : '—';
        tRows.push(`<text x="${colXs[2 + i] + dynamicW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" fill="#374151" text-anchor="middle">${display}</text>`);
      });
      tRows.push(`<text x="${colXs[2 + numScoreCols] + totalW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(3)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    } else {
      const caX = colXs[2];
      const exX = caX + (tableW - snW - subjectW - totalW - gradeW - remarkW) / 2;
      tRows.push(`<text x="${caX + (exX - caX) / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" fill="#374151" text-anchor="middle">${Math.round(sr.caScore || 0)}</text>`);
      tRows.push(`<text x="${exX + (colXs[3] - exX) / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" fill="#374151" text-anchor="middle">${Math.round(sr.examScore || 0)}</text>`);
      tRows.push(`<text x="${colXs[5] + totalW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(3)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    }
    const grX2 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
    tRows.push(`<text x="${grX2 + gradeW / 2}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(3)}" font-weight="700" fill="${gradeColor(sr.grade)}" text-anchor="middle">${esc(sr.grade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(1.5)}" y="${yy + rowH / 2 + m(1.1)}" font-size="${m(2.8)}" fill="#6b7280">${trunc(esc(sr.remark), 18)}</text>`);
    rowIdx++;
  }

  if (input.subjectResults.length > 0) {
    const yy = y + headerH2 + rowIdx * rowH;
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH + m(0.5)}" fill="${colorFaint}"/>`);
    const totalSubjects = input.subjectResults.length;
    const labelX = colXs[0];
    const labelW = hasDynamicCols ? (colXs[2 + numScoreCols] - colXs[0]) : (colXs[4] - colXs[0]);
    tRows.push(`<text x="${labelX + labelW - m(1.5)}" y="${yy + (rowH + m(0.5)) / 2 + m(1.1)}" font-size="${m(3)}" font-weight="700" fill="#111827" text-anchor="end">Total / ${totalSubjects * 100}</text>`);
    const tx = hasDynamicCols ? colXs[2 + numScoreCols] : colXs[5];
    tRows.push(`<text x="${tx + totalW / 2}" y="${yy + (rowH + m(0.5)) / 2 + m(1.1)}" font-size="${m(3)}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(input.totals.grandTotal)}</text>`);
    const grX3 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[6];
    tRows.push(`<text x="${grX3 + gradeW / 2}" y="${yy + (rowH + m(0.5)) / 2 + m(1.1)}" font-size="${m(3)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(input.totals.overallGrade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(1.5)}" y="${yy + (rowH + m(0.5)) / 2 + m(1.1)}" font-size="${m(2.8)}" fill="#374151">${trunc(esc(input.totals.overallRemark), 18)}</text>`);
    rowIdx++;
  }

  const tableH = headerH2 + rowIdx * rowH;
  parts.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${tableH}" rx="${m(1)}" fill="#ffffff" stroke="${colorAlpha}" stroke-width="0.8"/>`);
  parts.push(hCells.join('\n'));
  parts.push(tRows.join('\n'));
  y += tableH + m(3);

  // █████████████████████████████████████████████████████████████
  // SUMMARY CARDS
  // █████████████████████████████████████████████████████████████
  const summaryH = m(13);
  const sumGap = m(2.5);
  const sumCellW = (tableW - 3 * sumGap) / 4;
  const summary = [
    { label: 'Total Score', value: String(Math.round(input.totals.grandTotal)), sub: `/ ${input.subjectResults.length * 100}` },
    { label: 'Average', value: `${input.totals.averageScore.toFixed(1)}%`, sub: `${input.subjectResults.length} subjects` },
    { label: 'Grade', value: input.totals.overallGrade, sub: input.totals.overallRemark },
    { label: 'Position', value: String(input.totals.classRank || '—'), sub: `of ${input.totals.totalStudents || '—'}` },
  ];

  summary.forEach((s, i) => {
    const x = tableX + i * (sumCellW + sumGap);
    parts.push(`<rect x="${x}" y="${y}" width="${sumCellW}" height="${summaryH}" rx="${m(1.5)}" fill="${colorBg}" stroke="${colorAlpha}" stroke-width="0.6"/>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(3.8)}" font-size="${m(2.6)}" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">${esc(s.label.toUpperCase())}</text>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(8.5)}" font-size="${m(5.5)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(s.value)}</text>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(11)}" font-size="${m(2.5)}" fill="#9ca3af" text-anchor="middle">${esc(s.sub)}</text>`);
  });
  y += summaryH + m(3);

  // █████████████████████████████████████████████████████████████
  // BOTTOM TWO-COLUMN SECTION
  // █████████████████████████████████████████████████████████████
  const col2Gap = m(3);
  const halfW = (tableW - col2Gap) / 2;
  const footerReserve = m(10);
  const bottomAvail = H - M - footerReserve - y;

  // ─── LEFT COLUMN: Attendance + Teacher Comment + Principal Comment ───
  const leftX = M;
  const leftCols = input.isThirdTerm && input.domainGrade ? 3 : 2;
  const leftRowH = bottomAvail / leftCols;

  // Attendance
  const attH = leftRowH;
  const attPad = m(1.5);
  parts.push(`<rect x="${leftX}" y="${y}" width="${halfW}" height="${attH - m(0.5)}" rx="${m(1.5)}" fill="#ffffff" stroke="${colorAlpha}" stroke-width="0.6"/>`);
  parts.push(`<text x="${leftX + attPad}" y="${y + m(3.5)}" font-size="${m(3.2)}" font-weight="700" fill="${color}">ATTENDANCE</text>`);
  const attData = [
    { lbl: 'Total School Days:', val: String(input.attendance.totalDays), col: '#111827' },
    { lbl: 'Days Present:', val: String(input.attendance.presentDays), col: '#047857' },
    { lbl: 'Days Absent:', val: String(input.attendance.absentDays), col: '#dc2626' },
  ];
  attData.forEach((d, i) => {
    const yy2 = y + m(6) + i * m(3.5);
    parts.push(`<text x="${leftX + attPad}" y="${yy2}" font-size="${m(2.8)}" fill="#6b7280">${esc(d.lbl)}</text>`);
    parts.push(`<text x="${leftX + m(16)}" y="${yy2}" font-size="${m(2.8)}" font-weight="600" fill="${d.col}">${esc(d.val)}</text>`);
  });
  parts.push(`<text x="${leftX + halfW - attPad}" y="${y + m(9.5)}" font-size="${m(3.5)}" font-weight="700" fill="${color}" text-anchor="end">${input.attendance.percentage}%</text>`);

  // Teacher Comment
  const teacherY = y + attH;
  const teacherComment = input.domainGrade?.classTeacherComment || '';
  const teacherName = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Class Teacher';
  const teacherH = leftCols === 3 ? leftRowH : leftRowH + (bottomAvail - 2 * leftRowH);
  parts.push(`<rect x="${leftX}" y="${teacherY}" width="${halfW}" height="${teacherH - m(0.5)}" rx="${m(1.5)}" fill="#ffffff" stroke="${colorAlpha}" stroke-width="0.6"/>`);
  parts.push(`<text x="${leftX + attPad}" y="${teacherY + m(3.5)}" font-size="${m(3.2)}" font-weight="700" fill="${color}">TEACHER&apos;S COMMENT</text>`);
  parts.push(`<text x="${leftX + attPad}" y="${teacherY + m(7)}" font-size="${m(2.8)}" font-style="italic" fill="#374151">${trunc(esc(teacherComment || 'No comment yet.'), 100)}</text>`);
  parts.push(`<line x1="${leftX + attPad}" y1="${teacherY + teacherH - m(6.5)}" x2="${leftX + halfW - attPad}" y2="${teacherY + teacherH - m(6.5)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>`);
  parts.push(`<text x="${leftX + halfW / 2}" y="${teacherY + teacherH - m(3.5)}" font-size="${m(2.6)}" fill="#6b7280" text-anchor="middle">${esc(teacherName)}</text>`);

  // Principal Comment (only with 3rd term domain)
  if (leftCols === 3) {
    const prinY = teacherY + teacherH;
    const prinH = leftRowH;
    const principalComment = input.domainGrade?.principalComment || '';
    const principalName = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';
    parts.push(`<rect x="${leftX}" y="${prinY}" width="${halfW}" height="${prinH - m(0.5)}" rx="${m(1.5)}" fill="#ffffff" stroke="${colorAlpha}" stroke-width="0.6"/>`);
    parts.push(`<text x="${leftX + attPad}" y="${prinY + m(3.5)}" font-size="${m(3.2)}" font-weight="700" fill="${color}">PRINCIPAL&apos;S COMMENT</text>`);
    parts.push(`<text x="${leftX + attPad}" y="${prinY + m(7)}" font-size="${m(2.8)}" font-style="italic" fill="#374151">${trunc(esc(principalComment || 'No comment yet.'), 100)}</text>`);
    parts.push(`<line x1="${leftX + attPad}" y1="${prinY + prinH - m(6.5)}" x2="${leftX + halfW - attPad}" y2="${prinY + prinH - m(6.5)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>`);
    parts.push(`<text x="${leftX + halfW / 2}" y="${prinY + prinH - m(3.5)}" font-size="${m(2.6)}" fill="#6b7280" text-anchor="middle">${esc(principalName)}</text>`);
  }

  // ─── RIGHT COLUMN: Grading Key (+ Domain for 3rd term) ───
  const rightX = M + halfW + col2Gap;

  // Grading Key
  const gkH = input.isThirdTerm && input.domainGrade ? bottomAvail * 0.35 : bottomAvail;
  const grades = [
    { grade: 'A', range: '70-100', remark: 'Excellent' },
    { grade: 'B', range: '60-69', remark: 'Very Good' },
    { grade: 'C', range: '50-59', remark: 'Good' },
    { grade: 'D', range: '40-49', remark: 'Fair' },
    { grade: 'E', range: '30-39', remark: 'Poor' },
    { grade: 'F', range: '0-29', remark: 'Fail' },
  ];
  const gkInnerPad = m(1.5);
  parts.push(`<rect x="${rightX}" y="${y}" width="${halfW}" height="${gkH - m(0.5)}" rx="${m(1.5)}" fill="#ffffff" stroke="${colorAlpha}" stroke-width="0.6"/>`);
  parts.push(`<text x="${rightX + gkInnerPad}" y="${y + m(3.5)}" font-size="${m(3.2)}" font-weight="700" fill="${color}">GRADING KEY</text>`);

  const gradeCells = grades.map((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cw = (halfW - m(5)) / 2;
    const cx2 = rightX + gkInnerPad + col * (cw + m(2));
    const cy2 = y + m(6.5) + row * m(4.2);
    return `<rect x="${cx2}" y="${cy2}" width="${cw}" height="${m(3.5)}" rx="${m(0.6)}" fill="${colorBg}"/>
      <text x="${cx2 + m(1.2)}" y="${cy2 + m(2.4)}" font-size="${m(2.8)}" font-weight="700" fill="${color}">${g.grade}</text>
      <text x="${cx2 + m(5)}" y="${cy2 + m(2.4)}" font-size="${m(2.5)}" fill="#6b7280">${g.range} · ${g.remark}</text>`;
  }).join('\n');
  parts.push(gradeCells);

  // Domain Grading (3rd term only)
  if (input.isThirdTerm && input.domainGrade) {
    const dg = input.domainGrade;
    const domY = y + gkH;
    const domH = bottomAvail - gkH;

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

    const domColW = (halfW - m(5)) / 3;
    const domPad = m(1.5);

    parts.push(`<rect x="${rightX}" y="${domY}" width="${halfW}" height="${domH - m(0.5)}" rx="${m(1.5)}" fill="#ffffff" stroke="${colorAlpha}" stroke-width="0.6"/>`);
    parts.push(`<text x="${rightX + domPad}" y="${domY + m(3)}" font-size="${m(2.8)}" font-weight="700" fill="${color}">DOMAIN GRADING</text>`);

    domains.forEach((dom, di) => {
      const dx = rightX + domPad + di * (domColW + m(1));
      parts.push(`<text x="${dx + domColW / 2}" y="${domY + m(5)}" font-size="${m(2.4)}" font-weight="700" fill="${color}" text-anchor="middle">${dom.title}</text>`);
      dom.keys.forEach((k, i) => {
        const v = dom.data[k];
        const yPos = domY + m(6.5) + i * m(2.4);
        parts.push(`<text x="${dx + m(1)}" y="${yPos}" font-size="${m(2.3)}" fill="#374151">${esc(labelMap[k] || k)}:</text>`);
        parts.push(`<text x="${dx + domColW - m(1)}" y="${yPos}" font-size="${m(2.3)}" font-weight="600" fill="${v ? color : '#d1d5db'}" text-anchor="end">${v ? esc(ratingLabel(v)) : '—'}</text>`);
      });
      const avgY = domY + domH - m(3.5);
      parts.push(`<line x1="${dx + m(1)}" y1="${avgY - m(1.5)}" x2="${dx + domColW - m(1)}" y2="${avgY - m(1.5)}" stroke="${color}" stroke-width="0.3" stroke-opacity="0.4"/>`);
      parts.push(`<text x="${dx + domColW / 2}" y="${avgY}" font-size="${m(2.4)}" font-weight="700" fill="${color}" text-anchor="middle">Avg: ${dom.data.average ? `${esc(ratingLabel(dom.data.average))} (${dom.data.average})` : '—'}</text>`);
    });
  }

  // █████████████████████████████████████████████████████████████
  // FOOTER
  // █████████████████████████████████████████████████████████████
  const nextTerm = input.settings?.nextTermBegins
    ? (() => {
        try { return new Date(input.settings!.nextTermBegins!).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
        catch { return ''; }
      })()
    : '';
  const printDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const footerY = H - M + m(1.5);

  parts.push(`<line x1="${M}" y1="${footerY - m(2.5)}" x2="${W - M}" y2="${footerY - m(2.5)}" stroke="#d1d5db" stroke-width="0.5"/>`);
  if (nextTerm) {
    parts.push(`<text x="${M}" y="${footerY}" font-size="${m(2.8)}" font-weight="600" fill="#374151">Next Term Begins: <tspan fill="${color}">${esc(nextTerm)}</tspan></text>`);
  }
  parts.push(`<text x="${W - M}" y="${footerY}" font-size="${m(2.5)}" fill="#9ca3af" text-anchor="end">Printed: ${esc(printDate)}</text>`);
  parts.push(`<text x="${W / 2}" y="${footerY + m(4)}" font-size="${m(2.3)}" fill="#d1d5db" text-anchor="middle" letter-spacing="2">SKOOLAR · SCHOOL MANAGEMENT</text>`);

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
