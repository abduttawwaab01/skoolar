import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

// GET /api/teacher-tasks - Get teacher tasks
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const status = searchParams.get('status');
    const taskType = searchParams.get('taskType');
    const schoolId = auth.role === 'SUPER_ADMIN' && searchParams.get('schoolId')
      ? searchParams.get('schoolId')
      : (auth.schoolId || '');

    let where: Record<string, unknown> = { schoolId };

    // Teachers can only see their own tasks
    if (auth.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      
      if (teacher) {
        where.teacherId = teacher.id;
      }
    } else if (teacherId) {
      where.teacherId = teacherId;
    }

    if (status) {
      where.status = status;
    }

    if (taskType) {
      where.taskType = taskType;
    }

    const tasks = await db.teacherTask.findMany({
      where,
      include: {
        teacher: {
          include: { user: { select: { name: true, avatar: true } } },
        },
        completions: {
          include: { teacher: { select: { id: true } } },
        },
        attachments: true,
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return successResponse(tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      taskType: t.taskType,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      createdBy: t.createdBy,
      createdAt: t.createdAt,
      teacher: {
        id: t.teacher.id,
        name: t.teacher.user.name,
        avatar: t.teacher.user.avatar,
      },
      attachments: t.attachments,
      completion: t.completions[0] || null,
    })));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// POST /api/teacher-tasks - Create task (Admin only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const body = await request.json();
    const { teacherId, title, description, taskType, dueDate, priority, attachmentUrls } = body;

    if (!teacherId || !title || !taskType) {
      return errorResponse('teacherId, title, and taskType are required', 400);
    }

    const schoolId = auth.schoolId;

    // Verify teacher exists and belongs to this school
    const teacher = await db.teacher.findFirst({
      where: { id: teacherId, schoolId },
    });

    if (!teacher) {
      return errorResponse('Teacher not found or does not belong to this school', 404);
    }

    // Validate task type
    const validTypes = ['reading', 'lesson_plan', 'report', 'meeting', 'class_management', 'other'];
    if (!validTypes.includes(taskType)) {
      return errorResponse(`Invalid task type. Valid types: ${validTypes.join(', ')}`, 400);
    }

    // Create task with attachments
    const task = await db.teacherTask.create({
      data: {
        schoolId: schoolId as string,
        teacherId,
        title,
        description,
        taskType,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'medium',
        createdBy: auth.userId || '',
      },
    });

    // Add attachments if provided
    if (attachmentUrls && Array.isArray(attachmentUrls)) {
      for (const att of attachmentUrls) {
        await db.teacherTaskAttachment.create({
          data: {
            taskId: task.id,
            name: att.name || 'Attachment',
            url: att.url,
            type: att.type || 'document',
          },
        });
      }
    }

    // If task type is reading, add reading assignment
    if (taskType === 'reading' && body.bookId) {
      await db.teacherReadingAssignment.create({
        data: {
          taskId: task.id,
          bookId: body.bookId,
          content: body.readingContent,
          pageRange: body.pageRange,
          notes: body.readingNotes,
        },
      });
    }

    return successResponse(task, 'Task created successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// PUT /api/teacher-tasks - Update task
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (!authResult.valid) return authResult.error;

    const body = await request.json();
    const { id, status, title, description, dueDate, priority } = body;

    if (!id) {
      return errorResponse('Task ID is required', 400);
    }

    const existing = await db.teacherTask.findUnique({
      where: { id },
    });

    if (!existing) {
      return errorResponse('Task not found', 404);
    }

    if (authResult.auth.role !== 'SUPER_ADMIN' && existing.schoolId !== authResult.auth.schoolId) {
      return errorResponse('Forbidden', 403);
    }

    const task = await db.teacherTask.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(priority && { priority }),
      },
    });

    return successResponse(task, 'Task updated successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// DELETE /api/teacher-tasks - Delete task
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (!authResult.valid) return authResult.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Task ID is required', 400);
    }

    const existing = await db.teacherTask.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!existing) {
      return errorResponse('Task not found', 404);
    }

    if (authResult.auth.role !== 'SUPER_ADMIN' && existing.schoolId !== authResult.auth.schoolId) {
      return errorResponse('Forbidden', 403);
    }

    await db.teacherTask.delete({
      where: { id },
    });

    return successResponse(null, 'Task deleted successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}