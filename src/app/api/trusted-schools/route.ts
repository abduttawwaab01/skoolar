import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET() {
  try {
    const records = await db.trustedSchool.findMany({
      orderBy: { trustedOrder: 'asc' },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            primaryColor: true,
            secondaryColor: true,
            website: true,
            region: true,
          },
        },
      },
    });

    const totalSchools = await db.school.count({ where: { deletedAt: null } });

    return NextResponse.json({ data: records, total: totalSchools });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { schoolId } = await request.json();
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const existing = await db.trustedSchool.findUnique({ where: { schoolId } });
    if (existing) {
      return NextResponse.json({ error: 'School is already trusted' }, { status: 409 });
    }

    const maxOrder = await db.trustedSchool.aggregate({ _max: { trustedOrder: true } });
    const nextOrder = (maxOrder._max.trustedOrder ?? -1) + 1;

    const record = await db.trustedSchool.create({
      data: {
        schoolId,
        trustedOrder: nextOrder,
        promotedById: auth.userId!,
      },
      include: {
        school: {
          select: {
            id: true, name: true, slug: true, logo: true,
            primaryColor: true, secondaryColor: true, website: true, region: true,
          },
        },
      },
    });

    await db.school.update({ where: { id: schoolId }, data: { isActive: true } });

    return NextResponse.json({ data: record, message: 'School added to trusted list' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, trustedOrder } = body;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const record = await db.trustedSchool.findUnique({ where: { schoolId } });
    if (!record) {
      return NextResponse.json({ error: 'Trusted school not found' }, { status: 404 });
    }

    const updated = await db.trustedSchool.update({
      where: { schoolId },
      data: {
        ...(trustedOrder !== undefined && { trustedOrder }),
      },
      include: {
        school: {
          select: {
            id: true, name: true, slug: true, logo: true,
            primaryColor: true, secondaryColor: true, website: true, region: true,
          },
        },
      },
    });

    return NextResponse.json({ data: updated, message: 'Order updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    await db.trustedSchool.delete({ where: { schoolId } });

    return NextResponse.json({ message: 'School removed from trusted list' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
