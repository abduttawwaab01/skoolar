import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, validateSchema } from '@/lib/api-helpers';
import { TemplateCreateSchema } from '@/lib/validators/assessment';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get('targetType') || '';

    const where: Record<string, unknown> = { deletedAt: null };
    if (targetType) where.targetType = targetType;
    where.OR = [{ schoolId: ctx.schoolId }, { isBuiltIn: true }];

    const templates = await db.assessmentTemplate.findMany({
      where: where as any,
      orderBy: [{ isBuiltIn: 'desc' }, { createdAt: 'desc' }],
    });

    return templates;
  }, req);

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(TemplateCreateSchema, body);
    if (!validation.valid) return validation.error;

    const template = await db.assessmentTemplate.create({
      data: {
        ...validation.data,
        schoolId: validation.data.isBuiltIn ? null : (ctx.schoolId || null),
        createdBy: ctx.userId,
      },
    });

    return successResponse(template, 'Template created', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
