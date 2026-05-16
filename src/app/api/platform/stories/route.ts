import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

function calculateReadTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// GET /api/platform/stories - Public: list published stories. Admin: ?all=true lists all.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const level = searchParams.get('level') || '';
    const grade = searchParams.get('grade') || '';
    const search = searchParams.get('search') || '';
    const featured = searchParams.get('featured');
    const showAll = searchParams.get('all') === 'true';
    const hasAudio = searchParams.get('hasAudio') === 'true';
    const hasVideo = searchParams.get('hasVideo') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    if (showAll) {
      const token = await getToken({ req: request });
      if (!token || token.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
      }
    }

    const where: Record<string, unknown> = {};
    if (!showAll) where.isPublished = true;
    if (category) where.category = category;
    if (level) where.level = level;
    if (grade) where.grade = grade;
    if (featured === 'true') where.isFeatured = true;
    if (hasAudio) where.audioUrl = { not: null };
    if (hasVideo) where.videoUrl = { not: null };
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
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      db.platformStory.count({ where }),
    ]);

    const response = NextResponse.json({
      success: true,
      data: stories,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
    // Cache publicly for 60 seconds, allow stale-while-revalidate
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    return response;
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
    const { title, excerpt, content, coverImage, level, grade, category, tags, authorName, authorBio, isFeatured, isPublished, audioUrl, audioDuration, audioPlatform, videoUrl, videoDuration, videoPlatform } = body;

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
        tags: JSON.stringify(parseTags(tags)),
        authorName: authorName || null,
        authorBio: authorBio || null,
        isFeatured: isFeatured || false,
        isPublished: isPublished || false,
        audioUrl: audioUrl || null,
        audioDuration: audioDuration || null,
        audioPlatform: audioPlatform || null,
        videoUrl: videoUrl || null,
        videoDuration: videoDuration || null,
        videoPlatform: videoPlatform || null,
        readTime: calculateReadTime(content),
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
