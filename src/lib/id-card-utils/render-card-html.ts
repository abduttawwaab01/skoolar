import puppeteer, { Browser, Page } from 'puppeteer';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from './geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from './arabic-font-data';
import { esc, contrast } from './formatters';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-font-subpixel-positioning',
      '--font-render-hinting=none',
    ],
  });
  return browserInstance;
}

async function safeClose(page: Page): Promise<void> {
  try { await page.close(); } catch { /* ignore */ }
}

const GEIST_FONT_CSS = `
@font-face {
  font-family: '${GEIST_FONT_FAMILY}';
  src: url(data:font/woff2;base64,${GEIST_REGULAR_BASE64}) format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: '${ARABIC_FONT_FAMILY}';
  src: url(data:font/woff2;base64,${ARABIC_FONT_BASE64}) format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
`;

function cssColor(hex: string): string {
  return hex || '#059669';
}

function fontFamily(): string {
  return `'${ARABIC_FONT_FAMILY}', '${GEIST_FONT_FAMILY}', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
}

function hdrTextColor(bg: string): string {
  return contrast(bg);
}

function adj(c: string, a: number): string {
  const h = c.replace('#', '');
  const cl = (x: number) => Math.max(0, Math.min(255, x));
  const rv = cl(parseInt(h.slice(0, 2), 16) + a);
  const gv = cl(parseInt(h.slice(2, 4), 16) + a);
  const bv = cl(parseInt(h.slice(4, 6), 16) + a);
  return `#${rv.toString(16).padStart(2, '0')}${gv.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
}

export interface RenderCardOptions {
  person?: any;
  colors: {
    primary: string; secondary: string; accent?: string; text?: string;
    textSecondary?: string; headerBg?: string; bg?: string;
    gradientFrom?: string; gradientTo?: string;
  };
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

function fmtDateFriendly(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d || ''; }
}

export async function renderIDCardHTML(
  person: any,
  options: RenderCardOptions
): Promise<Buffer> {
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
    showTerms = true,
    orientation = 'landscape',
    photoUrl = null,
    qrData = null,
    isBack = false,
    role = 'STUDENT',
    backText = '',
    issueDate = null,
    expiryDate = null,
    signatureUrl = null,
    watermarkText = null,
    schoolLogo = null,
    schoolName = '',
    motto = '',
  } = options;

  const port = orientation === 'portrait';
  const pType = person.type || (role === 'STUDENT' ? 'student' : 'staff');
  const rawName = person.name || 'Unknown';
  const rawId = person.displayId || person.admissionNo || person.employeeNo || 'N/A';
  const rawClass = person.class || person.className || '';
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
  const schN = schoolName || person._school?.name || 'School Name';
  const schMotto = motto || person._school?.motto || '';
  const schLogo = schoolLogo || person._school?.logo || null;
  const inits = rawName.split(' ').map((x: string) => x[0] || '').join('').slice(0, 2).toUpperCase();

  const prim = cssColor(colors.primary || '#059669');
  const primD = adj(prim, -25);
  const sec = cssColor(colors.secondary || '#ffffff');
  const accent = cssColor(colors.accent || '#fbbf24');
  const dark = cssColor(colors.text || '#1e293b');
  const muted = cssColor(colors.textSecondary || '#64748b');
  const hdrBg = cssColor(colors.headerBg || prim);
  const bgColor = cssColor(colors.bg || '#ffffff');
  const hdrTxt = hdrTextColor(hdrBg);

  const cardW = port ? 53.98 : 85.6;
  const cardH = port ? 85.6 : 53.98;
  const cr = 3.5;

  let photoB64 = '';
  if (showPhoto && photoUrl) {
    try {
      if (photoUrl.startsWith('data:')) {
        photoB64 = photoUrl;
      } else {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skoolar.org';
        const url = photoUrl.startsWith('//') ? `https:${photoUrl}` :
                    photoUrl.startsWith('http') ? photoUrl : `${baseUrl}${photoUrl}`;
        const mod = url.startsWith('https') ? await import('node:https') : await import('node:http');
        const buf = await new Promise<Buffer>((resolve, reject) => {
          const req = (mod as any).get(url, { timeout: 8000 }, (res: any) => {
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
        if (buf.length > 0 && buf.length <= 5 * 1024 * 1024) {
          photoB64 = `data:image/png;base64,${buf.toString('base64')}`;
        }
      }
    } catch { /* photo failed */ }
  }

  const qrB64 = qrData || '';
  const roleLabel = pType === 'student' ? 'STUDENT' : pType === 'teacher' ? 'TEACHER' : role || 'STAFF';

  const vars: CardHTMLVars = {
    prim, primD, sec, accent, dark, muted, hdrBg, hdrTxt, bgColor, gradFrom: prim, gradTo: adj(prim, 35),
    schN, schMotto, schLogo, showLogo, showPhoto, showBarcode, showSignature, showMotto, showIssueDate, showExpiryDate, showWatermark,
    signatureUrl, issueDate, expiryDate, watermarkText: watermarkText || schN, pName: rawName, pId: rawId, pClass: rawClass, pSection: rawSection,
    pDept: rawDept, pGend: rawGender, pPhone: rawPhone, pEmail: rawEmail, pAddr: rawAddress, pBlood: rawBlood, pDOB: rawDOB, pHouse: rawHouse,
    pSession: rawSession, pDesignation: rawDesignation, pPosition: rawPosition, pType, roleLabel, inits, photoB64, qrB64, showQR,
    backText, showTerms, showMedicalInfo: !!options.showMedicalInfo, showEmergencyInfo: !!options.showEmergencyInfo,
    rawBlood, rawPhone, rawAddress, rawEmail, waterText: watermarkText || schN, showSignatory: !!options.showSignatory
  };

  let bodyHTML = '';
  if (isBack) {
    bodyHTML = port ? buildPortraitBackHTML(vars) : buildLandscapeBackHTML(vars);
  } else {
    bodyHTML = port ? buildPortraitFrontHTML(vars) : buildLandscapeFrontHTML(vars);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
${GEIST_FONT_CSS}
html, body {
  width: ${cardW}mm;
  height: ${cardH}mm;
  overflow: hidden;
  background: ${bgColor};
  font-family: ${fontFamily()};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
}

.id-card {
  width: ${cardW}mm;
  height: ${cardH}mm;
  position: relative;
  overflow: hidden;
  background: ${bgColor};
  border-radius: ${cr}mm;
  box-shadow: 0 0 0 0.5px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
}

${bodyHTML}
</style>
</head>
<body>
<div class="id-card"></div>
</body>
</html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();

  const dpi = 300;
  const pxW = Math.round((cardW / 25.4) * dpi);
  const pxH = Math.round((cardH / 25.4) * dpi);

  await page.setViewport({
    width: pxW,
    height: pxH,
    deviceScaleFactor: 2,
  });

  try {
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 20000,
    });
    await page.waitForSelector('.id-card', { timeout: 10000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
  } catch (err) {
    await safeClose(page);
    throw err;
  }

  const element = await page.$('.id-card');
  if (!element) {
    await safeClose(page);
    throw new Error('Card element not found');
  }

  const clip = await element.boundingBox();
  if (!clip) {
    await safeClose(page);
    throw new Error('Could not get card bounding box');
  }

  const screenshot = await page.screenshot({
    type: 'png',
    clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height },
    optimizeForSpeed: false,
  });

  await safeClose(page);

  if (screenshot.length < 100) {
    throw new Error('Screenshot too small, rendering likely failed');
  }

  return Buffer.from(screenshot);
}

interface CardHTMLVars {
  prim: string; primD: string; sec: string; accent: string;
  dark: string; muted: string; hdrBg: string; hdrTxt: string;
  bgColor: string; gradFrom: string; gradTo: string;
  schN: string; schMotto: string; schLogo: string | null;
  showLogo: boolean; showPhoto?: boolean; showBarcode?: boolean;
  showSignature?: boolean; showMotto?: boolean;
  showIssueDate?: boolean; showExpiryDate?: boolean;
  showWatermark?: boolean; showQR?: boolean;
  signatureUrl?: string | null;
  issueDate?: string | null; expiryDate?: string | null;
  watermarkText?: string | null;
  pName?: string; pId?: string; pClass?: string; pSection?: string;
  pDept?: string; pGend?: string; pPhone?: string; pEmail?: string;
  pAddr?: string; pBlood?: string; pDOB?: string; pHouse?: string;
  pSession?: string; pDesignation?: string; pPosition?: string;
  pType?: string; roleLabel?: string; inits?: string;
  photoB64?: string; qrB64?: string;
  backText?: string; showTerms?: boolean;
  showMedicalInfo?: boolean; showEmergencyInfo?: boolean;
  showSchoolInfo?: boolean; showSignatory?: boolean;
  rawBlood?: string; rawPhone?: string; rawAddress?: string; rawEmail?: string;
  waterText?: string;
}

function buildLandscapeFrontHTML(v: CardHTMLVars): string {
  const hasPhoto = v.showPhoto && v.photoB64;
  const hasQR = v.showQR && v.qrB64;

  return `
<style>
.bg-pattern {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background-image: radial-gradient(${v.prim}08 1px, transparent 1px);
  background-size: 4mm 4mm; opacity: 0.5; z-index: 0;
}
.accent-stripe {
  position: absolute; top: 0; left: 0; width: 4mm; bottom: 0;
  background: linear-gradient(180deg, ${v.primD}, ${v.prim});
  z-index: 1;
}
.header {
  position: absolute; top: 0; left: 4mm; right: 0; height: 16mm;
  display: flex; align-items: center; padding: 0 4mm; z-index: 2;
  background: linear-gradient(90deg, ${v.bgColor} 0%, rgba(255,255,255,0) 100%);
}
.header-logo img {
  width: 10mm; height: 10mm; border-radius: 2mm; object-fit: contain;
  margin-right: 3mm; box-shadow: 0 1mm 2mm rgba(0,0,0,0.05);
}
.header-text { flex: 1; }
.header-sch-name { color: ${v.dark}; font-weight: 900; font-size: 3.5mm; line-height: 1.1; text-transform: uppercase; }
.header-sch-motto { color: ${v.muted}; font-size: 1.6mm; font-style: italic; opacity: 0.8; }

.body {
  position: absolute; top: 16mm; left: 4mm; right: 0; bottom: 6mm;
  display: flex; align-items: center; padding: 0 4mm; gap: 5mm; z-index: 2;
}
.photo-container {
  width: 24mm; height: 28mm; border-radius: 3mm; overflow: hidden;
  border: 1.5px solid ${v.prim}20; background: ${v.prim}05;
  box-shadow: 0 2mm 4mm rgba(0,0,0,0.08); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.photo-container img { width: 100%; height: 100%; object-fit: cover; }
.photo-placeholder { font-size: 8mm; font-weight: 900; color: ${v.prim}; opacity: 0.2; }

.info-container { flex: 1; display: flex; flex-direction: column; gap: 1.5mm; }
.person-name { color: ${v.dark}; font-weight: 900; font-size: 4.8mm; line-height: 1; margin-bottom: 0.5mm; }
.person-role {
  background: ${v.prim}; color: white; padding: 0.6mm 2.5mm;
  border-radius: 1mm; font-size: 1.8mm; font-weight: 800;
  display: inline-block; align-self: flex-start; text-transform: uppercase; letter-spacing: 0.5px;
}
.details-grid { display: grid; grid-template-columns: auto 1fr; column-gap: 3mm; row-gap: 0.8mm; margin-top: 1.5mm; }
.detail-label { color: ${v.muted}; font-size: 1.5mm; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
.detail-value { color: ${v.dark}; font-size: 1.8mm; font-weight: 600; }

.qr-container { width: 14mm; height: 14mm; flex-shrink: 0; }
.qr-container img { width: 100%; height: 100%; border-radius: 1mm; }

.footer {
  position: absolute; bottom: 0; left: 4mm; right: 0; height: 6mm;
  display: flex; align-items: center; justify-content: space-between; padding: 0 4mm; z-index: 2;
  border-top: 0.5px solid ${v.prim}10;
}
.footer-id { color: ${v.muted}; font-size: 1.6mm; font-weight: 700; letter-spacing: 1px; }
.blood-badge { background: ${v.accent}; color: #000; padding: 0.5mm 1.5mm; border-radius: 1mm; font-size: 1.6mm; font-weight: 900; }

.watermark {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg);
  font-size: 12mm; font-weight: 900; color: ${v.prim}; opacity: 0.03; pointer-events: none;
  white-space: nowrap; text-transform: uppercase; letter-spacing: 2mm;
}
</style>
<div class="bg-pattern"></div>
<div class="accent-stripe"></div>
${v.showWatermark ? `<div class="watermark">${esc(v.waterText || '')}</div>` : ''}

<div class="header">
  ${v.showLogo && v.schLogo ? `<div class="header-logo"><img src="${esc(v.schLogo)}"/></div>` : ''}
  <div class="header-text">
    <div class="header-sch-name">${esc(v.schN)}</div>
    ${v.showMotto && v.schMotto ? `<div class="header-sch-motto">${esc(v.schMotto)}</div>` : ''}
  </div>
</div>

<div class="body">
  ${v.showPhoto ? `
  <div class="photo-container">
    ${v.photoB64 ? `<img src="${esc(v.photoB64)}"/>` : `<div class="photo-placeholder">${v.inits}</div>`}
  </div>` : ''}

  <div class="info-container">
    <div class="person-name">${esc(v.pName || '')}</div>
    <div class="person-role">${esc(v.roleLabel || '')}</div>

    <div class="details-grid">
      <span class="detail-label">ID Number</span><span class="detail-value">${esc(v.pId || '')}</span>
      ${v.pClass ? `<span class="detail-label">Class/Grade</span><span class="detail-value">${esc(v.pClass)}${v.pSection ? ' (' + esc(v.pSection) + ')' : ''}</span>` : ''}
      ${v.pDept && !v.pClass ? `<span class="detail-label">Department</span><span class="detail-value">${esc(v.pDept)}</span>` : ''}
      ${v.showExpiryDate && v.expiryDate ? `<span class="detail-label">Valid Until</span><span class="detail-value">${fmtDateFriendly(v.expiryDate)}</span>` : ''}
    </div>
  </div>

  ${hasQR ? `<div class="qr-container"><img src="data:image/png;base64,${v.qrB64}"/></div>` : ''}
</div>

<div class="footer">
  <div class="footer-id">OFFICIAL IDENTITY CARD</div>
  ${v.pBlood ? `<div class="blood-badge">BLOOD TYPE: ${esc(v.pBlood)}</div>` : ''}
</div>
`;
}

function buildPortraitFrontHTML(v: CardHTMLVars): string {
  const hasPhoto = v.showPhoto && v.photoB64;
  const hasQR = v.showQR && v.qrB64;

  return `
<style>
.bg-pattern {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background-image: radial-gradient(${v.prim}08 1px, transparent 1px);
  background-size: 5mm 5mm; opacity: 0.5; z-index: 0;
}
.header-banner {
  position: absolute; top: 0; left: 0; right: 0; height: 32mm;
  background: linear-gradient(135deg, ${v.primD}, ${v.prim});
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 5mm; color: white; z-index: 1; text-align: center;
}
.sch-logo { width: 12mm; height: 12mm; border-radius: 2.5mm; background: white; padding: 1.5mm; margin-bottom: 2.5mm; box-shadow: 0 1.5mm 3mm rgba(0,0,0,0.15); }
.sch-logo img { width: 100%; height: 100%; object-fit: contain; }
.sch-name { font-weight: 900; font-size: 2.8mm; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; }
.sch-motto { font-size: 1.4mm; opacity: 0.8; font-style: italic; margin-top: 0.5mm; }

.body {
  position: absolute; top: 32mm; left: 0; right: 0; bottom: 10mm;
  display: flex; flex-direction: column; align-items: center;
  padding: 0 5mm; z-index: 2;
}
.photo-frame {
  width: 26mm; height: 30mm; border-radius: 4mm; overflow: hidden;
  border: 2mm solid ${v.bgColor}; background: ${v.bgColor};
  box-shadow: 0 2mm 5mm rgba(0,0,0,0.1); margin-top: -15mm;
  margin-bottom: 3mm; position: relative;
}
.photo-frame img { width: 100%; height: 100%; object-fit: cover; }
.photo-placeholder { font-size: 10mm; font-weight: 900; color: ${v.prim}; opacity: 0.1; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }

.person-info { text-align: center; width: 100%; }
.name-text { color: ${v.dark}; font-weight: 900; font-size: 4.5mm; line-height: 1.1; margin-bottom: 1.5mm; }
.role-text {
  display: inline-block; background: ${v.prim}15; color: ${v.prim};
  padding: 0.8mm 3mm; border-radius: 1.5mm; font-size: 1.8mm;
  font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
}

.details-list { width: 100%; margin-top: 4mm; display: flex; flex-direction: column; gap: 1.5mm; }
.detail-item { display: flex; justify-content: space-between; align-items: center; border-bottom: 0.2px solid ${v.prim}10; padding-bottom: 0.8mm; }
.lbl { color: ${v.muted}; font-size: 1.5mm; font-weight: 800; text-transform: uppercase; }
.val { color: ${v.dark}; font-size: 1.7mm; font-weight: 700; text-align: right; }

.footer-qr {
  position: absolute; bottom: 0; left: 0; right: 0; height: 12mm;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 5mm; background: ${v.prim}05; z-index: 2;
}
.qr-box { width: 10mm; height: 10mm; }
.qr-box img { width: 100%; height: 100%; border-radius: 0.5mm; }
.footer-tag { color: ${v.muted}; font-size: 1.4mm; font-weight: 700; opacity: 0.6; }

.blood-indicator {
  position: absolute; top: 2mm; right: 2mm; background: ${v.accent}; color: black;
  padding: 0.5mm 2mm; border-radius: 1mm; font-size: 1.5mm; font-weight: 900;
}
</style>
<div class="bg-pattern"></div>
<div class="header-banner">
  ${v.showLogo && v.schLogo ? `<div class="sch-logo"><img src="${esc(v.schLogo)}"/></div>` : ''}
  <div class="sch-name">${esc(v.schN)}</div>
  ${v.showMotto && v.schMotto ? `<div class="sch-motto">${esc(v.schMotto)}</div>` : ''}
</div>

<div class="body">
  <div class="photo-frame">
    ${v.photoB64 ? `<img src="${esc(v.photoB64)}"/>` : `<div class="photo-placeholder">${v.inits}</div>`}
  </div>

  <div class="person-info">
    <div class="name-text">${esc(v.pName || '')}</div>
    <div class="role-text">${esc(v.roleLabel || '')}</div>
  </div>

  <div class="details-list">
    <div class="detail-item"><span class="lbl">ID NO</span><span class="val">${esc(v.pId || '')}</span></div>
    ${v.pClass ? `<div class="detail-item"><span class="lbl">CLASS</span><span class="val">${esc(v.pClass)}</span></div>` : ''}
    ${v.pDept && !v.pClass ? `<div class="detail-item"><span class="lbl">DEPT</span><span class="val">${esc(v.pDept)}</span></div>` : ''}
    ${v.showIssueDate && v.issueDate ? `<div class="detail-item"><span class="lbl">ISSUED</span><span class="val">${fmtDateFriendly(v.issueDate)}</span></div>` : ''}
    ${v.pBlood ? `<div class="detail-item"><span class="lbl">BLOOD</span><span class="val">${esc(v.pBlood)}</span></div>` : ''}
  </div>
</div>

<div class="footer-qr">
  <div class="footer-tag">OFFICIAL ID</div>
  ${hasQR ? `<div class="qr-box"><img src="data:image/png;base64,${v.qrB64}"/></div>` : ''}
</div>
`;
}

function buildLandscapeBackHTML(v: CardHTMLVars): string {
  const backContent = v.showTerms
    ? (v.backText || 'This ID card is the property of the school. If found, please return to the school office.')
    : 'This ID card is issued for authorized school use only.';

  return `
<style>
.bg-grid {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background-image: linear-gradient(${v.prim}05 1px, transparent 1px), linear-gradient(90deg, ${v.prim}05 1px, transparent 1px);
  background-size: 5mm 5mm; z-index: 0;
}
.back-header {
  height: 12mm; background: ${v.prim}; display: flex; align-items: center; justify-content: center;
  padding: 0 5mm; color: white; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900; font-size: 2.2mm;
}
.back-body {
  padding: 4mm 6mm; display: flex; gap: 5mm; position: relative; z-index: 1;
}
.terms-section { flex: 1; }
.section-title { color: ${v.prim}; font-weight: 900; font-size: 1.6mm; text-transform: uppercase; margin-bottom: 1.5mm; border-bottom: 0.5px solid ${v.prim}20; padding-bottom: 0.5mm; }
.terms-text { color: ${v.dark}; font-size: 1.4mm; line-height: 1.6; opacity: 0.9; }

.contact-section { width: 30mm; }
.contact-item { margin-bottom: 2mm; }
.contact-val { color: ${v.dark}; font-size: 1.4mm; font-weight: 600; line-height: 1.3; }

.signatory-area {
  position: absolute; bottom: 4mm; right: 6mm; text-align: center; width: 35mm;
}
.sig-line { width: 100%; height: 0.2mm; background: ${v.dark}; margin-bottom: 1mm; opacity: 0.3; }
.sig-label { font-size: 1.2mm; font-weight: 800; color: ${v.muted}; text-transform: uppercase; }
.signature-img { height: 6mm; object-fit: contain; margin-bottom: 1mm; }

.footer-back {
  position: absolute; bottom: 0; left: 0; right: 0; height: 4mm;
  background: ${v.prim}10; display: flex; align-items: center; justify-content: center;
  color: ${v.prim}; font-size: 1.2mm; font-weight: 800; letter-spacing: 1px;
}
</style>
<div class="bg-grid"></div>
<div class="back-header">Terms of Use & Authority</div>
<div class="back-body">
  <div class="terms-section">
    <div class="section-title">Terms & Conditions</div>
    <div class="terms-text">${esc(backContent.replace(/\n/g, '<br/>'))}</div>
  </div>

  <div class="contact-section">
    <div class="section-title">Contact & Help</div>
    <div class="contact-item">
      <div class="contact-val">${esc(v.rawPhone || 'Support: +234 000 000 0000')}</div>
    </div>
    <div class="contact-item">
      <div class="contact-val">${esc(v.rawAddress || 'Office: School Main Campus')}</div>
    </div>
  </div>

  <div class="signatory-area">
    ${v.signatureUrl ? `<img class="signature-img" src="${esc(v.signatureUrl)}"/>` : '<div style="height:7mm"></div>'}
    <div class="sig-line"></div>
    <div class="sig-label">Authorized Signatory</div>
  </div>
</div>
<div class="footer-back">${esc(v.schN)} &bull; Quality Education for All</div>
`;
}

function buildPortraitBackHTML(v: CardHTMLVars): string {
  const backContent = v.showTerms
    ? (v.backText || 'This ID card is the property of the school. If found, please return to the school office.')
    : 'This ID card is issued for authorized school use only.';

  return `
<style>
.bg-grid {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background-image: linear-gradient(${v.prim}05 1px, transparent 1px), linear-gradient(90deg, ${v.prim}05 1px, transparent 1px);
  background-size: 5mm 5mm; z-index: 0;
}
.back-top {
  height: 20mm; background: linear-gradient(135deg, ${v.primD}, ${v.prim});
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 0 5mm; color: white; text-align: center;
}
.back-top-title { font-weight: 900; font-size: 2.2mm; text-transform: uppercase; letter-spacing: 2px; }
.back-top-sch { font-size: 1.6mm; opacity: 0.8; margin-top: 1mm; }

.back-content { padding: 6mm 5mm; z-index: 1; position: relative; flex: 1; }
.sec-title { color: ${v.prim}; font-weight: 900; font-size: 1.6mm; text-transform: uppercase; margin-bottom: 2mm; border-left: 1mm solid ${v.prim}; padding-left: 2mm; }
.sec-body { color: ${v.dark}; font-size: 1.5mm; line-height: 1.6; margin-bottom: 5mm; }

.sig-box {
  margin-top: 10mm; text-align: center;
}
.sig-img { height: 8mm; object-fit: contain; margin-bottom: 2mm; }
.sig-l { width: 30mm; height: 0.2mm; background: ${v.dark}30; margin: 0 auto 1.5mm; }
.sig-t { font-size: 1.4mm; font-weight: 800; color: ${v.muted}; text-transform: uppercase; }

.back-footer {
  position: absolute; bottom: 0; left: 0; right: 0; height: 8mm;
  display: flex; align-items: center; justify-content: center;
  background: ${v.prim}; color: white; font-size: 1.4mm; font-weight: 800;
}
</style>
<div class="bg-grid"></div>
<div class="back-top">
  <div class="back-top-title">Official Identity</div>
  <div class="back-top-sch">${esc(v.schN)}</div>
</div>

<div class="back-content">
  <div class="sec-title">Instructions</div>
  <div class="sec-body">${esc(backContent.replace(/\n/g, '<br/>'))}</div>

  <div class="sec-title">Contact Support</div>
  <div class="sec-body">
    ${esc(v.rawPhone || 'N/A')}<br/>
    ${esc(v.rawEmail || 'N/A')}<br/>
    ${esc(v.rawAddress || 'N/A')}
  </div>

  <div class="sig-box">
    ${v.signatureUrl ? `<img class="sig-img" src="${esc(v.signatureUrl)}"/>` : '<div style="height:10mm"></div>'}
    <div class="sig-l"></div>
    <div class="sig-t">Authorized Signatory</div>
  </div>
</div>
<div class="back-footer">Property of ${esc(v.schN)}</div>
`;
}
