import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import QRCode from 'qrcode';

interface StaffWithUser {
  id: string;
  name: string;
  employeeNo: string;
  userId: string;
  schoolId: string;
  user: { name: string; email: string } | null;
}

interface TokenType {
  role?: string;
  userId?: string;
  schoolId?: string;
  id?: string;
}

// GET /api/staff/qr - Get staff member's attendance QR code
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }) as TokenType | null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only staff and school admin/super admin can access
    if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(token.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');

    let targetStaffId: string | null = staffId;
    if (!staffId && token.role === 'TEACHER') {
      targetStaffId = token.userId || null;
    } else if (!staffId && (token.role === 'SCHOOL_ADMIN' || token.role === 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'staffId is required for admins' }, { status: 400 });
    }

    if (!targetStaffId) {
      return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
    }

    const staff = await db.teacher.findUnique({
      where: { id: targetStaffId },
      include: {
        user: { select: { name: true, email: true } },
      },
    }) as StaffWithUser | null;

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    if (token.role !== 'SUPER_ADMIN' && staff.schoolId !== (token.schoolId || '')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const qrData = JSON.stringify({
      type: 'staff',
      id: staff.employeeNo,
      userId: staff.userId,
      personId: staff.id,
      schoolId: staff.schoolId,
      name: staff.user?.name || staff.name,
      role: 'STAFF',
      timestamp: Date.now(),
    });

    const qrBuffer = await QRCode.toBuffer(qrData, {
      width: 256,
      margin: 2,
      color: {
        dark: '#059669',
        light: '#FFFFFF',
      },
    });

    return new NextResponse(Buffer.from(qrBuffer).toString('base64'), {
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
