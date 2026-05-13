import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/school-settings - Fetch school settings by schoolId
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    const targetSchoolId = auth.schoolId || schoolId;
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const settings = await db.schoolSettings.findUnique({
      where: { schoolId: targetSchoolId },
    });

    return NextResponse.json({ data: settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/school-settings - Update or create school settings
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolId } = body;

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    // Extract only the fields we want to update
    const {
      scoreSystem,
      fontFamily,
      theme,
      schoolMotto,
      schoolVision,
      schoolMission,
      principalName,
      vicePrincipalName,
      nextTermBegins,
      academicSession,
    } = body;

    // Upsert: create if doesn't exist, update if it does
    const settings = await db.schoolSettings.upsert({
      where: { schoolId },
      create: {
        schoolId,
        scoreSystem: scoreSystem || 'midterm_exam',
        fontFamily: fontFamily || 'Inter',
        theme: theme || 'default',
        schoolMotto: schoolMotto || null,
        schoolVision: schoolVision || null,
        schoolMission: schoolMission || null,
        principalName: principalName || null,
        vicePrincipalName: vicePrincipalName || null,
        nextTermBegins: nextTermBegins || null,
        academicSession: academicSession || null,
      },
      update: {
        ...(scoreSystem !== undefined && { scoreSystem }),
        ...(fontFamily !== undefined && { fontFamily }),
        ...(theme !== undefined && { theme }),
        ...(schoolMotto !== undefined && { schoolMotto }),
        ...(schoolVision !== undefined && { schoolVision }),
        ...(schoolMission !== undefined && { schoolMission }),
        ...(principalName !== undefined && { principalName }),
        ...(vicePrincipalName !== undefined && { vicePrincipalName }),
        ...(nextTermBegins !== undefined && { nextTermBegins }),
        ...(academicSession !== undefined && { academicSession }),
      },
    });

    return NextResponse.json({ data: settings, message: 'School settings updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
