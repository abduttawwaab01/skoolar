import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderIDCardPreview } from '@/lib/id-card-utils/render-card';
import type { IDCardPreviewData } from '@/lib/id-card-utils/types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const card = await db.iDCard.findUnique({
      where: { id },
      include: { school: true, design: true },
    });
    if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && card.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const school = card.school;
    const design = card.design;

    const previewData: IDCardPreviewData = {
      school: {
        id: school.id, name: school.name, logo: school.logo, motto: school.motto,
        address: school.address, phone: school.phone, email: school.email,
        website: school.website, primaryColor: school.primaryColor, secondaryColor: school.secondaryColor,
      },
      design: {
        name: design?.name || 'Standard', type: (card.personType as any) || 'student',
        orientation: (design?.orientation || 'landscape') as any,
        colors: {
          primary: design?.primaryColor || school.primaryColor || '#059669',
          secondary: design?.secondaryColor || '#ffffff',
          accent: design?.accentColor || '#fbbf24',
          text: design?.textColor || '#1e293b',
          textSecondary: design?.textSecondaryColor || '#64748b',
          headerBg: design?.headerBgColor || school.primaryColor || '#059669',
          bg: design?.bgColor || '#ffffff',
        },
        backgroundType: (design?.backgroundType || 'dots') as any,
        fontFamily: design?.fontFamily || 'Inter', fontSize: (design?.fontSize || 'md') as any,
        showPhoto: design?.showPhoto ?? true, showLogo: design?.showLogo ?? true,
        showQRCode: design?.showQRCode ?? true, showBarcode: design?.showBarcode ?? false,
        showClass: (design as any)?.showClass ?? true, showSection: (design as any)?.showSection ?? false,
        showSession: (design as any)?.showSession ?? false, showPhone: (design as any)?.showPhone ?? false,
        showSignature: design?.showSignature ?? true, showWatermark: design?.showWatermark ?? true,
        showExpiryDate: design?.showExpiryDate ?? false, showIssueDate: design?.showIssueDate ?? false,
        showMotto: design?.showMotto ?? true, showAddress: design?.showAddress ?? false,
        showEmergencyInfo: design?.showEmergencyInfo ?? true, showMedicalInfo: design?.showMedicalInfo ?? true,
        showTerms: design?.showTerms ?? true, watermarkText: design?.watermarkText || '',
        showEmail: true, showParentInfo: true, showPersonalAddress: true,
        backText: design?.backText || '',
      },
      serialNumber: card.uuid?.slice(0, 8).toUpperCase(),
    };

    const html = await renderIDCardPreview(previewData);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="ID-Card-${card.fullName.replace(/\s+/g, '-')}-print.html"`,
      },
    });
  } catch (error) {
    console.error('GET /api/id-cards/[id]/png error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
