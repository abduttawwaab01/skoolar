import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting for click tracking
const clickCounts = new Map<string, { count: number; resetAt: number }>();
const CLICK_RATE_WINDOW = 60 * 1000; // 1 minute
const CLICK_RATE_MAX = 10; // max 10 clicks per minute per IP+advert

function isClickRateLimited(key: string): boolean {
  const now = Date.now();
  const record = clickCounts.get(key);

  if (!record || now > record.resetAt) {
    clickCounts.set(key, { count: 1, resetAt: now + CLICK_RATE_WINDOW });
    return false;
  }

  record.count++;
  return record.count > CLICK_RATE_MAX;
}

// POST /api/platform/adverts/[id]/click - Track advert click
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Rate limit by IP + advert ID
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isClickRateLimited(`${ip}:${id}`)) {
      return NextResponse.json({ success: true, data: { clicks: 0 } });
    }

    const advert = await db.platformAdvert.update({
      where: { id },
      data: { clicks: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
