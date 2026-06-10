import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { PROMPTS } from '@/lib/ai/prompts';
import { aiComplete, parseJSONFromAI } from '@/lib/ai/client';
import { AIFinancialForecast } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'ACCOUNTANT') {
      return NextResponse.json({ error: 'Only admins and accountants can access forecasts' }, { status: 403 });
    }

    const body = await request.json();
    const schoolId = (auth.role === 'SUPER_ADMIN' && body.schoolId) ? body.schoolId : auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const [school, students, activeTerm, payments, feeStructures] = await Promise.all([
      db.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      db.student.count({ where: { schoolId, deletedAt: null } }),
      db.term.findFirst({ where: { schoolId, deletedAt: null }, orderBy: { order: 'desc' } }),
      db.payment.aggregate({ where: { schoolId }, _sum: { amount: true }, _count: true }),
      db.feeStructure.findMany({ where: { schoolId }, select: { amount: true } }),
    ]);

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const totalFee = feeStructures.reduce((sum, f) => sum + Number(f.amount), 0);
    const avgFeePerStudent = feeStructures.length > 0 ? Math.round(totalFee / feeStructures.length) : 0;
    const collectionRate = students > 0 ? Math.round(((payments?._count || 0) / students) * 100) : 0;
    const totalCollected = Number(payments?._sum?.amount || 0);

    const systemPrompt = PROMPTS.FINANCIAL_FORECAST.system;
    const userPrompt = PROMPTS.FINANCIAL_FORECAST.user({
      schoolName: school.name,
      currentTerm: activeTerm?.name || 'Current',
      totalStudents: students,
      feePerStudent: avgFeePerStudent,
      collectionRate,
      previousTermCollectionRate: Math.max(0, collectionRate - 5),
      totalExpenses: Math.round(totalCollected * 0.7),
      outstandingFees: Math.round((students * avgFeePerStudent) - totalCollected),
      numberOfDefaulters: Math.round(students * (1 - collectionRate / 100)),
    });

    const result = await aiComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { role: 'ACCOUNTANT' });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI forecast failed' }, { status: 500 });
    }

    const parsed = parseJSONFromAI<AIFinancialForecast>(result.content || '');

    return NextResponse.json({
      success: true,
      data: parsed || { projectedRevenue: 0, projectedExpenses: 0, netPosition: 0, riskFactors: [], recommendations: [] },
      modelUsed: result.modelUsed,
      metadata: { schoolName: school.name, totalStudents: students, collectionRate: `${collectionRate}%`, outstandingFees: Math.round((students * avgFeePerStudent) - totalCollected) },
    });
  } catch (error) {
    console.error('AI Finance Forecast Error:', error);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
