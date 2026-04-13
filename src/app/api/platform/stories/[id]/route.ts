import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/stories/[id] - Public: get story by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const story = await db.platformStory.findUnique({ where: { id } });

    if (!story) {
      return NextResponse.json({ success: false, message: 'Story not found' }, { status: 404 });
    }

    // Increment view count
    await db.platformStory.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, data: story });
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
    const { title, excerpt, content, coverImage, level, grade, category, tags, authorName, authorBio, isFeatured, isPublished } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (level !== undefined) updateData.level = level;
    if (grade !== undefined) updateData.grade = grade;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags ? JSON.stringify(tags) : null;
    if (authorName !== undefined) updateData.authorName = authorName;
    if (authorBio !== undefined) updateData.authorBio = authorBio;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
      if (isPublished) updateData.publishedAt = new Date();
    }

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
