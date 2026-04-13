import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import QRCode from 'qrcode';

// GET /api/school/qr - Get school-level QR codes (staff attendance, etc.)
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'staff_attendance';
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    // Verify access to school
    if (token.role !== 'SUPER_ADMIN' && token.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Generate QR code data based on type
    let qrData: any;
    if (type === 'staff_attendance') {
      qrData = {
        type: 'school',
        schoolId: schoolId,
        action: 'staff_attendance_checkin',
        timestamp: Date.now(),
      };
    } else {
      return NextResponse.json({ error: 'Invalid QR type' }, { status: 400 });
    }

    // Generate QR code as base64 PNG
    const qrBuffer = await QRCode.toBuffer(JSON.stringify(qrData), {
      width: 256,
      margin: 2,
      color: {
        dark: '#059669',
        light: '#FFFFFF',
      },
    });

    return new NextResponse(qrBuffer.toString('base64'), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
