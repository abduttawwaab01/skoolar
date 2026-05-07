import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 401 });
    }

    let preferences = await db.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await db.userPreferences.create({
        data: { userId },
      });
    }

    return NextResponse.json({ data: preferences });
  } catch (error: unknown) {
    console.error('User preferences error:', error);
    return NextResponse.json({ data: null });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      language, 
      timezone, 
      currency, 
      dateFormat, 
      emailNotifications, 
      pushNotifications, 
      smsNotifications, 
      soundEnabled, 
      twoFactorEnabled,
      theme 
    } = body;

    const preferences = await db.userPreferences.upsert({
      where: { userId },
      update: {
        ...(language && { language }),
        ...(timezone && { timezone }),
        ...(currency && { currency }),
        ...(dateFormat && { dateFormat }),
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(pushNotifications !== undefined && { pushNotifications }),
        ...(smsNotifications !== undefined && { smsNotifications }),
        ...(soundEnabled !== undefined && { soundEnabled }),
        ...(twoFactorEnabled !== undefined && { twoFactorEnabled }),
        ...(theme && { theme }),
      },
      create: {
        userId,
        language: language || 'en',
        timezone: timezone || 'lagos',
        currency: currency || 'ngn',
        dateFormat: dateFormat || 'dd-mm-yyyy',
        emailNotifications: emailNotifications ?? true,
        pushNotifications: pushNotifications ?? true,
        smsNotifications: smsNotifications ?? false,
        soundEnabled: soundEnabled ?? true,
        twoFactorEnabled: twoFactorEnabled ?? false,
        theme: theme || 'system',
      },
    });

    return NextResponse.json({ data: preferences, message: 'Preferences updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}