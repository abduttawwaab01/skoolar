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
    parents?: string | null;
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
  attendance: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    onLeave?: number;
    percentage: number;
  };
  domainGrade: ReportCardDomainGrade | null;
  totals: {
    grandTotal: number;
    totalObtainable: number;
    averageScore: number;
    overallGrade: string;
    overallRemark: string;
    classPosition: number | null;
    classPositionText?: string;
    totalStudents: number;
  };
  teacherComment?: string | null;
  principalComment?: string | null;
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
  const gradeMap: Record<string, string> = {
    'A1': '#0b5e42', 'A': '#059669', 'A+': '#059669',
    'B2': '#059669', 'B': '#3b82f6', 'B3': '#3b82f6',
    'C4': '#f59e0b', 'C': '#f59e0b', 'C5': '#ea580c', 'C6': '#d97706',
    'D7': '#ef4444', 'D': '#ef4444',
    'E8': '#dc2626', 'E': '#dc2626',
    'F9': '#991b1b', 'F': '#991b1b'
  };
  return gradeMap[grade] || '#6b7280';
};

const termLabel = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('first') || lower.includes('1st')) return 'First';
  if (lower.includes('second') || lower.includes('2nd')) return 'Second';
  if (lower.includes('third') || lower.includes('3rd')) return 'Third';
  return name;
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
  if (!d) return 'N/A';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'N/A';
  }
};

const toImageDataUri = (img: ResolvedImage | null | undefined): string | null => {
  if (!img || !img.buffer || img.buffer.length === 0) return null;
  const ct = (img.contentType || 'image/png').split(';')[0].trim();
  const safe = ct.startsWith('image/') ? ct : 'image/png';
  return `data:${safe};base64,${img.buffer.toString('base64')}`;
};

const resolveImageDataUri = (
  base64: string | null | undefined,
  resolved: ResolvedImage | null | undefined,
  rawBuffer: Buffer | null | undefined,
): string | null => {
  return base64 || toImageDataUri(resolved) || (rawBuffer ? `data:image/png;base64,${rawBuffer.toString('base64')}` : null) || null;
};

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
  academic: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342',
  award: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  trophy: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172',
  star: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  clipboard: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  location: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  phone: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
};

const renderIcon = (path: string, x: number, y: number, size: number, color: string): string =>
  `<g transform="translate(${x},${y}) scale(${(size / 24).toFixed(4)})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></g>`;

function buildCtx(input: ReportCardPdfInput): Ctx {
  const W = MM(210);
  const H = MM(297);
  const M = MM(8);
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

function buildReportCardSvg(ctx: Ctx): { svg: string } {
  const { W, H, M, primaryColor, primaryDark, primaryLight, primaryBg, accentColor, input } = ctx;
  const m = (mm: number) => Math.round((mm / 25.4) * 96);
  const ctrX = W / 2;
  const innerW = W - 2 * M;

  const parts: string[] = [];
  const defs: string[] = [];
  let y = M;

  // Background with subtle gradient for depth
  parts.push(`<defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  parts.push(`<rect width="${W}" height="${H}" fill="url(#bgGrad)"/>`);

  // Gradients for accents
  parts.push(`<defs>
    <linearGradient id="topGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="${primaryLight}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="${primaryColor}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.1"/>
    </filter>
  </defs>`);

  // Top accent bar with enhanced shadow
  parts.push(`<rect x="0" y="0" width="${W}" height="${m(3)}" fill="url(#topGrad)" filter="url(#shadow)"/>`);

  // ===== HEADER =====
  const logoSize = m(18);
  const logoX = M;
  const logoY = m(5);
  const logoCenterY = logoY + logoSize / 2;

  // Enhanced logo container with shadow
  parts.push(`<circle cx="${logoX + logoSize / 2}" cy="${logoCenterY}" r="${logoSize / 2 + m(1)}" fill="#ffffff" stroke="${primaryLight}" stroke-width="1" filter="url(#shadow)"/>`);
  parts.push(`<circle cx="${logoX + logoSize / 2}" cy="${logoCenterY}" r="${logoSize / 2}" fill="#f8fafc" stroke="${primaryLight}" stroke-width="0.5"/>`);

  const logoDataUri = resolveImageDataUri(input.school.logoBase64, input.school.logo, input.school.logoBuffer);

  if (logoDataUri) {
    defs.push(`<clipPath id="logoClip"><circle cx="${logoX + logoSize / 2}" cy="${logoCenterY}" r="${logoSize / 2 - m(1)}"/></clipPath>`);
    parts.push(`<image href="${logoDataUri}" x="${logoX + m(1)}" y="${logoY + m(1)}" width="${logoSize - m(2)}" height="${logoSize - m(2)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#logoClip)" filter="url(#shadow)"/>`);
  } else {
    const initial = esc((input.school.name || 'S').charAt(0).toUpperCase());
    parts.push(`<text x="${logoX + logoSize / 2}" y="${logoCenterY + m(4)}" font-size="${m(9)}" font-weight="800" fill="${primaryColor}" text-anchor="middle" filter="url(#shadow)">${initial}</text>`);
  }

  const textBlockCenterX = logoX + logoSize + m(5) + (W - (logoX + logoSize + m(5)) - M) / 2;
  let headerY = m(5);

  const schoolNameLines = wrapSvgText(esc(input.school.name || ''), 50);
  schoolNameLines.forEach((line, i) => {
    parts.push(`<text x="${textBlockCenterX}" y="${headerY + m(5) + i * m(6.5)}" font-size="${m(5.5)}" font-weight="800" fill="#1e293b" text-anchor="middle" letter-spacing="0.8" opacity="0.9">${line}</text>`);
  });
  headerY += m(9) + (schoolNameLines.length - 1) * m(6.5);

  if (input.school.motto || input.settings?.schoolMotto) {
    const mottoText = input.school.motto || input.settings?.schoolMotto;
    const mottoLines = wrapSvgText(esc(mottoText || ''), 70);
    mottoLines.forEach((line, i) => {
      parts.push(`<text x="${textBlockCenterX}" y="${headerY + m(3.5) + i * m(3.5)}" font-size="${m(2.4)}" font-style="italic" fill="${primaryColor}" text-anchor="middle" opacity="0.8">${line}</text>`);
    });
    headerY += m(4.5) + (mottoLines.length - 1) * m(3.5);
  }

  if (input.school.address) {
    const addressLines = wrapSvgText(esc(input.school.address), 70);
    addressLines.forEach((line, i) => {
      parts.push(`<text x="${textBlockCenterX}" y="${headerY + m(3.5) + i * m(3.5)}" font-size="${m(2.2)}" fill="#64748b" text-anchor="middle" opacity="0.8">${line}</text>`);
    });
    headerY += m(4) + (addressLines.length - 1) * m(3.5);
  }

  const contacts: string[] = [];
  if (input.school.phone) contacts.push(`Tel: ${input.school.phone}`);
  if (input.school.email) contacts.push(`Email: ${input.school.email}`);
  if (contacts.length > 0) {
    const contactsText = esc(contacts.join(' | '));
    const contactLines = wrapSvgText(contactsText, 75);
    contactLines.forEach((line, i) => {
      parts.push(`<text x="${textBlockCenterX}" y="${headerY + m(3.5) + i * m(3.5)}" font-size="${m(2)}" fill="#94a3b8" text-anchor="middle" opacity="0.7">${line}</text>`);
    });
    headerY += m(4) + (contactLines.length - 1) * m(3.5);
  }

  // Report Title
  const termText = `${termLabel(input.term.name)} Term Student's Report`;
  parts.push(`<text x="${ctrX}" y="${m(34)}" font-size="${m(4.2)}" font-weight="700" fill="${primaryColor}" text-anchor="middle" letter-spacing="0.8">${termText}</text>`);

  // ===== STUDENT INFO SECTION =====
  y = m(38);
  const infoCardH = m(26);
  const photoSize = m(24);

  parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${infoCardH}" rx="${m(2)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>`);
  parts.push(`<rect x="${M}" y="${y}" width="${innerW}" height="${m(4.5)}" rx="${m(2)}" fill="${primaryColor}" fill-opacity="0.06"/>`);

  const leftColW = (innerW - photoSize - m(8)) * 0.55;
  const rightColW = (innerW - photoSize - m(8)) * 0.45;
  const rowH = m(5);
  const startY = y + m(8);

  const infoItemsLeft: [string, string, number][] = [
    ['Name:', input.student.name || '—', m(11)],
    ['Class:', `${input.cls.name || '—'}${input.cls.section ? ` (${input.cls.section})` : ''}`, m(11)],
    ['Gender:', input.student.gender || 'N/A', m(13)],
    ['Admission No:', input.student.admissionNo || '—', m(18)],
  ];

  const infoItemsRight: [string, string, number][] = [
    ['Session:', input.settings?.academicSession || input.term.academicYear || '—', m(13)],
    ['Term:', termLabel(input.term.name), m(10)],
    ['D.O.B:', fmtDate(input.student.dateOfBirth), m(10)],
    ['Parent(s):', input.student.parents || '—', m(13)],
  ];

  infoItemsLeft.forEach(([label, value, valX], i) => {
    const itemY = startY + i * rowH;
    parts.push(`<text x="${M + m(3)}" y="${itemY}" font-size="${m(2.4)}" font-weight="600" fill="#64748b">${label}</text>`);
    parts.push(`<text x="${M + valX}" y="${itemY}" font-size="${m(2.5)}" font-weight="500" fill="#1e293b">${esc(value)}</text>`);
  });

  infoItemsRight.forEach(([label, value, valX], i) => {
    const itemY = startY + i * rowH;
    const xPos = M + leftColW + m(5);
    parts.push(`<text x="${xPos}" y="${itemY}" font-size="${m(2.4)}" font-weight="600" fill="#64748b">${label}</text>`);
    parts.push(`<text x="${xPos + valX}" y="${itemY}" font-size="${m(2.5)}" font-weight="500" fill="#1e293b">${esc(value)}</text>`);
  });

  // Student Photo
  const photoX = M + innerW - photoSize - m(3);
  const photoY = y + (infoCardH - photoSize) / 2;
  const photoCx = photoX + photoSize / 2;
  const photoCy = photoY + photoSize / 2;
  const photoR = photoSize / 2;

  parts.push(`<circle cx="${photoCx}" cy="${photoCy}" r="${photoR + m(1.5)}" fill="${primaryBg}" stroke="${primaryColor}" stroke-width="1"/>`);
  parts.push(`<circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="#ffffff"/>`);

  const photoDataUri = resolveImageDataUri(input.student.photoBase64, input.student.photo, input.student.photoBuffer);

  if (photoDataUri) {
    defs.push(`<clipPath id="photoClip"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR - m(0.5)}"/></clipPath>`);
    parts.push(`<image href="${photoDataUri}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>`);
  } else {
    const initial = esc((input.student.name || 'ST').split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase());
    parts.push(`<text x="${photoCx}" y="${photoCy + m(4)}" font-size="${m(9)}" font-weight="700" fill="${primaryColor}" text-anchor="middle">${initial}</text>`);
  }

  y += infoCardH + m(3);

  // ===== SCORE TABLE =====
  const tableX = M;
  const tableW = innerW;
  const snW = m(8);
  const subjectW = m(36);
  const caW = m(18);
  const examW = m(18);
  const totalW = m(18);
  const gradeW = m(16);
  const remarkW = tableW - snW - subjectW - caW - examW - totalW - gradeW;

  const headerH = m(7);
  const rowH_table = m(5.5);
  const N = input.subjectResults.length;

  let cx = tableX;
  const colSn = cx; cx += snW;
  const colSubject = cx; cx += subjectW;
  const colCa = cx; cx += caW;
  const colExam = cx; cx += examW;
  const colTotal = cx; cx += totalW;
  const colGrade = cx; cx += gradeW;
  const colRemark = cx;

  // Enhanced table header with gradient
  parts.push(`<defs>
    <linearGradient id="tableHeaderGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${primaryDark}"/>
      <stop offset="100%" stop-color="${primaryColor}"/>
    </linearGradient>
  </defs>`);
  parts.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${headerH}" rx="${m(1)}" fill="url(#tableHeaderGrad)" filter="url(#shadow)"/>`);

  const headerText = (x: number, w: number, txt: string) =>
    `<text x="${x + w / 2}" y="${y + headerH / 2 + m(1.3)}" font-size="${m(2.5)}" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.95">${txt}</text>`;

  parts.push(headerText(colSn, snW, 'S/N'));
  parts.push(headerText(colSubject, subjectW, 'SUBJECT'));
  parts.push(headerText(colCa, caW, 'C.A.'));
  parts.push(headerText(colExam, examW, 'EXAM'));
  parts.push(headerText(colTotal, totalW, 'TOTAL'));
  parts.push(headerText(colGrade, gradeW, 'GRADE'));
  parts.push(headerText(colRemark, remarkW, 'REMARK'));

  let rowIdx = 0;
  for (const sr of input.subjectResults) {
    const rowY = y + headerH + rowIdx * rowH_table;
    const isEven = rowIdx % 2 === 0;
    const bgColor = isEven ? '#ffffff' : '#f8fafc';
    
    // Enhanced row background with subtle shadow on hover
    parts.push(`<rect x="${tableX}" y="${rowY}" width="${tableW}" height="${rowH_table}" fill="${bgColor}" rx="${m(0.5)}"/>`);
    parts.push(`<line x1="${tableX}" y1="${rowY}" x2="${tableX + tableW}" y2="${rowY}" stroke="#e2e8f0" stroke-width="0.5"/>`);

    const textYCenter = rowY + rowH_table / 2 + m(1);
    const cellFont = m(2.5);

    parts.push(`<text x="${colSn + snW / 2}" y="${textYCenter}" font-size="${m(2.3)}" fill="#64748b" text-anchor="middle" font-weight="500">${rowIdx + 1}</text>`);

    const subjectText = esc(sr.subjectName);
    const isArabic = hasArabic(sr.subjectName);
    if (isArabic) {
      parts.push(`<text x="${colSubject + subjectW - m(3)}" y="${textYCenter}" font-size="${cellFont}" font-weight="500" fill="#1e293b" text-anchor="end" direction="rtl">${subjectText}</text>`);
    } else {
      parts.push(`<text x="${colSubject + m(3)}" y="${textYCenter}" font-size="${cellFont}" font-weight="500" fill="#1e293b">${trunc(subjectText, 18)}</text>`);
    }

    parts.push(`<text x="${colCa + caW / 2}" y="${textYCenter}" font-size="${cellFont}" fill="#475569" text-anchor="middle">${Math.round(sr.caScore)}</text>`);
    parts.push(`<text x="${colExam + examW / 2}" y="${textYCenter}" font-size="${cellFont}" fill="#475569" text-anchor="middle">${Math.round(sr.examScore)}</text>`);
    parts.push(`<text x="${colTotal + totalW / 2}" y="${textYCenter}" font-size="${cellFont}" font-weight="700" fill="#1e293b" text-anchor="middle">${Math.round(sr.total)}</text>`);

    const gradeTxt = esc(sr.grade);
    const gradeCol = gradeColor(sr.grade);
    parts.push(`<rect x="${colGrade + m(1)}" y="${rowY + m(0.8)}" width="${gradeW - m(2)}" height="${rowH_table - m(1.6)}" rx="${m(1)}" fill="${gradeCol}" fill-opacity="0.15"/>`);
    parts.push(`<text x="${colGrade + gradeW / 2}" y="${textYCenter}" font-size="${m(2.7)}" font-weight="700" fill="${gradeCol}" text-anchor="middle">${gradeTxt}</text>`);

    const maxRemarkChars = Math.max(Math.floor((remarkW - m(4)) / (m(2.3) * 0.55)), 5);
    parts.push(`<text x="${colRemark + m(2)}" y="${textYCenter}" font-size="${m(2.3)}" fill="#64748b" font-weight="400">${trunc(esc(sr.remark), maxRemarkChars)}</text>`);

    rowIdx++;
  }

  parts.push(`<line x1="${tableX}" y1="${y + headerH + rowIdx * rowH_table}" x2="${tableX + tableW}" y2="${y + headerH + rowIdx * rowH_table}" stroke="${primaryDark}" stroke-width="1.5" stroke-opacity="0.8"/>`);
  y += headerH + rowIdx * rowH_table + m(4);

  // ===== PERFORMANCE SUMMARY & GRADE ANALYSIS =====
  const summaryH = m(42);
  const leftSummaryW = (innerW - m(4)) * 0.42;
  const rightSummaryW = (innerW - m(4)) * 0.58;

  // Performance Summary Card with enhanced styling
  parts.push(`<rect x="${M}" y="${y}" width="${leftSummaryW}" height="${summaryH}" rx="${m(2)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8" filter="url(#shadow)"/>`);
  parts.push(`<rect x="${M}" y="${y}" width="${leftSummaryW}" height="${m(4.5)}" rx="${m(2)}" fill="${primaryColor}" fill-opacity="0.08"/>`);
  parts.push(`<text x="${M + m(3)}" y="${y + m(6.5)}" font-size="${m(2.8)}" font-weight="700" fill="${primaryColor}">Performance Summary</text>`);

  const totalObtainable = input.totals.totalObtainable || input.subjectResults.length * 100;
  const summaryItems: [string, string, boolean][] = [
    ['Total Marks Obtained', `${Math.round(input.totals.grandTotal)}`, false],
    ['Total Marks Obtainable', `${totalObtainable}`, false],
    ['Average Score', `${input.totals.averageScore.toFixed(2)}%`, true],
    ['Grade', input.totals.overallGrade, true],
    ['Class Population', `${input.totals.totalStudents}`, false],
    ['Position', input.totals.classPositionText || (input.totals.classPosition ? `${input.totals.classPosition}${ordinalSuffix(input.totals.classPosition)}` : '—'), true],
  ];

  const summaryStartY = y + m(12);
  const summaryRowH = m(5);

  summaryItems.forEach(([label, value, isBold], i) => {
    const itemY = summaryStartY + i * summaryRowH;
    if (i > 0) {
      parts.push(`<line x1="${M + m(3)}" y1="${itemY - m(1.8)}" x2="${M + leftSummaryW - m(3)}" y2="${itemY - m(1.8)}" stroke="#f1f5f9" stroke-width="0.5"/>`);
    }
    parts.push(`<text x="${M + m(3)}" y="${itemY + m(1.5)}" font-size="${m(2.4)}" fill="#64748b">${label}</text>`);
    const valueColor = isBold ? primaryColor : '#1e293b';
    const valueWeight = isBold ? '800' : '600';
    parts.push(`<text x="${M + leftSummaryW - m(3)}" y="${itemY + m(1.5)}" font-size="${isBold ? m(3) : m(2.6)}" font-weight="${valueWeight}" fill="${valueColor}" text-anchor="end">${trunc(value, 20)}</text>`);
  });

  // Grade Analysis with enhanced styling
  const gradeAnalysisX = M + leftSummaryW + m(4);
  parts.push(`<rect x="${gradeAnalysisX}" y="${y}" width="${rightSummaryW}" height="${summaryH}" rx="${m(2)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8" filter="url(#shadow)"/>`);
  parts.push(`<rect x="${gradeAnalysisX}" y="${y}" width="${rightSummaryW}" height="${m(4.5)}" rx="${m(2)}" fill="${accentColor}" fill-opacity="0.08"/>`);
  parts.push(`<text x="${gradeAnalysisX + m(3)}" y="${y + m(6.5)}" font-size="${m(2.8)}" font-weight="700" fill="${accentColor}">Grade Analysis</text>`);

  const gradeDistribution: Record<string, number> = {};
  for (const sr of input.subjectResults) {
    gradeDistribution[sr.grade] = (gradeDistribution[sr.grade] || 0) + 1;
  }

  const gradeOrder = ['A1', 'A', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];
  const gradeColors: Record<string, string> = {
    'A1': '#0b5e42', 'A': '#059669',
    'B2': '#059669', 'B3': '#3b82f6',
    'C4': '#f59e0b', 'C5': '#ea580c', 'C6': '#d97706',
    'D7': '#ef4444',
    'E8': '#dc2626',
    'F9': '#991b1b'
  };

  const barStartX = gradeAnalysisX + m(4);
  const barMaxW = rightSummaryW - m(8);
  const barH = m(3);
  const barGap = m(2);
  const maxCount = Math.max(...Object.values(gradeDistribution), 1);

  const visibleGrades = gradeOrder.filter(g => gradeDistribution[g] > 0);
  visibleGrades.slice(0, 6).forEach((grade, i) => {
    const count = gradeDistribution[grade] || 0;
    const barW = count > 0 ? Math.max(m(2), (count / maxCount) * barMaxW) : 0;
    const barY = y + m(12) + i * (barH + barGap);
    const gradeCol = gradeColors[grade] || '#94a3b8';

    parts.push(`<text x="${barStartX}" y="${barY + barH - m(0.5)}" font-size="${m(2.3)}" font-weight="700" fill="${gradeCol}">${grade}</text>`);
    parts.push(`<rect x="${barStartX + m(6)}" y="${barY}" width="${Math.max(barW, m(1))}" height="${barH}" rx="${m(1)}" fill="${gradeCol}" fill-opacity="0.8"/>`);
    if (count > 0) {
      const countLabel = `${count}`;
      const countH = countLabel.length * m(1.3);
      const countMaxX = gradeAnalysisX + rightSummaryW - m(4);
      const countX = Math.min(barStartX + m(6) + barW + m(2), countMaxX - countH);
      parts.push(`<text x="${countX}" y="${barY + barH - m(0.3)}" font-size="${m(2.3)}" font-weight="600" fill="#475569">${countLabel}</text>`);
    }
  });

  y += summaryH + m(4);

  // ===== COGNITIVE, AFFECTIVE & PSYCHOMOTOR DOMAIN =====
  const domainH = m(38);
  const colGap = m(3);
  const colW = (innerW - 2 * colGap) / 3;

  const renderDomainCol = (cx: number, cw: number, title: string, items: string[], labels: Record<string, string>, keys: Record<string, string | null>) => {
    const colParts: string[] = [];
    colParts.push(`<rect x="${cx}" y="${y}" width="${cw}" height="${domainH}" rx="${m(2)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8" filter="url(#shadow)"/>`);
    colParts.push(`<rect x="${cx}" y="${y}" width="${cw}" height="${m(4.5)}" rx="${m(2)}" fill="${primaryColor}" fill-opacity="0.08"/>`);
    colParts.push(`<text x="${cx + cw / 2}" y="${y + m(6.5)}" font-size="${m(2.8)}" font-weight="700" fill="${primaryColor}" text-anchor="middle">${title}</text>`);
    let iy = y + m(10);
    for (const key of items) {
      const val = keys[key];
      const label = labels[key] || key;
      colParts.push(`<text x="${cx + m(4)}" y="${iy + m(1.5)}" font-size="${m(2.2)}" fill="#475569">${label}</text>`);
      if (val) {
        const rc = ratingColor(val);
        const badgeText = `${ratingLabel(val)} (${val})`;
        const badgeW = Math.min(m(12), badgeText.length * m(1.0));
        const badgeX = cx + cw - badgeW - m(3);
        colParts.push(`<rect x="${badgeX}" y="${iy}" width="${badgeW}" height="${m(3)}" rx="${m(1)}" fill="${rc.bg}" stroke="${rc.fg}" stroke-width="0.4"/>`);
        colParts.push(`<text x="${badgeX + badgeW / 2}" y="${iy + m(2.3)}" font-size="${m(2)}" font-weight="600" fill="${rc.fg}" text-anchor="middle">${badgeText}</text>`);
      } else {
        colParts.push(`<text x="${cx + cw - m(4)}" y="${iy + m(1.5)}" font-size="${m(2)}" fill="#cbd5e1" text-anchor="end">—</text>`);
      }
      iy += m(3.2);
    }
    // Key in last column
    if (title === 'Psychomotor Skill') {
      const ksY = iy + m(2);
      colParts.push(`<text x="${cx + m(4)}" y="${ksY}" font-size="${m(2.2)}" font-weight="600" fill="#1e293b">Key:</text>`);
      const keyRatings = [
        { val: '5', desc: 'Exc' }, { val: '4', desc: 'V.Gd' },
        { val: '3', desc: 'Gd' }, { val: '2', desc: 'Fair' }, { val: '1', desc: 'Poor' }
      ];
      keyRatings.forEach((r, ri) => {
        const rc = ratingColor(r.val);
        const kx = cx + m(4) + (ri % 2) * m(16);
        const ky = ksY + m(4.5) + Math.floor(ri / 2) * m(4);
        colParts.push(`<rect x="${kx}" y="${ky - m(1.5)}" width="${m(3.5)}" height="${m(2.5)}" rx="${m(0.5)}" fill="${rc.bg}" stroke="${rc.fg}" stroke-width="0.5"/>`);
        colParts.push(`<text x="${kx + m(4.5)}" y="${ky}" font-size="${m(2)}" fill="#475569">${r.val}=${r.desc}</text>`);
      });
    }
    return colParts.join('\n');
  };

  const cogKeys = input.domainGrade?.cognitive || {};
  const affectiveKeys = input.domainGrade?.affective || {};
  const psychomotorKeys = input.domainGrade?.psychomotor || {};

  const M2 = M;
  parts.push(renderDomainCol(M2, colW, 'Cognitive Domain',
    ['reasoning', 'memory', 'concentration', 'problemSolving', 'initiative'],
    { reasoning: 'Reasoning', memory: 'Memory', concentration: 'Concentration', problemSolving: 'Problem Solving', initiative: 'Initiative' },
    cogKeys
  ));

  const affX2 = M2 + colW + colGap;
  parts.push(renderDomainCol(affX2, colW, 'Affective Domain',
    ['punctuality', 'neatness', 'honesty', 'leadership', 'cooperation', 'attentiveness', 'obedience', 'selfControl', 'politeness'],
    { punctuality: 'Punctuality', neatness: 'Neatness', honesty: 'Honesty', leadership: 'Leadership', cooperation: 'Cooperation', attentiveness: 'Attentiveness', obedience: 'Obedience', selfControl: 'Self Control', politeness: 'Politeness' },
    affectiveKeys
  ));

  const psychoX2 = affX2 + colW + colGap;
  parts.push(renderDomainCol(psychoX2, colW, 'Psychomotor Skill',
    ['handwriting', 'sports', 'drawing', 'practical'],
    { handwriting: 'Handwriting', sports: 'Sports', drawing: 'Drawing', practical: 'Practical' },
    psychomotorKeys
  ));

  y += domainH + m(4);

  // ===== ATTENDANCE SUMMARY =====
  const attendanceH = m(14);
  const attendanceW = (innerW - m(4)) * 0.38;
  const attendanceX = M;

  parts.push(`<rect x="${attendanceX}" y="${y}" width="${attendanceW}" height="${attendanceH}" rx="${m(2)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8" filter="url(#shadow)"/>`);
  parts.push(`<rect x="${attendanceX}" y="${y}" width="${attendanceW}" height="${m(4)}" rx="${m(2)}" fill="${primaryColor}" fill-opacity="0.08"/>`);
  parts.push(`<text x="${attendanceX + attendanceW / 2}" y="${y + m(5.5)}" font-size="${m(2.6)}" font-weight="700" fill="${primaryColor}" text-anchor="middle">Attendance</text>`);

  const attendanceItems = [
    ['Days Recorded', `${input.attendance.totalDays}`],
    ['Present', `${input.attendance.presentDays}`],
    ['Absent', `${input.attendance.absentDays}`],
    ['Attendance Rate', `${input.attendance.percentage}%`],
  ];

  let attY = y + m(10);
  attendanceItems.forEach(([label, value]) => {
    parts.push(`<text x="${attendanceX + m(4)}" y="${attY}" font-size="${m(2.3)}" fill="#64748b">${label}</text>`);
    parts.push(`<text x="${attendanceX + attendanceW - m(4)}" y="${attY}" font-size="${m(2.5)}" font-weight="700" fill="${primaryColor}" text-anchor="end">${value}</text>`);
    attY += m(4.2);
  });

  // ===== TEACHER'S & PRINCIPAL'S REMARKS =====
  const remarksH = m(26);
  const remW = (innerW - m(4)) * 0.38; // Reduced from 0.48 to 0.38 to prevent overflow

  const teacherComment = input.teacherComment || input.domainGrade?.classTeacherComment || '—';
  const teacherName = input.domainGrade?.classTeacherName || input.cls.classTeacher || 'Form Master';
  const principalComment = input.principalComment || input.domainGrade?.principalComment || '—';
  const principalName = input.domainGrade?.principalName || input.settings?.principalName || 'Principal';

  const remX1 = attendanceX + attendanceW + m(4);
  const remX2 = remX1 + remW + m(4);

  // Form Master's Remark with enhanced styling
  parts.push(`<rect x="${remX1}" y="${y}" width="${remW}" height="${remarksH}" rx="${m(2)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8" filter="url(#shadow)"/>`);
  parts.push(`<rect x="${remX1}" y="${y}" width="${remW}" height="${m(4)}" rx="${m(2)}" fill="${primaryColor}" fill-opacity="0.08"/>`);
  parts.push(`<text x="${remX1 + remW / 2}" y="${y + m(5.5)}" font-size="${m(2.6)}" font-weight="700" fill="${primaryColor}" text-anchor="middle">Teacher's Remark</text>`);

  const maxCharsPerLine = Math.floor((remW - m(6)) / (m(2.4) * 0.55));
  const teacherLines = wrapSvgText(esc(teacherComment), Math.max(maxCharsPerLine, 20));
  const truncated = teacherLines.length > 3;
  const tLines = truncated ? teacherLines.slice(0, 3).map((l, i) => i === 2 ? l.replace(/\s+\S*$/, '') + '...' : l) : teacherLines;
  let remTextY = y + m(12);
  tLines.forEach((line) => {
    parts.push(`<text x="${remX1 + m(4)}" y="${remTextY}" font-size="${m(2.4)}" fill="#475569">${line}</text>`);
    remTextY += m(3.5);
  });

  const sigY = y + remarksH - m(10);
  parts.push(`<line x1="${remX1 + m(4)}" y1="${sigY}" x2="${remX1 + remW - m(4)}" y2="${sigY}" stroke="#cbd5e1" stroke-dasharray="3,3" stroke-width="0.8"/>`);
  parts.push(`<text x="${remX1 + remW / 2}" y="${sigY + m(4)}" font-size="${m(2.4)}" font-weight="600" fill="#1e293b" text-anchor="middle">${esc(teacherName)}</text>`);
  parts.push(`<text x="${remX1 + remW / 2}" y="${sigY + m(6.5)}" font-size="${m(2)}" fill="#94a3b8" text-anchor="middle">Teacher</text>`);

  // Principal's Remark with enhanced styling
  parts.push(`<rect x="${remX2}" y="${y}" width="${remW}" height="${remarksH}" rx="${m(2)}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8" filter="url(#shadow)"/>`);
  parts.push(`<rect x="${remX2}" y="${y}" width="${remW}" height="${m(4)}" rx="${m(2)}" fill="${accentColor}" fill-opacity="0.08"/>`);
  parts.push(`<text x="${remX2 + remW / 2}" y="${y + m(5.5)}" font-size="${m(2.6)}" font-weight="700" fill="${accentColor}" text-anchor="middle">Principal's Remark</text>`);

  const principalAllLines = wrapSvgText(esc(principalComment), Math.max(maxCharsPerLine, 20));
  const pTruncated = principalAllLines.length > 3;
  const pLines = pTruncated ? principalAllLines.slice(0, 3).map((l, i) => i === 2 ? l.replace(/\s+\S*$/, '') + '...' : l) : principalAllLines;
  remTextY = y + m(12);
  pLines.forEach((line) => {
    parts.push(`<text x="${remX2 + m(4)}" y="${remTextY}" font-size="${m(2.4)}" fill="#475569">${line}</text>`);
    remTextY += m(3.5);
  });

  parts.push(`<line x1="${remX2 + m(4)}" y1="${sigY}" x2="${remX2 + remW - m(4)}" y2="${sigY}" stroke="#cbd5e1" stroke-dasharray="3,3" stroke-width="0.8"/>`);
  parts.push(`<text x="${remX2 + remW / 2}" y="${sigY + m(4)}" font-size="${m(2.4)}" font-weight="600" fill="#1e293b" text-anchor="middle">${esc(principalName)}</text>`);
  parts.push(`<text x="${remX2 + remW / 2}" y="${sigY + m(6.5)}" font-size="${m(2)}" fill="#94a3b8" text-anchor="middle">Principal</text>`);

  y += Math.max(attendanceH, remarksH) + m(4);

  // ===== FOOTER =====
  const nextTerm = input.settings?.nextTermBegins ? fmtDate(input.settings.nextTermBegins) : '';
  const printDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  parts.push(`<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="#e2e8f0" stroke-width="0.8" stroke-opacity="0.6"/>`);
  y += m(3.5);

  if (nextTerm) {
    parts.push(`<text x="${M}" y="${y}" font-size="${m(2.4)}" fill="#475569">Next Term Begins: <tspan font-weight="700" fill="${primaryColor}">${esc(nextTerm)}</tspan></text>`);
  }
  parts.push(`<text x="${W - M}" y="${y}" font-size="${m(2.2)}" fill="#94a3b8" text-anchor="end">Generated: ${esc(printDate)}</text>`);
  y += m(4.5);

  parts.push(`<text x="${ctrX}" y="${y}" font-size="${m(2)}" fill="#cbd5e1" text-anchor="middle" letter-spacing="2" opacity="0.7">SKOOLAR · ACADEMIC MANAGEMENT SYSTEM</text>`);

  const defsBlock = defs.length > 0 ? `<defs>${defs.join('')}</defs>` : '';
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${ctx.style}
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    ${defsBlock}
    ${parts.join('\n')}
  </svg>`;

  return { svg };
}

export async function renderReportCardPdf(input: ReportCardPdfInput, format: 'pdf' | 'png' = 'pdf'): Promise<Buffer> {
  await ensureResvgInit();

  const ctx = buildCtx(input);

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
    @page {
      margin: 0;
      @bottom-center {
        content: 'Page ' counter(page);
        font-size: 8pt;
        color: #94a3b8;
      }
    }
  </style>`;
  const enrichedCtx = { ...ctx, fontStack, style };

  const { svg } = buildReportCardSvg(enrichedCtx);

  // Render SVG at 4x resolution (384 DPI) for sharp PDF output
  const scale = format === 'pdf' ? 4 : 1;
  const r = new Resvg(svg, {
    background: 'white',
    fitTo: { mode: 'width', value: MM(210) * scale },
    font: { fontBuffers, defaultFontFamily: GEIST_FONT_FAMILY },
  });

  const png = Buffer.from(r.render().asPng());

  if (format === 'png') return png;

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  // Standard A4 dimensions in PDF points (1/72 inch)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const img = await pdfDoc.embedPng(png);
  page.drawImage(img, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
