import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderIDCardPreview, renderIDCardBack, generateQRDataUrl } from '@/lib/id-card-utils/render-card';
import type { IDCardPreviewData, IDCardDesignState } from '@/lib/id-card-utils/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolId, studentId, teacherId, userId, side, design: clientDesign } = body;

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

    let designState: IDCardDesignState;

    if (clientDesign) {
      designState = {
        name: clientDesign.name || 'Custom',
        type: clientDesign.type || 'student',
        orientation: clientDesign.orientation || 'landscape',
        colors: {
          primary: clientDesign.colors?.primary || school.primaryColor || '#059669',
          secondary: clientDesign.colors?.secondary || school.secondaryColor || '#ffffff',
          accent: clientDesign.colors?.accent || '#fbbf24',
          text: clientDesign.colors?.text || '#1e293b',
          textSecondary: clientDesign.colors?.textSecondary || '#64748b',
          headerBg: clientDesign.colors?.headerBg || clientDesign.colors?.primary || school.primaryColor || '#059669',
          bg: clientDesign.colors?.bg || '#ffffff',
          gradientFrom: clientDesign.colors?.gradientFrom,
          gradientTo: clientDesign.colors?.gradientTo,
        },
        backgroundType: clientDesign.backgroundType || 'dots',
        fontFamily: clientDesign.fontFamily || 'Inter',
        fontSize: clientDesign.fontSize || 'md',
        showPhoto: clientDesign.showPhoto !== undefined ? clientDesign.showPhoto : true,
        showLogo: clientDesign.showLogo !== undefined ? clientDesign.showLogo : true,
        showQRCode: clientDesign.showQRCode !== undefined ? clientDesign.showQRCode : true,
        showBarcode: clientDesign.showBarcode !== undefined ? clientDesign.showBarcode : false,
        showSignature: clientDesign.showSignature !== undefined ? clientDesign.showSignature : true,
        showWatermark: clientDesign.showWatermark !== undefined ? clientDesign.showWatermark : true,
        showExpiryDate: clientDesign.showExpiryDate !== undefined ? clientDesign.showExpiryDate : false,
        showIssueDate: clientDesign.showIssueDate !== undefined ? clientDesign.showIssueDate : false,
        showMotto: clientDesign.showMotto !== undefined ? clientDesign.showMotto : true,
        showAddress: clientDesign.showAddress !== undefined ? clientDesign.showAddress : false,
        showEmergencyInfo: clientDesign.showEmergencyInfo !== undefined ? clientDesign.showEmergencyInfo : true,
        showMedicalInfo: clientDesign.showMedicalInfo !== undefined ? clientDesign.showMedicalInfo : true,
        showTerms: clientDesign.showTerms !== undefined ? clientDesign.showTerms : true,
        watermarkText: clientDesign.watermarkText || '',
        backText: clientDesign.backText || '',
      };
    } else {
      const design = await db.iDCardDesign.findFirst({ where: { schoolId: targetSchoolId, isDefault: true } });
      designState = {
        name: design?.name || 'Standard',
        type: (studentId ? 'student' : 'teacher') as any,
        orientation: (design?.orientation || 'landscape') as any,
        colors: {
          primary: design?.primaryColor || school.primaryColor,
          secondary: design?.secondaryColor || school.secondaryColor,
          accent: design?.accentColor || '#fbbf24',
          text: design?.textColor || '#1e293b',
          textSecondary: design?.textSecondaryColor || '#64748b',
          headerBg: design?.headerBgColor || school.primaryColor,
          bg: design?.bgColor || '#ffffff',
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
    }

    const qrSvgData = await generateQRDataUrl(
      studentId ? `skoolar://id-card/${studentId}` : `skoolar://id-card/${targetSchoolId}`
    );

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
      qrCodeDataUrl: qrSvgData,
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
        include: { user: { select: { name: true, phone: true, email: true, avatar: true } } },
      });
      if (teacher) {
        previewData.teacher = {
          id: teacher.id,
          name: teacher.user.name || '',
          employeeNo: teacher.employeeNo || '',
          photo: teacher.photo || teacher.user.avatar || null,
          department: teacher.specialization || undefined,
          designation: teacher.qualification || undefined,
          phone: teacher.user.phone || null,
          email: teacher.user.email || null,
        };
        previewData.design.type = 'teacher';
      }
    } else if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId, schoolId: targetSchoolId },
        select: { name: true, phone: true, email: true, avatar: true, role: true, bloodGroup: true, address: true },
      });
      if (user) {
        previewData.teacher = {
          id: userId,
          name: user.name || '',
          employeeNo: '',
          photo: user.avatar || null,
          department: user.role || undefined,
          designation: 'Staff',
          phone: user.phone || null,
          email: user.email || null,
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
