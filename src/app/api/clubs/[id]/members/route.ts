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
    const club = await db.club.findUnique({ where: { id } });
    if (!club) return errorResponse('Club not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && club.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    const members = await db.clubMembership.findMany({
      where: { clubId: id, isActive: true },
      orderBy: { joinedDate: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            photo: true,
            user: { select: { name: true, email: true, avatar: true } },
          },
        },
      },
    });

    return successResponse(members);
  } catch (error: unknown) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN', 'SCHOOL_ADMIN',
  ]);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const body = await request.json();
    const { studentId, role } = body;

    if (!studentId) {
      return errorResponse('studentId is required', 400);
    }

    const club = await db.club.findUnique({ where: { id } });
    if (!club) return errorResponse('Club not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && club.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) return errorResponse('Student not found', 404);
    if (student.schoolId !== club.schoolId) {
      return errorResponse('Student does not belong to this school', 400);
    }

    const existing = await db.clubMembership.findUnique({
      where: { clubId_studentId: { clubId: id, studentId } },
    });
    if (existing) {
      if (existing.isActive) {
        return errorResponse('Student is already a member of this club', 409);
      }
      await db.clubMembership.update({
        where: { id: existing.id },
        data: { isActive: true, role: role || 'member' },
      });
      return successResponse(null, 'Membership reactivated');
    }

    const membership = await db.clubMembership.create({
      data: {
        clubId: id,
        studentId,
        role: role || 'member',
      },
    });

    return successResponse(membership, 'Member added successfully', 201);
  } catch (error: unknown) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN', 'SCHOOL_ADMIN',
  ]);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) return errorResponse('studentId query param is required', 400);

    const club = await db.club.findUnique({ where: { id } });
    if (!club) return errorResponse('Club not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && club.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    const membership = await db.clubMembership.findUnique({
      where: { clubId_studentId: { clubId: id, studentId } },
    });
    if (!membership) return errorResponse('Membership not found', 404);

    await db.clubMembership.update({
      where: { id: membership.id },
      data: { isActive: false },
    });

    return successResponse(null, 'Member removed successfully');
  } catch (error: unknown) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
