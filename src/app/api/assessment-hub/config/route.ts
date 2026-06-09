import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, validateSchema } from '@/lib/api-helpers';
import { AIConfigUpdateSchema } from '@/lib/validators/assessment';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    let config = await db.aIAssessmentConfig.findUnique({ where: { schoolId: ctx.schoolId } });
    if (!config) {
      config = await db.aIAssessmentConfig.create({
        data: { schoolId: ctx.schoolId },
      });
    }
    return config;
  }, req);

export const PUT = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(AIConfigUpdateSchema, body);
    if (!validation.valid) return validation.error;

    const config = await db.aIAssessmentConfig.upsert({
      where: { schoolId: ctx.schoolId },
      create: { schoolId: ctx.schoolId, ...validation.data },
      update: validation.data,
    });

    return successResponse(config, 'AI configuration updated');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
