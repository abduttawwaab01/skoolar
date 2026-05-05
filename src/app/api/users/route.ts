import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRole } from '@/lib/auth-middleware';

const SALT_ROUNDS = 10;

// GET /api/users - List users with optional role/schoolId filters, includes role profiles
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const role = searchParams.get('role') || '';
    const schoolId = searchParams.get('schoolId') || '';
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');
    const includeProfiles = searchParams.get('includeProfiles') !== 'false'; // default true

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    // School context validation
    const userSchoolId = auth.schoolId;
    if (userSchoolId) {
      where.schoolId = userSchoolId;
    } else if (schoolId) {
      where.schoolId = schoolId;
    }

    if (role) where.role = role;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const include: Record<string, unknown> = {
      school: {
        select: { id: true, name: true, slug: true, logo: true },
      },
    };

    if (includeProfiles) {
      include.studentProfile = {
        select: {
          id: true,
          admissionNo: true,
          classId: true,
          gpa: true,
          class: { select: { id: true, name: true, section: true, grade: true } },
        },
      };
      include.teacherProfile = {
        select: {
          id: true,
          employeeNo: true,
          specialization: true,
          qualification: true,
          isActive: true,
          classes: {
            select: { id: true, name: true, section: true },
          },
        },
      };
      include.parentProfile = {
        select: {
          id: true,
          occupation: true,
          phone: true,
        },
      };
      include.accountantProfile = {
        select: { id: true, employeeNo: true },
      };
      include.librarianProfile = {
        select: { id: true, employeeNo: true },
      };
      include.directorProfile = {
        select: { id: true, employeeNo: true },
      };
      include._count = {
        select: {
          notifications: true,
          auditLogs: true,
        },
      };
    }

    const [data, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          phone: true,
          role: true,
          schoolId: true,
          isActive: true,
          lastLogin: true,
          loginCount: true,
          createdAt: true,
          updatedAt: true,
          ...include,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.user.count({ where }),
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

// POST /api/users - Create a new user with role profile
export async function POST(request: NextRequest) {
  const authResult = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
  if (authResult instanceof NextResponse) return authResult;
  const currentUser = authResult as unknown as { role?: string; schoolId?: string | null };
  const userRole = currentUser.role;

  try {
    const body = await request.json();
    const { name, email, password, role, schoolId, phone, avatar } = body;

    // School Admins cannot create SUPER_ADMIN or SCHOOL_ADMIN roles
    if (userRole === 'SCHOOL_ADMIN') {
      if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN') {
        return NextResponse.json(
          { error: 'School Admins cannot create Super Admin or School Admin accounts.' },
          { status: 403 }
        );
      }
    }

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, email, and role are required.' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format.' },
        { status: 400 }
      );
    }

    // Password validation - require minimum 8 chars, uppercase, lowercase, and number
    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters.' },
          { status: 400 }
        );
      }
      if (!/[A-Z]/.test(password)) {
        return NextResponse.json(
          { error: 'Password must contain at least one uppercase letter.' },
          { status: 400 }
        );
      }
      if (!/[a-z]/.test(password)) {
        return NextResponse.json(
          { error: 'Password must contain at least one lowercase letter.' },
          { status: 400 }
        );
      }
      if (!/[0-9]/.test(password)) {
        return NextResponse.json(
          { error: 'Password must contain at least one number.' },
          { status: 400 }
        );
      }
    }

    const validRoles = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role.' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Hash password if provided
    const hashedPassword = password
      ? await bcrypt.hash(password, SALT_ROUNDS)
      : await bcrypt.hash('password123', SALT_ROUNDS);

    // Validate school if provided
    if (schoolId) {
      const school = await db.school.findUnique({ where: { id: schoolId } });
      if (!school) {
        return NextResponse.json({ error: 'School not found.' }, { status: 404 });
      }
    }

    // Create user
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        schoolId: schoolId || null,
        phone: phone || null,
        avatar: avatar || null,
        isActive: true,
      },
    });

    // Create role-specific profile if school is assigned
    if (schoolId) {
      if (role === 'TEACHER') {
        await db.teacher.create({
          data: {
            schoolId,
            userId: user.id,
            employeeNo: `TCH-${Date.now().toString(36).toUpperCase()}`,
          },
        });
      } else if (role === 'STUDENT') {
        await db.student.create({
          data: {
            schoolId,
            userId: user.id,
            admissionNo: `STU-${Date.now().toString(36).toUpperCase()}`,
          },
        });
      } else if (role === 'PARENT') {
        await db.parent.create({
          data: {
            schoolId,
            userId: user.id,
          },
        });
      } else if (role === 'ACCOUNTANT') {
        await db.accountant.create({
          data: {
            schoolId,
            userId: user.id,
            employeeNo: `ACC-${Date.now().toString(36).toUpperCase()}`,
          },
        });
      } else if (role === 'LIBRARIAN') {
        await db.librarian.create({
          data: {
            schoolId,
            userId: user.id,
            employeeNo: `LIB-${Date.now().toString(36).toUpperCase()}`,
          },
        });
      } else if (role === 'DIRECTOR') {
        await db.director.create({
          data: {
            schoolId,
            userId: user.id,
            employeeNo: `DIR-${Date.now().toString(36).toUpperCase()}`,
          },
        });
      }
    }

    // Fetch the created user with profile
    const createdUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        role: true,
        schoolId: true,
        isActive: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        studentProfile: { select: { id: true, admissionNo: true } },
        teacherProfile: { select: { id: true, employeeNo: true, specialization: true } },
        parentProfile: { select: { id: true, occupation: true } },
        accountantProfile: { select: { id: true, employeeNo: true } },
        librarianProfile: { select: { id: true, employeeNo: true } },
        directorProfile: { select: { id: true, employeeNo: true } },
      },
    });

    return NextResponse.json(
      { data: createdUser, message: 'User created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
