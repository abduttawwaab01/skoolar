import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isLate(currentHHMM: string, threshold: string): boolean {
  if (!threshold) return false;
  const [ch, cm] = currentHHMM.split(':').map(Number);
  const [th, tm] = threshold.split(':').map(Number);
  if (isNaN(ch) || isNaN(cm) || isNaN(th) || isNaN(tm)) return false;
  return ch > th || (ch === th && cm >= tm);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await db.staffAttendance.findUnique({
      where: {
        schoolId_userId_date: {
          schoolId: auth.schoolId!,
          userId: auth.userId!,
          date: today,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        checkedIn: !!attendance && ['present', 'late'].includes(attendance.status),
        checkInTime: attendance?.checkInTime || null,
        date: today.toISOString().split('T')[0],
        schoolId: auth.schoolId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { qrData } = body;

    if (!qrData) {
      return NextResponse.json({ error: 'QR data is required' }, { status: 400 });
    }

    let parsedData: any;
    try {
      parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch {
      return NextResponse.json({ error: 'Invalid QR code data' }, { status: 400 });
    }

    if (parsedData.type !== 'school_attendance' && parsedData.type !== 'staff') {
       return NextResponse.json({ error: 'Invalid QR code type' }, { status: 400 });
    }

    const schoolId = auth.schoolId || parsedData.schoolId || '';
    if (!schoolId) {
      return NextResponse.json({ error: 'Could not determine school' }, { status: 400 });
    }

    if (auth.role !== 'SUPER_ADMIN' && parsedData.schoolId && parsedData.schoolId !== schoolId) {
      return NextResponse.json({ error: 'QR code does not belong to your school' }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentHHMM = getCurrentTimeHHMM();

    // Fetch late threshold from school settings
    let lateThreshold = '08:00';
    try {
      const settings = await db.schoolSettings.findUnique({ where: { schoolId } });
      if (settings?.attendanceLateThreshold) lateThreshold = settings.attendanceLateThreshold;
    } catch { /* use default */ }

    const autoLate = isLate(currentHHMM, lateThreshold);
    const attendanceStatus = autoLate ? 'late' : 'present';

    const attendance = await db.staffAttendance.upsert({
      where: {
        schoolId_userId_date: {
          schoolId,
          userId: auth.userId!,
          date: today,
        },
      },
      update: {
        status: attendanceStatus,
        checkInTime: currentHHMM,
        method: parsedData.type === 'school_attendance' ? 'self_scan' : 'qr_scan',
        markedBy: auth.userId,
      },
      create: {
        schoolId,
        userId: auth.userId!,
        date: today,
        status: attendanceStatus,
        checkInTime: currentHHMM,
        method: parsedData.type === 'school_attendance' ? 'self_scan' : 'qr_scan',
        markedBy: auth.userId,
      },
    });

    await db.attendanceScanLog.create({
      data: {
        schoolId,
        userId: auth.userId!,
        scanType: parsedData.type,
        action: 'attendance',
        status: 'success',
        scannedBy: auth.userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: autoLate
        ? `Attendance marked as late (after ${lateThreshold})`
        : 'Attendance marked successfully',
      data: { ...attendance, late: autoLate },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
