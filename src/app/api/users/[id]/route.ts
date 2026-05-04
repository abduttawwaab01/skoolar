import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/users/[id] - Get single user with role profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
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
        deletedAt: true,
        school: {
          select: { id: true, name: true, slug: true, logo: true },
        },
        studentProfile: {
          select: {
            id: true,
            admissionNo: true,
            classId: true,
            gpa: true,
            cumulativeGpa: true,
            rank: true,
            behaviorScore: true,
            isActive: true,
            class: { select: { id: true, name: true, section: true, grade: true } },
          },
        },
        teacherProfile: {
          select: {
            id: true,
            employeeNo: true,
            specialization: true,
            qualification: true,
            gender: true,
            salary: true,
            isActive: true,
            dateOfJoining: true,
            classes: {
              select: { id: true, name: true, section: true, grade: true },
            },
            classSubjects: {
              include: {
                subject: { select: { id: true, name: true, code: true } },
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
        parentProfile: {
          select: {
            id: true,
            occupation: true,
            phone: true,
            address: true,
            parentStudents: {
              include: {
                student: {
                  select: {
                    id: true,
                    admissionNo: true,
                    user: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        accountantProfile: {
          select: { id: true, employeeNo: true },
        },
        librarianProfile: {
          select: { id: true, employeeNo: true },
        },
        directorProfile: {
          select: { id: true, employeeNo: true },
        },
        _count: {
          select: {
            notifications: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.deletedAt) {
      return NextResponse.json({ error: 'User has been deleted' }, { status: 410 });
    }

    return NextResponse.json({ data: user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted user' }, { status: 410 });
    }

    const { name, email, phone, avatar, role, schoolId, isActive, password } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (role !== undefined) updateData.role = role;
    if (schoolId !== undefined) updateData.schoolId = schoolId;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Handle email update with uniqueness check
    if (email && email !== existing.email) {
      const emailExists = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
      updateData.email = email.toLowerCase();
    }

    // Handle password update
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
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
        updatedAt: true,
        school: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: user, message: 'User updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Soft delete user (set deletedAt)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'User already deleted' }, { status: 410 });
    }

    // Soft delete user
    await db.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // Also soft delete the role-specific profile if it exists
    const profileTables = [
      { find: () => db.student.findFirst({ where: { userId: id } }), update: (profileId: string) => db.student.update({ where: { id: profileId }, data: { deletedAt: new Date(), isActive: false } }) },
      { find: () => db.teacher.findFirst({ where: { userId: id } }), update: (profileId: string) => db.teacher.update({ where: { id: profileId }, data: { deletedAt: new Date(), isActive: false } }) },
    ];

    for (const table of profileTables) {
      const profile = await table.find();
      if (profile) {
        await table.update(profile.id);
      }
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
