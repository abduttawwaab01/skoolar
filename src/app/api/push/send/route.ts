import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { sendPushNotification, sendPushToAll, PushPayload } from '@/lib/push-notifications';

// POST /api/push/send - Send push notification
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, payload, broadcast } = body as {
      userId?: string;
      payload: PushPayload;
      broadcast?: boolean;
    };

    if (!payload) {
      return NextResponse.json({ error: 'Payload is required' }, { status: 400 });
    }

    // Get subscriptions
    let subscriptions: { subscription: string }[] = [];

    if (broadcast && token.role === 'SUPER_ADMIN') {
      // Broadcast to all users
      subscriptions = await db.$queryRawUnsafe(
        `SELECT subscription FROM "PushSubscription"`
      ) as { subscription: string }[];
    } else if (userId) {
      // Send to specific user
      subscriptions = await db.$queryRawUnsafe(
        `SELECT subscription FROM "PushSubscription" WHERE "userId" = $1`,
        userId
      ) as { subscription: string }[];
    } else {
      // Send to current user
      subscriptions = await db.$queryRawUnsafe(
        `SELECT subscription FROM "PushSubscription" WHERE "userId" = $1`,
        token.id
      ) as { subscription: string }[];
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({ error: 'No active subscriptions found' }, { status: 404 });
    }

    const parsedSubscriptions = subscriptions.map((s) => JSON.parse(s.subscription));
    const result = await sendPushToAll(parsedSubscriptions, payload);

    return NextResponse.json({
      success: true,
      data: {
        sent: result.sent,
        failed: result.failed,
        errors: result.errors.slice(0, 10), // Limit error output
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
