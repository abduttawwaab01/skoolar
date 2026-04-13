import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/school-settings - Fetch school settings by schoolId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const settings = await db.schoolSettings.findUnique({
      where: { schoolId },
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
    const body = await request.json();
    const { schoolId } = body;

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
      gradingScale,
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
        gradingScale: gradingScale || null,
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
        ...(gradingScale !== undefined && { gradingScale }),
      },
    });

    return NextResponse.json({ data: settings, message: 'School settings updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
