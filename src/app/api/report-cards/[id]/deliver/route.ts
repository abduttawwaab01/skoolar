import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { generateWhatsAppMessage, generateEmailHtml } from '@/lib/report-card-utils/delivery';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reportCard = await db.reportCard.findUnique({
      where: { id },
      include: { student: { select: { id: true, admissionNo: true, user: { select: { name: true } } } }, term: { select: { name: true } } },
    });
    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { method = 'whatsapp', recipient } = body;

    if (!recipient) return NextResponse.json({ error: 'Recipient required' }, { status: 400 });

    const school = await db.school.findUnique({ where: { id: reportCard.schoolId }, select: { name: true } });
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: reportCard.schoolId } });

    let status = 'sent';
    let errorMsg: string | null = null;

    try {
      if (method === 'whatsapp') {
        const msg = generateWhatsAppMessage({
          studentName: reportCard.student?.user?.name || 'Student',
          termName: reportCard.term?.name || 'Term',
          session: settings?.academicSession || 'N/A',
          schoolName: school?.name || 'School',
          averageScore: reportCard.averageScore || undefined,
          grade: reportCard.grade || undefined,
        });
        status = 'delivered';
      } else if (method === 'email') {
        const html = generateEmailHtml({
          studentName: reportCard.student?.user?.name || 'Student',
          termName: reportCard.term?.name || 'Term',
          session: settings?.academicSession || 'N/A',
          schoolName: school?.name || 'School',
          averageScore: reportCard.averageScore || undefined,
          grade: reportCard.grade || undefined,
          classRank: reportCard.classRank || undefined,
        });
        status = 'sent';
      }
    } catch (err: any) {
      status = 'failed';
      errorMsg = err.message;
    }

    const delivery = await db.reportCardDelivery.create({
      data: { reportCardId: id, method, recipient, status: errorMsg ? 'failed' : status, error: errorMsg, sentAt: new Date() },
    });

    return NextResponse.json({ data: delivery, whatsappUrl: method === 'whatsapp' ? `https://wa.me/${recipient.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Your report card is ready')}` : null });
  } catch (error) {
    console.error('POST /api/report-cards/[id]/deliver error:', error);
    return NextResponse.json({ error: 'Delivery failed' }, { status: 500 });
  }
}
