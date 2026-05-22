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

function parseQR(qrData: unknown): any {
  if (typeof qrData === 'string') {
    try {
      return JSON.parse(qrData);
    } catch {
      // Assume raw string is a staff user ID
      return { type: 'staff', userId: qrData };
    }
  }
  if (typeof qrData === 'object' && qrData !== null) return qrData;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { qrData, scanType = 'attendance', scannedBy } = body;

    if (!qrData) {
      return NextResponse.json({ error: 'QR data is required' }, { status: 400 });
    }

    const parsedData = parseQR(qrData);
    if (!parsedData) {
      return NextResponse.json({ error: 'Invalid QR code data' }, { status: 400 });
    }

    const { type, id: cardId, userId: targetUserId, personId, schoolId: qrSchoolId, name, role } = parsedData;

    // Resolve schoolId: body → auth → QR
    const effectiveSchoolId = auth.schoolId || qrSchoolId || '';
    if (!effectiveSchoolId) {
      return NextResponse.json({ error: 'Could not determine school' }, { status: 400 });
    }

    if (!personId && !targetUserId) {
      return NextResponse.json({ error: 'QR code missing required fields' }, { status: 400 });
    }

    if (auth.role !== 'SUPER_ADMIN' && qrSchoolId && qrSchoolId !== effectiveSchoolId) {
      return NextResponse.json({ error: 'QR code does not belong to your school' }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const currentHHMM = getCurrentTimeHHMM();

    // Fetch the late threshold from school settings
    let lateThreshold = '08:00';
    try {
      const settings = await db.schoolSettings.findUnique({ where: { schoolId: effectiveSchoolId } });
      if (settings?.attendanceLateThreshold) lateThreshold = settings.attendanceLateThreshold;
    } catch { /* use default */ }

    const autoLate = isLate(currentHHMM, lateThreshold);

    // 1. Identify the person being scanned
    let person: any = null;
    let finalUserId: string | null = null;
    let isStudent = false;
    let admissionNo: string | null = null;
    let employeeNo: string | null = null;

    if (type === 'student') {
      person = await db.student.findUnique({
        where: { id: personId },
        include: { user: { select: { id: true, name: true, role: true } }, class: { select: { id: true, name: true } } },
      });
      if (person) {
        finalUserId = person.userId;
        isStudent = true;
        admissionNo = person.admissionNo;
      }
    } else {
      if (targetUserId) {
        person = await db.user.findUnique({
          where: { id: targetUserId },
          include: {
            teacherProfile: { select: { id: true, employeeNo: true } },
            accountantProfile: { select: { id: true, employeeNo: true } },
            librarianProfile: { select: { id: true, employeeNo: true } },
            directorProfile: { select: { id: true, employeeNo: true } },
          }
        });
        if (person) {
          finalUserId = person.id;
          employeeNo = person.teacherProfile?.employeeNo || person.accountantProfile?.employeeNo || person.librarianProfile?.employeeNo || person.directorProfile?.employeeNo || person.id.slice(0, 8);
        }
      } else if (personId) {
        const teacher = await db.teacher.findUnique({
          where: { id: personId },
          include: { user: { select: { id: true, name: true, role: true, schoolId: true } } }
        });
        if (teacher) {
          person = teacher.user;
          finalUserId = teacher.userId;
          employeeNo = teacher.employeeNo;
        }
      }
    }

    if (!person || !finalUserId) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // 2. Check for duplicate scan today
    let alreadyScannedToday = false;
    if (isStudent) {
      const existing = await db.attendance.findUnique({
        where: {
          schoolId_studentId_date: {
            schoolId: effectiveSchoolId,
            studentId: personId,
            date: todayStart,
          },
        },
        select: { id: true, status: true },
      });
      alreadyScannedToday = !!existing;
    } else {
      const existing = await db.staffAttendance.findUnique({
        where: {
          schoolId_userId_date: {
            schoolId: effectiveSchoolId,
            userId: finalUserId,
            date: todayStart,
          },
        },
        select: { id: true, status: true },
      });
      alreadyScannedToday = !!existing;
    }

    // 3. Record scan in AttendanceScanLog
    const scanLog = await db.attendanceScanLog.create({
      data: {
        schoolId: effectiveSchoolId,
        studentId: isStudent ? personId : null,
        teacherId: (!isStudent && type === 'staff' && personId) ? personId : null,
        userId: finalUserId,
        cardId: (cardId as string) || null,
        scanType,
        action: scanType === 'attendance' || scanType === 'staff_attendance' ? 'attendance' : scanType,
        status: alreadyScannedToday ? 'skipped' : 'success',
        scannedBy: scannedBy || auth.userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || null,
      },
    });

    if (alreadyScannedToday) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        data: {
          scanLog,
          person: {
            name: isStudent ? person.user?.name : person.name,
            id: admissionNo || employeeNo || (person.id as string)?.slice(0, 8),
            role: isStudent ? 'STUDENT' : person.role,
          },
        },
        message: `${isStudent ? 'Student' : 'Staff member'} already marked present today`,
      });
    }

    // 4. Process Attendance
    if (scanType === 'attendance' || scanType === 'staff_attendance') {
      const attendanceStatus = autoLate ? 'late' : 'present';

      if (isStudent) {
        const currentTerm = await db.term.findFirst({
          where: {
            schoolId: effectiveSchoolId,
            startDate: { lte: todayStart },
            endDate: { gte: todayStart },
            isLocked: false,
          },
          orderBy: { startDate: 'desc' },
        });

        await db.attendance.upsert({
          where: {
            schoolId_studentId_date: {
              schoolId: effectiveSchoolId,
              studentId: personId,
              date: todayStart,
            },
          },
          update: {
            status: attendanceStatus,
            classId: person.classId,
            termId: currentTerm?.id || 'none',
            method: 'qr_scan',
            markedBy: scannedBy || auth.userId,
          },
          create: {
            schoolId: effectiveSchoolId,
            studentId: personId,
            classId: person.classId || 'none',
            termId: currentTerm?.id || 'none',
            date: todayStart,
            status: attendanceStatus,
            method: 'qr_scan',
            markedBy: scannedBy || auth.userId,
          },
        });
      } else {
        await db.staffAttendance.upsert({
          where: {
            schoolId_userId_date: {
              schoolId: effectiveSchoolId,
              userId: finalUserId,
              date: todayStart,
            },
          },
          update: {
            status: attendanceStatus,
            method: 'qr_scan',
            markedBy: scannedBy || auth.userId,
          },
          create: {
            schoolId: effectiveSchoolId,
            userId: finalUserId,
            date: todayStart,
            status: attendanceStatus,
            checkInTime: currentHHMM,
            method: 'qr_scan',
            markedBy: scannedBy || auth.userId,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        scanLog,
        person: {
          name: isStudent ? person.user?.name : person.name,
          id: admissionNo || employeeNo || (person.id as string)?.slice(0, 8),
          role: isStudent ? 'STUDENT' : person.role,
        },
        late: autoLate,
      },
      message: autoLate
        ? `Attendance recorded as late (after ${lateThreshold})`
        : 'Attendance recorded successfully',
    });
  } catch (error: unknown) {
    console.error('Scan API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
