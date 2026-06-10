import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';
import { z } from 'zod';

const UpdateClubSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  mission: z.string().nullable().optional(),
  patronName: z.string().nullable().optional(),
  patronId: z.string().nullable().optional(),
  meetingDay: z.string().optional(),
  meetingTime: z.string().optional(),
  meetingVenue: z.string().nullable().optional(),
  membershipFee: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  logo: z.string().nullable().optional(),
  socialLink: z.string().nullable().optional(),
});

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
    const where: Record<string, unknown> = { id, deletedAt: null };
    if (auth.role !== 'SUPER_ADMIN') {
      if (!auth.schoolId) return errorResponse('School ID not found', 400);
      where.schoolId = auth.schoolId;
    }

    const club = await db.club.findUnique({
      where,
      include: {
        _count: {
          select: {
            members: { where: { isActive: true } },
            events: true,
          },
        },
      },
    });

    if (!club) return errorResponse('Club not found', 404);

    return successResponse({
      ...club,
      memberCount: club._count.members,
      eventCount: club._count.events,
    });
  } catch (error: unknown) {
    console.error('[GET /api/clubs/[id]]', error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}

export async function PUT(
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
    const validationResult = UpdateClubSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const existingClub = await db.club.findUnique({ where: { id } });
    if (!existingClub) return errorResponse('Club not found', 404);

    if (auth.role !== 'SUPER_ADMIN' && existingClub.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    const updatePayload: Record<string, unknown> = {};
    const fields = ['name', 'description', 'mission', 'patronName', 'patronId', 'meetingDay', 'meetingTime', 'meetingVenue', 'membershipFee', 'isActive', 'logo', 'socialLink'] as const;
    for (const field of fields) {
      if (body[field] !== undefined) updatePayload[field] = body[field];
    }

    const updated = await db.club.update({
      where: { id },
      data: updatePayload,
    });

    return successResponse(updated, 'Club updated successfully');
  } catch (error: unknown) {
    console.error('[PUT /api/clubs/[id]]', error);
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
    const existingClub = await db.club.findUnique({ where: { id } });
    if (!existingClub) return errorResponse('Club not found', 404);

    if (auth.role !== 'SUPER_ADMIN' && existingClub.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    await db.club.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return successResponse(null, 'Club deleted successfully');
  } catch (error: unknown) {
    console.error('[DELETE /api/clubs/[id]]', error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
