import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Simple in-memory rate limit for story submissions (per IP)
const submissionCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 submissions per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = submissionCounts.get(ip);

  if (!record || now > record.resetAt) {
    submissionCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET /api/platform/story-submissions - Super Admin: list submissions
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [submissions, total] = await Promise.all([
      db.storySubmission.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.storySubmission.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: submissions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST /api/platform/story-submissions - Public: submit story
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, message: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { title, content, authorName, authorEmail, authorPhone, level, grade, category, coverImage } = body;

    // Validate required fields
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ success: false, message: 'Title is required' }, { status: 400 });
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ success: false, message: 'Content is required' }, { status: 400 });
    }
    if (!authorName || typeof authorName !== 'string') {
      return NextResponse.json({ success: false, message: 'Author name is required' }, { status: 400 });
    }
    if (!authorEmail || typeof authorEmail !== 'string') {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(authorEmail)) {
      return NextResponse.json({ success: false, message: 'Please provide a valid email address' }, { status: 400 });
    }

    // Validate field lengths
    if (title.length > 200) {
      return NextResponse.json({ success: false, message: 'Title must be under 200 characters' }, { status: 400 });
    }
    if (content.length > 50000) {
      return NextResponse.json({ success: false, message: 'Content must be under 50,000 characters' }, { status: 400 });
    }
    if (authorName.length > 100) {
      return NextResponse.json({ success: false, message: 'Author name must be under 100 characters' }, { status: 400 });
    }

    // Validate optional phone format
    if (authorPhone && authorPhone.length > 20) {
      return NextResponse.json({ success: false, message: 'Phone number must be under 20 characters' }, { status: 400 });
    }

    // Validate category if provided
    const validCategories = ['General', 'Adventure', 'Fantasy', 'Science Fiction', 'Mystery', 'Non-Fiction', 'Historical', 'Motivational', 'Educational', 'Comedy', 'Drama', 'Poetry', 'Other'];
    const finalCategory = category || 'General';
    if (!validCategories.includes(finalCategory)) {
      return NextResponse.json({ success: false, message: 'Invalid category' }, { status: 400 });
    }

    const submission = await db.storySubmission.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim().toLowerCase(),
        authorPhone: authorPhone ? authorPhone.trim() : null,
        level: level || null,
        grade: grade || null,
        category: finalCategory,
        coverImage: coverImage || null,
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, data: submission, message: 'Story submitted for review' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
