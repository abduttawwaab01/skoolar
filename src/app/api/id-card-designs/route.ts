import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const designs = await db.iDCardDesign.findMany({
      where: { schoolId: targetSchoolId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json({ data: designs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && body.schoolId
      ? body.schoolId
      : (auth.schoolId || '');

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    if (action === 'save') {
      const {
        id,
        name,
        orientation,
        primaryColor, secondaryColor, accentColor, textColor, textSecondaryColor,
        headerBgColor, bgColor, gradientFrom, gradientTo,
        backgroundType, fontFamily, fontSize,
        showPhoto, showLogo, showQRCode, showBarcode, showSignature, showWatermark,
        showMotto, showExpiryDate, showIssueDate,
        qrPosition, backLayoutType,
        showEmergencyInfo, showMedicalInfo, showTerms, showSignatory, showSchoolInfo,
        backText, termsText,
        signatureUrl, signatureLabel,
        frontLayout, backLayout,
        watermarkText,
      } = body;

      let design;
      if (id) {
        design = await db.iDCardDesign.update({
          where: { id },
          data: {
            name, orientation,
            primaryColor, secondaryColor, accentColor, textColor, textSecondaryColor,
            headerBgColor, bgColor, gradientFrom, gradientTo,
            backgroundType, fontFamily, fontSize,
            showPhoto, showLogo, showQRCode, showBarcode, showSignature, showWatermark,
            showMotto, showExpiryDate, showIssueDate,
            qrPosition, backLayoutType,
            showEmergencyInfo, showMedicalInfo, showTerms, showSignatory, showSchoolInfo,
            backText, termsText,
            signatureUrl, signatureLabel,
            frontLayout, backLayout,
            watermarkText,
          },
        });
      } else {
        // Unset any existing default if this is set as default
        if (body.isDefault) {
          await db.iDCardDesign.updateMany({
            where: { schoolId: targetSchoolId },
            data: { isDefault: false },
          });
        }

        design = await db.iDCardDesign.create({
          data: {
            schoolId: targetSchoolId,
            name, orientation,
            primaryColor: primaryColor || '#059669',
            secondaryColor: secondaryColor || '#FFFFFF',
            accentColor: accentColor || '#fbbf24',
            textColor: textColor || '#1e293b',
            textSecondaryColor: textSecondaryColor || '#64748b',
            headerBgColor: headerBgColor || '#059669',
            bgColor: bgColor || '#ffffff',
            gradientFrom, gradientTo,
            backgroundType: backgroundType || 'solid',
            fontFamily: fontFamily || 'Inter',
            fontSize: fontSize || 'md',
            showPhoto: showPhoto !== false,
            showLogo: showLogo !== false,
            showQRCode: showQRCode !== false,
            showBarcode: showBarcode === true,
            showSignature: showSignature !== false,
            showWatermark: showWatermark !== false,
            showMotto: showMotto !== false,
            showExpiryDate: showExpiryDate === true,
            showIssueDate: showIssueDate !== false,
            qrPosition: qrPosition || 'front',
            backLayoutType: backLayoutType || 'standard',
            showEmergencyInfo: showEmergencyInfo !== false,
            showMedicalInfo: showMedicalInfo !== false,
            showTerms: showTerms !== false,
            showSignatory: showSignatory !== false,
            showSchoolInfo: showSchoolInfo !== false,
            backText, termsText,
            signatureUrl, signatureLabel,
            frontLayout, backLayout,
            watermarkText,
            isDefault: body.isDefault === true,
            type: 'school',
          },
        });
      }

      return NextResponse.json({ success: true, data: design });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Design ID required' }, { status: 400 });

      await db.iDCardDesign.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'set-default') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Design ID required' }, { status: 400 });

      await db.iDCardDesign.updateMany({
        where: { schoolId: targetSchoolId },
        data: { isDefault: false },
      });
      await db.iDCardDesign.update({
        where: { id },
        data: { isDefault: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
