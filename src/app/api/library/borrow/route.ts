import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/library/borrow - List borrow records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const status = searchParams.get('status') || '';
    const studentId = searchParams.get('studentId') || '';
    const bookId = searchParams.get('bookId') || '';
    const overdue = searchParams.get('overdue');

    const where: Record<string, unknown> = {};

    if (schoolId) where.schoolId = schoolId;
    if (status) where.status = status;
    if (studentId) where.studentId = studentId;
    if (bookId) where.bookId = bookId;
    if (overdue === 'true') {
      where.status = 'borrowed';
      where.dueDate = { lt: new Date() };
    }

    const [data, total] = await Promise.all([
      db.borrowRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          bookId: true,
          studentId: true,
          borrowDate: true,
          dueDate: true,
          returnDate: true,
          status: true,
          fine: true,
          remarks: true,
          issuedBy: true,
          createdAt: true,
          updatedAt: true,
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              isbn: true,
              category: true,
              coverImage: true,
            },
          },
          student: {
            select: {
              id: true,
              admissionNo: true,
              user: { select: { name: true, email: true } },
              class: { select: { name: true, section: true } },
            },
          },
        },
      }),
      db.borrowRecord.count({ where }),
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

// POST /api/library/borrow - Borrow book
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { schoolId, bookId, studentId, dueDate, issuedBy, remarks } = body;

    if (!schoolId || !bookId || !studentId || !dueDate) {
      return NextResponse.json(
        { error: 'schoolId, bookId, studentId, and dueDate are required' },
        { status: 400 }
      );
    }

    // Check book exists and has available copies
    const book = await db.libraryBook.findUnique({ where: { id: bookId } });
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    if (book.availableCopies <= 0) {
      return NextResponse.json({ error: 'No copies available' }, { status: 400 });
    }

    // Check student exists
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Check if student already has this book borrowed
    const existingBorrow = await db.borrowRecord.findFirst({
      where: {
        bookId,
        studentId,
        status: 'borrowed',
      },
    });
    if (existingBorrow) {
      return NextResponse.json(
        { error: 'Student already has this book borrowed' },
        { status: 409 }
      );
    }

    // Create borrow record and decrement available copies
    const borrowRecord = await db.$transaction(async (tx) => {
      const record = await tx.borrowRecord.create({
        data: {
          schoolId,
          bookId,
          studentId,
          borrowDate: new Date(),
          dueDate: new Date(dueDate),
          issuedBy: issuedBy || null,
          remarks: remarks || null,
        },
      });

      await tx.libraryBook.update({
        where: { id: bookId },
        data: {
          availableCopies: { decrement: 1 },
        },
      });

      return record;
    });

    return NextResponse.json({ data: borrowRecord, message: 'Book borrowed successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/library/borrow - Return book
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, fine, remarks } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Borrow record id is required' },
        { status: 400 }
      );
    }

    // Get existing borrow record
    const borrowRecord = await db.borrowRecord.findUnique({ where: { id } });
    if (!borrowRecord) {
      return NextResponse.json({ error: 'Borrow record not found' }, { status: 404 });
    }

    if (borrowRecord.status === 'returned') {
      return NextResponse.json({ error: 'Book already returned' }, { status: 400 });
    }

    // Calculate fine if overdue
    let calculatedFine = fine || 0;
    if (!fine && borrowRecord.dueDate < new Date()) {
      const daysOverdue = Math.ceil((new Date().getTime() - borrowRecord.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      calculatedFine = daysOverdue * 5; // 5 per day overdue
    }

    // Update borrow record and increment available copies
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.borrowRecord.update({
        where: { id },
        data: {
          status: 'returned',
          returnDate: new Date(),
          fine: calculatedFine,
          remarks: remarks || borrowRecord.remarks,
        },
      });

      await tx.libraryBook.update({
        where: { id: borrowRecord.bookId },
        data: {
          availableCopies: { increment: 1 },
        },
      });

      return record;
    });

    return NextResponse.json({ data: updated, message: 'Book returned successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
