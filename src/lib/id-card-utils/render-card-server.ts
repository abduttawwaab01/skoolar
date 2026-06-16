import { Resvg } from '@resvg/resvg-wasm';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from './geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from './arabic-font-data';
import { ensureResvgInit } from './init-resvg';
import sharp from 'sharp';
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

  const prim = colors.primary || '#059669';
  const sec = colors.secondary || '#FFFFFF';
  const accent = colors.accent || '#fbbf24';
  const dark = colors.text || '#1e293b';
  const muted = colors.textSecondary || '#64748b';
  const hdrBg = colors.headerBg || prim;
  const bgColor = colors.bg || '#ffffff';
  const gradFrom = colors.gradientFrom || prim;
  const gradTo = colors.gradientTo || adj(prim, 35);

  const primD = adj(prim, -25);
  const border = adj(sec, -25);

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

  const style = `<style>
    * { font-family: ${FF}; }
    text { font-family: ${FF}; }
    .text-light { fill: ${hdrTxt}; }
    .text-dark { fill: ${dark}; }
    .text-muted { fill: ${muted}; }
    .text-primary { fill: ${prim}; }
    .name-text { font-weight: 700; }
    .label-text { font-weight: 400; }
    .value-text { font-weight: 600; }
    .rtl { direction: rtl; unicode-bidi: bidi-override; }
  </style>`;

  const defs = `<defs>
    <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primD}"/>
      <stop offset="50%" stop-color="${hdrBg}"/>
      <stop offset="100%" stop-color="${adj(hdrBg, 20)}"/>
    </linearGradient>
    <linearGradient id="hg-vert" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${primD}"/>
      <stop offset="100%" stop-color="${hdrBg}"/>
    </linearGradient>
    <linearGradient id="body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradFrom}" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="${gradTo}" stop-opacity="0.01"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.15"/>
    </filter>
    <filter id="softshadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${prim}" flood-opacity="0.2"/>
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
  const arabicBuffer = Buffer.from(ARABIC_FONT_BASE64, 'base64');

  try {
    const resvg = new Resvg(svg, {
      background: 'white',
      fitTo: { mode: 'width', value: W },
      font: {
        fontBuffers: [new Uint8Array(arabicBuffer), new Uint8Array(geistBuffer)],
        defaultFontFamily: GEIST_FONT_FAMILY,
      },
    });

    let png: Buffer = Buffer.from(resvg.render().asPng());

    if (phBuf && showPhoto) {
      try {
        const r = port ? 95 : 94;
        const cx = port ? Math.round(W / 2) : 44 + r + 2;
        const cy = port ? 228 : (118 + Math.round((H - 172) / 2));
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

function photoCircle(cx: number, cy: number, r: number, prim: string, muted: string, inits: string, id: string): string {
  return `<defs><clipPath id="${id}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath></defs>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 12)}" fill="${prim}" opacity="0.12"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 4)}" fill="#ffffff"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 2)}" fill="none" stroke="${prim}" stroke-width="3" opacity="0.5"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${prim}" opacity="0.04"/>
    <text x="${n(cx)}" y="${n(cy)}" font-size="${n(r * 0.7)}" font-weight="700" fill="${prim}" opacity="0.35"
      text-anchor="middle" dominant-baseline="middle">${inits}</text>`;
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

function dataCard(x: number, y: number, w: number, h: number, sec: string, border: string, content: string): string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="14"
    fill="${adj(sec, -5)}" stroke="${border}" stroke-width="1" opacity="0.45"/>
  ${content}`;
}

function watermarkBack(W: number, H: number, prim: string, schN: string): string {
  const size = Math.min(W, H) * 0.028;
  return `<g opacity="0.06" pointer-events="none">
      <text x="${n(W / 2)}" y="${n(H * 0.35)}" font-size="${n(size)}" font-weight="300"
        fill="${prim}" text-anchor="middle" dominant-baseline="middle" letter-spacing="4">${esc(schN)}</text>
      <text x="${n(W / 2)}" y="${n(H * 0.65)}" font-size="${n(size * 0.55)}" font-weight="300"
        fill="${prim}" text-anchor="middle" dominant-baseline="middle" letter-spacing="6">SKOOLAR</text>
    </g>`;
}

function buildPortrait(W: number, H: number, o: SVGParams): string {
  const { isBack, backText } = o;
  const hH = 132;
  const mg = 38;

  if (isBack) return buildPortraitBack(W, H, o);

  // Front - Portrait
  const photoR = 95;
  const photoCX = Math.round(W / 2);
  const photoCY = hH + 96;
  const txtX = Math.round(W / 2);

  const nameBaseY = photoCY + photoR + 10;
  const nameFitResult = fitName(o.pName, 22, 36, 22);
  const nameLines = nameFitResult.lines;
  const nameFs = nameFitResult.fontSize;
  const nameLineGap = 2;

  const badgeY = nameBaseY + 16 + (nameLines.length - 1) * (nameFs + nameLineGap);
  const badgeW = 268;
  const badgeH = 30;
  const badgeX = Math.round((W - badgeW) / 2);

  const infoCardX = mg;
  const infoCardY = badgeY + badgeH + 12;
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

  const rowStartY = infoCardY + 18;
  const rowLH = 34;
  const labelX = infoCardX + 14;
  const valueX = labelX + 140;
  const rowFs = 18;
  const maxRows = Math.min(rows.length, 6);
  const dateRowCount = (o.showIssueDate && o.issueDate ? 1 : 0) + (o.showExpiryDate && o.expiryDate ? 1 : 0);
  const totalInfoRows = maxRows + dateRowCount;
  const infoCardH = 18 + totalInfoRows * rowLH + 12;

  const infoRowsHtml = rows.slice(0, maxRows).map((row, i) => `
    <text x="${n(labelX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" fill="${o.muted}">${row.l}</text>
    <text x="${n(valueX)}" y="${n(rowStartY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${o.dark}"${rtlAttr(row.v)}>${row.v}</text>
  `).join('');

  const dateRowsHtml: string[] = [];
  let dateOffset = maxRows;
  if (o.showIssueDate && o.issueDate) {
    dateRowsHtml.push(`<text x="${n(labelX)}" y="${n(rowStartY + dateOffset * rowLH)}" font-size="${n(rowFs)}" fill="${o.muted}">Issued</text><text x="${n(valueX)}" y="${n(rowStartY + dateOffset * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${o.dark}">${esc(o.issueDate)}</text>`);
    dateOffset++;
  }
  if (o.showExpiryDate && o.expiryDate) {
    dateRowsHtml.push(`<text x="${n(labelX)}" y="${n(rowStartY + dateOffset * rowLH)}" font-size="${n(rowFs)}" fill="${o.muted}">Expires</text><text x="${n(valueX)}" y="${n(rowStartY + dateOffset * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${o.dark}">${esc(o.expiryDate)}</text>`);
  }

  // QR
  const qrSz = Math.min(420, W - mg * 2 - 40);
  const qrPad = 10;
  const qrBW = qrSz + qrPad * 2;
  const qrBX = Math.round((W - qrBW) / 2);
  const qrBY = infoCardY + infoCardH + 32;
  const qrBH = qrSz + qrPad * 2 + 20;

  const phEl = o.showPhoto ? photoCircle(photoCX, photoCY, photoR, o.prim, o.muted, o.inits, 'pc1') : '';

  let qrEl = '';
  if (o.showQR && o.qrB64) {
    const scanY = qrBY + qrBH - 6;
    qrEl = `<g filter="url(#softshadow)">
      <rect x="${n(qrBX)}" y="${n(qrBY)}" width="${n(qrBW)}" height="${n(qrBH)}" rx="16" fill="#ffffff" stroke="${o.border}" stroke-width="1.5"/>
    </g>
    <rect x="${n(qrBX + 4)}" y="${n(qrBY + 4)}" width="${n(qrBW - 8)}" height="${n(qrBH - 8)}" rx="12" fill="#fafafa"/>
    <image x="${n(qrBX + qrPad)}" y="${n(qrBY + qrPad)}" width="${n(qrSz)}" height="${n(qrSz)}" href="data:image/png;base64,${o.qrB64}"/>
    <text x="${n(W / 2)}" y="${n(scanY)}" font-size="${n(14)}" font-weight="700" fill="${o.prim}" text-anchor="middle" letter-spacing="3">SCAN FOR ATTENDANCE</text>`;
  }

  const roleLabel = o.pType === 'student' ? 'STUDENT' : o.pType === 'teacher' ? 'TEACHER' : o.pRole || 'STAFF';

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.style}${o.defs}
    <rect width="${W}" height="${H}" fill="${o.bgColor}"/>
    <rect width="${W}" height="${H}" fill="url(#body-grad)"/>

    <circle cx="${n(30)}" cy="${n(80)}" r="${n(270)}" fill="${o.prim}" opacity="0.03"/>
    <circle cx="${n(W - 30)}" cy="${n(H - 80)}" r="${n(180)}" fill="${o.prim}" opacity="0.025"/>

    <rect x="2" y="2" width="${n(W - 4)}" height="${n(H - 4)}" rx="20" fill="none" stroke="${o.border}" stroke-width="2.5" opacity="0.35"/>

    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    <path d="M0 ${n(hH)} Q${n(W * 0.20)} ${n(hH + 10)} ${n(W * 0.50)} ${n(hH + 4)} Q${n(W * 0.80)} ${n(hH - 4)} ${W} ${n(hH)}" fill="${o.prim}" opacity="0.4"/>

    ${o.showLogo && o.schLogo ? `<image x="${n(18)}" y="${n(12)}" width="${n(72)}" height="${n(72)}" href="${esc(o.schLogo)}" preserveAspectRatio="xMidYMid slice"/>` : ''}

    <g transform="translate(${o.showLogo && o.schLogo ? W / 2 + 12 : W / 2}, ${n(hH * 0.38)})">
      ${renderWrapped(0, 0, H * 0.028, o.hdrTxt, wrapToLines(o.schN, 28), 'middle', rtlAttr(o.schN), 3)}
    </g>

    ${o.showMotto && o.schMotto ? `<text x="${n(W / 2)}" y="${n(hH * 0.74)}" font-size="${n(H * 0.013)}" fill="${o.hdrTxt}" text-anchor="middle" opacity="0.7" font-style="italic">${esc(o.schMotto)}</text>`
      : `<text x="${n(W / 2)}" y="${n(hH * 0.74)}" font-size="${n(H * 0.014)}" font-weight="600" fill="${o.hdrTxt}" text-anchor="middle" opacity="0.8" letter-spacing="2">SCHOOL ID CARD</text>`}

    ${phEl}

    ${renderWrapped(txtX, nameBaseY, nameFs, o.dark, nameLines, 'middle', rtlAttr(o.pName), nameLineGap)}

    <g filter="url(#shadow)">
      <rect x="${n(badgeX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH / 2)}" fill="${o.prim}" opacity="0.12"/>
    </g>
    <text x="${n(badgeX + badgeW / 2)}" y="${n(badgeY + badgeH * 0.68)}" font-size="${n(20)}" font-weight="700" fill="${o.prim}" text-anchor="middle" letter-spacing="1">${roleLabel}</text>

    ${dataCard(infoCardX, infoCardY, infoCardW, infoCardH, o.sec, o.border, infoRowsHtml + dateRowsHtml.join(''))}

    ${qrEl}

    ${o.showSignature && o.signatureUrl ? `<image x="${n(infoCardX + infoCardW - 120)}" y="${n(infoCardY + infoCardH - 60)}" width="100" height="40" href="${esc(o.signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.9"/>` : ''}

    ${o.showBarcode ? `<g transform="translate(${n(W * 0.06)}, ${n(H - 22)})"><rect width="${n(W * 0.88)}" height="6" fill="#fff"/><g fill="#111">${Array.from({ length: 40 }).map((_, i) => `<rect x="${n(i * (W * 0.88 / 40))}" y="0" width="${n(W * 0.88 / 80)}" height="6"/>`).join('')}</g><text x="${n(W / 2)}" y="16" font-size="10" fill="${o.muted}" text-anchor="middle">${o.pId}</text></g>` : ''}

    ${o.showWatermark && o.watermarkText ? `<g opacity="0.04" pointer-events="none">
      <text x="${n(W / 2)}" y="${n(H * 0.5)}" font-size="${n(Math.min(W, H) * 0.06)}" font-weight="900"
        fill="${o.prim}" text-anchor="middle" dominant-baseline="middle"
        transform="rotate(-30, ${n(W / 2)}, ${n(H * 0.5)})"
        letter-spacing="6">${esc(o.watermarkText || o.schN)}</text>
    </g>` : ''}
  </svg>`;
}

function buildLandscape(W: number, H: number, o: SVGParams): string {
  const { isBack } = o;
  const hH = 102;
  const mg = 44;

  if (isBack) return buildLandscapeBack(W, H, o);

  // Front - Landscape
  const colSep = Math.round(W * 0.56);
  const contentPadT = hH + 16;
  const contentH = H - contentPadT - 36 - 18;

  const photoR = 94;
  const photoCX = mg + photoR + 2;
  const photoCY = contentPadT + Math.round(contentH / 2);

  const textX = photoCX + photoR + 16;

  const nameBaseY = photoCY - 62;
  const nameFitResult = fitName(o.pName, 30, 30, 18);
  const nameLines = nameFitResult.lines;
  const nameFs = nameFitResult.fontSize;
  const nameLineGap = 4;

  const badgeY = nameBaseY + nameFs + 4 + (nameLines.length - 1) * (nameFs + nameLineGap);
  const badgeH = 26;
  const badgeW = Math.min(220, colSep - textX - mg);

  const infoY = badgeY + badgeH + 12;
  const rowLH = 34;
  const rowFs = 17;

  const rows: { l: string; v: string }[] = [];
  if (o.pType === 'student') {
    rows.push({ l: 'Student ID:', v: o.pId });
    rows.push({ l: 'Class:', v: o.pClass });
    if (o.pSection) rows.push({ l: 'Section:', v: o.pSection });
    if (o.pDept) rows.push({ l: 'Department:', v: o.pDept });
    if (o.pHouse) rows.push({ l: 'House:', v: o.pHouse });
    if (o.pBlood) rows.push({ l: 'Blood Group:', v: o.pBlood });
    if (o.pGend) rows.push({ l: 'Gender:', v: o.pGend });
    if (o.pSession) rows.push({ l: 'Session:', v: o.pSession });
  } else if (o.pType === 'teacher') {
    rows.push({ l: 'Staff ID:', v: o.pId });
    if (o.pDept) rows.push({ l: 'Department:', v: o.pDept });
    if (o.pDesignation) rows.push({ l: 'Designation:', v: o.pDesignation });
    if (o.pBlood) rows.push({ l: 'Blood Group:', v: o.pBlood });
    if (o.pPhone) rows.push({ l: 'Phone:', v: o.pPhone });
  } else {
    rows.push({ l: 'Employee ID:', v: o.pId });
    if (o.pDept) rows.push({ l: 'Department:', v: o.pDept });
    if (o.pPosition) rows.push({ l: 'Position:', v: o.pPosition });
    if (o.pPhone) rows.push({ l: 'Phone:', v: o.pPhone });
  }

  const maxLandRows = Math.min(rows.length, 5);
  const infoRowsHtml = rows.slice(0, maxLandRows).map((row, i) => `
    <text x="${n(textX)}" y="${n(infoY + i * rowLH)}" font-size="${n(rowFs)}" fill="${o.muted}">${row.l}</text>
    <text x="${n(textX + 120)}" y="${n(infoY + i * rowLH)}" font-size="${n(rowFs)}" font-weight="600" fill="${o.dark}"${rtlAttr(row.v)}>${row.v}</text>
  `).join('');

  const phEl = o.showPhoto ? photoCircle(photoCX, photoCY, photoR, o.prim, o.muted, o.inits, 'pc2') : '';

  const qrZW = W - colSep - mg;
  const qrSz = Math.min(qrZW - 28, contentH - 60);
  const qrX = colSep + Math.round((qrZW - qrSz) / 2);
  const qrY = contentPadT + Math.round((contentH - qrSz) / 2) - 8;
  const scanY = qrY + qrSz + 16;

  let qrEl = '';
  if (o.showQR && o.qrB64) {
    const qrPadL = 12;
    qrEl = `<g filter="url(#softshadow)">
      <rect x="${n(qrX - qrPadL + 2)}" y="${n(qrY - qrPadL + 2)}" width="${n(qrSz + qrPadL * 2 - 4)}" height="${n(qrSz + qrPadL * 2 + 22 - 4)}" rx="16" fill="#ffffff" stroke="${o.border}" stroke-width="1.5"/>
    </g>
    <rect x="${n(qrX - qrPadL + 6)}" y="${n(qrY - qrPadL + 6)}" width="${n(qrSz + qrPadL * 2 - 12)}" height="${n(qrSz + qrPadL * 2 + 22 - 12)}" rx="12" fill="#fafafa"/>
    <image x="${n(qrX)}" y="${n(qrY)}" width="${n(qrSz)}" height="${n(qrSz)}" href="data:image/png;base64,${o.qrB64}"/>
    <text x="${n(colSep + Math.round(qrZW / 2))}" y="${n(scanY)}" font-size="${n(14)}" font-weight="700" fill="${o.prim}" text-anchor="middle" letter-spacing="2">SCAN FOR ATTENDANCE</text>`;
  }

  const roleLabel = o.pType === 'student' ? 'STUDENT' : o.pType === 'teacher' ? 'TEACHER' : o.pRole || 'STAFF';

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.style}${o.defs}
    <rect width="${W}" height="${H}" fill="${o.bgColor}"/>
    <rect width="${W}" height="${H}" fill="url(#body-grad)"/>

    <circle cx="${n(40)}" cy="${n(H * 0.28)}" r="${n(H * 0.48)}" fill="${o.prim}" opacity="0.022"/>

    <rect x="2" y="2" width="${n(W - 4)}" height="${n(H - 4)}" rx="20" fill="none" stroke="${o.border}" stroke-width="2.5" opacity="0.35"/>

    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    <path d="M0 ${n(hH)} Q${n(W * 0.15)} ${n(hH + 8)} ${n(W * 0.50)} ${n(hH + 3)} Q${n(W * 0.85)} ${n(hH - 3)} ${W} ${n(hH)}" fill="${o.prim}" opacity="0.3"/>

    ${o.showLogo && o.schLogo ? `<image x="${n(mg)}" y="${n(8)}" width="${n(96)}" height="${n(72)}" href="${esc(o.schLogo)}" preserveAspectRatio="xMidYMid slice"/>` : ''}

    <g transform="translate(${o.showLogo && o.schLogo ? mg + 110 : mg}, ${n(hH * 0.42)})">
      ${renderWrapped(0, 0, H * 0.060, o.hdrTxt, wrapToLines(o.schN, 20).slice(0, 2), 'start', rtlAttr(o.schN), 4)}
    </g>

    ${o.showMotto && o.schMotto ? `<text x="${n(W * 0.35)}" y="${n(hH * 0.76)}" font-size="${n(H * 0.025)}" fill="${o.hdrTxt}" opacity="0.7" font-style="italic">${esc(o.schMotto)}</text>`
      : `<text x="${n(W - mg)}" y="${n(hH * 0.54)}" font-size="${n(H * 0.040)}" font-weight="600" fill="${o.hdrTxt}" text-anchor="end" opacity="0.9" letter-spacing="2">ID CARD</text>`}

    <line x1="${n(colSep)}" y1="${n(contentPadT + 4)}" x2="${n(colSep)}" y2="${n(H - 36 - 6)}" stroke="${o.border}" stroke-width="1.2" opacity="0.25"/>

    ${phEl}

    ${renderWrapped(textX, nameBaseY, nameFs, o.dark, nameLines, 'start', rtlAttr(o.pName), nameLineGap)}

    <g filter="url(#shadow)">
      <rect x="${n(textX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${n(badgeH)}" rx="${n(badgeH / 2)}" fill="${o.prim}" opacity="0.12"/>
    </g>
    <text x="${n(textX + badgeW / 2)}" y="${n(badgeY + badgeH * 0.66)}" font-size="${n(16)}" font-weight="700" fill="${o.prim}" text-anchor="middle" letter-spacing="1">${roleLabel}</text>

    ${infoRowsHtml}

    ${qrEl}

    ${o.showSignature && o.signatureUrl ? `<image x="${n(colSep - 120)}" y="${n(H - 36 - 30)}" width="100" height="30" href="${esc(o.signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.9"/>` : ''}

    ${o.showBarcode ? `<g transform="translate(${n(mg)}, ${n(H - 22)})"><rect width="${n(colSep - mg - 10)}" height="6" fill="#fff"/><g fill="#111">${Array.from({ length: 30 }).map((_, i) => `<rect x="${n(i * ((colSep - mg - 10) / 30))}" y="0" width="${n((colSep - mg - 10) / 60)}" height="6"/>`).join('')}</g><text x="${n((colSep - mg - 10) / 2)}" y="16" font-size="10" fill="${o.muted}" text-anchor="middle">${o.pId}</text></g>` : ''}

    ${o.showWatermark && o.watermarkText ? `<g opacity="0.04" pointer-events="none">
      <text x="${n(W / 2)}" y="${n(H * 0.5)}" font-size="${n(Math.min(W, H) * 0.06)}" font-weight="900"
        fill="${o.prim}" text-anchor="middle" dominant-baseline="middle"
        transform="rotate(-30, ${n(W / 2)}, ${n(H * 0.5)})"
        letter-spacing="6">${esc(o.watermarkText || o.schN)}</text>
    </g>` : ''}
  </svg>`;
}

function buildPortraitBack(W: number, H: number, o: SVGParams): string {
  const mg = 38;
  const hH = 132;
  const contentTop = hH + 24;
  const contentBottom = H - 64;
  const contentHeight = contentBottom - contentTop;
  const leftWidth = Math.round(W * 0.56);
  const rightX = Math.round(mg + leftWidth + 18);
  const rightWidth = W - rightX - mg;
  const infoBoxHeight = Math.round(contentHeight * 0.60);
  const contactBoxY = contentTop + infoBoxHeight + 18;
  const contactBoxHeight = Math.round(contentHeight - infoBoxHeight - 18);

  const backContent = o.showTerms
    ? o.termsText?.trim() || o.backText || 'This ID card is the property of the school. If found, please return to the school office.'
    : 'This ID card is issued for authorized school use only.';
  const impLines = wrapToLines((backContent || '').replace(/\n/g, ' | '), 36);
  const contactParts = [o.schN || '', o.pAddr || '', o.pPhone || '', o.pEmail || ''].filter(Boolean);
  const conLines = wrapToLines(contactParts.join(' | ') || 'School Name', 36);

  const impLineHeight = Math.max(22, Math.min(Math.round((infoBoxHeight - 40) / Math.max(impLines.length, 1)), Math.round(H * 0.032)));
  const impFontSize = Math.max(11, Math.min(Math.round(H * 0.015), Math.round(impLineHeight * 0.65)));
  const conLineHeight = Math.max(18, Math.min(Math.round((contactBoxHeight - 42) / Math.max(conLines.length, 1)), Math.round(H * 0.025)));
  const conFontSize = Math.max(10, Math.min(Math.round(H * 0.013), Math.round(conLineHeight * 0.62)));

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.style}${o.defs}
    <rect width="${W}" height="${H}" fill="${o.bgColor}"/>
    <rect width="${W}" height="${H}" fill="url(#body-grad)"/>
    <circle cx="${n(W * 0.12)}" cy="${n(H * 0.16)}" r="${n(W * 0.32)}" fill="${o.prim}" opacity="0.014"/>
    <circle cx="${n(W * 0.88)}" cy="${n(H * 0.78)}" r="${n(W * 0.22)}" fill="${o.prim}" opacity="0.011"/>
    <rect x="3" y="3" width="${n(W - 6)}" height="${n(H - 6)}" rx="18" fill="none" stroke="${o.border}" stroke-width="1.8" opacity="0.25"/>

    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    <path d="M0 ${n(hH)} Q${n(W * 0.20)} ${n(hH + 8)} ${n(W * 0.50)} ${n(hH + 4)} Q${n(W * 0.80)} ${n(hH)} ${W} ${n(hH)}" fill="${o.prim}" opacity="0.15"/>
    <g transform="translate(${W / 2}, ${n(hH * 0.42)})">
      ${renderWrapped(0, 0, H * 0.028, o.hdrTxt, wrapToLines(o.schN, 30), 'middle', rtlAttr(o.schN), 3)}
    </g>
    <text x="${n(W / 2)}" y="${n(hH * 0.76)}" font-size="${n(H * 0.012)}" fill="${o.hdrTxt}" text-anchor="middle" opacity="0.6" letter-spacing="3">BACK OF ID CARD</text>
    ${watermarkBack(W, H, o.prim, o.schN)}

    <g>
      <rect x="${n(mg - 4)}" y="${n(contentTop - 6)}" width="${n(leftWidth + 12)}" height="${n(infoBoxHeight + 12)}" rx="16" fill="${adj(o.sec, -8)}" opacity="0.38"/>
      <text x="${n(mg)}" y="${n(contentTop + 22)}" font-size="${n(Math.round(H * 0.016))}" font-weight="700" fill="${o.prim}" letter-spacing="1.5">IMPORTANT INFORMATION</text>
      <line x1="${n(mg)}" y1="${n(contentTop + 28)}" x2="${n(mg + leftWidth)}" y2="${n(contentTop + 28)}" stroke="${o.prim}" stroke-width="1" opacity="0.2"/>
      ${impLines.map((line, index) => {
        const y = contentTop + 40 + index * impLineHeight;
        return `<text x="${n(mg + 6)}" y="${n(y)}" font-size="${n(impFontSize)}" fill="${o.dark}"${rtlAttr(line)}>${esc(line)}</text>`;
      }).join('\n')}
    </g>

    <g>
      <rect x="${n(rightX - 8)}" y="${n(contactBoxY - 8)}" width="${n(rightWidth + 16)}" height="${n(contactBoxHeight + 16)}" rx="16" fill="${adj(o.sec, -8)}" opacity="0.34"/>
      <text x="${n(rightX + 8)}" y="${n(contactBoxY + 24)}" font-size="${n(Math.round(H * 0.015))}" font-weight="700" fill="${o.prim}" letter-spacing="1.5">SCHOOL CONTACT</text>
      <line x1="${n(rightX + 8)}" y1="${n(contactBoxY + 30)}" x2="${n(W - mg)}" y2="${n(contactBoxY + 30)}" stroke="${o.prim}" stroke-width="1" opacity="0.2"/>
      ${conLines.map((line, index) => {
        const y = contactBoxY + 48 + index * conLineHeight;
        return `<text x="${n(rightX + 8)}" y="${n(y)}" font-size="${n(conFontSize)}" fill="${o.dark}"${rtlAttr(line)}>${esc(line)}</text>`;
      }).join('\n')}
      <text x="${n(rightX + 8)}" y="${n(contactBoxY + contactBoxHeight - 14)}" font-size="${n(H * 0.014)}" fill="${o.muted}" opacity="0.78">If found, please return to the school office.</text>
    </g>

    ${o.showMedicalInfo && o.pBlood ? `<g>
      <text x="${n(mg)}" y="${n(contentTop + infoBoxHeight + 46)}" font-size="${n(Math.round(H * 0.014))}" font-weight="700" fill="${o.accent}" letter-spacing="1.5">MEDICAL</text>
      <text x="${n(mg + 6)}" y="${n(contentTop + infoBoxHeight + 66)}" font-size="${n(impFontSize)}" fill="${o.dark}">Blood Group: ${esc(o.pBlood)}</text>
    </g>` : ''}

    ${o.showEmergencyInfo && o.pPhone ? `<g>
      <text x="${n(mg)}" y="${n(contentTop + infoBoxHeight + 98)}" font-size="${n(Math.round(H * 0.014))}" font-weight="700" fill="${o.accent}" letter-spacing="1.5">EMERGENCY</text>
      <text x="${n(mg + 6)}" y="${n(contentTop + infoBoxHeight + 118)}" font-size="${n(impFontSize)}" fill="${o.dark}">Phone: ${esc(o.pPhone)}</text>
    </g>` : ''}

    ${o.showSignatory && o.signatureUrl ? `<image x="${n(W / 2 - 50)}" y="${n(H - 58)}" width="100" height="30" href="${esc(o.signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.85"/>
    <text x="${n(W / 2)}" y="${n(H - 22)}" font-size="${n(H * 0.012)}" fill="${o.muted}" text-anchor="middle">Authorized Signatory</text>` : ''}
  </svg>`;
}

function buildLandscapeBack(W: number, H: number, o: SVGParams): string {
  const mg = 44;
  const hH = 102;
  const contentTop = hH + 24;
  const contentBottom = H - 50;
  const contentHeight = contentBottom - contentTop;
  const leftWidth = Math.round((W - mg * 2 - 28) * 0.54);
  const rightX = mg + leftWidth + 28;
  const rightWidth = W - rightX - mg;
  const infoBoxHeight = Math.round(contentHeight * 0.72);
  const contactBoxY = contentTop + infoBoxHeight + 18;
  const contactBoxHeight = Math.round(contentHeight - infoBoxHeight - 18);

  const backContent = o.showTerms
    ? o.termsText?.trim() || o.backText || 'This ID card is the property of the school. If found, please return to the school office.'
    : 'This ID card is issued for authorized school use only.';
  const impLines = wrapToLines((backContent || '').replace(/\n/g, ' | '), 44);
  const contactParts = [o.schN || '', o.pAddr || '', o.pPhone || '', o.pEmail || ''].filter(Boolean);
  const conLines = wrapToLines(contactParts.join(' | ') || 'School Name', 44);

  const impLineHeight = Math.max(22, Math.min(Math.round((infoBoxHeight - 32) / Math.max(impLines.length, 1)), Math.round(H * 0.045)));
  const impFontSize = Math.max(12, Math.min(Math.round(H * 0.018), Math.round(impLineHeight * 0.62)));
  const conLineHeight = Math.max(20, Math.min(Math.round((contactBoxHeight - 40) / Math.max(conLines.length, 1)), Math.round(H * 0.04)));
  const conFontSize = Math.max(11, Math.min(Math.round(H * 0.015), Math.round(conLineHeight * 0.62)));

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.style}${o.defs}
    <rect width="${W}" height="${H}" fill="${o.bgColor}"/>
    <rect width="${W}" height="${H}" fill="url(#body-grad)"/>
    <circle cx="${n(W * 0.08)}" cy="${n(H * 0.30)}" r="${n(H * 0.42)}" fill="${o.prim}" opacity="0.015"/>
    <circle cx="${n(W * 0.92)}" cy="${n(H * 0.70)}" r="${n(H * 0.28)}" fill="${o.prim}" opacity="0.011"/>
    <rect x="3" y="3" width="${n(W - 6)}" height="${n(H - 6)}" rx="14" fill="none" stroke="${o.border}" stroke-width="1.8" opacity="0.25"/>

    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    <path d="M0 ${n(hH)} Q${n(W * 0.15)} ${n(hH + 6)} ${n(W * 0.50)} ${n(hH + 3)} Q${n(W * 0.85)} ${n(hH - 2)} ${W} ${n(hH)}" fill="${o.prim}" opacity="0.12"/>
    <g transform="translate(${W / 2}, ${n(hH * 0.40)})">
      ${renderWrapped(0, 0, H * 0.052, o.hdrTxt, wrapToLines(o.schN, 26).slice(0, 2), 'middle', rtlAttr(o.schN), 3)}
    </g>
    <text x="${n(W / 2)}" y="${n(hH * 0.76)}" font-size="${n(H * 0.028)}" fill="${o.hdrTxt}" text-anchor="middle" opacity="0.6" letter-spacing="4">BACK OF ID CARD</text>
    ${watermarkBack(W, H, o.prim, o.schN)}

    <g>
      <rect x="${n(mg - 4)}" y="${n(contentTop - 6)}" width="${n(leftWidth + 12)}" height="${n(infoBoxHeight + 12)}" rx="14" fill="${adj(o.sec, -8)}" opacity="0.36"/>
      <text x="${n(mg)}" y="${n(contentTop + 24)}" font-size="${n(Math.round(H * 0.032))}" font-weight="700" fill="${o.prim}" letter-spacing="1.5">TERMS & INFO</text>
      <line x1="${n(mg)}" y1="${n(contentTop + 30)}" x2="${n(mg + leftWidth)}" y2="${n(contentTop + 30)}" stroke="${o.prim}" stroke-width="1" opacity="0.2"/>
      ${impLines.map((line, index) => {
        const y = contentTop + 46 + index * impLineHeight;
        return `<text x="${n(mg + 6)}" y="${n(y)}" font-size="${n(impFontSize)}" fill="${o.dark}"${rtlAttr(line)}>${esc(line)}</text>`;
      }).join('\n')}
      ${o.showMedicalInfo && o.pBlood ? `
      <text x="${n(mg)}" y="${n(contentTop + infoBoxHeight - 14)}" font-size="${n(Math.round(H * 0.016))}" font-weight="700" fill="${o.accent}" letter-spacing="1.5">MEDICAL</text>
      <text x="${n(mg + 6)}" y="${n(contentTop + infoBoxHeight + 6)}" font-size="${n(impFontSize)}" fill="${o.dark}">Blood Group: ${esc(o.pBlood)}</text>
      ` : ''}
    </g>

    <g>
      <rect x="${n(rightX - 8)}" y="${n(contactBoxY - 8)}" width="${n(rightWidth + 16)}" height="${n(contactBoxHeight + 16)}" rx="14" fill="${adj(o.sec, -8)}" opacity="0.34"/>
      <text x="${n(rightX + 10)}" y="${n(contactBoxY + 24)}" font-size="${n(Math.round(H * 0.028))}" font-weight="700" fill="${o.prim}" letter-spacing="1.5">SCHOOL CONTACT</text>
      <line x1="${n(rightX + 10)}" y1="${n(contactBoxY + 30)}" x2="${n(W - mg)}" y2="${n(contactBoxY + 30)}" stroke="${o.prim}" stroke-width="1" opacity="0.2"/>
      ${conLines.map((line, index) => {
        const y = contactBoxY + 52 + index * conLineHeight;
        return `<text x="${n(rightX + 10)}" y="${n(y)}" font-size="${n(conFontSize)}" fill="${o.dark}"${rtlAttr(line)}>${esc(line)}</text>`;
      }).join('\n')}
      <text x="${n(rightX + 10)}" y="${n(contactBoxY + contactBoxHeight - 12)}" font-size="${n(H * 0.015)}" fill="${o.muted}" opacity="0.78">Return to school if found.</text>
    </g>

    ${o.showEmergencyInfo && o.pPhone ? `<g>
      <text x="${n(rightX + 10)}" y="${n(contentTop + infoBoxHeight + 34)}" font-size="${n(Math.round(H * 0.016))}" font-weight="700" fill="${o.accent}" letter-spacing="1.5">EMERGENCY</text>
      <text x="${n(rightX + 10)}" y="${n(contentTop + infoBoxHeight + 54)}" font-size="${n(impFontSize)}" fill="${o.dark}">Phone: ${esc(o.pPhone)}</text>
    </g>` : ''}

    ${o.showSignatory && o.signatureUrl ? `<image x="${n(W / 2 - 50)}" y="${n(H - 44)}" width="100" height="26" href="${esc(o.signatureUrl)}" preserveAspectRatio="xMidYMid slice" opacity="0.85"/>
    <text x="${n(W / 2)}" y="${n(H - 16)}" font-size="${n(H * 0.016)}" fill="${o.muted}" text-anchor="middle">Authorized Signatory</text>` : ''}
  </svg>`;
}
