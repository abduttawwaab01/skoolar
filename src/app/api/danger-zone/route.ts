import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['SUPER_ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';

  try {
    switch (action) {
      case 'data-summary': {
        // SUPER_ADMIN only route; schoolId from query param is the only source
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
          videoCheckpoints, videoCheckpointProgress, teacherTasks, teacherTaskCompletions,
          teacherPerformance, studentSnapshots, leaderboards, performanceBadges,
          encouragementMessages,
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
          db.videoCheckpoint.count({ where: { lesson: { schoolId } } }),
          db.videoCheckpointProgress.count({ where: { checkpoint: { lesson: { schoolId } } } }),
          db.teacherTask.count({ where: { schoolId } }),
          db.teacherTaskCompletion.count({ where: { task: { schoolId } } }),
          db.teacherPerformance.count({ where: { schoolId } }),
          db.studentPerformanceSnapshot.count({ where: { schoolId } }),
          db.leaderboard.count({ where: { schoolId } }),
          db.performanceBadge.count({ where: { schoolId } }),
          db.encouragementMessage.count({ where: { schoolId } }),
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
          messages, conversations, videoCheckpoints, videoCheckpointProgress,
          teacherTasks, teacherTaskCompletions, teacherPerformance, studentSnapshots,
          leaderboards, performanceBadges, encouragementMessages,
          entranceExams, entranceExamQuestions, entranceExamAttempts,
          homeworkQuestions, homeworkAnswers,
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
  const authResult = await requireRole(request, ['SUPER_ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || '';
  const body = await request.json().catch(() => ({}));

  try {
    switch (action) {
      case 'delete-school-data': {
        const { schoolId, dataType, performedBy } = body;
        if (!schoolId || !dataType) return NextResponse.json({ success: false, message: 'Missing schoolId or dataType' }, { status: 400 });

        const deleteMap: Record<string, () => Promise<unknown>> = {
          all: async () => { 
            // First delete all related data to avoid FK constraints
            // Users (will cascade to delete Student, Teacher, Parent, Accountant, Director, Librarian)
            const users = await db.user.findMany({ where: { schoolId }, select: { id: true } });
            const userIds = users.map(u => u.id);
            await db.user.deleteMany({ where: { id: { in: userIds } } });
            
            // Delete other school-related data
            await db.message.deleteMany({ where: { schoolId } });
            await db.conversation.deleteMany({ where: { schoolId } });
            await db.announcement.deleteMany({ where: { schoolId } });
            await db.schoolEvent.deleteMany({ where: { schoolId } });
            await db.notification.deleteMany({ where: { schoolId } });
            await db.payment.deleteMany({ where: { schoolId } });
            await db.feedback.deleteMany({ where: { schoolId } });
            await db.auditLog.deleteMany({ where: { schoolId } });
            await db.registrationCode.deleteMany({ where: { schoolId } });
            await db.schoolSettings.deleteMany({ where: { schoolId } });
            await db.domainGrade.deleteMany({ where: { schoolId } });
            await db.scoreType.deleteMany({ where: { schoolId } });
            
            // Finally delete the school
            await db.school.delete({ where: { id: schoolId } });
          },
          students: async () => { 
            // First delete related user records
            const students = await db.student.findMany({ where: { schoolId }, select: { userId: true } });
            const userIds = students.map(s => s.userId);
            await db.user.deleteMany({ where: { id: { in: userIds } } });
            await db.student.deleteMany({ where: { schoolId } });
          },
          teachers: async () => { 
            // Delete related records first due to FK constraints
            const teachers = await db.teacher.findMany({ where: { schoolId }, select: { id: true, userId: true } });
            const teacherIds = teachers.map(t => t.id);
            const userIds = teachers.map(t => t.userId);
            
            // Delete related teacher data
            await db.teacherTask.deleteMany({ where: { teacherId: { in: teacherIds } } });
            await db.teacherComment.deleteMany({ where: { teacherId: { in: teacherIds } } });
            await db.teacherPerformance.deleteMany({ where: { teacherId: { in: teacherIds } } });
            await db.weeklyEvaluation.deleteMany({ where: { teacherId: { in: teacherIds } } });
            await db.teacher.deleteMany({ where: { schoolId } });
            await db.user.deleteMany({ where: { id: { in: userIds } } });
          },
          parents: async () => { 
            const parents = await db.parent.findMany({ where: { schoolId }, select: { userId: true } });
            const userIds = parents.map(p => p.userId);
            await db.user.deleteMany({ where: { id: { in: userIds } } });
            await db.parent.deleteMany({ where: { schoolId } });
          },
          exams: async () => { 
            const exams = await db.exam.findMany({ where: { schoolId }, select: { id: true } });
            const examIds = exams.map(e => e.id);
            await db.examScore.deleteMany({ where: { examId: { in: examIds } } });
            await db.examAttempt.deleteMany({ where: { examId: { in: examIds } } });
            await db.examQuestion.deleteMany({ where: { examId: { in: examIds } } });
            await db.exam.deleteMany({ where: { schoolId } });
          },
          payments: async () => { await db.payment.deleteMany({ where: { schoolId } }); },
          attendance: async () => { await db.attendance.deleteMany({ where: { schoolId } }); },
          homework: async () => { 
            const hw = await db.homework.findMany({ where: { schoolId }, select: { id: true } });
            const hwIds = hw.map(h => h.id);
            await db.homeworkSubmission.deleteMany({ where: { homeworkId: { in: hwIds } } });
            await db.homework.deleteMany({ where: { schoolId } });
          },
          homework_questions: async () => { await db.homeworkQuestion.deleteMany({ where: { schoolId } }); },
          homework_answers: async () => { await db.homeworkQuestionAnswer.deleteMany({ where: { schoolId } }); },
          announcements: async () => { await db.announcement.deleteMany({ where: { schoolId } }); },
          events: async () => { await db.schoolEvent.deleteMany({ where: { schoolId } }); },
          library: async () => { 
            const books = await db.libraryBook.findMany({ where: { schoolId }, select: { id: true } });
            const bookIds = books.map(b => b.id);
            await db.borrowRecord.deleteMany({ where: { bookId: { in: bookIds } } });
            await db.libraryBook.deleteMany({ where: { schoolId } });
          },
          behavior: async () => { await db.behaviorLog.deleteMany({ where: { schoolId } }); },
          reports: async () => { await db.reportCard.deleteMany({ where: { schoolId } }); },
          feedback: async () => { await db.feedback.deleteMany({ where: { schoolId } }); },
          notifications: async () => { await db.notification.deleteMany({ where: { schoolId } }); },
          messages: async () => { await db.message.deleteMany({ where: { schoolId } }); },
          conversations: async () => { await db.conversation.deleteMany({ where: { schoolId } }); },
          users: async () => { await db.user.deleteMany({ where: { schoolId } }); },
          video_checkpoints: async () => { 
            const lessons = await db.videoLesson.findMany({ where: { schoolId }, select: { id: true } });
            const lessonIds = lessons.map(l => l.id);
            await db.videoCheckpoint.deleteMany({ where: { lessonId: { in: lessonIds } } });
            await db.videoLesson.deleteMany({ where: { schoolId } });
          },
          video_checkpoint_progress: async () => { 
            const lessons = await db.videoLesson.findMany({ where: { schoolId }, select: { id: true } });
            const lessonIds = lessons.map(l => l.id);
            const checkpoints = await db.videoCheckpoint.findMany({ where: { lessonId: { in: lessonIds } }, select: { id: true } });
            const checkpointIds = checkpoints.map(c => c.id);
            await db.videoCheckpointProgress.deleteMany({ where: { checkpointId: { in: checkpointIds } } });
          },
          teacher_tasks: async () => { await db.teacherTask.deleteMany({ where: { schoolId } }); },
          teacher_task_completions: async () => { await db.teacherTaskCompletion.deleteMany({ where: { task: { schoolId } } }); },
          teacher_performance: async () => { await db.teacherPerformance.deleteMany({ where: { schoolId } }); },
          student_snapshots: async () => { await db.studentPerformanceSnapshot.deleteMany({ where: { schoolId } }); },
          leaderboards: async () => { await db.leaderboard.deleteMany({ where: { schoolId } }); },
          performance_badges: async () => { await db.performanceBadge.deleteMany({ where: { schoolId } }); },
          encouragement_messages: async () => { await db.encouragementMessage.deleteMany({ where: { schoolId } }); },
        };

        const deleteFn = deleteMap[dataType];
        if (!deleteFn) return NextResponse.json({ success: false, message: `Unknown data type: ${dataType}` }, { status: 400 });

        try {
          await deleteFn();
        } catch (deleteError) {
          const errorMessage = deleteError instanceof Error ? deleteError.message : 'Unknown error';
          console.error(`Delete error for ${dataType}:`, deleteError);
          return NextResponse.json({ success: false, message: `Failed to delete ${dataType}: ${errorMessage}` }, { status: 500 });
        }

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

        // Delete users first - with cascade deletes, this will delete related profiles
        if (keepAdmin) {
          // Keep school admin, delete all other users
          await db.user.deleteMany({ where: { schoolId, role: { not: 'SCHOOL_ADMIN' } } });
        } else {
          // Delete all users (will cascade to delete Student, Teacher, Parent, etc.)
          await db.user.deleteMany({ where: { schoolId } });
          // Then delete school
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
