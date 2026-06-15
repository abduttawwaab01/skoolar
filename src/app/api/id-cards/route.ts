import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/id-cards - List people or cards for ID card generation
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'student';
    const querySchoolId = searchParams.get('schoolId') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');

    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;
    const action = searchParams.get('action') || '';

    // List generated ID cards
    if (action === 'list-cards') {
      const personType = searchParams.get('personType') || '';
      const where: any = { schoolId: targetSchoolId };
      if (personType) where.personType = personType;

      const [cards, total] = await Promise.all([
        db.iDCard.findMany({
          where,
          include: { design: { select: { name: true, primaryColor: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.iDCard.count({ where }),
      ]);
      return NextResponse.json({ data: cards, total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    // List people (students or staff) for card generation
    const where: Record<string, unknown> = {
      schoolId: targetSchoolId,
      deletedAt: null,
    };

    if (type === 'student') {
      const [students, total] = await Promise.all([
        db.student.findMany({
          where,
          include: {
            user: { select: { name: true, email: true, avatar: true } },
            class: { select: { name: true, section: true } },
          },
          orderBy: { admissionNo: 'asc' },
          skip,
          take: limit,
        }),
        db.student.count({ where }),
      ]);
      return NextResponse.json({ data: students, type: 'student', total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    // Staff (including teachers)
    const staffWhere: any = {
      schoolId: targetSchoolId,
      deletedAt: null,
      role: { notIn: ['STUDENT', 'PARENT'] },
    };
    if (type === 'teacher') {
      staffWhere.role = 'TEACHER';
    } else if (type === 'staff') {
      staffWhere.role = { in: ['SCHOOL_ADMIN', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'] };
    }

    const [staff, total] = await Promise.all([
      db.user.findMany({
        where: staffWhere,
        include: {
          teacherProfile: true,
          accountantProfile: true,
          librarianProfile: true,
          directorProfile: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      db.user.count({ where: staffWhere }),
    ]);

    const staffWithIds = staff.map((u) => {
      let employeeNo = `USR-${u.id.slice(0, 6)}`;
      if (u.teacherProfile?.employeeNo) employeeNo = u.teacherProfile.employeeNo;
      else if (u.accountantProfile?.employeeNo) employeeNo = u.accountantProfile.employeeNo;
      else if (u.librarianProfile?.employeeNo) employeeNo = u.librarianProfile.employeeNo;
      else if (u.directorProfile?.employeeNo) employeeNo = u.directorProfile.employeeNo;
      else if (u.role === 'SCHOOL_ADMIN') employeeNo = `ADMIN-${u.id.slice(0, 6)}`;

      return {
        id: u.id,
        userId: u.id,
        name: u.name,
        email: u.email,
        employeeNo,
        role: u.role,
        phone: u.phone,
        photo: u.avatar,
        bloodGroup: u.bloodGroup,
        department: u.teacherProfile?.specialization || '',
        gender: u.gender,
        dateOfBirth: u.dateOfBirth?.toISOString().split('T')[0] || '',
        schoolId: u.schoolId,
      };
    });

    return NextResponse.json({ data: staffWithIds, type: type || 'staff', total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
