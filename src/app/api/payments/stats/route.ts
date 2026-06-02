import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/payments/stats - Collection analytics per fee item
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    // Get all fee structures for this school
    const feeStructures = await db.feeStructure.findMany({
      where: { schoolId: targetSchoolId, deletedAt: null },
      select: { id: true, name: true, amount: true },
    });

    // Get payment stats per fee structure
    const byFeeItem = await Promise.all(
      feeStructures.map(async (fs) => {
        const [totalPayments, verifiedPayments] = await Promise.all([
          db.payment.aggregate({
            _count: true,
            _sum: { amount: true },
            where: { feeStructureId: fs.id, schoolId: targetSchoolId, deletedAt: null },
          }),
          db.payment.aggregate({
            _count: true,
            _sum: { amount: true },
            where: { feeStructureId: fs.id, schoolId: targetSchoolId, status: 'verified', deletedAt: null },
          }),
        ]);

        const totalExpected = totalPayments._count * fs.amount;
        const totalCollected = verifiedPayments._sum.amount || 0;
        const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

        return {
          id: fs.id,
          name: fs.name,
          amount: fs.amount,
          totalStudents: totalPayments._count,
          studentsPaid: verifiedPayments._count,
          totalExpected,
          totalCollected,
          collectionRate,
        };
      })
    );

    // Overall stats
    const overall = byFeeItem.reduce(
      (acc, item) => ({
        totalExpected: acc.totalExpected + item.totalExpected,
        totalCollected: acc.totalCollected + item.totalCollected,
        totalStudents: acc.totalStudents + item.totalStudents,
        studentsPaid: acc.studentsPaid + item.studentsPaid,
      }),
      { totalExpected: 0, totalCollected: 0, totalStudents: 0, studentsPaid: 0 }
    );

    const overallRate = overall.totalExpected > 0 ? Math.round((overall.totalCollected / overall.totalExpected) * 100) : 0;

    return NextResponse.json({
      byFeeItem,
      overall: {
        ...overall,
        collectionRate: overallRate,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
