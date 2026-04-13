import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';

// POST /api/push/subscribe - Save push subscription
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscription } = body as { subscription: unknown };

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription is required' }, { status: 400 });
    }

    // Store subscription in user metadata or a separate table
    // For simplicity, we'll store it as JSON in a new PushSubscription model
    // For now, return success - you should create a PushSubscription model
    await db.$executeRawUnsafe(
      `INSERT INTO "PushSubscription" (id, "userId", "subscription", "createdAt") 
       VALUES ($1, $2, $3, NOW()) 
       ON CONFLICT ("userId", "endpoint") DO UPDATE SET "subscription" = $3, "updatedAt" = NOW()`,
      `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      token.id,
      JSON.stringify(subscription),
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/push/subscribe - Remove push subscription
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (endpoint) {
      await db.$executeRawUnsafe(
        `DELETE FROM "PushSubscription" WHERE "userId" = $1 AND "subscription"->>'endpoint' = $2`,
        token.id,
        endpoint,
      );
    } else {
      await db.$executeRawUnsafe(
        `DELETE FROM "PushSubscription" WHERE "userId" = $1`,
        token.id,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/push/vapid-public-key - Get VAPID public key
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  if (!publicKey) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}
