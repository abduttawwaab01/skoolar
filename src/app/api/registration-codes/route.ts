import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireRole } from '@/lib/auth-middleware';

// GET /api/registration-codes - List registration codes
export async function GET(request: NextRequest) {
  try {
    const authResponse = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if (authResponse instanceof NextResponse) return authResponse;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const plan = searchParams.get('plan') || '';
    const isUsed = searchParams.get('isUsed');
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    if (schoolId) where.schoolId = schoolId;
    if (plan) where.plan = plan;
    if (isUsed !== null && isUsed !== undefined && isUsed !== '') {
      where.isUsed = isUsed === 'true';
    }
    if (search) {
      where.code = { contains: search };
    }

    const [data, total] = await Promise.all([
      db.registrationCode.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          plan: true,
          region: true,
          maxUses: true,
          usedCount: true,
          expiresAt: true,
          isUsed: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          schoolId: true,
          school: {
            select: { id: true, name: true },
          },
        },
      }),
      db.registrationCode.count({ where }),
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

// POST /api/registration-codes - Generate new code(s)
export async function POST(request: NextRequest) {
  try {
    const authResponse = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if (authResponse instanceof NextResponse) return authResponse;
    
    const body = await request.json();
    const { plan, maxUses, expiresAt, schoolId, region, count, createdBy } = body;

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan is required (basic, pro, enterprise)' },
        { status: 400 }
      );
    }

    const validPlans = ['basic', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be: basic, pro, or enterprise' },
        { status: 400 }
      );
    }

    // Validate school if provided
    if (schoolId) {
      const school = await db.school.findUnique({ where: { id: schoolId } });
      if (!school) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }
    }

    const codeCount = Math.min(count || 1, 50); // Max 50 at a time
    const generatedCodes: unknown[] = [];

    for (let i = 0; i < codeCount; i++) {
      // Generate a unique code
      let code: string = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        const prefix = plan.substring(0, 3).toUpperCase();
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        code = `SKL-${prefix}-${random}`;

        const existing = await db.registrationCode.findUnique({ where: { code } });
        isUnique = !existing;
        attempts++;
      }

      if (!isUnique) continue;

      const registrationCode = await db.registrationCode.create({
        data: {
          code,
          plan,
          region: region || null,
          maxUses: maxUses || 1,
          usedCount: 0,
          isUsed: false,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          schoolId: schoolId || null,
          createdBy: createdBy || null,
        },
      });

      generatedCodes.push(registrationCode);
    }

    return NextResponse.json(
      {
        data: generatedCodes,
        message: `${generatedCodes.length} registration code(s) generated successfully`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/registration-codes - Update registration code
export async function PUT(request: NextRequest) {
  try {
    const authResponse = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if (authResponse instanceof NextResponse) return authResponse;
    
    const body = await request.json();
    const { id, plan, maxUses, expiresAt, region, isUsed } = body;

    if (!id) {
      return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
    }

    // Find existing code
    const existingCode = await db.registrationCode.findUnique({
      where: { id },
    });

    if (!existingCode) {
      return NextResponse.json({ error: 'Registration code not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (plan !== undefined) updateData.plan = plan;
    if (maxUses !== undefined) updateData.maxUses = maxUses;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (region !== undefined) updateData.region = region;
    if (isUsed !== undefined) updateData.isUsed = isUsed;

    const updatedCode = await db.registrationCode.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        code: true,
        plan: true,
        region: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        isUsed: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        schoolId: true,
        school: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      data: updatedCode,
      message: 'Registration code updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/registration-codes - Delete registration code (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const authResponse = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if (authResponse instanceof NextResponse) return authResponse;
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Code ID is required' }, { status: 400 });
    }

    // Soft delete by setting deletedAt
    const deletedCode = await db.registrationCode.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: {
        id: true,
        code: true,
        plan: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: deletedCode,
      message: 'Registration code deleted successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
