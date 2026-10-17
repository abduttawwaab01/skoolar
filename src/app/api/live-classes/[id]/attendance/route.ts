import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { isLiveClassHost } from '@/lib/live-class-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId') || undefined;

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null },
    select: { schoolId: true, hostId: true, guestUserId: true },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Live class not found' }, { status: 404 });
  }

  const isStaff = auth.authenticated && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(auth.role || '');
  if (!isStaff && !isLiveClassHost(liveClass, auth, guestId)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const attendance = await db.liveClassAttendance.findMany({
    where: { liveClassId: id },
    orderBy: { joinedAt: 'desc' },
  });

  return NextResponse.json({ data: attendance });
}
