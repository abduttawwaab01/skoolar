import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiHandler, successResponse, errorResponse, validateSchema } from '@/lib/api-helpers';

const createSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  return apiHandler(async (ctx) => {
    const { searchParams } = new URL(ctx.request.url);
    const schoolId = ctx.auth.role === 'SUPER_ADMIN' && searchParams.get('schoolId')
      ? searchParams.get('schoolId')
      : (ctx.schoolId || '');

    if (!schoolId) {
      return errorResponse('School ID is required', 400);
    }

    const categories = await db.inventoryCategory.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true } } },
    });

    return successResponse(categories);
  }, request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'LIBRARIAN', 'DIRECTOR']);
}

export async function POST(request: NextRequest) {
  return apiHandler(async (ctx) => {
    const body = await request.json();
    const validation = validateSchema(createSchema, body);
    if (!validation.valid) return validation.error;

    const { schoolId, name, description } = validation.data;

    if (schoolId !== ctx.schoolId && ctx.auth.role !== 'SUPER_ADMIN') {
      return errorResponse('Forbidden', 403);
    }

    const existing = await db.inventoryCategory.findUnique({
      where: { schoolId_name: { schoolId, name } },
    });

    if (existing) {
      return errorResponse('A category with this name already exists', 409);
    }

    const category = await db.inventoryCategory.create({
      data: { schoolId, name, description },
    });

    return successResponse(category, 'Category created successfully', 201);
  }, request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LIBRARIAN']);
}
