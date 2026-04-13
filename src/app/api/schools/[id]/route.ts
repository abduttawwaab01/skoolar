import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/schools/[id] - Get single school by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const school = await db.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
            subjects: true,
            parents: true,
            academicYears: true,
            exams: true,
            announcements: true,
            feeStructures: true,
            payments: true,
            books: true,
            feedbacks: true,
          },
        },
      },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    if (school.deletedAt) {
      return NextResponse.json({ error: 'School has been deleted' }, { status: 410 });
    }

    return NextResponse.json({ data: school });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/schools/[id] - Update school
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if school exists
    const existing = await db.school.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted school' }, { status: 410 });
    }

    // Check slug uniqueness if being updated
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await db.school.findUnique({ where: { slug: body.slug } });
      if (slugExists) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      }
    }

    const { name, slug, email, phone, address, motto, website, plan, region, isActive, maxStudents, maxTeachers, primaryColor, secondaryColor, foundedDate, planId } = body;

    const updateData: Record<string, unknown> = {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(motto !== undefined && { motto }),
      ...(website !== undefined && { website }),
      ...(plan && { plan }),
      ...(region !== undefined && { region }),
      ...(isActive !== undefined && { isActive }),
      ...(maxStudents && { maxStudents }),
      ...(maxTeachers && { maxTeachers }),
      ...(primaryColor && { primaryColor }),
      ...(secondaryColor && { secondaryColor }),
      ...(foundedDate !== undefined && { foundedDate: foundedDate ? new Date(foundedDate) : null }),
    };

    // If planId is being changed, validate it and create a PlatformPayment record
    if (planId && planId !== existing.planId) {
      const targetPlan = await db.subscriptionPlan.findUnique({
        where: { id: planId },
      });
      if (!targetPlan) {
        return NextResponse.json({ error: 'Target subscription plan not found' }, { status: 400 });
      }

      updateData.planId = planId;
      updateData.plan = targetPlan.name;

      // Deactivate existing active payments for this school
      await db.platformPayment.updateMany({
        where: {
          schoolId: id,
          status: 'active',
        },
        data: { status: 'expired' },
      });

      // Create a new active PlatformPayment record
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      await db.platformPayment.create({
        data: {
          schoolId: id,
          planId: targetPlan.id,
          reference: `manual-upgrade-${id}-${Date.now()}`,
          amount: targetPlan.price,
          currency: 'NGN',
          status: 'active',
          startDate: new Date(),
          endDate: oneYearFromNow,
          channel: 'manual_upgrade',
        },
      });
    }

    const school = await db.school.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: school, message: 'School updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/schools/[id] - Soft delete school
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.school.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'School already deleted' }, { status: 410 });
    }

    const school = await db.school.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return NextResponse.json({ data: school, message: 'School deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
