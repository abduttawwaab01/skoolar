import { Resvg } from '@resvg/resvg-wasm';
import { GEIST_REGULAR_BASE64, GEIST_BOLD_BASE64, GEIST_FONT_FAMILY, GEIST_BOLD_FONT_FAMILY } from './geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from './arabic-font-data';
import { ensureResvgInit } from './init-resvg';
import {
  esc, n, adj, contrast, hasArabic, rtlAttr,
  wrapToLines, fitName, renderWrapped, parseBackText,
} from './formatters';
import {
  MM, PW, PH, LW, LH,
} from './constants';

interface RenderCardOptions {
  person?: any;
  colors: { primary: string; secondary: string; accent?: string; text?: string; textSecondary?: string; headerBg?: string; bg?: string; gradientFrom?: string; gradientTo?: string };
  design?: any;
  showPhoto?: boolean;
  showLogo?: boolean;
  showQR?: boolean;
  showBarcode?: boolean;
  showSignature?: boolean;
  showWatermark?: boolean;
  showMotto?: boolean;
  showExpiryDate?: boolean;
  showIssueDate?: boolean;
  orientation?: string;
  photoUrl?: string | null;
  qrData?: string | null;
  isBack?: boolean;
  isPreview?: boolean;
  role?: string;
  backText?: string;
  showTerms?: boolean;
  termsText?: string;
  backLayoutType?: 'standard' | 'minimal' | 'detailed';
  issueDate?: string | null;
  expiryDate?: string | null;
  signatureUrl?: string | null;
  watermarkText?: string | null;
  schoolLogo?: string | null;
  schoolName?: string;
  motto?: string;
  showMedicalInfo?: boolean;
  showEmergencyInfo?: boolean;
  showSchoolInfo?: boolean;
  showSignatory?: boolean;
}

export async function renderIDCard(
  person: any,
  options: RenderCardOptions
): Promise<Buffer> {
  await ensureResvgInit();

  const {
    colors,
    showPhoto = true,
    showLogo = true,
    showQR = true,
    showBarcode = true,
    showSignature = true,
    showWatermark = true,
    showMotto = true,
    showExpiryDate = false,
    showIssueDate = true,
    orientation = 'landscape',
    photoUrl = null,
    qrData = null,
    isBack = false,
    isPreview = false,
    role = 'STUDENT',
    backText = '',
    showTerms = true,
    termsText = '',
    backLayoutType = 'standard',
    issueDate = null,
    expiryDate = null,
    signatureUrl = null,
    watermarkText = null,
    schoolLogo = null,
    schoolName = '',
    motto = '',
    showMedicalInfo = false,
    showEmergencyInfo = false,
    showSchoolInfo = false,
    showSignatory = false,
  } = options;

  const port = orientation === 'portrait';
  const W = port ? PW : LW;
  const H = port ? PH : LH;

  // Professional color palette with better contrast
  const prim = colors.primary || '#1a4d8f';
  const sec = colors.secondary || '#FFFFFF';
  const accent = colors.accent || '#e8a838';
  const dark = colors.text || '#1a2332';
  const muted = colors.textSecondary || '#6b7a8f';
  const hdrBg = colors.headerBg || prim;
  const bgColor = colors.bg || '#f8f9fc';
  const gradFrom = colors.gradientFrom || prim;
  const gradTo = colors.gradientTo || adj(prim, 45);

  const primD = adj(prim, -30);
  const border = adj(sec, -20);

  const pType = person.type || (role === 'STUDENT' ? 'student' : 'staff');
  const rawName = person.name || 'Unknown';
  const rawId = person.displayId || person.admissionNo || person.employeeNo || 'N/A';
  const rawClass = person.class || person.className || 'N/A';
  const rawSection = person.section || '';
  const rawDept = person.department || '';
  const rawGender = person.gender || '';
  const rawPhone = person.phone || '';
  const rawEmail = person.email || '';
  const rawAddress = person.address || '';
  const rawBlood = person.bloodGroup || '';
  const rawDOB = person.dateOfBirth || '';
  const rawHouse = person.house || '';
  const rawSession = person.academicSession || '';
  const rawDesignation = person.designation || '';
  const rawPosition = person.position || '';
  const rawRole = role;

  const schN = schoolName || person._school?.name || 'School Name';
  const schMotto = motto || person._school?.motto || '';
  const schLogo = schoolLogo || person._school?.logo || null;

  const inits = esc(rawName.split(' ').map((x: string) => x[0] || '').join('').slice(0, 2).toUpperCase());

  const hdrTxt = contrast(hdrBg);

  const FF = `'${ARABIC_FONT_FAMILY}', '${GEIST_FONT_FAMILY}', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

  // Enhanced professional styles
  const style = `<style>
    * { font-family: ${FF}; box-sizing: border-box; }
    text { font-family: ${FF}; }
    .text-light { fill: ${hdrTxt}; }
    .text-dark { fill: ${dark}; }
    .text-muted { fill: ${muted}; }
    .text-primary { fill: ${prim}; }
    .text-accent { fill: ${accent}; }
    .name-text { font-weight: 700; letter-spacing: 0.5px; }
    .label-text { font-weight: 500; letter-spacing: 0.3px; }
    .value-text { font-weight: 600; letter-spacing: 0.2px; }
    .rtl { direction: rtl; unicode-bidi: bidi-override; }
    .shadow-sm { filter: url(#shadow-sm); }
    .shadow-md { filter: url(#shadow-md); }
    .shadow-lg { filter: url(#shadow-lg); }
  </style>`;

  const defs = `<defs>
    <linearGradient id="header-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primD}"/>
      <stop offset="50%" stop-color="${hdrBg}"/>
      <stop offset="100%" stop-color="${adj(hdrBg, 25)}"/>
    </linearGradient>
    <linearGradient id="header-grad-vert" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${primD}"/>
      <stop offset="100%" stop-color="${hdrBg}"/>
    </linearGradient>
    <linearGradient id="body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradFrom}" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="${gradTo}" stop-opacity="0.01"/>
    </linearGradient>
    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.05"/>
    </linearGradient>
    <filter id="shadow-sm" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.08"/>
    </filter>
    <filter id="shadow-md" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.12"/>
    </filter>
    <filter id="shadow-lg" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${prim}" flood-opacity="0.15"/>
    </filter>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  // Resolve photo buffer
  let phBuf: Buffer | null = null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skoolar.org';

  if (showPhoto && photoUrl) {
    try {
      if (photoUrl.startsWith('data:')) {
        const match = /^data:([^;]+);base64,(.+)$/i.exec(photoUrl);
        if (match) phBuf = Buffer.from(match[2], 'base64');
      } else {
        const url = photoUrl.startsWith('//') ? `https:${photoUrl}` :
                    photoUrl.startsWith('http') ? photoUrl : `${baseUrl}${photoUrl}`;
        const mod = url.startsWith('https') ? await import('node:https') : await import('node:http');
        const buf = await new Promise<Buffer>((resolve, reject) => {
          const req = (mod as any).get(url, { timeout: 8000, headers: { 'Accept': 'image/*' } }, (res: any) => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`HTTP ${res.statusCode}`)); return;
            }
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
          });
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
          req.on('error', reject);
        });
        if (buf.length > 0 && buf.length <= 5 * 1024 * 1024) phBuf = buf;
      }
    } catch { /* photo fetch failed, use placeholder */ }
  }

  const qrB64 = qrData || '';

  const svg = port
    ? buildPortrait(W, H, {
        prim, primD, sec, dark, muted, border, hdrTxt, accent, bgColor,
        pName: rawName, pId: rawId, pClass: rawClass, pSection: rawSection,
        pDept: rawDept, pGend: rawGender, pPhone: rawPhone, pEmail: rawEmail,
        pAddr: rawAddress, pBlood: rawBlood, pDOB: rawDOB, pHouse: rawHouse,
        pSession: rawSession, pDesignation: rawDesignation, pPosition: rawPosition,
        pRole: rawRole, pType,
        schN, schMotto, schLogo, inits,
        qrB64, showPhoto, showQR, showBarcode, showSignature, showLogo, showWatermark, showMotto,
        showExpiryDate, showIssueDate, isBack, backText,
        issueDate, expiryDate, signatureUrl, watermarkText,
        showMedicalInfo, showEmergencyInfo, showSchoolInfo, showSignatory,
        showTerms, termsText, backLayoutType,
        style, defs,
      })
    : buildLandscape(W, H, {
        prim, primD, sec, dark, muted, border, hdrTxt, accent, bgColor,
        pName: rawName, pId: rawId, pClass: rawClass, pSection: rawSection,
        pDept: rawDept, pGend: rawGender, pPhone: rawPhone, pEmail: rawEmail,
        pAddr: rawAddress, pBlood: rawBlood, pDOB: rawDOB, pHouse: rawHouse,
        pSession: rawSession, pDesignation: rawDesignation, pPosition: rawPosition,
        pRole: rawRole, pType,
        schN, schMotto, schLogo, inits,
        qrB64, showPhoto, showQR, showBarcode, showSignature, showLogo, showWatermark, showMotto,
        showExpiryDate, showIssueDate, isBack, backText,
        issueDate, expiryDate, signatureUrl, watermarkText,
        showMedicalInfo, showEmergencyInfo, showSchoolInfo, showSignatory,
        showTerms, termsText, backLayoutType,
        style, defs,
      });

  const geistBuffer = Buffer.from(GEIST_REGULAR_BASE64, 'base64');
  const geistBoldBuffer = Buffer.from(GEIST_BOLD_BASE64, 'base64');
  const arabicBuffer = Buffer.from(ARABIC_FONT_BASE64, 'base64');

  try {
    const resvg = new Resvg(svg, {
      background: 'white',
      fitTo: { mode: 'width', value: W },
      font: {
        fontBuffers: [new Uint8Array(arabicBuffer), new Uint8Array(geistBuffer), new Uint8Array(geistBoldBuffer)],
        defaultFontFamily: GEIST_FONT_FAMILY,
      },
    });

    let png: Buffer = Buffer.from(resvg.render().asPng());

    if (phBuf && showPhoto) {
      try {
        const sharp = (await import('sharp')).default;
        const r = port ? 90 : 88;
        const cx = port ? Math.round(W / 2) : 48 + r + 2;
        const cy = port ? 220 : (110 + Math.round((H - 160) / 2));
        const d = r * 2;
        const circle = await sharp(Buffer.from(`<svg><circle cx="${d/2}" cy="${d/2}" r="${r}" fill="white"/></svg>`))
          .resize(d, d).png().toBuffer();
        const photo = await sharp(phBuf).resize(d, d, { fit: 'cover' }).png().toBuffer();
        const masked = await sharp(photo).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer();
        png = Buffer.from(await sharp(png).composite([{ input: masked, top: cy - r, left: cx - r }]).png().toBuffer());
      } catch { /* photo compositing failed */ }
    }

    return png;
  } catch (err) {
    console.error('Resvg rendering error:', err);
    throw new Error(`Failed to render ID card: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// Enhanced photo circle with professional styling
function photoCircle(cx: number, cy: number, r: number, prim: string, muted: string, inits: string, id: string): string {
  return `<defs>
    <clipPath id="${id}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath>
    <radialGradient id="photo-glow-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${prim}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${prim}" stop-opacity="0.02"/>
    </radialGradient>
  </defs>
    <!-- Outer glow ring -->
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 16)}" fill="url(#photo-glow-${id})"/>
    <!-- Decorative ring -->
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 8)}" fill="none" stroke="${prim}" stroke-width="2" opacity="0.15"/>
    <!-- Main ring -->
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 4)}" fill="#ffffff" filter="url(#shadow-sm)"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 2)}" fill="none" stroke="${prim}" stroke-width="2.5" opacity="0.3"/>
    <!-- Photo placeholder background -->
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${prim}" opacity="0.04"/>
    <!-- Initials -->
    <text x="${n(cx)}" y="${n(cy + 2)}" font-size="${n(r * 0.65)}" font-weight="700" fill="${prim}" opacity="0.25"
      text-anchor="middle" dominant-baseline="middle" letter-spacing="1">${inits}</text>`;
}

interface SVGParams {
  prim: string; primD: string; sec: string; dark: string; muted: string;
  border: string; hdrTxt: string; accent: string; bgColor: string;
  pName: string; pId: string; pClass: string; pSection: string;
  pDept: string; pGend: string; pPhone: string; pEmail: string;
  pAddr: string; pBlood: string; pDOB: string; pHouse: string;
  pSession: string; pDesignation: string; pPosition: string;
  pRole: string; pType: string;
  schN: string; schMotto: string; schLogo: string | null; inits: string;
  qrB64: string;
  showPhoto: boolean; showQR: boolean; showBarcode: boolean; showSignature: boolean;
  showLogo: boolean; showWatermark: boolean; showMotto: boolean;
  showExpiryDate: boolean; showIssueDate: boolean;
  isBack: boolean; backText: string;  showTerms: boolean; termsText: string; backLayoutType: 'standard' | 'minimal' | 'detailed';  issueDate: string | null; expiryDate: string | null;
  signatureUrl: string | null; watermarkText: string | null;
  showMedicalInfo: boolean; showEmergencyInfo: boolean;
  showSchoolInfo: boolean; showSignatory: boolean;
  style: string; defs: string;
}

// Professional info card with better visual hierarchy
function infoCard(x: number, y: number, w: number, h: number, sec: string, border: string, prim: string, content: string): string {
  return `<g filter="url(#shadow-sm)">
    <rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="12"
      fill="${sec}" stroke="${border}" stroke-width="1.2" opacity="0.6"/>
  </g>
  <rect x="${n(x + 2)}" y="${n(y + 2)}" width="${n(w - 4)}" height="${n(h - 4)}" rx="10"
    fill="${sec}" opacity="0.8"/>
  <!-- Subtle top accent line -->
  <rect x="${n(x + 20)}" y="${n(y)}" width="${n(w - 40)}" height="2" rx="1" fill="${prim}" opacity="0.15"/>
  ${content}`;
}

function watermarkBack(W: number, H: number, prim: string, schN: string): string {
  const size = Math.min(W, H) * 0.028;
  return `<g opacity="0.04" pointer-events="none">
      <text x="${n(W / 2)}" y="${n(H * 0.35)}" font-size="${n(size)}" font-weight="200"
        fill="${prim}" text-anchor="middle" dominant-baseline="middle" letter-spacing="6">${esc(schN)}</text>
      <text x="${n(W / 2)}" y="${n(H * 0.65)}" font-size="${n(size * 0.5)}" font-weight="200"
        fill="${prim}" text-anchor="middle" dominant-baseline="middle" letter-spacing="8">SECURE ID</text>
    </g>`;
}

function buildPortrait(W: number, H: number, o: SVGParams): string {
  const { isBack, backText } = o;
  const hH = 120;
  const mg = 32;

  if (isBack) return buildPortraitBack(W, H, o);

  // Front - Portrait
  const photoR = 90;
  const photoCX = Math.round(W / 2);
  const photoCY = hH + 88;
  
  const nameBaseY = photoCY + photoR + 16;
  const nameFitResult = fitName(o.pName, 24, 34, 20);
  const nameLines = nameFitResult.lines;
  const nameFs = nameFitResult.fontSize;
  const nameLineGap = 3;

  const badgeY = nameBaseY + 18 + (nameLines.length - 1) * (nameFs + nameLineGap);
  const badgeW = 240;
  const badgeH = 28;
  const badgeX = Math.round((W - badgeW) / 2);

  const infoCardX = mg;
  const infoCardY = badgeY + badgeH + 16;
  const infoCardW = W - mg * 2;

  const rows: { l: string; v: string }[] = [];
  if (o.pType === 'student') {
    rows.push({ l: 'Student ID', v: o.pId });
    rows.push({ l: 'Class', v: o.pClass });
    if (o.pSection) rows.push({ l: 'Section', v: o.pSection });
    if (o.pDept) rows.push({ l: 'Department', v: o.pDept });
    if (o.pHouse) rows.push({ l: 'House', v: o.pHouse });
    if (o.pBlood) rows.push({ l: 'Blood Group', v: o.pBlood });
    if (o.pGend) rows.push({ l: 'Gender', v: o.pGend });
    if (o.pDOB) rows.push({ l: 'DOB', v: o.pDOB });
    if (o.pSession) rows.push({ l: 'Session', v: o.pSession });
  } else if (o.pType === 'teacher') {
    rows.push({ l: 'Staff ID', v: o.pId });
    if (o.pDept) rows.push({ l: 'Department', v: o.pDept });
    if (o.pDesignation) rows.push({ l: 'Designation', v: o.pDesignation });
    if (o.pBlood) rows.push({ l: 'Blood Group', v: o.pBlood });
    if (o.pPhone) rows.push({ l: 'Phone', v: o.pPhone });
    if (o.pDOB) rows.push({ l: 'Date Joined', v: o.pDOB });
  } else {
    rows.push({ l: 'Employee ID', v: o.pId });
    if (o.pDept) rows.push({ l: 'Department', v: o.pDept });
    if (o.pPosition) rows.push({ l: 'Position', v: o.pPosition });
    if (o.pPhone) rows.push({ l: 'Phone', v: o.pPhone });
    if (o.pDOB) rows.push({ l: 'Date Joined', v: o.pDOB });
  }

  const rowStartY = infoCardY + 20;
  const rowLH = 32;
  const labelX = infoCardX + 16;
  const valueX = labelX + 130;
  const rowFs = 17;
  const maxRows = Math.min(rows.length, 6);
  const dateRowCount = (o.showIssueDate && o.issueDate ? 1 : 0) + (o.showExpiryDate && o.expiryDate ? 1 : 0);
  const totalInfoRows = maxRows + dateRowCount;
  const infoCardH = 20 + totalInfoRows * rowLH + 16;

  const infoRowsHtml = rows.slice(0, maxRows).map((row, i) => `
    <text x="${n(labelX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" fill="${o.muted}" class="label-text">${row.l}</text>
    <text x="${n(valueX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${o.dark}" class="value-text"${rtlAttr(row.v)}>${row.v}</text>
  `).join('');

  const dateRowsHtml: string[] = [];
  let dateOffset = maxRows;
  if (o.showIssueDate && o.issueDate) {
    dateRowsHtml.push(`<text x="${n(labelX)}" y="${n(rowStartY + dateOffset * rowLH)}" font-size="${n(rowFs)}" fill="${o.muted}" class="label-text">Issued</text><text x="${n(valueX)}" y="${n(rowStartY + dateOffset * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${o.dark}" class="value-text">${esc(o.issueDate)}</text>`);
    dateOffset++;
  }
  if (o.showExpiryDate && o.expiryDate) {
    dateRowsHtml.push(`<text x="${n(labelX)}" y="${n(rowStartY + dateOffset * rowLH)}" font-size="${n(rowFs)}" fill="${o.muted}" class="label-text">Expires</text><text x="${n(valueX)}" y="${n(rowStartY + dateOffset * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${o.dark}" class="value-text">${esc(o.expiryDate)}</text>`);
  }

  // QR with better positioning
  const qrSz = Math.min(280, W - mg * 2 - 60);
  const qrPad = 12;
  const qrBW = qrSz + qrPad * 2;
  const qrBX = Math.round((W - qrBW) / 2);
  const qrBY = infoCardY + infoCardH + 28;
  const qrBH = qrSz + qrPad * 2 + 24;

  const phEl = o.showPhoto ? photoCircle(photoCX, photoCY, photoR, o.prim, o.muted, o.inits, 'pc1') : '';

  let qrEl = '';
  if (o.showQR && o.qrB64) {
    const scanY = qrBY + qrBH - 8;
    qrEl = `<g filter="url(#shadow-md)">
      <rect x="${n(qrBX)}" y="${n(qrBY)}" width="${n(qrBW)}" height="${n(qrBH)}" rx="12" fill="#ffffff" stroke="${o.border}" stroke-width="1"/>
    </g>
    <rect x="${n(qrBX + 4)}" y="${n(qrBY + 4)}" width="${n(qrBW - 8)}" height="${n(qrBH - 8)}" rx="8" fill="#fafbfc"/>
    <image x="${n(qrBX + qrPad)}" y="${n(qrBY + qrPad)}" width="${n(qrSz)}" height="${n(qrSz)}" href="data:image/png;base64,${o.qrB64}"/>
    <text x="${n(W / 2)}" y="${n(scanY)}" font-size="${n(12)}" font-weight="600" fill="${o.prim}" text-anchor="middle" letter-spacing="2.5" class="label-text">SCAN FOR VERIFICATION</text>`;
  }

  const roleLabel = o.pType === 'student' ? 'STUDENT' : o.pType === 'teacher' ? 'FACULTY' : o.pRole || 'STAFF';

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.style}${o.defs}
    
    <!-- Background -->
    <rect width="${W}" height="${H}" fill="${o.bgColor}"/>
    <rect width="${W}" height="${H}" fill="url(#body-grad)"/>

    <!-- Decorative elements -->
    <circle cx="${n(40)}" cy="${n(90)}" r="${n(320)}" fill="${o.prim}" opacity="0.02"/>
    <circle cx="${n(W - 30)}" cy="${n(H - 60)}" r="${n(200)}" fill="${o.accent}" opacity="0.015"/>

    <!-- Border -->
    <rect x="2" y="2" width="${n(W - 4)}" height="${n(H - 4)}" rx="16" fill="none" stroke="${o.border}" stroke-width="1.5" opacity="0.3"/>

    <!-- Header -->
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#header-grad)"/>
    <path d="M0 ${n(hH)} Q${n(W * 0.20)} ${n(hH + 10)} ${n(W * 0.50)} ${n(hH + 4)} Q${n(W * 0.80)} ${n(hH - 4)} ${W} ${n(hH)}" fill="${o.prim}" opacity="0.2"/>

    <!-- Logo -->
    ${o.showLogo && o.schLogo ? `<image x="${n(16)}" y="${n(26)}" width="${n(68)}" height="${n(68)}" href="${esc(o.schLogo)}" preserveAspectRatio="xMidYMid meet" filter="url(#shadow-sm)"/>` : ''}

    <!-- School Name -->
    <g transform="translate(${o.showLogo && o.schLogo ? W / 2 + 8 : W / 2}, ${n(hH * 0.35)})">
      ${renderWrapped(0, 0, H * 0.028, o.hdrTxt, wrapToLines(o.schN, 30), 'middle', rtlAttr(o.schN), 3)}
    </g>

    <!-- Motto or Subtitle -->
    ${o.showMotto && o.schMotto ? `<text x="${n(W / 2)}" y="${n(hH * 0.72)}" font-size="${n(H * 0.013)}" fill="${o.hdrTxt}" text-anchor="middle" opacity="0.65" font-style="italic" class="label-text">${esc(o.schMotto)}</text>`
      : `<text x="${n(W / 2)}" y="${n(hH * 0.72)}" font-size="${n(H * 0.014)}" font-weight="600" fill="${o.hdrTxt}" text-anchor="middle" opacity="0.7" letter-spacing="3" class="label-text">IDENTIFICATION CARD</text>`}

    <!-- Photo -->
    ${phEl}

    <!-- Name -->
    ${renderWrapped(photoCX, nameBaseY, nameFs, o.dark, nameLines, 'middle', rtlAttr(o.pName), nameLineGap)}

    <!-- Role Badge -->
    <g filter="url(#shadow-sm)">
      <rect x="${n(badgeX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH / 2)}" fill="${o.prim}" opacity="0.08"/>
    </g>
    <rect x="${n(badgeX + 4)}" y="${n(badgeY + 4)}" width="${n(badgeW - 8)}" height="${n(badgeH - 8)}" rx="${n((badgeH - 8) / 2)}" fill="none" stroke="${o.prim}" stroke-width="1" opacity="0.15"/>
    <text x="${n(badgeX + badgeW / 2)}" y="${n(badgeY + badgeH * 0.68)}" font-size="${n(18)}" font-weight="700" fill="${o.prim}" text-anchor="middle" letter-spacing="2" class="label-text">${roleLabel}</text>

    <!-- Info Card -->
    ${infoCard(infoCardX, infoCardY, infoCardW, infoCardH, o.sec, o.border, o.prim, infoRowsHtml + dateRowsHtml.join(''))}

    <!-- QR -->
    ${qrEl}

    <!-- Signature -->
    ${o.showSignature && o.signatureUrl ? `<image x="${n(infoCardX + infoCardW - 110)}" y="${n(infoCardY + infoCardH - 50)}" width="90" height="34" href="${esc(o.signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.85"/>` : ''}

    <!-- Barcode -->
    ${o.showBarcode ? `<g transform="translate(${n(W * 0.08)}, ${n(H - 24)})">
      <rect width="${n(W * 0.84)}" height="5" fill="#ffffff" rx="2" filter="url(#shadow-sm)"/>
      <g fill="${o.dark}" opacity="0.7">${Array.from({ length: 35 }).map((_, i) => `<rect x="${n(i * (W * 0.84 / 35) + 2)}" y="0" width="${n(W * 0.84 / 70)}" height="5"/>`).join('')}</g>
      <text x="${n(W / 2)}" y="16" font-size="9" fill="${o.muted}" text-anchor="middle" class="label-text">${o.pId}</text>
    </g>` : ''}

    <!-- Watermark -->
    ${o.showWatermark && o.watermarkText ? `<g opacity="0.03" pointer-events="none">
      <text x="${n(W / 2)}" y="${n(H * 0.48)}" font-size="${n(Math.min(W, H) * 0.055)}" font-weight="800"
        fill="${o.prim}" text-anchor="middle" dominant-baseline="middle"
        transform="rotate(-25, ${n(W / 2)}, ${n(H * 0.48)})"
        letter-spacing="8">${esc(o.watermarkText || o.schN)}</text>
    </g>` : ''}
  </svg>`;
}

function buildLandscape(W: number, H: number, o: SVGParams): string {
  const { isBack } = o;
  const hH = 96;
  const mg = 40;

  if (isBack) return buildLandscapeBack(W, H, o);

  // Front - Landscape
  const colSep = Math.round(W * 0.55);
  const contentPadT = hH + 20;
  const contentH = H - contentPadT - 32 - 16;

  const photoR = 88;
  const photoCX = mg + photoR + 4;
  const photoCY = contentPadT + Math.round(contentH / 2);

  const textX = photoCX + photoR + 20;

  const nameBaseY = photoCY - 58;
  const nameFitResult = fitName(o.pName, 28, 32, 18);
  const nameLines = nameFitResult.lines;
  const nameFs = nameFitResult.fontSize;
  const nameLineGap = 4;

  const badgeY = nameBaseY + nameFs + 6 + (nameLines.length - 1) * (nameFs + nameLineGap);
  const badgeH = 24;
  const badgeW = Math.min(200, colSep - textX - mg);

  const infoY = badgeY + badgeH + 14;
  const rowLH = 32;
  const rowFs = 16;

  const rows: { l: string; v: string }[] = [];
  if (o.pType === 'student') {
    rows.push({ l: 'Student ID', v: o.pId });
    rows.push({ l: 'Class', v: o.pClass });
    if (o.pSection) rows.push({ l: 'Section', v: o.pSection });
    if (o.pDept) rows.push({ l: 'Department', v: o.pDept });
    if (o.pHouse) rows.push({ l: 'House', v: o.pHouse });
    if (o.pBlood) rows.push({ l: 'Blood Group', v: o.pBlood });
    if (o.pGend) rows.push({ l: 'Gender', v: o.pGend });
    if (o.pSession) rows.push({ l: 'Session', v: o.pSession });
  } else if (o.pType === 'teacher') {
    rows.push({ l: 'Staff ID', v: o.pId });
    if (o.pDept) rows.push({ l: 'Department', v: o.pDept });
    if (o.pDesignation) rows.push({ l: 'Designation', v: o.pDesignation });
    if (o.pBlood) rows.push({ l: 'Blood Group', v: o.pBlood });
    if (o.pPhone) rows.push({ l: 'Phone', v: o.pPhone });
  } else {
    rows.push({ l: 'Employee ID', v: o.pId });
    if (o.pDept) rows.push({ l: 'Department', v: o.pDept });
    if (o.pPosition) rows.push({ l: 'Position', v: o.pPosition });
    if (o.pPhone) rows.push({ l: 'Phone', v: o.pPhone });
  }

  const maxLandRows = Math.min(rows.length, 5);
  const infoRowsHtml = rows.slice(0, maxLandRows).map((row, i) => `
    <text x="${n(textX)}" y="${n(infoY + i * rowLH)}" font-size="${n(rowFs)}" fill="${o.muted}" class="label-text">${row.l}</text>
    <text x="${n(textX + 110)}" y="${n(infoY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${o.dark}" class="value-text"${rtlAttr(row.v)}>${row.v}</text>
  `).join('');

  const phEl = o.showPhoto ? photoCircle(photoCX, photoCY, photoR, o.prim, o.muted, o.inits, 'pc2') : '';

  const qrZW = W - colSep - mg;
  const qrSz = Math.min(qrZW - 32, contentH - 56);
  const qrX = colSep + Math.round((qrZW - qrSz) / 2);
  const qrY = contentPadT + Math.round((contentH - qrSz) / 2) - 4;
  const scanY = qrY + qrSz + 18;

  let qrEl = '';
  if (o.showQR && o.qrB64) {
    const qrPadL = 14;
    qrEl = `<g filter="url(#shadow-md)">
      <rect x="${n(qrX - qrPadL + 2)}" y="${n(qrY - qrPadL + 2)}" width="${n(qrSz + qrPadL * 2 - 4)}" height="${n(qrSz + qrPadL * 2 + 24 - 4)}" rx="12" fill="#ffffff" stroke="${o.border}" stroke-width="1"/>
    </g>
    <rect x="${n(qrX - qrPadL + 6)}" y="${n(qrY - qrPadL + 6)}" width="${n(qrSz + qrPadL * 2 - 12)}" height="${n(qrSz + qrPadL * 2 + 24 - 12)}" rx="8" fill="#fafbfc"/>
    <image x="${n(qrX)}" y="${n(qrY)}" width="${n(qrSz)}" height="${n(qrSz)}" href="data:image/png;base64,${o.qrB64}"/>
    <text x="${n(colSep + Math.round(qrZW / 2))}" y="${n(scanY)}" font-size="${n(13)}" font-weight="600" fill="${o.prim}" text-anchor="middle" letter-spacing="2.5" class="label-text">SCAN FOR VERIFICATION</text>`;
  }

  const roleLabel = o.pType === 'student' ? 'STUDENT' : o.pType === 'teacher' ? 'FACULTY' : o.pRole || 'STAFF';

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.style}${o.defs}
    
    <!-- Background -->
    <rect width="${W}" height="${H}" fill="${o.bgColor}"/>
    <rect width="${W}" height="${H}" fill="url(#body-grad)"/>

    <!-- Decorative elements -->
    <circle cx="${n(50)}" cy="${n(H * 0.25)}" r="${n(H * 0.45)}" fill="${o.prim}" opacity="0.018"/>
    <circle cx="${n(W - 40)}" cy="${n(H * 0.75)}" r="${n(H * 0.30)}" fill="${o.accent}" opacity="0.012"/>

    <!-- Border -->
    <rect x="2" y="2" width="${n(W - 4)}" height="${n(H - 4)}" rx="14" fill="none" stroke="${o.border}" stroke-width="1.5" opacity="0.3"/>

    <!-- Header -->
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#header-grad)"/>
    <path d="M0 ${n(hH)} Q${n(W * 0.15)} ${n(hH + 8)} ${n(W * 0.50)} ${n(hH + 3)} Q${n(W * 0.85)} ${n(hH - 3)} ${W} ${n(hH)}" fill="${o.prim}" opacity="0.15"/>

    <!-- Logo -->
    ${o.showLogo && o.schLogo ? `<image x="${n(mg)}" y="${n(14)}" width="${n(80)}" height="${n(68)}" href="${esc(o.schLogo)}" preserveAspectRatio="xMidYMid meet" filter="url(#shadow-sm)"/>` : ''}

    <!-- School Name -->
    <g transform="translate(${o.showLogo && o.schLogo ? mg + 104 : mg}, ${n(hH * 0.38)})">
      ${renderWrapped(0, 0, H * 0.055, o.hdrTxt, wrapToLines(o.schN, 22).slice(0, 2), 'start', rtlAttr(o.schN), 4)}
    </g>

    <!-- Motto or ID Label -->
    ${o.showMotto && o.schMotto ? `<text x="${n(W * 0.35)}" y="${n(hH * 0.74)}" font-size="${n(H * 0.022)}" fill="${o.hdrTxt}" opacity="0.6" font-style="italic" class="label-text">${esc(o.schMotto)}</text>`
      : `<text x="${n(W - mg)}" y="${n(hH * 0.52)}" font-size="${n(H * 0.038)}" font-weight="600" fill="${o.hdrTxt}" text-anchor="end" opacity="0.8" letter-spacing="3" class="label-text">ID CARD</text>`}

    <!-- Divider -->
    <line x1="${n(colSep)}" y1="${n(contentPadT + 4)}" x2="${n(colSep)}" y2="${n(H - 32 - 4)}" stroke="${o.border}" stroke-width="1" opacity="0.2"/>

    <!-- Photo -->
    ${phEl}

    <!-- Name -->
    ${renderWrapped(textX, nameBaseY, nameFs, o.dark, nameLines, 'start', rtlAttr(o.pName), nameLineGap)}

    <!-- Role Badge -->
    <g filter="url(#shadow-sm)">
      <rect x="${n(textX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH / 2)}" fill="${o.prim}" opacity="0.08"/>
    </g>
    <rect x="${n(textX + 4)}" y="${n(badgeY + 4)}" width="${n(badgeW - 8)}" height="${n(badgeH - 8)}" rx="${n((badgeH - 8) / 2)}" fill="none" stroke="${o.prim}" stroke-width="1" opacity="0.15"/>
    <text x="${n(textX + badgeW / 2)}" y="${n(badgeY + badgeH * 0.66)}" font-size="${n(15)}" font-weight="700" fill="${o.prim}" text-anchor="middle" letter-spacing="2" class="label-text">${roleLabel}</text>

    <!-- Info -->
    ${infoRowsHtml}

    <!-- QR -->
    ${qrEl}

    <!-- Signature -->
    ${o.showSignature && o.signatureUrl ? `<image x="${n(colSep - 110)}" y="${n(H - 34 - 28)}" width="90" height="32" href="${esc(o.signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.85"/>` : ''}

    <!-- Barcode -->
    ${o.showBarcode ? `<g transform="translate(${n(mg)}, ${n(H - 24)})">
      <rect width="${n(colSep - mg - 16)}" height="5" fill="#ffffff" rx="2" filter="url(#shadow-sm)"/>
      <g fill="${o.dark}" opacity="0.7">${Array.from({ length: 28 }).map((_, i) => `<rect x="${n(i * ((colSep - mg - 16) / 28) + 2)}" y="0" width="${n((colSep - mg - 16) / 56)}" height="5"/>`).join('')}</g>
      <text x="${n((colSep - mg - 16) / 2)}" y="16" font-size="9" fill="${o.muted}" text-anchor="middle" class="label-text">${o.pId}</text>
    </g>` : ''}

    <!-- Watermark -->
    ${o.showWatermark && o.watermarkText ? `<g opacity="0.03" pointer-events="none">
      <text x="${n(W / 2)}" y="${n(H * 0.48)}" font-size="${n(Math.min(W, H) * 0.055)}" font-weight="800"
        fill="${o.prim}" text-anchor="middle" dominant-baseline="middle"
        transform="rotate(-25, ${n(W / 2)}, ${n(H * 0.48)})"
        letter-spacing="8">${esc(o.watermarkText || o.schN)}</text>
    </g>` : ''}
  </svg>`;
}

function buildPortraitBack(W: number, H: number, o: SVGParams): string {
  const mg = 32;
  const hH = 120;
  const contentTop = hH + 20;
  const contentBottom = H - 56;
  const contentHeight = contentBottom - contentTop;
  const leftWidth = Math.round(W * 0.55);
  const rightX = Math.round(mg + leftWidth + 20);
  const rightWidth = W - rightX - mg;
  const infoBoxHeight = Math.round(contentHeight * 0.58);
  const contactBoxY = contentTop + infoBoxHeight + 20;
  const contactBoxHeight = Math.round(contentHeight - infoBoxHeight - 20);

  const backContent = o.showTerms
    ? o.termsText?.trim() || o.backText || 'This ID card is the property of the school. If found, please return to the school office.'
    : 'This ID card is issued for authorized school use only.';
  const impLines = wrapToLines((backContent || '').replace(/\n/g, ' | '), 34);
  const contactParts = [o.schN || '', o.pAddr || '', o.pPhone || '', o.pEmail || ''].filter(Boolean);
  const conLines = wrapToLines(contactParts.join(' | ') || 'School Name', 34);

  const impLineHeight = Math.max(20, Math.min(Math.round((infoBoxHeight - 36) / Math.max(impLines.length, 1)), Math.round(H * 0.030)));
  const impFontSize = Math.max(11, Math.min(Math.round(H * 0.014), Math.round(impLineHeight * 0.62)));
  const conLineHeight = Math.max(18, Math.min(Math.round((contactBoxHeight - 38) / Math.max(conLines.length, 1)), Math.round(H * 0.024)));
  const conFontSize = Math.max(10, Math.min(Math.round(H * 0.013), Math.round(conLineHeight * 0.60)));

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.style}${o.defs}
    
    <!-- Background -->
    <rect width="${W}" height="${H}" fill="${o.bgColor}"/>
    <rect width="${W}" height="${H}" fill="url(#body-grad)"/>
    
    <!-- Decorative -->
    <circle cx="${n(W * 0.10)}" cy="${n(H * 0.15)}" r="${n(W * 0.30)}" fill="${o.prim}" opacity="0.012"/>
    <circle cx="${n(W * 0.90)}" cy="${n(H * 0.80)}" r="${n(W * 0.20)}" fill="${o.accent}" opacity="0.008"/>
    
    <!-- Border -->
    <rect x="3" y="3" width="${n(W - 6)}" height="${n(H - 6)}" rx="14" fill="none" stroke="${o.border}" stroke-width="1.5" opacity="0.25"/>

    <!-- Header -->
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#header-grad)"/>
    <path d="M0 ${n(hH)} Q${n(W * 0.20)} ${n(hH + 8)} ${n(W * 0.50)} ${n(hH + 4)} Q${n(W * 0.80)} ${n(hH)} ${W} ${n(hH)}" fill="${o.prim}" opacity="0.12"/>
    
    <!-- Header Content -->
    <g transform="translate(${W / 2}, ${n(hH * 0.38)})">
      ${renderWrapped(0, 0, H * 0.028, o.hdrTxt, wrapToLines(o.schN, 30), 'middle', rtlAttr(o.schN), 3)}
    </g>
    <text x="${n(W / 2)}" y="${n(hH * 0.74)}" font-size="${n(H * 0.012)}" fill="${o.hdrTxt}" text-anchor="middle" opacity="0.5" letter-spacing="4" class="label-text">OFFICIAL ID CARD</text>
    
    ${watermarkBack(W, H, o.prim, o.schN)}

    <!-- Information Panel -->
    <g>
      <rect x="${n(mg - 4)}" y="${n(contentTop - 6)}" width="${n(leftWidth + 12)}" height="${n(infoBoxHeight + 12)}" rx="12" fill="${o.sec}" opacity="0.6" filter="url(#shadow-sm)"/>
      <rect x="${n(mg - 2)}" y="${n(contentTop - 4)}" width="${n(leftWidth + 8)}" height="${n(infoBoxHeight + 8)}" rx="10" fill="none" stroke="${o.border}" stroke-width="1" opacity="0.3"/>
      
      <text x="${n(mg)}" y="${n(contentTop + 22)}" font-size="${n(Math.round(H * 0.016))}" font-weight="700" fill="${o.prim}" letter-spacing="2" class="label-text">TERMS & INFORMATION</text>
      <line x1="${n(mg)}" y1="${n(contentTop + 28)}" x2="${n(mg + leftWidth)}" y2="${n(contentTop + 28)}" stroke="${o.prim}" stroke-width="1" opacity="0.15"/>
      
      ${impLines.map((line, index) => {
        const y = contentTop + 42 + index * impLineHeight;
        return `<text x="${n(mg + 8)}" y="${n(y)}" font-size="${n(impFontSize)}" fill="${o.dark}" class="label-text"${rtlAttr(line)}>${esc(line)}</text>`;
      }).join('\n')}
    </g>

    <!-- Contact Panel -->
    <g>
      <rect x="${n(rightX - 8)}" y="${n(contactBoxY - 8)}" width="${n(rightWidth + 16)}" height="${n(contactBoxHeight + 16)}" rx="12" fill="${o.sec}" opacity="0.6" filter="url(#shadow-sm)"/>
      <rect x="${n(rightX - 6)}" y="${n(contactBoxY - 6)}" width="${n(rightWidth + 12)}" height="${n(contactBoxHeight + 12)}" rx="10" fill="none" stroke="${o.border}" stroke-width="1" opacity="0.3"/>
      
      <text x="${n(rightX + 8)}" y="${n(contactBoxY + 22)}" font-size="${n(Math.round(H * 0.015))}" font-weight="700" fill="${o.prim}" letter-spacing="2" class="label-text">SCHOOL CONTACT</text>
      <line x1="${n(rightX + 8)}" y1="${n(contactBoxY + 28)}" x2="${n(W - mg)}" y2="${n(contactBoxY + 28)}" stroke="${o.prim}" stroke-width="1" opacity="0.15"/>
      
      ${conLines.map((line, index) => {
        const y = contactBoxY + 46 + index * conLineHeight;
        return `<text x="${n(rightX + 8)}" y="${n(y)}" font-size="${n(conFontSize)}" fill="${o.dark}" class="label-text"${rtlAttr(line)}>${esc(line)}</text>`;
      }).join('\n')}
      
      <text x="${n(rightX + 8)}" y="${n(contactBoxY + contactBoxHeight - 12)}" font-size="${n(H * 0.013)}" fill="${o.muted}" opacity="0.7" class="label-text">If found, please return to the school office.</text>
    </g>

    <!-- Medical Info -->
    ${o.showMedicalInfo && o.pBlood ? `<g>
      <text x="${n(mg)}" y="${n(contentTop + infoBoxHeight + 44)}" font-size="${n(Math.round(H * 0.014))}" font-weight="700" fill="${o.accent}" letter-spacing="2" class="label-text">MEDICAL</text>
      <text x="${n(mg + 8)}" y="${n(contentTop + infoBoxHeight + 66)}" font-size="${n(impFontSize)}" fill="${o.dark}" class="label-text">Blood Group: ${esc(o.pBlood)}</text>
    </g>` : ''}

    <!-- Emergency Info -->
    ${o.showEmergencyInfo && o.pPhone ? `<g>
      <text x="${n(mg)}" y="${n(contentTop + infoBoxHeight + 96)}" font-size="${n(Math.round(H * 0.014))}" font-weight="700" fill="${o.accent}" letter-spacing="2" class="label-text">EMERGENCY</text>
      <text x="${n(mg + 8)}" y="${n(contentTop + infoBoxHeight + 118)}" font-size="${n(impFontSize)}" fill="${o.dark}" class="label-text">Phone: ${esc(o.pPhone)}</text>
    </g>` : ''}

    <!-- Signatory -->
    ${o.showSignatory && o.signatureUrl ? `
      <image x="${n(W / 2 - 50)}" y="${n(H - 54)}" width="100" height="28" href="${esc(o.signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.85"/>
      <text x="${n(W / 2)}" y="${n(H - 20)}" font-size="${n(H * 0.012)}" fill="${o.muted}" text-anchor="middle" class="label-text">Authorized Signatory</text>
    ` : ''}
  </svg>`;
}

function buildLandscapeBack(W: number, H: number, o: SVGParams): string {
  const mg = 40;
  const hH = 96;
  const contentTop = hH + 20;
  const contentBottom = H - 44;
  const contentHeight = contentBottom - contentTop;
  const leftWidth = Math.round((W - mg * 2 - 28) * 0.52);
  const rightX = mg + leftWidth + 28;
  const rightWidth = W - rightX - mg;
  const infoBoxHeight = Math.round(contentHeight * 0.70);
  const contactBoxY = contentTop + infoBoxHeight + 18;
  const contactBoxHeight = Math.round(contentHeight - infoBoxHeight - 18);

  const backContent = o.showTerms
    ? o.termsText?.trim() || o.backText || 'This ID card is the property of the school. If found, please return to the school office.'
    : 'This ID card is issued for authorized school use only.';
  const impLines = wrapToLines((backContent || '').replace(/\n/g, ' | '), 42);
  const contactParts = [o.schN || '', o.pAddr || '', o.pPhone || '', o.pEmail || ''].filter(Boolean);
  const conLines = wrapToLines(contactParts.join(' | ') || 'School Name', 42);

  const impLineHeight = Math.max(22, Math.min(Math.round((infoBoxHeight - 32) / Math.max(impLines.length, 1)), Math.round(H * 0.042)));
  const impFontSize = Math.max(12, Math.min(Math.round(H * 0.017), Math.round(impLineHeight * 0.60)));
  const conLineHeight = Math.max(20, Math.min(Math.round((contactBoxHeight - 38) / Math.max(conLines.length, 1)), Math.round(H * 0.038)));
  const conFontSize = Math.max(11, Math.min(Math.round(H * 0.015), Math.round(conLineHeight * 0.60)));

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.style}${o.defs}
    
    <!-- Background -->
    <rect width="${W}" height="${H}" fill="${o.bgColor}"/>
    <rect width="${W}" height="${H}" fill="url(#body-grad)"/>
    
    <!-- Decorative -->
    <circle cx="${n(W * 0.07)}" cy="${n(H * 0.30)}" r="${n(H * 0.40)}" fill="${o.prim}" opacity="0.012"/>
    <circle cx="${n(W * 0.93)}" cy="${n(H * 0.70)}" r="${n(H * 0.25)}" fill="${o.accent}" opacity="0.008"/>
    
    <!-- Border -->
    <rect x="3" y="3" width="${n(W - 6)}" height="${n(H - 6)}" rx="12" fill="none" stroke="${o.border}" stroke-width="1.5" opacity="0.25"/>

    <!-- Header -->
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#header-grad)"/>
    <path d="M0 ${n(hH)} Q${n(W * 0.15)} ${n(hH + 6)} ${n(W * 0.50)} ${n(hH + 3)} Q${n(W * 0.85)} ${n(hH - 2)} ${W} ${n(hH)}" fill="${o.prim}" opacity="0.12"/>
    
    <!-- Header Content -->
    <g transform="translate(${W / 2}, ${n(hH * 0.36)})">
      ${renderWrapped(0, 0, H * 0.050, o.hdrTxt, wrapToLines(o.schN, 26).slice(0, 2), 'middle', rtlAttr(o.schN), 3)}
    </g>
    <text x="${n(W / 2)}" y="${n(hH * 0.74)}" font-size="${n(H * 0.025)}" fill="${o.hdrTxt}" text-anchor="middle" opacity="0.5" letter-spacing="5" class="label-text">OFFICIAL ID CARD</text>
    
    ${watermarkBack(W, H, o.prim, o.schN)}

    <!-- Terms Panel -->
    <g>
      <rect x="${n(mg - 4)}" y="${n(contentTop - 6)}" width="${n(leftWidth + 12)}" height="${n(infoBoxHeight + 12)}" rx="12" fill="${o.sec}" opacity="0.6" filter="url(#shadow-sm)"/>
      <rect x="${n(mg - 2)}" y="${n(contentTop - 4)}" width="${n(leftWidth + 8)}" height="${n(infoBoxHeight + 8)}" rx="10" fill="none" stroke="${o.border}" stroke-width="1" opacity="0.3"/>
      
      <text x="${n(mg)}" y="${n(contentTop + 24)}" font-size="${n(Math.round(H * 0.030))}" font-weight="700" fill="${o.prim}" letter-spacing="2" class="label-text">TERMS & INFORMATION</text>
      <line x1="${n(mg)}" y1="${n(contentTop + 30)}" x2="${n(mg + leftWidth)}" y2="${n(contentTop + 30)}" stroke="${o.prim}" stroke-width="1" opacity="0.15"/>
      
      ${impLines.map((line, index) => {
        const y = contentTop + 48 + index * impLineHeight;
        return `<text x="${n(mg + 8)}" y="${n(y)}" font-size="${n(impFontSize)}" fill="${o.dark}" class="label-text"${rtlAttr(line)}>${esc(line)}</text>`;
      }).join('\n')}
      
      ${o.showMedicalInfo && o.pBlood ? `
      <text x="${n(mg)}" y="${n(contentTop + infoBoxHeight - 16)}" font-size="${n(Math.round(H * 0.016))}" font-weight="700" fill="${o.accent}" letter-spacing="2" class="label-text">MEDICAL</text>
      <text x="${n(mg + 8)}" y="${n(contentTop + infoBoxHeight + 6)}" font-size="${n(impFontSize)}" fill="${o.dark}" class="label-text">Blood Group: ${esc(o.pBlood)}</text>
      ` : ''}
    </g>

    <!-- Contact Panel -->
    <g>
      <rect x="${n(rightX - 8)}" y="${n(contactBoxY - 8)}" width="${n(rightWidth + 16)}" height="${n(contactBoxHeight + 16)}" rx="12" fill="${o.sec}" opacity="0.6" filter="url(#shadow-sm)"/>
      <rect x="${n(rightX - 6)}" y="${n(contactBoxY - 6)}" width="${n(rightWidth + 12)}" height="${n(contactBoxHeight + 12)}" rx="10" fill="none" stroke="${o.border}" stroke-width="1" opacity="0.3"/>
      
      <text x="${n(rightX + 10)}" y="${n(contactBoxY + 24)}" font-size="${n(Math.round(H * 0.028))}" font-weight="700" fill="${o.prim}" letter-spacing="2" class="label-text">SCHOOL CONTACT</text>
      <line x1="${n(rightX + 10)}" y1="${n(contactBoxY + 30)}" x2="${n(W - mg)}" y2="${n(contactBoxY + 30)}" stroke="${o.prim}" stroke-width="1" opacity="0.15"/>
      
      ${conLines.map((line, index) => {
        const y = contactBoxY + 52 + index * conLineHeight;
        return `<text x="${n(rightX + 10)}" y="${n(y)}" font-size="${n(conFontSize)}" fill="${o.dark}" class="label-text"${rtlAttr(line)}>${esc(line)}</text>`;
      }).join('\n')}
      
      <text x="${n(rightX + 10)}" y="${n(contactBoxY + contactBoxHeight - 12)}" font-size="${n(H * 0.014)}" fill="${o.muted}" opacity="0.7" class="label-text">Return to school if found.</text>
    </g>

    <!-- Emergency Info -->
    ${o.showEmergencyInfo && o.pPhone ? `<g>
      <text x="${n(rightX + 10)}" y="${n(contentTop + infoBoxHeight + 36)}" font-size="${n(Math.round(H * 0.016))}" font-weight="700" fill="${o.accent}" letter-spacing="2" class="label-text">EMERGENCY</text>
      <text x="${n(rightX + 10)}" y="${n(contentTop + infoBoxHeight + 58)}" font-size="${n(impFontSize)}" fill="${o.dark}" class="label-text">Phone: ${esc(o.pPhone)}</text>
    </g>` : ''}

    <!-- Signatory -->
    ${o.showSignatory && o.signatureUrl ? `
      <image x="${n(W / 2 - 50)}" y="${n(H - 42)}" width="100" height="26" href="${esc(o.signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.85"/>
      <text x="${n(W / 2)}" y="${n(H - 16)}" font-size="${n(H * 0.015)}" fill="${o.muted}" text-anchor="middle" class="label-text">Authorized Signatory</text>
    ` : ''}
  </svg>`;
}