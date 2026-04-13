import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// GET /api/platform/settings - Public: get platform settings
export async function GET() {
  try {
    let settings = await db.platformSettings.findFirst();

    if (!settings) {
      // Create default settings
      settings = await db.platformSettings.create({
        data: {
          siteName: 'Skoolar',
          primaryColor: '#059669',
          secondaryColor: '#10B981',
          accentColor: '#F59E0B',
        },
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// PUT /api/platform/settings - Super Admin: update settings
export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    let settings = await db.platformSettings.findFirst();

    if (!settings) {
      settings = await db.platformSettings.create({ data: body });
    } else {
      settings = await db.platformSettings.update({
        where: { id: settings.id },
        data: body,
      });
    }

    return NextResponse.json({ success: true, data: settings, message: 'Settings updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
