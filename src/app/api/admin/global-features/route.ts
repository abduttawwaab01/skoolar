import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export async function GET() {
  try {
    const settings = await db.platformSettings.findFirst();
    const globallyDisabledFeatures = parseJsonArray(settings?.globallyDisabledFeatures);
    const globallyDisabledRoles = parseJsonArray(settings?.globallyDisabledRoles);

    return NextResponse.json({
      success: true,
      data: { globallyDisabledFeatures, globallyDisabledRoles },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireRole(request, 'SUPER_ADMIN');
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { globallyDisabledFeatures, globallyDisabledRoles } = body as {
      globallyDisabledFeatures?: string[];
      globallyDisabledRoles?: string[];
    };

    if (globallyDisabledFeatures !== undefined && !Array.isArray(globallyDisabledFeatures)) {
      return NextResponse.json({ error: 'globallyDisabledFeatures must be an array of strings' }, { status: 400 });
    }
    if (globallyDisabledRoles !== undefined && !Array.isArray(globallyDisabledRoles)) {
      return NextResponse.json({ error: 'globallyDisabledRoles must be an array of strings' }, { status: 400 });
    }

    let settings = await db.platformSettings.findFirst();
    if (!settings) {
      settings = await db.platformSettings.create({ data: {} });
    }

    const updated = await db.platformSettings.update({
      where: { id: settings.id },
      data: {
        ...(globallyDisabledFeatures !== undefined && { globallyDisabledFeatures: JSON.stringify(globallyDisabledFeatures) }),
        ...(globallyDisabledRoles !== undefined && { globallyDisabledRoles: JSON.stringify(globallyDisabledRoles) }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        globallyDisabledFeatures: parseJsonArray(updated.globallyDisabledFeatures),
        globallyDisabledRoles: parseJsonArray(updated.globallyDisabledRoles),
      },
      message: 'Global features updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
