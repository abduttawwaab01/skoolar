import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// POST /api/payments/[id]/remind - Send reminder to parent about unpaid fee
export async function POST(
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

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            userId: true,
            user: { select: { name: true } },
          },
        },
        feeStructure: {
          select: { name: true, dueDate: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && payment.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (payment.status === 'verified') {
      return NextResponse.json({ error: 'Payment already verified' }, { status: 400 });
    }

    // Find parent linked to this student
    const parentRecord = await db.parent.findFirst({
      where: { schoolId: payment.schoolId },
      include: {
        parentStudents: {
          where: { studentId: payment.studentId },
          select: { parentId: true },
        },
      },
    });

    if (!parentRecord) {
      return NextResponse.json({ error: 'No parent found for this student' }, { status: 404 });
    }

    const feeName = payment.feeStructure?.name || 'Fee';
    const dueStr = payment.dueDate
      ? ` due by ${payment.dueDate.toLocaleDateString()}`
      : payment.feeStructure?.dueDate
        ? ` due by ${new Date(payment.feeStructure.dueDate).toLocaleDateString()}`
        : '';

    // Create in-app notification
    await db.notification.create({
      data: {
        userId: parentRecord.userId,
        schoolId: payment.schoolId,
        title: `Reminder: ${feeName}`,
        message: `Your payment of ₦${payment.amount.toLocaleString()} for ${payment.student?.user?.name || 'your child'} (${feeName})${dueStr} is still pending. Please make payment to avoid late charges.`,
        type: 'warning',
        category: 'payment',
        actionUrl: '/dashboard?tab=finance',
      },
    });

    // Update notified timestamp
    await db.payment.update({
      where: { id },
      data: { parentNotifiedAt: new Date() },
    });

    return NextResponse.json({ message: 'Reminder sent successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
