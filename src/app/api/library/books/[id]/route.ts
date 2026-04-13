import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/audit-logger';

// GET /api/library/books/[id] - Get single book
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const book = await db.libraryBook.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true } },
        borrowRecords: {
          where: { status: 'borrowed' },
          include: {
            student: {
              include: { user: { select: { name: true } } }
            }
          }
        }
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && book.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (book.deletedAt) {
      return NextResponse.json({ error: 'Book has been deleted' }, { status: 410 });
    }

    return NextResponse.json({ data: book });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/library/books/[id] - Update book
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'LIBRARIAN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.libraryBook.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Cannot update a deleted book' }, { status: 410 });
    }

    const { title, author, isbn, category, publisher, year, totalCopies, availableCopies, location, barcode, coverImage, description } = body;

    const updated = await db.libraryBook.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(author !== undefined && { author }),
        ...(isbn !== undefined && { isbn }),
        ...(category !== undefined && { category }),
        ...(publisher !== undefined && { publisher }),
        ...(year !== undefined && { year }),
        ...(totalCopies !== undefined && { totalCopies }),
        ...(availableCopies !== undefined && { availableCopies }),
        ...(location !== undefined && { location }),
        ...(barcode !== undefined && { barcode }),
        ...(coverImage !== undefined && { coverImage }),
        ...(description !== undefined && { description }),
      },
    });

    // Log the successful update
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'BOOK_UPDATE',
      entity: 'LIBRARY_BOOK',
      entityId: id,
      details: JSON.stringify(body),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ data: updated, message: 'Book updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/library/books/[id] - Soft delete book
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'LIBRARIAN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.libraryBook.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            borrowRecords: {
              where: { status: 'borrowed' }
            }
          }
        }
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Book already deleted' }, { status: 410 });
    }

    // Business rule: Check if book is currently borrowed
    if (existing._count.borrowRecords > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete book that is currently borrowed. Please return all copies first.' 
      }, { status: 400 });
    }

    // Perform soft delete
    await db.libraryBook.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Log the successful deletion
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'BOOK_DELETE',
      entity: 'LIBRARY_BOOK',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ message: 'Book deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
