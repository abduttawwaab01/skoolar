import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuthAndRole,
  errorResponse,
  successResponse,
  validateSchoolAccess,
} from '@/lib/api-helpers';
import { FeeStructureCreateSchema } from '@/lib/validators';

// GET /api/fee-structure - List fee structures
export async function GET(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'ACCOUNTANT',
    'PARENT',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const frequency = searchParams.get('frequency') || '';
    const search = searchParams.get('search') || '';
    const querySchoolId = searchParams.get('schoolId') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return errorResponse('School context required', 403);
    }

    // School isolation
    const where: Record<string, unknown> = { deletedAt: null };

    if (targetSchoolId) where.schoolId = targetSchoolId;

    // For PARENT: only show fee structures linked to their children's classes
    if (auth.role === 'PARENT') {
      const parentRecord = await db.parent.findUnique({
        where: { userId: auth.userId },
        include: {
          parentStudents: {
            select: {
              student: { select: { classId: true } },
            },
          },
        },
      });
      const childClassIds = parentRecord?.parentStudents
        .map(ps => ps.student.classId)
        .filter(Boolean) as string[] || [];
      if (childClassIds.length === 0) {
        return successResponse({ records: [], total: 0, page, totalPages: 0 });
      }
      where.feeStructureClasses = { some: { classId: { in: childClassIds } } };
    }

    if (frequency) where.frequency = frequency;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      db.feeStructure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          name: true,
          amount: true,
          frequency: true,
          isOptional: true,
          isLatePayment: true,
          lateFeeAmount: true,
          lateFeeAfter: true,
          academicYear: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: { id: true, name: true },
          },
          feeStructureClasses: {
            select: {
              classId: true,
              class: {
                select: { id: true, name: true, grade: true, section: true },
              },
            },
          },
        },
      }),
      db.feeStructure.count({ where }),
    ]);

    // Transform data to include classIds for backward compatibility
    const transformedData = data.map((item) => ({
      ...item,
      classIds: item.feeStructureClasses.map((fsc) => fsc.classId),
      classes: item.feeStructureClasses.map((fsc) => fsc.class),
    }));

    return successResponse({
      records: transformedData,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    console.error('[GET /api/fee-structure]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// POST /api/fee-structure - Create fee structure
export async function POST(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const body = await request.json();

    // Validate with Zod schema
    const validationResult = FeeStructureCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const validatedData = validationResult.data;

    // School isolation
    if (auth.role !== 'SUPER_ADMIN') {
      if (validatedData.schoolId !== auth.schoolId) {
        return errorResponse('Cannot create fee structure for a different school', 403);
      }
    } else {
      // Super admin must provide schoolId
      if (!validatedData.schoolId) {
        return errorResponse('schoolId is required for SUPER_ADMIN', 400);
      }
    }

    // Verify school exists
    const school = await db.school.findUnique({
      where: { id: validatedData.schoolId },
    });
    if (!school) {
      return errorResponse('School not found', 404);
    }

    // Create fee structure with class assignments and auto-billing in a transaction
    const feeStructure = await db.$transaction(async (tx) => {
      const newFeeStructure = await tx.feeStructure.create({
        data: {
          schoolId: validatedData.schoolId,
          name: validatedData.name,
          amount: validatedData.amount,
          frequency: validatedData.frequency || 'termly',
          isOptional: validatedData.isOptional || false,
          isLatePayment: validatedData.isLatePayment !== undefined ? validatedData.isLatePayment : true,
          lateFeeAmount: validatedData.lateFeeAmount || null,
          lateFeeAfter: validatedData.lateFeeAfter || null,
          academicYear: validatedData.academicYear || null,
          dueDate: validatedData.dueDate || null,
        },
      });

      // Create FeeStructureClass records if classIds provided
      if (validatedData.classIds && validatedData.classIds.length > 0) {
        // Verify all classes belong to the school
        const classes = await tx.class.findMany({
          where: {
            id: { in: validatedData.classIds },
            schoolId: validatedData.schoolId,
          },
          include: { students: { select: { id: true } } },
        });

        if (classes.length !== validatedData.classIds.length) {
          throw new Error('Some classes not found or do not belong to the school');
        }

        await tx.feeStructureClass.createMany({
          data: validatedData.classIds.map((classId) => ({
            feeStructureId: newFeeStructure.id,
            classId,
          })),
        });

        // ✅ FIXED: Automatically create Payment records for each student in affected classes
        const allStudentsInClasses: { id: string }[] = [];
        for (const cls of classes) {
          allStudentsInClasses.push(...cls.students);
        }

        // Batch create payment records
        if (allStudentsInClasses.length > 0) {
          const uniqueStudentIds = [...new Set(allStudentsInClasses.map(s => s.id))];
          
          await tx.payment.createMany({
            data: uniqueStudentIds.map((studentId) => ({
              schoolId: validatedData.schoolId,
              studentId,
              feeStructureId: newFeeStructure.id,
              amount: validatedData.amount,
              method: 'pending',
              status: 'pending',
              dueDate: validatedData.dueDate,
            })),
            skipDuplicates: true,
          });
        }
      }

      return newFeeStructure;
    });

    // Fetch complete fee structure with relations
    const completeFeeStructure = await db.feeStructure.findUnique({
      where: { id: feeStructure.id },
      select: {
        id: true,
        schoolId: true,
        name: true,
        amount: true,
        frequency: true,
        isOptional: true,
        isLatePayment: true,
        lateFeeAmount: true,
        lateFeeAfter: true,
        academicYear: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        feeStructureClasses: {
          select: {
            classId: true,
            class: {
              select: { id: true, name: true, grade: true, section: true },
            },
          },
        },
      },
    });

    return successResponse(
      completeFeeStructure,
      'Fee structure created successfully',
      201
    );
  } catch (error: unknown) {
    console.error('[POST /api/fee-structure]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}
