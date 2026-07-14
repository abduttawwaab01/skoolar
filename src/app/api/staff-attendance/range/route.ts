import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const staffUserId = searchParams.get('userId'); // optional: filter for a specific staff

    const userSchoolId = auth.schoolId;
    if (!userSchoolId) {
      return NextResponse.json({ error: 'No school associated with account' }, { status: 403 });
    }

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 });
    }

    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const where: Record<string, unknown> = {
      schoolId: userSchoolId,
      date: { gte: from, lte: to },
    };
    if (staffUserId) where.userId = staffUserId;

    const records = await db.staffAttendance.findMany({
      where,
      orderBy: { date: 'asc' },
      select: {
        id: true,
        userId: true,
        date: true,
        status: true,
        checkInTime: true,
      },
    });

    // Build daily aggregation
    const dailyMap = new Map<string, { present: number; absent: number; late: number }>();
    for (const r of records) {
      const key = toLocalDateStr(r.date);
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { present: 0, absent: 0, late: 0 });
      }
      const entry = dailyMap.get(key)!;
      if (r.status === 'present') entry.present++;
      else if (r.status === 'absent') entry.absent++;
      else if (r.status === 'late') entry.late++;
    }

    // Fill missing days with zeros
    const result: { date: string; present: number; absent: number; late: number }[] = [];
    const current = new Date(from);
    while (current <= to) {
      const key = toLocalDateStr(current);
      const dayData = dailyMap.get(key) || { present: 0, absent: 0, late: 0 };
      result.push({ date: key, ...dayData });
      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
