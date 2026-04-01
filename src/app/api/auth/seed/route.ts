import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { seedDatabase, seedSubscriptionPlans } from '@/lib/seed';

export async function POST(request: NextRequest) {
  try {
    // Check if SUPER_ADMIN already exists - allow first-time seeding without auth
    const existingAdmin = await db.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    // If admin exists, verify SUPER_ADMIN authentication
    if (existingAdmin) {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      if (!token || token.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized. Super Admin access required.' }, { status: 401 });
      }
    }

    // Always seed subscription plans (idempotent - only creates if missing)
    const plans = await seedSubscriptionPlans();

    if (existingAdmin) {
      return NextResponse.json(
        {
          message: 'Super Admin already exists. Subscription plans seeded/verified.',
          email: existingAdmin.email,
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
