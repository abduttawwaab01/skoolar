import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/payments - List payments with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const studentId = searchParams.get('studentId') || '';
    const status = searchParams.get('status') || '';
    const method = searchParams.get('method') || '';
    const termId = searchParams.get('termId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    // School context validation
    const userSchoolId = auth.schoolId;
    if (userSchoolId) {
      where.schoolId = userSchoolId;
    } else if (schoolId) {
      where.schoolId = schoolId;
    }

    // ✅ FIXED: Parent can only view their children's payments
    if (auth.role === 'PARENT') {
      const parentRecord = await db.parent.findUnique({
        where: { userId: auth.userId },
        include: {
          parentStudents: {
            select: { studentId: true },
          },
        },
      });

      if (!parentRecord || parentRecord.parentStudents.length === 0) {
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          totalPages: 0,
          totalAmount: 0,
        });
      }

      where.studentId = { in: parentRecord.parentStudents.map(sp => sp.studentId) };
    } else if (studentId) {
      where.studentId = studentId;
    }

    if (status) where.status = status;
    if (method) where.method = method;
    if (termId) where.termId = termId;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.createdAt = dateFilter;
    }
    if (search) {
      where.OR = [
        { receiptNo: { contains: search } },
        { reference: { contains: search } },
        { paidBy: { contains: search } },
        { student: { user: { name: { contains: search } } } },
      ];
    }

    const [data, total] = await Promise.all([
      db.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          studentId: true,
          feeStructureId: true,
          amount: true,
          method: true,
          reference: true,
          status: true,
          termId: true,
          receiptNo: true,
          paidBy: true,
          paidById: true,
          verifiedBy: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              admissionNo: true,
              user: { select: { name: true, email: true } },
              class: { select: { name: true, section: true } },
            },
          },
          // feeStructure is not a relation on Payment (only feeStructureId scalar), omitted
        },
      }),
      db.payment.count({ where }),
    ]);

    // Calculate totals
    const totals = await db.payment.aggregate({
      _sum: { amount: true },
      where: {
        ...where,
        status: 'verified',
      },
    });

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalCollected: totals._sum.amount || 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/payments - Record payment
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const { schoolId, studentId, feeStructureId, amount, method, reference, status, termId, receiptNo, paidBy, paidById, verifiedBy } = body;

    // School context: use auth's schoolId if user is not SUPER_ADMIN
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!studentId || !amount) {
      return NextResponse.json(
        { error: 'studentId and amount are required' },
        { status: 400 }
      );
    }

    // Verify student exists and belongs to the school
    const student = await db.student.findFirst({ 
      where: { id: studentId, schoolId: targetSchoolId } 
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Verify fee structure if provided and belongs to school
    if (feeStructureId) {
      const feeStructure = await db.feeStructure.findFirst({ 
        where: { id: feeStructureId, schoolId: targetSchoolId } 
      });
      if (!feeStructure) {
        return NextResponse.json({ error: 'Fee structure not found' }, { status: 404 });
      }
    }

    // Generate receipt number if not provided
    const paymentReceiptNo = receiptNo || `REC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const payment = await db.payment.create({
      data: {
        schoolId: targetSchoolId,
        studentId,
        feeStructureId: feeStructureId || null,
        amount,
        method: method || 'cash',
        reference: reference || null,
        status: status || 'pending',
        termId: termId || null,
        receiptNo: paymentReceiptNo,
        paidBy: paidBy || null,
        paidById: paidById || auth.userId || null,
        verifiedBy: verifiedBy || null,
      },
    });

    return NextResponse.json({ data: payment, message: 'Payment recorded successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
