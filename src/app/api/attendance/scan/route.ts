import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { qrData, scanType = 'attendance', scannedBy, schoolId } = body;

    if (!qrData) {
      return NextResponse.json({ error: 'QR data is required' }, { status: 400 });
    }

    let parsedData: any;
    try {
      parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch {
      return NextResponse.json({ error: 'Invalid QR code data' }, { status: 400 });
    }

    const { type, id: cardId, userId: targetUserId, personId, schoolId: qrSchoolId, name, role, timestamp } = parsedData;

    if ((!personId && !targetUserId) || !schoolId) {
      return NextResponse.json({ error: 'QR code missing required fields' }, { status: 400 });
    }

    const userSchoolId = auth.schoolId;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? (schoolId || qrSchoolId) : userSchoolId;

    if (auth.role !== 'SUPER_ADMIN' && qrSchoolId !== userSchoolId) {
      return NextResponse.json({ error: 'QR code does not belong to your school' }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

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

    // 2. Check for duplicate scan today (prevent multiple marks per day)
    let alreadyScannedToday = false;
    if (isStudent) {
      const existing = await db.attendance.findUnique({
        where: {
          schoolId_studentId_date: {
            schoolId: targetSchoolId,
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
            schoolId: targetSchoolId,
            userId: finalUserId,
            date: todayStart,
          },
        },
        select: { id: true, status: true },
      });
      alreadyScannedToday = !!existing;
    }

    // 3. Record scan in AttendanceScanLog (always, even on duplicate)
    const scanLog = await db.attendanceScanLog.create({
      data: {
        schoolId: targetSchoolId,
        studentId: isStudent ? personId : null,
        teacherId: (!isStudent && type === 'staff' && personId) ? personId : null,
        userId: finalUserId,
        cardId: cardId || null,
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
            id: admissionNo || employeeNo || person.id.slice(0, 8),
            role: isStudent ? 'STUDENT' : person.role,
          },
        },
        message: `${isStudent ? 'Student' : 'Staff member'} already marked present today`,
      });
    }

    // 4. Process Attendance
    if (scanType === 'attendance' || scanType === 'staff_attendance') {
      if (isStudent) {
        const currentTerm = await db.term.findFirst({
          where: {
            schoolId: targetSchoolId,
            startDate: { lte: todayStart },
            endDate: { gte: todayStart },
            isLocked: false,
          },
          orderBy: { startDate: 'desc' },
        });

        await db.attendance.upsert({
          where: {
            schoolId_studentId_date: {
              schoolId: targetSchoolId,
              studentId: personId,
              date: todayStart,
            },
          },
          update: {
            status: 'present',
            classId: person.classId,
            termId: currentTerm?.id || 'none',
            method: 'qr_scan',
            markedBy: scannedBy || auth.userId,
          },
          create: {
            schoolId: targetSchoolId,
            studentId: personId,
            classId: person.classId || 'none',
            termId: currentTerm?.id || 'none',
            date: todayStart,
            status: 'present',
            method: 'qr_scan',
            markedBy: scannedBy || auth.userId,
          },
        });
      } else {
        await db.staffAttendance.upsert({
          where: {
            schoolId_userId_date: {
              schoolId: targetSchoolId,
              userId: finalUserId,
              date: todayStart,
            },
          },
          update: {
            status: 'present',
            method: 'qr_scan',
            markedBy: scannedBy || auth.userId,
          },
          create: {
            schoolId: targetSchoolId,
            userId: finalUserId,
            date: todayStart,
            status: 'present',
            checkInTime: timeStr,
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
          id: admissionNo || employeeNo || person.id.slice(0, 8),
          role: isStudent ? 'STUDENT' : person.role,
        },
      },
      message: 'Attendance recorded successfully',
    });
  } catch (error: unknown) {
    console.error('Scan API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
