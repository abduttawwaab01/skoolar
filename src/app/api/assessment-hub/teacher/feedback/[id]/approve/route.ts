import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, validateSchema } from '@/lib/api-helpers';
import { FeedbackApproveSchema } from '@/lib/validators/assessment';

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    const validation = validateSchema(FeedbackApproveSchema, { ...body, id });
    if (!validation.valid) return validation.error;

    const feedback = await db.teacher360FeedbackEntry.update({
      where: { id },
      data: { approvalStatus: validation.data.approvalStatus },
    });

    return successResponse(feedback, `Feedback ${validation.data.approvalStatus}`);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
