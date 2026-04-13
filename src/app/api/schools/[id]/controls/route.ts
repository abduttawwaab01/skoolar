import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-middleware';

// GET /api/schools/[id]/controls - Get school's disabled features and roles
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify school exists
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

    // Parse JSON arrays
    let disabledFeatures: string[] = [];
    let disabledUserRoles: string[] = [];

    if (settings?.disabledFeatures) {
      try {
        disabledFeatures = JSON.parse(settings.disabledFeatures);
      } catch {
        disabledFeatures = [];
      }
    }

    if (settings?.disabledUserRoles) {
      try {
        disabledUserRoles = JSON.parse(settings.disabledUserRoles);
      } catch {
        disabledUserRoles = [];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        schoolId: id,
        schoolName: school.name,
        disabledFeatures,
        disabledUserRoles,
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

    const { disabledFeatures, disabledUserRoles } = body as {
      disabledFeatures?: string[];
      disabledUserRoles?: string[];
    };

    // Validate inputs are arrays if provided
    if (disabledFeatures !== undefined && !Array.isArray(disabledFeatures)) {
      return NextResponse.json({ error: 'disabledFeatures must be an array of strings' }, { status: 400 });
    }

    if (disabledUserRoles !== undefined && !Array.isArray(disabledUserRoles)) {
      return NextResponse.json({ error: 'disabledUserRoles must be an array of strings' }, { status: 400 });
    }

    // Verify school exists
    const school = await db.school.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Upsert SchoolSettings
    const settings = await db.schoolSettings.upsert({
      where: { schoolId: id },
      update: {
        ...(disabledFeatures !== undefined && { disabledFeatures: JSON.stringify(disabledFeatures) }),
        ...(disabledUserRoles !== undefined && { disabledUserRoles: JSON.stringify(disabledUserRoles) }),
      },
      create: {
        schoolId: id,
        ...(disabledFeatures !== undefined && { disabledFeatures: JSON.stringify(disabledFeatures) }),
        ...(disabledUserRoles !== undefined && { disabledUserRoles: JSON.stringify(disabledUserRoles) }),
      },
    });

    // Parse for response
    let parsedFeatures: string[] = [];
    let parsedRoles: string[] = [];

    if (settings.disabledFeatures) {
      try { parsedFeatures = JSON.parse(settings.disabledFeatures); } catch { parsedFeatures = []; }
    }
    if (settings.disabledUserRoles) {
      try { parsedRoles = JSON.parse(settings.disabledUserRoles); } catch { parsedRoles = []; }
    }

    return NextResponse.json({
      success: true,
      data: {
        schoolId: id,
        schoolName: school.name,
        disabledFeatures: parsedFeatures,
        disabledUserRoles: parsedRoles,
      },
      message: 'School controls updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
