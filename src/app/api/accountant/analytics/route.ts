import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    // 1. Fetch Fee Structures & Classes
    const [feeStructures, classes] = await Promise.all([
      db.feeStructure.findMany({
        where: { schoolId, deletedAt: null }
      }),
      db.class.findMany({
        where: { schoolId, deletedAt: null },
        include: { _count: { select: { students: true } } }
      })
    ]);

    // 2. Calculate Target Revenue
    let targetRevenue = 0;
    const revenueByClass: Record<string, { className: string, target: number, collected: number }> = {};

    classes.forEach(cls => {
      revenueByClass[cls.id] = { className: cls.name, target: 0, collected: 0 };
    });

    feeStructures.forEach(fee => {
      const targetClassIds = fee.classIds ? fee.classIds.split(',').map(id => id.trim()) : [];
      
      classes.forEach(cls => {
        // If fee applies to all classes (no classIds) or specific class
        if (targetClassIds.length === 0 || targetClassIds.includes(cls.id)) {
          const classAmount = fee.amount * cls._count.students;
          targetRevenue += classAmount;
          if (revenueByClass[cls.id]) {
            revenueByClass[cls.id].target += classAmount;
          }
        }
      });
    });

    // 3. Fetch Actual Payments
    const payments = await db.payment.findMany({
      where: { schoolId, status: 'verified', deletedAt: null },
      select: { amount: true, studentId: true, createdAt: true, student: { select: { classId: true } } }
    });

    let totalCollected = 0;
    const monthlyTrend: Record<string, number> = {};

    payments.forEach(p => {
      totalCollected += p.amount;
      
      // Class mapping
      if (p.student?.classId && revenueByClass[p.student.classId]) {
        revenueByClass[p.student.classId].collected += p.amount;
      }

      // Trend mapping (Last 6 months)
      const month = p.createdAt.toISOString().substring(0, 7); // YYYY-MM
      monthlyTrend[month] = (monthlyTrend[month] || 0) + p.amount;
    });

    // 4. Pending & Overdue
    const pendingPayments = await db.payment.aggregate({
      where: { schoolId, status: 'pending', deletedAt: null },
      _sum: { amount: true },
      _count: true
    });

    // 5. Structure for Chart.js / Recharts
    const classData = Object.values(revenueByClass).map(c => ({
      name: c.className,
      target: c.target,
      collected: c.collected,
      outstanding: Math.max(0, c.target - c.collected)
    })).filter(c => c.target > 0);

    const trendData = Object.entries(monthlyTrend)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, value]) => ({
        month: new Date(month + "-01").toLocaleDateString('default', { month: 'short' }),
        value
      }));

    return NextResponse.json({
      data: {
        summary: {
          targetRevenue,
          collectedRevenue: totalCollected,
          pendingRevenue: pendingPayments._sum.amount || 0,
          collectionRate: targetRevenue > 0 ? Math.round((totalCollected / targetRevenue) * 100) : 0,
          transactionCount: payments.length + (pendingPayments._count || 0)
        },
        classBreakdown: classData,
        monthlyTrend: trendData
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
