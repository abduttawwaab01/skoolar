import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@skoolar.org';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  tag?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string; icon?: string }[];
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return { success: false, error: 'VAPID keys not configured' };
    }

    const payloadString = JSON.stringify(payload);

    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      payloadString
    );

    return { success: true };
  } catch (error: unknown) {
    const err = error as { statusCode?: number; body?: string };
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { success: false, error: 'Subscription expired' };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function sendPushToAll(
  subscriptions: PushSubscription[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload);
      return result;
    })
  );

  const sent = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success).map((r) => r.error || 'Unknown error');

  return { sent, failed: results.length - sent, errors };
}
