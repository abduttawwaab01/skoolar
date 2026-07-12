import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuthAndRole,
  errorResponse,
  successResponse,
} from '@/lib/api-helpers';
import { z } from 'zod';

const FeeStructureUpdateSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  amount: z.number().positive('Amount must be greater than 0').max(999999).optional(),
  frequency: z.enum(['monthly', 'termly', 'annual', 'yearly']).optional(),
  isOptional: z.boolean().optional(),
  isLatePayment: z.boolean().optional(),
  lateFeeAmount: z.number().nonnegative().optional(),
  lateFeeAfter: z.number().int().min(1).optional(),
  academicYear: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  classIds: z.array(z.string().cuid()).optional(),
});

// GET /api/fee-structure/[id] - Get single fee structure
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'ACCOUNTANT',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { id } = await params;

    const feeStructure = await db.feeStructure.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true } },
        feeStructureClasses: {
          select: {
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!feeStructure || feeStructure.deletedAt) {
      return errorResponse('Fee structure not found', 404);
    }

    if (auth.role !== 'SUPER_ADMIN' && feeStructure.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    return successResponse(feeStructure);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// PUT /api/fee-structure/[id] - Update fee structure
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.feeStructure.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return errorResponse('Fee structure not found', 404);
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    const validationResult = FeeStructureUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const validatedData = validationResult.data;

    const updated = await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};

      if (validatedData.name !== undefined) updateData.name = validatedData.name;
      if (validatedData.amount !== undefined) updateData.amount = validatedData.amount;
      if (validatedData.frequency !== undefined) updateData.frequency = validatedData.frequency;
      if (validatedData.isOptional !== undefined) updateData.isOptional = validatedData.isOptional;
      if (validatedData.isLatePayment !== undefined) updateData.isLatePayment = validatedData.isLatePayment;
      if (validatedData.lateFeeAmount !== undefined) updateData.lateFeeAmount = validatedData.lateFeeAmount;
      if (validatedData.lateFeeAfter !== undefined) updateData.lateFeeAfter = validatedData.lateFeeAfter;
      if (validatedData.academicYear !== undefined) updateData.academicYear = validatedData.academicYear;
      if (validatedData.dueDate !== undefined) updateData.dueDate = validatedData.dueDate;

      const updatedFee = await tx.feeStructure.update({
        where: { id },
        data: updateData,
      });

      if (validatedData.classIds !== undefined) {
        await tx.feeStructureClass.deleteMany({
          where: { feeStructureId: id },
        });

        if (validatedData.classIds.length > 0) {
          const classes = await tx.class.findMany({
            where: {
              id: { in: validatedData.classIds },
              schoolId: existing.schoolId,
            },
          });

          if (classes.length !== validatedData.classIds.length) {
            throw new Error('Some classes not found or do not belong to the school');
          }

          await tx.feeStructureClass.createMany({
            data: validatedData.classIds.map((classId) => ({
              feeStructureId: id,
              classId,
            })),
          });
        }
      }

      return updatedFee;
    });

    const complete = await db.feeStructure.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true } },
        feeStructureClasses: {
          select: {
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    return successResponse(complete, 'Fee structure updated successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// DELETE /api/fee-structure/[id] - Soft delete fee structure
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { id } = await params;

    const existing = await db.feeStructure.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return errorResponse('Fee structure not found', 404);
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    await db.feeStructure.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return successResponse(null, 'Fee structure deleted successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}
