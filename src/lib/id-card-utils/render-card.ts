import type { IDCardPreviewData } from './types';

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  return `rgba(${num >> 16},${(num >> 8) & 0x00ff},${num & 0x0000ff},${alpha})`;
}

function mm(val: number): string {
  return `${val}mm`;
}

function generateDotsPattern(primary: string): string {
  return `<pattern id="card-bg-pattern" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="0.5" fill="${hexToRgba(primary, 0.07)}"/>
  </pattern>`;
}

function generateGridPattern(primary: string): string {
  return `<pattern id="card-bg-pattern" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
    <path d="M 5 0 L 0 0 0 5" fill="none" stroke="${hexToRgba(primary, 0.06)}" stroke-width="0.3"/>
  </pattern>`;
}

function generateStripesPattern(primary: string): string {
  return `<pattern id="card-bg-pattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
    <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="${hexToRgba(primary, 0.04)}" stroke-width="1.5"/>
  </pattern>`;
}

function generateGlassOverlay(): string {
  return `<linearGradient id="glass-shine" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="rgba(255,255,255,0.25)"/>
    <stop offset="50%" stop-color="rgba(255,255,255,0.05)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0.15)"/>
  </linearGradient>`;
}

function getBackgroundSVG(data: IDCardPreviewData, cardW: number, cardH: number): string {
  const prim = data.design.colors.primary || data.school.primaryColor || '#059669';
  const bg = data.design.colors.bg || '#ffffff';

  switch (data.design.backgroundType) {
    case 'dots':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm(cardW)}" height="${mm(cardH)}">
        <defs>${generateDotsPattern(prim)}</defs>
        <rect width="100%" height="100%" fill="${bg}"/>
        <rect width="100%" height="100%" fill="url(#card-bg-pattern)"/>
      </svg>`;
    case 'grid':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm(cardW)}" height="${mm(cardH)}">
        <defs>${generateGridPattern(prim)}</defs>
        <rect width="100%" height="100%" fill="${bg}"/>
        <rect width="100%" height="100%" fill="url(#card-bg-pattern)"/>
      </svg>`;
    case 'stripes':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm(cardW)}" height="${mm(cardH)}">
        <defs>${generateStripesPattern(prim)}</defs>
        <rect width="100%" height="100%" fill="${bg}"/>
        <rect width="100%" height="100%" fill="url(#card-bg-pattern)"/>
      </svg>`;
    case 'glass':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm(cardW)}" height="${mm(cardH)}">
        <defs>${generateGlassOverlay()}</defs>
        <rect width="100%" height="100%" fill="${bg}" opacity="0.85"/>
        <rect width="100%" height="100%" fill="url(#glass-shine)"/>
      </svg>`;
    case 'gradient': {
      const from = data.design.colors.gradientFrom || adjustColor(prim, 60);
      const to = data.design.colors.gradientTo || prim;

      return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm(cardW)}" height="${mm(cardH)}">
        <defs>
          <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${hexToRgba(from, 0.04)}"/>
            <stop offset="100%" stop-color="${hexToRgba(to, 0.08)}"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="${bg}"/>
        <rect width="100%" height="100%" fill="url(#bg-grad)"/>
      </svg>`;
    }
    default:
      return '';
  }
}

let qrModule: any = null;

async function ensureQR(): Promise<any> {
  if (!qrModule) {
    try {
      qrModule = await import('qrcode');
    } catch {
      qrModule = null;
    }
  }
  return qrModule;
}

export async function generateQRDataUrl(text: string): Promise<string> {
  const qr = await ensureQR();
  if (qr) {
    try {
      const dataUrl = await qr.default.toDataURL(text, {
        width: 400,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
      });
      return `<img src="${dataUrl}" alt="QR" style="width:100%;height:100%;object-fit:contain"/>`;
    } catch {
      /* fallback to SVG below */
    }
  }
  const qrMatrix: string[] = [];
  for (let i = 0; i < 25; i++) {
    let row = '';
    for (let j = 0; j < 25; j++) {
      row += (i * j + i + j) % 3 === 0 || (i + j) % 5 === 0 ? '1' : '0';
    }
    qrMatrix.push(row);
  }
  const svgParts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25">`];
  for (let i = 0; i < 25; i++) {
    for (let j = 0; j < 25; j++) {
      if (qrMatrix[i][j] === '1') {
        svgParts.push(`<rect x="${j}" y="${i}" width="1" height="1" fill="#1a1a2e"/>`);
      }
    }
  }
  svgParts.push(`</svg>`);
  return svgParts.join('');
}

function getPhotoPlaceholderSVG(initials: string, primary: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">
    <rect width="100" height="120" fill="${hexToRgba(primary, 0.08)}" rx="6"/>
    <text x="50" y="65" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui" font-size="36" font-weight="700" fill="${primary}" opacity="0.25">
      ${esc(initials)}
    </text>
  </svg>`;
}

function getBarcodeSVG(code: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40">
    ${code.split('').map((c, i) => {
      const w = (parseInt(c, 36) % 4) + 1;
      return `<rect x="${i * 3}" y="2" width="${w}" height="36" fill="#1a1a2e"/>`;
    }).join('')}
  </svg>`;
}

export async function renderIDCardPreview(data: IDCardPreviewData): Promise<string> {
  const isLand = data.design.orientation === 'landscape';
  const cardW = isLand ? 85.6 : 53.98;
  const cardH = isLand ? 53.98 : 85.6;
  const prim = data.design.colors.primary || data.school.primaryColor || '#059669';
  const sec = data.design.colors.secondary || data.school.secondaryColor || '#ffffff';
  const dark = data.design.colors.text || '#1e293b';
  const muted = data.design.colors.textSecondary || '#64748b';
  const bg = data.design.colors.bg || '#ffffff';
  const headerBg = data.design.colors.headerBg || prim;
  const accent = data.design.colors.accent || '#fbbf24';
  const name = data.student ? data.student.name : (data.teacher ? data.teacher.name : 'Name');
  const initials = name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const photoUrl = data.student?.photo || data.teacher?.photo || null;
  const displayId = data.student ? data.student.admissionNo : (data.teacher ? data.teacher.employeeNo || '' : '');
  const personType = data.design.type;

  const bgSVG = getBackgroundSVG(data, cardW, cardH);
  const qrSvg = data.qrCodeDataUrl || await generateQRDataUrl('skoolar://id-card');
  const serial = data.serialNumber || `SKL-${Date.now().toString(36).toUpperCase()}`;

  return `<style>
    .card * { margin: 0; padding: 0; box-sizing: border-box; }
    .card {
      width: ${mm(cardW)}; height: ${mm(cardH)};
      position: relative; overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: ${bg};
    }
    .card-bg { position: absolute; inset: 0; }
    .card-bg svg { width: 100%; height: 100%; display: block; }
    .top-stripe {
      position: absolute; top: 0; left: 0; right: 0;
      height: ${isLand ? mm(12) : mm(9)};
      background: linear-gradient(135deg, ${headerBg}, ${adjustColor(headerBg, 20)});
      z-index: 2;
    }
    .top-stripe::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0;
      height: ${mm(2)}; background: linear-gradient(to bottom, ${hexToRgba(headerBg, 0.3)}, transparent);
    }
    .logo-area {
      position: absolute; z-index: 3;
      ${isLand
        ? `top: ${mm(1.5)}; left: ${mm(3)}; width: ${mm(9)}; height: ${mm(9)};`
        : `top: ${mm(1.2)}; left: ${mm(2.5)}; width: ${mm(6.5)}; height: ${mm(6.5)};`
      }
      border-radius: ${mm(1.5)}; overflow: hidden;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 ${mm(0.3)} ${mm(1.5)} rgba(0,0,0,0.1);
    }
    .logo-area img, .logo-placeholder { width: 100%; height: 100%; object-fit: contain; }
    .logo-placeholder {
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 900; ${isLand ? `font-size: ${mm(4)};` : `font-size: ${mm(3)};`}
    }
    .school-info {
      position: absolute; z-index: 3;
      top: ${isLand ? mm(1.8) : mm(1.5)}; left: 0; right: 0;
      text-align: center;
      ${isLand ? `padding: 0 ${mm(14)};` : `padding: 0 ${mm(10)};`}
    }
    .school-name {
      font-weight: 800; font-size: ${isLand ? mm(3.2) : mm(2.6)};
      color: #fff; letter-spacing: 0.2px; line-height: 1.15;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .school-motto {
      font-size: ${isLand ? mm(1.4) : mm(1.1)};
      color: rgba(255,255,255,0.7); font-style: italic;
      margin-top: ${mm(0.1)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .photo-area {
      position: absolute; z-index: 4;
      ${isLand
        ? `top: ${mm(14)}; left: ${mm(4)}; width: ${mm(22)}; height: ${mm(30)};`
        : `top: ${mm(10.5)}; left: 50%; transform: translateX(-50%); width: ${mm(20)}; height: ${mm(23)};`
      }
      border-radius: ${mm(2.5)}; overflow: hidden;
      border: 1.5px solid ${hexToRgba(prim, 0.12)};
      background: ${hexToRgba(prim, 0.03)};
      box-shadow: 0 ${mm(0.5)} ${mm(2.5)} rgba(0,0,0,0.06);
      display: flex; align-items: center; justify-content: center;
    }
    .photo-area img, .photo-area svg { width: 100%; height: 100%; object-fit: cover; }
    .details-area {
      position: absolute; z-index: 4;
      ${isLand
        ? `top: ${mm(14)}; left: ${mm(28)}; right: ${mm(25)};`
        : `top: ${mm(35)}; left: ${mm(2.5)}; right: ${mm(2.5)}; text-align: center;`
      }
      display: flex; flex-direction: column;
      ${isLand ? '' : 'align-items: center;'}
      gap: ${mm(0.6)};
    }
    .person-name {
      font-weight: 800; font-size: ${isLand ? mm(4.8) : mm(3.5)};
      color: ${dark}; line-height: 1.1;
      ${isLand ? '' : 'text-align: center;'}
    }
    .person-type-badge {
      background: linear-gradient(135deg, ${prim}, ${adjustColor(prim, 30)});
      color: #fff; padding: ${mm(0.4)} ${mm(2)};
      border-radius: ${mm(1)}; font-size: ${mm(1.5)}; font-weight: 700;
      text-transform: uppercase; display: inline-block;
      align-self: ${isLand ? 'flex-start' : 'center'};
      letter-spacing: 0.6px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: ${isLand ? 'auto 1fr' : '1fr 1fr'};
      column-gap: ${isLand ? mm(2.5) : mm(1.5)};
      row-gap: ${mm(0.4)};
      margin-top: ${mm(0.8)}; width: 100%;
    }
    .info-row { display: contents; }
    .info-label {
      font-size: ${mm(1.2)}; font-weight: 600; color: ${muted};
      text-transform: uppercase; letter-spacing: 0.2px;
      white-space: nowrap; padding: ${mm(0.2)} 0;
    }
    .info-value {
      font-size: ${mm(1.5)}; font-weight: 600; color: ${dark};
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      padding: ${mm(0.2)} 0;
    }
    .info-divider {
      grid-column: 1 / -1; height: 0.3px;
      background: ${hexToRgba(prim, 0.06)};
    }
    .qr-area {
      position: absolute; z-index: 4;
      ${isLand
        ? `bottom: ${mm(7)}; right: ${mm(3)}; width: ${mm(20)}; height: ${mm(20)};`
        : `bottom: ${mm(5)}; right: ${mm(2.5)}; width: ${mm(20)}; height: ${mm(20)};`
      }
      background: #fff; padding: ${mm(1.2)};
      border-radius: ${mm(1.5)};
      box-shadow: 0 ${mm(0.5)} ${mm(2)} rgba(0,0,0,0.06);
      border: 0.5px solid ${hexToRgba(prim, 0.06)};
      display: flex; align-items: center; justify-content: center;
    }
    .qr-area img, .qr-area svg { width: 100%; height: 100%; display: block; object-fit: contain; }
    .barcode-area {
      position: absolute; z-index: 4;
      ${isLand
        ? `bottom: ${mm(10)}; right: ${mm(25)}; width: ${mm(16)}; height: ${mm(6)};`
        : `bottom: ${mm(27)}; right: ${mm(3)}; width: ${mm(14)}; height: ${mm(5)};`
      }
      background: #fff; padding: ${mm(0.5)} ${mm(1)};
      border-radius: ${mm(1)}; border: 0.5px solid ${hexToRgba(prim, 0.06)};
      display: flex; align-items: center; justify-content: center;
    }
    .barcode-area svg { width: 100%; height: 100%; }
    .footer-bar {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: ${isLand ? mm(5) : mm(4.5)};
      background: linear-gradient(90deg, ${hexToRgba(prim, 0.05)}, ${hexToRgba(prim, 0.02)});
      border-top: 0.5px solid ${hexToRgba(prim, 0.08)};
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 0 ${mm(3)}; z-index: 3;
    }
    .footer-label {
      font-size: ${mm(1.3)}; font-weight: 700; color: ${muted};
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .footer-serial {
      font-size: ${mm(1.2)}; font-weight: 700; color: ${prim};
      font-family: 'Courier New', monospace;
    }
    .footer-blood {
      background: ${accent}; color: #1a1a1a;
      padding: ${mm(0.2)} ${mm(1.5)};
      border-radius: ${mm(0.6)}; font-size: ${mm(1.3)}; font-weight: 800;
    }
    .watermark {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: ${mm(10)}; font-weight: 900; color: ${prim};
      opacity: 0.02; white-space: nowrap; text-transform: uppercase;
      pointer-events: none; z-index: 0; letter-spacing: 2px;
    }
    .expiry-row {
      font-size: ${mm(1.2)}; font-weight: 600; color: ${muted};
      display: flex; gap: ${mm(0.8)};
    }
    .expiry-row .val { color: ${dark}; font-weight: 700; }
    .bottom-left-area {
      position: absolute; z-index: 4;
      ${isLand
        ? `bottom: ${mm(7)}; left: ${mm(4)};`
        : `bottom: ${mm(6)}; left: ${mm(2.5)};`
      }
      display: flex; flex-direction: column; gap: ${mm(0.6)};
    }
    .sig-line {
      width: ${mm(14)}; height: 0.4px; background: ${hexToRgba(dark, 0.2)};
    }
    .sig-label {
      font-size: ${mm(1)}; font-weight: 700; color: ${muted};
      text-transform: uppercase; letter-spacing: 0.2px;
      margin-top: ${mm(0.1)};
    }
    .accent-bar {
      position: absolute;
      ${isLand
        ? `bottom: ${mm(5)}; left: 0; width: ${mm(3)}; top: ${mm(12)};`
        : `bottom: ${mm(4.5)}; left: 0; width: ${mm(2)}; top: ${mm(9)};`
      }
      background: linear-gradient(180deg, ${hexToRgba(prim, 0.06)}, ${hexToRgba(prim, 0.02)});
      z-index: 1;
    }
  </style>
  <div class="card">
    ${bgSVG ? `<div class="card-bg">${bgSVG}</div>` : ''}
    <div class="top-stripe"></div>
    <div class="accent-bar"></div>

    ${data.design.showLogo ? `
    <div class="logo-area">
      ${data.school.logo
        ? `<img crossorigin="anonymous" src="${esc(data.school.logo)}" alt="Logo"/>`
        : `<div class="logo-placeholder">${esc(data.school.name[0])}</div>`
      }
    </div>` : ''}

    <div class="school-info">
      <div class="school-name">${esc(data.school.name)}</div>
      ${data.design.showMotto && data.school.motto ? `<div class="school-motto">${esc(data.school.motto)}</div>` : ''}
    </div>

    ${data.design.showPhoto ? `
    <div class="photo-area">
      ${photoUrl
        ? `<img crossorigin="anonymous" src="${esc(photoUrl)}" alt="Photo"/>`
        : getPhotoPlaceholderSVG(initials, prim)
      }
    </div>` : ''}

    <div class="details-area">
      <div class="person-name">${esc(name)}</div>
      <div class="person-type-badge">${personType === 'teacher' ? 'STAFF' : personType.toUpperCase()}</div>
      <div class="info-grid">
        <span class="info-label">ID</span>
        <span class="info-value">${esc(displayId)}</span>
        <div class="info-divider"></div>
        ${data.student?.className ? `<span class="info-label">Class</span><span class="info-value">${esc(data.student.className)}${data.student.section ? ' - ' + esc(data.student.section) : ''}</span><div class="info-divider"></div>` : ''}
        ${data.teacher?.department ? `<span class="info-label">Dept</span><span class="info-value">${esc(data.teacher.department)}</span><div class="info-divider"></div>` : ''}
        ${data.teacher?.designation ? `<span class="info-label">Role</span><span class="info-value">${esc(data.teacher.designation)}</span><div class="info-divider"></div>` : ''}
        ${data.student?.gender ? `<span class="info-label">Gender</span><span class="info-value">${esc(data.student.gender)}</span><div class="info-divider"></div>` : ''}
        ${data.student?.dateOfBirth ? `<span class="info-label">DOB</span><span class="info-value">${esc(data.student.dateOfBirth)}</span><div class="info-divider"></div>` : ''}
        ${data.student?.house ? `<span class="info-label">House</span><span class="info-value">${esc(data.student.house)}</span><div class="info-divider"></div>` : ''}
        ${data.student?.bloodGroup ? `<span class="info-label">Blood</span><span class="info-value"><span style="background:${accent};padding:0 ${mm(0.6)};border-radius:${mm(0.4)};font-weight:800">${esc(data.student.bloodGroup)}</span></span>` : ''}
      </div>
    </div>

    ${data.design.showQRCode ? `
    <div class="qr-area">${qrSvg}</div>` : ''}

    ${data.design.showBarcode ? `
    <div class="barcode-area">${getBarcodeSVG(serial)}</div>` : ''}

    ${data.design.showWatermark && data.design.watermarkText ? `
    <div class="watermark">${esc(data.design.watermarkText)}</div>` : ''}

    ${data.design.showSignature || data.design.showIssueDate || data.design.showExpiryDate ? `
    <div class="bottom-left-area">
      ${data.design.showIssueDate ? `<div class="expiry-row"><span>Issued</span><span class="val">${new Date().toLocaleDateString()}</span></div>` : ''}
      ${data.design.showExpiryDate ? `<div class="expiry-row"><span>Expires</span><span class="val">${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span></div>` : ''}
      ${data.design.showSignature ? `<div style="margin-top:${mm(0.3)}"><div class="sig-line"></div><div class="sig-label">Authorized Signatory</div></div>` : ''}
    </div>` : ''}

    <div class="footer-bar">
      <span class="footer-label">OFFICIAL ID</span>
      <span class="footer-serial">${esc(serial)}</span>
      ${data.student?.bloodGroup ? `<span class="footer-blood">${esc(data.student.bloodGroup)}</span>` : ''}
    </div>
  </div>`;
}

export async function renderIDCardBack(data: IDCardPreviewData): Promise<string> {
  const isLand = data.design.orientation === 'landscape';
  const cardW = isLand ? 85.6 : 53.98;
  const cardH = isLand ? 53.98 : 85.6;
  const prim = data.design.colors.primary || data.school.primaryColor || '#059669';
  const dark = data.design.colors.text || '#1e293b';
  const muted = data.design.colors.textSecondary || '#64748b';
  const bg = data.design.colors.bg || '#ffffff';
  const headerBg = data.design.colors.headerBg || prim;

  return `<style>
    .card * { margin: 0; padding: 0; box-sizing: border-box; }
    .card {
      width: ${mm(cardW)}; height: ${mm(cardH)}; position: relative; overflow: hidden;
      background: ${bg};
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      height: ${mm(8)}; background: linear-gradient(90deg, ${headerBg}, ${adjustColor(headerBg, 30)});
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 800; font-size: ${mm(2.2)};
      text-transform: uppercase; letter-spacing: 1.5px;
    }
    .content {
      padding: ${mm(3)} ${mm(3.5)};
      display: flex; flex-direction: column; gap: ${mm(2.5)};
      height: calc(100% - ${mm(8)});
      overflow: hidden;
    }
    .section-title {
      font-size: ${mm(1.5)}; font-weight: 800; color: ${prim};
      text-transform: uppercase; letter-spacing: 0.5px;
      border-bottom: 0.5px solid ${hexToRgba(prim, 0.15)};
      padding-bottom: ${mm(0.5)}; margin-bottom: ${mm(0.8)};
    }
    .info-row {
      display: flex; justify-content: space-between;
      font-size: ${mm(1.5)}; padding: ${mm(0.3)} 0;
    }
    .info-row .label { color: ${muted}; font-weight: 600; }
    .info-row .value { color: ${dark}; font-weight: 600; }
    .rules-text {
      font-size: ${mm(1.4)}; color: ${dark}; line-height: 1.5;
      padding: ${mm(1)}; background: ${hexToRgba(prim, 0.03)};
      border-radius: ${mm(1)}; border-left: 2px solid ${hexToRgba(prim, 0.2)};
    }
    .signature-area {
      position: absolute; bottom: ${mm(3)}; right: ${mm(4)};
      text-align: center;
    }
    .signature-area .sig-line {
      width: ${mm(22)}; height: 0.4px;
      background: ${hexToRgba(dark, 0.25)}; margin: 0 auto;
    }
    .signature-area .sig-label {
      font-size: ${mm(1.3)}; font-weight: 700; color: ${muted};
      text-transform: uppercase; margin-top: ${mm(0.5)};
      letter-spacing: 0.3px;
    }
    .bottom-stripe {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: ${mm(1.5)};
      background: linear-gradient(90deg, ${headerBg}, ${adjustColor(headerBg, 30)});
    }
  </style>
  <div class="card">
    <div class="header">Terms &amp; Information</div>
    <div class="content">
      ${data.design.showEmergencyInfo ? `
      <div>
        <div class="section-title">Emergency Contact</div>
        <div class="info-row"><span class="label">Phone</span><span class="value">${esc(data.student?.emergencyContact || 'N/A')}</span></div>
      </div>` : ''}
      ${data.design.showMedicalInfo && data.student?.bloodGroup ? `
      <div>
        <div class="section-title">Medical Info</div>
        <div class="info-row"><span class="label">Blood Group</span><span class="value">${esc(data.student.bloodGroup)}</span></div>
      </div>` : ''}
      ${data.design.showAddress && data.school.address ? `
      <div>
        <div class="section-title">School Address</div>
        <div class="info-row"><span class="label">Address</span><span class="value">${esc(data.school.address)}</span></div>
        ${data.school.website ? `<div class="info-row"><span class="label">Website</span><span class="value">${esc(data.school.website)}</span></div>` : ''}
        ${data.school.phone ? `<div class="info-row"><span class="label">Phone</span><span class="value">${esc(data.school.phone)}</span></div>` : ''}
      </div>` : ''}
      ${data.design.showTerms ? `
      <div>
        <div class="section-title">Rules &amp; Regulations</div>
        <div class="rules-text">${esc(data.design.backText || 'This card is the property of the school. Report loss immediately.')}</div>
      </div>` : ''}
    </div>
    ${data.design.showSignature ? `
    <div class="signature-area">
      <div class="sig-line"></div>
      <div class="sig-label">Authorized Signatory</div>
    </div>` : ''}
    <div class="bottom-stripe"></div>
  </div>`;
}
