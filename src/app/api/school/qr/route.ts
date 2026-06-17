import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import QRCode from 'qrcode';
import { ensureResvgInit } from '@/lib/id-card-utils/init-resvg';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from '@/lib/id-card-utils/arabic-font-data';

// GET /api/school/qr - Generate school attendance QR poster
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    // Auth-first: SUPER_ADMIN may use query schoolId; others must use their own
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        slug: true,
        address: true,
        phone: true,
        email: true,
        motto: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
      },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const prim = school.primaryColor || '#059669';
    const sec = school.secondaryColor || '#10B981';

    const qrPayload = {
      type: 'school_attendance',
      schoolId,
      schoolName: school.name,
      timestamp: Date.now(),
    };

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 512,
      margin: 2,
      color: { dark: '#059669', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    });

    const esc = (s: string) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const safeName = esc(school.name);
    const safeAddress = esc(school.address || '');
    const safeMotto = esc(school.motto || '');

    const FF = `'${ARABIC_FONT_FAMILY}', '${GEIST_FONT_FAMILY}', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${prim}" />
      <stop offset="100%" stop-color="${sec}" />
    </linearGradient>
    <linearGradient id="footerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${prim}" stop-opacity="0.08" />
      <stop offset="100%" stop-color="${sec}" stop-opacity="0.08" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="115%" height="115%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.15" />
    </filter>
    <style>
      @font-face {
        font-family: '${GEIST_FONT_FAMILY}';
        src: url(data:font/truetype;base64,${GEIST_REGULAR_BASE64}) format('truetype');
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: '${GEIST_FONT_FAMILY}';
        src: url(data:font/truetype;base64,${GEIST_REGULAR_BASE64}) format('truetype');
        font-weight: 700;
        font-style: normal;
      }
      @font-face {
        font-family: '${ARABIC_FONT_FAMILY}';
        src: url(data:font/truetype;base64,${ARABIC_FONT_BASE64}) format('truetype');
        font-weight: 400;
        font-style: normal;
      }
      text { font-family: ${FF}; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="600" height="800" fill="#f8fafc" rx="8" />

  <!-- Header -->
  <rect x="0" y="0" width="600" height="130" fill="url(#headerGrad)" rx="8" />
  <rect x="0" y="110" width="600" height="20" fill="url(#headerGrad)" />
  <text x="300" y="48" text-anchor="middle" fill="white" font-family="${FF}" font-size="22" font-weight="bold">${safeName}</text>
  ${safeMotto ? `<text x="300" y="73" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-family="${FF}" font-size="12">${safeMotto}</text>` : ''}
  <text x="300" y="${safeMotto ? 100 : 90}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="${FF}" font-size="14" font-weight="600" letter-spacing="3">STAFF ATTENDANCE QR</text>

  <!-- QR Code -->
  <rect x="120" y="170" width="360" height="360" rx="12" fill="white" filter="url(#shadow)" />
  <image x="140" y="190" width="320" height="320" href="${qrDataUrl}" />

  <!-- Instructions -->
  <text x="300" y="555" text-anchor="middle" fill="#334155" font-family="${FF}" font-size="13" font-weight="bold">Scan this QR code to mark your attendance</text>
  <text x="300" y="575" text-anchor="middle" fill="#94a3b8" font-family="${FF}" font-size="11">Point your device at this QR code using the "My Attendance" feature</text>

  <!-- School Details -->
  <rect x="60" y="605" width="480" height="100" rx="8" fill="white" stroke="#e2e8f0" stroke-width="1" filter="url(#shadow)" />
  <text x="300" y="630" text-anchor="middle" fill="${prim}" font-family="${FF}" font-size="13" font-weight="bold">${safeName}</text>
  ${safeAddress ? `<text x="300" y="652" text-anchor="middle" fill="#64748b" font-family="${FF}" font-size="11">${safeAddress}</text>` : ''}
  ${(school.phone || school.email) ? `
  <text x="300" y="${safeAddress ? 676 : 655}" text-anchor="middle" fill="#64748b" font-family="${FF}" font-size="11">
    ${[school.phone, school.email].filter(Boolean).join('  |  ')}
  </text>` : ''}

  <!-- Footer -->
  <rect x="0" y="740" width="600" height="60" fill="url(#footerGrad)" rx="8" />
  <rect x="0" y="750" width="600" height="50" fill="url(#footerGrad)" />
  <text x="300" y="770" text-anchor="middle" fill="#94a3b8" font-family="${FF}" font-size="10">Generated by Skoolar - Odebunmi Tawwāb</text>
</svg>`;

    await ensureResvgInit();
    const resvgPkg = '@resvg/resvg-' + 'wasm';
    const { Resvg } = await import(resvgPkg);
    const geistBuffer = Buffer.from(GEIST_REGULAR_BASE64, 'base64');
    const arabicBuffer = Buffer.from(ARABIC_FONT_BASE64, 'base64');
    const resvg = new Resvg(svg, {
      background: '#f8fafc',
      fitTo: { mode: 'width', value: 600 },
      font: {
        fontBuffers: [new Uint8Array(arabicBuffer), new Uint8Array(geistBuffer)],
        defaultFontFamily: GEIST_FONT_FAMILY,
      },
    });
    const png = Buffer.from(resvg.render().asPng());

    return new NextResponse(png, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="attendance-qr-${school.slug}.png"`,
      },
    });
  } catch (error: unknown) {
    console.error('School QR API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
