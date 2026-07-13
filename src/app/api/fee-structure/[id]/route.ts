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
        // Get old class assignments for diff
        const oldAssignments = await tx.feeStructureClass.findMany({
          where: { feeStructureId: id },
          select: { classId: true },
        });
        const oldClassIds = oldAssignments.map(a => a.classId);

        // Replace class assignments
        await tx.feeStructureClass.deleteMany({
          where: { feeStructureId: id },
        });

        if (validatedData.classIds.length > 0) {
          const classes = await tx.class.findMany({
            where: {
              id: { in: validatedData.classIds },
              schoolId: existing.schoolId,
            },
            include: { students: { select: { id: true } } },
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

          // Sync payments: create for newly added students, remove for removed students
          const newClassIds = validatedData.classIds;
          const addedClassIds = newClassIds.filter(cid => !oldClassIds.includes(cid));
          const removedClassIds = oldClassIds.filter(cid => !newClassIds.includes(cid));

          // Create payments for students in newly added classes
          if (addedClassIds.length > 0) {
            const addedClasses = classes.filter(c => addedClassIds.includes(c.id));
            const newStudentIds = [...new Set(addedClasses.flatMap(c => c.students.map(s => s.id)))];

            if (newStudentIds.length > 0) {
              // Get existing payment student IDs to avoid duplicates
              const existingPayments = await tx.payment.findMany({
                where: { feeStructureId: id, deletedAt: null },
                select: { studentId: true },
              });
              const existingStudentIds = new Set(existingPayments.map(p => p.studentId));
              const studentsNeedingPayment = newStudentIds.filter(sid => !existingStudentIds.has(sid));

              if (studentsNeedingPayment.length > 0) {
                await tx.payment.createMany({
                  data: studentsNeedingPayment.map((studentId) => ({
                    schoolId: existing.schoolId,
                    studentId,
                    feeStructureId: id,
                    amount: validatedData.amount ?? updatedFee.amount,
                    method: 'pending',
                    status: 'pending',
                    dueDate: validatedData.dueDate ?? updatedFee.dueDate,
                  })),
                  skipDuplicates: true,
                });
              }
            }
          }

          // Soft-delete payments for students no longer in assigned classes
          if (removedClassIds.length > 0) {
            const removedClasses = await tx.class.findMany({
              where: { id: { in: removedClassIds } },
              include: { students: { select: { id: true } } },
            });
            const removedStudentIds = removedClasses.flatMap(c => c.students.map(s => s.id));

            if (removedStudentIds.length > 0) {
              await tx.payment.updateMany({
                where: {
                  feeStructureId: id,
                  studentId: { in: removedStudentIds },
                  status: 'pending',
                  deletedAt: null,
                },
                data: { deletedAt: new Date() },
              });
            }
          }
        } else {
          // All classes removed: soft-delete all pending payments for this fee
          await tx.payment.updateMany({
            where: {
              feeStructureId: id,
              status: 'pending',
              deletedAt: null,
            },
            data: { deletedAt: new Date() },
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

// POST /api/fee-structure/[id] - Reconcile missing payments for students enrolled after fee creation
export async function POST(
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

    const feeStructure = await db.feeStructure.findUnique({
      where: { id },
      include: {
        feeStructureClasses: { select: { classId: true } },
      },
    });

    if (!feeStructure || feeStructure.deletedAt) {
      return errorResponse('Fee structure not found', 404);
    }

    if (auth.role !== 'SUPER_ADMIN' && feeStructure.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    const assignedClassIds = feeStructure.feeStructureClasses.map(fsc => fsc.classId);
    if (assignedClassIds.length === 0) {
      return successResponse({ created: 0, message: 'No classes assigned to this fee structure' });
    }

    // Find all students in assigned classes
    const students = await db.student.findMany({
      where: {
        classId: { in: assignedClassIds },
        schoolId: feeStructure.schoolId,
      },
      select: { id: true },
    });

    const allStudentIds = students.map(s => s.id);

    // Find students who already have a payment record for this fee
    const existingPayments = await db.payment.findMany({
      where: {
        feeStructureId: id,
        deletedAt: null,
      },
      select: { studentId: true },
    });
    const paidStudentIds = new Set(existingPayments.map(p => p.studentId));

    // Create payments for students missing them
    const missingStudentIds = allStudentIds.filter(sid => !paidStudentIds.has(sid));

    if (missingStudentIds.length > 0) {
      await db.payment.createMany({
        data: missingStudentIds.map((studentId) => ({
          schoolId: feeStructure.schoolId,
          studentId,
          feeStructureId: id,
          amount: feeStructure.amount,
          method: 'pending',
          status: 'pending',
          dueDate: feeStructure.dueDate,
        })),
        skipDuplicates: true,
      });
    }

    return successResponse({
      created: missingStudentIds.length,
      totalStudents: allStudentIds.length,
      alreadyHadPayment: paidStudentIds.size,
      message: `Created ${missingStudentIds.length} missing payment records`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}
