import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/id-cards/scan - Process QR code scan for attendance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      uuid,
      cardId,
      action = 'attendance',
      latitude,
      longitude,
      locationName,
      deviceInfo,
      ipAddress,
    } = body;

    if (!uuid && !cardId) {
      return NextResponse.json({ error: 'Card UUID or ID required' }, { status: 400 });
    }

    // Find card by UUID or ID
    const card = await db.iDCard.findFirst({
      where: {
        OR: [
          { uuid: uuid || '' },
          { id: cardId || '' },
        ],
      },
      include: {
        school: { select: { name: true } },
      },
    });

    if (!card) {
      return NextResponse.json({ valid: false, status: 'not_found', message: 'ID card not found' }, { status: 404 });
    }

    // Check card status
    if (card.status === 'suspended') {
      return NextResponse.json({ valid: false, status: 'suspended', message: 'This ID card has been suspended' }, { status: 403 });
    }

    if (card.status === 'replaced') {
      return NextResponse.json({ valid: false, status: 'replaced', message: 'This ID card has been replaced' }, { status: 403 });
    }

    // Log the scan
    const scanLog = await db.attendanceScanLog.create({
      data: {
        schoolId: card.schoolId,
        cardId: card.id,
        studentId: card.personType === 'student' ? card.personId : null,
        userId: card.userId,
        personType: card.personType,
        personId: card.personId,
        scanType: 'qr',
        action,
        latitude: latitude || null,
        longitude: longitude || null,
        locationName: locationName || null,
        deviceInfo: deviceInfo || null,
        ipAddress: ipAddress || null,
        status: 'success',
        message: `${action} recorded for ${card.fullName}`,
      },
    });

    // Create attendance record for students
    if (card.personType === 'student' && (action === 'arrival' || action === 'departure' || action === 'attendance')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Look up active term and student's class
      const [activeTerm, studentRecord] = await Promise.all([
        db.term.findFirst({ where: { schoolId: card.schoolId, isCurrent: true }, orderBy: { createdAt: 'desc' } }),
        db.student.findUnique({ where: { id: card.personId }, select: { classId: true } }),
      ]);

      if (action === 'arrival' || action === 'attendance') {
        await db.attendance.upsert({
          where: {
            schoolId_studentId_date: {
              schoolId: card.schoolId,
              studentId: card.personId,
              date: today,
            },
          },
          update: {
            status: 'PRESENT',
            updatedAt: new Date(),
          },
          create: {
            schoolId: card.schoolId,
            studentId: card.personId,
            date: today,
            status: 'PRESENT',
            termId: activeTerm?.id || '',
            classId: studentRecord?.classId || '',
          },
        });
      }
    }

    // Create staff attendance record
    if ((card.personType === 'teacher' || card.personType === 'staff') && (action === 'check_in' || action === 'check_out') && card.userId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

      if (action === 'check_in') {
        await db.staffAttendance.upsert({
          where: {
            schoolId_userId_date: {
              schoolId: card.schoolId,
              userId: card.userId,
              date: today,
            },
          },
          update: {
            checkInTime: now,
            status: 'present',
            method: 'qr_scan',
            updatedAt: new Date(),
          },
          create: {
            schoolId: card.schoolId,
            userId: card.userId,
            date: today,
            status: 'present',
            checkInTime: now,
            method: 'qr_scan',
          },
        });
      } else if (action === 'check_out') {
        await db.staffAttendance.upsert({
          where: {
            schoolId_userId_date: {
              schoolId: card.schoolId,
              userId: card.userId,
              date: today,
            },
          },
          update: {
            checkOutTime: now,
            updatedAt: new Date(),
          },
          create: {
            schoolId: card.schoolId,
            userId: card.userId,
            date: today,
            status: 'present',
            checkOutTime: now,
            method: 'qr_scan',
          },
        });
      }
    }

    return NextResponse.json({
      valid: true,
      status: 'success',
      message: `${action} recorded for ${card.fullName}`,
      person: {
        name: card.fullName,
        type: card.personType,
        school: card.school?.name,
      },
      scanId: scanLog.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/id-cards/scan?uuid=xxx - Quick scan verification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json({ error: 'UUID required' }, { status: 400 });
    }

    const card = await db.iDCard.findUnique({
      where: { uuid },
      select: {
        id: true,
        uuid: true,
        fullName: true,
        displayId: true,
        personType: true,
        status: true,
        schoolId: true,
      },
    });

    if (!card) {
      return NextResponse.json({ valid: false, status: 'not_found', message: 'Card not found' }, { status: 404 });
    }

    const school = await db.school.findUnique({
      where: { id: card.schoolId },
      select: { name: true },
    });

    return NextResponse.json({
      valid: card.status === 'active',
      status: card.status,
      message: card.status === 'active' ? 'Valid ID card' : `Card is ${card.status}`,
      person: {
        name: card.fullName,
        id: card.displayId,
        type: card.personType,
        school: school?.name,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
