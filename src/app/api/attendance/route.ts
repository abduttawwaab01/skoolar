import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/attendance - List attendance records with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const schoolId = searchParams.get('schoolId') || '';
    const classId = searchParams.get('classId') || '';
    const termId = searchParams.get('termId') || '';
    const studentId = searchParams.get('studentId') || '';
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const groupBy = searchParams.get('groupBy') || '';

    const where: Record<string, unknown> = {};

    // School context validation
    const userSchoolId = auth.schoolId;
    if (userSchoolId) {
      where.schoolId = userSchoolId;
    } else if (schoolId) {
      where.schoolId = schoolId;
    }

    if (classId) where.classId = classId;
    if (termId) where.termId = termId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    const [data, total] = await Promise.all([
      db.attendance.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          schoolId: true,
          termId: true,
          studentId: true,
          classId: true,
          date: true,
          status: true,
          method: true,
          remarks: true,
          markedBy: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              admissionNo: true,
              user: { select: { name: true, email: true } },
              class: { select: { name: true, section: true, grade: true } },
            },
          },
          term: {
            select: { id: true, name: true },
          },
        },
      }),
      db.attendance.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/attendance - Mark attendance (bulk)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const { records, schoolId, termId, classId, date, markedBy } = body;

    // School context: use auth's schoolId if user is not SUPER_ADMIN
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!termId || !classId || !date || !records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: 'termId, classId, date, and records array are required' },
        { status: 400 }
      );
    }

    const attendanceDate = new Date(date);
    const created: unknown[] = [];
    const errors: { studentId: string; error: string }[] = [];

    // Validate students belong to the class
    const classStudents = await db.student.findMany({
      where: { classId, deletedAt: null, isActive: true, schoolId: targetSchoolId },
      select: { id: true, admissionNo: true },
    });
    const studentIds = new Set(classStudents.map((s) => s.id));

    // ── BATCH PROCESS ATTENDANCE (was individual upserts per record) ──
    // First, validate all records and collect valid ones
    const validRecords: Array<{ studentId: string; status: string; remarks?: string | null; method?: string }> = [];

    for (const record of records) {
      if (!record.studentId || !record.status) {
        errors.push({ studentId: record.studentId || 'unknown', error: 'Missing studentId or status' });
        continue;
      }

      if (!studentIds.has(record.studentId)) {
        errors.push({ studentId: record.studentId, error: 'Student not found in this class' });
        continue;
      }

      validRecords.push({
        studentId: record.studentId,
        status: record.status,
        remarks: record.remarks || null,
        method: record.method || 'manual',
      });
    }

    // Fetch existing attendance records for this date/class to determine create vs update
    const existingAttendances = await db.attendance.findMany({
      where: {
        schoolId: targetSchoolId,
        termId,
        classId,
        date: attendanceDate,
        studentId: { in: validRecords.map(r => r.studentId) },
      },
      select: { studentId: true, id: true },
    });
    const existingMap = new Map(existingAttendances.map(a => [a.studentId, a.id]));

    const toCreate: any[] = [];
    const toUpdate: any[] = [];

    for (const record of validRecords) {
      if (existingMap.has(record.studentId)) {
        toUpdate.push(record);
      } else {
        toCreate.push({
          schoolId: targetSchoolId,
          termId,
          studentId: record.studentId,
          classId,
          date: attendanceDate,
          status: record.status,
          remarks: record.remarks,
          method: record.method,
          markedBy: markedBy || auth.userId,
        });
      }
    }

    // Batch create new records
    if (toCreate.length > 0) {
      try {
        await db.attendance.createMany({ data: toCreate });
      } catch (e) {
        console.error('Attendance batch create error:', e);
        // Mark all toCreate as errors
        for (const rec of toCreate) {
          errors.push({ studentId: rec.studentId, error: 'Failed to create attendance' });
        }
      }
    }

    // Batch update existing records in groups
    if (toUpdate.length > 0) {
      const BATCH_SIZE = 10;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        try {
          await Promise.all(batch.map(rec =>
            db.attendance.update({
              where: {
                schoolId_studentId_date: {
                  schoolId: targetSchoolId,
                  studentId: rec.studentId,
                  date: attendanceDate,
                },
              },
              data: {
                status: rec.status,
                classId,
                termId,
                remarks: rec.remarks,
                method: rec.method,
                markedBy: markedBy || auth.userId,
              },
            })
          ));
        } catch (e) {
          console.error('Attendance batch update error:', e);
          for (const rec of batch) {
            errors.push({ studentId: rec.studentId, error: 'Failed to update attendance' });
          }
        }
      }
    }

    // ✅ FIXED: Send notifications to parents for absent students
    const absenceRecords = [...toCreate, ...toUpdate].filter(r => r.status === 'absent');
    if (absenceRecords.length > 0) {
      try {
        // Get student-parent relationships for absent students
        const studentParents = await db.studentParent.findMany({
          where: {
            studentId: { in: absenceRecords.map(r => r.studentId) },
          },
          include: {
            student: { select: { id: true, user: { select: { name: true } } } },
            parent: { select: { userId: true } },
          },
        });

        // Create notifications for parents
        const notifications = studentParents.map(sp => ({
          userId: sp.parent.userId,
          schoolId: targetSchoolId,
          title: 'Absence Alert',
          message: `Your child ${sp.student.user.name} was marked absent on ${attendanceDate.toLocaleDateString()}`,
          type: 'warning' as const,
          category: 'attendance' as const,
          actionUrl: `/dashboard?view=parent-attendance`,
        }));

        if (notifications.length > 0) {
          await db.notification.createMany({
            data: notifications,
            skipDuplicates: true,
          });
        }
      } catch (notificationError) {
        // Log but don't fail the request if notifications fail
        console.error('Failed to send absence notifications:', notificationError);
      }
    }

    // Fetch all successfully saved attendance records to return
    const successfulStudentIds = validRecords
      .filter(r => !errors.some(e => e.studentId === r.studentId))
      .map(r => r.studentId);
    const allCreated = successfulStudentIds.length > 0
      ? await db.attendance.findMany({
          where: {
            schoolId: targetSchoolId,
            termId,
            classId,
            date: attendanceDate,
            studentId: { in: successfulStudentIds },
          },
        })
      : [];

    return NextResponse.json({
      data: allCreated,
      errors: errors.length > 0 ? errors : undefined,
      createdCount: allCreated.length,
      errorCount: errors.length,
      message: `Attendance marked for ${created.length} students`,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
