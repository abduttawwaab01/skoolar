import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleSilentError } from '@/lib/error-handler';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, format, schoolId, from, to } = await req.json();

    if (!type || !schoolId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let data: unknown[] = [];
    let filename = '';

    switch (type) {
      case 'students':
        data = await db.student.findMany({
          where: { schoolId },
          include: { user: true, class: true },
          take: 5000,
        });
        filename = 'students_export';
        break;
      case 'teachers':
        data = await db.teacher.findMany({
          where: { schoolId },
          include: { user: true },
          take: 5000,
        });
        filename = 'teachers_export';
        break;
      case 'attendance':
        data = await db.attendance.findMany({
          where: {
            schoolId,
            date: {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(to) : undefined,
            },
          },
          include: { student: { include: { user: true } } },
          take: 10000,
        });
        filename = 'attendance_export';
        break;
      case 'payments':
        data = await db.payment.findMany({
          where: {
            schoolId,
            createdAt: {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(to) : undefined,
            },
          },
          include: { student: { include: { user: true } } },
          take: 10000,
        });
        filename = 'payments_export';
        break;
      case 'exams':
        data = await db.exam.findMany({
          where: { schoolId },
          include: { scores: true, subject: true, class: true },
          take: 5000,
        });
        filename = 'exams_export';
        break;
      case 'report-cards':
        data = await db.reportCard.findMany({
          where: { schoolId },
          include: { student: { include: { user: true } } },
          take: 5000,
        });
        filename = 'report_cards_export';
        break;
      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    const exportId = `export-${Date.now()}`;

    return NextResponse.json({
      success: true,
      id: exportId,
      downloadUrl: `/api/export/download/${exportId}?type=${type}&format=${format}&schoolId=${schoolId}`,
      size: `${JSON.stringify(data).length} bytes`,
      count: data.length,
      message: `Exported ${data.length} ${type} records`,
    });

  } catch (error: unknown) {
    handleSilentError(error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
