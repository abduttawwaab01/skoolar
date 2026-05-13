import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/library/books - List books with filters, search, and pagination
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    let schoolId = searchParams.get('schoolId') || auth.schoolId || '';
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    const available = searchParams.get('available');

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId) {
      schoolId = auth.schoolId;
    }

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { deletedAt: null, schoolId };
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
              borrowRecords: true,
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
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { action, books, schoolId: bulkSchoolId } = body;

    // School isolation for bulk upload
    if (action === 'bulk-upload') {
      if (!bulkSchoolId || !Array.isArray(books)) {
        return NextResponse.json({ error: 'schoolId and books array required' }, { status: 400 });
      }
      if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && bulkSchoolId !== auth.schoolId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const results = await db.$transaction(async (tx) => {
        const created: any[] = [];
        for (const b of books) {
          const newBook = await tx.libraryBook.create({
            data: {
              schoolId: bulkSchoolId,
              title: b.title || b.Title,
              author: b.author || b.Author || null,
              isbn: b.isbn || b.ISBN || null,
              category: b.category || b.Category || 'General',
              totalCopies: parseInt(b.totalcopies || b.totalCopies || b.Copies || '1'),
              availableCopies: parseInt(b.totalcopies || b.totalCopies || b.Copies || '1'),
              location: b.location || b.Location || b.Shelf || null,
              barcode: b.barcode || b.Barcode || null,
            }
          });
          created.push(newBook);
        }
        return created;
      });

      return NextResponse.json({ data: results, message: `Successfully added ${results.length} books` });
    }

    const { schoolId, title, author, isbn, category, publisher, year, totalCopies, location, barcode, coverImage, description } = body;

    if (!schoolId || !title) {
      return NextResponse.json(
        { error: 'schoolId and title are required' },
        { status: 400 }
      );
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check plan limits - enforce max library books
    const school = await db.school.findUnique({
      where: { id: schoolId },
      include: { subscriptionPlan: true },
    });
    
    if (school) {
      const maxLibraryBooks = school.subscriptionPlan?.maxLibraryBooks || 500;
      // If maxLibraryBooks is -1, it means unlimited
      if (maxLibraryBooks !== -1) {
        const currentBookCount = await db.libraryBook.count({
          where: { schoolId, deletedAt: null },
        });
        
        if (currentBookCount >= maxLibraryBooks) {
          return NextResponse.json(
            { error: `Your plan allows maximum ${maxLibraryBooks} library books. Please upgrade your plan to add more.` },
            { status: 403 }
          );
        }
      }
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
