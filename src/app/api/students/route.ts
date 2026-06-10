import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

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
    const querySchoolId = searchParams.get('schoolId') || '';
    const classId = searchParams.get('classId') || '';
    const search = searchParams.get('search') || '';
    const gender = searchParams.get('gender') || '';
    const isActive = searchParams.get('isActive');
    const include = searchParams.get('include') || '';

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

    // If user is TEACHER, restrict to their assigned classes (unless a specific classId is provided)
    if (auth.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        include: {
          classes: { select: { id: true } },
          classSubjects: { select: { classId: true } },
        },
      });

      if (!teacher) {
        return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });
      }

      if (!classId) {
        const teacherClassIds = new Set<string>();
        teacher.classes.forEach(c => teacherClassIds.add(c.id));
        teacher.classSubjects.forEach(cs => teacherClassIds.add(cs.classId));

        if (teacherClassIds.size === 0) {
          return NextResponse.json({
            data: [],
            total: 0,
            page,
            totalPages: 0,
            message: 'You have no assigned classes',
          });
        }

        where.classId = { in: Array.from(teacherClassIds) };
      }
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
      pageSize: limit,
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

    // Only SCHOOL_ADMIN and SUPER_ADMIN can create students
    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';

    if (action === 'bulk-upload') {
      return bulkUploadStudents(request, auth);
    }

    const body = await request.json();

    const { schoolId, name, email, password, admissionNo, classId, parentIds, dateOfBirth, gender, address, bloodGroup, allergies, emergencyContact, photo, house } = body;

    // School context: use auth's schoolId if user is not SUPER_ADMIN
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!name || !email || !admissionNo || !password) {
      return NextResponse.json(
        { error: 'name, email, admissionNo, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
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

    // Check if admission number already exists in school (excluding soft-deleted)
    const existingAdmission = await db.student.findFirst({
      where: { schoolId: targetSchoolId, admissionNo, deletedAt: null },
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
      if (maxStudents !== -1) {
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
    }

    // Use transaction to ensure both User and Student are created atomically
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          role: 'STUDENT',
          schoolId: targetSchoolId,
          phone: body.phone || null,
          avatar: photo || null,
          isActive: true,
          emailVerified: new Date(),
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

async function bulkUploadStudents(request: NextRequest, auth: any) {
  try {
    const body = await request.json();
    const { students, schoolId } = body;
    
    if (!students || !Array.isArray(students)) {
      return NextResponse.json({ error: 'Students list is required' }, { status: 400 });
    }

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School ID required' }, { status: 400 });

    // Build class name → ID map for resolving class names from CSV
    const allClasses = await db.class.findMany({
      where: { schoolId: targetSchoolId, deletedAt: null },
      select: { id: true, name: true },
    });
    const classNameToId: Record<string, string> = {};
    allClasses.forEach(c => { classNameToId[c.name.toLowerCase()] = c.id; });

    // Check plan limits before bulk creation
    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      include: { subscriptionPlan: true },
    });
    
    if (school) {
      const maxStudents = school.subscriptionPlan?.maxStudents || school.maxStudents || 500;
      if (maxStudents !== -1) {
        const currentCount = await db.student.count({
          where: { schoolId: targetSchoolId, deletedAt: null },
        });
        const totalAfterBulk = currentCount + students.filter((s: any) => s.name && s.email && s.admissionNo && s.password).length;
        if (totalAfterBulk > maxStudents) {
          const remaining = maxStudents - currentCount;
          return NextResponse.json(
            { error: `Your plan allows maximum ${maxStudents} students. You can only add ${remaining > 0 ? remaining : 0} more student(s). Please upgrade your plan.` },
            { status: 403 }
          );
        }
      }
    }

    const results = await db.$transaction(async (tx) => {
      const created: any[] = [];
      const skipped: any[] = [];
      
      for (const sData of students) {
        const { name, email, admissionNo, password, classId, gender } = sData;
        
        if (!name || !email || !admissionNo || !password) {
          skipped.push({ ...sData, error: 'Missing required fields' });
          continue;
        }

        // Resolve class name to ID if provided value isn't a UUID
        let resolvedClassId = classId || null;
        if (resolvedClassId && !resolvedClassId.includes('-') && classNameToId[resolvedClassId.toLowerCase()]) {
          resolvedClassId = classNameToId[resolvedClassId.toLowerCase()];
        }

        const existing = await tx.user.findFirst({
          where: { email: email.toLowerCase(), deletedAt: null },
        });
        if (existing) {
          skipped.push({ ...sData, error: 'Email already exists' });
          continue;
        }

        const existingAdm = await tx.student.findFirst({
          where: { schoolId: targetSchoolId, admissionNo, deletedAt: null },
        });
        if (existingAdm) {
          skipped.push({ ...sData, error: 'Admission No already exists' });
          continue;
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await tx.user.create({
          data: {
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'STUDENT',
            schoolId: targetSchoolId,
            isActive: true,
            emailVerified: new Date(),
          },
        });

        const student = await tx.student.create({
          data: {
            schoolId: targetSchoolId,
            userId: user.id,
            admissionNo,
            classId: resolvedClassId,
            gender: gender || null,
          },
        });
        
        created.push({ ...student, user });
      }
      
      return { created, skipped };
    });

    return NextResponse.json({ 
      data: results, 
      message: `Successfully added ${results.created.length} students. ${results.skipped.length} skipped.` 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
