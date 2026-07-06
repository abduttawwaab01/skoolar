import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/teachers/[id] - Get single teacher
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const teacher = await db.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            phone: true,
            role: true,
            isActive: true,
            lastLogin: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
        classes: {
          select: {
            id: true,
            name: true,
            section: true,
            grade: true,
            _count: { select: { students: true } },
          },
        },
        classSubjects: {
          include: {
            subject: {
              select: { id: true, name: true, code: true },
            },
            class: {
              select: { id: true, name: true, section: true },
            },
          },
        },
        exams: {
          select: {
            id: true,
            name: true,
            type: true,
            date: true,
            subject: { select: { name: true } },
            class: { select: { name: true } },
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        comments: {
          select: {
            id: true,
            category: true,
            comment: true,
            student: { select: { user: { select: { name: true } } } },
            createdAt: true,
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    if (teacher.deletedAt) {
      return NextResponse.json({ error: 'Teacher has been deleted' }, { status: 410 });
    }

    return NextResponse.json({ data: teacher });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/teachers/[id] - Update teacher
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted teacher' }, { status: 410 });
    }

    // SECURITY: Verify user belongs to the same school
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId !== existing.schoolId) {
      return NextResponse.json({ error: 'You can only manage teachers from your own school' }, { status: 403 });
    }

    // Update User record if name or email provided
    if (body.name || body.email) {
      const userData: Record<string, unknown> = {};
      if (body.name) userData.name = body.name;
      if (body.email) userData.email = body.email;
      if (body.phone !== undefined) userData.phone = body.phone;

      try {
        await db.user.update({
          where: { id: existing.userId },
          data: userData,
        });
      } catch {
        return NextResponse.json({ error: 'Failed to update user record (email may already exist)' }, { status: 409 });
      }
    }

    const { employeeNo, specialization, qualification, dateOfJoining, gender, phone, address, photo, salary, isActive, classIds, subjectAssignments } = body;

    // Check employeeNo uniqueness if changing
    if (employeeNo !== undefined && employeeNo !== existing.employeeNo) {
      const dup = await db.teacher.findFirst({
        where: { schoolId: existing.schoolId, employeeNo, deletedAt: null, id: { not: id } },
      });
      if (dup) {
        return NextResponse.json({ error: 'Employee number already exists in this school' }, { status: 409 });
      }
    }

    const teacher = await db.teacher.update({
      where: { id },
      data: {
        ...(employeeNo !== undefined && { employeeNo }),
        ...(specialization !== undefined && { specialization }),
        ...(qualification !== undefined && { qualification }),
        ...(dateOfJoining !== undefined && { dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null }),
        ...(gender !== undefined && { gender }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(photo !== undefined && { photo }),
        ...(salary !== undefined && { salary }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, phone: true },
        },
      },
    });

    if (photo !== undefined) {
      await db.user.update({ where: { id: existing.userId }, data: { avatar: photo } });
    }

    // Update class teacher assignments (replace all)
    if (classIds !== undefined && Array.isArray(classIds)) {
      // Remove teacher from all classes they were the class teacher of
      await db.class.updateMany({
        where: { classTeacherId: id },
        data: { classTeacherId: null },
      });
      // Assign to new classes
      for (const cid of classIds) {
        await db.class.update({
          where: { id: cid },
          data: { classTeacherId: id },
        });
      }
    }

    // Update subject assignments (replace all)
    if (subjectAssignments !== undefined && Array.isArray(subjectAssignments)) {
      // Remove teacher from all subject assignments
      await db.classSubject.updateMany({
        where: { teacherId: id },
        data: { teacherId: null },
      });
      // Assign to new subject+class combos
      for (const sa of subjectAssignments) {
        const existingCs = await db.classSubject.findFirst({
          where: { classId: sa.classId, subjectId: sa.subjectId },
        });
        if (existingCs) {
          await db.classSubject.update({
            where: { id: existingCs.id },
            data: { teacherId: id },
          });
        } else {
          await db.classSubject.create({
            data: {
              classId: sa.classId,
              subjectId: sa.subjectId,
              teacherId: id,
            },
          });
        }
      }
    }

    return NextResponse.json({ data: teacher, message: 'Teacher updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/teachers/[id] - Soft delete teacher
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Teacher already deleted' }, { status: 410 });
    }

    // SECURITY: Verify user belongs to the same school
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId !== existing.schoolId) {
      return NextResponse.json({ error: 'You can only delete teachers from your own school' }, { status: 403 });
    }

    const user = await db.user.findUnique({ where: { id: existing.userId } });

    await Promise.all([
      db.teacher.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      db.user.update({
        where: { id: existing.userId },
        data: {
          email: user ? `deleted_${existing.userId}_${user.email}` : undefined,
          deletedAt: new Date(),
          isActive: false,
        },
      }),
    ]);

    return NextResponse.json({ message: 'Teacher deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
