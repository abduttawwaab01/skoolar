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
    const { schoolId: paramSchoolId, personIds } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && paramSchoolId
      ? paramSchoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      select: { id: true, name: true, logo: true, motto: true, address: true, phone: true, email: true, website: true, primaryColor: true, secondaryColor: true },
    });
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const design = await db.iDCardDesign.findFirst({ where: { schoolId: targetSchoolId, isDefault: true } });

    const defaultDesign = {
      name: design?.name || 'Standard',
      type: 'student' as any,
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
      fontFamily: design?.fontFamily || 'Inter',
      fontSize: (design?.fontSize || 'md') as any,
      showPhoto: design?.showPhoto ?? true,
      showLogo: design?.showLogo ?? true,
      showQRCode: design?.showQRCode ?? true,
      showBarcode: design?.showBarcode ?? false,
      showClass: (design as any)?.showClass ?? true,
      showSection: (design as any)?.showSection ?? false,
      showSession: (design as any)?.showSession ?? false,
      showPhone: (design as any)?.showPhone ?? false,
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
      showEmail: true, showParentInfo: true, showPersonalAddress: true,
      backText: design?.backText || '',
    };

    let people: Array<{ id: string; displayId: string; fullName: string; personType: string; className?: string; section?: string; gender?: string; dateOfBirth?: string; bloodGroup?: string; house?: string; photo?: string | null; emergencyContact?: string | null; department?: string; designation?: string }> = [];

    async function fetchPerson(id: string): Promise<typeof people[0] | null> {
      const student = await db.student.findUnique({
        where: { id },
        include: { user: { select: { name: true } }, class: { select: { name: true, section: true } } },
      });
      if (student) return {
        id: student.id, displayId: student.admissionNo || '',
        fullName: student.user?.name || '', personType: 'student',
        className: student.class?.name || undefined, section: student.class?.section || undefined,
        gender: student.gender || undefined, dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0],
        bloodGroup: student.bloodGroup || undefined, house: student.house || undefined,
        photo: student.photo || null, emergencyContact: student.emergencyContact || null,
      };
      const teacher = await db.teacher.findUnique({
        where: { id },
        include: { user: { select: { name: true } } },
      });
      if (teacher) return {
        id: teacher.id, displayId: teacher.employeeNo || '',
        fullName: teacher.user?.name || '', personType: 'teacher',
        department: teacher.specialization || undefined, designation: teacher.designation || undefined,
      };
      return null;
    }

    if (personIds && personIds.length > 0) {
      const results = await Promise.all(personIds.map(fetchPerson));
      people = results.filter((p): p is NonNullable<typeof p> => p !== null);
    } else {
      const [students, teachers] = await Promise.all([
        db.student.findMany({
          where: { schoolId: targetSchoolId, isActive: true },
          include: { user: { select: { name: true } }, class: { select: { name: true, section: true } } },
        }),
        db.teacher.findMany({
          where: { schoolId: targetSchoolId, isActive: true },
          include: { user: { select: { name: true } } },
        }),
      ]);
      people = [
        ...students.map(s => ({
          id: s.id, displayId: s.admissionNo || '',
          fullName: s.user?.name || '', personType: 'student' as const,
          className: s.class?.name || undefined, section: s.class?.section || undefined,
          gender: s.gender || undefined, dateOfBirth: s.dateOfBirth?.toISOString().split('T')[0],
          bloodGroup: s.bloodGroup || undefined, house: s.house || undefined,
          photo: s.photo || null, emergencyContact: s.emergencyContact || null,
        })),
        ...teachers.map(t => ({
          id: t.id, displayId: t.employeeNo || '',
          fullName: t.user?.name || '', personType: 'teacher' as const,
          department: t.specialization || undefined, designation: t.designation || undefined,
        })),
      ];
    }

    const defaultIsLand = (defaultDesign.orientation || 'landscape') === 'landscape';
    const defaultCw = defaultIsLand ? 85.6 : 53.98;
    const defaultCh = defaultIsLand ? 53.98 : 85.6;

    const cardsHtml = await Promise.all(people.map(async (p, idx) => {
      const personData: any = {
        id: p.id,
        name: p.fullName,
        admissionNo: p.displayId,
        className: p.className,
        section: p.section,
        gender: p.gender,
        dateOfBirth: p.dateOfBirth,
        bloodGroup: p.bloodGroup,
        house: p.house,
        photo: p.photo,
        emergencyContact: p.emergencyContact,
      };

      const previewData: IDCardPreviewData = {
        school: {
          id: school.id, name: school.name, logo: school.logo, motto: school.motto,
          address: school.address, phone: school.phone, email: school.email,
          website: school.website, primaryColor: school.primaryColor, secondaryColor: school.secondaryColor,
        },
        design: { ...defaultDesign, type: p.personType === 'teacher' ? 'teacher' : 'student' },
        serialNumber: `SKL-${(idx + 1).toString().padStart(4, '0')}`,
      };

      if (p.personType === 'teacher') {
        previewData.teacher = {
          id: p.id, name: p.fullName, employeeNo: p.displayId,
          department: p.department, designation: p.designation,
        };
      } else {
        previewData.student = personData;
      }

      const front = await renderIDCardPreview(previewData);
      const back = await renderIDCardBack(previewData);

      return { name: p.fullName, front, back };
    }));

    const combinedHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>ID Cards Batch Export</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', system-ui, sans-serif; padding: 10mm; background: #f1f5f9; }
.card-page { page-break-after: always; margin-bottom: 8mm; }
.card-page:last-child { page-break-after: avoid; }
.card-pair { display: flex; flex-direction: column; align-items: center; gap: 4mm; background: #fff; padding: 5mm; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.card-label { font-size: 9pt; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.card-front, .card-back { width: ${defaultCw}mm; height: ${defaultCh}mm; overflow: hidden; border-radius: 2px; }
.person-name { font-size: 10pt; font-weight: 700; color: #1e293b; margin-top: 2mm; }
@media print {
  @page { margin: 8mm; }
  body { padding: 0; background: #fff; }
  .card-page { margin-bottom: 0; box-shadow: none; }
  .card-pair { box-shadow: none; padding: 2mm; }
}
</style>
</head>
<body>
${cardsHtml.map(c => `
<div class="card-page">
  <div class="card-pair">
    <div class="person-name">${c.name}</div>
    <div class="card-label">Front</div>
    <div class="card-front">${c.front}</div>
    <div class="card-label" style="margin-top:2mm">Back</div>
    <div class="card-back">${c.back}</div>
  </div>
</div>`).join('\n')}
</body>
</html>`;

    return new NextResponse(combinedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="ID-Cards-Batch-Export.html"`,
      },
    });
  } catch (error) {
    console.error('POST /api/id-cards/export/batch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
