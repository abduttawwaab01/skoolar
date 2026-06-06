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

export interface ResolvedImage {
  buffer: Buffer;
  contentType: string;
}

export interface ReportCardPdfInput {
  student: {
    name: string;
    admissionNo: string;
    gender?: string | null;
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
    /** Resolved student photo (with correct MIME type for SVG embedding). */
    photo?: ResolvedImage | null;
    /** @deprecated Use `photo` — kept for back-compat only. */
    photoBase64?: string | null;
    photoBuffer?: Buffer | null;
    classPosition?: string;
  };
  school: {
    name: string;
    /** Resolved school logo (with correct MIME type for SVG embedding). */
    logo?: ResolvedImage | null;
    /** @deprecated Use `logo` — kept for back-compat only. */
    logoBase64?: string | null;
    logoBuffer?: Buffer | null;
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
    startDate?: string | null;
    endDate?: string | null;
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

const ordinalSuffix = (n: number): string => {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
};

const wrapSvgText = (text: string, maxChars: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur ? cur.length + 1 + w.length : w.length) <= maxChars) {
      cur = cur ? `${cur} ${w}` : w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (w.length > maxChars) {
        for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
        cur = '';
      }
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
};

const LINE_HEIGHT = 1.4;

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

/**
 * Build a `data:` URI for embedding an image in SVG. Uses the resolved
 * content type (PNG / JPEG / WebP) so resvg-wasm picks the right decoder —
 * a wrong MIME (e.g. always `image/png` for a JPEG logo) silently fails
 * to render the image at all.
 */
const toImageDataUri = (img: ResolvedImage | null | undefined): string | null => {
  if (!img || !img.buffer || img.buffer.length === 0) return null;
  const ct = (img.contentType || 'image/png').split(';')[0].trim();
  const safe = ct.startsWith('image/') ? ct : 'image/png';
  return `data:${safe};base64,${img.buffer.toString('base64')}`;
};

interface Ctx {
  W: number; H: number; M: number;
  color: string; colorDk: string; colorLt: string;
  colorFaint: string; colorBg: string; colorAlpha: string;
  fontStack: string; style: string;
  input: ReportCardPdfInput;
}

export interface ReportCardLayoutOptions {
  /** Five inter-section gaps in PNG pixels: after-info, after-table, after-stats, after-attendance, after-remarks */
  gaps: [number, number, number, number, number];
  /** Height of the Remarks & Signatures card in PNG pixels */
  remH: number;
  /** Whether to render the Domain Grading section (3rd term only) */
  includeDomain: boolean;
}

/**
 * For 1st/2nd term layouts the report card has no domain-grading block,
 * which leaves a large empty band before the footer. This helper computes
 * the smallest constant `gap` value that fills the A4 page evenly when
 * distributed across the five inter-section gaps, plus an optional
 * enlargement of the remarks card to absorb any further slack.
 *
 * Strategy:
 *  1. Compute the "base" content height assuming all gaps are 0 and the
 *     remarks card is at its minimum size.
 *  2. Slack = maxContentY - baseHeight - minRemH - minGap*5
 *  3. Distribute slack: 60% across the 5 gaps, 40% into the remarks card
 *     (capped at a reasonable upper bound).
 */
function computeShortLayoutMetrics(
  ctx: Ctx,
  measuredHeights: {
    headerH: number;
    pillH: number;
    infoH: number;
    tableH: number;
    sumH: number;
    attH: number;
    baseRemH: number;
  }
): { gaps: [number, number, number, number, number]; remH: number } {
  const m = (mm: number) => Math.round((mm / 25.4) * 96);
  const { H } = ctx;

  const footerReserveH = m(7);
  const taglineReserveH = m(4);
  const maxContentY = H - footerReserveH - taglineReserveH;

  const { headerH, pillH, infoH, tableH, sumH, attH, baseRemH } = measuredHeights;

  // Minimal gaps (5 zones, see report-card-pdf.ts section dividers)
  const minGap = m(4);
  // Sections that are NOT inside the 5-gap distribution: header→pill
  // margin, pill→info label, info label→card. These are part of the
  // fixed content height.
  const fixedMargins = m(2.5) + m(4) + m(3.4) + m(1.5);
  const baseContentH =
    headerH + fixedMargins +
    infoH + minGap +              // → table
    tableH + minGap +             // → stats
    sumH + minGap +               // → attendance
    attH + minGap +               // → remarks
    baseRemH + minGap;            // → footer

  const slack = maxContentY - baseContentH;
  if (slack <= 0) {
    return { gaps: [minGap, minGap, minGap, minGap, minGap], remH: baseRemH };
  }

  // Upper bounds — chosen to be generous so the layout fills the page
  // for typical 8–20 subject report cards. The formula below is
  // self-balancing: if either cap is hit, the remaining slack is
  // pushed into the other dimension.
  const maxGap = m(12);     // never grow a single gap beyond 12mm
  const maxRemH = m(40);    // never grow the remarks card beyond 40mm

  // First pass: 70% of slack to gaps, 30% to the remarks card. The
  // gaps absorb most of the space because they affect the overall
  // page rhythm; the remarks card absorbs what doesn't fit in gaps.
  let gapExtra = Math.min(maxGap - minGap, (slack * 0.7) / 5);
  let remExtra = Math.min(maxRemH - baseRemH, slack * 0.3);

  // If a cap was hit, the unused slack has to go somewhere. Push it
  // into whichever dimension has headroom.
  const gapUsed = 5 * gapExtra;
  const remUsed = remExtra;
  let leftover = Math.max(0, slack - gapUsed - remUsed);
  if (leftover > 0) {
    const gapHeadroom = Math.max(0, maxGap - minGap - gapExtra);
    const remHeadroom = Math.max(0, maxRemH - baseRemH - remExtra);
    if (gapHeadroom > 0) {
      gapExtra = Math.min(maxGap - minGap, gapExtra + leftover / 5);
    } else if (remHeadroom > 0) {
      remExtra = Math.min(maxRemH - baseRemH, remExtra + leftover);
    }
  }

  const gap = Math.round(minGap + gapExtra);
  const remH = Math.round(baseRemH + remExtra);

  return {
    gaps: [gap, gap, gap, gap, gap],
    remH,
  };
}

/** Fixed layout options for 3rd-term (full) report cards. */
function buildFullLayoutOptions(m: (mm: number) => number): ReportCardLayoutOptions {
  return {
    gaps: [m(4), m(4), m(4), m(4), m(3)],
    remH: m(24),
    includeDomain: true,
  };
}

/** Dynamic layout options for 1st/2nd-term (short) report cards. */
function buildShortLayoutOptions(
  ctx: Ctx,
  measuredHeights: {
    headerH: number;
    pillH: number;
    infoH: number;
    tableH: number;
    sumH: number;
    attH: number;
    baseRemH: number;
  }
): ReportCardLayoutOptions {
  const { gaps, remH } = computeShortLayoutMetrics(ctx, measuredHeights);
  return { gaps, remH, includeDomain: false };
}

function buildCtx(input: ReportCardPdfInput): Ctx {
  const W = MM(210);
  const H = MM(297);
  const M = MM(12);
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
  idCard: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z M8 11h8 M8 15h5 M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  listOrdered: 'M10 6h11 M10 12h11 M10 18h11 M4 6h1v4 M4 10h2 M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
};

const renderIcon = (path: string, x: number, y: number, size: number, color: string) =>
  `<g transform="translate(${x},${y}) scale(${(size / 24).toFixed(4)})" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></g>`;

function buildReportCardSvg(ctx: Ctx, layout: ReportCardLayoutOptions): { svg: string } {
  const { W, H, M, color, input } = ctx;
  const m = (mm: number) => Math.round((mm / 25.4) * 96);
  const ctrX = W / 2;
  const innerW = W - 2 * M;

  // Reserve at the bottom: footer line (7mm) + tagline (3mm)
  const footerReserveH = m(7);
  const taglineReserveH = m(4);
  const maxContentY = H - footerReserveH - taglineReserveH;

  const parts: string[] = [];
  const hCells: string[] = [];
  let y = 0;

  // Defs collected up front so clip-paths and other shared defs are
  // declared before they're used by <image> elements.
  const defs: string[] = [];

  // Compute defs (clip path for photo) — placed inline near the image for proper SVG order
  const photoSize = m(24);
  const photoReservedW = photoSize + m(8);
  const infoX = M;
  const pr = photoSize / 2;

  // ═════════════════════════════════════════════════════════════
  // SECTION 1: Top accent bar
  // ═════════════════════════════════════════════════════════════
  parts.push(`<rect x="0" y="0" width="${W}" height="${m(2.5)}" fill="${color}"/>`);
  y = m(2.5) + m(2);

  // ═════════════════════════════════════════════════════════════
  // SECTION 2: Header (horizontal — logo LEFT, school info RIGHT)
  // ═════════════════════════════════════════════════════════════
  const headerTopY = y;
  const logoSize = m(20);
  const logoCenterY = headerTopY + logoSize / 2;
  const logoX = M;
  const logoEndX = M + logoSize;
  const textStartX = logoEndX + m(3);
  const textEndX = W - M;
  const textCenterX = (textStartX + textEndX) / 2;

  parts.push(`<circle cx="${logoX + logoSize / 2}" cy="${logoCenterY}" r="${logoSize / 2 + m(0.8)}" fill="#ffffff" stroke="${color}" stroke-width="0.6" stroke-opacity="0.3"/>`);
  // Resolve the school logo to an embeddable data URI using the actual
  // content type (JPEG vs PNG vs WebP). resvg-wasm silently fails to
  // render a PNG-prefixed URI when the bytes are JPEG, so the MIME must
  // match the buffer.
  const logoDataUri = toImageDataUri(input.school.logo)
    || (input.school.logoBuffer ? `data:image/png;base64,${input.school.logoBuffer.toString('base64')}` : null)
    || input.school.logoBase64
    || null;
  if (logoDataUri) {
    parts.push(`<image href="${logoDataUri}" x="${logoX}" y="${headerTopY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`);
  } else {
    const initial = esc((input.school.name || 'S').charAt(0).toUpperCase());
    parts.push(`<text x="${logoX + logoSize / 2}" y="${logoCenterY + m(4)}" font-size="${m(9)}" font-weight="700" fill="${color}" text-anchor="middle">${initial}</text>`);
  }

  let textY = headerTopY;
  const schoolName = esc(input.school.name || '').toUpperCase();
  parts.push(`<text x="${textCenterX}" y="${textY + m(5.5)}" font-size="${m(6.4)}" font-weight="700" fill="#111827" text-anchor="middle" letter-spacing="0.5">${trunc(schoolName, 55)}</text>`);
  textY += m(6.4) + m(1.2);

  if (input.school.address) {
    parts.push(`<text x="${textCenterX}" y="${textY + m(3.4)}" font-size="${m(3.2)}" fill="#6b7280" text-anchor="middle">${trunc(esc(input.school.address), 95)}</text>`);
    textY += m(3.4) + m(0.8);
  }

  const contactParts = [input.school.phone, input.school.email].filter(Boolean);
  if (contactParts.length > 0) {
    parts.push(`<text x="${textCenterX}" y="${textY + m(3.1)}" font-size="${m(2.8)}" fill="#9ca3af" text-anchor="middle">${trunc(esc(contactParts.join(' | ')), 110)}</text>`);
    textY += m(3.1) + m(0.8);
  }

  const mottoText = input.school.motto || input.settings?.schoolMotto;
  if (mottoText) {
    parts.push(`<text x="${textCenterX}" y="${textY + m(3.2)}" font-size="${m(3)}" font-style="italic" fill="${color}" text-anchor="middle">* ${trunc(esc(mottoText), 80)} *</text>`);
    textY += m(3.2) + m(1.5);
  } else {
    textY += m(1);
  }

  y = Math.max(headerTopY + logoSize, textY) + m(3);

  // ═════════════════════════════════════════════════════════════
  // SECTION 3: Title in green pill badge
  // ═════════════════════════════════════════════════════════════
  const academicSession = esc(input.settings?.academicSession || input.term.academicYear || '—');
  const pillH = m(7.5);
  const pillW = m(120);
  const pillX = ctrX - pillW / 2;
  parts.push(`<rect x="${pillX}" y="${y}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${color}"/>`);
  parts.push(`<rect x="${pillX + m(0.3)}" y="${y + m(0.3)}" width="${pillW - m(0.6)}" height="${pillH - m(0.6)}" rx="${(pillH - m(0.6)) / 2}" fill="none" stroke="#ffffff" stroke-width="0.4" stroke-opacity="0.5"/>`);
  const termAbbr = esc(termLabel(input.term.name));
  parts.push(`<text x="${ctrX}" y="${y + pillH / 2 + m(1.4)}" font-size="${m(3.8)}" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">${academicSession} ${termAbbr} TERM ACADEMIC RESULT</text>`);
  y += pillH + m(4);

  // ═════════════════════════════════════════════════════════════
  // SECTION 5: STUDENT INFORMATION section header
  // ═════════════════════════════════════════════════════════════
  parts.push(renderIcon(ICON.users, M, y - m(3), m(3.4), color));
  parts.push(`<text x="${M + m(4.5)}" y="${y}" font-size="${m(3.4)}" font-weight="700" fill="${color}" letter-spacing="1.2">STUDENT INFORMATION</text>`);
  parts.push(`<line x1="${M + m(48)}" y1="${y - m(1.2)}" x2="${W - M}" y2="${y - m(1.2)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.3"/>`);
  y += m(3.4) + m(1.5);

  // ═════════════════════════════════════════════════════════════
  // SECTION 6: Student info card (3-col grid + photo)
  // ═════════════════════════════════════════════════════════════
  const infoYActual = y;
  const gridW = innerW - photoReservedW;
  const colW = gridW / 3;
  const infoFieldH = m(9);
  const infoRows = 3;
  const infoH = infoRows * infoFieldH + m(4);
  const infoPadX = m(5);

  parts.push(`<rect x="${infoX}" y="${infoYActual}" width="${innerW}" height="${infoH}" rx="${m(1.5)}" fill="#f9fafb" stroke="#d1d5db" stroke-width="0.7"/>`);

  const fields: [string, string, string][] = [
    [ICON.user, 'Student Name:', input.student.name || '—'],
    [ICON.user, 'Gender:', input.student.gender || '—'],
    [ICON.calendar, 'Term Begins:', fmtDate(input.term?.startDate)],
    [ICON.idCard, 'Admission No:', input.student.admissionNo || '—'],
    [ICON.users, 'No. in Class:', String(input.totals.totalStudents || '—')],
    [ICON.calendar, 'Term Ends:', fmtDate(input.term?.endDate)],
    [ICON.school, 'Class:', `${input.cls.name || '—'}${input.cls.section ? ` (${input.cls.section})` : ''}`],
    [ICON.listOrdered, 'Position:', input.totals.classRank
      ? `${input.totals.classRank}${ordinalSuffix(input.totals.classRank)} of ${input.totals.totalStudents || '—'}`
      : '—'],
  ];

  fields.forEach(([iconPath, label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const fieldX = infoX + infoPadX + col * colW;
    const fieldY = infoYActual + m(4) + row * infoFieldH;
    parts.push(renderIcon(iconPath, fieldX, fieldY - m(3), m(3.2), '#9ca3af'));
    parts.push(`<text x="${fieldX + m(5)}" y="${fieldY}" font-size="${m(2.7)}" fill="#9ca3af" letter-spacing="0.3">${esc(label)}</text>`);
    parts.push(`<text x="${fieldX + m(5)}" y="${fieldY + m(4.2)}" font-size="${m(3.5)}" font-weight="600" fill="#111827">${trunc(esc(value), 24)}</text>`);
  });

  // Photo — embedded directly in the SVG (with a circular clip-path) so
  // the print and PDF renderers handle the image the same way. resvg-wasm
  // decodes data URIs reliably; the previous sharp-composite path added
  // complexity without visible benefit. The data URI uses the actual MIME
  // type of the buffer (see toImageDataUri).
  const photoXActual = infoX + innerW - m(2) - photoSize;
  const photoYActual = infoYActual + (infoH - photoSize) / 2;
  const pcxActual = photoXActual + photoSize / 2;
  const pcyActual = photoYActual + photoSize / 2;
  const photoDataUri = toImageDataUri(input.student.photo)
    || (input.student.photoBuffer ? `data:image/png;base64,${input.student.photoBuffer.toString('base64')}` : null)
    || input.student.photoBase64
    || null;
  const hasPhoto = !!photoDataUri;
  const photoClipId = 'rc-photo-clip';
  if (hasPhoto) {
    defs.push(`<clipPath id="${photoClipId}"><circle cx="${pcxActual}" cy="${pcyActual}" r="${pr}"/></clipPath>`);
    parts.push(`<image href="${photoDataUri}" x="${photoXActual}" y="${photoYActual}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${photoClipId})"/>`);
  } else {
    parts.push(`<circle cx="${pcxActual}" cy="${pcyActual}" r="${pr}" fill="${color}15"/>`);
    const ini = esc((input.student.name || 'NA').split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase());
    parts.push(`<text x="${pcxActual}" y="${pcyActual + m(4)}" font-size="${m(9)}" font-weight="700" fill="${color}" text-anchor="middle">${ini}</text>`);
  }
  // Always draw a thin colored ring on top of the photo (matches the
  // print view's `border-2` style on the rounded image).
  parts.push(`<circle cx="${pcxActual}" cy="${pcyActual}" r="${pr}" fill="none" stroke="${color}" stroke-width="${hasPhoto ? m(0.4) : m(0.3)}"/>`);

  y = infoYActual + infoH + layout.gaps[0];

  // ═════════════════════════════════════════════════════════════
  // SECTION 7: Score table
  // ═════════════════════════════════════════════════════════════
  const tableX = M;
  const tableW = innerW;
  const hasDynamicCols = input.scoreTypes.length > 0;
  const scoreTypeCols = hasDynamicCols ? input.scoreTypes : [];
  const numScoreCols = scoreTypeCols.length;

  const snW = m(8);
  const subjectW = m(36);
  const totalW = m(10);
  const gradeW = m(9);
  const remarkW = m(22);
  const dynamicW = numScoreCols > 0
    ? Math.min(m(14), Math.max(m(10), (tableW - snW - subjectW - totalW - gradeW - remarkW) / numScoreCols))
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

  const headerH = m(7);
  // Adaptive row height based on number of subjects to keep within page
  const N = input.subjectResults.length;
  let rowH = m(5);
  if (N >= 18) rowH = m(3.4);
  else if (N >= 15) rowH = m(3.8);
  else if (N >= 12) rowH = m(4.2);
  else rowH = m(5);

  parts.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${headerH}" fill="${color}"/>`);

  const cellText = (x: number, w: number, txt: string, fs = m(2.8), align = 'center', color2 = '#ffffff', weight = '700') =>
    `<text x="${x + w / 2}" y="${y + headerH / 2 + m(1.5)}" font-size="${fs}" font-weight="${weight}" fill="${color2}" text-anchor="${align}">${txt}</text>`;

  hCells.push(cellText(colXs[0] + snW / 2, 0, 'S/N', m(2.8), 'middle', '#ffffff'));
  hCells.push(`<text x="${colXs[1] + m(3)}" y="${y + headerH / 2 + m(1.5)}" font-size="${m(2.8)}" font-weight="700" fill="#ffffff">Subject</text>`);
  scoreTypeCols.forEach((st, i) => {
    hCells.push(cellText(colXs[2 + i] + dynamicW / 2, 0, `${trunc(esc(st.name), 10)} (${st.weight})`, m(2.6), 'middle', '#ffffff'));
  });

  if (hasDynamicCols) {
    hCells.push(cellText(colXs[2 + numScoreCols] + totalW / 2, 0, 'Total', m(2.8), 'middle', '#ffffff'));
  } else {
    const caStart = colXs[2];
    const examStart = colXs[3];
    hCells.push(cellText(caStart + (examStart - caStart) / 2, 0, 'Mid-Term CA', m(2.6), 'middle', '#ffffff'));
    hCells.push(cellText(examStart + (colXs[4] - examStart) / 2, 0, 'Exam', m(2.6), 'middle', '#ffffff'));
    hCells.push(cellText(colXs[4] + totalW / 2, 0, 'Total', m(2.8), 'middle', '#ffffff'));
  }
  const grX = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
  hCells.push(cellText(grX + gradeW / 2, 0, 'Grade', m(2.8), 'middle', '#ffffff'));
  hCells.push(cellText(remarkColX + remarkColW / 2, 0, 'Remark', m(2.8), 'middle', '#ffffff'));

  // Render header text
  parts.push(hCells.join('\n'));

  const tRows: string[] = [];
  let rowIdx = 0;
  const cellFont = rowH >= m(4.8) ? m(3) : (rowH >= m(4) ? m(2.8) : (rowH >= m(3.5) ? m(2.6) : m(2.4)));
  for (const sr of input.subjectResults) {
    const yy = y + headerH + rowIdx * rowH;
    const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH}" fill="${bg}" stroke="#d1d5db" stroke-width="0.4"/>`);
    tRows.push(`<text x="${colXs[0] + snW / 2}" y="${yy + rowH / 2 + m(1.2)}" font-size="${m(2.8)}" fill="#6b7280" text-anchor="middle">${rowIdx + 1}</text>`);
    tRows.push(`<text x="${colXs[1] + m(3)}" y="${yy + rowH / 2 + m(1.2)}" font-size="${cellFont}" font-weight="500" fill="#111827">${trunc(esc(sr.subjectName), 20)}</text>`);
    if (hasDynamicCols) {
      scoreTypeCols.forEach((st, i) => {
        const v = sr.scoresByType?.[st.id];
        const display = v && v.max > 0 ? String(Math.round(v.normalized)) : '—';
        tRows.push(`<text x="${colXs[2 + i] + dynamicW / 2}" y="${yy + rowH / 2 + m(1.2)}" font-size="${m(2.8)}" fill="#374151" text-anchor="middle">${display}</text>`);
      });
      tRows.push(`<text x="${colXs[2 + numScoreCols] + totalW / 2}" y="${yy + rowH / 2 + m(1.2)}" font-size="${cellFont}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    } else {
      const caStart = colXs[2];
      const examStart = colXs[3];
      tRows.push(`<text x="${caStart + (examStart - caStart) / 2}" y="${yy + rowH / 2 + m(1.2)}" font-size="${m(2.8)}" fill="#374151" text-anchor="middle">${Math.round(sr.caScore || 0)}</text>`);
      tRows.push(`<text x="${examStart + (colXs[4] - examStart) / 2}" y="${yy + rowH / 2 + m(1.2)}" font-size="${m(2.8)}" fill="#374151" text-anchor="middle">${Math.round(sr.examScore || 0)}</text>`);
      tRows.push(`<text x="${colXs[4] + totalW / 2}" y="${yy + rowH / 2 + m(1.2)}" font-size="${cellFont}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(sr.total)}</text>`);
    }
    const grX2 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
    tRows.push(`<text x="${grX2 + gradeW / 2}" y="${yy + rowH / 2 + m(1.2)}" font-size="${cellFont}" font-weight="700" fill="${gradeColor(sr.grade)}" text-anchor="middle">${esc(sr.grade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(3)}" y="${yy + rowH / 2 + m(1.2)}" font-size="${m(2.8)}" fill="#6b7280">${trunc(esc(sr.remark), 16)}</text>`);
    rowIdx++;
  }

  if (input.subjectResults.length > 0) {
    const yy = y + headerH + rowIdx * rowH;
    tRows.push(`<rect x="${tableX}" y="${yy}" width="${tableW}" height="${rowH + m(0.4)}" fill="#f3f4f6" stroke="#d1d5db" stroke-width="0.5"/>`);
    const totalSubjects = input.subjectResults.length;
    const labelEndX = hasDynamicCols ? (colXs[2 + numScoreCols]) : colXs[4];
    tRows.push(`<text x="${labelEndX - m(1)}" y="${yy + (rowH + m(0.4)) / 2 + m(1.2)}" font-size="${cellFont}" font-weight="700" fill="#374151" text-anchor="end">Total / ${totalSubjects * 100}</text>`);
    const tx = hasDynamicCols ? colXs[2 + numScoreCols] : colXs[4];
    tRows.push(`<text x="${tx + totalW / 2}" y="${yy + (rowH + m(0.4)) / 2 + m(1.2)}" font-size="${cellFont}" font-weight="700" fill="#111827" text-anchor="middle">${Math.round(input.totals.grandTotal)}</text>`);
    const grX3 = hasDynamicCols ? colXs[3 + numScoreCols] : colXs[5];
    tRows.push(`<text x="${grX3 + gradeW / 2}" y="${yy + (rowH + m(0.4)) / 2 + m(1.2)}" font-size="${cellFont}" font-weight="700" fill="${color}" text-anchor="middle">${esc(input.totals.overallGrade)}</text>`);
    tRows.push(`<text x="${remarkColX + m(3)}" y="${yy + (rowH + m(0.4)) / 2 + m(1.2)}" font-size="${m(2.8)}" fill="#374151">${trunc(esc(input.totals.overallRemark), 16)}</text>`);
    rowIdx++;
  }

  const tableH = headerH + rowIdx * rowH;
  parts.push(tRows.join('\n'));
  parts.push(`<line x1="${tableX}" y1="${y}" x2="${tableX + tableW}" y2="${y}" stroke="${color}" stroke-width="0.5"/>`);
  parts.push(`<line x1="${tableX}" y1="${y + tableH}" x2="${tableX + tableW}" y2="${y + tableH}" stroke="${color}" stroke-width="0.5"/>`);
  y += tableH + layout.gaps[1];

  // ═════════════════════════════════════════════════════════════
  // SECTION 8: 4-Card Stat Summary (with icons) — larger
  // ═════════════════════════════════════════════════════════════
  const sumH = m(20);
  const sumGap = m(2.5);
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
    parts.push(`<rect x="${x}" y="${y}" width="${sumCellW}" height="${sumH}" rx="${m(1.5)}" fill="${color}08" stroke="${color}" stroke-width="0.7" stroke-opacity="0.3"/>`);
    const iconSize = m(4);
    const labelStartX = x + m(2.5);
    const labelStartY = y + m(3.5);
    parts.push(renderIcon(s.icon, labelStartX, labelStartY - m(3), iconSize, color));
    parts.push(`<text x="${labelStartX + m(5.5)}" y="${labelStartY}" font-size="${m(2.8)}" fill="#6b7280" letter-spacing="0.8">${esc(s.label)}</text>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(11)}" font-size="${m(6.5)}" font-weight="700" fill="${color}" text-anchor="middle">${esc(s.value)}</text>`);
    parts.push(`<text x="${x + sumCellW / 2}" y="${y + m(15.5)}" font-size="${m(2.6)}" fill="#9ca3af" text-anchor="middle">${esc(s.sub)}</text>`);
  });
  y += sumH + layout.gaps[2];

  // ═════════════════════════════════════════════════════════════
  // SECTION 9: ATTENDANCE + GRADING KEY (side by side)
  // ═════════════════════════════════════════════════════════════
  const compGap = m(3);
  const compW = (innerW - compGap) / 2;
  const compTopY = y;

  const attX = M;
  const attIconY = compTopY;
  parts.push(renderIcon(ICON.calendar, attX, attIconY - m(3.2), m(3.6), color));
  parts.push(`<text x="${attX + m(4.8)}" y="${attIconY}" font-size="${m(3.6)}" font-weight="700" fill="${color}" letter-spacing="1.2">ATTENDANCE SUMMARY</text>`);
  const attBoxY = attIconY + m(4.5);
  const attRowH = m(5.5);
  const attBoxH = attRowH * 4 + m(2.5);
  parts.push(`<rect x="${attX}" y="${attBoxY}" width="${compW}" height="${attBoxH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);
  const attItems: { lbl: string; val: string; color: string }[] = [
    { lbl: 'Total School Days:', val: String(input.attendance.totalDays), color: '#111827' },
    { lbl: 'Days Present:', val: String(input.attendance.presentDays), color: '#047857' },
    { lbl: 'Days Absent:', val: String(input.attendance.absentDays), color: '#dc2626' },
    { lbl: 'Attendance %:', val: `${input.attendance.percentage}%`, color: color },
  ];
  attItems.forEach((item, i) => {
    const ry = attBoxY + m(1.2) + i * attRowH;
    if (i > 0) {
      parts.push(`<line x1="${attX + m(1.5)}" y1="${ry}" x2="${attX + compW - m(1.5)}" y2="${ry}" stroke="${i === 3 ? '#9ca3af' : '#e5e7eb'}" stroke-width="${i === 3 ? 0.5 : 0.3}"/>`);
    }
    parts.push(`<text x="${attX + m(2.5)}" y="${ry + attRowH / 2 + m(1.2)}" font-size="${m(3)}" fill="#6b7280">${esc(item.lbl)}</text>`);
    parts.push(`<text x="${attX + compW - m(2.5)}" y="${ry + attRowH / 2 + m(1.2)}" font-size="${m(3.4)}" font-weight="700" fill="${item.color}" text-anchor="end">${esc(item.val)}</text>`);
  });

  const gkX = M + compW + compGap;
  parts.push(renderIcon(ICON.star, gkX, attIconY - m(3.2), m(3.6), color));
  parts.push(`<text x="${gkX + m(4.8)}" y="${attIconY}" font-size="${m(3.6)}" font-weight="700" fill="${color}" letter-spacing="1.2">GRADING KEY</text>`);
  const gkPad = m(2.2);
  const gkGridGap = m(1.3);
  const gkColW = (compW - gkPad * 2 - gkGridGap) / 2;
  const gkRowH = (attBoxH - gkPad * 2 - gkGridGap * 2) / 3;
  parts.push(`<rect x="${gkX}" y="${attBoxY}" width="${compW}" height="${attBoxH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);
  const gradeCells: { grade: string; range: string; remark: string; bg: string; fg: string }[] = [
    { grade: 'A', range: '70 - 100', remark: 'Excellent', bg: '#d1fae5', fg: '#065f46' },
    { grade: 'B', range: '60 - 69', remark: 'Very Good', bg: '#dbeafe', fg: '#1e40af' },
    { grade: 'C', range: '50 - 59', remark: 'Good', bg: '#fef3c7', fg: '#92400e' },
    { grade: 'D', range: '40 - 49', remark: 'Fair', bg: '#ffedd5', fg: '#9a3412' },
    { grade: 'E', range: '30 - 39', remark: 'Poor', bg: '#fee2e2', fg: '#991b1b' },
    { grade: 'F', range: '0 - 29', remark: 'Fail', bg: '#fecaca', fg: '#7f1d1d' },
  ];
  gradeCells.forEach((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cgx = gkX + gkPad + col * (gkColW + gkGridGap);
    const cgy = attBoxY + gkPad + row * (gkRowH + gkGridGap);
    parts.push(`<rect x="${cgx}" y="${cgy}" width="${gkColW}" height="${gkRowH}" rx="${m(0.8)}" fill="${g.bg}"/>`);
    parts.push(`<text x="${cgx + m(2)}" y="${cgy + gkRowH / 2 + m(1.6)}" font-size="${m(4)}" font-weight="700" fill="${g.fg}">${g.grade}</text>`);
    parts.push(`<text x="${cgx + m(8.5)}" y="${cgy + gkRowH / 2 - m(0.4)}" font-size="${m(2.6)}" font-weight="600" fill="${g.fg}">${g.range}</text>`);
    parts.push(`<text x="${cgx + m(8.5)}" y="${cgy + gkRowH / 2 + m(2.4)}" font-size="${m(2.4)}" fill="${g.fg}" fill-opacity="0.85">${g.remark}</text>`);
  });

  y = compTopY + m(4.5) + attBoxH + layout.gaps[3];

  // ═════════════════════════════════════════════════════════════
  // SECTION 11: Remarks (teacher + principal)
  // ═════════════════════════════════════════════════════════════
  parts.push(renderIcon(ICON.user, M, y - m(3.2), m(3.6), color));
  parts.push(`<text x="${M + m(4.8)}" y="${y}" font-size="${m(3.6)}" font-weight="700" fill="${color}" letter-spacing="1.2">REMARKS &amp; SIGNATURES</text>`);
  parts.push(`<line x1="${M + m(54)}" y1="${y - m(1.2)}" x2="${W - M}" y2="${y - m(1.2)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.3"/>`);
  y += m(3.6) + m(1.8);

  const remGap = m(3);
  const remW = (innerW - remGap) / 2;
  const remH = layout.remH;

  const teacherComment = input.teacherComment || input.domainGrade?.classTeacherComment || 'No comment yet.';
  const teacherName2 = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Class Teacher';
  const principalComment = input.domainGrade?.principalComment || 'No comment yet.';
  const principalName2 = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';

  // Estimate chars per line for remark text wrapping
  const remarkFontSize = m(3);
  const remarkAvailWidth = remW - m(5);
  const estimatedCharWidth = remarkFontSize * 0.62;
  const maxCharsPerLine = Math.max(20, Math.floor(remarkAvailWidth / estimatedCharWidth));
  const maxTextLines = 3;
  const remTextStartY = y + m(8);

  const renderWrappedText = (text: string, startX: number) => {
    const lines = wrapSvgText(esc(text), maxCharsPerLine).slice(0, maxTextLines);
    lines.forEach((line, li) => {
      parts.push(`<text x="${startX}" y="${remTextStartY + li * remarkFontSize * LINE_HEIGHT}" font-size="${remarkFontSize}" font-style="italic" fill="#374151">${line}</text>`);
    });
  };

  const rem1X = M;
  parts.push(`<rect x="${rem1X}" y="${y}" width="${remW}" height="${remH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);
  parts.push(`<text x="${rem1X + m(2.5)}" y="${y + m(4)}" font-size="${m(3.2)}" font-weight="700" fill="${color}" letter-spacing="0.6">TEACHER&apos;S REMARKS</text>`);
  renderWrappedText(teacherComment, rem1X + m(2.5));
  parts.push(`<line x1="${rem1X + m(2.5)}" y1="${y + remH - m(6)}" x2="${rem1X + remW - m(2.5)}" y2="${y + remH - m(6)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>`);
  parts.push(`<text x="${rem1X + m(2.5) + (remW - m(5)) / 2}" y="${y + remH - m(3.5)}" font-size="${m(2.8)}" font-weight="600" fill="#374151" text-anchor="middle">${esc(teacherName2)}</text>`);
  parts.push(`<text x="${rem1X + m(2.5) + (remW - m(5)) / 2}" y="${y + remH - m(1.5)}" font-size="${m(2.4)}" fill="#9ca3af" text-anchor="middle">Class Teacher</text>`);

  const rem2X = M + remW + remGap;
  parts.push(`<rect x="${rem2X}" y="${y}" width="${remW}" height="${remH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);
  parts.push(`<text x="${rem2X + m(2.5)}" y="${y + m(4)}" font-size="${m(3.2)}" font-weight="700" fill="${color}" letter-spacing="0.6">PRINCIPAL&apos;S REMARKS</text>`);
  renderWrappedText(principalComment, rem2X + m(2.5));
  parts.push(`<line x1="${rem2X + m(2.5)}" y1="${y + remH - m(6)}" x2="${rem2X + remW - m(2.5)}" y2="${y + remH - m(6)}" stroke="#9ca3af" stroke-dasharray="2,2" stroke-width="0.5"/>`);
  parts.push(`<text x="${rem2X + m(2.5) + (remW - m(5)) / 2}" y="${y + remH - m(3.5)}" font-size="${m(2.8)}" font-weight="600" fill="#374151" text-anchor="middle">${esc(principalName2)}</text>`);
  parts.push(`<text x="${rem2X + m(2.5) + (remW - m(5)) / 2}" y="${y + remH - m(1.5)}" font-size="${m(2.4)}" fill="#9ca3af" text-anchor="middle">Principal</text>`);

  y += remH + layout.gaps[4];

  // ═════════════════════════════════════════════════════════════
  // SECTION 12: Domain Grading (3rd term only) — with Average row + rating badges
  // Uses a smaller, adaptive layout that does not overflow the page
  // ═════════════════════════════════════════════════════════════
  if (layout.includeDomain && input.isThirdTerm && input.domainGrade) {
    const dg = input.domainGrade;
    parts.push(renderIcon(ICON.star, M, y - m(3), m(3.4), color));
    parts.push(`<text x="${M + m(4.5)}" y="${y}" font-size="${m(3.4)}" font-weight="700" fill="${color}" letter-spacing="1.2">AFFECTIVE, PSYCHOMOTOR &amp; COGNITIVE DOMAIN GRADING</text>`);
    parts.push(`<line x1="${M + m(95)}" y1="${y - m(1.2)}" x2="${W - M}" y2="${y - m(1.2)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.3"/>`);
    y += m(3.4) + m(1.2);

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

    // Compute available space; if not enough, fall back to 1.4mm row height
    const availableTotal = Math.max(0, maxContentY - y);
    const maxRows = Math.max(...domains.map(d => d.keys.length));
    const domPad = m(1.5);
    const domGap = m(1.5);
    const domColW = (innerW - domPad * 2 - domGap * 2) / 3;
    const domTitleH = m(3.2);
    const overhead = domPad * 2 + domTitleH + m(2);

    // 4-tier adaptive row height that always fits
    let domRowH: number;
    let labelFs: number;
    let badgeH: number;
    let badgeFs: number;
    if (availableTotal >= overhead + maxRows * m(2.9)) {
      domRowH = m(2.9); labelFs = m(2.4); badgeH = m(2.5); badgeFs = m(2.0);
    } else if (availableTotal >= overhead + maxRows * m(2.4)) {
      domRowH = m(2.4); labelFs = m(2.2); badgeH = m(2.3); badgeFs = m(1.9);
    } else if (availableTotal >= overhead + maxRows * m(2.0)) {
      domRowH = m(2.0); labelFs = m(2.0); badgeH = m(2.0); badgeFs = m(1.8);
    } else {
      domRowH = m(1.6); labelFs = m(1.9); badgeH = m(1.8); badgeFs = m(1.7);
    }

    const domOuterH = overhead + maxRows * domRowH;

    parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${domOuterH}" rx="${m(1.5)}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.7"/>`);

    domains.forEach((dom, di) => {
      const dx = M + domPad + di * (domColW + domGap);
      parts.push(`<rect x="${dx}" y="${y + domPad}" width="${domColW}" height="${domTitleH}" fill="${color}15"/>`);
      parts.push(`<text x="${dx + domColW / 2}" y="${y + domPad + domTitleH - m(0.8)}" font-size="${m(2.2)}" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="0.8">${dom.title}</text>`);
      let lastY = y + domPad + domTitleH;
      dom.keys.forEach((k) => {
        const v = dom.data[k];
        const yPos = lastY + domRowH * 0.7;
        parts.push(`<text x="${dx + m(1.2)}" y="${yPos}" font-size="${labelFs}" fill="#374151">${esc(labelMap[k] || k)}</text>`);
        if (v) {
          const rc = ratingColor(v);
          const badgeText = `${ratingLabel(v)} (${v})`;
          const badgeW = Math.max(m(16), badgeText.length * m(1.3));
          parts.push(`<rect x="${dx + domColW - badgeW - m(1)}" y="${yPos - badgeH + m(0.4)}" width="${badgeW}" height="${badgeH}" rx="${m(0.4)}" fill="${rc.bg}"/>`);
          parts.push(`<text x="${dx + domColW - badgeW - m(1) + badgeW / 2}" y="${yPos - m(0.3)}" font-size="${badgeFs}" font-weight="600" fill="${rc.fg}" text-anchor="middle">${esc(badgeText)}</text>`);
        } else {
          parts.push(`<text x="${dx + domColW - m(1)}" y="${yPos}" font-size="${labelFs}" fill="#d1d5db" text-anchor="end">—</text>`);
        }
        lastY += domRowH;
      });
      const avgY = y + domOuterH - domPad - m(0.5);
      const avgVal = dom.data.average;
      parts.push(`<line x1="${dx + m(1)}" y1="${avgY - m(2)}" x2="${dx + domColW - m(1)}" y2="${avgY - m(2)}" stroke="${color}" stroke-width="0.4" stroke-opacity="0.4"/>`);
      parts.push(`<text x="${dx + m(1.2)}" y="${avgY}" font-size="${m(2.1)}" font-weight="700" fill="${color}">AVERAGE</text>`);
      if (avgVal) {
        const rc = ratingColor(avgVal);
        const badgeText = `${ratingLabel(avgVal)} (${avgVal})`;
        const badgeW = Math.max(m(14), badgeText.length * m(1.3));
        parts.push(`<rect x="${dx + domColW - badgeW - m(1)}" y="${avgY - badgeH + m(0.4)}" width="${badgeW}" height="${badgeH}" rx="${m(0.4)}" fill="${rc.bg}"/>`);
        parts.push(`<text x="${dx + domColW - badgeW - m(1) + badgeW / 2}" y="${avgY - m(0.3)}" font-size="${badgeFs}" font-weight="700" fill="${rc.fg}" text-anchor="middle">${esc(badgeText)}</text>`);
      } else {
        parts.push(`<text x="${dx + domColW - m(1)}" y="${avgY}" font-size="${labelFs}" fill="#d1d5db" text-anchor="end">—</text>`);
      }
    });

    y += domOuterH + m(2);
  }

  // ═════════════════════════════════════════════════════════════
  // SECTION 13: Footer (Next Term + Printed)
  // ═════════════════════════════════════════════════════════════
  const footerY = H - taglineReserveH - m(3);
  const nextTerm = input.settings?.nextTermBegins
    ? (() => {
        try { return new Date(input.settings!.nextTermBegins!).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch { return ''; }
      })()
    : '';
  const printDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  parts.push(`<line x1="${M}" y1="${footerY - m(2.5)}" x2="${W - M}" y2="${footerY - m(2.5)}" stroke="#d1d5db" stroke-width="0.5"/>`);
  if (nextTerm) {
    parts.push(`<text x="${M}" y="${footerY}" font-size="${m(2.8)}" fill="#374151">Next Term Begins: <tspan font-weight="700" fill="${color}">${esc(nextTerm)}</tspan></text>`);
  }
  parts.push(`<text x="${W - M}" y="${footerY}" font-size="${m(2.6)}" fill="#9ca3af" text-anchor="end">Printed: ${esc(printDate)}</text>`);

  // ═════════════════════════════════════════════════════════════
  // SECTION 14: Tagline (extreme footer — does not affect layout)
  // ═════════════════════════════════════════════════════════════
  parts.push(`<text x="${ctrX}" y="${H - m(2)}" font-size="${m(2.2)}" fill="#9ca3af" text-anchor="middle" letter-spacing="3">SKOOLAR · SCHOOL MANAGEMENT</text>`);

  // Note: defs for clip-path are placed inline right next to the image.
  const defsBlock = defs.length > 0 ? `<defs>${defs.join('')}</defs>` : '';
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${ctx.style}
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    ${defsBlock}
    ${parts.join('\n')}
  </svg>`;

  return { svg };
}

export async function renderReportCardPdf(input: ReportCardPdfInput): Promise<Buffer> {
  await ensureResvgInit();

  const ctx = buildCtx(input);
  const m = (mm: number) => Math.round((mm / 25.4) * 96);

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

  // ────────────────────────────────────────────────────────────
  // LAYOUT SELECTION
  //   1st/2nd term (no domain grading) → "short" layout: even-gap
  //   distribution that fills the A4 page evenly.
  //   3rd term (with domain grading) → "full" layout: existing
  //   tight gaps (the domain block already fills the page).
  // ────────────────────────────────────────────────────────────
  const layout = input.isThirdTerm
    ? buildFullLayoutOptions(m)
    : buildShortLayoutOptions(enrichedCtx, {
        // Measured against the same conventions the SVG builder uses
        // internally. The "short" layout fills the A4 page by
        // distributing any slack as inter-section gaps (capped so the
        // page never overflows). When the measured value is off, the
        // gap is just slightly smaller or larger than ideal.
        headerH: m(28),
        pillH: m(7.5),
        infoH: m(9) * 3 + m(3),
        tableH: estimateTableHeight(m, input),
        sumH: m(18),
        attH: m(5.5) * 4 + m(2.5),
        baseRemH: m(22),
      });

  const { svg } = buildReportCardSvg(enrichedCtx, layout);

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

/**
 * Best-effort estimator for the score table height used by the
 * short-layout distribution math. This is intentionally conservative
 * (slightly over-estimates when in doubt) so the gap distribution
 * never overflows the page.
 */
function estimateTableHeight(
  m: (mm: number) => number,
  input: ReportCardPdfInput
): number {
  const N = input.subjectResults.length;
  let rowH: number;
  if (N >= 18) rowH = m(3.4);
  else if (N >= 15) rowH = m(3.8);
  else if (N >= 12) rowH = m(4.2);
  else rowH = m(5);
  const headerH = m(7);
  const totalRow = N > 0 ? rowH + m(0.4) : 0;
  return headerH + N * rowH + totalRow;
}
