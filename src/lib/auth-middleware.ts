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
  inTrial?: boolean;
  trialDaysRemaining?: number;
}

const TRIAL_DAYS = 14;

/**
 * Check subscription expiry for school.
 *
 * Rules:
 * - SUPER_ADMIN is always exempt.
 * - If school has trialEndDate and it's in the future → trial active (full access)
 * - If trial expired and no active payment → blocked
 * - If school has active payment (status: success) and endDate is valid → active
 * - Otherwise → expired/blocked
 */
export async function checkSubscriptionExpiry(
  schoolId?: string,
  role?: string
): Promise<SubscriptionStatus> {
  if (!schoolId || !role) return { expired: false };
  if (role === 'SUPER_ADMIN') return { expired: false };

  try {
    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: {
        trialStartDate: true,
        trialEndDate: true,
        planId: true,
      },
    });

    if (!school) return { expired: false };

    const now = new Date();

    // Check trial period
    if (school.trialStartDate && school.trialEndDate) {
      const trialEnd = new Date(school.trialEndDate);
      const buffer = 24 * 60 * 60 * 1000;

      if (trialEnd.getTime() + buffer > now.getTime()) {
        const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        return {
          expired: false,
          inTrial: true,
          trialDaysRemaining: daysRemaining,
          daysRemaining,
          warningDays: 7,
        };
      }
    }

    // Check for active paid subscription
    const latestPayment = await db.platformPayment.findFirst({
      where: { schoolId, status: 'success' },
      orderBy: { endDate: 'desc' },
      include: { plan: { select: { pricingType: true, warningDays: true } } },
    });

    if (latestPayment) {
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

      // Expired
      if (role === 'SCHOOL_ADMIN') {
        return { expired: true, adminForcedToPayment: true };
      }
      return { expired: true, blocked: true };
    }

    // No trial and no payment — check if there's a pending request
    if (school.planId) {
      const pendingPayment = await db.platformPayment.findFirst({
        where: { schoolId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (pendingPayment) {
        const pendingAge = Date.now() - new Date(pendingPayment.createdAt).getTime();
        if (pendingAge < 48 * 60 * 60 * 1000) {
          return { expired: false, daysRemaining: 2, warningDays: 7 };
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
 * Require active subscription — returns 403 if the school's subscription is expired.
 * Super Admin always passes.
 *
 * Pass `exemptSchoolAdmin = true` to allow SCHOOL_ADMIN through even when expired
 * (needed for subscription/payment routes).
 */
export async function requireActiveSubscription(
  request: NextRequest,
  opts?: { auth?: AuthResult; exemptSchoolAdmin?: boolean }
): Promise<NextResponse | null> {
  const result = opts?.auth || await authenticateRequest(request);
  if (!result.authenticated) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (result.role === 'SUPER_ADMIN') return null;

  const schoolId = getSchoolId(request, result);
  if (!schoolId) return null;

  const status = await checkSubscriptionExpiry(schoolId, result.role);

  if (status.expired) {
    if (result.role === 'SCHOOL_ADMIN' && opts?.exemptSchoolAdmin) {
      return null;
    }
    return NextResponse.json(
      { error: result.role === 'SCHOOL_ADMIN'
          ? 'Your school subscription has expired. Please renew to continue using Skoolar.'
          : 'Your school subscription has expired. Please contact your school administrator to renew the subscription.' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Extract school ID from request.
 */
export function getSchoolId(request: NextRequest, auth?: AuthResult): string | null {
  if (auth?.schoolId) return auth.schoolId;

  if (auth?.role === 'SUPER_ADMIN') {
    const { searchParams } = new URL(request.url);
    const urlSchoolId = searchParams.get('schoolId');
    if (urlSchoolId) return urlSchoolId;
  }

  return null;
}
