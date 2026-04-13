import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    // 1. Book Overview
    const [totalEntries, copiesAgg, categoriesAgg] = await Promise.all([
      db.libraryBook.count({ where: { schoolId, deletedAt: null } }),
      db.libraryBook.aggregate({
        where: { schoolId, deletedAt: null },
        _sum: { totalCopies: true, availableCopies: true }
      }),
      db.libraryBook.groupBy({
        by: ['category'],
        where: { schoolId, deletedAt: null },
        _sum: { totalCopies: true }
      })
    ]);

    // 2. Borrow Stats
    const now = new Date();
    const [borrowedCount, overdueCount, returnedCount] = await Promise.all([
      db.borrowRecord.count({ where: { schoolId, status: 'borrowed' } }),
      db.borrowRecord.count({ where: { schoolId, status: 'borrowed', dueDate: { lt: now } } }),
      db.borrowRecord.count({ where: { schoolId, status: 'returned' } })
    ]);

    // 3. Detailed Overdue Monitor (RESTORED)
    const overdueRecords = await db.borrowRecord.findMany({
      where: { schoolId, status: 'borrowed', dueDate: { lt: now } },
      include: {
        student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } },
        book: { select: { title: true } }
      },
      orderBy: { dueDate: 'asc' },
      take: 10
    });

    // 4. Top Borrowed Books
    const topBorrowed = await db.borrowRecord.groupBy({
      by: ['bookId'],
      where: { schoolId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    const bookDetails = await db.libraryBook.findMany({
      where: { id: { in: topBorrowed.map(t => t.bookId) } },
      select: { id: true, title: true }
    });

    const popularBooks = topBorrowed.map(t => ({
      title: bookDetails.find(b => b.id === t.bookId)?.title || 'Unknown',
      count: t._count.id
    }));

    // 5. Monthly Borrow Trend
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentBorrows = await db.borrowRecord.findMany({
      where: { schoolId, borrowDate: { gte: sixMonthsAgo } },
      select: { borrowDate: true }
    });

    const trendMap: Record<string, number> = {};
    recentBorrows.forEach(b => {
      const month = b.borrowDate.toISOString().substring(0, 7);
      trendMap[month] = (trendMap[month] || 0) + 1;
    });

    const trendData = Object.entries(trendMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({
        month: new Date(month + "-01").toLocaleDateString('default', { month: 'short' }),
        count
      }));

    return NextResponse.json({
      data: {
        summary: {
          uniqueTitles: totalEntries,
          totalCopies: copiesAgg._sum.totalCopies || 0,
          availableCopies: copiesAgg._sum.availableCopies || 0,
          borrowedCount,
          overdueCount,
          returnRate: (borrowedCount + returnedCount) > 0 
            ? Math.round((returnedCount / (borrowedCount + returnedCount)) * 100) 
            : 0
        },
        categories: categoriesAgg.map(c => ({
          name: c.category || 'Uncategorized',
          value: c._sum.totalCopies || 0
        })),
        popularBooks,
        trend: trendData,
        overdueRecords
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
