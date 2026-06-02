import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuthAndRole,
  errorResponse,
  successResponse,
} from '@/lib/api-helpers';
import { z } from 'zod';

const ExpenseCreateSchema = z.object({
  schoolId: z.string().cuid(),
  title: z.string().min(3).max(255),
  description: z.string().max(1000).optional(),
  amount: z.number().positive(),
  category: z.string().min(1),
  date: z.coerce.date().optional(),
  paidTo: z.string().optional(),
  status: z.enum(['paid', 'pending']).optional(),
});

// GET /api/expenses - List expenses
export async function GET(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'ACCOUNTANT',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const querySchoolId = searchParams.get('schoolId') || '';

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return errorResponse('School context required', 403);
    }

    const where: any = { deletedAt: null };
    if (targetSchoolId) where.schoolId = targetSchoolId;

    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { paidTo: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      db.expense.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      db.expense.count({ where }),
    ]);

    return successResponse({
      records: data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('[GET /api/expenses]', error);
    return errorResponse(error.message, 500);
  }
}

// POST /api/expenses - Create expense
export async function POST(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, [
    'SCHOOL_ADMIN',
    'ACCOUNTANT',
  ]);

  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const body = await request.json();
    const validation = ExpenseCreateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const data = validation.data;

    // School isolation
    if (data.schoolId !== auth.schoolId && auth.role !== 'SUPER_ADMIN') {
      return errorResponse('Access denied', 403);
    }

    const expense = await db.expense.create({
      data: {
        schoolId: data.schoolId,
        title: data.title,
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: data.date || new Date(),
        paidTo: data.paidTo,
        status: data.status || 'paid',
      },
    });

    return successResponse(expense, 'Expense recorded successfully', 201);
  } catch (error: any) {
    console.error('[POST /api/expenses]', error);
    return errorResponse(error.message, 500);
  }
}

// DELETE /api/expenses?id=xxx
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, ['SCHOOL_ADMIN', 'ACCOUNTANT']);
  if (!authResult.valid) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return errorResponse('Expense ID required', 400);

    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) return errorResponse('Expense not found', 404);

    if (expense.schoolId !== authResult.auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    await db.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return successResponse(null, 'Expense deleted successfully');
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}
