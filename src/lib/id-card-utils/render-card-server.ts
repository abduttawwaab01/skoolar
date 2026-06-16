import { Resvg } from '@resvg/resvg-wasm';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from './geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from './arabic-font-data';
import { ensureResvgInit } from './init-resvg';
import sharp from 'sharp';
import { esc, n, adj, contrast, hasArabic, rtlAttr, wrapToLines, fitName, renderWrapped } from './formatters';
import { MM, PW, PH, LW, LH } from './constants';

export interface RenderCardOptions {
  person?: any;
  colors: { primary: string; secondary: string; accent?: string; text?: string; textSecondary?: string; headerBg?: string; bg?: string; gradientFrom?: string; gradientTo?: string };
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

export async function renderIDCard(person: any, options: RenderCardOptions): Promise<Buffer> {
  await ensureResvgInit();

  const {
    colors,
    showPhoto = true, showLogo = true, showQR = true, showBarcode = false,
    showSignature = true, showWatermark = true, showMotto = true,
    showExpiryDate = false, showIssueDate = true,
    orientation = 'landscape', photoUrl = null, qrData = null,
    isBack = false, role = 'STUDENT', backText = '',
    showTerms = true, termsText = '',
    issueDate = null, expiryDate = null, signatureUrl = null,
    watermarkText = null, schoolLogo = null, schoolName = '', motto = '',
    showMedicalInfo = false, showEmergencyInfo = false,
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
  const bg = colors.bg || '#ffffff';
  const primD = adj(prim, -25);
  const border = adj(sec, -25);
  const lightBg = adj(hdrBg, 120);

  const pType = person.type || (role === 'STUDENT' ? 'student' : 'staff');
  const rawName = person.name || 'Unknown';
  const rawId = person.displayId || person.admissionNo || person.employeeNo || 'N/A';
  const rawClass = person.class || person.className || '';
  const rawSection = person.section || '';
  const rawDept = person.department || '';
  const rawGender = person.gender || '';
  const rawPhone = person.phone || '';
  const rawDOB = person.dateOfBirth || '';
  const rawHouse = person.house || '';
  const rawSession = person.academicSession || '';
  const rawDesignation = person.designation || '';
  const rawPosition = person.position || '';
  const schN = schoolName || person._school?.name || 'School Name';
  const schMotto = motto || person._school?.motto || '';
  const schLogo = schoolLogo || person._school?.logo || null;
  const inits = esc(rawName.split(' ').map(x => x[0] || '').join('').slice(0, 2).toUpperCase());

  const FF = `'${ARABIC_FONT_FAMILY}', '${GEIST_FONT_FAMILY}', 'Segoe UI', Arial, sans-serif`;

  const defs = `<defs>
    <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primD}"/>
      <stop offset="100%" stop-color="${hdrBg}"/>
    </linearGradient>
    <linearGradient id="hgv" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${primD}"/>
      <stop offset="100%" stop-color="${hdrBg}"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.12"/>
    </filter>
    <style>
      text { font-family: ${FF}; }
      .d { fill: ${dark}; }
      .m { fill: ${muted}; }
      .p { fill: ${prim}; }
      .w { fill: ${contrast(hdrBg)}; }
      .b { font-weight: 700; }
      .sb { font-weight: 600; }
    </style>
  </defs>`;

  let phBuf: Buffer | null = null;
  if (showPhoto && photoUrl) {
    try {
      if (photoUrl.startsWith('data:')) {
        const m = /^data:([^;]+);base64,(.+)$/i.exec(photoUrl);
        if (m) phBuf = Buffer.from(m[2], 'base64');
      } else {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skoolar.org';
        const url = photoUrl.startsWith('//') ? `https:${photoUrl}` : photoUrl.startsWith('http') ? photoUrl : `${baseUrl}${photoUrl}`;
        const mod = url.startsWith('https') ? await import('node:https') : await import('node:http');
        phBuf = await new Promise<Buffer>((resolve, reject) => {
          const req = (mod as any).get(url, { timeout: 8000 }, (res: any) => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
          });
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
          req.on('error', reject);
        });
        if (!phBuf || phBuf.length > 5 * 1024 * 1024) phBuf = null;
      }
    } catch { /* photo failed */ }
  }

  const svg = port
    ? renderPortrait(W, H, { isBack, role, pType, rawName, rawId, rawClass, rawSection, rawDept, rawGender, rawPhone, rawDOB, rawHouse, rawSession, rawDesignation, rawPosition, schN, schMotto, schLogo, inits, qrB64: qrData || '', showPhoto, showQR, showBarcode, showSignature, showLogo, showWatermark, showMotto, showExpiryDate, showIssueDate, backText, showTerms, termsText, issueDate, expiryDate, signatureUrl, watermarkText, showMedicalInfo, showEmergencyInfo, showSignatory, prim, primD, sec, dark, muted, hdrBg, bg, accent, border, lightBg, FF, defs })
    : renderLandscape(W, H, { isBack, role, pType, rawName, rawId, rawClass, rawSection, rawDept, rawGender, rawPhone, rawDOB, rawHouse, rawSession, rawDesignation, rawPosition, schN, schMotto, schLogo, inits, qrB64: qrData || '', showPhoto, showQR, showBarcode, showSignature, showLogo, showWatermark, showMotto, showExpiryDate, showIssueDate, backText, showTerms, termsText, issueDate, expiryDate, signatureUrl, watermarkText, showMedicalInfo, showEmergencyInfo, showSignatory, prim, primD, sec, dark, muted, hdrBg, bg, accent, border, lightBg, FF, defs });

  const geistBytes = Buffer.from(GEIST_REGULAR_BASE64, 'base64');
  const arabicBytes = Buffer.from(ARABIC_FONT_BASE64, 'base64');

  try {
    const resvg = new Resvg(svg, {
      background: 'white',
      fitTo: { mode: 'width', value: W },
      font: { fontBuffers: [new Uint8Array(arabicBytes), new Uint8Array(geistBytes)], defaultFontFamily: GEIST_FONT_FAMILY },
    });
    let png = Buffer.from(resvg.render().asPng());

    if (phBuf && showPhoto) {
      try {
        const r = port ? Math.round(W * 0.088) : Math.round(H * 0.22);
        const cx = port ? Math.round(W / 2) : Math.round(H * 0.26);
        const cy = port ? Math.round(H * 0.30) : Math.round(H * 0.5);
        const d = r * 2;
        const circle = await sharp(Buffer.from(`<svg><circle cx="${d/2}" cy="${d/2}" r="${r}" fill="white"/></svg>`)).resize(d, d).png().toBuffer();
        const photo = await sharp(phBuf).resize(d, d, { fit: 'cover' }).png().toBuffer();
        const masked = await sharp(photo).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer();
        png = Buffer.from(await sharp(png).composite([{ input: masked, top: cy - r, left: cx - r }]).png().toBuffer());
      } catch { /* photo composite failed */ }
    }

    return png;
  } catch (err) {
    console.error('resvg error:', err);
    throw new Error(`ID card render failed: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
}

interface CardVars {
  isBack: boolean; role: string; pType: string;
  rawName: string; rawId: string; rawClass: string; rawSection: string;
  rawDept: string; rawGender: string; rawPhone: string; rawDOB: string;
  rawHouse: string; rawSession: string; rawDesignation: string; rawPosition: string;
  schN: string; schMotto: string; schLogo: string | null; inits: string;
  qrB64: string;
  showPhoto: boolean; showQR: boolean; showBarcode: boolean; showSignature: boolean;
  showLogo: boolean; showWatermark: boolean; showMotto: boolean;
  showExpiryDate: boolean; showIssueDate: boolean;
  backText: string; showTerms: boolean; termsText: string;
  issueDate: string | null; expiryDate: string | null;
  signatureUrl: string | null; watermarkText: string | null;
  showMedicalInfo: boolean; showEmergencyInfo: boolean; showSignatory: boolean;
  prim: string; primD: string; sec: string; dark: string; muted: string;
  hdrBg: string; bg: string; accent: string; border: string; lightBg: string;
  FF: string; defs: string;
}

function photoEl(cx: number, cy: number, r: number, prim: string, muted: string, inits: string): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 3)}" fill="${prim}" opacity="0.1"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#fff" stroke="${prim}" stroke-width="2" opacity="0.4"/>
    <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r - 2)}" fill="${prim}" opacity="0.03"/>
    <text x="${n(cx)}" y="${n(cy)}" font-size="${n(r * 0.65)}" font-weight="700" fill="${prim}" opacity="0.3"
      text-anchor="middle" dominant-baseline="central">${inits}</text>`;
}

function renderPortrait(W: number, H: number, o: CardVars): string {
  if (o.isBack) return renderPortraitBack(W, H, o);
  const hH = Math.round(H * 0.16);
  const mg = Math.round(W * 0.07);
  const pr = Math.round(W * 0.17);
  const pcX = Math.round(W / 2);
  const pcY = hH + pr + Math.round(W * 0.05);
  const nameY = pcY + pr + Math.round(W * 0.03);
  const nameF = Math.round(H * 0.040);
  const badgeY = nameY + Math.round(nameF * 0.4);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.defs}<rect width="${W}" height="${H}" fill="${o.bg}"/>
    <rect x="2" y="2" width="${n(W-4)}" height="${n(H-4)}" rx="${n(Math.round(W*0.035))}" fill="none" stroke="${o.border}" stroke-width="2" opacity="0.3"/>
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    ${o.schLogo ? `<image x="${n(mg)}" y="${n(Math.round(hH*0.12))}" width="${n(Math.round(hH*0.65))}" height="${n(Math.round(hH*0.65))}" href="${esc(o.schLogo)}" preserveAspectRatio="xMidYMid slice"/>` : ''}
    <text x="${n(W/2)}" y="${n(Math.round(hH*0.42))}" text-anchor="middle" font-size="${n(Math.round(H*0.030))}" font-weight="700" fill="${contrast(o.hdrBg)}">${esc(o.schN)}</text>
    ${o.showMotto && o.schMotto ? `<text x="${n(W/2)}" y="${n(Math.round(hH*0.70))}" text-anchor="middle" font-size="${n(Math.round(H*0.014))}" fill="${contrast(o.hdrBg)}" opacity="0.7" font-style="italic">${esc(o.schMotto)}</text>` : ''}
    ${o.showPhoto ? photoEl(pcX, pcY, pr, o.prim, o.muted, o.inits) : ''}
    <text x="${n(W/2)}" y="${n(nameY)}" text-anchor="middle" font-size="${n(nameF)}" font-weight="700" fill="${o.dark}">${esc(o.rawName)}</text>
    ${o.watermarkText ? `<text x="${n(W/2)}" y="${n(Math.round(H*0.55))}" text-anchor="middle" font-size="${n(Math.round(W*0.07))}" font-weight="900" fill="${o.prim}" opacity="0.04" transform="rotate(-30,${n(W/2)},${n(Math.round(H*0.55))})" letter-spacing="3">${esc(o.watermarkText)}</text>` : ''}
    <rect x="${n(Math.round(W*0.25))}" y="${n(badgeY)}" width="${n(Math.round(W*0.50))}" height="${n(Math.round(H*0.035))}" rx="${n(Math.round(H*0.017))}" fill="${o.prim}" opacity="0.1"/>
    <text x="${n(W/2)}" y="${n(badgeY + Math.round(H*0.024))}" text-anchor="middle" font-size="${n(Math.round(H*0.020))}" font-weight="700" fill="${o.prim}">${o.pType === 'student' ? 'STUDENT' : o.pType === 'teacher' ? 'TEACHER' : o.role || 'STAFF'}</text>
  </svg>`;
}

function renderLandscape(W: number, H: number, o: CardVars): string {
  if (o.isBack) return renderLandscapeBack(W, H, o);
  const hH = Math.round(H * 0.19);
  const mg = Math.round(H * 0.12);
  const pr = Math.round(H * 0.22);
  const pcX = mg + pr + Math.round(W * 0.02);
  const pcY = hH + Math.round((H - hH) / 2);
  const nameY = pcY - Math.round(H * 0.22);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.defs}<rect width="${W}" height="${H}" fill="${o.bg}"/>
    <rect x="2" y="2" width="${n(W-4)}" height="${n(H-4)}" rx="${n(Math.round(H*0.06))}" fill="none" stroke="${o.border}" stroke-width="2" opacity="0.3"/>
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    ${o.schLogo ? `<image x="${n(mg)}" y="${n(Math.round(hH*0.10))}" width="${n(Math.round(hH*0.60))}" height="${n(Math.round(hH*0.60))}" href="${esc(o.schLogo)}" preserveAspectRatio="xMidYMid slice"/>` : ''}
    <text x="${n(Math.round(W*0.38))}" y="${n(Math.round(hH*0.42))}" font-size="${n(Math.round(H*0.050))}" font-weight="700" fill="${contrast(o.hdrBg)}">${esc(o.schN)}</text>
    ${o.showMotto && o.schMotto ? `<text x="${n(Math.round(W*0.38))}" y="${n(Math.round(hH*0.72))}" font-size="${n(Math.round(H*0.025))}" fill="${contrast(o.hdrBg)}" opacity="0.7" font-style="italic">${esc(o.schMotto)}</text>` : ''}
    <line x1="${n(Math.round(W*0.45))}" y1="${n(hH+Math.round(H*0.04))}" x2="${n(Math.round(W*0.45))}" y2="${n(H-Math.round(H*0.06))}" stroke="${o.border}" stroke-width="1" opacity="0.2"/>
    ${o.showPhoto ? photoEl(pcX, pcY, pr, o.prim, o.muted, o.inits) : ''}
    <text x="${n(pcX+pr+Math.round(W*0.02))}" y="${n(nameY)}" font-size="${n(Math.round(H*0.055))}" font-weight="700" fill="${o.dark}">${esc(o.rawName)}</text>
    ${o.watermarkText ? `<text x="${n(W/2)}" y="${n(H/2)}" text-anchor="middle" font-size="${n(Math.round(H*0.09))}" font-weight="900" fill="${o.prim}" opacity="0.04" transform="rotate(-30,${n(W/2)},${n(H/2)})" letter-spacing="4">${esc(o.watermarkText)}</text>` : ''}
    <rect x="${n(pcX+pr+Math.round(W*0.02))}" y="${n(nameY+Math.round(H*0.04))}" width="${n(Math.round(W*0.22))}" height="${n(Math.round(H*0.045))}" rx="${n(Math.round(H*0.022))}" fill="${o.prim}" opacity="0.1"/>
    <text x="${n(pcX+pr+Math.round(W*0.13))}" y="${n(nameY+Math.round(H*0.07))}" text-anchor="middle" font-size="${n(Math.round(H*0.030))}" font-weight="700" fill="${o.prim}">${o.pType === 'student' ? 'STUDENT' : o.pType === 'teacher' ? 'TEACHER' : o.role || 'STAFF'}</text>
  </svg>`;
}

function renderPortraitBack(W: number, H: number, o: CardVars): string {
  const hH = Math.round(H * 0.16);
  const mg = Math.round(W * 0.07);
  const txt = o.showTerms ? (o.termsText || o.backText || 'This ID card is the property of the school. If found, please return to the school office.') : 'Issued for authorized school use only.';
  const lines = wrapToLines(txt, 24);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.defs}<rect width="${W}" height="${H}" fill="${o.bg}"/>
    <rect x="2" y="2" width="${n(W-4)}" height="${n(H-4)}" rx="${n(Math.round(W*0.035))}" fill="none" stroke="${o.border}" stroke-width="2" opacity="0.3"/>
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hgv)"/>
    <text x="${n(W/2)}" y="${n(Math.round(hH*0.50))}" text-anchor="middle" font-size="${n(Math.round(H*0.028))}" font-weight="700" fill="${contrast(o.hdrBg)}">${esc(o.schN)}</text>
    <text x="${n(W/2)}" y="${n(Math.round(hH*0.78))}" text-anchor="middle" font-size="${n(Math.round(H*0.013))}" fill="${contrast(o.hdrBg)}" opacity="0.6" letter-spacing="2">BACK OF ID CARD</text>
    <text x="${n(mg)}" y="${n(hH+Math.round(H*0.04))}" font-size="${n(Math.round(H*0.016))}" font-weight="700" fill="${o.prim}">TERMS & CONDITIONS</text>
    <line x1="${n(mg)}" y1="${n(hH+Math.round(H*0.05))}" x2="${n(W-mg)}" y2="${n(hH+Math.round(H*0.05))}" stroke="${o.prim}" stroke-width="1" opacity="0.2"/>
    ${lines.map((l, i) => `<text x="${n(mg)}" y="${n(hH+Math.round(H*0.07)+i*Math.round(H*0.025))}" font-size="${n(Math.round(H*0.015))}" fill="${o.dark}">${esc(l)}</text>`).join('')}
  </svg>`;
}

function renderLandscapeBack(W: number, H: number, o: CardVars): string {
  const hH = Math.round(H * 0.19);
  const mg = Math.round(H * 0.10);
  const txt = o.showTerms ? (o.termsText || o.backText || 'This ID card is the property of the school. If found, please return to the school office.') : 'Issued for authorized school use only.';
  const lines = wrapToLines(txt, 40);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${o.defs}<rect width="${W}" height="${H}" fill="${o.bg}"/>
    <rect x="2" y="2" width="${n(W-4)}" height="${n(H-4)}" rx="${n(Math.round(H*0.06))}" fill="none" stroke="${o.border}" stroke-width="2" opacity="0.3"/>
    <rect x="0" y="0" width="${W}" height="${n(hH)}" fill="url(#hg)"/>
    <text x="${n(W/2)}" y="${n(Math.round(hH*0.48))}" text-anchor="middle" font-size="${n(Math.round(H*0.050))}" font-weight="700" fill="${contrast(o.hdrBg)}">${esc(o.schN)}</text>
    <text x="${n(W/2)}" y="${n(Math.round(hH*0.78))}" text-anchor="middle" font-size="${n(Math.round(H*0.024))}" fill="${contrast(o.hdrBg)}" opacity="0.6" letter-spacing="3">BACK OF ID CARD</text>
    <text x="${n(mg)}" y="${n(hH+Math.round(H*0.08))}" font-size="${n(Math.round(H*0.032))}" font-weight="700" fill="${o.prim}">TERMS & CONDITIONS</text>
    <line x1="${n(mg)}" y1="${n(hH+Math.round(H*0.10))}" x2="${n(W-mg)}" y2="${n(hH+Math.round(H*0.10))}" stroke="${o.prim}" stroke-width="1" opacity="0.2"/>
    ${lines.map((l, i) => `<text x="${n(mg)}" y="${n(hH+Math.round(H*0.14)+i*Math.round(H*0.040))}" font-size="${n(Math.round(H*0.028))}" fill="${o.dark}">${esc(l)}</text>`).join('')}
  </svg>`;
}
