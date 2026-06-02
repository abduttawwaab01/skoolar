import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
    const querySchoolId = searchParams.get('schoolId') || '';
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');
    const includeProfiles = searchParams.get('includeProfiles') !== 'false'; // default true

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

    // Restrict PII to admin roles only
    const adminRoles = ['TEACHER', 'DIRECTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'];
    const isAdmin = adminRoles.includes(auth.role || '');

    const selectFields: Record<string, unknown> = {
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
    };

    // Only include sensitive PII for admin roles
    if (isAdmin) {
      selectFields.passportNumber = true;
      selectFields.dateOfBirth = true;
      selectFields.gender = true;
      selectFields.address = true;
      selectFields.nationality = true;
      selectFields.emergencyContact = true;
      selectFields.emergencyPhone = true;
      selectFields.bloodGroup = true;
      selectFields.maritalStatus = true;
      selectFields.nextOfKin = true;
      selectFields.nextOfKinPhone = true;
    }

    const [data, total] = await Promise.all([
       db.user.findMany({
         where,
         select: selectFields as Record<string, unknown>,
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
      const { name, email, password, role, schoolId, phone, avatar, passportNumber, dateOfBirth, gender, address, nationality, emergencyContact, emergencyPhone, bloodGroup, maritalStatus, nextOfKin, nextOfKinPhone, childIds } = body;

    // School Admins cannot create SUPER_ADMIN or SCHOOL_ADMIN roles
    if (userRole === 'SCHOOL_ADMIN') {
      if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN') {
        return NextResponse.json(
          { error: 'School Admins cannot create Super Admin or School Admin accounts.' },
          { status: 403 }
        );
      }
    }

    // For School Admin, force schoolId to their own school. SUPER_ADMIN may use the provided schoolId.
    const targetSchoolId = userRole === 'SUPER_ADMIN' ? (schoolId || currentUser.schoolId) : (currentUser.schoolId || null);

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

    // Password validation - minimum 6 characters
    if (password && password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const validRoles = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role.' },
        { status: 400 }
      );
    }

    // Check if email already exists (exclude soft-deleted users)
    const existingUser = await db.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Generate strong random password if not provided
    const generatedPassword = password || crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(generatedPassword, SALT_ROUNDS);

    // Validate school if provided
    if (schoolId) {
      const school = await db.school.findUnique({ where: { id: schoolId } });
      if (!school) {
        return NextResponse.json({ error: 'School not found.' }, { status: 404 });
      }
    }

    // Use transaction to ensure user + profile are created atomically
    const { user } = await db.$transaction(async (tx) => {
       const user = await tx.user.create({
         data: {
           name,
           email: email.toLowerCase(),
           password: hashedPassword,
           role,
           schoolId: targetSchoolId || null,
           phone: phone || null,
           avatar: avatar || null,
           passportNumber: passportNumber || null,
           dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
           gender: gender || null,
           address: address || null,
           nationality: nationality || null,
           emergencyContact: emergencyContact || null,
           emergencyPhone: emergencyPhone || null,
           bloodGroup: bloodGroup || null,
           maritalStatus: maritalStatus || null,
           nextOfKin: nextOfKin || null,
           nextOfKinPhone: nextOfKinPhone || null,
           isActive: true,
           emailVerified: new Date(),
         },
       });

      // Create role-specific profile if school is assigned
      if (targetSchoolId) {
        if (role === 'TEACHER') {
          await tx.teacher.create({
            data: {
              schoolId: targetSchoolId,
              userId: user.id,
              employeeNo: `TCH-${Date.now().toString(36).toUpperCase()}`,
            },
          });
        } else if (role === 'STUDENT') {
          await tx.student.create({
            data: {
              schoolId: targetSchoolId,
              userId: user.id,
              admissionNo: `STU-${Date.now().toString(36).toUpperCase()}`,
            },
          });
        } else if (role === 'PARENT') {
          const parent = await tx.parent.create({
            data: {
              schoolId: targetSchoolId,
              userId: user.id,
            },
          });
          // Link parent to selected students
          if (childIds && Array.isArray(childIds) && childIds.length > 0) {
            for (const studentId of childIds) {
              const student = await tx.student.findUnique({ where: { id: studentId } });
              if (student && student.schoolId === targetSchoolId) {
                await tx.studentParent.create({
                  data: {
                    studentId: student.id,
                    parentId: parent.id,
                  },
                }).catch(() => {
                  // Skip duplicates silently
                });
              }
            }
          }
        } else if (role === 'ACCOUNTANT') {
          await tx.accountant.create({
            data: {
              schoolId: targetSchoolId,
              userId: user.id,
              employeeNo: `ACC-${Date.now().toString(36).toUpperCase()}`,
            },
          });
        } else if (role === 'LIBRARIAN') {
          await tx.librarian.create({
            data: {
              schoolId: targetSchoolId,
              userId: user.id,
              employeeNo: `LIB-${Date.now().toString(36).toUpperCase()}`,
            },
          });
        } else if (role === 'DIRECTOR') {
          await tx.director.create({
            data: {
              schoolId: targetSchoolId,
              userId: user.id,
              employeeNo: `DIR-${Date.now().toString(36).toUpperCase()}`,
            },
          });
        }
      }

      return { user };
    });

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
