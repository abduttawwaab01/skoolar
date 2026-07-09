import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuthAndRole,
  errorResponse,
  successResponse,
  validateTeacherClass,
  validateTeacherStudent,
  validateParentChild,
  resolveTeacherId,
} from '@/lib/api-helpers';
import {
  HomeworkCreateSchema,
  HomeworkSubmissionSchema,
  HomeworkGradeSchema,
  HomeworkUpdateSchema,
} from '@/lib/validators';
import { notifyClassStudents } from '@/lib/notifications';
import { distributeMarks } from '@/lib/marks-utils';

// GET /api/homework - List homework assignments with filtering
export async function GET(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'TEACHER',
    'STUDENT',
    'PARENT',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const homeworkId = searchParams.get('id') || '';
    const classId = searchParams.get('classId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const status = searchParams.get('status') || '';
    const teacherId = searchParams.get('teacherId') || '';
    const studentId = searchParams.get('studentId') || '';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const includeSubmissions = searchParams.get('includeSubmissions') === 'true';
    const includeQuestions = searchParams.get('includeQuestions') === 'true';

    // School isolation - enforce based on role
    const where: Record<string, unknown> = { deletedAt: null };

    if (auth.role === 'SUPER_ADMIN') {
      const schoolId = searchParams.get('schoolId') || '';
      if (schoolId) where.schoolId = schoolId;
    } else {
      if (!auth.schoolId) {
        return errorResponse('School ID not found in session', 400);
      }
      where.schoolId = auth.schoolId;
    }

    if (homeworkId) where.id = homeworkId;
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (status) where.status = status;

    // Collect OR conditions to avoid overwriting (bug fix: search OR was overwriting teacher OR)
    const orConditions: Record<string, unknown>[] = [];

    // Role-based teacher filter
    if (auth.role === 'TEACHER') {
      const resolvedTeacherId = await resolveTeacherId(auth.userId || '');
      if (resolvedTeacherId && teacherId && teacherId !== auth.userId && teacherId !== resolvedTeacherId) {
        return errorResponse('Teachers can only view their own assignments', 403);
      }
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        include: {
          classes: { select: { id: true } },
          classSubjects: { select: { classId: true } },
        },
      });
      const teacherClassIds = new Set<string>();
      if (teacher) {
        teacher.classes.forEach(c => teacherClassIds.add(c.id));
        teacher.classSubjects.forEach(cs => teacherClassIds.add(cs.classId));
      }
      const myTeacherId = resolvedTeacherId || auth.userId;
      if (teacherClassIds.size > 0) {
        orConditions.push(
          { teacherId: myTeacherId },
          { classId: { in: Array.from(teacherClassIds) } },
        );
      } else {
        where.teacherId = myTeacherId;
      }
    } else if (teacherId) {
      where.teacherId = teacherId;
    }

    // Role-based student/parent filter
    let resolvedStudentId = '';
    if (auth.role === 'STUDENT') {
      if (studentId && studentId !== auth.userId) {
        return errorResponse('Students can only view their own submissions', 403);
      }
      // Students can only see homework for their class
      const student = await db.student.findUnique({
        where: { userId: auth.userId, schoolId: auth.schoolId },
        select: { id: true, classId: true },
      });
      if (student?.classId) {
        where.classId = student.classId;
      }
      resolvedStudentId = student?.id || ''; // Use Student.id not User.id
    } else if (auth.role === 'PARENT') {
      if (!auth.userId) {
        return errorResponse('User ID not found', 400);
      }
      const parentRecord = await db.parent.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (!parentRecord) {
        return successResponse({ records: [], total: 0, page, totalPages: 0 });
      }
      if (studentId) {
        const hasAccess = await validateParentChild(auth.userId, studentId);
        if (!hasAccess) {
          return errorResponse('You do not have access to this student', 403);
        }
        const student = await db.student.findUnique({
          where: { id: studentId },
          select: { classId: true },
        });
        if (student?.classId) {
          where.classId = student.classId;
        }
        resolvedStudentId = studentId; // Parent sends Student.id directly
      } else {
        const children = await db.studentParent.findMany({
          where: { parentId: parentRecord.id },
          select: { student: { select: { classId: true } } },
        });
        const classIds = children
          .map(c => c.student.classId)
          .filter((id): id is string => id !== null);
        if (classIds.length > 0) {
          where.classId = { in: classIds };
        } else {
          return successResponse({ records: [], total: 0, page, totalPages: 0 });
        }
      }
    }

    // Search filter (merge with existing OR conditions)
    if (search) {
      orConditions.push(
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      );
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.dueDate = dateFilter;
    }

    const includeQuestionsSelect = includeQuestions ? {
      questions: {
        orderBy: { order: 'asc' as const },
        select: { id: true, type: true, questionText: true, options: true, correctAnswer: true, marks: true, order: true, topic: true },
      },
    } : {};

    const baseSelect: Record<string, unknown> = {
      id: true,
      schoolId: true,
      title: true,
      description: true,
      subjectId: true,
      classId: true,
      teacherId: true,
      dueDate: true,
      totalMarks: true,
      status: true,
      contentType: true,
      audioUrl: true,
      videoUrl: true,
      attachments: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      subject: {
        select: { id: true, name: true, code: true },
      },
      class: {
        select: { id: true, name: true, section: true, grade: true },
      },
      teacher: {
        select: { id: true, user: { select: { name: true } } },
      },
      _count: {
        select: { submissions: true },
      },
      ...includeQuestionsSelect,
    };

    // If studentId is provided (resolved to Student.id), filter submissions for that student
    if (resolvedStudentId && includeSubmissions) {
      const [data, total] = await Promise.all([
        db.homework.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          select: {
            ...baseSelect,
            ...includeQuestionsSelect,
            submissions: {
              where: { studentId: resolvedStudentId },
              select: {
                id: true,
                studentId: true,
                status: true,
                score: true,
                grade: true,
                teacherComment: true,
                submittedAt: true,
                gradedAt: true,
                content: true,
                answers: {
                  select: { questionId: true, answer: true, autoScore: true, manualScore: true },
                },
              },
            },
          },
        }),
        db.homework.count({ where }),
      ]);

      return successResponse({
        records: data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    }

    // Include all submissions (for teacher/admins)
    if (includeSubmissions) {
      baseSelect.submissions = {
        select: {
          id: true,
          studentId: true,
          status: true,
          score: true,
          grade: true,
          teacherComment: true,
          submittedAt: true,
          gradedAt: true,
          student: {
            select: {
              id: true,
              admissionNo: true,
              user: { select: { name: true, avatar: true } },
            },
          },
        },
      };
    }

    const [data, total] = await Promise.all([
      db.homework.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        select: baseSelect,
      }),
      db.homework.count({ where }),
    ]);

    return successResponse({
      records: data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    console.error('[GET /api/homework]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// POST /api/homework - Create homework assignment
export async function POST(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'TEACHER',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const body = await request.json();

    // Validate with Zod schema
    const validationResult = HomeworkCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const validatedData = validationResult.data;

    // School isolation
    if (auth.role !== 'SUPER_ADMIN') {
      if (validatedData.schoolId !== auth.schoolId) {
        return errorResponse('Cannot create homework for a different school', 403);
      }
    }

    // Teachers can only create homework for their assigned classes
    if (auth.role === 'TEACHER') {
      if (!auth.userId) {
        return errorResponse('User ID not found', 400);
      }
      // Resolve Teacher model ID from User ID (auth.userId = User.id, but teacherId references Teacher.id)
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (!teacher) {
        return errorResponse('Teacher profile not found', 403);
      }
      if (validatedData.classId) {
        const hasAccess = await validateTeacherClass(teacher.id, validatedData.classId);
        if (!hasAccess) {
          return errorResponse('You are not assigned to this class', 403);
        }
      }
      // Force teacherId to be the Teacher model ID, not the User ID
      validatedData.teacherId = teacher.id;
    }

    // Verify references
    if (validatedData.subjectId) {
      const subject = await db.subject.findUnique({
        where: { id: validatedData.subjectId, schoolId: validatedData.schoolId },
      });
      if (!subject) return errorResponse('Subject not found or does not belong to school', 404);
    }

    if (validatedData.classId) {
      const cls = await db.class.findUnique({
        where: { id: validatedData.classId, schoolId: validatedData.schoolId },
      });
      if (!cls) return errorResponse('Class not found or does not belong to school', 404);
    }

    if (validatedData.teacherId) {
      const teacher = await db.teacher.findUnique({
        where: { id: validatedData.teacherId, schoolId: validatedData.schoolId },
      });
      if (!teacher) return errorResponse('Teacher not found or does not belong to school', 404);
    }

    // Check plan limits - enforce max homework per month
    const school = await db.school.findUnique({
      where: { id: validatedData.schoolId },
      include: { subscriptionPlan: true },
    });
    
    if (school) {
      const maxHomeworkPerMonth = school.subscriptionPlan?.maxHomeworkPerMonth || 100;
      // If maxHomeworkPerMonth is -1, it means unlimited
      if (maxHomeworkPerMonth !== -1) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const currentMonthHomeworkCount = await db.homework.count({
          where: { 
            schoolId: validatedData.schoolId, 
            deletedAt: null,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          },
        });
        
        if (currentMonthHomeworkCount >= maxHomeworkPerMonth) {
          return errorResponse(`Your plan allows maximum ${maxHomeworkPerMonth} homework assignments per month. Please upgrade your plan to add more.`, 403);
        }
      }
    }

    // Create homework with questions in a transaction
    const homework = await db.$transaction(async (tx) => {
      const newHomework = await tx.homework.create({
        data: {
          schoolId: validatedData.schoolId,
          title: validatedData.title,
          description: validatedData.description || '',
          subjectId: validatedData.subjectId || null,
          classId: validatedData.classId || null,
          teacherId: validatedData.teacherId || null,
          dueDate: validatedData.dueDate,
          totalMarks: validatedData.totalMarks || 100,
          contentType: validatedData.contentType || 'text',
          audioUrl: validatedData.audioUrl || null,
          videoUrl: validatedData.videoUrl || null,
          attachments: validatedData.attachments
            ? JSON.stringify(validatedData.attachments)
            : null,
          status: 'active',
        },
      });

      // Create questions if provided
      if (validatedData.questions && validatedData.questions.length > 0) {
        const computedMarks = distributeMarks(validatedData.totalMarks, validatedData.questions.length);
        await tx.homeworkQuestion.createMany({
          data: validatedData.questions.map((q, i) => ({
            homeworkId: newHomework.id,
            schoolId: validatedData.schoolId,
            type: q.type || 'MCQ',
            questionText: q.questionText,
            options: q.options || null,
            correctAnswer: q.correctAnswer || null,
            marks: computedMarks[i],
            topic: q.topic || null,
            order: q.order ?? i,
            questionBankId: (q as { questionBankId?: string | null }).questionBankId ?? null,
          })),
        });
      }

      return newHomework;
    });

    // Fetch complete homework with relations
    const completeHomework = await db.homework.findUnique({
      where: { id: homework.id },
      select: {
        id: true,
        schoolId: true,
        title: true,
        description: true,
        subjectId: true,
        classId: true,
        teacherId: true,
        dueDate: true,
        totalMarks: true,
        status: true,
        contentType: true,
        audioUrl: true,
        videoUrl: true,
        attachments: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        questions: true,
      },
    });

    // Notify students in the class about new homework
    if (validatedData.classId) {
      notifyClassStudents(
        validatedData.classId,
        validatedData.schoolId,
        `New Homework: ${validatedData.title}`,
        `A new homework "${validatedData.title}" has been posted. Due: ${new Date(validatedData.dueDate).toLocaleDateString()}`,
        {
          type: 'info',
          category: 'general',
          actionUrl: `/dashboard?view=homework`,
          includeParents: true,
        }
      ).catch(() => {});
    }

    return successResponse(
      completeHomework,
      'Homework created successfully',
      201
    );
  } catch (error: unknown) {
    console.error('[POST /api/homework]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// PUT /api/homework - Update homework assignment or grade a submission
export async function PUT(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'TEACHER',
    'STUDENT',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const body = await request.json();
    const { id, action, ...updateData } = body;

    if (!id) {
      return errorResponse('Homework id is required', 400);
    }

    // Action: grade submission
    if (action === 'grade') {
      // Only teachers and admins can grade
      if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
        return errorResponse('Insufficient permissions for grading', 403);
      }

      const { submissionId, score, grade, teacherComment, status } = updateData;

      if (!submissionId) {
        return errorResponse('submissionId is required for grading', 400);
      }

      // Validate with Zod schema
      const validationResult = HomeworkGradeSchema.safeParse({
        submissionId,
        score,
        grade,
        teacherComment,
        status,
      });

      if (!validationResult.success) {
        return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
      }

      const validatedData = validationResult.data;

      // Get submission with homework
      const submission = await db.homeworkSubmission.findUnique({
        where: { id: validatedData.submissionId },
        include: { homework: true },
      });

      if (!submission) {
        return errorResponse('Submission not found', 404);
      }

      // School isolation
      if (auth.role !== 'SUPER_ADMIN' && submission.schoolId !== auth.schoolId) {
        return errorResponse('Access denied', 403);
      }

       // Teachers can only grade submissions for their classes
      if (auth.role === 'TEACHER') {
        if (!auth.userId) {
          return errorResponse('User ID not found', 400);
        }
        const resolvedTeacherId = await resolveTeacherId(auth.userId);
        const teacherIdentifier = resolvedTeacherId || auth.userId;
        const hasAccess =
          submission.homework.teacherId === teacherIdentifier ||
          (submission.homework.classId &&
            (await validateTeacherClass(teacherIdentifier, submission.homework.classId)));
        if (!hasAccess) {
          return errorResponse('You can only grade submissions for your classes', 403);
        }
      }

      const updatedSubmission = await db.homeworkSubmission.update({
        where: { id: validatedData.submissionId },
        data: {
          score: validatedData.score !== undefined ? validatedData.score : submission.score,
          grade: validatedData.grade || submission.grade,
          teacherComment:
            validatedData.teacherComment !== undefined
              ? validatedData.teacherComment
              : submission.teacherComment,
          status: validatedData.status || 'graded',
          gradedAt: new Date(),
        },
      });

      // Notify student that homework was graded
      try {
        const homeworkGraded = submission.homework;
        const studentRecord = await db.student.findUnique({
          where: { id: submission.studentId },
          select: { userId: true },
        });
        if (studentRecord) {
          const { createNotification } = await import('@/lib/notifications');
          createNotification({
            userId: studentRecord.userId,
            schoolId: submission.schoolId,
            title: `Homework Graded: ${homeworkGraded.title}`,
            message: `Your homework "${homeworkGraded.title}" has been graded. Score: ${validatedData.score ?? 'N/A'}`,
            type: 'info',
            category: 'general',
            actionUrl: `/dashboard?view=homework`,
          }).catch(() => {});
        }
      } catch {}

      return successResponse(updatedSubmission, 'Submission graded successfully');
    }

    // Action: submit homework (student)
    if (action === 'submit') {
      if (auth.role !== 'STUDENT') {
        return errorResponse('Only students can submit homework', 403);
      }

      const { studentId, content, attachments, audioUrl, answers } = updateData;

      if (!studentId) {
        return errorResponse('studentId is required for submission', 400);
      }

      // Students can only submit for themselves
      if (studentId !== auth.userId) {
        return errorResponse('Students can only submit their own homework', 403);
      }

      // Validate with Zod schema
      const validationResult = HomeworkSubmissionSchema.safeParse({
        homeworkId: id,
        studentId,
        content,
        attachments,
        answers,
      });

      if (!validationResult.success) {
        return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
      }

      const validatedData = validationResult.data;

      // Check if already submitted
      const existing = await db.homeworkSubmission.findUnique({
        where: {
          homeworkId_studentId: { homeworkId: id, studentId },
        },
      });

      if (existing) {
        return errorResponse('You have already submitted this homework', 400);
      }

      const homework = await db.homework.findUnique({
        where: { id },
      });

      if (!homework) {
        return errorResponse('Homework not found', 404);
      }

      // School isolation - students should be in the same school
      if (homework.schoolId !== auth.schoolId) {
        return errorResponse('Access denied', 403);
      }

      // Resolve Student.id from User.id (studentId param is User.id)
      const student = await db.student.findUnique({
        where: { userId: studentId },
        select: { id: true, classId: true },
      });

      if (!student || student.classId !== homework.classId) {
        return errorResponse('This homework is not assigned to your class', 403);
      }

      // Create submission with answers in a transaction
      const submission = await db.$transaction(async (tx) => {
        const newSubmission = await tx.homeworkSubmission.create({
          data: {
            homeworkId: id,
            schoolId: homework.schoolId,
            studentId: student.id, // Use Student.id, not User.id
            content: validatedData.content || null,
            attachments: validatedData.attachments
              ? JSON.stringify(validatedData.attachments)
              : null,
            audioUrl: audioUrl || null,
            status: 'submitted',
            submittedAt: new Date(),
          },
        });

        // Save question answers with auto-grading for objective types
        if (validatedData.answers && typeof validatedData.answers === 'object') {
          const hwQuestions = await tx.homeworkQuestion.findMany({
            where: { homeworkId: id },
            select: { id: true, type: true, correctAnswer: true, marks: true, options: true },
          });

          const validQuestionIds = new Set(hwQuestions.map((q) => q.id));
          const answerEntries = Object.entries(validatedData.answers).filter(([qId]) =>
            validQuestionIds.has(qId)
          );

          if (answerEntries.length > 0) {
            const qMap = new Map(hwQuestions.map(q => [q.id, q]));
            await tx.homeworkQuestionAnswer.createMany({
              data: answerEntries.map(([qId, ans]) => {
                const question = qMap.get(qId);
                let autoScore: number | null = null;
                const studentAnswer = typeof ans === 'string' ? ans : JSON.stringify(ans);

                if (question && question.correctAnswer) {
                  const qType = question.type;
                  const correct = question.correctAnswer;
                  autoScore = 0;

                  if (qType === 'MCQ') {
                    if (studentAnswer.trim().toLowerCase() === correct.trim().toLowerCase()) {
                      autoScore = question.marks;
                    }
                  } else if (qType === 'TRUE_FALSE') {
                    if (studentAnswer.trim().toLowerCase() === correct.trim().toLowerCase()) {
                      autoScore = question.marks;
                    }
                  } else if (qType === 'MULTI_SELECT') {
                    try {
                      const studentArr = JSON.parse(studentAnswer);
                      const correctArr = JSON.parse(correct);
                      if (Array.isArray(studentArr) && Array.isArray(correctArr)) {
                        const correctSet = new Set(correctArr.map((c: unknown) => String(c).trim().toLowerCase()));
                        const studentSet = new Set(studentArr.map((s: unknown) => String(s).trim().toLowerCase()));
                        const matches = [...studentSet].filter(s => correctSet.has(s)).length;
                        const totalCorrect = correctSet.size;
                        autoScore = totalCorrect > 0 ? Math.round((matches / totalCorrect) * question.marks) : 0;
                      }
                    } catch { autoScore = null; }
                  } else if (qType === 'FILL_BLANK') {
                    try {
                      const acceptableAnswers = JSON.parse(correct);
                      if (Array.isArray(acceptableAnswers)) {
                        const studentNorm = studentAnswer.trim().toLowerCase();
                        const match = acceptableAnswers.some(a => String(a).trim().toLowerCase() === studentNorm);
                        autoScore = match ? question.marks : 0;
                      }
                    } catch {
                      if (studentAnswer.trim().toLowerCase() === correct.trim().toLowerCase()) {
                        autoScore = question.marks;
                      }
                    }
                  }
                }

                return {
                  questionId: qId,
                  submissionId: newSubmission.id,
                  schoolId: homework.schoolId,
                  answer: studentAnswer,
                  autoScore: autoScore,
                };
              }),
            });
          }
        }

        return newSubmission;
      });

      return successResponse(submission, 'Homework submitted successfully', 201);
    }

    // Action: update homework details
    if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return errorResponse('Insufficient permissions for updating homework', 403);
    }

    // Validate with Zod schema
    const validationResult = HomeworkUpdateSchema.safeParse(updateData);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const validatedData = validationResult.data;

    const homework = await db.homework.findUnique({ where: { id } });
    if (!homework) {
      return errorResponse('Homework not found', 404);
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && homework.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    // Teachers can only update their own homework
    if (auth.role === 'TEACHER') {
      if (!auth.userId) {
        return errorResponse('User ID not found', 400);
      }
      const resolvedTeacherId = await resolveTeacherId(auth.userId);
      const teacherIdentifier = resolvedTeacherId || auth.userId;
      if (homework.teacherId !== teacherIdentifier) {
        return errorResponse('You can only update your own homework', 403);
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (validatedData.title !== undefined) updatePayload.title = validatedData.title;
    if (validatedData.description !== undefined)
      updatePayload.description = validatedData.description;
    if (validatedData.dueDate !== undefined) updatePayload.dueDate = validatedData.dueDate;
    if (validatedData.totalMarks !== undefined)
      updatePayload.totalMarks = validatedData.totalMarks;
    if (validatedData.status !== undefined) updatePayload.status = validatedData.status;
    if (validatedData.subjectId !== undefined)
      updatePayload.subjectId = validatedData.subjectId;
    if (validatedData.classId !== undefined)
      updatePayload.classId = validatedData.classId;

    const updatedHomework = await db.homework.update({
      where: { id },
      data: updatePayload,
    });

    return successResponse(updatedHomework, 'Homework updated successfully');
  } catch (error: unknown) {
    console.error('[PUT /api/homework]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// DELETE /api/homework - Soft-delete a homework assignment
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'TEACHER',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Homework id is required', 400);
    }

    const homework = await db.homework.findUnique({ where: { id } });
    if (!homework) {
      return errorResponse('Homework not found', 404);
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && homework.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    // Teachers can only delete their own homework
    if (auth.role === 'TEACHER') {
      if (!auth.userId) {
        return errorResponse('User ID not found', 400);
      }
      const resolvedTeacherId = await resolveTeacherId(auth.userId);
      const teacherIdentifier = resolvedTeacherId || auth.userId;
      if (homework.teacherId !== teacherIdentifier) {
        return errorResponse('You can only delete your own homework', 403);
      }
    }

    await db.homework.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return successResponse(null, 'Homework deleted successfully');
  } catch (error: unknown) {
    console.error('[DELETE /api/homework]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}
