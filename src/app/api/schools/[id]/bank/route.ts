import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/schools/[id]/bank - Get school bank details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const school = await db.school.findUnique({
      where: { id },
      select: { bankName: true, bankAccountName: true, bankAccountNumber: true },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    return NextResponse.json({ data: school });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/schools/[id]/bank - Update school bank details (accountant/admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && id !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { bankName, bankAccountName, bankAccountNumber } = body;

    const updated = await db.school.update({
      where: { id },
      data: {
        ...(bankName !== undefined && { bankName }),
        ...(bankAccountName !== undefined && { bankAccountName }),
        ...(bankAccountNumber !== undefined && { bankAccountNumber }),
      },
      select: { bankName: true, bankAccountName: true, bankAccountNumber: true },
    });

    return NextResponse.json({ data: updated, message: 'Bank details updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
