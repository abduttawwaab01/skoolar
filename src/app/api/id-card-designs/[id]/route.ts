import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const design = await db.iDCardDesign.findUnique({ where: { id } });
    if (!design) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && design.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: design });
  } catch (error) {
    console.error('GET /api/id-card-designs/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await db.iDCardDesign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (body.isDefault) {
      await db.iDCardDesign.updateMany({
        where: { schoolId: existing.schoolId },
        data: { isDefault: false },
      });
    }

    const design = await db.iDCardDesign.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        orientation: body.orientation ?? undefined,
        primaryColor: body.primaryColor ?? undefined,
        secondaryColor: body.secondaryColor ?? undefined,
        accentColor: body.accentColor ?? undefined,
        textColor: body.textColor ?? undefined,
        textSecondaryColor: body.textSecondaryColor ?? undefined,
        headerBgColor: body.headerBgColor ?? undefined,
        bgColor: body.bgColor ?? undefined,
        backgroundType: body.backgroundType ?? undefined,
        fontFamily: body.fontFamily ?? undefined,
        fontSize: body.fontSize ?? undefined,
        showPhoto: body.showPhoto ?? undefined,
        showLogo: body.showLogo ?? undefined,
        showQRCode: body.showQRCode ?? undefined,
        showBarcode: body.showBarcode ?? undefined,
        showSignature: body.showSignature ?? undefined,
        showWatermark: body.showWatermark ?? undefined,
        showExpiryDate: body.showExpiryDate ?? undefined,
        showIssueDate: body.showIssueDate ?? undefined,
        showMotto: body.showMotto ?? undefined,
        showAddress: body.showAddress ?? undefined,
        showEmergencyInfo: body.showEmergencyInfo ?? undefined,
        showMedicalInfo: body.showMedicalInfo ?? undefined,
        showTerms: body.showTerms ?? undefined,
        watermarkText: body.watermarkText ?? undefined,
        backText: body.backText ?? undefined,
        isDefault: body.isDefault ?? undefined,
      },
    });

    return NextResponse.json({ data: design });
  } catch (error) {
    console.error('PUT /api/id-card-designs/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await db.iDCardDesign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.iDCardDesign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/id-card-designs/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
