import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const studentId = (await params).id;

    const records = await db.studentGrowthRecord.findMany({
      where: { studentId },
      orderBy: { snapshotDate: 'asc' },
    });

    const trend = records.length >= 2
      ? (records[records.length - 1].overallScore ?? 0) - (records[0].overallScore ?? 0) > 5 ? 'improving'
        : (records[records.length - 1].overallScore ?? 0) - (records[0].overallScore ?? 0) < -5 ? 'declining' : 'stable'
      : 'stable';

    return { records, trend };
  }, req);
