import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/audit-logger';

// GET /api/teachers - List teachers with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const search = searchParams.get('search') || '';
    const subject = searchParams.get('subject') || '';
    const gender = searchParams.get('gender') || '';
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    // School context validation - users can only access their own school
    const userSchoolId = auth.schoolId;
    if (userSchoolId) {
      where.schoolId = userSchoolId;
    } else if (schoolId) {
      where.schoolId = schoolId;
    }

    if (gender) where.gender = gender;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { employeeNo: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { specialization: { contains: search } },
      ];
    }

    // If filtering by subject, we need to find teachers assigned to that subject
    if (subject) {
      const classSubjectRecords = await db.classSubject.findMany({
        where: {
          subjectId: subject,
        },
        select: { teacherId: true },
      });
      const teacherIds = classSubjectRecords.map((cs) => cs.teacherId).filter(Boolean);
      where.id = { in: teacherIds };
    }

    const [data, total] = await Promise.all([
      db.teacher.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          employeeNo: true,
          specialization: true,
          qualification: true,
          dateOfJoining: true,
          gender: true,
          phone: true,
          photo: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          school: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              classes: true,
              classSubjects: true,
              exams: true,
              comments: true,
            },
          },
        },
      }),
      db.teacher.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/teachers - Create teacher + create User record
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Only SCHOOL_ADMIN and SUPER_ADMIN can create teachers
    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const { schoolId, name, email, employeeNo, specialization, qualification, dateOfJoining, gender, phone, address, photo, salary } = body;

    // School context: use auth's schoolId if user is not SUPER_ADMIN
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!name || !email || !employeeNo) {
      return NextResponse.json(
        { error: 'name, email, and employeeNo are required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Check if employee number already exists in school
    const existingEmployee = await db.teacher.findFirst({
      where: { schoolId: targetSchoolId, employeeNo },
    });
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'This employee number already exists in this school' },
        { status: 409 }
      );
    }

    // Check plan limits - enforce max teachers
    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      include: { subscriptionPlan: true },
    });
    
    if (school) {
      const maxTeachers = school.subscriptionPlan?.maxTeachers || school.maxTeachers || 50;
      const currentTeacherCount = await db.teacher.count({
        where: { schoolId: targetSchoolId, deletedAt: null },
      });
      
      if (currentTeacherCount >= maxTeachers) {
        return NextResponse.json(
          { error: `Your plan allows maximum ${maxTeachers} teachers. Please upgrade your plan to add more.` },
          { status: 403 }
        );
      }
    }

    // Use transaction to ensure both User and Teacher are created atomically
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          role: 'teacher',
          schoolId: targetSchoolId,
          phone: phone || null,
          avatar: photo || null,
          isActive: true,
        },
      });

      const teacher = await tx.teacher.create({
        data: {
          schoolId: targetSchoolId,
          userId: user.id,
          employeeNo,
          specialization: specialization || null,
          qualification: qualification || null,
          dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
          gender: gender || null,
          phone: phone || null,
          address: address || null,
          photo: photo || null,
          salary: salary || null,
        },
      });

      return { user, teacher };
    });

    // Log the successful creation
    createAuditLogEntry({
      schoolId: targetSchoolId,
      userId: auth.userId,
      action: 'TEACHER_CREATE',
      entity: 'TEACHER',
      entityId: result.teacher.id,
      details: JSON.stringify({ name, email, employeeNo }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(
      { data: { ...result.teacher, user: result.user }, message: 'Teacher created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
