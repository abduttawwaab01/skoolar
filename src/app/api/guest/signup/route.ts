import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendEmail, createEmailVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, guestId } = body;

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const existing = await db.guestUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: 'This email is already registered. Please sign in.' }, { status: 409 });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const guestData: Record<string, unknown> = {
      email: email.toLowerCase().trim(),
      name: name || null,
      verificationToken,
      credits: 0,
      hasUsedFreeTrial: false,
    };

    if (guestId) {
      const existingGuestById = await db.guestUser.findUnique({ where: { id: guestId } });
      if (existingGuestById) {
        return NextResponse.json({ error: 'Guest session already exists. Please refresh and try again.' }, { status: 400 });
      }
      guestData.id = guestId;
    }

    const guestUser = await db.guestUser.create({ data: guestData as any });

    const verifyUrl = `${request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/guest/verify-email?token=${verificationToken}&guestId=${guestUser.id}`;

    const { subject, html } = createEmailVerificationEmail(name || email, verifyUrl);
    await sendEmail({ to: email, subject, html });

    return NextResponse.json({
      data: {
        id: guestUser.id,
        email: guestUser.email,
        message: 'Verification email sent. Please check your inbox.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
