import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/staff-attendance - List staff attendance records with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]; // default today

    // School context validation
    const userSchoolId = auth.schoolId;
    if (!userSchoolId) {
      return NextResponse.json({ error: 'No school associated with account' }, { status: 403 });
    }

    // Fetch all teachers and staff (accountants, librarians, directors, school admin) for the school
    const users = await db.user.findMany({
      where: {
        schoolId: userSchoolId,
        deletedAt: null,
        isActive: true,
        role: {
          in: ['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR', 'SCHOOL_ADMIN'],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        teacherProfile: {
          select: {
            id: true,
            employeeNo: true,
            specialization: true,
          },
        },
        accountantProfile: {
          select: {
            id: true,
            employeeNo: true,
          },
        },
        librarianProfile: {
          select: {
            id: true,
            employeeNo: true,
          },
        },
        directorProfile: {
          select: {
            id: true,
            employeeNo: true,
          },
        },
      },
    });

    // Build staff list with unified employee number
    const staffList = users.map(user => {
      let employeeNo = 'N/A';
      let staffId: string | undefined;
      if (user.teacherProfile?.employeeNo) {
        employeeNo = user.teacherProfile.employeeNo;
        staffId = user.teacherProfile.id;
      } else if (user.accountantProfile?.employeeNo) {
        employeeNo = user.accountantProfile.employeeNo;
        staffId = user.accountantProfile.id;
      } else if (user.librarianProfile?.employeeNo) {
        employeeNo = user.librarianProfile.employeeNo;
        staffId = user.librarianProfile.id;
      } else if (user.directorProfile?.employeeNo) {
        employeeNo = user.directorProfile.employeeNo;
        staffId = user.directorProfile.id;
      } else if (user.role === 'SCHOOL_ADMIN') {
        employeeNo = `ADMIN-${user.id.slice(0, 6)}`;
        // School admins might not have a separate profile; we'll use userId as reference
        staffId = undefined;
      } else {
        employeeNo = `USR-${user.id.slice(0, 6)}`;
        staffId = undefined;
      }
      return {
        id: staffId || user.id,
        userId: user.id,
        name: user.name,
        employeeNo,
        role: user.role,
        photo: user.avatar,
      };
    });

    // Fetch attendance scan logs for the given date (only successful staff check-ins)
    // AttendanceScanLog stores teacherId; for other staff we might not have a record
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const scanLogs = await db.attendanceScanLog.findMany({
      where: {
        schoolId: userSchoolId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        action: 'staff_attendance_checkin',
      },
      select: {
        id: true,
        teacherId: true,
        createdAt: true,
        ipAddress: true,
      },
    });

    // Build a map of teacherId to check-in time
    const attendanceMap = new Map<string, { checkInTime: string; ipAddress?: string }>();
    scanLogs.forEach(log => {
      if (log.teacherId) {
        const timeStr = log.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        attendanceMap.set(log.teacherId, { checkInTime: timeStr, ipAddress: log.ipAddress || undefined });
      }
    });

    // Combine staff list with attendance status
    const attendanceRecords = staffList.map(staff => {
      let checkInTime: string | undefined;
      let status: 'present' | 'absent' | 'not_marked' = 'not_marked';
      let checkInRecord: any = null;

      if (staff.role === 'TEACHER' && staff.id) {
        checkInRecord = attendanceMap.get(staff.id);
      }
      // For other staff (ACCOUNTANT, LIBRARIAN, DIRECTOR, SCHOOL_ADMIN), we don't have a check-in record yet
      // They can't use QR scanning unless they are teachers. In the future, we could allow all staff.

      if (checkInRecord) {
        checkInTime = checkInRecord.checkInTime;
        status = 'present';
      } else {
        // For now, non-teachers will show as 'not_marked' (could be considered absent or not required)
        // We'll keep 'not_marked' to indicate no check-in was recorded
        status = 'not_marked';
      }

      return {
        id: staff.id || staff.userId,
        staffId: staff.userId,
        staffName: staff.name,
        employeeNo: staff.employeeNo,
        role: staff.role,
        status,
        date,
        checkInTime,
        checkOutTime: undefined, // not implemented yet
      };
    });

    return NextResponse.json({ data: attendanceRecords });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
