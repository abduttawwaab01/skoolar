import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// GET /api/teachers - List teachers with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const querySchoolId = searchParams.get('schoolId') || '';
    const search = searchParams.get('search') || '';
    const subject = searchParams.get('subject') || '';
    const gender = searchParams.get('gender') || '';
    const isActive = searchParams.get('isActive');

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    if (targetSchoolId) where.schoolId = targetSchoolId;

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
      pageSize: limit,
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

    const { schoolId, name, email, password, employeeNo, specialization, qualification, dateOfJoining, gender, phone, address, photo, salary, classIds, subjectAssignments } = body;

    // School context: For non-SUPER_ADMIN, force use their own schoolId.
    // For SUPER_ADMIN, the provided schoolId (or auth's) is used.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || '');

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: 'name and email are required' },
        { status: 400 }
      );
    }

    // Check if email already exists (excluding soft-deleted)
    const existingUser = await db.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Auto-generate employeeNo if not provided (like /api/users does)
    const finalEmployeeNo = employeeNo || `TCH-${Date.now().toString(36).toUpperCase()}`;

    // Check if employee number already exists in school (excluding soft-deleted)
    const existingEmployee = await db.teacher.findFirst({
      where: { schoolId: targetSchoolId, employeeNo: finalEmployeeNo, deletedAt: null },
    });
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'This employee number already exists in this school' },
        { status: 409 }
      );
    }

    // Password validation - minimum 6 characters
    if (password && password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Hash password or generate default
    const hashedPassword = password
      ? await bcrypt.hash(password, SALT_ROUNDS)
      : await bcrypt.hash(`${email.toLowerCase()}2024`, SALT_ROUNDS);

    // Check plan limits - enforce max teachers
    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      include: { subscriptionPlan: true },
    });
    
    if (school) {
      const maxTeachers = school.subscriptionPlan?.maxTeachers || school.maxTeachers || 50;
      // If maxTeachers is -1, it means unlimited
      if (maxTeachers !== -1) {
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
    }

    // Validate classIds if provided
    if (classIds && Array.isArray(classIds) && classIds.length > 0) {
      const validClasses = await db.class.findMany({
        where: { id: { in: classIds }, schoolId: targetSchoolId },
        select: { id: true },
      });
      const validClassIds = new Set(validClasses.map(c => c.id));
      for (const cid of classIds) {
        if (!validClassIds.has(cid)) {
          return NextResponse.json({ error: `Class ${cid} not found or not in this school` }, { status: 400 });
        }
      }
    }

    // Validate subjectAssignments if provided
    if (subjectAssignments && Array.isArray(subjectAssignments) && subjectAssignments.length > 0) {
      for (const sa of subjectAssignments) {
        if (!sa.classId || !sa.subjectId) {
          return NextResponse.json({ error: 'Each subject assignment must have classId and subjectId' }, { status: 400 });
        }
        // Verify the class-subject combination exists
        const cs = await db.classSubject.findFirst({
          where: { classId: sa.classId, subjectId: sa.subjectId },
          select: { id: true },
        });
        if (!cs) {
          // Create the ClassSubject record if it doesn't exist (subject must be linked to class first)
          const classExists = await db.class.findFirst({ where: { id: sa.classId, schoolId: targetSchoolId } });
          const subjectExists = await db.subject.findFirst({ where: { id: sa.subjectId, schoolId: targetSchoolId } });
          if (!classExists) return NextResponse.json({ error: `Class ${sa.classId} not found` }, { status: 400 });
          if (!subjectExists) return NextResponse.json({ error: `Subject ${sa.subjectId} not found` }, { status: 400 });
        }
      }
    }

    // Use transaction to ensure User, Teacher, and assignments are created atomically
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          role: 'TEACHER',
          schoolId: targetSchoolId,
          phone: phone || null,
          avatar: photo || null,
          isActive: true,
          emailVerified: new Date(),
        },
      });

      const teacher = await tx.teacher.create({
        data: {
          schoolId: targetSchoolId,
          userId: user.id,
          employeeNo: finalEmployeeNo,
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

      // Assign teacher as class teacher for selected classes
      if (classIds && Array.isArray(classIds) && classIds.length > 0) {
        for (const cid of classIds) {
          await tx.class.update({
            where: { id: cid },
            data: { classTeacherId: teacher.id },
          });
        }
      }

      // Create subject assignments (ClassSubject records)
      if (subjectAssignments && Array.isArray(subjectAssignments) && subjectAssignments.length > 0) {
        for (const sa of subjectAssignments) {
          const existing = await tx.classSubject.findFirst({
            where: { classId: sa.classId, subjectId: sa.subjectId },
          });
          if (existing) {
            await tx.classSubject.update({
              where: { id: existing.id },
              data: { teacherId: teacher.id },
            });
          } else {
            await tx.classSubject.create({
              data: {
                classId: sa.classId,
                subjectId: sa.subjectId,
                teacherId: teacher.id,
              },
            });
          }
        }
      }

      return { user, teacher };
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
