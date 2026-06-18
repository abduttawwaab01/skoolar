import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const designs = await db.reportCardDesign.findMany({
      where: { schoolId: targetSchoolId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: designs });
  } catch (error) {
    console.error('GET /api/report-card-designs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, schoolId: bodySchoolId, ...designData } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 400 });

    if (!name && !designData.name) {
      return NextResponse.json({ error: 'Design name is required' }, { status: 400 });
    }

    const ALLOWED_FIELDS = ['orientation', 'primaryColor', 'secondaryColor', 'accentColor', 'textColor', 'textSecondaryColor', 'headerBgColor', 'bgColor', 'gradientFrom', 'gradientTo', 'backgroundType', 'backgroundImage', 'fontFamily', 'fontSize', 'showHeader', 'showLogo', 'showMotto', 'showAddress', 'showContacts', 'showStudentPhoto', 'showStudentInfo', 'showSubjectsTable', 'showDomains', 'showChart', 'showAttendance', 'showRemarks', 'showSignatures', 'showFooter', 'showWatermark', 'showLegend', 'gradeScaleId', 'passMark', 'showGradeColors', 'customFooter', 'backText', 'termsText', 'signatureLabel', 'watermarkText', 'frontLayout', 'backLayout', 'isDefault'];
    const cleaned: Record<string, unknown> = { schoolId: targetSchoolId, name };
    for (const key of ALLOWED_FIELDS) {
      if (key in designData) cleaned[key] = (designData as Record<string, unknown>)[key];
    }

    const design = await db.reportCardDesign.create({ data: cleaned as any });

    return NextResponse.json({ data: design, message: 'Design created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/report-card-designs error:', error);
    return NextResponse.json({ error: 'Failed to create design' }, { status: 500 });
  }
}
