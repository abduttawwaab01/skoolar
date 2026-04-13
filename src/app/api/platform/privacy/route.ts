import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/privacy - Public: get privacy policy and cookies text
export async function GET() {
  try {
    let settings = await db.platformSettings.findFirst();

    if (!settings) {
      settings = await db.platformSettings.create({
        data: {
          siteName: 'Skoolar',
          primaryColor: '#059669',
          secondaryColor: '#10B981',
          accentColor: '#F59E0B',
        },
      });
    }

    // Parse socialLinks JSON to extract privacy/cookie content
    let extraContent: { privacyPolicy?: string; cookiePolicy?: string } = {};
    if (settings.socialLinks) {
      try {
        extraContent = JSON.parse(settings.socialLinks);
      } catch {
        extraContent = {};
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        privacyPolicy: extraContent.privacyPolicy || '',
        cookiePolicy: extraContent.cookiePolicy || '',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// PUT /api/platform/privacy - Super Admin: update privacy policy and cookies text
export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { privacyPolicy, cookiePolicy } = body;

    let settings = await db.platformSettings.findFirst();

    // Parse existing socialLinks JSON
    let extraContent: Record<string, string> = {};
    if (settings?.socialLinks) {
      try {
        extraContent = JSON.parse(settings.socialLinks);
      } catch {
        extraContent = {};
      }
    }

    // Merge privacy/cookie content into the JSON
    if (privacyPolicy !== undefined) extraContent.privacyPolicy = privacyPolicy;
    if (cookiePolicy !== undefined) extraContent.cookiePolicy = cookiePolicy;

    if (!settings) {
      settings = await db.platformSettings.create({
        data: {
          siteName: 'Skoolar',
          primaryColor: '#059669',
          secondaryColor: '#10B981',
          accentColor: '#F59E0B',
          socialLinks: JSON.stringify(extraContent),
        },
      });
    } else {
      settings = await db.platformSettings.update({
        where: { id: settings.id },
        data: { socialLinks: JSON.stringify(extraContent) },
      });
    }

    return NextResponse.json({
      success: true,
      data: { privacyPolicy, cookiePolicy },
      message: 'Privacy policies updated',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
