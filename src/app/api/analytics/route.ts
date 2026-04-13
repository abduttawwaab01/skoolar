import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const where = { schoolId };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      attendanceToday,
      activeExams,
      verifiedPayments,
      allPayments,
      attendanceTodayStaff,
    ] = await Promise.all([
      db.student.count({ where: { ...where, deletedAt: null, isActive: true } }),
      db.teacher.count({ where: { ...where, deletedAt: null, isActive: true } }),
      db.class.count({ where: { ...where, deletedAt: null } }),
      db.subject.count({ where: { ...where, deletedAt: null } }),
      db.attendance.count({ where: { ...where, date: { gte: today }, status: 'present' } }),
      db.exam.count({ where: { ...where, isPublished: true } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { ...where, status: 'verified', deletedAt: null } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { ...where, deletedAt: null } }),
      db.attendance.count({ where: { ...where, date: { gte: today }, method: 'staff' } }), // Real staff attendance
    ]);

    // Top Performers (RESTORED)
    const topPerformers = await db.student.findMany({
      where: { ...where, deletedAt: null, isActive: true, gpa: { not: null } },
      orderBy: { gpa: 'desc' },
      take: 5,
      include: {
        user: { select: { name: true, avatar: true } },
        class: { select: { name: true } }
      }
    });

    // Areas of Concern (RESTORED Heuristics)
    const lowGpaStudents = await db.student.findMany({
      where: { ...where, deletedAt: null, isActive: true, gpa: { lt: 3.0, not: null } },
      orderBy: { gpa: 'asc' },
      take: 5,
      include: { user: { select: { name: true } } }
    });

    // Attendance by Class
    const classes = await db.class.findMany({
      where,
      include: {
        _count: { select: { students: true } },
      },
    });

    const attendanceByClassRaw = await db.attendance.groupBy({
      by: ['classId'],
      where: { ...where, date: { gte: today } },
      _count: { id: true },
    });

    const attendanceByClass = classes.map((cls) => {
      const presentCount = attendanceByClassRaw.find((a) => a.classId === cls.id)?._count.id || 0;
      const totalStudentsInClass = cls._count.students || 0;
      return {
        classId: cls.id,
        className: cls.name,
        percentage: totalStudentsInClass > 0 ? Math.round((presentCount / totalStudentsInClass) * 100) : 0,
      };
    });

    const lowAttendanceClasses = attendanceByClass.filter(c => c.percentage < 85);

    // Performance by Subject
    const performanceBySubject = await db.examScore.groupBy({
      by: ['examId'],
      where: { exam: { schoolId } },
      _avg: { score: true },
      _count: { id: true },
    });

    const subjects = await db.subject.findMany({ where });
    const exams = await db.exam.findMany({ where, select: { id: true, subjectId: true } });

    const performanceWithNames = performanceBySubject.map((p) => {
      const exam = exams.find((e) => e.id === p.examId);
      const subject = subjects.find((s) => s.id === exam?.subjectId);
      return {
        subjectName: subject?.name || 'Unknown',
        averageScore: p._avg.score || 0,
        count: p._count.id,
      };
    });

    // Financial Data
    const financialData = {
      totalRevenue: verifiedPayments._sum.amount || 0,
      totalExpected: allPayments._sum.amount || 0,
      collectionRate: allPayments._sum.amount && allPayments._sum.amount > 0 
        ? Math.round(((verifiedPayments._sum.amount || 0) / allPayments._sum.amount) * 100) 
        : 0
    };

    // Trends
    const attendanceTrendEntries = await db.attendance.groupBy({
      by: ['date'],
      where: { ...where, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: { id: true },
    });

    const attendanceTrend = attendanceTrendEntries.map(e => ({
      date: e.date.toISOString(),
      present: e._count.id,
      total: totalStudents
    })).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      data: {
        schoolOverview: {
          totalStudents,
          totalTeachers,
          totalClasses,
          totalSubjects,
          attendanceToday,
          activeExams,
        },
        attendanceByClass,
        performanceBySubject: performanceWithNames,
        financialData,
        attendanceTrend,
        staffAttendanceToday,
        topPerformers,
        concerns: {
          lowGpa: lowGpaStudents,
          lowAttendance: lowAttendanceClasses
        },
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}