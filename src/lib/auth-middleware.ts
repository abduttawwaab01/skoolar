import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { createAuditLogEntry } from './audit-logger';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  role?: string;
  schoolId?: string;
  schoolName?: string;
}

/**
 * Check authentication from request headers.
 * Returns user info if authenticated, null otherwise.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const token = await getToken({ req: request, secret: JWT_SECRET });
    if (!token) return { authenticated: false };

    return {
      authenticated: true,
      userId: token.id as string,
      role: token.role as string,
      schoolId: token.schoolId as string | undefined,
      schoolName: token.schoolName as string | undefined,
    };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Require authentication — returns 401 if not authenticated.
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult & { authenticated: true } | NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    // Log authentication failure
    // Note: Since we don't have a userId yet, we log with minimal info
    createAuditLogEntry({
      schoolId: 'SYSTEM',
      action: 'AUTHENTICATION_FAILURE',
      entity: 'AUTH',
      details: JSON.stringify({
        endpoint: request.nextUrl.pathname,
        method: request.method
      }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return auth as AuthResult & { authenticated: true };
}

/**
 * Require a specific role — returns 403 if wrong role.
 */
export async function requireRole(request: NextRequest, roles: string | string[]): Promise<AuthResult & { authenticated: true } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  if (!authResult.role || !allowedRoles.includes(authResult.role)) {
    // Log authorization failure
    createAuditLogEntry({
      schoolId: authResult.schoolId || 'SYSTEM',
      userId: authResult.userId,
      action: 'AUTHORIZATION_FAILURE',
      entity: 'AUTH',
      details: JSON.stringify({
        requiredRoles: allowedRoles,
        userRole: authResult.role,
        endpoint: request.nextUrl.pathname,
        method: request.method
      }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  return authResult;
}

/**
 * Extract school ID from request — from query params, body, or auth token.
 */
export function getSchoolId(request: NextRequest, auth?: AuthResult): string | null {
  // Try from URL search params
  const { searchParams } = new URL(request.url);
  const urlSchoolId = searchParams.get('schoolId');
  if (urlSchoolId) return urlSchoolId;

  // Try from auth token
  if (auth?.schoolId) return auth.schoolId;

  return null;
}
