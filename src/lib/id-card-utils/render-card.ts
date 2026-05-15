import QRCode from 'qrcode';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { getFontFaceCSS } from './font-loader';

const MM_PX = (mm: number) => Math.round((mm / 25.4) * 300);
const DPI = 300;

// Portrait = taller (53.98×85.6mm / 637×1011px)
// Landscape = wider (85.6×53.98mm / 1011×637px)
const PW = MM_PX(53.98), PH = MM_PX(85.6);
const LW = MM_PX(85.6), LH = MM_PX(53.98);

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function px(v: number): string { return Math.round(v) + ''; }

function adjustColor(c: string, amt: number): string {
  const h = c.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(h.substr(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(h.substr(2, 2), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(h.substr(4, 2), 16) + amt));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function contrastText(bgHex: string): string {
  const h = bgHex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1a1a1a' : '#ffffff';
}

function lighten(c: string, amt: number): string {
  return adjustColor(c, amt);
}

function darken(c: string, amt: number): string {
  return adjustColor(c, -amt);
}

export async function renderIDCard(
  person: any,
  colors: { primary: string; secondary: string },
  backText: string,
  showPhoto: boolean,
  _showBarcode: boolean,
  showQR: boolean,
  orientation: string,
  photoUrl: string | null,
  role: string,
  isBack = false
): Promise<Buffer> {
  const port = orientation === 'portrait';
  const W = port ? PW : LW;
  const H = port ? PH : LH;
  const personType = person.type || (role === 'STUDENT' ? 'student' : 'staff');
  const prim = colors.primary || '#059669';
  const sec = colors.secondary || '#FFFFFF';
  const txtColor = '#1e293b';
  const mutedColor = '#64748b';
  const borderColor = darken(sec, 20);

  // ── QR code ──
  let qrBase64 = '';
  if (showQR && !isBack) {
    try {
      const qrBuf = await QRCode.toBuffer(JSON.stringify({
        type: personType,
        id: esc(person.displayId || person.admissionNo || person.employeeNo || 'N/A'),
        userId: person.userId || '',
        personId: person.id || person.personId || '',
        schoolId: person.schoolId || '',
        name: esc(person.name || ''),
        role,
        timestamp: Date.now(),
      }), {
        width: port ? 200 : 220,
        margin: 2,
        color: { dark: prim, light: '#ffffff' },
      });
      qrBase64 = qrBuf.toString('base64');
    } catch (_) {}
  }

  // ── School info ──
  let sn = 'School', sa = '', spEmail = '', spPhone = '';
  if (person.schoolId) {
    try {
      const s = await db.school.findUnique({
        where: { id: person.schoolId },
        select: { name: true, address: true, phone: true, email: true, logo: true },
      });
      if (s) {
        sn = s.name || 'School';
        sa = s.address || '';
        spPhone = s.phone || '';
        spEmail = s.email || '';
      }
    } catch (_) {}
  }

  // ── Values ──
  const pName = esc(person.name || 'Unknown');
  const pId = esc(person.displayId || 'N/A');
  const pClass = esc(person.class || 'N/A');
  const pGender = esc(person.gender || '');
  const pPhone = esc(person.phone || '');
  const pRl = esc(role);
  const sName = esc(sn.substring(0, port ? 22 : 30));
  const sAddr = esc(sa);
  const sPh = esc(spPhone);
  const sEm = esc(spEmail);
  const initials = esc((person.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'NA');
  const bText = esc(backText);

  // ── Photo ──
  let photoEl = '';
  let hasRealPhoto = false;
  if (showPhoto) {
    let b64 = '', mime = 'image/jpeg';
    if (photoUrl) {
      try {
        const url = photoUrl.startsWith('/') ? photoUrl.startsWith('//') ? `https:${photoUrl}` : photoUrl
          : photoUrl.startsWith('http') ? photoUrl : `https://skoolar.org${photoUrl}`;
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);  // 8 seconds for slow networks
        const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Skoolar-ID/1.0' } });
        clearTimeout(tid);
        if (r.ok) {
          const ct = r.headers.get('content-type') || '';
          if (ct.startsWith('image/')) {
            const ab = await r.arrayBuffer();
            b64 = Buffer.from(new Uint8Array(ab)).toString('base64');
            mime = ct;
          }
        }
      } catch (_) {}
    }
    if (b64 && b64.length > 100) {
      // Check if data URL is too large (>2MB would be excessive)
      if (b64.length > 2_097_152) {
        console.warn(`Photo too large (${b64.length} bytes), skipping for performance`);
        b64 = '';
      } else {
        hasRealPhoto = true;
      if (port) {
        const d = Math.round(W * 0.32);
        const cx = Math.round(W * 0.22);
        const cy = Math.round(H * 0.24);
        const r4 = Math.round(d * 0.5);
        photoEl = `
<defs>
  <clipPath id="pc"><circle cx="${px(cx)}" cy="${px(cy)}" r="${px(Math.round(d * 0.5) - 2)}"/></clipPath>
</defs>
<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(Math.round(d * 0.5) + 4)}" fill="${prim}" opacity="0.85"/>
<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(Math.round(d * 0.5) + 1)}" fill="#fff"/>
<image x="${px(cx - Math.round(d * 0.5) + 2)}" y="${px(cy - Math.round(d * 0.5) + 2)}" width="${px(d - 4)}" height="${px(d - 4)}" href="data:${mime};base64,${b64}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>`;
      } else {
        const d = Math.round(H * 0.56);
        const cx = Math.round(W * 0.14);
        const cy = Math.round(H * 0.52);
        const r4 = Math.round(d * 0.5);
        photoEl = `
<defs>
  <clipPath id="pc"><circle cx="${px(cx)}" cy="${px(cy)}" r="${px(Math.round(d * 0.5) - 2)}"/></clipPath>
</defs>
<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(Math.round(d * 0.5) + 4)}" fill="${prim}" opacity="0.85"/>
<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(Math.round(d * 0.5) + 1)}" fill="#fff"/>
<image x="${px(cx - Math.round(d * 0.5) + 2)}" y="${px(cy - Math.round(d * 0.5) + 2)}" width="${px(d - 4)}" height="${px(d - 4)}" href="data:${mime};base64,${b64}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>`;
      }
    }
  }

  // ── Layout constants ──
  const radius = Math.round(W * 0.025);
  const margin = Math.round(W * 0.045);
  const hdrH = port ? Math.round(H * 0.085) : Math.round(H * 0.12);
  const hdrFs = port ? Math.round(H * 0.022) : Math.round(H * 0.022);
  const hdrSubFs = port ? Math.round(H * 0.016) : Math.round(H * 0.016);

  // ── Front layout ──
  let frontContent = '';

  if (port) {
    // === PORTRAIT LAYOUT ===
    const photoD = Math.round(W * 0.32);
    const photoCX = Math.round(W * 0.22);
    const photoCY = Math.round(H * 0.24);

    const txtLeft = Math.round(W * 0.44);
    const txtTop = Math.round(H * 0.185);
    const nameFs = Math.round(H * 0.036);
    const roleFs = Math.round(H * 0.018);
    const roleBadgeH = Math.round(H * 0.028);
    const detailFs = Math.round(H * 0.018);
    const detailLh = Math.round(H * 0.032);
    const labelColor = mutedColor;

    // Info rows
    const infoRows: { lab: string; val: string }[] = [];
    if (personType === 'student') {
      infoRows.push({ lab: 'ID', val: pId });
      infoRows.push({ lab: 'Class', val: pClass });
      if (pGender) infoRows.push({ lab: 'Gender', val: pGender });
    } else {
      infoRows.push({ lab: 'ID', val: pId });
      if (pRl) infoRows.push({ lab: 'Role', val: pRl });
      if (pPhone) infoRows.push({ lab: 'Phone', val: pPhone });
    }

    const infoStartY = Math.round(txtTop + nameFs + H * 0.035 + roleBadgeH + H * 0.025);

    // QR code position (bottom area, centered, with dedicated card area)
    const qrSz = Math.round(W * 0.30);
    const qrCardW = Math.round(W * 0.70);
    const qrCardH = Math.round(qrSz + H * 0.055);
    const qrCardX = Math.round((W - qrCardW) / 2);
    const qrCardY = Math.round(H - qrCardH - margin);
    const qrX = Math.round(qrCardX + (qrCardW - qrSz) / 2);
    const qrY = Math.round(qrCardY + H * 0.015);

    const footerY = Math.round(H - Math.round(H * 0.018));

    // Build info text
    let infoText = '';
    infoRows.forEach((r, i) => {
      const y = infoStartY + i * detailLh;
      infoText += `<text x="${px(txtLeft)}" y="${px(y)}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(detailFs)}" fill="${labelColor}">${esc(r.lab)}</text>
<text x="${px(txtLeft + W * 0.18)}" y="${px(y)}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(detailFs)}" font-weight="bold" fill="${txtColor}">${r.val}</text>`;
    });

    frontContent = `
<!-- Photo (circular, left side) -->
${hasRealPhoto ? photoEl : `
<circle cx="${px(photoCX)}" cy="${px(photoCY)}" r="${px(Math.round(photoD * 0.5) + 4)}" fill="${prim}" opacity="0.85"/>
<circle cx="${px(photoCX)}" cy="${px(photoCY)}" r="${px(Math.round(photoD * 0.5) + 1)}" fill="#fff"/>
<circle cx="${px(photoCX)}" cy="${px(photoCY)}" r="${px(Math.round(photoD * 0.5) - 2)}" fill="${prim}" opacity="0.06"/>
<circle cx="${px(photoCX)}" cy="${px(photoCY)}" r="${px(Math.round(photoD * 0.32))}" fill="${prim}" opacity="0.10"/>
<text x="${px(photoCX)}" y="${px(photoCY + Math.round(photoD * 0.06))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(photoD * 0.42))}" font-weight="bold" fill="${prim}" text-anchor="middle" opacity="0.5">${initials}</text>
<text x="${px(photoCX)}" y="${px(photoCY + Math.round(photoD * 0.40))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(photoD * 0.09))}" fill="${mutedColor}" text-anchor="middle">PHOTO</text>`}

<!-- Name -->
<text x="${px(txtLeft)}" y="${px(txtTop + nameFs)}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(nameFs)}" font-weight="bold" fill="${txtColor}">${pName}</text>

<!-- Role badge -->
<rect x="${px(txtLeft)}" y="${px(txtTop + nameFs + H * 0.02)}" width="${px(Math.round(W * 0.16))}" height="${px(roleBadgeH)}" rx="${px(Math.round(roleBadgeH * 0.5))}" fill="${prim}" opacity="0.10"/>
<text x="${px(txtLeft + Math.round(W * 0.08))}" y="${px(txtTop + nameFs + H * 0.02 + Math.round(roleBadgeH * 0.68))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(roleFs)}" font-weight="bold" fill="${prim}" text-anchor="middle" letter-spacing="1">${pRl}</text>

<!-- Info rows -->
${infoText}

<!-- QR code card container -->
<rect x="${px(qrCardX)}" y="${px(qrCardY)}" width="${px(qrCardW)}" height="${px(qrCardH)}" rx="${px(Math.round(W * 0.018))}" fill="#f8fafc" stroke="${borderColor}" stroke-width="1"/>
${showQR && qrBase64 ? `
<image x="${px(qrX)}" y="${px(qrY)}" width="${px(qrSz)}" height="${px(qrSz)}" href="data:image/png;base64,${qrBase64}"/>
<text x="${px(Math.round(W * 0.5))}" y="${px(Math.round(qrCardY + qrCardH - H * 0.008))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(qrSz * 0.10))}" font-weight="bold" fill="${prim}" text-anchor="middle" letter-spacing="2">SCAN ME</text>` : ''}

<!-- Separator line -->
<line x1="${px(margin)}" y1="${px(qrCardY - Math.round(H * 0.012))}" x2="${px(W - margin)}" y2="${px(qrCardY - Math.round(H * 0.012))}" stroke="${borderColor}" stroke-width="0.5" opacity="0.3"/>
`;
  } else {
    // === LANDSCAPE LAYOUT ===
    const photoD = Math.round(H * 0.56);
    const photoCX = Math.round(W * 0.14);
    const photoCY = Math.round(H * 0.52);

    const txtLeft = Math.round(W * 0.34);
    const nameFs = Math.round(H * 0.065);
    const roleFs = Math.round(H * 0.028);
    const roleBadgeH = Math.round(H * 0.045);
    const detailFs = Math.round(H * 0.028);
    const detailLh = Math.round(H * 0.048);
    const labelColor = mutedColor;

    const infoRows: { lab: string; val: string }[] = [];
    if (personType === 'student') {
      infoRows.push({ lab: 'ID', val: pId });
      infoRows.push({ lab: 'Class', val: pClass });
      if (pGender) infoRows.push({ lab: 'Gender', val: pGender });
    } else {
      infoRows.push({ lab: 'ID', val: pId });
      if (pRl) infoRows.push({ lab: 'Role', val: pRl });
      if (pPhone) infoRows.push({ lab: 'Phone', val: pPhone });
    }

    const infoStartY = Math.round(H * 0.42 + nameFs + H * 0.035 + roleBadgeH + H * 0.025);

    // QR position (right side)
    const qrSz = Math.round(H * 0.36);
    const qrCardW = Math.round(qrSz + H * 0.08);
    const qrCardH = Math.round(qrSz + H * 0.08);
    const qrCardX = Math.round(W - qrCardW - margin);
    const qrCardY = Math.round((H - qrCardH) / 2);
    const qrX = Math.round(qrCardX + (qrCardW - qrSz) / 2);
    const qrY = Math.round(qrCardY + H * 0.022);

    const footerY = Math.round(H - Math.round(H * 0.028));

    let infoText = '';
    infoRows.forEach((r, i) => {
      const y = infoStartY + i * detailLh;
      infoText += `<text x="${px(txtLeft)}" y="${px(y)}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(detailFs)}" fill="${labelColor}">${esc(r.lab)}</text>
<text x="${px(txtLeft + W * 0.12)}" y="${px(y)}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(detailFs)}" font-weight="bold" fill="${txtColor}">${r.val}</text>`;
    });

    frontContent = `
<!-- Photo -->
${hasRealPhoto ? photoEl : `
<circle cx="${px(photoCX)}" cy="${px(photoCY)}" r="${px(Math.round(photoD * 0.5) + 4)}" fill="${prim}" opacity="0.85"/>
<circle cx="${px(photoCX)}" cy="${px(photoCY)}" r="${px(Math.round(photoD * 0.5) + 1)}" fill="#fff"/>
<circle cx="${px(photoCX)}" cy="${px(photoCY)}" r="${px(Math.round(photoD * 0.5) - 2)}" fill="${prim}" opacity="0.06"/>
<circle cx="${px(photoCX)}" cy="${px(photoCY)}" r="${px(Math.round(photoD * 0.32))}" fill="${prim}" opacity="0.10"/>
<text x="${px(photoCX)}" y="${px(photoCY + Math.round(photoD * 0.06))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(photoD * 0.42))}" font-weight="bold" fill="${prim}" text-anchor="middle" opacity="0.5">${initials}</text>
<text x="${px(photoCX)}" y="${px(photoCY + Math.round(photoD * 0.40))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(photoD * 0.09))}" fill="${mutedColor}" text-anchor="middle">PHOTO</text>`}

<!-- Name -->
<text x="${px(txtLeft)}" y="${px(Math.round(H * 0.42))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(nameFs)}" font-weight="bold" fill="${txtColor}">${pName}</text>

<!-- Role badge -->
<rect x="${px(txtLeft)}" y="${px(Math.round(H * 0.42) + Math.round(H * 0.018))}" width="${px(Math.round(W * 0.10))}" height="${px(roleBadgeH)}" rx="${px(Math.round(roleBadgeH * 0.5))}" fill="${prim}" opacity="0.10"/>
<text x="${px(txtLeft + Math.round(W * 0.05))}" y="${px(Math.round(H * 0.42) + Math.round(H * 0.018) + Math.round(roleBadgeH * 0.68))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(roleFs)}" font-weight="bold" fill="${prim}" text-anchor="middle" letter-spacing="1">${pRl}</text>

<!-- Info rows -->
${infoText}

<!-- QR code card container -->
<rect x="${px(qrCardX)}" y="${px(qrCardY)}" width="${px(qrCardW)}" height="${px(qrCardH)}" rx="${px(Math.round(H * 0.025))}" fill="#f8fafc" stroke="${borderColor}" stroke-width="1"/>
${showQR && qrBase64 ? `
<image x="${px(qrX)}" y="${px(qrY)}" width="${px(qrSz)}" height="${px(qrSz)}" href="data:image/png;base64,${qrBase64}"/>
<text x="${px(qrCardX + qrCardW / 2)}" y="${px(qrCardY + qrCardH - Math.round(H * 0.015))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(qrSz * 0.10))}" font-weight="bold" fill="${prim}" text-anchor="middle" letter-spacing="2">SCAN ME</text>` : ''}

<!-- Separator line -->
<line x1="${px(qrCardX - Math.round(W * 0.015))}" y1="${px(margin)}" x2="${px(qrCardX - Math.round(W * 0.015))}" y2="${px(H - margin)}" stroke="${borderColor}" stroke-width="0.5" opacity="0.25"/>
`;
  }

  // ── Back card ──
  const backLines = isBack && bText ? bText.split('\n') : [];
  let backContent = '';
  if (isBack) {
    const sections = [
      { title: 'CONTACT', lines: [sAddr, sPh, sEm].filter(l => l) },
    ];
    if (backLines.length > 0) {
      sections.push({ title: 'IMPORTANT', lines: backLines.filter(l => l.trim()) });
    }

    let secY = Math.round(H * 0.18);
    const secGap = Math.round(H * 0.04);

    backContent = `
<!-- School name on back -->
<text x="50%" y="${px(Math.round(H * 0.10))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(H * 0.020))}" font-weight="bold" fill="${prim}" text-anchor="middle" letter-spacing="1">${sName}</text>
<line x1="50%" y1="${px(Math.round(H * 0.105))}" x2="50%" y2="${px(Math.round(H * 0.11))}" stroke="${prim}" stroke-width="2"/>
<text x="50%" y="${px(Math.round(H * 0.14))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(H * 0.015))}" fill="${mutedColor}" text-anchor="middle" letter-spacing="3">ID CARD — BACK</text>

${sections.map(sec => {
  const tY = secY;
  const lh = Math.round(H * 0.026);
  secY += Math.round(H * 0.035);
  const linesHtml = sec.lines.map((l, li) => {
    const ly = secY + li * lh;
    return `<text x="${px(Math.round(W * 0.08))}" y="${px(ly)}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(H * 0.014))}" fill="${txtColor}">${esc(l)}</text>`;
  }).join('\n');
  secY += sec.lines.length * lh + secGap;
  return `
<text x="${px(Math.round(W * 0.08))}" y="${px(tY)}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(H * 0.014))}" font-weight="bold" fill="${prim}" letter-spacing="2">${sec.title}</text>
<line x1="${px(Math.round(W * 0.08))}" y1="${px(tY + Math.round(H * 0.005))}" x2="${px(Math.round(W * 0.92))}" y2="${px(tY + Math.round(H * 0.005))}" stroke="${prim}" stroke-width="0.5" opacity="0.25"/>
${linesHtml}`;
}).join('\n')}

<!-- Return info -->
<text x="50%" y="${px(Math.round(H * 0.88))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(Math.round(H * 0.012))}" fill="${mutedColor}" text-anchor="middle">If found, please return to the school office</text>`;
  }

  // ── Build header ──
  const headerLabel = esc(port ? 'IDENTIFICATION CARD' : 'STAFF ID CARD');

  const header = `
<!-- Top header bar -->
<rect x="0" y="0" width="100%" height="${px(hdrH)}" fill="${prim}"/>
<rect x="0" y="0" width="100%" height="${px(hdrH)}" fill="url(#hdrGrad)"/>
<path d="M0 ${px(hdrH)} Q${px(Math.round(W * 0.1))} ${px(hdrH + 4)} ${px(Math.round(W * 0.2))} ${px(hdrH)} Q${px(Math.round(W * 0.3))} ${px(hdrH - 4)} ${px(Math.round(W * 0.4))} ${px(hdrH)} Q${px(Math.round(W * 0.5))} ${px(hdrH + 4)} ${px(Math.round(W * 0.6))} ${px(hdrH)} Q${px(Math.round(W * 0.7))} ${px(hdrH - 4)} ${px(Math.round(W * 0.8))} ${px(hdrH)} Q${px(Math.round(W * 0.9))} ${px(hdrH + 4)} ${px(W)} ${px(hdrH)}" fill="${prim}"/>

<text x="${px(margin)}" y="${px(Math.round(hdrH * 0.62))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(hdrFs)}" font-weight="bold" fill="#fff">${sName}</text>
<text x="${px(W - margin)}" y="${px(Math.round(hdrH * 0.62))}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(hdrSubFs)}" fill="rgba(255,255,255,0.85)" text-anchor="end" letter-spacing="2">ID CARD</text>
`;

  // ── Footer ──
  const wmFs = port ? Math.round(H * 0.008) : Math.round(H * 0.012);
  const wmY = port ? Math.round(H - Math.round(H * 0.012)) : Math.round(H - Math.round(H * 0.015));
  const footer = `
<!-- Footer -->
<rect x="0" y="${px(H - Math.round(H * 0.030))}" width="100%" height="${px(Math.round(H * 0.030))}" fill="${prim}" opacity="0.035"/>
<text x="50%" y="${px(wmY)}" font-family="Arial, Helvetica, system-ui, -apple-system, sans-serif" font-size="${px(wmFs)}" fill="${mutedColor}" text-anchor="middle" opacity="0.6">Skoolar — Odebunmi Tawwāb</text>
`;

  // ── Background decorative elements ──
  const bgDecor = `
<!-- Subtle background decoration -->
<circle cx="${px(Math.round(W * 0.08))}" cy="${px(Math.round(H * 0.08))}" r="${px(Math.round(W * 0.35))}" fill="${prim}" opacity="0.015"/>
<circle cx="${px(Math.round(W * 0.90))}" cy="${px(Math.round(H * 0.88))}" r="${px(Math.round(W * 0.25))}" fill="${prim}" opacity="0.012"/>
<rect x="${px(Math.round(W * 0.015))}" y="${px(Math.round(H * 0.015))}" width="${px(W - Math.round(W * 0.03))}" height="${px(H - Math.round(H * 0.03))}" rx="${px(radius)}" fill="none" stroke="${borderColor}" stroke-width="1.5" opacity="0.4"/>
`;

  // ── SVG ──
  const fontCSS = getFontFaceCSS();
  const hasEmbeddedFonts = fontCSS && fontCSS.length > 0;
  const fontFamily = hasEmbeddedFonts ? 'SkoolarCard' : 'sans-serif';
  
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<style>
${hasEmbeddedFonts ? fontCSS : ''}
text { font-family: '${fontFamily}', Arial, Helvetica, system-ui, -apple-system, sans-serif; }
</style>
<defs>
  <linearGradient id="hdrGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="${prim}" stop-opacity="1"/>
    <stop offset="50%" stop-color="${lighten(prim, 10)}" stop-opacity="1"/>
    <stop offset="100%" stop-color="${darken(prim, 15)}" stop-opacity="1"/>
  </linearGradient>
</defs>

<!-- Background -->
<rect width="100%" height="100%" fill="${sec}"/>
${bgDecor}

${header}

${isBack ? backContent : frontContent}

${footer}
</svg>`;

  return await sharp(Buffer.from(svg)).png({ quality: 100 }).toBuffer();
}
