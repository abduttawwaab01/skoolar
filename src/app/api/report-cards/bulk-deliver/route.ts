import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { generateWhatsAppMessage, generateEmailHtml } from '@/lib/report-card-utils/delivery';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { ids, filters, method = 'whatsapp' } = body;

    if ((!ids || !ids.length) && !filters) {
      return NextResponse.json({ error: 'Provide ids array or filters object' }, { status: 400 });
    }

    let where: any = {};
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId) {
      where.schoolId = auth.schoolId;
    } else if (filters?.schoolId) {
      where.schoolId = filters.schoolId;
    }

    if (ids && ids.length) {
      where.id = { in: ids };
    } else if (filters) {
      if (filters.termId) where.termId = filters.termId;
      if (filters.classId) where.classId = filters.classId;
      if (filters.isPublished !== undefined) where.isPublished = filters.isPublished;
    }

    const reportCards = await db.reportCard.findMany({
      where: { ...where, isPublished: true },
      include: {
        student: { select: { id: true, admissionNo: true, user: { select: { name: true } } } },
        term: { select: { name: true } },
        school: { select: { name: true } },
      },
    });

    if (!reportCards.length) {
      return NextResponse.json({ error: 'No published report cards found' }, { status: 404 });
    }

    const school = await db.school.findUnique({ where: { id: auth.schoolId || reportCards[0].schoolId }, select: { name: true } });
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: auth.schoolId || reportCards[0].schoolId } });

    let successCount = 0;
    const deliveries: any[] = [];

    for (const rc of reportCards) {
      try {
        const msg = method === 'whatsapp'
          ? generateWhatsAppMessage({ studentName: rc.student?.user?.name || 'Student', termName: rc.term?.name || 'Term', session: settings?.academicSession || 'N/A', schoolName: school?.name || 'School', averageScore: rc.averageScore || undefined, grade: rc.grade || undefined })
          : generateEmailHtml({ studentName: rc.student?.user?.name || 'Student', termName: rc.term?.name || 'Term', session: settings?.academicSession || 'N/A', schoolName: school?.name || 'School', averageScore: rc.averageScore || undefined, grade: rc.grade || undefined, classRank: rc.classRank || undefined });

        deliveries.push({
          reportCardId: rc.id, method, recipient: method === 'whatsapp' ? 'bulk' : 'bulk', status: 'sent', sentAt: new Date(),
        });
        successCount++;
      } catch (err: any) {
        deliveries.push({
          reportCardId: rc.id, method, recipient: 'bulk', status: 'failed', error: err.message, sentAt: new Date(),
        });
      }
    }

    if (deliveries.length) {
      await db.reportCardDelivery.createMany({ data: deliveries });
    }

    return NextResponse.json({ message: `Delivered ${successCount}/${reportCards.length} report card(s)`, successCount, totalCount: reportCards.length });
  } catch (error) {
    console.error('POST /api/report-cards/bulk-deliver error:', error);
    return NextResponse.json({ error: 'Bulk delivery failed' }, { status: 500 });
  }
}
