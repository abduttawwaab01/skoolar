import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail, createPasswordResetEmail } from '@/lib/email';

const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// POST /api/auth/forgot-password - Send password reset email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email: string };

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken, passwordResetExpiry: resetTokenExpiry },
    });

    // In production, send email with reset link
    // For now, return the token (remove in production)
     // Build reset URL - require NEXTAUTH_URL in production
     const baseUrl = process.env.NEXTAUTH_URL;
     if (!baseUrl && process.env.NODE_ENV === 'production') {
       throw new Error('NEXTAUTH_URL environment variable is required in production');
     }
     const resetUrl = `${baseUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send email with reset link
    const emailResult = await sendEmail({
      to: email,
      ...createPasswordResetEmail(user.name, resetUrl),
    });

    if (!emailResult.success) {
      // Log error but still return success to prevent email enumeration
      console.error('Failed to send password reset email:', emailResult.error);
    }

    return NextResponse.json({
      message: 'If an account exists with that email, a reset link has been sent.',
      // Only include resetUrl in development for debugging
      ...(process.env.NODE_ENV === 'development' && { resetUrl }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/auth/reset-password - Reset password with token
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body as { token: string; password: string };

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/auth/verify-email - Verify email with token
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token: string };

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid verification token' }, { status: 400 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
