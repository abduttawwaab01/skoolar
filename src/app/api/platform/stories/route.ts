import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/stories - Public: list published stories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const level = searchParams.get('level') || '';
    const grade = searchParams.get('grade') || '';
    const search = searchParams.get('search') || '';
    const featured = searchParams.get('featured');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = { isPublished: true };
    if (category) where.category = category;
    if (level) where.level = level;
    if (grade) where.grade = grade;
    if (featured === 'true') where.isFeatured = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
      ];
    }

    const [stories, total] = await Promise.all([
      db.platformStory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      }),
      db.platformStory.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: stories,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/platform/stories - Super Admin: create story
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { title, excerpt, content, coverImage, level, grade, category, tags, authorName, authorBio, isFeatured, isPublished } = body;

    if (!title || !content) {
      return NextResponse.json({ success: false, message: 'Title and content are required' }, { status: 400 });
    }

    const story = await db.platformStory.create({
      data: {
        title,
        excerpt: excerpt || null,
        content,
        coverImage: coverImage || null,
        level: level || null,
        grade: grade || null,
        category: category || 'General',
        tags: tags ? JSON.stringify(tags) : null,
        authorName: authorName || null,
        authorBio: authorBio || null,
        isFeatured: isFeatured || false,
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        createdBy: token.id as string,
      },
    });

    return NextResponse.json({ success: true, data: story, message: 'Story created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
