import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendEmail, createEmailVerificationEmail } from '@/lib/email';

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
      data: { emailVerificationToken: verificationToken, emailVerificationExpiry: tokenExpiry },
    });

     // Build verify URL - require NEXTAUTH_URL in production
     const baseUrl = process.env.NEXTAUTH_URL;
     if (!baseUrl && process.env.NODE_ENV === 'production') {
       throw new Error('NEXTAUTH_URL environment variable is required in production');
     }
     const verifyUrl = `${baseUrl || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    // Send verification email
    const emailResult = await sendEmail({
      to: user.email,
      ...createEmailVerificationEmail(user.name, verifyUrl),
    });

    if (!emailResult.success) {
      // Log error but still return success to prevent enumeration
      console.error('Failed to send verification email:', emailResult.error);
    }

    return NextResponse.json({
      message: 'Verification email sent',
      // Only include URL in development for debugging
      ...(process.env.NODE_ENV === 'development' && { verifyUrl }),
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
        emailVerificationToken: token,
        emailVerificationExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiry: null,
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
