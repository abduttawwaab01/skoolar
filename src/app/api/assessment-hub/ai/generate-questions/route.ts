import { NextRequest } from 'next/server';
import { apiHandler, successResponse, validateSchema } from '@/lib/api-helpers';
import { AIGenerateQuestionsSchema } from '@/lib/validators/assessment';
import { generateQuestions } from '@/lib/ai-assessment';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(AIGenerateQuestionsSchema, body);
    if (!validation.valid) return validation.error;

    const result = await generateQuestions(
      validation.data.topics,
      validation.data.domain,
      validation.data.difficulty,
      validation.data.count,
      validation.data.targetType || 'student',
      ctx.schoolId,
      validation.data.questionTypes
    );

    if (!result.success) {
      return successResponse({ questions: [], warning: result.error || 'AI unavailable, using fallback' });
    }

    return successResponse(result.data, 'Questions generated');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
