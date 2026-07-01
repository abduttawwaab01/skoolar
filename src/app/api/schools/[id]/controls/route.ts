import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

// GET /api/schools/[id]/controls - Get school's disabled features and roles (merged with global)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const school = await db.school.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Fetch school settings
    const settings = await db.schoolSettings.findUnique({
      where: { schoolId: id },
    });

    // Fetch global settings
    const globalSettings = await db.platformSettings.findFirst();

    const globallyDisabledFeatures = parseJsonArray(globalSettings?.globallyDisabledFeatures);
    const globallyDisabledRoles = parseJsonArray(globalSettings?.globallyDisabledRoles);
    const schoolDisabledFeatures = parseJsonArray(settings?.disabledFeatures);
    const schoolDisabledRoles = parseJsonArray(settings?.disabledUserRoles);
    const globalDisabledOverrides = parseJsonArray(settings?.globalDisabledOverrides);

    // Compute effective: school's own disabled + (global disabled - school's overrides)
    const effectiveDisabledFeatures = [
      ...new Set([
        ...schoolDisabledFeatures,
        ...globallyDisabledFeatures.filter((f: string) => !globalDisabledOverrides.includes(f)),
      ]),
    ];
    const effectiveDisabledRoles = [
      ...new Set([
        ...schoolDisabledRoles,
        ...globallyDisabledRoles.filter((r: string) => !globalDisabledOverrides.includes(r)),
      ]),
    ];

    // Also get the theme
    const theme = settings?.theme || 'default';

    return NextResponse.json({
      success: true,
      data: {
        schoolId: id,
        schoolName: school.name,
        disabledFeatures: effectiveDisabledFeatures,
        disabledUserRoles: effectiveDisabledRoles,
        // Raw values for editing
        globallyDisabledFeatures,
        globallyDisabledRoles,
        globalDisabledOverrides,
        schoolSpecificDisabledFeatures: schoolDisabledFeatures,
        schoolSpecificDisabledRoles: schoolDisabledRoles,
        theme,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/schools/[id]/controls - Update school's disabled features and roles (SUPER_ADMIN only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(request, 'SUPER_ADMIN');
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();

    const { disabledFeatures, disabledUserRoles, globalDisabledOverrides, theme } = body as {
      disabledFeatures?: string[];
      disabledUserRoles?: string[];
      globalDisabledOverrides?: string[];
      theme?: string;
    };

    if (disabledFeatures !== undefined && !Array.isArray(disabledFeatures)) {
      return NextResponse.json({ error: 'disabledFeatures must be an array of strings' }, { status: 400 });
    }
    if (disabledUserRoles !== undefined && !Array.isArray(disabledUserRoles)) {
      return NextResponse.json({ error: 'disabledUserRoles must be an array of strings' }, { status: 400 });
    }
    if (globalDisabledOverrides !== undefined && !Array.isArray(globalDisabledOverrides)) {
      return NextResponse.json({ error: 'globalDisabledOverrides must be an array of strings' }, { status: 400 });
    }

    const school = await db.school.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const updateData: Record<string, string> = {};
    if (disabledFeatures !== undefined) updateData.disabledFeatures = JSON.stringify(disabledFeatures);
    if (disabledUserRoles !== undefined) updateData.disabledUserRoles = JSON.stringify(disabledUserRoles);
    if (globalDisabledOverrides !== undefined) updateData.globalDisabledOverrides = JSON.stringify(globalDisabledOverrides);
    if (theme !== undefined) updateData.theme = theme;

    await db.schoolSettings.upsert({
      where: { schoolId: id },
      update: updateData,
      create: {
        schoolId: id,
        ...updateData,
      },
    });

    // Re-fetch merged for response
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: id } });
    const globalSettings = await db.platformSettings.findFirst();
    const globallyDisabledFeatures = parseJsonArray(globalSettings?.globallyDisabledFeatures);
    const globallyDisabledRoles = parseJsonArray(globalSettings?.globallyDisabledRoles);
    const schoolDisabledFeatures = parseJsonArray(settings?.disabledFeatures);
    const schoolDisabledRoles = parseJsonArray(settings?.disabledUserRoles);
    const parsedOverrides = parseJsonArray(settings?.globalDisabledOverrides);

    const effectiveDisabledFeatures = [
      ...new Set([
        ...schoolDisabledFeatures,
        ...globallyDisabledFeatures.filter((f: string) => !parsedOverrides.includes(f)),
      ]),
    ];
    const effectiveDisabledRoles = [
      ...new Set([
        ...schoolDisabledRoles,
        ...globallyDisabledRoles.filter((r: string) => !parsedOverrides.includes(r)),
      ]),
    ];

    return NextResponse.json({
      success: true,
      data: {
        schoolId: id,
        schoolName: school.name,
        disabledFeatures: effectiveDisabledFeatures,
        disabledUserRoles: effectiveDisabledRoles,
        globallyDisabledFeatures,
        globallyDisabledRoles,
        globalDisabledOverrides: parsedOverrides,
        schoolSpecificDisabledFeatures: schoolDisabledFeatures,
        schoolSpecificDisabledRoles: schoolDisabledRoles,
      },
      message: 'School controls updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
