import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderIDCardPreview, renderIDCardBack } from '@/lib/id-card-utils/render-card';
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

    const isLand = (design?.orientation || 'landscape') === 'landscape';
    const cw = isLand ? 85.6 : 53.98;
    const ch = isLand ? 53.98 : 85.6;

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
          gradientFrom: design?.gradientFrom || undefined,
          gradientTo: design?.gradientTo || undefined,
        },
        backgroundType: (design?.backgroundType || 'dots') as any,
        fontFamily: design?.fontFamily || 'Inter', fontSize: (design?.fontSize || 'md') as any,
        showPhoto: design?.showPhoto ?? true, showLogo: design?.showLogo ?? true,
        showQRCode: design?.showQRCode ?? true, showBarcode: design?.showBarcode ?? false,
        showSignature: design?.showSignature ?? true, showWatermark: design?.showWatermark ?? true,
        showExpiryDate: design?.showExpiryDate ?? false, showIssueDate: design?.showIssueDate ?? false,
        showMotto: design?.showMotto ?? true, showAddress: design?.showAddress ?? false,
        showEmergencyInfo: design?.showEmergencyInfo ?? true, showMedicalInfo: design?.showMedicalInfo ?? true,
        showTerms: design?.showTerms ?? true, watermarkText: design?.watermarkText || '',
        backText: design?.backText || '',
      },
      qrCodeDataUrl: card.qrCodeData ? undefined : undefined,
      serialNumber: card.uuid?.slice(0, 8).toUpperCase(),
    };

    if (card.personType === 'student') {
      const student = await db.student.findUnique({
        where: { id: card.personId },
        include: { user: { select: { name: true } }, class: { select: { name: true, section: true } } },
      });
      if (student) {
        previewData.student = {
          id: student.id, name: card.fullName || student.user.name || '',
          admissionNo: card.displayId || student.admissionNo || '',
          photo: student.photo, className: card.className || student.class?.name,
          section: card.section || student.class?.section,
          gender: card.gender || student.gender,
          dateOfBirth: card.dateOfBirth || student.dateOfBirth?.toISOString().split('T')[0],
          bloodGroup: card.bloodGroup || student.bloodGroup,
          house: card.house || student.house,
          academicSession: card.academicSession || undefined,
          emergencyContact: student.emergencyContact,
        };
      }
    } else if (card.personType === 'teacher') {
      const teacher = await db.teacher.findUnique({
        where: { id: card.personId },
        include: { user: { select: { name: true } } },
      });
      if (teacher) {
        previewData.teacher = {
          id: teacher.id, name: card.fullName || teacher.user?.name || '',
          employeeNo: card.displayId || teacher.employeeNo || '',
          photo: teacher.photo,
          department: teacher.specialization || undefined,
          designation: teacher.qualification || undefined,
        };
      }
    }

    const frontHTML = await renderIDCardPreview(previewData);
    const backHTML = await renderIDCardBack(previewData);

    const combined = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>ID Card - ${card.fullName}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f1f5f9; }
.page { break-after: page; margin-bottom: 20px; }
.card-wrap { width: ${cw}mm; height: ${ch}mm; overflow: hidden; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
@media print {
  @page { margin: 10mm; }
  body { padding: 0; background: #fff; }
  .label { display: none; }
  .card-wrap { box-shadow: none; }
  .page { margin-bottom: 0; }
}
</style>
</head>
<body>
<div class="page"><div class="label">Front</div><div class="card-wrap">${frontHTML}</div></div>
<div class="page"><div class="label">Back</div><div class="card-wrap">${backHTML}</div></div>
</body>
</html>`;

    return new NextResponse(combined, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="ID-Card-${card.fullName.replace(/\s+/g, '-')}.html"`,
      },
    });
  } catch (error) {
    console.error('GET /api/id-cards/[id]/pdf error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
