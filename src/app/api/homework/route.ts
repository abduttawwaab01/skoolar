import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/homework - List homework assignments with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const schoolId = searchParams.get('schoolId') || '';
    const classId = searchParams.get('classId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const status = searchParams.get('status') || '';
    const teacherId = searchParams.get('teacherId') || '';
    const studentId = searchParams.get('studentId') || '';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const includeSubmissions = searchParams.get('includeSubmissions') === 'true';

    const where: Record<string, unknown> = { deletedAt: null };

    if (schoolId) where.schoolId = schoolId;
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (teacherId) where.teacherId = teacherId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
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
    if (studentId) {
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

      return NextResponse.json({
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

// POST /api/homework - Create homework assignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      schoolId,
      title,
      description,
      subjectId,
      classId,
      teacherId,
      dueDate,
      totalMarks,
      attachments,
      contentType,
      audioUrl,
      videoUrl,
      createdBy,
      questions,
    } = body;

    if (!schoolId || !title || !dueDate) {
      return NextResponse.json(
        { error: 'schoolId, title, and dueDate are required' },
        { status: 400 }
      );
    }

    // Validate references if provided
    if (subjectId) {
      const subject = await db.subject.findUnique({ where: { id: subjectId } });
      if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }
    if (classId) {
      const cls = await db.class.findUnique({ where: { id: classId } });
      if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (teacherId) {
      const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    const homework = await db.homework.create({
      data: {
        schoolId,
        title,
        description: description || '',
        subjectId: subjectId || null,
        classId: classId || null,
        teacherId: teacherId || null,
        dueDate: new Date(dueDate),
        totalMarks: totalMarks || 100,
        attachments: attachments || null,
        createdBy: createdBy || null,
        status: 'active',
      },
    });

    // Update with new fields using raw query (contentType, audioUrl, videoUrl)
    if (contentType || audioUrl || videoUrl) {
      await db.$executeRawUnsafe(
        `UPDATE "Homework" SET "contentType" = $1, "audioUrl" = $2, "videoUrl" = $3 WHERE id = $4`,
        contentType || 'text',
        audioUrl || null,
        videoUrl || null,
        homework.id,
      );
    }

    // Create questions if provided
    if (questions && questions.length > 0) {
      await Promise.all(
        questions.map((q: { type?: string; questionText: string; options?: string; correctAnswer?: string; marks?: number; order?: number }, i: number) =>
          db.$executeRawUnsafe(
            `INSERT INTO "HomeworkQuestion" (id, "homeworkId", "schoolId", type, "questionText", options, "correctAnswer", marks, "order") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            `hq_${Date.now()}_${i}`,
            homework.id,
            schoolId,
            q.type || 'MCQ',
            q.questionText,
            q.options || null,
            q.correctAnswer || null,
            q.marks || 1,
            q.order ?? i,
          ),
        ),
      );
    }

    return NextResponse.json(
      { data: homework, message: 'Homework created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/homework - Update homework assignment or grade a submission
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Homework id is required' }, { status: 400 });
    }

    // Action: grade submission
    if (action === 'grade') {
      const { submissionId, score, grade, teacherComment, status } = updateData;

      if (!submissionId) {
        return NextResponse.json({ error: 'submissionId is required for grading' }, { status: 400 });
      }

      const submission = await db.homeworkSubmission.findUnique({
        where: { id: submissionId },
      });

      if (!submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }

      const updatedSubmission = await db.homeworkSubmission.update({
        where: { id: submissionId },
        data: {
          score: score !== undefined ? score : submission.score,
          grade: grade || submission.grade,
          teacherComment: teacherComment !== undefined ? teacherComment : submission.teacherComment,
          status: status || 'graded',
          gradedAt: new Date(),
        },
      });

      // Audit log for grading
      await db.auditLog.create({
        data: {
          schoolId: submission.schoolId,
          userId: submission.studentId, // Note: the student is the entity owner, but the action is by current user
          action: 'GRADE',
          entity: 'HOMEWORK_SUBMISSION',
          entityId: submissionId,
          details: `Homework graded: ${grade || 'N/A'} (Score: ${score})`,
        }
      }).catch(err => console.error('Failed to create audit log:', err));

      return NextResponse.json({
        data: updatedSubmission,
        message: 'Submission graded successfully',
      });
    }

    // Action: submit homework (student)
    if (action === 'submit') {
      const { studentId, content, attachments, audioUrl, answers } = updateData;

      if (!studentId) {
        return NextResponse.json({ error: 'studentId is required for submission' }, { status: 400 });
      }

      // Check if already submitted
      const existing = await db.homeworkSubmission.findUnique({
        where: {
          homeworkId_studentId: { homeworkId: id, studentId },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'You have already submitted this homework' },
          { status: 400 }
        );
      }

      const homework = await db.homework.findUnique({ where: { id } });
      if (!homework) {
        return NextResponse.json({ error: 'Homework not found' }, { status: 404 });
      }

      const submission = await db.homeworkSubmission.create({
        data: {
          homeworkId: id,
          schoolId: homework.schoolId,
          studentId,
          content: content || null,
          attachments: attachments || null,
          status: 'submitted',
          submittedAt: new Date(),
        },
      });

      // Update with audioUrl using raw query
      if (audioUrl) {
        await db.$executeRawUnsafe(
          `UPDATE "HomeworkSubmission" SET "audioUrl" = $1 WHERE id = $2`,
          audioUrl,
          submission.id,
        );
      }

      // Save question answers if provided
      if (answers && typeof answers === 'object') {
        // Fetch valid question IDs for this homework
        const hwQuestions = await db.$queryRawUnsafe(
          `SELECT id FROM "HomeworkQuestion" WHERE "homeworkId" = $1`,
          id,
        ) as { id: string }[];
        
        const validQuestionIds = new Set(hwQuestions.map(q => q.id));
        const answerEntries = Object.entries(answers).filter(([qId]) => validQuestionIds.has(qId));
        
        // ── BATCH INSERT ANSWERS (was M separate queries) ──
        if (answerEntries.length > 0) {
          const now = Date.now();
          const valuesClause = answerEntries.map((_, idx) => 
            `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`
          ).join(', ');
          
          // Flatten parameters in order: id, questionId, submissionId, schoolId, answer
          const params = answerEntries.flatMap(([qId, ans], idx) => [
            `hqa_${now}_${idx}`,
            qId,
            submission.id,
            homework.schoolId,
            typeof ans === 'string' ? ans : JSON.stringify(ans),
          ]);

          await db.$executeRawUnsafe(
            `INSERT INTO "HomeworkQuestionAnswer" (id, "questionId", "submissionId", "schoolId", answer) VALUES ${valuesClause} ON CONFLICT ("questionId", "submissionId") DO UPDATE SET answer = EXCLUDED.answer`,
            ...params
          );
        }
      }

      // Audit log for submission
      await db.auditLog.create({
        data: {
          schoolId: homework.schoolId,
          userId: studentId,
          action: 'SUBMIT',
          entity: 'HOMEWORK_SUBMISSION',
          entityId: submission.id,
          details: `Submitted homework for subject: ${homework.subjectId || 'N/A'}`,
        }
      }).catch(err => console.error('Failed to create audit log:', err));

      return NextResponse.json({
        data: submission,
        message: 'Homework submitted successfully',
      }, { status: 201 });
    }

    // Action: update homework details
    const { title, description, dueDate, totalMarks, status, subjectId, classId } = updateData;

    const homework = await db.homework.findUnique({ where: { id } });
    if (!homework) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 });
    }

    const updatedHomework = await db.homework.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(totalMarks !== undefined && { totalMarks }),
        ...(status !== undefined && { status }),
        ...(subjectId !== undefined && { subjectId: subjectId || null }),
        ...(classId !== undefined && { classId: classId || null }),
      },
    });

    return NextResponse.json({
      data: updatedHomework,
      message: 'Homework updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
