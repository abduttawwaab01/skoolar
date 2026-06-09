import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, errorResponse } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const studentId = (await params).id;
    const profile = await db.studentLearningStyleProfile.findUnique({ where: { studentId } });
    if (!profile) return errorResponse('Learning style profile not found', 404);
    return profile;
  }, req);
