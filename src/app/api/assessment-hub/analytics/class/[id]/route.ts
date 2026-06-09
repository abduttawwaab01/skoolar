import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const classId = (await params).id;

    const students = await db.student.findMany({
      where: { classId, schoolId: ctx.schoolId, isActive: true },
      select: { id: true, user: { select: { name: true } } },
    });

    const studentIds = students.map(s => s.id);
    const results = await db.studentDomainResult.findMany({
      where: { studentId: { in: studentIds } },
    });

    const domainAverages: Record<string, { total: number; count: number }> = {};
    for (const r of results) {
      if (!domainAverages[r.domain]) domainAverages[r.domain] = { total: 0, count: 0 };
      domainAverages[r.domain].total += r.percentage;
      domainAverages[r.domain].count++;
    }

    const domainSummary = Object.entries(domainAverages).map(([domain, data]) => ({
      domain,
      averagePercentage: data.count > 0 ? Math.round(data.total / data.count) : 0,
      studentCount: data.count,
    }));

    return {
      classId,
      totalStudents: students.length,
      domainSummary,
      overallAverage: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0,
    };
  }, req);
