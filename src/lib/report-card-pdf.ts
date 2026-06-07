import { Resvg } from '@resvg/resvg-wasm';
import { ensureResvgInit } from '@/lib/id-card-utils/init-resvg';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';

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
    photo?: ResolvedImage | null;
    photoBase64?: string | null;
    photoBuffer?: Buffer | null;
    classPosition?: string;
  };
  school: {
    name: string;
    logo?: ResolvedImage | null;
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

const MM = (mm: number): number => Math.round((mm / 25.4) * 96);
const PX = (pt: number): number => Math.round(pt * (96 / 72));

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

const ordinalSuffix = (n: number): string => {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
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

const adjustColor = (c: string, amount: number): string => {
  const hex = c.replace('#', '');
  const clamp = (x: number) => Math.max(0, Math.min(255, x));
  const r = clamp(parseInt(hex.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(hex.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(hex.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const gradeColor = (grade: string): string => {
  switch (grade) {
    case 'A+': return '#0b5e42';
    case 'A': return '#059669';
    case 'B': return '#3b82f6';
    case 'C': return '#f59e0b';
    case 'D': return '#ea580c';
    case 'E': return '#ef4444';
    case 'F': return '#991b1b';
    default: return '#6b7280';
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
    '1': 'Poor'
  };
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
  } catch {
    return '—';
  }
};

const toImageDataUri = (img: ResolvedImage | null | undefined): string | null => {
  if (!img || !img.buffer || img.buffer.length === 0) return null;
  const ct = (img.contentType || 'image/png').split(';')[0].trim();
  const safe = ct.startsWith('image/') ? ct : 'image/png';
  return `data:${safe};base64,${img.buffer.toString('base64')}`;
};

/** Resolve the best available image data URI — prefers pre-converted PNG. */
const resolveImageDataUri = (
  base64: string | null | undefined,
  resolved: ResolvedImage | null | undefined,
  rawBuffer: Buffer | null | undefined,
): string | null => {
  return base64 || toImageDataUri(resolved) || (rawBuffer ? `data:image/png;base64,${rawBuffer.toString('base64')}` : null) || null;
};

/** Detect if text contains Arabic characters */
const hasArabic = (text: string): boolean => /[\u0600-\u06FF]/.test(text);

interface Ctx {
  W: number;
  H: number;
  M: number;
  primaryColor: string;
  primaryDark: string;
  primaryLight: string;
  primaryExtraLight: string;
  primaryBg: string;
  accentColor: string;
  fontStack: string;
  style: string;
  input: ReportCardPdfInput;
}

const ICONS = {
  user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  hash: 'M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  academic: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5',
  award: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 4 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 4-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  trophy: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 4 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 4-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0',
  star: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  clipboard: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  location: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  phone: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
};

const renderIcon = (path: string, x: number, y: number, size: number, color: string): string =>
  `<g transform="translate(${x},${y}) scale(${(size / 24).toFixed(4)})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></g>`;

function buildCtx(input: ReportCardPdfInput): Ctx {
  const W = MM(210);
  const H = MM(297);
  const M = MM(10);
  const primaryColor = input.school.primaryColor || '#0f766e';
  const primaryDark = adjustColor(primaryColor, -30);
  const primaryLight = adjustColor(primaryColor, 40);
  const primaryExtraLight = adjustColor(primaryColor, 70);
  const primaryBg = adjustColor(primaryColor, 85);
  const accentColor = '#f59e0b';
  const fontStack = `'${GEIST_FONT_FAMILY}', 'Inter', 'Segoe UI', Arial, sans-serif`;
  const style = `<style>
    * { font-family: ${fontStack}; }
    text { font-family: ${fontStack}; }
  </style>`;
  return { W, H, M, primaryColor, primaryDark, primaryLight, primaryExtraLight, primaryBg, accentColor, fontStack, style, input };
}

function calculateDynamicLayout(ctx: Ctx): {
  gaps: number[];
  remH: number;
  tableRowH: number;
  includeDomain: boolean;
} {
  const m = (mm: number) => Math.round((mm / 25.4) * 96);
  const { H, input } = ctx;
  const N = input.subjectResults.length;
  const isThird = input.isThirdTerm;

  // Row height: more generous baseline, scales with subject count
  let tableRowH: number;
  if (N >= 20) tableRowH = m(3.8);
  else if (N >= 16) tableRowH = m(4.2);
  else if (N >= 13) tableRowH = m(4.6);
  else if (N >= 10) tableRowH = m(5.0);
  else tableRowH = m(5.6);

  const headerH = m(8);
  const tableH = headerH + N * tableRowH + (N > 0 ? tableRowH + m(1) : 0);

  const topBarH = m(3);
  const headerSectionH = m(26);
  const termPillH = m(8);
  const studentInfoH = m(40);
  const summaryCardsH = m(22);
  const attendanceKeyH = m(28);
  const footerH = m(14);

  // Term-aware layout
  let remarksH: number;
  let domainH: number;
  let gapSizes: { min: number; base: number };

  if (isThird) {
    remarksH = m(22);
    domainH = m(34);
    gapSizes = { min: m(1.5), base: m(2) };
  } else {
    remarksH = m(32);
    domainH = 0;
    gapSizes = { min: m(2.5), base: m(4) };
  }

  const totalFixedH = topBarH + headerSectionH + termPillH + studentInfoH + summaryCardsH + attendanceKeyH + remarksH + footerH + domainH;
  const availableForGaps = H - totalFixedH - tableH;

  const gapCount = isThird ? 6 : 5;
  const minGap = gapSizes.min;
  const maxGap = isThird ? m(3) : m(6);

  let gapSize = minGap;
  if (availableForGaps > 0) {
    gapSize = Math.min(maxGap, minGap + (availableForGaps / gapCount));
  }

  const gaps = Array(gapCount).fill(Math.round(gapSize));
  const remH = isThird ? m(22) : m(32);

  return { gaps, remH, tableRowH, includeDomain: isThird };
}

function buildReportCardSvg(ctx: Ctx): { svg: string } {
  const { W, H, M, primaryColor, primaryDark, primaryLight, primaryExtraLight, primaryBg, accentColor, input } = ctx;
  const m = (mm: number) => Math.round((mm / 25.4) * 96);
  const ctrX = W / 2;
  const innerW = W - 2 * M;

  const layout = calculateDynamicLayout(ctx);
  const { gaps, remH, tableRowH, includeDomain } = layout;

  const parts: string[] = [];
  const defs: string[] = [];
  let y = 0;

  // ===== BACKGROUND =====
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);

  // Decorative top gradient bar
  parts.push(`<defs>
    <linearGradient id="topGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="${primaryLight}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="${primaryColor}"/>
    </linearGradient>
  </defs>`);

  // Top accent bar
  parts.push(`<rect x="0" y="0" width="${W}" height="${m(4)}" fill="url(#topGrad)"/>`);
  y = m(4) + m(2);

  // ===== HEADER SECTION =====
  const headerTopY = y;
  const logoSize = m(22);
  const logoCenterY = headerTopY + logoSize / 2;
  const logoX = M;

  // Logo container with subtle shadow effect
  parts.push(`<circle cx="${logoX + logoSize / 2}" cy="${logoCenterY}" r="${logoSize / 2 + m(1.5)}" fill="#ffffff" stroke="${primaryLight}" stroke-width="1.5" stroke-opacity="0.3"/>`);
  parts.push(`<circle cx="${logoX + logoSize / 2}" cy="${logoCenterY}" r="${logoSize / 2}" fill="#f8fafc" stroke="${primaryLight}" stroke-width="0.8"/>`);

  const logoDataUri = resolveImageDataUri(input.school.logoBase64, input.school.logo, input.school.logoBuffer);

  if (logoDataUri) {
    parts.push(`<image href="${logoDataUri}" x="${logoX + m(1)}" y="${headerTopY + m(1)}" width="${logoSize - m(2)}" height="${logoSize - m(2)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#logoClip)"/>`);
    defs.push(`<clipPath id="logoClip"><circle cx="${logoX + logoSize / 2}" cy="${logoCenterY}" r="${logoSize / 2 - m(1)}"/></clipPath>`);
  } else {
    const initial = esc((input.school.name || 'S').charAt(0).toUpperCase());
    parts.push(`<text x="${logoX + logoSize / 2}" y="${logoCenterY + m(5)}" font-size="${m(12)}" font-weight="800" fill="${primaryColor}" text-anchor="middle">${initial}</text>`);
  }

  // School name and details - with word wrapping
  const textStartX = logoX + logoSize + m(6);
  const textMaxW = W - textStartX - M;

  let textY = headerTopY + m(1);
  const schoolName = esc(input.school.name || '');
  const schoolNameLines = wrapSvgText(schoolName.toUpperCase(), 50);
  const nameLineH = m(7);
  schoolNameLines.slice(0, 2).forEach((line, li) => {
    parts.push(`<text x="${textStartX}" y="${textY + nameLineH + li * nameLineH}" font-size="${m(7)}" font-weight="800" fill="#1e293b" letter-spacing="1.2">${line}</text>`);
  });
  textY += nameLineH * Math.min(schoolNameLines.length, 2) + m(1);

  if (input.school.motto || input.settings?.schoolMotto) {
    const mottoText = input.school.motto || input.settings?.schoolMotto;
    parts.push(`<text x="${textStartX}" y="${textY + m(4)}" font-size="${m(3.2)}" font-style="italic" fill="${primaryColor}" font-weight="500">— ${trunc(esc(mottoText), 60)} —</text>`);
    textY += m(4) + m(1);
  }

  if (input.school.address) {
    parts.push(renderIcon(ICONS.location, textStartX, textY + m(2), m(3.2), '#94a3b8'));
    parts.push(`<text x="${textStartX + m(5)}" y="${textY + m(5)}" font-size="${m(2.8)}" fill="#64748b">${trunc(esc(input.school.address), 70)}</text>`);
    textY += m(5) + m(1);
  }

  const contacts: string[] = [];
  if (input.school.phone) contacts.push(`${input.school.phone}`);
  if (input.school.email) contacts.push(`${input.school.email}`);
  if (contacts.length > 0) {
    parts.push(`<text x="${textStartX}" y="${textY + m(4)}" font-size="${m(2.6)}" fill="#94a3b8">${trunc(esc(contacts.join(' | ')), 75)}</text>`);
    textY += m(4);
  }

  y = Math.max(headerTopY + logoSize + m(2), textY + m(2)) + m(2);

  // ===== TERM PILL =====
  const academicSession = esc(input.settings?.academicSession || input.term.academicYear || '—');
  const pillH = m(8);
  const pillW = m(140);
  const pillX = ctrX - pillW / 2;

  parts.push(`<rect x="${pillX}" y="${y}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="url(#accentGrad)"/>`);
  parts.push(`<rect x="${pillX + m(1)}" y="${y + m(1)}" width="${pillW - m(2)}" height="${pillH - m(2)}" rx="${(pillH - m(2)) / 2}" fill="none" stroke="#ffffff" stroke-width="0.8" stroke-opacity="0.3"/>`);

  const termAbbr = esc(termLabel(input.term.name));
  parts.push(`<text x="${ctrX}" y="${y + pillH / 2 + m(1.8)}" font-size="${m(4.2)}" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="3">${academicSession} — ${termAbbr} TERM REPORT</text>`);
  y += pillH + gaps[0];

  // ===== STUDENT INFORMATION CARD =====
  const infoCardY = y;
  const photoSize = m(26);
  const photoReservedW = photoSize + m(6);
  const gridW = innerW - photoReservedW;
  const colW = gridW / 2;
  const infoFieldH = m(7.5);
  const infoRows = 4;
  const infoCardH = infoRows * infoFieldH + m(10);

  // Card with subtle shadow
  parts.push(`<rect x="${M}" y="${infoCardY}" width="${innerW}" height="${infoCardH}" rx="${m(3)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>`);
  parts.push(`<rect x="${M}" y="${infoCardY}" width="${innerW}" height="${m(6)}" rx="${m(3)}" fill="${primaryColor}" fill-opacity="0.05"/>`);
  parts.push(`<rect x="${M}" y="${infoCardY + m(4)}" width="${innerW}" height="${m(2)}" fill="${primaryColor}" fill-opacity="0.05"/>`);

  // Section title
  parts.push(renderIcon(ICONS.user, M + m(3), infoCardY + m(3), m(3.8), primaryColor));
  parts.push(`<text x="${M + m(9)}" y="${infoCardY + m(7)}" font-size="${m(3.6)}" font-weight="700" fill="${primaryColor}" letter-spacing="1.5">STUDENT INFORMATION</text>`);

  const infoFields: [string, string, string][] = [
    [ICONS.user, 'Student Name', input.student.name || '—'],
    [ICONS.academic, 'Admission No', input.student.admissionNo || '—'],
    [ICONS.calendar, 'Date of Birth', fmtDate(input.student.dateOfBirth)],
    [ICONS.users, 'Gender / Blood', `${input.student.gender || '—'} ${input.student.bloodGroup ? `/ ${input.student.bloodGroup}` : ''}`],
    [ICONS.academic, 'Class', `${input.cls.name || '—'}${input.cls.section ? ` (${input.cls.section})` : ''}`],
    [ICONS.trophy, 'Class Position', input.totals.classRank ? `${input.totals.classRank}${ordinalSuffix(input.totals.classRank)} of ${input.totals.totalStudents || '—'}` : '—'],
    [ICONS.calendar, 'Term Period', `${fmtDate(input.term.startDate)} — ${fmtDate(input.term.endDate)}`],
    [ICONS.users, 'Class Size', `${input.totals.totalStudents || '—'} Students`],
  ];

  infoFields.forEach(([iconPath, label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fieldX = M + m(3) + col * colW;
    const fieldY = infoCardY + m(10) + row * infoFieldH;

    parts.push(renderIcon(iconPath, fieldX, fieldY - m(2), m(3.2), '#94a3b8'));
    parts.push(`<text x="${fieldX + m(5)}" y="${fieldY}" font-size="${m(2.4)}" fill="#94a3b8" letter-spacing="0.5">${esc(label)}</text>`);
    parts.push(`<text x="${fieldX + m(5)}" y="${fieldY + m(4.5)}" font-size="${m(3.2)}" font-weight="600" fill="#1e293b">${trunc(esc(value), 28)}</text>`);
  });

  // Student Photo
  const photoX = M + innerW - photoSize - m(2);
  const photoY = infoCardY + (infoCardH - photoSize) / 2;
  const photoCx = photoX + photoSize / 2;
  const photoCy = photoY + photoSize / 2;
  const photoR = photoSize / 2;

  // Photo frame with decorative double-ring
  parts.push(`<circle cx="${photoCx}" cy="${photoCy}" r="${photoR + m(2)}" fill="${primaryExtraLight}" stroke="${primaryColor}" stroke-width="1.5"/>`);
  parts.push(`<circle cx="${photoCx}" cy="${photoCy}" r="${photoR + m(1)}" fill="#ffffff"/>`);

  const photoDataUri = resolveImageDataUri(input.student.photoBase64, input.student.photo, input.student.photoBuffer);

  if (photoDataUri) {
    defs.push(`<clipPath id="photoClip"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR - m(0.5)}"/></clipPath>`);
    parts.push(`<image href="${photoDataUri}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>`);
  } else {
    parts.push(`<circle cx="${photoCx}" cy="${photoCy}" r="${photoR - m(1)}" fill="${primaryBg}"/>`);
    const initial = esc((input.student.name || 'ST').split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase());
    parts.push(`<text x="${photoCx}" y="${photoCy + m(5)}" font-size="${m(12)}" font-weight="700" fill="${primaryColor}" text-anchor="middle">${initial}</text>`);
  }

  y = infoCardY + infoCardH + gaps[1];

  // ===== SUBJECT RESULTS TABLE =====
  const tableX = M;
  const tableW = innerW;
  const hasDynamicCols = input.scoreTypes.length > 0;
  const scoreTypeCols = hasDynamicCols ? input.scoreTypes : [];
  const numScoreCols = scoreTypeCols.length;

  // Column widths — consistent proportions
  const snW = m(8);
  const subjectW = m(40);
  const totalW = m(13);
  const gradeW = m(12);
  const remarkW = m(26);
  const dynamicW = numScoreCols > 0
    ? Math.min(m(16), Math.max(m(10), (tableW - snW - subjectW - totalW - gradeW - remarkW) / numScoreCols))
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

  const headerH = m(9);
  const N = input.subjectResults.length;

  // Table header with gradient — higher contrast
  parts.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${headerH}" rx="${m(2)}" fill="${primaryDark}"/>`);
  parts.push(`<rect x="${tableX}" y="${y + headerH - m(2)}" width="${tableW}" height="${m(2)}" rx="${m(1)}" fill="${adjustColor(primaryDark, -20)}" fill-opacity="0.5"/>`);

  const cellText = (x: number, w: number, txt: string, align = 'center', weight = '700'): string =>
    `<text x="${x + w / 2}" y="${y + headerH / 2 + m(1.5)}" font-size="${m(3.2)}" font-weight="${weight}" fill="#ffffff" text-anchor="${align}">${txt}</text>`;

  // Header cells
  parts.push(cellText(colXs[0], snW, '#', 'center'));
  parts.push(`<text x="${colXs[1] + m(4)}" y="${y + headerH / 2 + m(1.5)}" font-size="${m(3.2)}" font-weight="700" fill="#ffffff">SUBJECT</text>`);

  scoreTypeCols.forEach((st, i) => {
    const stName = trunc(esc(st.name), 6);
    parts.push(`<text x="${colXs[2 + i] + dynamicW / 2}" y="${y + headerH / 2 - m(0.5)}" font-size="${m(2.6)}" font-weight="600" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">${stName}</text>`);
    parts.push(`<text x="${colXs[2 + i] + dynamicW / 2}" y="${y + headerH / 2 + m(3)}" font-size="${m(2.2)}" font-weight="500" fill="#ffffff" fill-opacity="0.7" text-anchor="middle">(${st.weight}%)</text>`);
  });

  const totalHeaderIdx = hasDynamicCols ? 2 + numScoreCols : 4;
  if (hasDynamicCols) {
    parts.push(cellText(colXs[totalHeaderIdx], totalW, 'TOTAL', 'center'));
  } else {
    const caW = colXs[3] - colXs[2];
    const examW = colXs[4] - colXs[3];
    parts.push(cellText(colXs[2], caW, 'CA (40%)', 'center'));
    parts.push(cellText(colXs[3], examW, 'EXAM (60%)', 'center'));
    parts.push(cellText(colXs[4], totalW, 'TOTAL', 'center'));
  }

  const grXIdx = hasDynamicCols ? totalHeaderIdx + 1 : 5;
  parts.push(cellText(colXs[grXIdx], gradeW, 'GRADE', 'center'));
  parts.push(`<text x="${remarkColX + remarkColW / 2}" y="${y + headerH / 2 + m(1.5)}" font-size="${m(3.2)}" font-weight="700" fill="#ffffff" text-anchor="middle">REMARK</text>`);

  // Table body
  let rowIdx = 0;
  const cellFont = tableRowH >= m(5) ? m(3.2) : (tableRowH >= m(4.5) ? m(3) : m(2.8));

  for (const sr of input.subjectResults) {
    const rowY = y + headerH + rowIdx * tableRowH;
    const isEven = rowIdx % 2 === 0;
    const bgColor = isEven ? '#ffffff' : '#f8fafc';

    parts.push(`<rect x="${tableX}" y="${rowY}" width="${tableW}" height="${tableRowH}" fill="${bgColor}"/>`);
    parts.push(`<line x1="${tableX}" y1="${rowY}" x2="${tableX + tableW}" y2="${rowY}" stroke="#e2e8f0" stroke-width="0.5"/>`);

    const textYCenter = rowY + tableRowH / 2 + m(1.3);

    // Serial number
    parts.push(`<text x="${colXs[0] + snW / 2}" y="${textYCenter}" font-size="${m(2.8)}" fill="#64748b" text-anchor="middle">${rowIdx + 1}</text>`);

    // Subject name — right-align if Arabic
    const subjectText = esc(sr.subjectName);
    const isArabic = hasArabic(sr.subjectName);
    if (isArabic) {
      parts.push(`<text x="${colXs[1] + subjectW - m(4)}" y="${textYCenter}" font-size="${cellFont}" font-weight="500" fill="#1e293b" text-anchor="end" direction="rtl" unicode-bidi="bidi-override">${subjectText}</text>`);
    } else {
      parts.push(`<text x="${colXs[1] + m(4)}" y="${textYCenter}" font-size="${cellFont}" font-weight="500" fill="#1e293b">${trunc(subjectText, 24)}</text>`);
    }

    if (hasDynamicCols) {
      scoreTypeCols.forEach((st, i) => {
        const v = sr.scoresByType?.[st.id];
        const display = v && v.max > 0 ? String(Math.round(v.normalized)) : '—';
        parts.push(`<text x="${colXs[2 + i] + dynamicW / 2}" y="${textYCenter}" font-size="${m(3)}" fill="#475569" text-anchor="middle">${display}</text>`);
      });
      parts.push(`<text x="${colXs[totalHeaderIdx] + totalW / 2}" y="${textYCenter}" font-size="${cellFont}" font-weight="700" fill="#1e293b" text-anchor="middle">${Math.round(sr.total)}</text>`);
    } else {
      const caW = colXs[3] - colXs[2];
      const examW = colXs[4] - colXs[3];
      parts.push(`<text x="${colXs[2] + caW / 2}" y="${textYCenter}" font-size="${m(3)}" fill="#475569" text-anchor="middle">${Math.round(sr.caScore || 0)}</text>`);
      parts.push(`<text x="${colXs[3] + examW / 2}" y="${textYCenter}" font-size="${m(3)}" fill="#475569" text-anchor="middle">${Math.round(sr.examScore || 0)}</text>`);
      parts.push(`<text x="${colXs[4] + totalW / 2}" y="${textYCenter}" font-size="${cellFont}" font-weight="700" fill="#1e293b" text-anchor="middle">${Math.round(sr.total)}</text>`);
    }

    // Grade with colored background
    const gradeTxt = esc(sr.grade);
    const gradeCol = gradeColor(sr.grade);
    const gradeX = colXs[grXIdx];
    const gradeWid = gradeW;
    const gradeBgOpacity = 0.15;
    parts.push(`<rect x="${gradeX + m(1)}" y="${rowY + m(1.5)}" width="${gradeWid - m(2)}" height="${tableRowH - m(3)}" rx="${m(1.5)}" fill="${gradeCol}" fill-opacity="${gradeBgOpacity}"/>`);
    parts.push(`<text x="${gradeX + gradeWid / 2}" y="${textYCenter}" font-size="${m(3.2)}" font-weight="700" fill="${gradeCol}" text-anchor="middle">${gradeTxt}</text>`);

    // Remark
    parts.push(`<text x="${remarkColX + m(4)}" y="${textYCenter}" font-size="${m(3)}" fill="#64748b">${trunc(esc(sr.remark), 20)}</text>`);

    rowIdx++;
  }

  // Total row
  if (input.subjectResults.length > 0) {
    const totalRowY = y + headerH + rowIdx * tableRowH;
    parts.push(`<rect x="${tableX}" y="${totalRowY}" width="${tableW}" height="${tableRowH + m(1)}" fill="${primaryColor}" fill-opacity="0.12"/>`);
    parts.push(`<rect x="${tableX}" y="${totalRowY}" width="${tableW}" height="${tableRowH + m(1)}" fill="${primaryDark}" fill-opacity="0.08"/>`);
    parts.push(`<line x1="${tableX}" y1="${totalRowY + (tableRowH + m(1))}" x2="${tableX + tableW}" y2="${totalRowY + (tableRowH + m(1))}" stroke="${primaryDark}" stroke-width="1.5"/>`);

    const totalSubjects = input.subjectResults.length;
    const totalTextY = totalRowY + (tableRowH + m(1)) / 2 + m(1.3);

    const labelEndIdx = hasDynamicCols ? totalHeaderIdx : 4;
    parts.push(`<text x="${colXs[labelEndIdx] - m(2)}" y="${totalTextY}" font-size="${m(3.5)}" font-weight="800" fill="${primaryDark}" text-anchor="end">TOTAL / ${totalSubjects * 100}</text>`);

    const totalScoreIdx = hasDynamicCols ? totalHeaderIdx : 4;
    parts.push(`<text x="${colXs[totalScoreIdx] + totalW / 2}" y="${totalTextY}" font-size="${m(4)}" font-weight="800" fill="${primaryDark}" text-anchor="middle">${Math.round(input.totals.grandTotal)}</text>`);

    const totalGradeIdx = hasDynamicCols ? totalHeaderIdx + 1 : 5;
    const overallGrade = esc(input.totals.overallGrade);
    parts.push(`<rect x="${colXs[totalGradeIdx] + m(1)}" y="${totalRowY + m(2)}" width="${gradeW - m(2)}" height="${tableRowH + m(1) - m(4)}" rx="${m(1.5)}" fill="${primaryColor}" fill-opacity="0.2"/>`);
    parts.push(`<text x="${colXs[totalGradeIdx] + gradeW / 2}" y="${totalTextY}" font-size="${m(4)}" font-weight="800" fill="${primaryDark}" text-anchor="middle">${overallGrade}</text>`);

    parts.push(`<text x="${remarkColX + m(4)}" y="${totalTextY}" font-size="${m(3.2)}" font-weight="700" fill="${primaryDark}">${trunc(esc(input.totals.overallRemark), 20)}</text>`);

    rowIdx++;
  }

  const tableTotalH = headerH + rowIdx * tableRowH + (rowIdx > 0 ? m(1) : 0);
  parts.push(`<line x1="${tableX}" y1="${y + tableTotalH}" x2="${tableX + tableW}" y2="${y + tableTotalH}" stroke="${primaryDark}" stroke-width="1.5"/>`);
  parts.push(`<rect x="${tableX}" y="${y + tableTotalH - m(1)}" width="${tableW}" height="${m(1)}" fill="${primaryColor}" fill-opacity="0.15"/>`);

  y += tableTotalH + gaps[2];

  // ===== SUMMARY CARDS =====
  const cardsH = m(24);
  const cardGap = m(3);
  const cardW = (innerW - 3 * cardGap) / 4;
  const totalSubjects = input.subjectResults.length;
  const maxPossible = totalSubjects * 100;
  const avg = input.totals.averageScore;

  // Icons beside title+value layout
  const summaryCards = [
    { icon: ICONS.clipboard, label: 'TOTAL SCORE', value: String(Math.round(input.totals.grandTotal)), sub: `out of ${maxPossible}`, color: primaryColor },
    { icon: ICONS.chart, label: 'AVERAGE', value: `${avg.toFixed(1)}%`, sub: `${totalSubjects} subjects`, color: '#3b82f6' },
    { icon: ICONS.award, label: 'GRADE', value: input.totals.overallGrade, sub: input.totals.overallRemark, color: accentColor },
    { icon: ICONS.trophy, label: 'POSITION', value: String(input.totals.classRank || '—'), sub: `out of ${input.totals.totalStudents || '—'}`, color: '#8b5cf6' },
  ];

  summaryCards.forEach((card, i) => {
    const cardX = M + i * (cardW + cardGap);
    const cardColor = card.color;

    parts.push(`<rect x="${cardX}" y="${y}" width="${cardW}" height="${cardsH}" rx="${m(3)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>`);
    parts.push(`<rect x="${cardX}" y="${y}" width="${cardW}" height="${m(4)}" rx="${m(3)}" fill="${cardColor}" fill-opacity="0.1"/>`);
    parts.push(`<rect x="${cardX + m(1)}" y="${y + m(3)}" width="${cardW - m(2)}" height="${m(1)}" fill="${cardColor}" fill-opacity="0.2"/>`);

    // Icon on the left, title and value stacked beside it
    const iconSize = m(5);
    const iconX = cardX + m(3);
    const iconY = y + m(6);
    parts.push(renderIcon(card.icon, iconX, iconY, iconSize, cardColor));

    const textLeftX = iconX + iconSize + m(2);
    const textAvailW = cardW - (textLeftX - cardX) - m(2);

    parts.push(`<text x="${textLeftX}" y="${y + m(8)}" font-size="${m(2.4)}" font-weight="700" fill="#64748b" letter-spacing="0.5">${esc(card.label)}</text>`);
    parts.push(`<text x="${textLeftX}" y="${y + m(14)}" font-size="${m(6)}" font-weight="800" fill="${cardColor}">${esc(card.value)}</text>`);
    parts.push(`<text x="${cardX + cardW / 2}" y="${y + m(20)}" font-size="${m(2.4)}" fill="#94a3b8" text-anchor="middle">${esc(card.sub)}</text>`);
  });

  y += cardsH + gaps[3];

  // ===== ATTENDANCE & GRADING KEY =====
  const attKeyH = m(28);
  const leftW = (innerW - m(4)) * 0.45;
  const rightW = (innerW - m(4)) * 0.55;

  // Attendance Section
  const attX = M;
  parts.push(`<rect x="${attX}" y="${y}" width="${leftW}" height="${attKeyH}" rx="${m(3)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>`);
  parts.push(`<rect x="${attX}" y="${y}" width="${leftW}" height="${m(5)}" rx="${m(3)}" fill="${primaryColor}" fill-opacity="0.08"/>`);

  parts.push(renderIcon(ICONS.calendar, attX + m(3), y + m(3.5), m(3.5), primaryColor));
  parts.push(`<text x="${attX + m(10)}" y="${y + m(7)}" font-size="${m(3.2)}" font-weight="700" fill="${primaryColor}" letter-spacing="1">ATTENDANCE</text>`);

  const attItems = [
    { label: 'Total School Days', value: String(input.attendance.totalDays), color: '#475569' },
    { label: 'Days Present', value: String(input.attendance.presentDays), color: '#059669' },
    { label: 'Days Absent', value: String(input.attendance.absentDays), color: '#ef4444' },
    { label: 'Attendance Rate', value: `${input.attendance.percentage}%`, color: primaryColor, prominent: true },
  ];

  attItems.forEach((item, i) => {
    const itemY = y + m(12) + i * m(5.5);
    if (i > 0) {
      parts.push(`<line x1="${attX + m(3)}" y1="${itemY - m(2)}" x2="${attX + leftW - m(3)}" y2="${itemY - m(2)}" stroke="#f1f5f9" stroke-width="0.5"/>`);
    }
    parts.push(`<text x="${attX + m(3)}" y="${itemY + m(2)}" font-size="${m(3)}" fill="#64748b">${item.label}</text>`);
    const valFont = item.prominent ? m(5) : m(4);
    const valWeight = item.prominent ? '800' : '700';
    parts.push(`<text x="${attX + leftW - m(3)}" y="${itemY + m(2)}" font-size="${valFont}" font-weight="${valWeight}" fill="${item.color}" text-anchor="end">${item.value}</text>`);
  });

  // Grading Key Section
  const gkX = attX + leftW + m(4);
  parts.push(`<rect x="${gkX}" y="${y}" width="${rightW}" height="${attKeyH}" rx="${m(3)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>`);
  parts.push(`<rect x="${gkX}" y="${y}" width="${rightW}" height="${m(5)}" rx="${m(3)}" fill="${accentColor}" fill-opacity="0.08"/>`);

  parts.push(renderIcon(ICONS.star, gkX + m(3), y + m(3.5), m(3.5), accentColor));
  parts.push(`<text x="${gkX + m(10)}" y="${y + m(7)}" font-size="${m(3.2)}" font-weight="700" fill="${accentColor}" letter-spacing="1">GRADING SCALE</text>`);

  const gradeCells = [
    { grade: 'A', range: '70-100', remark: 'Excellent', bg: '#d1fae5', fg: '#065f46' },
    { grade: 'B', range: '60-69', remark: 'Very Good', bg: '#dbeafe', fg: '#1e40af' },
    { grade: 'C', range: '50-59', remark: 'Good', bg: '#fef3c7', fg: '#92400e' },
    { grade: 'D', range: '40-49', remark: 'Fair', bg: '#ffedd5', fg: '#9a3412' },
    { grade: 'E', range: '30-39', remark: 'Poor', bg: '#fee2e2', fg: '#991b1b' },
    { grade: 'F', range: '0-29', remark: 'Fail', bg: '#fecaca', fg: '#7f1d1d' },
  ];

  const gridCols = 3;
  const gridCellW = (rightW - m(6)) / gridCols;
  const gridCellH = m(7);
  const gridStartX = gkX + m(3);
  const gridStartY = y + m(11);

  gradeCells.forEach((cell, idx) => {
    const col = idx % gridCols;
    const row = Math.floor(idx / gridCols);
    const cellX = gridStartX + col * gridCellW;
    const cellY = gridStartY + row * (gridCellH + m(1));

    parts.push(`<rect x="${cellX}" y="${cellY}" width="${gridCellW - m(1)}" height="${gridCellH}" rx="${m(2)}" fill="${cell.bg}"/>`);
    parts.push(`<text x="${cellX + m(3)}" y="${cellY + gridCellH / 2 + m(1.5)}" font-size="${m(3.8)}" font-weight="800" fill="${cell.fg}">${cell.grade}</text>`);
    parts.push(`<text x="${cellX + m(8)}" y="${cellY + m(3.5)}" font-size="${m(2.2)}" font-weight="600" fill="${cell.fg}">${cell.range}</text>`);
    parts.push(`<text x="${cellX + m(8)}" y="${cellY + m(5.8)}" font-size="${m(2)}" fill="${cell.fg}" fill-opacity="0.8">${cell.remark}</text>`);
  });

  y += attKeyH + gaps[4];

  // ===== REMARKS SECTION =====
  const remarksH = remH;
  const remGap = m(4);
  const remW = (innerW - remGap) / 2;

  const teacherComment = input.teacherComment || input.domainGrade?.classTeacherComment || 'Outstanding performance this term. Keep up the great work!';
  const teacherName2 = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Class Teacher';
  const principalComment = input.domainGrade?.principalComment || 'Excellent progress shown. Continue to strive for excellence.';
  const principalName2 = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';

  const remarkFontSize = m(3);
  const remarkAvailWidth = remW - m(8);
  const estimatedCharWidth = remarkFontSize * 0.6;
  const maxCharsPerLine = Math.max(25, Math.floor(remarkAvailWidth / estimatedCharWidth));
  const maxTextLines = 4;

  const renderWrappedText = (text: string, startX: number, startY: number) => {
    const lines = wrapSvgText(esc(text), maxCharsPerLine).slice(0, maxTextLines);
    lines.forEach((line, li) => {
      parts.push(`<text x="${startX}" y="${startY + li * remarkFontSize * LINE_HEIGHT}" font-size="${remarkFontSize}" font-style="italic" fill="#475569">${line}</text>`);
    });
    return lines.length;
  };

  // Teacher's Remarks Card
  const rem1X = M;
  parts.push(`<rect x="${rem1X}" y="${y}" width="${remW}" height="${remarksH}" rx="${m(3)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>`);
  parts.push(`<rect x="${rem1X}" y="${y}" width="${remW}" height="${m(6)}" rx="${m(3)}" fill="${primaryColor}" fill-opacity="0.08"/>`);
  parts.push(`<rect x="${rem1X}" y="${y + m(4)}" width="${remW}" height="${m(2)}" fill="${primaryColor}" fill-opacity="0.12"/>`);

  parts.push(renderIcon(ICONS.user, rem1X + m(3), y + m(3.5), m(3.5), primaryColor));
  parts.push(`<text x="${rem1X + m(10)}" y="${y + m(7)}" font-size="${m(3.2)}" font-weight="700" fill="${primaryColor}">TEACHER'S ASSESSMENT</text>`);

  renderWrappedText(teacherComment, rem1X + m(4), y + m(13));
  const teacherSigY = y + remarksH - m(10);

  parts.push(`<line x1="${rem1X + m(4)}" y1="${teacherSigY}" x2="${rem1X + remW - m(4)}" y2="${teacherSigY}" stroke="#cbd5e1" stroke-dasharray="4,3" stroke-width="0.8"/>`);
  parts.push(`<text x="${rem1X + remW / 2}" y="${teacherSigY + m(5)}" font-size="${m(3)}" font-weight="700" fill="#1e293b" text-anchor="middle">${esc(teacherName2)}</text>`);
  parts.push(`<text x="${rem1X + remW / 2}" y="${teacherSigY + m(8.5)}" font-size="${m(2.4)}" fill="#94a3b8" text-anchor="middle">Class Teacher</text>`);

  // Principal's Remarks Card
  const rem2X = M + remW + remGap;
  parts.push(`<rect x="${rem2X}" y="${y}" width="${remW}" height="${remarksH}" rx="${m(3)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>`);
  parts.push(`<rect x="${rem2X}" y="${y}" width="${remW}" height="${m(6)}" rx="${m(3)}" fill="${accentColor}" fill-opacity="0.08"/>`);
  parts.push(`<rect x="${rem2X}" y="${y + m(4)}" width="${remW}" height="${m(2)}" fill="${accentColor}" fill-opacity="0.12"/>`);

  parts.push(renderIcon(ICONS.award, rem2X + m(3), y + m(3.5), m(3.5), accentColor));
  parts.push(`<text x="${rem2X + m(10)}" y="${y + m(7)}" font-size="${m(3.2)}" font-weight="700" fill="${accentColor}">PRINCIPAL'S REMARKS</text>`);

  renderWrappedText(principalComment, rem2X + m(4), y + m(13));

  parts.push(`<line x1="${rem2X + m(4)}" y1="${teacherSigY}" x2="${rem2X + remW - m(4)}" y2="${teacherSigY}" stroke="#cbd5e1" stroke-dasharray="4,3" stroke-width="0.8"/>`);
  parts.push(`<text x="${rem2X + remW / 2}" y="${teacherSigY + m(5)}" font-size="${m(3)}" font-weight="700" fill="#1e293b" text-anchor="middle">${esc(principalName2)}</text>`);
  parts.push(`<text x="${rem2X + remW / 2}" y="${teacherSigY + m(8.5)}" font-size="${m(2.4)}" fill="#94a3b8" text-anchor="middle">Principal</text>`);

  y += remarksH + (includeDomain ? gaps[5] : 0);

  // ===== DOMAIN GRADING (3rd Term Only) =====
  if (includeDomain && input.domainGrade) {
    const dg = input.domainGrade;
    const domainH = H - y - m(16);

    parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${domainH}" rx="${m(3)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>`);
    parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${m(6)}" rx="${m(3)}" fill="${primaryColor}" fill-opacity="0.06"/>`);

    parts.push(renderIcon(ICONS.star, M + m(3), y + m(3.5), m(3.5), primaryColor));
    parts.push(`<text x="${M + m(10)}" y="${y + m(7)}" font-size="${m(3.4)}" font-weight="700" fill="${primaryColor}" letter-spacing="1.5">AFFECTIVE, PSYCHOMOTOR &amp; COGNITIVE DOMAIN</text>`);

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

    const domInnerH = domainH - m(12);
    const domPad = m(2);
    const domGap = m(2);
    const domColW = (innerW - domPad * 2 - domGap * 2) / 3;
    const domTitleH = m(4);
    const overhead = domPad * 2 + domTitleH;
    const maxRows = Math.max(...domains.map(d => d.keys.length));
    const domRowH = (domInnerH - overhead) / maxRows;
    const labelFs = Math.min(m(2.6), domRowH * 0.6);
    const badgeH = Math.min(m(3), domRowH * 0.8);
    const badgeFs = Math.min(m(2.2), domRowH * 0.5);

    domains.forEach((dom, di) => {
      const dx = M + domPad + di * (domColW + domGap);
      const domY = y + m(10);

      parts.push(`<rect x="${dx}" y="${domY}" width="${domColW}" height="${domInnerH}" rx="${m(2)}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5"/>`);
      parts.push(`<rect x="${dx}" y="${domY}" width="${domColW}" height="${domTitleH}" rx="${m(2)}" fill="${primaryColor}" fill-opacity="0.08"/>`);
      parts.push(`<text x="${dx + domColW / 2}" y="${domY + domTitleH - m(1.2)}" font-size="${m(2.6)}" font-weight="800" fill="${primaryColor}" text-anchor="middle" letter-spacing="1">${dom.title}</text>`);

      let lastY = domY + domTitleH + m(1);
      dom.keys.forEach((k) => {
        const v = dom.data[k];
        const yPos = lastY + domRowH * 0.65;

        parts.push(`<text x="${dx + m(3)}" y="${yPos}" font-size="${labelFs}" font-weight="500" fill="#475569">${esc(labelMap[k] || k)}</text>`);

        if (v) {
          const rc = ratingColor(v);
          const badgeText = `${ratingLabel(v)} (${v})`;
          const badgeW = Math.max(m(10), badgeText.length * m(1.1));
          const badgeX = dx + domColW - badgeW - m(2);
          parts.push(`<rect x="${badgeX}" y="${yPos - badgeH + m(0.5)}" width="${badgeW}" height="${badgeH}" rx="${m(1)}" fill="${rc.bg}"/>`);
          parts.push(`<text x="${badgeX + badgeW / 2}" y="${yPos - m(0.2)}" font-size="${badgeFs}" font-weight="600" fill="${rc.fg}" text-anchor="middle">${esc(badgeText)}</text>`);
        } else {
          parts.push(`<text x="${dx + domColW - m(3)}" y="${yPos}" font-size="${labelFs}" fill="#cbd5e1" text-anchor="end">—</text>`);
        }
        lastY += domRowH;
      });
    });

    y += domainH + m(4);
  }

  // ===== FOOTER (dynamic position — hugs last section) =====
  const footerTopY = y + m(2);
  const footerBottomY = H - m(4);

  parts.push(`<line x1="${M}" y1="${footerTopY}" x2="${W - M}" y2="${footerTopY}" stroke="#e2e8f0" stroke-width="0.8"/>`);

  const nextTerm = input.settings?.nextTermBegins
    ? (() => {
        try { return new Date(input.settings!.nextTermBegins!).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch { return ''; }
      })()
    : '';

  const printDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  const footerTextY = footerTopY + m(4);
  if (nextTerm) {
    parts.push(`<text x="${M}" y="${footerTextY}" font-size="${m(2.8)}" fill="#475569">Next Term Begins: <tspan font-weight="700" fill="${primaryColor}">${esc(nextTerm)}</tspan></text>`);
  }
  parts.push(`<text x="${W - M}" y="${footerTextY}" font-size="${m(2.5)}" fill="#94a3b8" text-anchor="end">Generated: ${esc(printDate)}</text>`);

  // Powered by
  parts.push(`<text x="${ctrX}" y="${footerBottomY}" font-size="${m(2.2)}" fill="#cbd5e1" text-anchor="middle" letter-spacing="3">SKOOLAR · ACADEMIC MANAGEMENT SYSTEM</text>`);

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
    // Arabic font not available
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

  const { svg } = buildReportCardSvg(enrichedCtx);

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
