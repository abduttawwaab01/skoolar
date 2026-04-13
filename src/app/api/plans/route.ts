import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/plans - List all subscription plans
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const includeUsage = searchParams.get('includeUsage') === 'true';

    const where: Record<string, unknown> = {};
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const plans = await db.subscriptionPlan.findMany({
      where,
      orderBy: { price: 'asc' },
      ...(includeUsage ? {
        include: {
          _count: { select: { schools: true } },
        },
      } : {}),
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/plans - Create new subscription plan (Super Admin)
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name, displayName, price, yearlyPrice,
      maxStudents, maxTeachers, maxClasses,
      maxParents, maxLibraryBooks, maxVideoLessons,
      maxHomeworkPerMonth, storageLimit, supportLevel,
      customDomain, apiAccess, whiteLabel,
      features, isActive, paystackPlanCode,
    } = body;

    if (!name || !displayName) {
      return NextResponse.json(
        { success: false, error: 'name and displayName are required' },
        { status: 400 }
      );
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        displayName,
        price: price ?? 0,
        yearlyPrice: yearlyPrice ?? null,
        maxStudents: maxStudents ?? 50,
        maxTeachers: maxTeachers ?? 5,
        maxClasses: maxClasses ?? 10,
        maxParents: maxParents ?? 100,
        maxLibraryBooks: maxLibraryBooks ?? 500,
        maxVideoLessons: maxVideoLessons ?? 50,
        maxHomeworkPerMonth: maxHomeworkPerMonth ?? 100,
        storageLimit: storageLimit ?? 1000,
        supportLevel: supportLevel ?? 'email',
        customDomain: customDomain ?? false,
        apiAccess: apiAccess ?? false,
        whiteLabel: whiteLabel ?? false,
        features: features ? (typeof features === 'string' ? features : JSON.stringify(features)) : '[]',
        isActive: isActive ?? true,
        paystackPlanCode: paystackPlanCode || null,
      },
    });

    return NextResponse.json({ success: true, data: plan, message: 'Subscription plan created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/plans - Update subscription plan (Super Admin)
export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Plan id is required' }, { status: 400 });
    }

    const existing = await db.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'displayName', 'price', 'yearlyPrice',
      'maxStudents', 'maxTeachers', 'maxClasses',
      'maxParents', 'maxLibraryBooks', 'maxVideoLessons',
      'maxHomeworkPerMonth', 'storageLimit', 'supportLevel',
      'customDomain', 'apiAccess', 'whiteLabel',
      'isActive', 'paystackPlanCode',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'features') {
          updateData[field] = typeof data[field] === 'string' ? data[field] : JSON.stringify(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: plan, message: 'Plan updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/plans - Soft delete plan (set isActive=false) (Super Admin)
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Plan id is required' }, { status: 400 });
    }

    const existing = await db.subscriptionPlan.findUnique({
      where: { id },
      include: { _count: { select: { schools: true } } },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    if (existing._count.schools > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot deactivate plan: ${existing._count.schools} school(s) are using this plan. Reassign them first.` },
        { status: 400 }
      );
    }

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: plan, message: 'Plan deactivated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
