import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=60";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get("schoolId") || "";
    const termId = searchParams.get("termId") || "";

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    // For SUPER_ADMIN, an empty querySchoolId allows platform-level analytics.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    const isPlatformLevel = !targetSchoolId && auth.role === "SUPER_ADMIN";

    if (!targetSchoolId && !isPlatformLevel) {
      return NextResponse.json(
        { error: "School context required" },
        { status: 403 },
      );
    }

    const where: Record<string, unknown> = isPlatformLevel
      ? { deletedAt: null, isActive: true }
      : { schoolId: targetSchoolId, deletedAt: null, isActive: true };

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      studentsForRanking,
    ] = await Promise.all([
      db.student.count({ where }),
      db.teacher.count({
        where: {
          deletedAt: null,
          isActive: true,
          ...(isPlatformLevel ? {} : { schoolId: targetSchoolId }),
        },
      }),
      db.class.count({
        where: { deletedAt: null, ...(isPlatformLevel ? {} : { schoolId: targetSchoolId }) },
      }),
      db.subject.count({
        where: { deletedAt: null, ...(isPlatformLevel ? {} : { schoolId: targetSchoolId }) },
      }),
      db.student.findMany({
        where: isPlatformLevel
          ? { deletedAt: null, isActive: true }
          : { schoolId: targetSchoolId, deletedAt: null, isActive: true },
        select: {
          id: true,
          admissionNo: true,
          gpa: true,
          user: { select: { name: true, avatar: true } },
          class: { select: { name: true, section: true } },
        },
        take: 50,
      }),
    ]);

    const schoolOverview = {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      studentTeacherRatio:
        totalTeachers > 0
          ? Math.round((totalStudents / totalTeachers) * 10) / 10
          : 0,
    };

    const classes = await db.class.findMany({
      where: isPlatformLevel
        ? { deletedAt: null }
        : { schoolId: targetSchoolId, deletedAt: null },
      select: {
        id: true,
        name: true,
        section: true,
        grade: true,
        schoolId: true,
        students: {
          where: { deletedAt: null, isActive: true },
          select: { id: true },
        },
      },
    });

    const attendanceByClass: Array<{
      classId: string;
      className: string;
      section: string | null;
      grade: string | null;
      totalStudents: number;
      totalRecords: number;
      presentCount: number;
      absentCount: number;
      lateCount: number;
      percentage: number;
    }> = [];

    const classIds = classes.map((c) => c.id);
    const attendanceWhere: Record<string, unknown> = isPlatformLevel
      ? {}
      : { schoolId: targetSchoolId };
    if (termId) attendanceWhere.termId = termId;
    if (classIds.length > 0) attendanceWhere.classId = { in: classIds };

    const allAttendance = await db.attendance.findMany({
      where: attendanceWhere,
      select: { classId: true, status: true },
    });

    const attendanceByClassId = new Map<
      string,
      { present: number; absent: number; late: number }
    >();
    for (const record of allAttendance) {
      if (!attendanceByClassId.has(record.classId)) {
        attendanceByClassId.set(record.classId, {
          present: 0,
          absent: 0,
          late: 0,
        });
      }
      const counts = attendanceByClassId.get(record.classId)!;
      if (record.status === "present") counts.present++;
      else if (record.status === "absent") counts.absent++;
      else if (record.status === "late") counts.late++;
    }

    for (const cls of classes) {
      const counts = attendanceByClassId.get(cls.id) || {
        present: 0,
        absent: 0,
        late: 0,
      };
      const totalRecords = counts.present + counts.absent + counts.late;

      attendanceByClass.push({
        classId: cls.id,
        className: cls.name,
        section: cls.section,
        grade: cls.grade,
        totalStudents: cls.students.length,
        totalRecords,
        presentCount: counts.present,
        absentCount: counts.absent,
        lateCount: counts.late,
        percentage:
          totalRecords > 0
            ? Math.round((counts.present / totalRecords) * 100)
            : 0,
      });
    }

    const examWhere: Record<string, unknown> = isPlatformLevel
      ? {}
      : { schoolId: targetSchoolId };
    if (termId) examWhere.termId = termId;

    const exams = await db.exam.findMany({
      where: examWhere,
      select: {
        id: true,
        name: true,
        totalMarks: true,
        passingMarks: true,
        subjectId: true,
        subject: { select: { name: true } },
      },
    });

    const examIds = exams.map((e) => e.id);
    let examScores: Array<{ examId: string; score: number }> = [];
    if (examIds.length > 0) {
      examScores = await db.examScore.findMany({
        where: { examId: { in: examIds } },
        select: { examId: true, score: true },
      });
    }

    const scoresByExamId = new Map<string, number[]>();
    for (const s of examScores) {
      if (!scoresByExamId.has(s.examId)) scoresByExamId.set(s.examId, []);
      scoresByExamId.get(s.examId)!.push(s.score);
    }

    const subjectGroups = new Map<string, typeof exams>();
    for (const exam of exams) {
      const key = exam.subjectId;
      if (!subjectGroups.has(key)) subjectGroups.set(key, []);
      subjectGroups.get(key)!.push(exam);
    }

    const performanceBySubject: Array<{
      subjectId: string;
      subjectName: string;
      totalExams: number;
      averageScore: number;
      highestScore: number;
      lowestScore: number;
      passRate: number;
    }> = [];

    for (const [subjectId, subjectExams] of subjectGroups) {
      const subjectExamIds = subjectExams.map((e) => e.id);
      const subjectScores = examScores.filter((s) =>
        subjectExamIds.includes(s.examId),
      );
      const scoreValues = subjectScores.map((s) => s.score);
      const passingMarks = subjectExams[0]?.passingMarks || 50;

      performanceBySubject.push({
        subjectId,
        subjectName: subjectExams[0]?.subject.name || "Unknown",
        totalExams: subjectExams.length,
        averageScore:
          scoreValues.length > 0
            ? Math.round(
                (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) *
                  100,
              ) / 100
            : 0,
        highestScore: scoreValues.length > 0 ? Math.max(...scoreValues) : 0,
        lowestScore: scoreValues.length > 0 ? Math.min(...scoreValues) : 0,
        passRate:
          scoreValues.length > 0
            ? Math.round(
                (scoreValues.filter((s) => s >= passingMarks).length /
                  scoreValues.length) *
                  100,
              )
            : 0,
      });
    }

    const financialWhere = isPlatformLevel ? {} : { schoolId: targetSchoolId };
    const financialSummary = await db.payment.aggregate({
      _sum: { amount: true },
      _count: true,
      where: financialWhere,
    });

    const paymentsByStatus = await db.payment.groupBy({
      by: ["status"],
      where: financialWhere,
      _sum: { amount: true },
      _count: true,
    });

    const financialData = {
      totalRevenue: financialSummary._sum.amount || 0,
      totalTransactions: financialSummary._count,
      byStatus: paymentsByStatus.map((p) => ({
        status: p.status,
        total: p._sum.amount || 0,
        count: p._count,
      })),
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAttendance = await db.attendance.findMany({
      where: {
        ...(isPlatformLevel ? {} : { schoolId: targetSchoolId }),
        date: { gte: thirtyDaysAgo },
      },
      select: { date: true, status: true },
    });

    const attendanceTrend = new Map<
      string,
      {
        date: string;
        present: number;
        absent: number;
        late: number;
        total: number;
      }
    >();
    for (const record of recentAttendance) {
      const dateKey = record.date.toISOString().split("T")[0];
      if (!attendanceTrend.has(dateKey)) {
        attendanceTrend.set(dateKey, {
          date: dateKey,
          present: 0,
          absent: 0,
          late: 0,
          total: 0,
        });
      }
      const dayData = attendanceTrend.get(dateKey)!;
      dayData.total++;
      if (record.status === "present") dayData.present++;
      else if (record.status === "absent") dayData.absent++;
      else if (record.status === "late") dayData.late++;
    }

    const response = NextResponse.json({
      data: {
        schoolOverview,
        attendanceByClass,
        performanceBySubject,
        financialData,
        studentRanking: studentsForRanking
          .sort((a, b) => (b.gpa || 0) - (a.gpa || 0))
          .slice(0, 50)
          .map((s, i) => ({
            rank: i + 1,
            id: s.id,
            admissionNo: s.admissionNo,
            gpa: s.gpa || 0,
            totalScore: s.gpa || 0,
            examCount: 0,
            user: s.user,
            class: s.class,
          })),
        attendanceTrend: Array.from(attendanceTrend.values()).sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
        generatedAt: new Date().toISOString(),
      },
    });

    response.headers.set("Cache-Control", CACHE_CONTROL);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analytics API Error:", error);
    return NextResponse.json(
      { error: `Analytics error: ${message}` },
      { status: 500 },
    );
  }
}
