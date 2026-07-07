import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiHandler, successResponse, errorResponse, validateSchema, getPaginationParams } from '@/lib/api-helpers';

const createSchema = z.object({
  schoolId: z.string().min(1),
  categoryId: z.string().optional(),
  name: z.string().min(1, 'Item name is required').max(200),
  description: z.string().max(1000).optional(),
  quantity: z.number().int().min(0).default(1),
  minQuantity: z.number().int().min(0).default(0),
  unit: z.string().max(50).optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor', 'damaged']).default('new'),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  serialNumber: z.string().max(200).optional(),
  barcode: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  isConsumable: z.boolean().default(false),
  status: z.enum(['available', 'in_use', 'under_maintenance', 'retired']).default('available'),
  assignedTo: z.string().max(200).optional(),
  imageUrl: z.string().max(500).optional(),
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

    const { page, limit } = getPaginationParams(searchParams);
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const condition = searchParams.get('condition');
    const search = searchParams.get('search');

    const where: any = {
      schoolId,
      deletedAt: null,
    };

    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (condition) where.condition = condition;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      db.inventoryItem.count({ where }),
    ]);

    return {
      data: items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }, request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'LIBRARIAN', 'DIRECTOR']);
}

export async function POST(request: NextRequest) {
  return apiHandler(async (ctx) => {
    const body = await request.json();
    const validation = validateSchema(createSchema, body);
    if (!validation.valid) return validation.error;

    const data = validation.data;

    if (data.schoolId !== ctx.schoolId && ctx.auth.role !== 'SUPER_ADMIN') {
      return errorResponse('Forbidden', 403);
    }

    const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : undefined;

    const item = await db.inventoryItem.create({
      data: {
        schoolId: data.schoolId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        quantity: data.quantity,
        minQuantity: data.minQuantity,
        unit: data.unit,
        condition: data.condition,
        purchaseDate,
        purchasePrice: data.purchasePrice,
        supplier: data.supplier,
        location: data.location,
        serialNumber: data.serialNumber,
        barcode: data.barcode,
        notes: data.notes,
        isConsumable: data.isConsumable,
        status: data.status,
        assignedTo: data.assignedTo,
        imageUrl: data.imageUrl,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    return successResponse(item, 'Item created successfully', 201);
  }, request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LIBRARIAN']);
}
