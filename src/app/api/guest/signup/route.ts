import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendEmail, createEmailVerificationEmail } from '@/lib/email';

async function sendVerification(
  email: string,
  name: string | null,
  verificationToken: string,
  guestUserId: string,
  origin: string,
) {
  const verifyUrl = `${origin}/guest/verify-email?token=${verificationToken}&guestId=${guestUserId}`;
  const { subject, html } = createEmailVerificationEmail(name || email, verifyUrl);
  await sendEmail({ to: email, subject, html });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, guestId } = body;

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (guestId) {
      const existingGuestById = await db.guestUser.findUnique({ where: { id: guestId } });

      if (existingGuestById) {
        // Same anonymous guest signing up — attach the email and re-send verification.
        if (existingGuestById.email && existingGuestById.email !== normalizedEmail) {
          const owner = await db.guestUser.findUnique({ where: { email: normalizedEmail } });
          if (owner && owner.id !== guestId) {
            return NextResponse.json(
              { error: 'This email is already registered to another guest.' },
              { status: 409 },
            );
          }
        }

        const updated = await db.guestUser.update({
          where: { id: guestId },
          data: {
            email: normalizedEmail,
            name: name || existingGuestById.name,
            verificationToken,
            emailVerified: false,
          },
        });

        await sendVerification(normalizedEmail, updated.name, verificationToken, updated.id, origin);

        return NextResponse.json({
          data: {
            id: updated.id,
            email: updated.email,
            message: 'Verification email sent. Please check your inbox.',
          },
        });
      }

      // guestId supplied but no row exists yet — create it with that id.
      const emailOwner = await db.guestUser.findUnique({ where: { email: normalizedEmail } });
      if (emailOwner) {
        return NextResponse.json({ error: 'This email is already registered. Please sign in.' }, { status: 409 });
      }

      const guestUser = await db.guestUser.create({
        data: {
          id: guestId,
          email: normalizedEmail,
          name: name || null,
          verificationToken,
          credits: 0,
        },
      });

      await sendVerification(normalizedEmail, guestUser.name, verificationToken, guestUser.id, origin);

      return NextResponse.json({
        data: {
          id: guestUser.id,
          email: guestUser.email,
          message: 'Verification email sent. Please check your inbox.',
        },
      });
    }

    const existing = await db.guestUser.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'This email is already registered. Please sign in.' }, { status: 409 });
    }

    const guestUser = await db.guestUser.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        verificationToken,
        credits: 0,
      },
    });

    await sendVerification(normalizedEmail, guestUser.name, verificationToken, guestUser.id, origin);

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
