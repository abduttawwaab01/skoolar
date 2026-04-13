import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// POST /api/attendance/scan - Log QR scan for attendance
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
    } catch (e) {
      return NextResponse.json({ error: 'Invalid QR code data' }, { status: 400 });
    }

    const { type, id: cardId, userId, personId, schoolId: qrSchoolId, name, role, timestamp } = parsedData;

    if (!personId || !schoolId) {
      return NextResponse.json({ error: 'QR code missing required fields' }, { status: 400 });
    }

    // Verify school matches user's school unless SUPER_ADMIN
    const userSchoolId = auth.schoolId;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? (schoolId || qrSchoolId) : userSchoolId;

    if (auth.role !== 'SUPER_ADMIN' && qrSchoolId !== userSchoolId) {
      return NextResponse.json({ error: 'QR code does not belong to your school' }, { status: 403 });
    }

    // Check if person exists and is active
    let person: any = null;
    let isStudent = false;
    if (type === 'student') {
      person = await db.student.findUnique({
        where: { id: personId },
        include: { user: { select: { name: true, email: true } }, class: { select: { name: true } } },
      });
      isStudent = true;
    } else if (type === 'staff') {
      person = await db.teacher.findUnique({
        where: { id: personId },
        include: { user: { select: { name: true, email: true } } },
      });
    }

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Record scan in AttendanceScanLog
    const scanLog = await db.attendanceScanLog.create({
      data: {
        schoolId: targetSchoolId,
        studentId: isStudent ? personId : null,
        cardId: cardId,
        scanType: scanType,
        action: scanType === 'attendance' || scanType === 'staff_attendance' ? 'attendance' : scanType,
        status: 'success',
        scannedBy: scannedBy || auth.userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || null,
      },
    });

    // If it's an attendance scan, mark attendance for today
    if ((scanType === 'attendance' || scanType === 'staff_attendance') && person) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isStudent) {
        // Student attendance
        const currentTerm = await db.term.findFirst({
          where: {
            schoolId: targetSchoolId,
            startDate: { lte: today },
            endDate: { gte: today },
            isLocked: false,
          },
          orderBy: { startDate: 'desc' },
        });

        if (currentTerm) {
          await db.attendance.upsert({
            where: {
              schoolId_studentId_date: {
                schoolId: targetSchoolId,
                studentId: personId,
                date: today,
              },
            },
            update: {
              status: 'present',
              classId: person.classId,
              termId: currentTerm.id,
              method: 'qr_scan',
              markedBy: scannedBy || auth.userId,
            },
            create: {
              schoolId: targetSchoolId,
              studentId: personId,
              classId: person.classId,
              termId: currentTerm.id,
              date: today,
              status: 'present',
              method: 'qr_scan',
              markedBy: scannedBy || auth.userId,
            },
          });
        }
      } else {
        // Staff attendance - could be tracked in a separate model or logs
        // For now, we'll create a record in AttendanceScanLog as the official record
        // In a full implementation, you'd have a StaffAttendance model
        console.log(`Staff attendance marked for ${person.user?.name} via QR scan`);
      }
    }

    // For staff attendance, you might want to track it differently (e.g., separate model or log)
    // For now, we just log the scan

    return NextResponse.json({
      success: true,
      data: {
        scanLog,
        person: {
          name: person.user?.name || person.name,
          id: person.admissionNo || person.employeeNo,
          role: type === 'student' ? 'STUDENT' : (person.qualification?.toUpperCase() || 'STAFF'),
        },
      },
      message: 'Attendance marked successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
