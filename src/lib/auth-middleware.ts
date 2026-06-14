import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;

import { db } from '@/lib/db';

export interface AuthResult {
  authenticated: boolean;
  id?: string;
  userId?: string;
  role?: string;
  schoolId?: string;
  schoolName?: string;
}

/**
 * Check subscription expiry for school.
 * Returns { expired: true, adminForcedToPayment: true } for SCHOOL_ADMIN (they can login but are restricted to payment page)
 * Returns { expired: true, blocked: true } for all other roles (blocked from logging in)
 * Returns { expired: false } if subscription is active or free plan
 */
export async function checkSubscriptionExpiry(schoolId?: string, role?: string): Promise<{ expired: boolean; blocked?: boolean; adminForcedToPayment?: boolean }> {
  if (!schoolId || !role) return { expired: false };
  if (role === 'SUPER_ADMIN') return { expired: false };

  try {
    const latestPayment = await db.platformPayment.findFirst({
      where: { schoolId, status: { in: ['success', 'active'] } },
      orderBy: { endDate: 'desc' },
      include: { plan: { select: { pricingType: true, name: true } } },
    });

    if (!latestPayment) {
      // Check if school has a free plan assigned
      const school = await db.school.findUnique({ where: { id: schoolId }, select: { planId: true, plan: true } });
      if (school?.planId) {
        const plan = await db.subscriptionPlan.findUnique({ where: { id: school.planId }, select: { pricingType: true } });
        if (plan?.pricingType === 'free') return { expired: false };
      }
      // Fallback: check the school.plan text field (covers schools registered before planId tracking existed)
      if (school?.plan === 'free' || school?.plan?.toLowerCase() === 'free') {
        return { expired: false };
      }
      return { expired: true, blocked: role !== 'SCHOOL_ADMIN', adminForcedToPayment: role === 'SCHOOL_ADMIN' };
    }
    if (latestPayment.plan?.pricingType === 'free') return { expired: false };

    const isExpired = !latestPayment.endDate || new Date(latestPayment.endDate) <= new Date();
    if (!isExpired) return { expired: false };

    // Expired — admins can still login (forced to payment), non-admins are blocked
    if (role === 'SCHOOL_ADMIN') {
      return { expired: true, adminForcedToPayment: true };
    }
    return { expired: true, blocked: true };
  } catch {
    return { expired: false };
  }
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
      id: token.id as string,
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
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  return authResult;
}

/**
 * Extract school ID from request.
 *
 * SECURITY: The auth token's schoolId is the source of truth.
 * The query param `schoolId` is ONLY honored for SUPER_ADMIN (who legitimately
 * needs to inspect other schools). For every other role, the auth token wins —
 * a query param cannot redirect a SCHOOL_ADMIN to view another school's data.
 */
export function getSchoolId(request: NextRequest, auth?: AuthResult): string | null {
  // Try auth token first — it is the trusted source of truth.
  if (auth?.schoolId) return auth.schoolId;

  // For SUPER_ADMIN only, the query param may be used to inspect other schools.
  if (auth?.role === 'SUPER_ADMIN') {
    const { searchParams } = new URL(request.url);
    const urlSchoolId = searchParams.get('schoolId');
    if (urlSchoolId) return urlSchoolId;
  }

  return null;
}
