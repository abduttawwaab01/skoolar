import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import QRCode from 'qrcode';

interface TokenType {
  role?: string;
  userId?: string;
  schoolId?: string;
  id?: string;
}

interface StaffInfo {
  id: string;
  personId: string;
  employeeNo: string;
  userId: string;
  schoolId: string;
  name: string;
}

const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];

async function findStaffByUserId(userId: string): Promise<StaffInfo | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      schoolId: true,
      role: true,
      teacherProfile: { select: { id: true, employeeNo: true } },
      accountantProfile: { select: { id: true, employeeNo: true } },
      librarianProfile: { select: { id: true, employeeNo: true } },
      directorProfile: { select: { id: true, employeeNo: true } },
    },
  });

  if (!user) return null;

  let personId = user.id;
  let employeeNo = `USR-${user.id.slice(0, 6)}`;

  if (user.role === 'TEACHER' && user.teacherProfile) {
    personId = user.teacherProfile.id;
    employeeNo = user.teacherProfile.employeeNo;
  } else if (user.role === 'ACCOUNTANT' && user.accountantProfile) {
    personId = user.accountantProfile.id;
    employeeNo = user.accountantProfile.employeeNo;
  } else if (user.role === 'LIBRARIAN' && user.librarianProfile) {
    personId = user.librarianProfile.id;
    employeeNo = user.librarianProfile.employeeNo;
  } else if (user.role === 'DIRECTOR' && user.directorProfile) {
    personId = user.directorProfile.id;
    employeeNo = user.directorProfile.employeeNo;
  } else if (user.role === 'SCHOOL_ADMIN') {
    employeeNo = `ADMIN-${user.id.slice(0, 6)}`;
  }

  return {
    id: user.id,
    personId,
    employeeNo,
    userId: user.id,
    schoolId: user.schoolId || '',
    name: user.name,
  };
}

// GET /api/staff/qr - Get staff member's attendance QR code
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }) as TokenType | null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = token.role || '';
    const isStaff = STAFF_ROLES.includes(userRole);
    
    if (!isStaff) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');

    let targetStaffId: string | null = staffId;
    
    if (!staffId) {
      if (userRole === 'SUPER_ADMIN' || userRole === 'SCHOOL_ADMIN') {
        return NextResponse.json({ error: 'staffId is required for admin users' }, { status: 400 });
      }
      targetStaffId = token.id || token.userId || null;
    }

    if (!targetStaffId) {
      return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
    }

    const staff = await findStaffByUserId(targetStaffId);

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    if (userRole !== 'SUPER_ADMIN' && staff.schoolId && staff.schoolId !== (token.schoolId || '')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const qrData = JSON.stringify({
      type: 'staff',
      id: staff.employeeNo,
      userId: staff.userId,
      personId: staff.personId,
      schoolId: staff.schoolId,
      name: staff.name,
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

    return new NextResponse(new Uint8Array(qrBuffer), {
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
