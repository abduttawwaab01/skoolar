import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';

  try {
    switch (action) {
      case 'data-summary': {
        const schoolId = searchParams.get('schoolId') || '';
        if (!schoolId) return NextResponse.json({ success: false, message: 'schoolId required' }, { status: 400 });

        const [
          students, teachers, parents, accountants, directors, librarians,
          classes, subjects, exams, examScores, examAttempts, examQuestions,
          attendances, announcements, events, payments, homeworks, homeworkSubmissions,
          homeworkQuestions, homeworkAnswers,
          behaviorLogs, achievements, reportCards, feedbacks, supportTickets,
          borrowRecords, libraryBooks, auditLogs, teacherComments,
          notifications, transportRoutes, healthRecords,
          videoLessons, domainGrades, scoreTypes, registrationCodes, schoolSettings,
          lessonQuizzes, lessonQuizQuestions, lessonQuizAttempts,
          entranceExams, entranceExamQuestions, entranceExamAttempts,
        ] = await Promise.all([
          db.student.count({ where: { schoolId } }),
          db.teacher.count({ where: { schoolId } }),
          db.parent.count({ where: { schoolId } }),
          db.accountant.count({ where: { schoolId } }),
          db.director.count({ where: { schoolId } }),
          db.librarian.count({ where: { schoolId } }),
          db.class.count({ where: { schoolId } }),
          db.subject.count({ where: { schoolId } }),
          db.exam.count({ where: { schoolId } }),
          db.examScore.count({ where: { exam: { schoolId } } }),
          db.examAttempt.count({ where: { exam: { schoolId } } }),
          db.examQuestion.count({ where: { exam: { schoolId } } }),
          db.attendance.count({ where: { schoolId } }),
          db.announcement.count({ where: { schoolId } }),
          db.schoolEvent.count({ where: { schoolId } }),
          db.payment.count({ where: { schoolId } }),
          db.homework.count({ where: { schoolId } }),
          db.homeworkSubmission.count({ where: { schoolId } }),
          db.homeworkQuestion.count({ where: { schoolId } }),
          db.homeworkQuestionAnswer.count({ where: { schoolId } }),
          db.behaviorLog.count({ where: { schoolId } }),
          db.achievement.count({ where: { schoolId } }),
          db.reportCard.count({ where: { schoolId } }),
          db.feedback.count({ where: { schoolId } }),
          db.supportTicket.count({ where: { schoolId } }),
          db.borrowRecord.count({ where: { schoolId } }),
          db.libraryBook.count({ where: { schoolId } }),
          db.auditLog.count({ where: { schoolId } }),
          db.teacherComment.count({ where: { schoolId } }),
          db.notification.count({ where: { schoolId } }),
          db.transportRoute.count({ where: { schoolId } }),
          db.healthRecord.count({ where: { schoolId } }),
          db.videoLesson.count({ where: { schoolId } }),
          db.domainGrade.count({ where: { schoolId } }),
          db.scoreType.count({ where: { schoolId } }),
          db.registrationCode.count({ where: { schoolId } }),
          db.schoolSettings.count({ where: { schoolId } }),
          db.lessonQuiz.count({ where: { lesson: { schoolId } } }),
          db.lessonQuizQuestion.count({ where: { quiz: { lesson: { schoolId } } } }),
          db.lessonQuizAttempt.count({ where: { quiz: { lesson: { schoolId } } } }),
          db.entranceExam.count({ where: { schoolId } }),
          db.entranceExamQuestion.count({ where: { exam: { schoolId } } }),
          db.entranceExamAttempt.count({ where: { exam: { schoolId } } }),
        ]);

        const users = await db.user.count({ where: { schoolId } });
        const messages = await db.message.count({ where: { schoolId } });
        const conversations = await db.conversation.count({ where: { schoolId } });

        return NextResponse.json({ success: true, data: {
          users, students, teachers, parents, accountants, directors, librarians,
          classes, subjects, exams, examScores, examAttempts, examQuestions,
          attendances, announcements, events, payments, homeworks, homeworkSubmissions,
          behaviorLogs, achievements, reportCards, feedbacks, supportTickets,
          borrowRecords, libraryBooks, auditLogs, teacherComments,
          notifications, transportRoutes, healthRecords, videoLessons,
          domainGrades, scoreTypes, registrationCodes, schoolSettings,
          messages, conversations,
        }});
      }

      case 'system-summary': {
        const [schools, users, students, teachers, payments] = await Promise.all([
          db.school.count(),
          db.user.count(),
          db.student.count(),
          db.teacher.count(),
          db.payment.count(),
        ]);
        return NextResponse.json({ success: true, data: { schools, users, students, teachers, payments } });
      }

      case 'audit-log': {
        const logs = await db.dangerLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        return NextResponse.json({ success: true, data: logs });
      }

      case 'schools-list': {
        const schools = await db.school.findMany({
          select: { id: true, name: true, slug: true, isActive: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ success: true, data: schools });
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
  const authResult = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';
  const body = await request.json().catch(() => ({}));

  try {
    switch (action) {
      case 'delete-school-data': {
        const { schoolId, dataType, performedBy } = body;
        if (!schoolId || !dataType) return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });

        const deleteMap: Record<string, () => Promise<unknown>> = {
          all: async () => { await db.school.delete({ where: { id: schoolId } }); },
          students: async () => { await db.student.deleteMany({ where: { schoolId } }); },
          teachers: async () => { await db.teacher.deleteMany({ where: { schoolId } }); },
          parents: async () => { await db.parent.deleteMany({ where: { schoolId } }); },
          exams: async () => { await db.exam.deleteMany({ where: { schoolId } }); },
          payments: async () => { await db.payment.deleteMany({ where: { schoolId } }); },
          attendance: async () => { await db.attendance.deleteMany({ where: { schoolId } }); },
          homework: async () => { await db.homework.deleteMany({ where: { schoolId } }); },
          homework_questions: async () => { await db.homeworkQuestion.deleteMany({ where: { schoolId } }); },
          homework_answers: async () => { await db.homeworkQuestionAnswer.deleteMany({ where: { schoolId } }); },
          announcements: async () => { await db.announcement.deleteMany({ where: { schoolId } }); },
          events: async () => { await db.schoolEvent.deleteMany({ where: { schoolId } }); },
          library: async () => { await db.libraryBook.deleteMany({ where: { schoolId } }); },
          behavior: async () => { await db.behaviorLog.deleteMany({ where: { schoolId } }); },
          reports: async () => { await db.reportCard.deleteMany({ where: { schoolId } }); },
          feedback: async () => { await db.feedback.deleteMany({ where: { schoolId } }); },
          notifications: async () => { await db.notification.deleteMany({ where: { schoolId } }); },
          messages: async () => { await db.message.deleteMany({ where: { schoolId } }); },
          conversations: async () => { await db.conversation.deleteMany({ where: { schoolId } }); },
          users: async () => { await db.user.deleteMany({ where: { schoolId } }); },
        };

        const deleteFn = deleteMap[dataType];
        if (!deleteFn) return NextResponse.json({ success: false, message: `Unknown data type: ${dataType}` }, { status: 400 });

        await deleteFn();

        await db.dangerLog.create({
          data: {
            performedBy: performedBy || 'unknown',
            action: 'delete-school-data',
            targetType: 'school',
            targetId: schoolId,
            details: JSON.stringify({ dataType, timestamp: new Date().toISOString() }),
          },
        });

        return NextResponse.json({ success: true, message: `Successfully deleted ${dataType} data for school` });
      }

      case 'reset-school': {
        const { schoolId, keepAdmin, performedBy } = body;
        if (!schoolId) return NextResponse.json({ success: false, message: 'schoolId required' }, { status: 400 });

        const school = await db.school.findUnique({ where: { id: schoolId } });
        if (!school) return NextResponse.json({ success: false, message: 'School not found' }, { status: 404 });

        // Delete all related data
        await db.message.deleteMany({ where: { schoolId } });
        await db.conversation.deleteMany({ where: { schoolId } });
        await db.examAttempt.deleteMany({ where: { exam: { schoolId } } });
        await db.examQuestion.deleteMany({ where: { exam: { schoolId } } });
        await db.examScore.deleteMany({ where: { exam: { schoolId } } });
        await db.homeworkSubmission.deleteMany({ where: { schoolId } });
        await db.homework.deleteMany({ where: { schoolId } });
        await db.attendance.deleteMany({ where: { schoolId } });
        await db.exam.deleteMany({ where: { schoolId } });
        await db.schoolEvent.deleteMany({ where: { schoolId } });
        await db.announcement.deleteMany({ where: { schoolId } });
        await db.payment.deleteMany({ where: { schoolId } });
        await db.behaviorLog.deleteMany({ where: { schoolId } });
        await db.achievement.deleteMany({ where: { schoolId } });
        await db.reportCard.deleteMany({ where: { schoolId } });
        await db.feedback.deleteMany({ where: { schoolId } });
        await db.notification.deleteMany({ where: { schoolId } });
        await db.auditLog.deleteMany({ where: { schoolId } });
        await db.teacherComment.deleteMany({ where: { schoolId } });
        await db.borrowRecord.deleteMany({ where: { schoolId } });
        await db.libraryBook.deleteMany({ where: { schoolId } });
        await db.healthRecord.deleteMany({ where: { schoolId } });
        await db.transportRoute.deleteMany({ where: { schoolId } });
        await db.videoLesson.deleteMany({ where: { schoolId } });
        await db.domainGrade.deleteMany({ where: { schoolId } });
        await db.scoreType.deleteMany({ where: { schoolId } });
        await db.registrationCode.deleteMany({ where: { schoolId } });
        await db.schoolSettings.deleteMany({ where: { schoolId } });

        if (keepAdmin) {
          await db.student.deleteMany({ where: { schoolId } });
          await db.teacher.deleteMany({ where: { schoolId } });
          await db.parent.deleteMany({ where: { schoolId } });
          await db.accountant.deleteMany({ where: { schoolId } });
          await db.librarian.deleteMany({ where: { schoolId } });
          await db.director.deleteMany({ where: { schoolId } });
          await db.user.deleteMany({ where: { schoolId, role: { not: 'SCHOOL_ADMIN' } } });
        } else {
          await db.student.deleteMany({ where: { schoolId } });
          await db.teacher.deleteMany({ where: { schoolId } });
          await db.parent.deleteMany({ where: { schoolId } });
          await db.accountant.deleteMany({ where: { schoolId } });
          await db.librarian.deleteMany({ where: { schoolId } });
          await db.director.deleteMany({ where: { schoolId } });
          await db.user.deleteMany({ where: { schoolId } });
          await db.school.delete({ where: { id: schoolId } });
        }

        await db.dangerLog.create({
          data: {
            performedBy: performedBy || 'unknown',
            action: 'reset-school',
            targetType: 'school',
            targetId: schoolId,
            details: JSON.stringify({ schoolName: school.name, keepAdmin, timestamp: new Date().toISOString() }),
          },
        });

        return NextResponse.json({ success: true, message: `School "${school.name}" has been reset${keepAdmin ? ' (admin kept)' : ''}` });
      }

      case 'reset-system': {
        const { confirmCode, performedBy } = body;
        if (confirmCode !== 'SKOOLAR_RESET_ALL') {
          return NextResponse.json({ success: false, message: 'Invalid confirmation code' }, { status: 400 });
        }

        // Get super admin user
        const superAdmin = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

        // Delete ALL data in correct order (respect FK constraints)
        const deleteOps = [
          () => db.message.deleteMany({}),
          () => db.conversation.deleteMany({}),
          () => db.eventRSVP.deleteMany({}),
          () => db.examAttempt.deleteMany({}),
          () => db.examQuestion.deleteMany({}),
          () => db.examScore.deleteMany({}),
          () => db.homeworkSubmission.deleteMany({}),
          () => db.homework.deleteMany({}),
          () => db.attendance.deleteMany({}),
          () => db.attendanceScanLog.deleteMany({}),
          () => db.exam.deleteMany({}),
          () => db.schoolEvent.deleteMany({}),
          () => db.announcement.deleteMany({}),
          () => db.payment.deleteMany({}),
          () => db.platformPayment.deleteMany({}),
          () => db.behaviorLog.deleteMany({}),
          () => db.achievement.deleteMany({}),
          () => db.reportCard.deleteMany({}),
          () => db.feedback.deleteMany({}),
          () => db.notification.deleteMany({}),
          () => db.auditLog.deleteMany({}),
          () => db.exportLog.deleteMany({}),
          () => db.teacherComment.deleteMany({}),
          () => db.borrowRecord.deleteMany({}),
          () => db.libraryBook.deleteMany({}),
          () => db.healthRecord.deleteMany({}),
          () => db.transportRoute.deleteMany({}),
          () => db.videoLesson.deleteMany({}),
          () => db.domainGrade.deleteMany({}),
          () => db.scoreType.deleteMany({}),
          () => db.registrationCode.deleteMany({}),
          () => db.schoolSettings.deleteMany({}),
          () => db.feeStructure.deleteMany({}),
          () => db.supportTicket.deleteMany({}),
          () => db.student.deleteMany({}),
          () => db.teacher.deleteMany({}),
          () => db.parent.deleteMany({}),
          () => db.accountant.deleteMany({}),
          () => db.librarian.deleteMany({}),
          () => db.director.deleteMany({}),
          () => db.classSubject.deleteMany({}),
          () => db.subject.deleteMany({}),
          () => db.class.deleteMany({}),
          () => db.term.deleteMany({}),
          () => db.academicYear.deleteMany({}),
          () => db.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } }),
          () => db.school.deleteMany({}),
          () => db.subscriptionPlan.deleteMany({}),
        ];

        for (const op of deleteOps) {
          try { await op(); } catch { /* ignore individual errors */ }
        }

        await db.dangerLog.create({
          data: {
            performedBy: performedBy || (superAdmin?.id || 'unknown'),
            action: 'reset-system',
            targetType: 'system',
            details: JSON.stringify({ timestamp: new Date().toISOString(), superAdminKept: !!superAdmin }),
          },
        });

        return NextResponse.json({ success: true, message: 'System has been completely reset. Only super admin account remains.' });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
