import { AccessToken, type ClaimGrants } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'devsecret';

export function generateLiveKitToken(
  identity: string,
  roomName: string,
  options?: {
    name?: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
    metadata?: string;
    ttl?: string;
  },
): AccessToken {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: options?.name || identity,
    ttl: options?.ttl || '6h',
    metadata: options?.metadata,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: options?.canPublish ?? true,
    canSubscribe: options?.canSubscribe ?? true,
    canPublishData: options?.canPublishData ?? true,
  });

  return at;
}

export function generateGuestToken(
  guestId: string,
  roomName: string,
  displayName: string,
): AccessToken {
  return generateLiveKitToken(guestId, roomName, {
    name: displayName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    metadata: JSON.stringify({ type: 'guest' }),
  });
}

export const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';
