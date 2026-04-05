import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/students/[id] - Get single student with profile, attendance summary, exam scores
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const student = await db.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            phone: true,
            role: true,
            isActive: true,
            lastLogin: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            section: true,
            grade: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.deletedAt) {
      return NextResponse.json({ error: 'Student has been deleted' }, { status: 410 });
    }

     // Get attendance summary
     const attendanceRecords = await db.attendance.findMany({
       where: { studentId: id },
       select: { status: true, date: true },
     });

     const attendanceSummary = {
       total: attendanceRecords.length,
       present: attendanceRecords.filter((a) => a.status === 'present').length,
       absent: attendanceRecords.filter((a) => a.status === 'absent').length,
       late: attendanceRecords.filter((a) => a.status === 'late').length,
       excused: attendanceRecords.filter((a) => a.status === 'excused').length,
       percentage: attendanceRecords.length > 0
         ? Math.round((attendanceRecords.filter((a) => a.status === 'present').length / attendanceRecords.length) * 100)
         : 0,
     };

     // Get weekly attendance data grouped by day of week
     const weeklyMap = new Map<string, { present: number; absent: number; late: number; total: number }>();
     const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
     attendanceRecords.forEach(record => {
       const dayName = dayNames[new Date(record.date).getDay()];
       if (!weeklyMap.has(dayName)) {
         weeklyMap.set(dayName, { present: 0, absent: 0, late: 0, total: 0 });
       }
       const dayData = weeklyMap.get(dayName)!;
       dayData.total++;
       if (record.status === 'present') dayData.present++;
       else if (record.status === 'absent') dayData.absent++;
       else if (record.status === 'late') dayData.late++;
     });
     const weeklyAttendance = Array.from(weeklyMap.entries())
       .sort((a, b) => dayNames.indexOf(a[0]) - dayNames.indexOf(b[0]))
       .map(([day, data]) => ({ day, ...data }));

    // Get exam scores summary
    const examScores = await db.examScore.findMany({
      where: { studentId: id },
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            type: true,
            totalMarks: true,
            passingMarks: true,
            subject: { select: { name: true, code: true } },
            term: { select: { name: true } },
            class: { select: { name: true, section: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get recent report cards
    const reportCards = await db.reportCard.findMany({
      where: { studentId: id },
      include: {
        term: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Get recent achievements
    const achievements = await db.achievement.findMany({
      where: { studentId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

     // Get recent behavior logs
     const behaviorLogs = await db.behaviorLog.findMany({
       where: { studentId: id },
       orderBy: { createdAt: 'desc' },
       take: 10,
     });

      // Get next upcoming exam (published and future date)
      const nextExam = await db.exam.findFirst({
        where: {
          schoolId: student.schoolId,
          ...(student.classId && { classId: student.classId }),
          isPublished: true,
          date: { gt: new Date() },
        },
        select: {
          id: true,
          name: true,
          date: true,
          subject: { select: { name: true } },
        },
        orderBy: { date: 'asc' },
      });

     // Get homework statistics
     const [totalHomework, completedHomework] = await Promise.all([
       db.homework.count({
         where: {
           schoolId: student.schoolId,
           classId: student.classId,
           deletedAt: null,
         },
       }),
       db.homeworkSubmission.count({
         where: {
           studentId: id,
         },
       }),
     ]);

     // Get current term for the student's school
     const currentTerm = await db.term.findFirst({
       where: {
         schoolId: student.schoolId,
         isCurrent: true,
       },
       include: {
         academicYear: {
           select: {
             id: true,
             name: true,
           },
         },
       },
     });

     return NextResponse.json({
       data: {
         ...student,
         attendanceSummary,
         weeklyAttendance,
         examScores,
         nextExam,
         homeworkStats: {
           total: totalHomework,
           completed: completedHomework,
         },
         currentTerm,
         reportCards,
         achievements,
         behaviorLogs,
       },
     });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/students/[id] - Update student
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.student.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted student' }, { status: 410 });
    }

    // Update User record if name or email provided
    if (body.name || body.email || body.phone) {
      const userData: Record<string, unknown> = {};
      if (body.name) userData.name = body.name;
      if (body.email) userData.email = body.email;
      if (body.phone !== undefined) userData.phone = body.phone;

      try {
        await db.user.update({
          where: { id: existing.userId },
          data: userData,
        });
      } catch {
        return NextResponse.json({ error: 'Failed to update user record (email may already exist)' }, { status: 409 });
      }
    }

    const { classId, parentIds, dateOfBirth, gender, address, bloodGroup, allergies, emergencyContact, photo, house, isPromoted, gpa, cumulativeGpa, rank, behaviorScore, isActive } = body;

    const student = await db.student.update({
      where: { id },
      data: {
        ...(classId !== undefined && { classId }),
        ...(parentIds !== undefined && { parentIds }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(gender !== undefined && { gender }),
        ...(address !== undefined && { address }),
        ...(bloodGroup !== undefined && { bloodGroup }),
        ...(allergies !== undefined && { allergies }),
        ...(emergencyContact !== undefined && { emergencyContact }),
        ...(photo !== undefined && { photo }),
        ...(house !== undefined && { house }),
        ...(isPromoted !== undefined && { isPromoted }),
        ...(gpa !== undefined && { gpa }),
        ...(cumulativeGpa !== undefined && { cumulativeGpa }),
        ...(rank !== undefined && { rank }),
        ...(behaviorScore !== undefined && { behaviorScore }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, phone: true },
        },
        class: {
          select: { id: true, name: true, section: true, grade: true },
        },
      },
    });

    return NextResponse.json({ data: student, message: 'Student updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/students/[id] - Soft delete student
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.student.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Student already deleted' }, { status: 410 });
    }

    // Soft delete student and user
    await Promise.all([
      db.student.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      db.user.update({
        where: { id: existing.userId },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);

    return NextResponse.json({ message: 'Student deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
