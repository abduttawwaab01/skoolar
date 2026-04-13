import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

// GET /api/plans-manager - Super Admin plan management
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'usage-stats') {
      const plans = await db.subscriptionPlan.findMany({ include: { _count: { select: { schools: true } } } });
      return NextResponse.json({ success: true, data: plans });
    }

    const plans = await db.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
    return NextResponse.json({ success: true, data: plans });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireRole(request, 'SUPER_ADMIN');
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.displayName && { displayName: data.displayName }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.yearlyPrice !== undefined && { yearlyPrice: data.yearlyPrice }),
        ...(data.maxStudents !== undefined && { maxStudents: data.maxStudents }),
        ...(data.maxTeachers !== undefined && { maxTeachers: data.maxTeachers }),
        ...(data.maxClasses !== undefined && { maxClasses: data.maxClasses }),
        ...(data.maxParents !== undefined && { maxParents: data.maxParents }),
        ...(data.maxLibraryBooks !== undefined && { maxLibraryBooks: data.maxLibraryBooks }),
        ...(data.maxVideoLessons !== undefined && { maxVideoLessons: data.maxVideoLessons }),
        ...(data.maxHomeworkPerMonth !== undefined && { maxHomeworkPerMonth: data.maxHomeworkPerMonth }),
        ...(data.storageLimit !== undefined && { storageLimit: data.storageLimit }),
        ...(data.supportLevel && { supportLevel: data.supportLevel }),
        ...(data.customDomain !== undefined && { customDomain: data.customDomain }),
        ...(data.apiAccess !== undefined && { apiAccess: data.apiAccess }),
        ...(data.whiteLabel !== undefined && { whiteLabel: data.whiteLabel }),
        ...(data.features !== undefined && { features: typeof data.features === 'string' ? data.features : JSON.stringify(data.features) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.paystackPlanCode !== undefined && { paystackPlanCode: data.paystackPlanCode }),
      },
    });

    return NextResponse.json({ success: true, data: plan, message: 'Plan updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireRole(request, 'SUPER_ADMIN');
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });

    // Check if any schools use this plan
    const schoolCount = await db.school.count({ where: { planId: id } });
    if (schoolCount > 0) {
      return NextResponse.json({ success: false, message: `Cannot delete: ${schoolCount} school(s) use this plan` }, { status: 400 });
    }

    await db.subscriptionPlan.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
