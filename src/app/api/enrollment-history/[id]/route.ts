import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER',
  ]);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const where: Record<string, unknown> = { id };
    if (auth.role !== 'SUPER_ADMIN') {
      if (!auth.schoolId) return errorResponse('School ID not found', 400);
      where.schoolId = auth.schoolId;
    }

    const record = await db.enrollmentHistory.findUnique({
      where,
      include: {
        fromClass: { select: { id: true, name: true, grade: true } },
        toClass: { select: { id: true, name: true, grade: true } },
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!record) return errorResponse('Enrollment record not found', 404);

    return successResponse(record);
  } catch (error: unknown) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
