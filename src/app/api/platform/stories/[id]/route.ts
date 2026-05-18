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

// GET /api/platform/stories/[id] - Public: get story by ID. Admin: ?all=true bypasses isPublished check.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('all') === 'true';

    const where: Record<string, unknown> = { id };
    if (!showAll) where.isPublished = true;

    const story = await db.platformStory.findFirst({ where });

    if (!story) {
      return NextResponse.json({ success: false, message: 'Story not found' }, { status: 404 });
    }

    // Only increment view count for public views
    if (!showAll) {
      await db.platformStory.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ success: true, data: { ...story, viewCount: story.viewCount + (showAll ? 0 : 1) } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// PUT /api/platform/stories/[id] - Super Admin: update story
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, excerpt, content, coverImage, level, grade, category, tags, authorName, authorBio, isFeatured, isPublished, audioUrl, audioDuration, audioPlatform, videoUrl, videoDuration, videoPlatform } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) {
      updateData.content = content;
      updateData.readTime = calculateReadTime(content);
    }
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (level !== undefined) updateData.level = level;
    if (grade !== undefined) updateData.grade = grade;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = JSON.stringify(parseTags(tags));
    if (authorName !== undefined) updateData.authorName = authorName;
    if (authorBio !== undefined) updateData.authorBio = authorBio;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
      if (isPublished) updateData.publishedAt = new Date();
    }
    if (audioUrl !== undefined) updateData.audioUrl = audioUrl;
    if (audioDuration !== undefined) updateData.audioDuration = audioDuration;
    if (audioPlatform !== undefined) updateData.audioPlatform = audioPlatform;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (videoDuration !== undefined) updateData.videoDuration = videoDuration;
    if (videoPlatform !== undefined) updateData.videoPlatform = videoPlatform;

    const story = await db.platformStory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: story, message: 'Story updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// DELETE /api/platform/stories/[id] - Super Admin: delete story
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await db.platformStory.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Story deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// PATCH /api/platform/stories/[id] - Authenticated: like/unlike a story
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.action === 'like') {
      const story = await db.platformStory.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
      });
      return NextResponse.json({ success: true, data: { likeCount: story.likeCount } });
    }

    if (body.action === 'unlike') {
      const story = await db.platformStory.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      });
      return NextResponse.json({ success: true, data: { likeCount: Math.max(0, story.likeCount) } });
    }

    return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
