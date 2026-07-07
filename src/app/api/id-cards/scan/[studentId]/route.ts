import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { studentId } = await params;

    const body = await request.json().catch(() => ({}));
    const { cardUuid, validationToken, locationName, latitude, longitude, deviceInfo } = body;

    let targetStudentId = studentId;
    let cardRecord: any = null;

    if (cardUuid) {
      cardRecord = cardUuid
        ? await db.iDCard.findUnique({ where: { uuid: cardUuid } })
        : null;
      if (!cardRecord) {
        return NextResponse.json({ error: 'Invalid card' }, { status: 404 });
      }
      if (cardRecord.status !== 'active' || !cardRecord.isActive) {
        return NextResponse.json({ error: 'Card is not active' }, { status: 403 });
      }
      if (validationToken && cardRecord.validationToken !== validationToken) {
        return NextResponse.json({ error: 'Invalid card token' }, { status: 403 });
      }
      if (auth.role !== 'SUPER_ADMIN' && cardRecord.schoolId !== auth.schoolId) {
        return NextResponse.json({ error: 'Card does not belong to your school' }, { status: 403 });
      }
      targetStudentId = cardRecord.personId || studentId;
    }

    const studentRec = await db.student.findUnique({
      where: { id: targetStudentId },
      select: { classId: true, schoolId: true },
    });

    if (!studentRec) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && studentRec.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Student does not belong to your school' }, { status: 403 });
    }

    const activeTerm = await db.term.findFirst({
      where: {
        schoolId: auth.schoolId || '',
        isCurrent: true,
        ...(auth.role !== 'SUPER_ADMIN' ? {} : {}),
      },
      orderBy: { order: 'desc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await db.attendance.findFirst({
      where: {
        studentId: targetStudentId,
        schoolId: studentRec.schoolId,
        date: today,
        ...(activeTerm ? { termId: activeTerm.id } : {}),
      },
    });

    if (attendance) {
      return NextResponse.json({
        message: 'Attendance already recorded today',
        data: attendance,
        alreadyPresent: true,
      });
    }

    attendance = await db.attendance.create({
      data: {
        schoolId: auth.schoolId || cardRecord?.schoolId || '',
        studentId: targetStudentId,
        classId: studentRec?.classId || '',
        termId: activeTerm?.id || '',
        date: today,
        status: 'PRESENT',
      },
    });

    await db.attendanceScanLog.create({
      data: {
        schoolId: auth.schoolId || cardRecord?.schoolId || '',
        cardId: cardRecord?.id || null,
        studentId: targetStudentId,
        userId: auth.userId || null,
        personType: 'student',
        scanType: 'qr',
        action: 'attendance',
        locationName: locationName || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        deviceInfo: deviceInfo || null,
        status: 'success',
      },
    });

    if (cardRecord) {
      await db.iDCard.update({
        where: { id: cardRecord.id },
        data: { printCount: { increment: 1 }, lastPrinted: new Date() },
      });
    }

    return NextResponse.json({
      message: 'Attendance marked successfully',
      data: attendance,
      alreadyPresent: false,
    });
  } catch (error) {
    console.error('POST /api/id-cards/scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
