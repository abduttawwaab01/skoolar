import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/audit-logger';

// GET /api/subjects/[id] - Get single subject
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const subject = await db.subject.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true } },
        _count: {
          select: {
            classes: true,
            exams: true,
            homeworks: true,
          },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && subject.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (subject.deletedAt) {
      return NextResponse.json({ error: 'Subject has been deleted' }, { status: 410 });
    }

    return NextResponse.json({ data: subject });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/subjects/[id] - Update subject
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.subject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted subject' }, { status: 410 });
    }

    const { name, code, type, description } = body;

    const updated = await db.subject.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
      },
    });

    // Log the successful update
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'SUBJECT_UPDATE',
      entity: 'SUBJECT',
      entityId: id,
      details: JSON.stringify(body),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ data: updated, message: 'Subject updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/subjects/[id] - Soft delete subject
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            classes: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Subject already deleted' }, { status: 410 });
    }

    // Business rule: Check if assigned to classes
    if (existing._count.classes > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete subject that is assigned to classes. Please remove assignments first.' 
      }, { status: 400 });
    }

    // Perform soft delete
    await db.subject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Log the successful deletion
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'SUBJECT_DELETE',
      entity: 'SUBJECT',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ message: 'Subject deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
