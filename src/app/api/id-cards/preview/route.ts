import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderIDCardPreview, renderIDCardBack } from '@/lib/id-card-utils/render-card';
import type { IDCardPreviewData } from '@/lib/id-card-utils/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolId, studentId, teacherId, designId, side } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId
      ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      select: { id: true, name: true, logo: true, motto: true, address: true, phone: true, email: true, website: true, primaryColor: true, secondaryColor: true },
    });
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const design = designId
      ? await db.iDCardDesign.findUnique({ where: { id: designId } })
      : await db.iDCardDesign.findFirst({ where: { schoolId: targetSchoolId, isDefault: true } });

    const defaultColors = {
      primary: school.primaryColor,
      secondary: school.secondaryColor,
      accent: '#fbbf24',
      text: '#1e293b',
      textSecondary: '#64748b',
      headerBg: school.primaryColor,
      bg: '#ffffff',
    };

    const designState = {
      name: design?.name || 'Standard',
      type: (studentId ? 'student' : 'teacher') as any,
      orientation: (design?.orientation || 'landscape') as any,
      colors: {
        primary: design?.primaryColor || defaultColors.primary,
        secondary: design?.secondaryColor || defaultColors.secondary,
        accent: design?.accentColor || defaultColors.accent,
        text: design?.textColor || defaultColors.text,
        textSecondary: design?.textSecondaryColor || defaultColors.textSecondary,
        headerBg: design?.headerBgColor || defaultColors.headerBg,
        bg: design?.bgColor || defaultColors.bg,
        gradientFrom: design?.gradientFrom || undefined,
        gradientTo: design?.gradientTo || undefined,
      },
      backgroundType: (design?.backgroundType || 'dots') as any,
      fontFamily: design?.fontFamily || 'Inter',
      fontSize: (design?.fontSize || 'md') as any,
      showPhoto: design?.showPhoto ?? true,
      showLogo: design?.showLogo ?? true,
      showQRCode: design?.showQRCode ?? true,
      showBarcode: design?.showBarcode ?? false,
      showSignature: design?.showSignature ?? true,
      showWatermark: design?.showWatermark ?? true,
      showExpiryDate: design?.showExpiryDate ?? false,
      showIssueDate: design?.showIssueDate ?? false,
      showMotto: design?.showMotto ?? true,
      showAddress: design?.showAddress ?? false,
      showEmergencyInfo: design?.showEmergencyInfo ?? true,
      showMedicalInfo: design?.showMedicalInfo ?? true,
      showTerms: design?.showTerms ?? true,
      watermarkText: design?.watermarkText || '',
      backText: design?.backText || '',
    };

    const qrCodeDataUrl = `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="white"/>
        ${[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24].map(i =>
          [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24].map(j =>
            (i * j + i + j) % 3 === 0 || (i + j) % 5 === 0
              ? `<rect x="${j*4}" y="${i*4}" width="4" height="4" fill="#1a1a2e"/>`
              : ''
          ).join('')
        ).join('')}
      </svg>`
    )}`;

    let previewData: IDCardPreviewData = {
      school: {
        id: school.id,
        name: school.name,
        logo: school.logo,
        motto: school.motto,
        address: school.address,
        phone: school.phone,
        email: school.email,
        website: school.website,
        primaryColor: school.primaryColor,
        secondaryColor: school.secondaryColor,
      },
      design: designState,
      qrCodeDataUrl,
      serialNumber: `SKL-${Date.now().toString(36).toUpperCase()}`,
    };

    if (studentId) {
      const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { name: true, phone: true, email: true } },
          class: { select: { id: true, name: true, section: true } },
        },
      });
      if (student) {
        previewData.student = {
          id: student.id,
          name: student.user.name || '',
          admissionNo: student.admissionNo || '',
          photo: student.photo,
          className: student.class?.name,
          section: student.class?.section,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0],
          bloodGroup: student.bloodGroup,
          house: student.house,
          academicSession: '',
          emergencyContact: student.emergencyContact,
        };
        previewData.design.type = 'student';
      }
    } else if (teacherId) {
      const teacher = await db.teacher.findUnique({
        where: { id: teacherId },
        include: { user: { select: { name: true, phone: true, email: true } } },
      });
      if (teacher) {
        previewData.teacher = {
          id: teacher.id,
          name: teacher.user.name || '',
          employeeNo: teacher.employeeNo || '',
          photo: teacher.user.avatar || null,
          department: teacher.specialization || undefined,
          designation: teacher.qualification || undefined,
          phone: teacher.user.phone || null,
          email: teacher.user.email || null,
        };
        previewData.design.type = 'teacher';
      }
    }

    const html = side === 'back'
      ? await renderIDCardBack(previewData)
      : await renderIDCardPreview(previewData);

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('POST /api/id-cards/preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
