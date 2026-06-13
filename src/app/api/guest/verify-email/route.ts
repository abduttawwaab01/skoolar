import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, guestId } = body;

    if (!token || !guestId) {
      return NextResponse.json({ error: 'Token and guestId are required' }, { status: 400 });
    }

    const guestUser = await db.guestUser.findUnique({
      where: { id: guestId },
    });

    if (!guestUser) {
      return NextResponse.json({ error: 'Guest user not found' }, { status: 404 });
    }

    if (guestUser.emailVerified) {
      return NextResponse.json({ data: { message: 'Email already verified' } });
    }

    if (guestUser.verificationToken !== token) {
      return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
    }

    await db.guestUser.update({
      where: { id: guestId },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    return NextResponse.json({ data: { message: 'Email verified successfully. You can now purchase credits.' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
