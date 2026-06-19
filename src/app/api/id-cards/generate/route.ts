import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(auth.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, classId, studentIds, teacherIds, personType, designId } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId
      ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const activeTerm = await db.term.findFirst({
      where: { schoolId: targetSchoolId, isCurrent: true },
      orderBy: { order: 'desc' },
    });
    const session = activeTerm?.academicYearId || '';

    const created: Array<unknown> = [];

    if (personType === 'teacher' && teacherIds?.length) {
      const teachers = await db.teacher.findMany({
        where: { id: { in: teacherIds }, schoolId: targetSchoolId, isActive: true },
        include: { user: { select: { name: true, phone: true, email: true } } },
      });

      for (const teacher of teachers) {
        const uuid = crypto.randomUUID();
        const token = crypto.randomUUID();
        const card = await db.iDCard.create({
          data: {
            schoolId: targetSchoolId, designId: designId || null,
            personType: 'teacher', personId: teacher.id, userId: teacher.userId,
            fullName: teacher.user.name || '', displayId: teacher.employeeNo || '',
            role: 'TEACHER', department: teacher.specialization || null,
            phone: teacher.user.phone || null, email: teacher.user.email || null,
            uuid, validationToken: token,
            qrCodeData: `skoolar://attendance/scan/${uuid}?token=${token}`,
            issueDate: new Date(), status: 'active',
          },
        });
        created.push(card);
      }
    } else {
      const students = await db.student.findMany({
        where: {
          schoolId: targetSchoolId,
          ...(classId ? { classId } : {}),
          ...(studentIds?.length ? { id: { in: studentIds } } : {}),
          isActive: true,
        },
        include: {
          user: { select: { name: true, phone: true, email: true } },
          class: { select: { id: true, name: true, section: true } },
        },
      });

      for (const student of students) {
        const uuid = crypto.randomUUID();
        const validationToken = crypto.randomUUID();
        const qrCodeData = `skoolar://attendance/scan/${uuid}?token=${validationToken}`;

        const card = await db.iDCard.create({
          data: {
            schoolId: targetSchoolId,
            designId: designId || null,
            personType: 'student',
            personId: student.id,
            userId: student.userId,
            fullName: student.user.name || '',
            displayId: student.admissionNo || '',
            className: student.class?.name || null,
            section: student.class?.section || null,
            gender: student.gender || null,
            dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0] || null,
            bloodGroup: student.bloodGroup || null,
            phone: student.user.phone || null,
            email: student.user.email || null,
            address: student.address || null,
            house: student.house || null,
            academicSession: session || null,
            uuid,
            validationToken,
            status: 'active',
            qrCodeData,
            issueDate: new Date(),
          },
        });
        created.push(card);
      }
    }

    return NextResponse.json({ data: created, count: created.length }, { status: 201 });
  } catch (error) {
    console.error('POST /api/id-cards/generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
