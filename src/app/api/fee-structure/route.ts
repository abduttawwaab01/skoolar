import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/fee-structure - List fee structures
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const frequency = searchParams.get('frequency') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    if (schoolId) where.schoolId = schoolId;
    if (frequency) where.frequency = frequency;
    if (search) {
      where.name = { contains: search };
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
          classIds: true,
          isOptional: true,
          isLatePayment: true,
          lateFeeAmount: true,
          lateFeeAfter: true,
          academicYear: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: { id: true, name: true },
          },
        },
      }),
      db.feeStructure.count({ where }),
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

// POST /api/fee-structure - Create fee structure
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { schoolId, name, amount, frequency, classIds, isOptional, isLatePayment, lateFeeAmount, lateFeeAfter, academicYear } = body;

    if (!schoolId || !name || amount === undefined) {
      return NextResponse.json(
        { error: 'schoolId, name, and amount are required' },
        { status: 400 }
      );
    }

    const feeStructure = await db.feeStructure.create({
      data: {
        schoolId,
        name,
        amount: parseFloat(amount) || 0,
        frequency: frequency || 'termly',
        classIds: classIds ? JSON.stringify(classIds) : null,
        isOptional: isOptional || false,
        isLatePayment: isLatePayment !== undefined ? isLatePayment : true,
        lateFeeAmount: lateFeeAmount ? parseFloat(lateFeeAmount) : null,
        lateFeeAfter: lateFeeAfter || null,
        academicYear: academicYear || null,
      },
    });

    return NextResponse.json({ data: feeStructure, message: 'Fee structure created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
