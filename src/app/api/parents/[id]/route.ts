import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/audit-logger';

// GET /api/parents/[id] - Get single parent with children
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const parent = await db.parent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, avatar: true, isActive: true } },
        school: { select: { id: true, name: true } },
      },
    });

    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && parent.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (parent.deletedAt) {
      return NextResponse.json({ error: 'Parent has been deleted' }, { status: 410 });
    }

    // Get children data
    const childrenIds = parent.childrenIds ? parent.childrenIds.split(',').filter(Boolean) : [];
    const children = await db.student.findMany({
      where: { id: { in: childrenIds }, deletedAt: null },
      include: { 
        user: { select: { name: true, avatar: true } },
        class: { select: { name: true, section: true } }
      }
    });

    return NextResponse.json({ data: { ...parent, children } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/parents/[id] - Update parent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.parent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted parent' }, { status: 410 });
    }

    const { occupation, phone, address, childrenIds, name, email } = body;

    // Update User record if name or email provided
    if (name || email) {
      await db.user.update({
        where: { id: existing.userId },
        data: {
          ...(name && { name }),
          ...(email && { email: email.toLowerCase() }),
        },
      });
    }

    const updated = await db.parent.update({
      where: { id },
      data: {
        ...(occupation !== undefined && { occupation }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(childrenIds !== undefined && { childrenIds }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } }
      }
    });

    // Log the successful update
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'PARENT_UPDATE',
      entity: 'PARENT',
      entityId: id,
      details: JSON.stringify(body),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ data: updated, message: 'Parent updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/parents/[id] - Soft delete parent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.parent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Parent already deleted' }, { status: 410 });
    }

    // Perform soft delete on parent and user
    await Promise.all([
      db.parent.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      db.user.update({
        where: { id: existing.userId },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);

    // Log the successful deletion
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'PARENT_DELETE',
      entity: 'PARENT',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ message: 'Parent deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
