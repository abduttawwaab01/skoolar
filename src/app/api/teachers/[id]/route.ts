import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';

const AUTHORIZED_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'DIRECTOR', 'PARENT'];

// GET /api/teachers/[id] - Get single teacher
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
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

    const isOwnRecord = auth.userId === teacher.userId;
    if (!AUTHORIZED_ROLES.includes(auth.role || '') && !isOwnRecord) {
      return NextResponse.json({ error: 'You do not have permission to view this teacher' }, { status: 403 });
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
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const isStaff = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '');
    if (!isStaff) {
      return NextResponse.json({ error: 'Only administrators can update teacher records' }, { status: 403 });
    }
    
    const { id } = await params;
    const body = await request.json();

    const existing = await db.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted teacher' }, { status: 410 });
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

    const { specialization, qualification, dateOfJoining, gender, phone, address, photo, salary, isActive } = body;

    const teacher = await db.teacher.update({
      where: { id },
      data: {
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
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const isStaff = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '');
    if (!isStaff) {
      return NextResponse.json({ error: 'Only administrators can delete teacher records' }, { status: 403 });
    }
    
    const { id } = await params;

    const existing = await db.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Teacher already deleted' }, { status: 410 });
    }

    await Promise.all([
      db.teacher.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      db.user.update({
        where: { id: existing.userId },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);

    return NextResponse.json({ message: 'Teacher deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
