import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const { email, schoolId } = await request.json();

    if (!email || !schoolId) {
      return NextResponse.json(
        { error: 'Email and schoolId are required' },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateCheck = await checkRateLimit(`detect:${ip}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        email: email.toLowerCase(),
        schoolId: schoolId,
      },
      select: {
        role: true,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in this school' },
        { status: 404 }
      );
    }

    const roleLabels: Record<string, string> = {
      SUPER_ADMIN: 'Platform Admin',
      SCHOOL_ADMIN: 'School Admin',
      TEACHER: 'Teacher',
      STUDENT: 'Student',
      PARENT: 'Parent',
      ACCOUNTANT: 'Accountant',
      LIBRARIAN: 'Librarian',
      DIRECTOR: 'Director',
    };

    const normalizedRole = user.role.toUpperCase();
    return NextResponse.json({
      role: normalizedRole,
      roleLabel: roleLabels[normalizedRole] || user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    });
  } catch (error) {
    console.error('Detect role error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}