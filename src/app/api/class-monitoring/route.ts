import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';

  try {
    switch (action) {
      case 'monitoring-dashboard': {
        const schoolId = searchParams.get('schoolId') || '';
        if (!schoolId) return NextResponse.json({ success: false, message: 'schoolId required' }, { status: 400 });

        const [totalStudents, totalTeachers, totalClasses, todayAttendance] = await Promise.all([
          db.student.count({ where: { schoolId, isActive: true } }),
          db.teacher.count({ where: { schoolId, isActive: true } }),
          db.class.count({ where: { schoolId } }),
          db.attendance.count({
            where: {
              schoolId,
              date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              status: 'present',
            },
          }),
        ]);

        const totalActiveStudents = totalStudents || 1;
        const attendanceRate = totalStudents > 0 ? Math.round((todayAttendance / totalActiveStudents) * 100) : 0;

        // Students needing attention (low attendance, low behavior, etc.)
        const recentBehaviorIssues = await db.behaviorLog.count({
          where: {
            schoolId,
            type: 'negative',
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        });

        // Homework stats
        const pendingHomework = await db.homework.count({
          where: { schoolId, status: 'active', dueDate: { gte: new Date() } },
        });

        // Recent exam average
        const recentScores = await db.examScore.findMany({
          where: { exam: { schoolId } },
          take: 100,
          orderBy: { createdAt: 'desc' },
          select: { score: true },
        });
        const avgScore = recentScores.length > 0
          ? Math.round(recentScores.reduce((s, e) => s + e.score, 0) / recentScores.length)
          : 0;

        return NextResponse.json({
          success: true,
          data: {
            totalStudents, totalTeachers, totalClasses,
            presentToday: todayAttendance,
            attendanceRate,
            behaviorIssues: recentBehaviorIssues,
            pendingHomework,
            avgExamScore: avgScore,
          },
        });
      }

       case 'class-overview': {
         const schoolId = searchParams.get('schoolId') || '';
         const classId = searchParams.get('classId') || '';
         if (!schoolId) return NextResponse.json({ success: false, message: 'schoolId required' }, { status: 400 });

         const where: Record<string, unknown> = { schoolId };
         if (classId) (where as Record<string, string>).id = classId;

         const classes = await db.class.findMany({
           where,
           include: {
             classTeacher: { include: { user: { select: { name: true, id: true } } } },
             students: { where: { isActive: true }, select: { id: true } },
             _count: { select: { exams: true, homeworks: true } },
           },
         });

         // ── BATCH FETCH ATTENDANCE TO AVOID N+1 (was 3 queries per class) ──
         const classIds = classes.map(c => c.id);
         const today = new Date();
         today.setHours(0, 0, 0, 0);
         const weekAgo = new Date(today);
         weekAgo.setDate(weekAgo.getDate() - 7);

         const [todayAttendance, weekAttendancePresent, weekAttendanceTotal] = await Promise.all([
           db.attendance.findMany({
             where: { classId: { in: classIds }, date: { gte: today } },
             select: { classId: true, status: true, id: true },
           }),
           db.attendance.findMany({
             where: { classId: { in: classIds }, date: { gte: weekAgo }, status: 'present' },
             select: { classId: true, id: true },
           }),
           db.attendance.findMany({
             where: { classId: { in: classIds }, date: { gte: weekAgo } },
             select: { classId: true, id: true },
           }),
         ]);

         // Build lookup maps
         const todayMap = new Map<string, number>();
         const weekPresentMap = new Map<string, number>();
         const weekTotalMap = new Map<string, number>();

         for (const att of todayAttendance) {
           todayMap.set(att.classId, (todayMap.get(att.classId) || 0) + 1);
         }
         for (const att of weekAttendancePresent) {
           weekPresentMap.set(att.classId, (weekPresentMap.get(att.classId) || 0) + 1);
         }
         for (const att of weekAttendanceTotal) {
           weekTotalMap.set(att.classId, (weekTotalMap.get(att.classId) || 0) + 1);
         }

         // Enrich classes without database queries
         const enriched = classes.map(cls => {
           const studentCount = cls.students.length;
           const todayPresent = todayMap.get(cls.id) || 0;
           const weekPresent = weekPresentMap.get(cls.id) || 0;
           const weekTotal = weekTotalMap.get(cls.id) || 0;
           const weekRate = weekTotal > 0 ? Math.round((weekPresent / weekTotal) * 100) : 0;

           return {
             id: cls.id, name: cls.name, section: cls.section, grade: cls.grade,
             capacity: cls.capacity,
             studentCount,
             classTeacher: cls.classTeacher?.user?.name || 'Unassigned',
             todayAttendanceRate: studentCount > 0 ? Math.round((todayPresent / studentCount) * 100) : 0,
             weekAttendanceRate: weekRate,
             examCount: cls._count.exams,
             homeworkCount: cls._count.homeworks,
           };
         });

         return NextResponse.json({ success: true, data: enriched });
       }

      case 'student-activity': {
        const schoolId = searchParams.get('schoolId') || '';
        const studentId = searchParams.get('studentId') || '';
        if (!schoolId || !studentId) return NextResponse.json({ success: false, message: 'Missing required params' }, { status: 400 });

        const student = await db.student.findUnique({
          where: { id: studentId },
          include: { user: { select: { name: true, email: true, lastLogin: true } }, class: { select: { name: true } } },
        });
        if (!student) return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });

        const today = new Date(new Date().setHours(0, 0, 0, 0));
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [todayAttendance, weekAttendanceCount, monthAttendanceCount, weekTotalDays, monthTotalDays,
          homeworkSubmissions, totalHomework, examScores, behaviorLogs, recentComments] = await Promise.all([
          db.attendance.findFirst({ where: { studentId, date: { gte: today } }, select: { status: true } }),
          db.attendance.count({ where: { studentId, date: { gte: weekAgo }, status: 'present' } }),
          db.attendance.count({ where: { studentId, date: { gte: monthAgo }, status: 'present' } }),
          db.attendance.groupBy({ where: { studentId, date: { gte: weekAgo } }, by: ['date'] }),
          db.attendance.groupBy({ where: { studentId, date: { gte: monthAgo } }, by: ['date'] }),
          db.homeworkSubmission.count({ where: { studentId, status: { in: ['submitted', 'graded'] } } }),
          db.homeworkSubmission.count({ where: { studentId } }),
          db.examScore.findMany({ where: { studentId }, take: 20, orderBy: { createdAt: 'desc' }, select: { score: true, exam: { select: { totalMarks: true, subject: { select: { name: true } } } } } }),
          db.behaviorLog.findMany({ where: { studentId }, take: 10, orderBy: { createdAt: 'desc' } }),
          db.teacherComment.findMany({ where: { studentId }, take: 5, orderBy: { createdAt: 'desc' }, include: { teacher: { include: { user: { select: { name: true } } } } } }),
        ]);

        const weekRate = weekTotalDays.length > 0 ? Math.round((weekAttendanceCount / weekTotalDays.length) * 100) : 0;
        const monthRate = monthTotalDays.length > 0 ? Math.round((monthAttendanceCount / monthTotalDays.length) * 100) : 0;
        const homeworkRate = totalHomework > 0 ? Math.round((homeworkSubmissions / totalHomework) * 100) : 0;
        const avgScore = examScores.length > 0 ? Math.round(examScores.reduce((s, e) => s + e.score, 0) / examScores.length) : 0;

        return NextResponse.json({
          success: true,
          data: {
            student: { id: student.id, name: student.user.name, email: student.user.email, className: student.class?.name, lastLogin: student.user.lastLogin, admissionNo: student.admissionNo, gpa: student.gpa, behaviorScore: student.behaviorScore },
            todayStatus: todayAttendance?.status || 'not_recorded',
            weekAttendanceRate: weekRate,
            monthAttendanceRate: monthRate,
            homeworkSubmissionRate: homeworkRate,
            avgExamScore: avgScore,
            recentScores: examScores,
            behaviorLogs,
            recentComments,
          },
        });
      }

       case 'students-list': {
         const schoolId = searchParams.get('schoolId') || '';
         const classId = searchParams.get('classId') || '';
         if (!schoolId) return NextResponse.json({ success: false, message: 'schoolId required' }, { status: 400 });

         const studentWhere: Record<string, unknown> = { schoolId, isActive: true };
         if (classId) (studentWhere as Record<string, string>).classId = classId;

         const students = await db.student.findMany({
           where: studentWhere,
           include: {
             user: { select: { name: true, email: true, lastLogin: true } },
             class: { select: { name: true } },
           },
           orderBy: { admissionNo: 'asc' },
         });

         // ── BATCH FETCH ATTENDANCE TO AVOID N+1 (was 1 query per student) ──
         const studentIds = students.map(s => s.id);
         const today = new Date();
         today.setHours(0, 0, 0, 0);

         const todayAttendance = await db.attendance.findMany({
           where: {
             studentId: { in: studentIds },
             date: { gte: today },
           },
           select: { studentId: true, status: true },
         });

         // Build lookup map: studentId -> today's attendance status
         const attendanceMap = new Map<string, string>();
         for (const att of todayAttendance) {
           attendanceMap.set(att.studentId, att.status);
         }

         // Enrich students without additional queries
         const enriched = students.map(s => ({
           id: s.id,
           name: s.user.name,
           email: s.user.email,
           admissionNo: s.admissionNo,
           className: s.class?.name || 'Unassigned',
           lastLogin: s.user.lastLogin,
           gpa: s.gpa,
           behaviorScore: s.behaviorScore,
           todayStatus: attendanceMap.get(s.id) || 'not_recorded',
         }));

         return NextResponse.json({ success: true, data: enriched });
       }

       case 'teacher-performance': {
         const schoolId = searchParams.get('schoolId') || '';
         if (!schoolId) return NextResponse.json({ success: false, message: 'schoolId required' }, { status: 400 });

         const teachers = await db.teacher.findMany({
           where: { schoolId, isActive: true },
           include: {
             user: { select: { name: true, email: true, lastLogin: true, loginCount: true } },
             classes: { select: { id: true, name: true } },
             classSubjects: { select: { subject: { select: { name: true } } } },
             _count: { select: { exams: true, comments: true } },
           },
         });

         // ── BATCH FETCH STUDENTS TO AVOID N+1 (was 1 query per teacher) ──
         // Collect all class IDs from all teachers (filter out null/undefined)
         const allClassIds = teachers.flatMap(t => t.classes.map(c => c.id).filter((id): id is string => id != null));
         
         // Fetch all students for all these classes in one query
         const allStudents = await db.student.findMany({
           where: { classId: { in: allClassIds }, isActive: true },
           select: { classId: true, id: true },
         });

          // Build lookup: classId -> student count
          const classStudentCountMap = new Map<string, number>();
          for (const student of allStudents) {
            if (student.classId) { // Type guard for null check
              classStudentCountMap.set(student.classId, (classStudentCountMap.get(student.classId) || 0) + 1);
            }
          }

         // Calculate total students per teacher by summing their classes' counts
         const enriched = teachers.map(t => {
           const totalStudents = t.classes.reduce((sum, cls) => sum + (classStudentCountMap.get(cls.id) || 0), 0);
           return {
             id: t.id,
             name: t.user.name,
             email: t.user.email,
             lastLogin: t.user.lastLogin,
             loginCount: t.user.loginCount,
             classesCount: t.classes.length,
             classList: t.classes.map(c => c.name),
             subjects: [...new Set(t.classSubjects.map(cs => cs.subject.name))],
             totalStudents,
             examCount: t._count.exams,
             commentCount: t._count.comments,
           };
         });

         return NextResponse.json({ success: true, data: enriched });
       }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';
  const body = await request.json().catch(() => ({}));

  try {
    switch (action) {
      case 'add-note': {
        const { schoolId, studentId, note, addedBy } = body;
        if (!schoolId || !studentId || !note) return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
        const behavior = await db.behaviorLog.create({
          data: { schoolId, studentId, type: 'note', category: 'monitoring', points: 0, description: note, reportedBy: addedBy },
        });

        // Audit log
        await db.auditLog.create({
          data: {
            schoolId, userId: studentId, action: 'NOTE', entity: 'BEHAVIOR', entityId: behavior.id,
            details: `Observation recorded: ${note.slice(0, 50)}${note.length > 50 ? '...' : ''}`
          }
        }).catch(err => console.error('Audit Error:', err));

        return NextResponse.json({ success: true, data: behavior });
      }
      case 'flag-student': {
        const { schoolId, studentId, reason, flaggedBy } = body;
        if (!schoolId || !studentId || !reason) return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
        const behavior = await db.behaviorLog.create({
          data: { schoolId, studentId, type: 'negative', category: 'flagged', points: -5, description: reason, reportedBy: flaggedBy },
        });

        // Audit log
        await db.auditLog.create({
          data: {
            schoolId, userId: studentId, action: 'FLAG', entity: 'BEHAVIOR', entityId: behavior.id,
            details: `Student flagged: ${reason.slice(0, 50)}`
          }
        }).catch(err => console.error('Audit Error:', err));

        return NextResponse.json({ success: true, data: behavior });
      }
      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
