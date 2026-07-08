import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/staff-attendance - List staff attendance records with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]; // default today
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    // School context validation
    const userSchoolId = auth.schoolId;
    if (!userSchoolId) {
      return NextResponse.json({ error: 'No school associated with account' }, { status: 403 });
    }

    // 1. Fetch all users with staff roles for the school
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
        teacherProfile: { select: { id: true, employeeNo: true } },
        accountantProfile: { select: { id: true, employeeNo: true } },
        librarianProfile: { select: { id: true, employeeNo: true } },
        directorProfile: { select: { id: true, employeeNo: true } },
      },
    });

    // 2. Fetch all staff attendance records for the given date
    const attendances = await db.staffAttendance.findMany({
      where: {
        schoolId: userSchoolId,
        date: date,
      },
    });

    const attendanceMap = new Map<string, typeof attendances[0]>();
    attendances.forEach(a => attendanceMap.set(a.userId, a));

    // 3. Build combined records
    const attendanceRecords = users.map(user => {
      let employeeNo = 'N/A';
      if (user.teacherProfile?.employeeNo) employeeNo = user.teacherProfile.employeeNo;
      else if (user.accountantProfile?.employeeNo) employeeNo = user.accountantProfile.employeeNo;
      else if (user.librarianProfile?.employeeNo) employeeNo = user.librarianProfile.employeeNo;
      else if (user.directorProfile?.employeeNo) employeeNo = user.directorProfile.employeeNo;
      else if (user.role === 'SCHOOL_ADMIN') employeeNo = `ADMIN-${user.id.slice(0, 6)}`;
      else employeeNo = `USR-${user.id.slice(0, 6)}`;

      const att = attendanceMap.get(user.id);

      return {
        id: att?.id || `temp-${user.id}`,
        staffId: user.id,
        staffName: user.name,
        employeeNo: employeeNo,
        role: user.role,
        status: att?.status || 'not_marked',
        date: dateStr,
        checkInTime: att?.checkInTime,
        checkOutTime: att?.checkOutTime,
        method: att?.method,
      };
    });

    return NextResponse.json({ data: attendanceRecords });
  } catch (error: unknown) {
    console.error('Staff Attendance API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/staff-attendance - Delete staff attendance records (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const dateStr = searchParams.get('date');
    const userId = searchParams.get('userId');

    const userSchoolId = auth.schoolId;
    if (!userSchoolId) {
      return NextResponse.json({ error: 'No school associated with account' }, { status: 403 });
    }

    if (id) {
      const record = await db.staffAttendance.findUnique({ where: { id } });
      if (!record) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }
      if (record.schoolId !== userSchoolId && auth.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      await db.staffAttendance.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Attendance record deleted' });
    }

    if (dateStr && userId) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);
      const record = await db.staffAttendance.findUnique({
        where: {
          schoolId_userId_date: {
            schoolId: userSchoolId,
            userId,
            date,
          },
        },
      });
      if (!record) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }
      await db.staffAttendance.delete({ where: { id: record.id } });
      return NextResponse.json({ success: true, message: 'Attendance record deleted' });
    }

    if (dateStr) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);
      const { count } = await db.staffAttendance.deleteMany({
        where: { schoolId: userSchoolId, date },
      });
      return NextResponse.json({ success: true, message: `Deleted ${count} attendance records for ${dateStr}` });
    }

    return NextResponse.json({ error: 'Provide id, or date, or date+userId to delete' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
