import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { seedDatabase, seedSubscriptionPlans, hashPassword } from '@/lib/seed';

export async function POST(request: NextRequest) {
  // BLOCK IN PRODUCTION: This endpoint should only be used in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is not available in production. Use the CLI seed script instead.' },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const forceReset = body?.forceReset === true;
    
    // Check if SUPER_ADMIN already exists - allow first-time seeding without auth
    let existingAdmin = await db.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    // If admin exists, verify SUPER_ADMIN authentication unless forceReset is true
    if (existingAdmin && !forceReset) {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      if (!token || token.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized. Super Admin access required.' }, { status: 401 });
      }
    }

    // Always seed subscription plans (idempotent - only creates if missing)
    const plans = await seedSubscriptionPlans();

    if (existingAdmin && !forceReset) {
      return NextResponse.json(
        {
          message: 'Super Admin already exists. Subscription plans seeded/verified.',
          email: existingAdmin.email,
          plansSeeded: plans.length,
        },
        { status: 200 }
      );
    }

    // If forceReset is true, update the existing admin password
    if (existingAdmin && forceReset) {
      // Use environment variable or random password (never hardcoded)
      const newPassword = process.env.INITIAL_ADMIN_PASSWORD || 'CHANGE_ME_NOW_' + Math.random().toString(36).slice(-8);
      const newHash = await hashPassword(newPassword);
      existingAdmin = await db.user.update({
        where: { id: existingAdmin.id },
        data: { password: newHash, isActive: true },
      });
      return NextResponse.json(
        {
          message: 'Super Admin password reset successfully.',
          email: existingAdmin.email,
          password: newPassword, // Still returns password but only in dev
          plansSeeded: plans.length,
        },
        { status: 200 }
      );
    }

    const result = await seedDatabase();

    return NextResponse.json({ ...result, plansSeeded: plans.length }, { status: 201 });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database.', details: String(error) },
      { status: 500 }
    );
  }
}
