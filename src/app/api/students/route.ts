import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 'public, s-maxage=15, stale-while-revalidate=30';

// GET /api/students - List students with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const classId = searchParams.get('classId') || '';
    const search = searchParams.get('search') || '';
    const gender = searchParams.get('gender') || '';
    const isActive = searchParams.get('isActive');
    const include = searchParams.get('include') || '';

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    // School context validation - users can only access their own school
    const userSchoolId = auth.schoolId;
    if (userSchoolId) {
      where.schoolId = userSchoolId;
    } else if (schoolId) {
      where.schoolId = schoolId;
    }

    if (classId) where.classId = classId;
    if (gender) where.gender = gender;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { admissionNo: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }

    const selectFields: Record<string, unknown> = {
      id: true,
      schoolId: true,
      userId: true,
      admissionNo: true,
      classId: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      bloodGroup: true,
      allergies: true,
      emergencyContact: true,
      photo: true,
      house: true,
      isPromoted: true,
      gpa: true,
      cumulativeGpa: true,
      rank: true,
      behaviorScore: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          phone: true,
        },
      },
      class: {
        select: {
          id: true,
          name: true,
          section: true,
          grade: true,
        },
      },
      school: {
        select: {
          id: true,
          name: true,
        },
      },
    };

    const [data, total] = await Promise.all([
      db.student.findMany({
        where,
        select: selectFields,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.student.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }, {
      headers: {
        'Cache-Control': CACHE_CONTROL,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/students - Create student + create User record
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Only SCHOOL_ADMIN, TEACHER, and SUPER_ADMIN can create students
    if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const { schoolId, name, email, admissionNo, classId, parentIds, dateOfBirth, gender, address, bloodGroup, allergies, emergencyContact, photo, house } = body;

    // School context: use auth's schoolId if user is not SUPER_ADMIN
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!name || !email || !admissionNo) {
      return NextResponse.json(
        { error: 'name, email, and admissionNo are required' },
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

    // Check if admission number already exists in school
    const existingAdmission = await db.student.findFirst({
      where: { schoolId: targetSchoolId, admissionNo },
    });
    if (existingAdmission) {
      return NextResponse.json(
        { error: 'This admission number already exists in this school' },
        { status: 409 }
      );
    }

    // Check plan limits - enforce max students
    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      include: { subscriptionPlan: true },
    });
    
    if (school) {
      const maxStudents = school.subscriptionPlan?.maxStudents || school.maxStudents || 500;
      const currentStudentCount = await db.student.count({
        where: { schoolId: targetSchoolId, deletedAt: null },
      });
      
      if (currentStudentCount >= maxStudents) {
        return NextResponse.json(
          { error: `Your plan allows maximum ${maxStudents} students. Please upgrade your plan to add more.` },
          { status: 403 }
        );
      }
    }

    // Use transaction to ensure both User and Student are created atomically
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          role: 'student',
          schoolId: targetSchoolId,
          phone: body.phone || null,
          avatar: photo || null,
          isActive: true,
        },
      });

      const student = await tx.student.create({
        data: {
          schoolId: targetSchoolId,
          userId: user.id,
          admissionNo,
          classId: classId || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          address: address || null,
          bloodGroup: bloodGroup || null,
          allergies: allergies || null,
          emergencyContact: emergencyContact || null,
          photo: photo || null,
          house: house || null,
        },
      });

      // Link parents if parentIds provided
      if (parentIds && Array.isArray(parentIds)) {
        for (const pid of parentIds) {
          const parent = await tx.parent.findUnique({ where: { userId: pid } });
          if (parent) {
            await tx.studentParent.create({
              data: {
                studentId: student.id,
                parentId: parent.id,
              },
            });
          }
        }
      }

      return { user, student };
    });

    return NextResponse.json(
      { data: { ...result.student, user: result.user }, message: 'Student created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
