import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting for impression tracking
const impressionCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW = 60 * 1000; // 1 minute
const RATE_MAX = 30; // max 30 impressions per minute per IP+advert

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = impressionCounts.get(key);
  if (!record || now > record.resetAt) {
    impressionCounts.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  record.count++;
  return record.count > RATE_MAX;
}

// POST /api/platform/adverts/[id]/impression - Track advert impression
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(`${ip}:${id}`)) {
      return NextResponse.json({ success: true, data: { impressions: 0 } });
    }

    await db.platformAdvert.update({
      where: { id },
      data: { impressions: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
