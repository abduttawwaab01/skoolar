import type { IDCardPreviewData, CardOrientation } from './types';

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
  const r = num >> 16;
  const g = (num >> 8) & 0x00ff;
  const b = num & 0x0000ff;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function generateQRDataUrl(text: string): string {
  const qr: string[] = [];
  const len = text.length;
  for (let i = 0; i < 25; i++) {
    let row = '';
    for (let j = 0; j < 25; j++) {
      row += (i * j + i + j) % 3 === 0 || (i + j) % 5 === 0 ? '1' : '0';
    }
    qr.push(row);
  }
  const svgParts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" width="100%" height="100%">`];
  for (let i = 0; i < 25; i++) {
    for (let j = 0; j < 25; j++) {
      if (qr[i][j] === '1') {
        svgParts.push(`<rect x="${j}" y="${i}" width="1" height="1" fill="#1a1a2e"/>`);
      }
    }
  }
  svgParts.push(`</svg>`);
  return svgParts.join('');
}

function mm(val: number): string {
  return `${val}mm`;
}

function generateDotsPattern(primary: string): string {
  return `<pattern id="dots" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="0.5" fill="${hexToRgba(primary, 0.08)}"/>
  </pattern>`;
}

function generateGridPattern(primary: string): string {
  return `<pattern id="grid" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
    <path d="M 5 0 L 0 0 0 5" fill="none" stroke="${hexToRgba(primary, 0.06)}" stroke-width="0.3"/>
  </pattern>`;
}

function getPhotoPlaceholderSVG(initials: string, primary: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">
    <rect width="100" height="120" fill="${hexToRgba(primary, 0.1)}" rx="4"/>
    <text x="50" y="65" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui" font-size="36" font-weight="700" fill="${primary}" opacity="0.3">
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
  const primLight = hexToRgba(prim, 0.08);
  const name = data.student ? data.student.name : (data.teacher ? data.teacher.name : 'Name');
  const initials = name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const photoUrl = data.student?.photo || data.teacher?.photo || null;
  const displayId = data.student ? data.student.admissionNo : (data.teacher ? data.teacher.employeeNo || '' : '');
  const personType = data.design.type;

  const patternSVG = data.design.backgroundType === 'dots' ? generateDotsPattern(prim) :
    data.design.backgroundType === 'grid' ? generateGridPattern(prim) : '';

  const qrSvg = data.qrCodeDataUrl || generateQRDataUrl('skoolar://id-card');
  const serial = data.serialNumber || `SKL-${Date.now().toString(36).toUpperCase()}`;
  const session = data.student?.academicSession || new Date().getFullYear().toString();

  return `<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
.card {
.card-bg-pattern svg { width: 100%; height: 100%; }
.card-bg-accent { position: absolute; }
.side-stripe {
  position: absolute; top: 0; left: 0; width: ${mm(3.5)}; bottom: 0;
  background: linear-gradient(180deg, ${headerBg}, ${adjustColor(headerBg, 20)});
}
.top-bar {
  position: absolute; top: 0; left: ${mm(3.5)}; right: 0;
  height: ${isLand ? mm(42) : mm(28)};
  overflow: visible;
}
.logo-area {
  position: absolute;
  ${isLand
    ? `top: ${mm(2.5)}; left: ${mm(5)}; width: ${mm(9)}; height: ${mm(9)};`
    : `top: ${mm(3)}; left: 50%; transform: translateX(-50%); width: ${mm(10)}; height: ${mm(10)};`
  }
}
.logo-area img, .logo-placeholder {
  width: 100%; height: 100%; border-radius: ${mm(1.5)}; object-fit: contain;
}
.logo-placeholder {
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.15); color: #fff;
  font-weight: 900; font-size: ${mm(4)}; border-radius: ${mm(1.5)};
}
.school-info {
  position: absolute;
  ${isLand
    ? `top: ${mm(2.5)}; left: ${mm(15)}; right: ${mm(3)};`
    : `top: ${mm(14.5)}; left: ${mm(2)}; right: ${mm(2)}; text-align: center;`
  }
}
.school-name {
  font-weight: 800; font-size: ${isLand ? mm(3.2) : mm(2.6)};
  color: #fff; letter-spacing: 0.3px; line-height: 1.1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.school-motto {
  font-size: ${isLand ? mm(1.5) : mm(1.3)};
  color: rgba(255,255,255,0.75); font-style: italic;
  margin-top: ${mm(0.5)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.photo-area {
  position: absolute;
  ${isLand
    ? `top: ${mm(13)}; left: ${mm(5)}; width: ${mm(22)}; height: ${mm(30)};`
    : `top: ${mm(29.5)}; left: 50%; transform: translateX(-50%); width: ${mm(24)}; height: ${mm(28)};`
  }
  border-radius: ${mm(2.5)}; overflow: hidden;
  border: 1.5px solid ${hexToRgba(prim, 0.2)};
  background: ${hexToRgba(prim, 0.04)};
  box-shadow: 0 ${mm(0.5)} ${mm(1.5)} rgba(0,0,0,0.08);
  display: flex; align-items: center; justify-content: center;
}
.photo-area img, .photo-area svg {
  width: 100%; height: 100%; object-fit: cover;
}
.details-area {
  position: absolute;
  ${isLand
    ? `top: ${mm(13)}; left: ${mm(29)}; right: ${mm(14)};`
    : `top: ${mm(59)}; left: ${mm(3)}; right: ${mm(3)};`
  }
  display: flex; flex-direction: column;
  ${isLand ? '' : 'align-items: center;'}
  gap: ${mm(1)};
}
.person-name {
  font-weight: 800; font-size: ${isLand ? mm(4.5) : mm(4)};
  color: ${dark}; line-height: 1.1;
  ${isLand ? '' : 'text-align: center;'}
}
.person-type-badge {
  background: ${prim}; color: #fff;
  padding: ${mm(0.5)} ${mm(2)}; border-radius: ${mm(1)};
  font-size: ${mm(1.6)}; font-weight: 700; text-transform: uppercase;
  display: inline-block; align-self: ${isLand ? 'flex-start' : 'center'};
  letter-spacing: 0.5px;
}
.info-grid {
  display: grid;
  grid-template-columns: ${isLand ? 'auto 1fr' : 'auto 1fr'};
  column-gap: ${isLand ? mm(3) : mm(2)}; row-gap: ${mm(0.6)};
  margin-top: ${mm(1.2)}; width: 100%;
}
.info-label {
  font-size: ${mm(1.4)}; font-weight: 600; color: ${muted};
  text-transform: uppercase; letter-spacing: 0.3px;
  white-space: nowrap;
}
.info-value {
  font-size: ${mm(1.7)}; font-weight: 600; color: ${dark};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.qr-area {
  position: absolute;
  ${isLand
    ? `top: ${mm(16)}; right: ${mm(3)}; width: ${mm(14)}; height: ${mm(14)};`
    : `bottom: ${mm(10)}; right: ${mm(3)}; width: ${mm(11)}; height: ${mm(11)};`
  }
}
.qr-area svg { width: 100%; height: 100%; }
.footer-bar {
  position: absolute; bottom: 0; left: ${mm(3.5)}; right: 0;
  height: ${mm(5.5)}; border-top: 0.5px solid ${hexToRgba(prim, 0.12)};
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 0 ${mm(3)}; background: ${hexToRgba(prim, 0.03)};
}
.footer-label {
  font-size: ${mm(1.5)}; font-weight: 700; color: ${muted};
  text-transform: uppercase; letter-spacing: 0.5px;
}
.footer-serial {
  font-size: ${mm(1.4)}; font-weight: 700; color: ${prim};
  font-family: 'Courier New', monospace;
}
.footer-blood {
  background: ${data.design.colors.accent || '#fbbf24'};
  color: #1a1a1a; padding: ${mm(0.3)} ${mm(1.5)};
  border-radius: ${mm(0.8)}; font-size: ${mm(1.5)}; font-weight: 800;
}
.watermark {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-25deg);
  font-size: ${mm(10)}; font-weight: 900; color: ${prim};
  opacity: 0.03; white-space: nowrap; text-transform: uppercase;
  pointer-events: none;
}
</style>
<div class="card">
  ${data.design.backgroundType === 'dots' || data.design.backgroundType === 'grid' ? `
  <div class="card-bg-pattern">
    <svg xmlns="http://www.w3.org/2000/svg" width="${mm(cardW)}" height="${mm(cardH)}">
      <defs>${patternSVG}</defs>
      <rect width="100%" height="100%" fill="url(#${data.design.backgroundType})"/>
    </svg>
  </div>` : ''}
  <div class="side-stripe"></div>

  <div class="top-bar" style="background: linear-gradient(135deg, ${headerBg}, ${adjustColor(headerBg, 20)});">
    ${data.design.showLogo ? `
    <div class="logo-area">
      ${data.school.logo
        ? `<img src="${esc(data.school.logo)}" alt="Logo"/>`
        : `<div class="logo-placeholder">${esc(data.school.name[0])}</div>`
      }
    </div>` : ''}
    <div class="school-info">
      <div class="school-name">${esc(data.school.name)}</div>
      ${data.design.showMotto && data.school.motto ? `<div class="school-motto">${esc(data.school.motto)}</div>` : ''}
    </div>
  </div>

  ${data.design.showPhoto ? `
  <div class="photo-area">
    ${photoUrl
      ? `<img src="${esc(photoUrl)}" alt="Photo"/>`
      : `${getPhotoPlaceholderSVG(initials, prim)}`
    }
  </div>` : ''}

  <div class="details-area">
    <div class="person-name">${esc(name)}</div>
    <div class="person-type-badge">${personType === 'teacher' ? 'STAFF' : personType.toUpperCase()}</div>
    <div class="info-grid">
      <span class="info-label">ID</span>
      <span class="info-value">${esc(displayId)}</span>
      ${data.student?.className ? `<span class="info-label">Class</span><span class="info-value">${esc(data.student.className)}${data.student.section ? ' - ' + esc(data.student.section) : ''}</span>` : ''}
      ${data.teacher?.department ? `<span class="info-label">Dept</span><span class="info-value">${esc(data.teacher.department)}</span>` : ''}
      ${data.teacher?.designation ? `<span class="info-label">Role</span><span class="info-value">${esc(data.teacher.designation)}</span>` : ''}
      ${data.student?.gender ? `<span class="info-label">Gender</span><span class="info-value">${esc(data.student.gender)}</span>` : ''}
      ${data.student?.house ? `<span class="info-label">House</span><span class="info-value">${esc(data.student.house)}</span>` : ''}
      ${data.student?.dateOfBirth ? `<span class="info-label">DOB</span><span class="info-value">${esc(data.student.dateOfBirth)}</span>` : ''}
    </div>
  </div>

  ${data.design.showQRCode ? `
  <div class="qr-area">${qrSvg}</div>` : ''}

  ${data.design.showWatermark && data.design.watermarkText ? `
  <div class="watermark">${esc(data.design.watermarkText)}</div>` : ''}

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
* { margin: 0; padding: 0; box-sizing: border-box; }
.card { width: ${mm(cardW)}; height: ${mm(cardH)}; position: relative; overflow: hidden; background: ${bg};
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.header {
  height: ${mm(8)}; background: linear-gradient(90deg, ${headerBg}, ${adjustColor(headerBg, 30)});
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 800; font-size: ${mm(2)}; text-transform: uppercase; letter-spacing: 1px;
}
.content {
  padding: ${mm(3)}; display: flex; flex-direction: column; gap: ${mm(2)};
}
.section-title {
  font-size: ${mm(1.5)}; font-weight: 800; color: ${prim};
  text-transform: uppercase; letter-spacing: 0.5px;
  border-bottom: 0.5px solid ${hexToRgba(prim, 0.2)};
  padding-bottom: ${mm(0.5)}; margin-bottom: ${mm(1)};
}
.info-row { display: flex; justify-content: space-between; font-size: ${mm(1.4)}; padding: ${mm(0.3)} 0; }
.info-row .label { color: ${muted}; font-weight: 600; }
.info-row .value { color: ${dark}; font-weight: 600; }
.rules-text { font-size: ${mm(1.3)}; color: ${dark}; line-height: 1.5; }
.signature-area {
  position: absolute; bottom: ${mm(3)}; right: ${mm(4)};
  text-align: center;
}
.signature-area .sig-label {
  font-size: ${mm(1.2)}; font-weight: 700; color: ${muted}; text-transform: uppercase;
  margin-top: ${mm(0.5)};
}
.signature-area .sig-line {
  width: ${mm(20)}; height: 0.3px; background: ${hexToRgba(dark, 0.3)}; margin: 0 auto;
}
</style>
<div class="card">
  <div class="header">Terms &amp; Information</div>
  <div class="content">
    ${data.design.showEmergencyInfo ? `
    <div>
      <div class="section-title">Emergency Contact</div>
      <div class="info-row"><span class="label">Name</span><span class="value">${esc(data.student?.parentName || 'N/A')}</span></div>
      <div class="info-row"><span class="label">Phone</span><span class="value">${esc(data.student?.parentPhone || data.student?.emergencyContact || 'N/A')}</span></div>
    </div>` : ''}
    ${data.design.showMedicalInfo && data.student?.bloodGroup ? `
    <div>
      <div class="section-title">Medical Info</div>
      <div class="info-row"><span class="label">Blood Group</span><span class="value">${esc(data.student.bloodGroup)}</span></div>
      ${data.student?.emergencyContact ? `<div class="info-row"><span class="label">Allergies</span><span class="value">${esc(data.student.emergencyContact || 'None')}</span></div>` : ''}
    </div>` : ''}
    ${data.design.showAddress && data.school.address ? `
    <div>
      <div class="section-title">School Address</div>
      <div class="info-row"><span class="value">${esc(data.school.address)}</span></div>
      <div class="info-row"><span class="label">Website</span><span class="value">${esc(data.school.website || 'N/A')}</span></div>
    </div>` : ''}
    ${data.design.showTerms ? `
    <div>
      <div class="section-title">Rules</div>
      <div class="rules-text">${esc(data.design.backText || 'This card is the property of the school. Report loss immediately.')}</div>
    </div>` : ''}
  </div>
  ${data.design.showSignature ? `
  <div class="signature-area">
    <div class="sig-line"></div>
    <div class="sig-label">Authorized Signatory</div>
  </div>` : ''}
</div>`;
}
