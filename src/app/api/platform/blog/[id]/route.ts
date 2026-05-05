import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/blog/[id] - Public: get blog post by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const post = await db.blogPost.findUnique({
      where: { slug: id, isPublished: true },
    });

    if (!post) {
      return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });
    }

    // Increment view count
    await db.blogPost.update({
      where: { slug: id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, data: post });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// PUT /api/platform/blog/[id] - Super Admin: update blog post
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
    const { title, slug, excerpt, content, coverImage, category, tags, isPublished, featured, readTime } = body;

    // If publishing, set publishedAt
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags ? JSON.stringify(tags) : null;
    if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
      if (isPublished) updateData.publishedAt = new Date();
    }
    if (featured !== undefined) updateData.featured = featured;
    if (readTime !== undefined) updateData.readTime = readTime;

    const post = await db.blogPost.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: post, message: 'Blog post updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// DELETE /api/platform/blog/[id] - Super Admin: delete blog post
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
    await db.blogPost.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Blog post deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/platform/blog - Super Admin: create blog post
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { title, slug, excerpt, content, coverImage, authorName, authorAvatar, category, tags, isPublished, featured, readTime } = body;

    if (!title || !content) {
      return NextResponse.json({ success: false, message: 'Title and content are required' }, { status: 400 });
    }

    // Auto-generate slug if not provided
    const postSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const post = await db.blogPost.create({
      data: {
        title,
        slug: postSlug,
        excerpt: excerpt || null,
        content,
        coverImage: coverImage || null,
        authorName: authorName || 'Skoolar Team',
        authorAvatar: authorAvatar || null,
        category: category || 'General',
        tags: tags ? JSON.stringify(tags) : null,
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        featured: featured || false,
        readTime: readTime || 5,
        createdBy: token.id as string,
      },
    });

    return NextResponse.json({ success: true, data: post, message: 'Blog post created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
