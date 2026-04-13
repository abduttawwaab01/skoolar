import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/audit-logger';

// GET /api/classes/[id] - Get single class
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const classData = await db.class.findUnique({
      where: { id },
      include: {
        school: {
          select: { id: true, name: true },
        },
        classTeacher: {
          select: {
            id: true,
            user: { select: { name: true, email: true, avatar: true } },
          },
        },
        _count: {
          select: {
            students: {
              where: { deletedAt: null, isActive: true },
            },
            subjects: true,
            exams: true,
          },
        },
      },
    });

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && classData.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (classData.deletedAt) {
      return NextResponse.json({ error: 'Class has been deleted' }, { status: 410 });
    }

    return NextResponse.json({ data: classData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/classes/[id] - Update class
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.class.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted class' }, { status: 410 });
    }

    const { name, section, grade, capacity, classTeacherId } = body;

    const updatedClass = await db.class.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(section !== undefined && { section }),
        ...(grade !== undefined && { grade }),
        ...(capacity !== undefined && { capacity }),
        ...(classTeacherId !== undefined && { classTeacherId }),
      },
    });

    // Log the successful update
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'CLASS_UPDATE',
      entity: 'CLASS',
      entityId: id,
      details: JSON.stringify(body),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ data: updatedClass, message: 'Class updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/classes/[id] - Soft delete class
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: {
              where: { deletedAt: null, isActive: true },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Class already deleted' }, { status: 410 });
    }

    // Business rule: Cannot delete class with active students
    if (existing._count.students > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete class with active students. Please reassign students first.' 
      }, { status: 400 });
    }

    // Perform soft delete
    await db.class.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Log the successful deletion
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'CLASS_DELETE',
      entity: 'CLASS',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ message: 'Class deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
