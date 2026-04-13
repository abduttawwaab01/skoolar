import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/library/books - List books with filters, search, and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    const available = searchParams.get('available');

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    if (schoolId) where.schoolId = schoolId;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { author: { contains: search } },
        { isbn: { contains: search } },
        { publisher: { contains: search } },
      ];
    }
    if (available !== null && available !== undefined && available !== '') {
      where.availableCopies = available === 'true' ? { gt: 0 } : 0;
    }

    const [data, total] = await Promise.all([
      db.libraryBook.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          title: true,
          author: true,
          isbn: true,
          category: true,
          publisher: true,
          year: true,
          totalCopies: true,
          availableCopies: true,
          location: true,
          barcode: true,
          coverImage: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              borrowRecords: {
                where: { status: 'borrowed' },
              },
            },
          },
        },
      }),
      db.libraryBook.count({ where }),
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

// POST /api/library/books - Add new book
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { schoolId, title, author, isbn, category, publisher, year, totalCopies, location, barcode, coverImage, description } = body;

    if (!schoolId || !title) {
      return NextResponse.json(
        { error: 'schoolId and title are required' },
        { status: 400 }
      );
    }

    const book = await db.libraryBook.create({
      data: {
        schoolId,
        title,
        author: author || null,
        isbn: isbn || null,
        category: category || null,
        publisher: publisher || null,
        year: year || null,
        totalCopies: totalCopies || 1,
        availableCopies: totalCopies || 1,
        location: location || null,
        barcode: barcode || null,
        coverImage: coverImage || null,
        description: description || null,
      },
    });

    return NextResponse.json({ data: book, message: 'Book added successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
