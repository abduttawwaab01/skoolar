import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';
import { z } from 'zod';

const UpdateClassSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  section: z.string().max(10).nullable().optional(),
  grade: z.string().max(20).nullable().optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  classTeacherId: z.string().cuid().nullable().optional(),
});

// GET /api/classes/[id] - Get single class
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'TEACHER',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const where = {
      id,
      deletedAt: null,
    } as Parameters<typeof db.class.findUnique>[0]['where'];

    // School isolation
    if (auth.role !== 'SUPER_ADMIN') {
      if (!auth.schoolId) {
        return errorResponse('School ID not found in session', 400);
      }
      where.schoolId = auth.schoolId;
    }

    const cls = await db.class.findUnique({
      where,
      select: {
        id: true,
        name: true,
        section: true,
        grade: true,
        capacity: true,
        classTeacherId: true,
        schoolId: true,
        classTeacher: {
          select: {
            id: true,
            employeeNo: true,
            user: { select: { name: true, email: true } },
          },
        },
        _count: {
          select: {
            students: true,
            subjects: true,
            exams: true,
          },
        },
      },
    });

    if (!cls) {
      return errorResponse('Class not found', 404);
    }

    // Teachers can only view classes they teach
    if (auth.role === 'TEACHER') {
      const isClassTeacher = cls.classTeacherId === auth.userId;
      const teachesSubject = await db.classSubject.findFirst({
        where: { classId: id, teacherId: auth.userId },
      });
      if (!isClassTeacher && !teachesSubject) {
        return errorResponse('You do not have access to this class', 403);
      }
    }

    return successResponse(cls);
  } catch (error: unknown) {
    console.error('[GET /api/classes/[id]]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// PUT /api/classes/[id] - Update class
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const body = await request.json();

    // Validate with Zod schema
    const validationResult = UpdateClassSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const validatedData = validationResult.data;

    // Get existing class
    const existingClass = await db.class.findUnique({
      where: { id },
    });

    if (!existingClass) {
      return errorResponse('Class not found', 404);
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && existingClass.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    // Validate classTeacherId if provided
    if (validatedData.classTeacherId !== undefined) {
      if (validatedData.classTeacherId === null) {
        // Removing class teacher - allowed
      } else {
        const teacher = await db.teacher.findUnique({
          where: { id: validatedData.classTeacherId },
        });
        if (!teacher) {
          return errorResponse('Teacher not found', 404);
        }
        if (teacher.schoolId !== existingClass.schoolId) {
          return errorResponse('Teacher does not belong to this school', 400);
        }
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    if (validatedData.name !== undefined) updatePayload.name = validatedData.name;
    if (validatedData.section !== undefined) updatePayload.section = validatedData.section;
    if (validatedData.grade !== undefined) updatePayload.grade = validatedData.grade;
    if (validatedData.capacity !== undefined) updatePayload.capacity = validatedData.capacity;
    if (validatedData.classTeacherId !== undefined) {
      updatePayload.classTeacherId = validatedData.classTeacherId;
    }

    const updatedClass = await db.class.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        name: true,
        section: true,
        grade: true,
        capacity: true,
        classTeacherId: true,
        schoolId: true,
        classTeacher: {
          select: {
            id: true,
            employeeNo: true,
            user: { select: { name: true, email: true } },
          },
        },
        _count: {
          select: {
            students: true,
            subjects: true,
            exams: true,
          },
        },
      },
    });

    return successResponse(updatedClass, 'Class updated successfully');
  } catch (error: unknown) {
    console.error('[PUT /api/classes/[id]]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// DELETE /api/classes/[id] - Soft delete class
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const existingClass = await db.class.findUnique({
      where: { id },
    });

    if (!existingClass) {
      return errorResponse('Class not found', 404);
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && existingClass.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    // Soft delete
    await db.class.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return successResponse(null, 'Class deleted successfully');
  } catch (error: unknown) {
    console.error('[DELETE /api/classes/[id]]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}
