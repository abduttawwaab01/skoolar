import { NextRequest } from 'next/server';
import { apiHandler, successResponse, validateSchema } from '@/lib/api-helpers';
import { AIGradeSchema } from '@/lib/validators/assessment';
import { gradeResponse } from '@/lib/ai-assessment';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(AIGradeSchema, body);
    if (!validation.valid) return validation.error;

    const result = await gradeResponse(
      validation.data.questionText,
      validation.data.studentAnswer,
      validation.data.maxMarks,
      validation.data.rubric || undefined,
      ctx.schoolId
    );

    if (!result.success) {
      return successResponse({ score: 0, feedback: 'AI grading unavailable' });
    }

    return successResponse(result.data, 'Response graded');
  }, req);
