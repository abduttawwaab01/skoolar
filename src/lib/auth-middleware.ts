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

export interface SubscriptionStatus {
  expired: boolean;
  blocked?: boolean;
  adminForcedToPayment?: boolean;
  inGracePeriod?: boolean;
  daysRemaining?: number;
  warningDays?: number;
}

/**
 * Check subscription expiry for school.
 *
 * Returns a SubscriptionStatus indicating the school's subscription state:
 * - active:         { expired: false, daysRemaining, warningDays }
 * - warning period: { expired: false, daysRemaining: <= warningDays, warningDays }
 * - grace period:   { expired: true, inGracePeriod: true, daysRemaining, warningDays }
 * - blocked:        { expired: true, blocked: true, inGracePeriod: false }
 * - admin only:     { expired: true, adminForcedToPayment: true, inGracePeriod: false }
 *
 * SUPER_ADMIN is always exempt. Schools with a free plan are never expired.
 */
export async function checkSubscriptionExpiry(
  schoolId?: string,
  role?: string
): Promise<SubscriptionStatus> {
  if (!schoolId || !role) return { expired: false };
  if (role === 'SUPER_ADMIN') return { expired: false };

  try {
    const latestPayment = await db.platformPayment.findFirst({
      where: { schoolId, status: { in: ['success', 'active'] } },
      orderBy: { endDate: 'desc' },
      include: { plan: { select: { pricingType: true, name: true, warningDays: true, gracePeriodDays: true } } },
    });

    // ── Active payment record found ──
    if (latestPayment) {
      if (latestPayment.plan?.pricingType === 'free') return { expired: false };

      const now = new Date();
      const endDate = latestPayment.endDate ? new Date(latestPayment.endDate) : null;
      if (!endDate) return { expired: false }; // perpetual

      const planWarningDays = latestPayment.plan?.warningDays ?? 7;
      const gracePeriodDays = latestPayment.plan?.gracePeriodDays ?? 3;

      // 1-day timezone buffer
      const buffer = 24 * 60 * 60 * 1000;
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (endDate.getTime() + buffer > now.getTime()) {
        // Still active (with 1-day buffer)
        return {
          expired: false,
          daysRemaining: Math.max(0, daysUntilExpiry),
          warningDays: planWarningDays,
        };
      }

      // End date has passed — check grace period
      const daysOverdue = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= gracePeriodDays) {
        return {
          expired: true,
          inGracePeriod: true,
          daysRemaining: Math.max(0, gracePeriodDays - daysOverdue),
          warningDays: planWarningDays,
        };
      }

      // Past grace period — block non-admins
      if (role === 'SCHOOL_ADMIN') {
        return { expired: true, adminForcedToPayment: true, inGracePeriod: false };
      }
      return { expired: true, blocked: true, inGracePeriod: false };
    }

    // ── No payment record — check school's plan assignment ──
    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: {
        planId: true,
        plan: true,
        subscriptionPlan: { select: { pricingType: true, warningDays: true, gracePeriodDays: true } },
      },
    });

    if (!school) return { expired: false };

    // Free plan
    if (school.subscriptionPlan?.pricingType === 'free') return { expired: false };
    if (school.plan === 'free' || school.plan?.toLowerCase() === 'free') return { expired: false };

    // Has a plan assigned but no successful payment — check for pending payments
    if (school.planId) {
      const pendingPayment = await db.platformPayment.findFirst({
        where: { schoolId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (pendingPayment) {
        const pendingAge = Date.now() - new Date(pendingPayment.createdAt).getTime();
        if (pendingAge < 48 * 60 * 60 * 1000) {
          // Pending payment less than 48 hours old — temporary access
          return { expired: false, daysRemaining: 2, warningDays: school.subscriptionPlan?.warningDays ?? 7 };
        }
      }
    }

    // No payment and no free plan — grant short grace for manual assignments
    const defaultGrace = 3;
    return {
      expired: true,
      inGracePeriod: true,
      daysRemaining: defaultGrace,
      warningDays: school.subscriptionPlan?.warningDays ?? 7,
    };
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
