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
    const schoolId = searchParams.get('schoolId') || auth.schoolId || '';

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    // Get all fee structures for this school
    const feeStructures = await db.feeStructure.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true, amount: true },
    });

    // Get payment stats per fee structure
    const byFeeItem = await Promise.all(
      feeStructures.map(async (fs) => {
        const [totalPayments, verifiedPayments] = await Promise.all([
          db.payment.aggregate({
            _count: true,
            _sum: { amount: true },
            where: { feeStructureId: fs.id, schoolId, deletedAt: null },
          }),
          db.payment.aggregate({
            _count: true,
            _sum: { amount: true },
            where: { feeStructureId: fs.id, schoolId, status: 'verified', deletedAt: null },
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
