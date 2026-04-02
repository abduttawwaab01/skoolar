import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// POST /api/attendance/staff-checkin - Staff self check-in via QR scan
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only teachers and staff can use this endpoint
    if (token.role !== 'TEACHER' && token.role !== 'SCHOOL_ADMIN' && token.role !== 'DIRECTOR') {
      return NextResponse.json({ error: 'Only staff members can use this feature' }, { status: 403 });
    }

    const body = await request.json();
    const { qrData } = body;

    if (!qrData) {
      return NextResponse.json({ error: 'QR data is required' }, { status: 400 });
    }

    let parsedData: { type?: string; schoolId?: string; action?: string };
    try {
      parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch {
      return NextResponse.json({ error: 'Invalid QR code data' }, { status: 400 });
    }

    const { type, schoolId: qrSchoolId, action } = parsedData;

    // Verify this is a school QR code for staff attendance
    if (type !== 'school' || action !== 'staff_attendance_checkin') {
      return NextResponse.json({ error: 'Invalid QR code. This is not a valid staff attendance QR code.' }, { status: 400 });
    }

    const schoolId = token.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: 'School not found for this user' }, { status: 400 });
    }

    // Verify QR code matches user's school
    if (qrSchoolId !== schoolId) {
      return NextResponse.json({ error: 'This QR code is not for your school' }, { status: 403 });
    }

    // Get teacher's profile
    const teacher = await db.teacher.findUnique({
      where: { userId: token.id },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Check if already marked attendance today
    const existingLog = await db.attendanceScanLog.findFirst({
      where: {
        teacherId: teacher.id,
        createdAt: {
          gte: today,
        },
        action: 'staff_attendance_checkin',
      },
    });

    if (existingLog) {
      return NextResponse.json({
        success: true,
        message: 'You have already marked your attendance today',
        data: {
          checkedIn: true,
          time: existingLog.createdAt.toLocaleTimeString(),
          date: todayStr,
        },
      });
    }

    // Create attendance record
    const scanLog = await db.attendanceScanLog.create({
      data: {
        schoolId,
        teacherId: teacher.id,
        cardId: null,
        scanType: 'school_qr',
        action: 'staff_attendance_checkin',
        status: 'success',
        scannedBy: token.id,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        checkedIn: true,
        time: scanLog.createdAt.toLocaleTimeString(),
        date: todayStr,
        staffName: teacher.user?.name,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/attendance/staff-checkin - Get today's staff attendance status
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (token.role !== 'TEACHER' && token.role !== 'SCHOOL_ADMIN' && token.role !== 'DIRECTOR') {
      return NextResponse.json({ error: 'Only staff members can use this feature' }, { status: 403 });
    }

    const schoolId = token.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: 'School not found' }, { status: 400 });
    }

    // Get teacher's profile
    const teacher = await db.teacher.findUnique({
      where: { userId: token.id },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if attended today
    const todayAttendance = await db.attendanceScanLog.findFirst({
      where: {
        teacherId: teacher.id,
        createdAt: { gte: today },
        action: 'staff_attendance_checkin',
      },
      orderBy: { createdAt: 'desc' },
    });

    const todayStr = today.toISOString().split('T')[0];

    // Get school QR code URL
    const qrCodeUrl = `/api/school/qr?type=staff_attendance&schoolId=${schoolId}`;

    return NextResponse.json({
      success: true,
      data: {
        checkedIn: !!todayAttendance,
        checkInTime: todayAttendance?.createdAt.toLocaleTimeString() || null,
        date: todayStr,
        qrCodeUrl,
        schoolId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}