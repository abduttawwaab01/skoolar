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
  tokenVersion?: number;
}

export interface SubscriptionStatus {
  expired: boolean;
  blocked?: boolean;
  adminForcedToPayment?: boolean;
  daysRemaining?: number;
  warningDays?: number;
}

/**
 * Check subscription expiry for school.
 *
 * Returns a SubscriptionStatus:
 * - active:         { expired: false, daysRemaining, warningDays }
 * - warning period: { expired: false, daysRemaining <= warningDays, warningDays }
 * - blocked:        { expired: true, blocked: true }
 * - admin only:     { expired: true, adminForcedToPayment: true }
 *
 * SUPER_ADMIN is always exempt. Schools with a free plan are never expired.
 * A 1-day grace period (buffer) is applied after the endDate.
 */
export async function checkSubscriptionExpiry(
  schoolId?: string,
  role?: string
): Promise<SubscriptionStatus> {
  if (!schoolId || !role) return { expired: false };
  if (role === 'SUPER_ADMIN') return { expired: false };

  try {
    const latestPayment = await db.platformPayment.findFirst({
      where: { schoolId, status: 'success' },
      orderBy: { endDate: 'desc' },
      include: { plan: { select: { pricingType: true, warningDays: true } } },
    });

    if (latestPayment) {
      if (latestPayment.plan?.pricingType === 'free') return { expired: false };

      const now = new Date();
      const endDate = latestPayment.endDate ? new Date(latestPayment.endDate) : null;
      if (!endDate) return { expired: false };

      const planWarningDays = latestPayment.plan?.warningDays ?? 7;
      const buffer = 24 * 60 * 60 * 1000;
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (endDate.getTime() + buffer > now.getTime()) {
        return {
          expired: false,
          daysRemaining: Math.max(0, daysUntilExpiry),
          warningDays: planWarningDays,
        };
      }

      // No grace period — expired immediately
      if (role === 'SCHOOL_ADMIN') {
        return { expired: true, adminForcedToPayment: true };
      }
      return { expired: true, blocked: true };
    }

    // Check if school has a free plan
    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: {
        planId: true,
        plan: true,
        subscriptionPlan: { select: { pricingType: true, warningDays: true } },
      },
    });

    if (!school) return { expired: false };

    if (school.subscriptionPlan?.pricingType === 'free') return { expired: false };
    if (school.plan === 'free' || school.plan?.toLowerCase() === 'free') return { expired: false };

    // Has a plan assigned no active payment — allow short window for pending requests
    if (school.planId) {
      const pendingPayment = await db.platformPayment.findFirst({
        where: { schoolId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (pendingPayment) {
        const pendingAge = Date.now() - new Date(pendingPayment.createdAt).getTime();
        if (pendingAge < 48 * 60 * 60 * 1000) {
          return { expired: false, daysRemaining: 2, warningDays: school.subscriptionPlan?.warningDays ?? 7 };
        }
      }
    }

    // No active subscription at all
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
 * Require a specific feature to be enabled — returns 403 if disabled.
 * SUPER_ADMIN bypasses all feature checks.
 */
export async function requireFeature(
  request: NextRequest,
  featureId: string
): Promise<AuthResult & { authenticated: true } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role === 'SUPER_ADMIN') return auth;

  const targetSchoolId = auth.schoolId;
  if (!targetSchoolId) {
    return NextResponse.json({ error: 'School context required' }, { status: 403 });
  }

  try {
    const [platformSettings, schoolSettings] = await Promise.all([
      db.platformSettings.findFirst({ select: { globallyDisabledFeatures: true } }),
      db.schoolSettings.findUnique({
        where: { schoolId: targetSchoolId },
        select: { disabledFeatures: true, globalDisabledOverrides: true },
      }),
    ]);

    const globallyDisabled: string[] = platformSettings?.globallyDisabledFeatures
      ? JSON.parse(platformSettings.globallyDisabledFeatures) : [];
    const schoolOverrides: string[] = schoolSettings?.globalDisabledOverrides
      ? JSON.parse(schoolSettings.globalDisabledOverrides) : [];
    const schoolDisabled: string[] = schoolSettings?.disabledFeatures
      ? JSON.parse(schoolSettings.disabledFeatures) : [];

    if (globallyDisabled.includes(featureId) && !schoolOverrides.includes(featureId)) {
      return NextResponse.json(
        { error: 'This feature is currently disabled globally. Contact your school administrator for more information.' },
        { status: 403 }
      );
    }

    if (schoolDisabled.includes(featureId)) {
      return NextResponse.json(
        { error: 'This feature has been disabled for your school. Contact your school administration for more information.' },
        { status: 403 }
      );
    }
  } catch {
    // On error, allow feature access (fail open)
  }

  return auth;
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
