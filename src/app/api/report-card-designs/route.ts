import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { DEFAULT_TEMPLATES } from '@/lib/report-card-utils/default-templates';

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

    return NextResponse.json({ data: designs, presets: DEFAULT_TEMPLATES });
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
    const { name, presetId, schoolId: bodySchoolId, ...designData } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 400 });

    if (presetId) {
      const preset = DEFAULT_TEMPLATES.find(p => p.id === presetId);
      if (!preset) return NextResponse.json({ error: `Preset "${presetId}" not found` }, { status: 404 });
      Object.assign(designData, {
        name: name || preset.name,
        orientation: preset.orientation,
        primaryColor: preset.colors.primary,
        secondaryColor: preset.colors.secondary,
        accentColor: preset.colors.accent,
        textColor: preset.colors.text,
        textSecondaryColor: preset.colors.textSecondary,
        headerBgColor: preset.colors.headerBg,
        bgColor: preset.colors.bg,
        gradientFrom: preset.colors.gradientFrom || null,
        gradientTo: preset.colors.gradientTo || null,
        backgroundType: preset.backgroundType,
        fontFamily: preset.fontFamily,
        fontSize: preset.fontSize,
        showHeader: preset.showHeader,
        showLogo: preset.showLogo,
        showMotto: preset.showMotto,
        showAddress: preset.showAddress,
        showContacts: preset.showContacts,
        showStudentPhoto: preset.showStudentPhoto,
        showStudentInfo: preset.showStudentInfo,
        showSubjectsTable: preset.showSubjectsTable,
        showDomains: preset.showDomains,
        showChart: preset.showChart,
        showAttendance: preset.showAttendance,
        showRemarks: preset.showRemarks,
        showSignatures: preset.showSignatures,
        showFooter: preset.showFooter,
        showWatermark: preset.showWatermark,
      });
    }

    if (!name && !designData.name) {
      return NextResponse.json({ error: 'Design name is required' }, { status: 400 });
    }

    const design = await db.reportCardDesign.create({
      data: { schoolId: targetSchoolId, name, ...designData, isActive: false },
    });

    return NextResponse.json({ data: design, message: 'Design created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/report-card-designs error:', error);
    return NextResponse.json({ error: 'Failed to create design' }, { status: 500 });
  }
}
