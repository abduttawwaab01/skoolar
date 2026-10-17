import type { AuthResult } from './auth-middleware';

/**
 * Determine whether the caller is the host of a live class.
 * Supports authenticated hosts (incl. SUPER_ADMIN) and anonymous guest hosts.
 */
export function isLiveClassHost(
  liveClass: { hostId?: string | null; guestUserId?: string | null },
  auth: AuthResult,
  guestId?: string | null,
): boolean {
  if (auth.authenticated && (auth.role === 'SUPER_ADMIN' || liveClass.hostId === auth.id)) {
    return true;
  }
  if (!!guestId && !!liveClass.guestUserId && liveClass.guestUserId === guestId) {
    return true;
  }
  return false;
}
