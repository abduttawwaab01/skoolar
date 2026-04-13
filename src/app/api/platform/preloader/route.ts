import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/preloader - Public: fetch only the latest active quote
// For Super Admin: fetch all quotes for management
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    const isSuperAdmin = token?.role === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      const quotes = await db.preloaderQuote.findMany({
        orderBy: { updatedAt: 'desc' },
      });
      return NextResponse.json({ success: true, data: quotes });
    }

    const quote = await db.preloaderQuote.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!quote) {
      return NextResponse.json({
        success: true,
        data: { quote: 'Education is the passport to the future, for tomorrow belongs to those who prepare for it today.', author: 'Malcolm X' },
      });
    }

    return NextResponse.json({ success: true, data: quote });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/platform/preloader - Super Admin: create quote
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { quote, author, isActive } = body;

    if (!quote || !author) {
      return NextResponse.json({ success: false, message: 'Quote and author are required' }, { status: 400 });
    }

    const newQuote = await db.preloaderQuote.create({
      data: {
        quote,
        author,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ success: true, data: newQuote, message: 'Quote created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
