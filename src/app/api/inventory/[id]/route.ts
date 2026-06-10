import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiHandler, successResponse, errorResponse, validateSchema } from '@/lib/api-helpers';

const updateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().int().min(0).optional(),
  minQuantity: z.number().int().min(0).optional(),
  unit: z.string().max(50).optional().nullable(),
  condition: z.enum(['new', 'good', 'fair', 'poor', 'damaged']).optional(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  serialNumber: z.string().max(200).optional().nullable(),
  barcode: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isConsumable: z.boolean().optional(),
  status: z.enum(['available', 'in_use', 'under_maintenance', 'retired']).optional(),
  assignedTo: z.string().max(200).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const { id } = await params;

    const item = await db.inventoryItem.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } } },
    });

    if (!item || item.deletedAt) {
      return errorResponse('Item not found', 404);
    }

    return successResponse(item);
  }, request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'LIBRARIAN', 'DIRECTOR']);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const { id } = await params;

    const existing = await db.inventoryItem.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return errorResponse('Item not found', 404);
    }

    const body = await request.json();
    const validation = validateSchema(updateSchema, body);
    if (!validation.valid) return validation.error;

    const data: any = { ...validation.data };
    if (data.purchaseDate) {
      data.purchaseDate = new Date(data.purchaseDate);
    } else if (data.purchaseDate === null) {
      data.purchaseDate = null;
    }

    const item = await db.inventoryItem.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true } } },
    });

    return successResponse(item, 'Item updated successfully');
  }, request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LIBRARIAN']);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const { id } = await params;

    const existing = await db.inventoryItem.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return errorResponse('Item not found', 404);
    }

    await db.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return successResponse(null, 'Item deleted successfully');
  }, request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LIBRARIAN']);
}
