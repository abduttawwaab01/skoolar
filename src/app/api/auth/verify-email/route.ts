import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

// POST /api/auth/send-verification - Send email verification link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: 'Email already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await db.user.update({
      where: { id: userId },
      data: { resetToken: verificationToken, resetTokenExpiry: tokenExpiry },
    });

    const verifyUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    // TODO: Send actual email via Resend/SendGrid
    // await sendEmail({ to: user.email, subject: 'Verify your email', html: `Click here: ${verifyUrl}` });

    return NextResponse.json({
      message: 'Verification email sent',
      verifyUrl: process.env.NODE_ENV === 'development' ? verifyUrl : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/auth/verify-email - Verify email with token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Redirect to login with success message
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('verified', 'true');
    return NextResponse.redirect(loginUrl.toString());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
