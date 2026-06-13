import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// In-memory rate limit: per class, max 1 extension per 60 seconds
const extendCooldowns = new Map<string, number>();

// POST /api/live-classes/[id]/extend — deduct 1 credit to extend class by 1 hour
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Rate limit: prevent rapid calls
  const lastExtend = extendCooldowns.get(id);
  const now = Date.now();
  if (lastExtend && (now - lastExtend) < 60000) {
    return NextResponse.json({
      error: 'Please wait at least 1 minute between extensions',
      extended: false,
    }, { status: 429 });
  }

  const liveClass = await db.liveClass.findFirst({
    where: { id, deletedAt: null, status: 'active' },
    select: { id: true, guestUserId: true, startedAt: true, settings: true },
  });

  if (!liveClass) {
    return NextResponse.json({ error: 'Active live class not found' }, { status: 404 });
  }

  if (!liveClass.guestUserId) {
    return NextResponse.json({ error: 'Only guest-hosted classes can be extended via credits' }, { status: 403 });
  }

  const guestUser = await db.guestUser.findUnique({
    where: { id: liveClass.guestUserId },
    select: { id: true, credits: true, emailVerified: true },
  });

  if (!guestUser) {
    return NextResponse.json({ error: 'Guest user not found' }, { status: 404 });
  }

  if (!guestUser.emailVerified) {
    return NextResponse.json({ error: 'Email must be verified to use credits' }, { status: 403 });
  }

  if (guestUser.credits < 1) {
    return NextResponse.json({
      error: 'No credits remaining',
      extended: false,
      credits: 0,
    });
  }

  // Deduct 1 credit
  await db.guestUser.update({
    where: { id: guestUser.id },
    data: { credits: { decrement: 1 } },
  });

  // Add 1 hour to the class duration in settings
  const currentSettings = (liveClass.settings as Record<string, unknown>) || {};
  const currentMaxMin = (currentSettings.maxDurationMinutes as number) || 60;
  const newMaxDuration = currentMaxMin + 60;

  await db.liveClass.update({
    where: { id },
    data: {
      settings: { ...currentSettings, maxDurationMinutes: newMaxDuration },
    },
  });

  // Set cooldown to prevent rapid re-call
  extendCooldowns.set(id, Date.now());

  return NextResponse.json({
    data: {
      extended: true,
      creditsRemaining: guestUser.credits - 1,
      newMaxDurationMinutes: newMaxDuration,
      addedMinutes: 60,
    },
  });
}
