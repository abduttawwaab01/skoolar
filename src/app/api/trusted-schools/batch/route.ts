import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'promote-first') {
      const count = body.count || 5;

      const existingCount = await db.trustedSchool.count();
      const schools = await db.school.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: count,
      });

      let added = 0;
      for (let i = 0; i < schools.length; i++) {
        const already = await db.trustedSchool.findUnique({ where: { schoolId: schools[i].id } });
        if (!already) {
          await db.trustedSchool.create({
            data: {
              schoolId: schools[i].id,
              trustedOrder: existingCount + added,
              promotedById: auth.userId!,
            },
          });
          await db.school.update({ where: { id: schools[i].id }, data: { isActive: true } });
          added++;
        }
      }

      return NextResponse.json({ message: `Promoted ${added} schools`, count: added });
    }

    if (action === 'reorder') {
      const { order } = body;
      if (!Array.isArray(order)) {
        return NextResponse.json({ error: 'order must be an array of school IDs' }, { status: 400 });
      }

      await db.$transaction(
        order.map((schoolId: string, index: number) =>
          db.trustedSchool.update({
            where: { schoolId },
            data: { trustedOrder: index },
          })
        )
      );

      return NextResponse.json({ message: 'Order updated' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
