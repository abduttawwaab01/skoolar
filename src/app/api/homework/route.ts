import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuthAndRole,
  errorResponse,
  successResponse,
  validateTeacherClass,
  validateTeacherStudent,
  validateParentChild,
} from '@/lib/api-helpers';
import {
  HomeworkCreateSchema,
  HomeworkSubmissionSchema,
  HomeworkGradeSchema,
  HomeworkUpdateSchema,
} from '@/lib/validators';

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
    const classId = searchParams.get('classId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const status = searchParams.get('status') || '';
    const teacherId = searchParams.get('teacherId') || '';
    const studentId = searchParams.get('studentId') || '';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const includeSubmissions = searchParams.get('includeSubmissions') === 'true';

    // School isolation - enforce based on role
    const where: Record<string, unknown> = { deletedAt: null };

    if (auth.role === 'SUPER_ADMIN') {
      // Super admin can filter by any schoolId if provided
      const schoolId = searchParams.get('schoolId') || '';
      if (schoolId) where.schoolId = schoolId;
    } else {
      // All other roles are restricted to their school
      if (!auth.schoolId) {
        return errorResponse('School ID not found in session', 400);
      }
      where.schoolId = auth.schoolId;
    }

    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (status) where.status = status;

    // Role-based teacher filter
    if (auth.role === 'TEACHER') {
      if (teacherId && teacherId !== auth.userId) {
        return errorResponse('Teachers can only view their own assignments', 403);
      }
      where.teacherId = auth.userId;
    } else if (teacherId) {
      where.teacherId = teacherId;
    }

    // Role-based student filter
    if (auth.role === 'STUDENT') {
      if (studentId && studentId !== auth.userId) {
        return errorResponse('Students can only view their own submissions', 403);
      }
      // Students can only see homework for their class
      const student = await db.student.findUnique({
        where: { id: auth.userId, schoolId: auth.schoolId },
        select: { classId: true },
      });
      if (student?.classId) {
        where.classId = student.classId;
      }
      } else if (auth.role === 'PARENT') {
        // Parents can only see homework for their children
        if (studentId) {
          if (!auth.userId) {
            return errorResponse('User ID not found', 400);
          }
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
      } else {
        // Get all children's class IDs
        const children = await db.studentParent.findMany({
          where: { parentId: auth.userId },
          select: { student: { select: { classId: true } } },
        });
        const classIds = children
          .map(c => c.student.classId)
          .filter((id): id is string => id !== null);
        if (classIds.length > 0) {
          where.classId = { in: classIds };
        } else {
          return successResponse({ data: [], total: 0, page, totalPages: 0 });
        }
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.dueDate = dateFilter;
    }

    const select: Record<string, unknown> = {
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
    };

    if (includeSubmissions) {
      select.submissions = {
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

    // If studentId is provided, also filter submissions for that student
    if (studentId && includeSubmissions) {
      const [data, total] = await Promise.all([
        db.homework.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          select: {
            ...select,
            submissions: {
              where: { studentId },
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
              },
            },
          },
        }),
        db.homework.count({ where }),
      ]);

      return successResponse({
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    }

    const [data, total] = await Promise.all([
      db.homework.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        select,
      }),
      db.homework.count({ where }),
    ]);

    return successResponse({
      data,
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
      if (validatedData.classId) {
        const hasAccess = await validateTeacherClass(auth.userId, validatedData.classId);
        if (!hasAccess) {
          return errorResponse('You are not assigned to this class', 403);
        }
      }
      // Force teacherId to be the authenticated teacher
      validatedData.teacherId = auth.userId;
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
        await tx.homeworkQuestion.createMany({
          data: validatedData.questions.map((q, i) => ({
            homeworkId: newHomework.id,
            schoolId: validatedData.schoolId,
            type: q.type || 'MCQ',
            questionText: q.questionText,
            options: q.options || null,
            correctAnswer: q.correctAnswer || null,
            marks: q.marks || 1,
            order: q.order ?? i,
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
        const hasAccess =
          submission.homework.teacherId === auth.userId ||
          (submission.homework.classId &&
            (await validateTeacherClass(auth.userId, submission.homework.classId)));
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

      // Check if student is in the class this homework is assigned to
      const student = await db.student.findUnique({
        where: { id: studentId },
        select: { classId: true },
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
            studentId,
            content: validatedData.content || null,
            attachments: validatedData.attachments
              ? JSON.stringify(validatedData.attachments)
              : null,
            audioUrl: audioUrl || null,
            status: 'submitted',
            submittedAt: new Date(),
          },
        });

        // Save question answers if provided
        if (validatedData.answers && typeof validatedData.answers === 'object') {
          // Fetch valid question IDs for this homework
          const hwQuestions = await tx.homeworkQuestion.findMany({
            where: { homeworkId: id },
            select: { id: true },
          });

          const validQuestionIds = new Set(hwQuestions.map((q) => q.id));
          const answerEntries = Object.entries(validatedData.answers).filter(([qId]) =>
            validQuestionIds.has(qId)
          );

          if (answerEntries.length > 0) {
            await tx.homeworkQuestionAnswer.createMany({
              data: answerEntries.map(([qId, ans]) => ({
                questionId: qId,
                submissionId: newSubmission.id,
                schoolId: homework.schoolId,
                answer: typeof ans === 'string' ? ans : JSON.stringify(ans),
              })),
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
      if (homework.teacherId !== auth.userId) {
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
