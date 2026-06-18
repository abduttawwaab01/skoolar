import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId
      ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const designs = await db.iDCardDesign.findMany({
      where: { schoolId: targetSchoolId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ data: designs });
  } catch (error) {
    console.error('GET /api/id-card-designs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, name, orientation, primaryColor, secondaryColor, accentColor,
      textColor, textSecondaryColor, headerBgColor, bgColor, backgroundType,
      fontFamily, fontSize, showPhoto, showLogo, showQRCode, showBarcode,
      showSignature, showWatermark, showExpiryDate, showIssueDate, showMotto,
      showAddress, showEmergencyInfo, showMedicalInfo, showTerms, watermarkText,
      backText, isDefault } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId
      ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    if (isDefault) {
      await db.iDCardDesign.updateMany({
        where: { schoolId: targetSchoolId },
        data: { isDefault: false },
      });
    }

    const design = await db.iDCardDesign.create({
      data: {
        schoolId: targetSchoolId,
        name: name || 'Custom',
        orientation: orientation || 'landscape',
        primaryColor: primaryColor || '#059669',
        secondaryColor: secondaryColor || '#ffffff',
        accentColor: accentColor || '#fbbf24',
        textColor: textColor || '#1e293b',
        textSecondaryColor: textSecondaryColor || '#64748b',
        headerBgColor: headerBgColor || '#059669',
        bgColor: bgColor || '#ffffff',
        backgroundType: backgroundType || 'dots',
        fontFamily: fontFamily || 'Inter',
        fontSize: fontSize || 'md',
        showPhoto: showPhoto ?? true,
        showLogo: showLogo ?? true,
        showQRCode: showQRCode ?? true,
        showBarcode: showBarcode ?? false,
        showSignature: showSignature ?? true,
        showWatermark: showWatermark ?? true,
        showExpiryDate: showExpiryDate ?? false,
        showIssueDate: showIssueDate ?? false,
        showMotto: showMotto ?? true,
        showAddress: showAddress ?? false,
        showEmergencyInfo: showEmergencyInfo ?? true,
        showMedicalInfo: showMedicalInfo ?? true,
        showTerms: showTerms ?? true,
        watermarkText: watermarkText || null,
        backText: backText || null,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ data: design }, { status: 201 });
  } catch (error) {
    console.error('POST /api/id-card-designs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
