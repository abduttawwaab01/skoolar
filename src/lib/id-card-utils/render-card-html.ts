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

function fmtDateShortFriendly(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }); }
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
  const gradFrom = cssColor(colors.gradientFrom || prim);
  const gradTo = cssColor(colors.gradientTo || adj(prim, 35));
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

  let bodyHTML = '';
  if (isBack) {
    bodyHTML = port ? buildPortraitBackHTML({ prim, primD, sec, accent, dark, muted, hdrBg, hdrTxt, bgColor, gradFrom, gradTo, schN, schMotto, schLogo, showLogo, backText, showSignature, signatureUrl, showTerms, showMedicalInfo: !!options.showMedicalInfo, showEmergencyInfo: !!options.showEmergencyInfo, rawBlood, rawPhone, rawAddress, rawEmail, qrB64, showQR, waterText: watermarkText || schN, showWatermark }) : buildLandscapeBackHTML({ prim, primD, sec, accent, dark, muted, hdrBg, hdrTxt, bgColor, gradFrom, gradTo, schN, schMotto, schLogo, showLogo, backText, showSignature, signatureUrl, showTerms, showMedicalInfo: !!options.showMedicalInfo, showEmergencyInfo: !!options.showEmergencyInfo, rawBlood, rawPhone, rawAddress, rawEmail, qrB64, showQR, waterText: watermarkText || schN, showWatermark });
  } else {
    bodyHTML = port ? buildPortraitFrontHTML({ prim, primD, sec, accent, dark, muted, hdrBg, hdrTxt, bgColor, gradFrom, gradTo, schN, schMotto, schLogo, showLogo, showPhoto, showBarcode, showSignature, showMotto, showIssueDate, showExpiryDate, showWatermark, signatureUrl, issueDate, expiryDate, watermarkText: watermarkText || schN, pName: rawName, pId: rawId, pClass: rawClass, pSection: rawSection, pDept: rawDept, pGend: rawGender, pPhone: rawPhone, pEmail: rawEmail, pAddr: rawAddress, pBlood: rawBlood, pDOB: rawDOB, pHouse: rawHouse, pSession: rawSession, pDesignation: rawDesignation, pPosition: rawPosition, pType, roleLabel, inits, photoB64, qrB64, showQR }) : buildLandscapeFrontHTML({ prim, primD, sec, accent, dark, muted, hdrBg, hdrTxt, bgColor, gradFrom, gradTo, schN, schMotto, schLogo, showLogo, showPhoto, showBarcode, showSignature, showMotto, showIssueDate, showExpiryDate, showWatermark, signatureUrl, issueDate, expiryDate, watermarkText: watermarkText || schN, pName: rawName, pId: rawId, pClass: rawClass, pSection: rawSection, pDept: rawDept, pGend: rawGender, pPhone: rawPhone, pEmail: rawEmail, pAddr: rawAddress, pBlood: rawBlood, pDOB: rawDOB, pHouse: rawHouse, pSession: rawSession, pDesignation: rawDesignation, pPosition: rawPosition, pType, roleLabel, inits, photoB64, qrB64, showQR });
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
  showSchoolInfo?: boolean;
  rawBlood?: string; rawPhone?: string; rawAddress?: string; rawEmail?: string;
  waterText?: string;
}

function buildLandscapeFrontHTML(v: CardHTMLVars): string {
  const hasPhoto = v.showPhoto && v.photoB64;
  const hasQR = v.showQR && v.qrB64;

  return `
<style>
.id-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2.8mm;
  background: linear-gradient(90deg, ${v.primD}, ${v.prim}, ${v.prim});
  z-index: 2;
}

.header {
  position: absolute;
  top: 2.8mm; left: 0; right: 0;
  height: 10mm;
  background: linear-gradient(135deg, ${v.primD}, ${v.hdrBg});
  display: flex;
  align-items: center;
  padding: 0 2.8mm;
  z-index: 1;
}
.header-wave {
  position: absolute;
  bottom: -1.8mm; left: 0; right: 0;
  height: 3mm;
  fill: ${v.hdrBg};
}
.header-logo { display: flex; align-items: center; gap: 2mm; flex: 1; min-width: 0; }
.header-logo img {
  width: 6mm; height: 6mm; border-radius: 1mm;
  object-fit: contain; background: rgba(255,255,255,0.15);
  flex-shrink: 0;
}
.header-logo-placeholder {
  width: 6mm; height: 6mm; border-radius: 1mm;
  background: rgba(255,255,255,0.12);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.header-logo-placeholder svg { width: 3.5mm; height: 3.5mm; fill: rgba(255,255,255,0.5); }
.header-text { flex: 1; min-width: 0; }
.header-name {
  color: ${v.hdrTxt}; font-weight: 700;
  font-size: 2.6mm; line-height: 1.15;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.header-motto {
  color: ${v.hdrTxt}; font-size: 1.3mm; line-height: 1.2;
  opacity: 0.7; font-style: italic;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.header-badge {
  background: rgba(255,255,255,0.18);
  color: ${v.hdrTxt}; font-size: 1.6mm; font-weight: 700;
  padding: 0.8mm 2mm; border-radius: 2mm;
  letter-spacing: 0.5px; white-space: nowrap;
  backdrop-filter: blur(2px);
  flex-shrink: 0;
}

.body {
  position: absolute;
  top: 14mm; left: 0; right: 0;
  bottom: 4.5mm;
  display: flex;
  align-items: center;
  padding: 0 2.8mm;
  gap: 2.8mm;
}

.photo-section {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.8mm; flex-shrink: 0;
}
.photo-circle {
  width: 11mm; height: 11mm; border-radius: 50%;
  background: ${v.prim}08;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  border: 2px solid ${v.prim}30;
  box-shadow: 0 1mm 2mm ${v.prim}15;
  position: relative;
}
.photo-circle img {
  width: 100%; height: 100%; object-fit: cover;
}
.photo-inits {
  font-size: 4.5mm; font-weight: 700;
  color: ${v.prim}; opacity: 0.35;
}
.blood-badge {
  background: ${v.accent};
  color: #000; font-size: 1.4mm; font-weight: 700;
  padding: 0.3mm 1.5mm; border-radius: 1mm;
  line-height: 1.3;
}

.info-section {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  justify-content: center;
  gap: 0.6mm;
}
.person-name {
  color: ${v.dark}; font-weight: 800;
  font-size: 3.2mm; line-height: 1.15;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.role-badge {
  background: ${v.prim}12;
  color: ${v.prim}; font-weight: 700;
  font-size: 1.6mm; padding: 0.5mm 2mm; border-radius: 2mm;
  display: inline-block; align-self: flex-start;
  line-height: 1.3;
}
.detail-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 2mm; row-gap: 0.5mm;
  margin-top: 0.8mm;
}
.detail-label {
  color: ${v.muted}; font-size: 1.4mm; font-weight: 500;
  line-height: 1.2;
}
.detail-value {
  color: ${v.dark}; font-size: 1.5mm; font-weight: 600;
  line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.qr-section {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0.5mm; flex-shrink: 0;
  width: 11mm;
}
.qr-section img {
  width: 9mm; height: 9mm;
  border-radius: 0.5mm;
}
.qr-label {
  color: ${v.prim}; font-size: 1mm; font-weight: 700;
  letter-spacing: 0.3px; text-align: center;
  line-height: 1.2;
}

.footer {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 4.5mm;
  background: ${v.prim}08;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2.8mm;
  gap: 2mm;
}
.footer-barcode {
  display: flex; align-items: center; gap: 1mm;
}
.footer-barcode-bar {
  height: 2.2mm;
  background: repeating-linear-gradient(90deg, ${v.dark} 0px, ${v.dark} 0.3px, transparent 0.3px, transparent 0.6px);
  width: 15mm;
  border-radius: 0.2mm;
}
.footer-id {
  color: ${v.muted}; font-size: 1.3mm; font-weight: 500;
  letter-spacing: 0.3px;
}

.watermark {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 8mm; font-weight: 900;
  color: ${v.prim}; opacity: 0.035;
  white-space: nowrap; pointer-events: none;
  letter-spacing: 1.5mm;
  text-transform: uppercase;
}

.divider-line {
  position: absolute;
  top: 14mm; bottom: 4.5mm;
  width: 0.3px; background: ${v.prim}15;
}
</style>

${v.showWatermark ? `<div class="watermark">${esc(v.waterText || '')}</div>` : ''}

<div class="header">
  <div class="header-logo">
    ${v.showLogo && v.schLogo ? `<img src="${esc(v.schLogo)}" alt="Logo"/>` : v.showLogo ? `<div class="header-logo-placeholder"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>` : ''}
    <div class="header-text">
      <div class="header-name">${esc(v.schN)}</div>
      ${v.showMotto && v.schMotto ? `<div class="header-motto">${esc(v.schMotto)}</div>` : ''}
    </div>
  </div>
  <div class="header-badge">${v.roleLabel || 'ID CARD'}</div>
</div>

<div class="body">
  ${v.showPhoto ? `<div class="photo-section">
    <div class="photo-circle">
      ${v.photoB64 ? `<img src="${esc(v.photoB64)}" alt="Photo"/>` : `<span class="photo-inits">${v.inits || '?'}</span>`}
    </div>
    ${v.pBlood ? `<div class="blood-badge">${esc(v.pBlood)}</div>` : ''}
  </div>` : ''}

  <div class="info-section">
    <div class="person-name">${esc(v.pName || '')}</div>
    ${v.roleLabel ? `<div class="role-badge">${esc(v.roleLabel)}</div>` : ''}
    <div class="detail-grid">
      <span class="detail-label">ID No</span>
      <span class="detail-value">${esc(v.pId || '')}</span>
      ${v.pClass ? `<span class="detail-label">Class</span><span class="detail-value">${esc(v.pClass)}${v.pSection ? ' - ' + esc(v.pSection) : ''}</span>` : ''}
      ${v.pDept ? `<span class="detail-label">Dept</span><span class="detail-value">${esc(v.pDept)}</span>` : ''}
      ${v.pBlood && v.pBlood ? `<span class="detail-label">Blood</span><span class="detail-value">${esc(v.pBlood)}</span>` : ''}
      ${v.pDOB ? `<span class="detail-label">DOB</span><span class="detail-value">${fmtDateFriendly(v.pDOB)}</span>` : ''}
      ${v.pGender ? `<span class="detail-label">Gender</span><span class="detail-value">${esc(v.pGend)}</span>` : ''}
      ${v.pHouse ? `<span class="detail-label">House</span><span class="detail-value">${esc(v.pHouse)}</span>` : ''}
      ${v.showIssueDate && v.issueDate ? `<span class="detail-label">Issued</span><span class="detail-value">${fmtDateFriendly(v.issueDate)}</span>` : ''}
      ${v.showExpiryDate && v.expiryDate ? `<span class="detail-label">Expires</span><span class="detail-value">${fmtDateFriendly(v.expiryDate)}</span>` : ''}
    </div>
  </div>

  ${hasQR ? `<div class="qr-section">
    <img src="data:image/png;base64,${v.qrB64}" alt="QR"/>
    <div class="qr-label">SCAN</div>
  </div>` : ''}
</div>

<div class="footer">
  ${v.showBarcode ? `<div class="footer-barcode">
    <div class="footer-barcode-bar"></div>
    <span class="footer-id">${esc(v.pId || '')}</span>
  </div>` : `<span class="footer-id" style="opacity:0.5">${esc(v.schN)} &bull; Official ID</span>`}
</div>`;
}

function buildPortraitFrontHTML(v: CardHTMLVars): string {
  const hasPhoto = v.showPhoto && v.photoB64;
  const hasQR = v.showQR && v.qrB64;

  return `
<style>
.id-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2.8mm;
  background: linear-gradient(90deg, ${v.primD}, ${v.prim}, ${v.prim});
  z-index: 2;
}

.header {
  position: absolute;
  top: 2.8mm; left: 0; right: 0;
  height: 12mm;
  background: linear-gradient(135deg, ${v.primD}, ${v.hdrBg});
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 2.5mm;
  z-index: 1;
}
.header-row {
  display: flex; align-items: center; gap: 1.5mm;
  width: 100%; justify-content: center;
}
.header-logo-img {
  width: 5mm; height: 5mm; border-radius: 0.8mm;
  object-fit: contain; background: rgba(255,255,255,0.15);
  flex-shrink: 0;
}
.header-text { text-align: center; }
.header-name {
  color: ${v.hdrTxt}; font-weight: 700;
  font-size: 2.4mm; line-height: 1.15;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.header-motto {
  color: ${v.hdrTxt}; font-size: 1.2mm; line-height: 1.2;
  opacity: 0.7; font-style: italic;
}
.header-badge {
  background: rgba(255,255,255,0.18);
  color: ${v.hdrTxt}; font-size: 1.4mm; font-weight: 700;
  padding: 0.5mm 1.5mm; border-radius: 2mm;
  letter-spacing: 0.5px; margin-top: 0.5mm;
  backdrop-filter: blur(2px);
}

.body {
  position: absolute;
  top: 15.5mm; left: 0; right: 0;
  bottom: 4.5mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5mm 2.5mm;
  gap: 1mm;
}

.photo-circle {
  width: 10mm; height: 10mm; border-radius: 50%;
  background: ${v.prim}08;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  border: 2px solid ${v.prim}30;
  box-shadow: 0 0.8mm 1.5mm ${v.prim}15;
  flex-shrink: 0;
}
.photo-circle img {
  width: 100%; height: 100%; object-fit: cover;
}
.photo-inits {
  font-size: 4mm; font-weight: 700;
  color: ${v.prim}; opacity: 0.35;
}
.person-name {
  color: ${v.dark}; font-weight: 800;
  font-size: 2.8mm; line-height: 1.15;
  text-align: center;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis;
}
.role-badge {
  background: ${v.prim}12;
  color: ${v.prim}; font-weight: 700;
  font-size: 1.5mm; padding: 0.4mm 2mm; border-radius: 2mm;
  line-height: 1.3;
}
.detail-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 2mm; row-gap: 0.4mm;
  width: 100%;
  margin-top: 0.5mm;
}
.detail-label {
  color: ${v.muted}; font-size: 1.3mm; font-weight: 500;
  line-height: 1.2;
}
.detail-value {
  color: ${v.dark}; font-size: 1.4mm; font-weight: 600;
  line-height: 1.2;
  text-align: right;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.qr-section {
  display: flex; flex-direction: column;
  align-items: center; gap: 0.3mm;
  margin-top: 0.5mm;
}
.qr-section img {
  width: 8mm; height: 8mm;
  border-radius: 0.5mm;
}
.qr-label {
  color: ${v.prim}; font-size: 1mm; font-weight: 700;
  letter-spacing: 0.3px; text-align: center;
}

.blood-badge {
  background: ${v.accent};
  color: #000; font-size: 1.3mm; font-weight: 700;
  padding: 0.2mm 1.2mm; border-radius: 0.8mm;
  line-height: 1.2;
  position: absolute;
  top: 1mm; right: 2.5mm;
}

.footer {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 4.5mm;
  background: ${v.prim}08;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2.5mm;
}
.footer-text {
  color: ${v.muted}; font-size: 1.2mm; font-weight: 500;
  opacity: 0.5;
}

.watermark {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 7mm; font-weight: 900;
  color: ${v.prim}; opacity: 0.03;
  white-space: nowrap; pointer-events: none;
  letter-spacing: 1.5mm;
  text-transform: uppercase;
}
</style>

${v.showWatermark ? `<div class="watermark">${esc(v.waterText || '')}</div>` : ''}

<div class="header">
  <div class="header-row">
    ${v.showLogo && v.schLogo ? `<img class="header-logo-img" src="${esc(v.schLogo)}" alt="Logo"/>` : ''}
    <div class="header-text">
      <div class="header-name">${esc(v.schN)}</div>
      ${v.showMotto && v.schMotto ? `<div class="header-motto">${esc(v.schMotto)}</div>` : ''}
    </div>
  </div>
  <div class="header-badge">${v.roleLabel || 'ID CARD'}</div>
</div>

<div class="body">
  ${v.showPhoto ? `<div class="photo-circle">
    ${v.photoB64 ? `<img src="${esc(v.photoB64)}" alt="Photo"/>` : `<span class="photo-inits">${v.inits || '?'}</span>`}
  </div>` : ''}

  ${v.pBlood && v.showPhoto ? `<div class="blood-badge">${esc(v.pBlood)}</div>` : ''}

  <div class="person-name">${esc(v.pName || '')}</div>
  <div class="role-badge">${esc(v.roleLabel || '')}</div>

  <div class="detail-grid">
    <span class="detail-label">ID No</span>
    <span class="detail-value">${esc(v.pId || '')}</span>
    ${v.pClass ? `<span class="detail-label">Class</span><span class="detail-value">${esc(v.pClass)}${v.pSection ? ' - ' + esc(v.pSection) : ''}</span>` : ''}
    ${v.pDept ? `<span class="detail-label">Dept</span><span class="detail-value">${esc(v.pDept)}</span>` : ''}
    ${v.pBlood ? `<span class="detail-label">Blood</span><span class="detail-value">${esc(v.pBlood)}</span>` : ''}
    ${v.pDOB ? `<span class="detail-label">DOB</span><span class="detail-value">${fmtDateFriendly(v.pDOB)}</span>` : ''}
    ${v.pGender ? `<span class="detail-label">Gender</span><span class="detail-value">${esc(v.pGend)}</span>` : ''}
    ${v.pHouse ? `<span class="detail-label">House</span><span class="detail-value">${esc(v.pHouse)}</span>` : ''}
    ${v.showIssueDate && v.issueDate ? `<span class="detail-label">Issued</span><span class="detail-value">${fmtDateFriendly(v.issueDate)}</span>` : ''}
    ${v.showExpiryDate && v.expiryDate ? `<span class="detail-label">Expires</span><span class="detail-value">${fmtDateFriendly(v.expiryDate)}</span>` : ''}
  </div>

  ${hasQR ? `<div class="qr-section">
    <img src="data:image/png;base64,${v.qrB64}" alt="QR"/>
    <div class="qr-label">SCAN FOR ATTENDANCE</div>
  </div>` : ''}
</div>

<div class="footer">
  <span class="footer-text">${esc(v.schN)} &bull; Official ID Card</span>
</div>`;
}

function buildLandscapeBackHTML(v: CardHTMLVars): string {
  const hasQR = v.showQR && v.qrB64;
  const backContent = v.showTerms
    ? (v.backText || 'This ID card is the property of the school. If found, please return to the school office.')
    : 'This ID card is issued for authorized school use only.';

  return `
<style>
.id-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2.8mm;
  background: linear-gradient(90deg, ${v.primD}, ${v.prim}, ${v.prim});
  z-index: 2;
}

.header {
  position: absolute;
  top: 2.8mm; left: 0; right: 0;
  height: 9mm;
  background: linear-gradient(135deg, ${v.primD}, ${v.hdrBg});
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2.8mm;
  z-index: 1;
}
.header-text {
  color: ${v.hdrTxt}; font-weight: 700;
  font-size: 2.2mm; text-align: center;
  letter-spacing: 1px;
}

.body {
  position: absolute;
  top: 12.5mm; left: 0; right: 0;
  bottom: 3mm;
  display: flex;
  padding: 2mm 2.8mm;
  gap: 2mm;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1mm;
}
.section-title {
  color: ${v.prim}; font-weight: 700;
  font-size: 1.5mm; letter-spacing: 0.5px;
  margin-bottom: 0.3mm;
}
.section-divider {
  height: 0.3px; background: ${v.prim}20;
  margin-bottom: 0.5mm;
}
.info-text {
  color: ${v.dark}; font-size: 1.3mm;
  line-height: 1.5; opacity: 0.85;
}
.info-item {
  display: flex; gap: 1mm;
  color: ${v.dark}; font-size: 1.4mm;
  line-height: 1.4;
}
.info-item .label {
  color: ${v.muted}; font-weight: 500;
  min-width: 8mm; flex-shrink: 0;
}
.info-item .value {
  font-weight: 600;
}

.qr-panel {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0.5mm;
  border-left: 0.3px solid ${v.prim}15;
  padding-left: 2mm;
  flex-shrink: 0;
  width: 12mm;
}
.qr-panel img {
  width: 9mm; height: 9mm;
  border-radius: 0.5mm;
}
.qr-label {
  color: ${v.prim}; font-size: 0.9mm; font-weight: 700;
  text-align: center; letter-spacing: 0.3px;
}

.watermark {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 7mm; font-weight: 900;
  color: ${v.prim}; opacity: 0.03;
  white-space: nowrap; pointer-events: none;
  letter-spacing: 2mm;
  text-transform: uppercase;
}
</style>

${v.showWatermark ? `<div class="watermark">${esc(v.waterText || '')}</div>` : ''}

<div class="header">
  <div class="header-text">${esc(v.schN)} &mdash; BACK OF ID CARD</div>
</div>

<div class="body">
  <div class="left-panel">
    <div class="section-title">TERMS & CONDITIONS</div>
    <div class="section-divider"></div>
    <div class="info-text">${esc(backContent.replace(/\n/g, '<br/>'))}</div>

    ${v.showMedicalInfo && v.rawBlood ? `<div style="margin-top:1mm">
      <div class="section-title">MEDICAL INFO</div>
      <div class="section-divider"></div>
      <div class="info-item"><span class="label">Blood:</span><span class="value">${esc(v.rawBlood)}</span></div>
    </div>` : ''}

    ${v.showEmergencyInfo && v.rawPhone ? `<div style="margin-top:1mm">
      <div class="section-title">EMERGENCY</div>
      <div class="section-divider"></div>
      <div class="info-item"><span class="label">Phone:</span><span class="value">${esc(v.rawPhone)}</span></div>
    </div>` : ''}
  </div>

  ${hasQR ? `<div class="qr-panel">
    <img src="data:image/png;base64,${v.qrB64}" alt="QR"/>
    <div class="qr-label">SCAN TO<br/>VERIFY</div>
  </div>` : ''}
</div>`;
}

function buildPortraitBackHTML(v: CardHTMLVars): string {
  const hasQR = v.showQR && v.qrB64;
  const backContent = v.showTerms
    ? (v.backText || 'This ID card is the property of the school. If found, please return to the school office.')
    : 'This ID card is issued for authorized school use only.';

  return `
<style>
.id-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2.8mm;
  background: linear-gradient(90deg, ${v.primD}, ${v.prim}, ${v.prim});
  z-index: 2;
}

.header {
  position: absolute;
  top: 2.8mm; left: 0; right: 0;
  height: 11mm;
  background: linear-gradient(135deg, ${v.primD}, ${v.hdrBg});
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2.5mm;
  z-index: 1;
}
.header-text {
  color: ${v.hdrTxt}; font-weight: 700;
  font-size: 2mm; text-align: center;
  letter-spacing: 0.5px;
}

.body {
  position: absolute;
  top: 14.5mm; left: 0; right: 0;
  bottom: 3mm;
  display: flex;
  flex-direction: column;
  padding: 2mm 2.5mm;
  gap: 1.5mm;
}

.section-title {
  color: ${v.prim}; font-weight: 700;
  font-size: 1.4mm; letter-spacing: 0.5px;
  margin-bottom: 0.3mm;
}
.section-divider {
  height: 0.3px; background: ${v.prim}20;
  margin-bottom: 0.5mm;
}
.info-text {
  color: ${v.dark}; font-size: 1.2mm;
  line-height: 1.5; opacity: 0.85;
}
.info-item {
  display: flex; gap: 1mm;
  color: ${v.dark}; font-size: 1.3mm;
  line-height: 1.4;
}
.info-item .label {
  color: ${v.muted}; font-weight: 500;
  min-width: 8mm; flex-shrink: 0;
}
.info-item .value {
  font-weight: 600;
}

.qr-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5mm;
  margin-top: 0.5mm;
}
.qr-section img {
  width: 7mm; height: 7mm;
  border-radius: 0.3mm;
}
.qr-label {
  color: ${v.prim}; font-size: 0.9mm; font-weight: 700;
  text-align: center; letter-spacing: 0.3px;
}

.watermark {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 6mm; font-weight: 900;
  color: ${v.prim}; opacity: 0.025;
  white-space: nowrap; pointer-events: none;
  letter-spacing: 2mm;
  text-transform: uppercase;
}
</style>

${v.showWatermark ? `<div class="watermark">${esc(v.waterText || '')}</div>` : ''}

<div class="header">
  <div class="header-text">${esc(v.schN)} &mdash; BACK OF ID CARD</div>
</div>

<div class="body">
  <div class="section-title">TERMS & CONDITIONS</div>
  <div class="section-divider"></div>
  <div class="info-text">${esc(backContent.replace(/\n/g, '<br/>'))}</div>

  ${hasQR ? `<div class="qr-section">
    <img src="data:image/png;base64,${v.qrB64}" alt="QR"/>
    <span class="qr-label">SCAN TO VERIFY</span>
  </div>` : ''}

  ${v.showMedicalInfo && v.rawBlood ? `<div style="margin-top:0.5mm">
    <div class="section-title">MEDICAL INFO</div>
    <div class="section-divider"></div>
    <div class="info-item"><span class="label">Blood:</span><span class="value">${esc(v.rawBlood)}</span></div>
  </div>` : ''}

  ${v.showEmergencyInfo && v.rawPhone ? `<div style="margin-top:0.5mm">
    <div class="section-title">EMERGENCY</div>
    <div class="section-divider"></div>
    <div class="info-item"><span class="label">Phone:</span><span class="value">${esc(v.rawPhone)}</span></div>
  </div>` : ''}
</div>`;
}
