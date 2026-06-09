import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, validateSchema } from '@/lib/api-helpers';
import { TemplateInstantiateSchema } from '@/lib/validators/assessment';

export const POST = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const templateId = (await params).id;
    const body = await req.json();
    const validation = validateSchema(TemplateInstantiateSchema, { ...body, templateId });
    if (!validation.valid) return validation.error;

    const template = await db.assessmentTemplate.findUnique({ where: { id: templateId } });
    if (!template) return errorResponse('Template not found', 404);

    let assessment: unknown;

    if (template.targetType === 'student') {
      const domains = template.studentDomains ? JSON.parse(template.studentDomains) : ['cognitive'];
      assessment = await db.studentAssessment.create({
        data: {
          schoolId: validation.data.schoolId,
          name: validation.data.name || template.name,
          description: template.description,
          type: domains[0] || 'comprehensive',
          targetScope: validation.data.targetScope || 'all_students',
          targetClassIds: validation.data.targetClassIds || null,
          targetStudentIds: validation.data.targetStudentIds || null,
          termId: validation.data.termId || null,
          createdBy: ctx.userId,
          metadata: template.configuration || null,
        },
      });
    } else {
      assessment = await db.teacherAssessment.create({
        data: {
          schoolId: validation.data.schoolId,
          name: validation.data.name || template.name,
          description: template.description,
          type: 'comprehensive',
          createdBy: ctx.userId,
          termId: validation.data.termId || null,
        },
      });
    }

    return successResponse(assessment, 'Assessment created from template', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
