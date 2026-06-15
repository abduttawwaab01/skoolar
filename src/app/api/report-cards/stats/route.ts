import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const [total, byStatus, byType, recent, todayScans, deliveries, approvals] = await Promise.all([
      db.reportCard.count({ where: { schoolId: targetSchoolId, deletedAt: null } }),
      db.reportCard.groupBy({ by: ['approvalStatus'], where: { schoolId: targetSchoolId, deletedAt: null }, _count: true }),
      db.reportCard.groupBy({ by: ['grade'], where: { schoolId: targetSchoolId, deletedAt: null }, _count: true }),
      db.reportCard.count({ where: { schoolId: targetSchoolId, deletedAt: null, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
      db.reportCard.count({ where: { schoolId: targetSchoolId, deletedAt: null, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      db.reportCardDelivery.count({ where: { reportCard: { schoolId: targetSchoolId } } }),
      db.reportCardApproval.count({ where: { reportCard: { schoolId: targetSchoolId } } }),
    ]);

    const statusMap: Record<string, number> = {};
    byStatus.forEach((s: any) => { statusMap[s.approvalStatus] = s._count; });

    const gradeMap: Record<string, number> = {};
    byType.forEach((g: any) => { gradeMap[g.grade || 'N/A'] = g._count; });

    return NextResponse.json({
      data: { total, byStatus: statusMap, byGrade: gradeMap, recent7Days: recent, today: todayScans, deliveries, approvals },
    });
  } catch (error) {
    console.error('GET /api/report-cards/stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
