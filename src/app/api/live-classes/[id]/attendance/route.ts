import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
    select: { schoolId: true, hostId: true },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  if (
    auth.role !== 'SUPER_ADMIN' &&
    auth.role !== 'SCHOOL_ADMIN' &&
    auth.role !== 'TEACHER' &&
    liveClass.hostId !== auth.id
  ) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const attendance = await db.liveClassAttendance.findMany({
    where: { liveClassId: id },
    orderBy: { joinedAt: 'desc' },
  });

  return NextResponse.json({ data: attendance });
}
