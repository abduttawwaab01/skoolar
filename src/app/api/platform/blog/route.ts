import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/blog - Public: list published (or all for admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    const featured = searchParams.get('featured');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const allPosts = searchParams.get('all') === 'true';

    // Check if requesting all (admin)
    const token = await getToken({ req: request });
    const isAdmin = token?.role === 'SUPER_ADMIN';

    const where: Record<string, unknown> = {};
    if (!allPosts || !isAdmin) {
      where.isPublished = true;
    }
    if (category) where.category = category;
    if (featured === 'true') where.featured = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
      ];
    }

    const [posts, total] = await Promise.all([
      db.blogPost.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      db.blogPost.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
