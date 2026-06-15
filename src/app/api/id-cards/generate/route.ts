import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { renderIDCard } from '@/lib/id-card-utils/render-card-server';
import { generateQRBase64, buildVerificationUrl } from '@/lib/id-card-utils/qr-generator';
import { generateValidationToken } from '@/lib/id-card-utils/verification';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      personIds = [],
      type = 'student',
      designId,
      orientation = 'landscape',
      colors = { primary: '#059669', secondary: '#FFFFFF' },
      issueDate = new Date().toISOString().split('T')[0],
      expiryDate = null,
      schoolId: bodySchoolId,
    } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId
      ? bodySchoolId
      : (auth.schoolId || '');

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    // Fetch design if specified
    let design: any = null;
    if (designId) {
      design = await db.iDCardDesign.findUnique({ where: { id: designId } });
    } else {
      design = await db.iDCardDesign.findFirst({ where: { schoolId: targetSchoolId, isDefault: true } });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skoolar.org';
    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      select: { name: true, logo: true, motto: true, primaryColor: true, secondaryColor: true },
    });

    const designColors = design
      ? { primary: design.primaryColor, secondary: design.secondaryColor, accent: design.accentColor, text: design.textColor, textSecondary: design.textSecondaryColor, headerBg: design.headerBgColor, bg: design.bgColor, gradientFrom: design.gradientFrom || undefined, gradientTo: design.gradientTo || undefined }
      : colors;

    const people: any[] = [];

    if (type === 'student') {
      const students = await db.student.findMany({
        where: { id: { in: personIds }, schoolId: targetSchoolId, deletedAt: null },
        include: {
          user: { select: { name: true, email: true, avatar: true } },
          class: { select: { name: true, section: true } },
        },
      });
      for (const s of students) {
        const cardData = {
          type: 'student',
          personId: s.id,
          userId: s.userId,
          fullName: s.user?.name || 'Unknown',
          displayId: s.admissionNo,
          className: s.class?.name || '',
          section: s.class?.section || '',
          gender: s.gender || '',
          bloodGroup: s.bloodGroup || '',
          dateOfBirth: s.dateOfBirth?.toISOString().split('T')[0] || '',
          house: s.house || '',
          address: s.address || '',
          photo: s.photo || s.user?.avatar || null,
          phone: '',
          email: s.user?.email || '',
        };
        people.push(cardData);
      }
    } else {
      const users = await db.user.findMany({
        where: { id: { in: personIds }, schoolId: targetSchoolId, deletedAt: null },
        include: {
          teacherProfile: true,
          accountantProfile: true,
          librarianProfile: true,
          directorProfile: true,
        },
      });
      for (const u of users) {
        let employeeNo = `USR-${u.id.slice(0, 6)}`;
        if (u.teacherProfile?.employeeNo) employeeNo = u.teacherProfile.employeeNo;
        else if (u.accountantProfile?.employeeNo) employeeNo = u.accountantProfile.employeeNo;
        else if (u.librarianProfile?.employeeNo) employeeNo = u.librarianProfile.employeeNo;
        else if (u.directorProfile?.employeeNo) employeeNo = u.directorProfile.employeeNo;

        const personType = u.role === 'TEACHER' ? 'teacher' : 'staff';
        people.push({
          type: personType,
          personId: u.id,
          userId: u.id,
          fullName: u.name || 'Unknown',
          displayId: employeeNo,
          role: u.role,
          department: u.teacherProfile?.specialization || '',
          gender: u.gender || '',
          bloodGroup: u.bloodGroup || '',
          dateOfBirth: u.dateOfBirth?.toISOString().split('T')[0] || '',
          phone: u.phone || '',
          email: u.email || '',
          photo: u.avatar || null,
          address: u.address || '',
        });
      }
    }

    const generatedCards: any[] = [];
    for (const p of people) {
      try {
        const uuid = crypto.randomUUID();
        const validationToken = generateValidationToken();
        const personType = p.type || type;

        const qrData = await generateQRBase64({
          type: personType,
          userId: p.userId || '',
          personId: p.personId || '',
          schoolId: targetSchoolId,
          cardId: uuid,
          uuid,
          validationToken,
          name: p.fullName,
          role: p.role || personType,
        });

        const verificationUrl = buildVerificationUrl(baseUrl, uuid);

        const card = await db.iDCard.create({
          data: {
            schoolId: targetSchoolId,
            designId: design?.id || null,
            personType,
            personId: p.personId,
            userId: p.userId,
            fullName: p.fullName,
            displayId: p.displayId,
            role: p.role || '',
            department: p.department || '',
            className: p.className || '',
            section: p.section || '',
            gender: p.gender || '',
            dateOfBirth: p.dateOfBirth || '',
            bloodGroup: p.bloodGroup || '',
            phone: p.phone || '',
            email: p.email || '',
            address: p.address || '',
            house: p.house || '',
            uuid,
            validationToken,
            verificationUrl,
            issueDate: new Date(issueDate),
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            issuedBy: auth.userId || auth.id,
            qrCodeData: qrData,
            isActive: true,
            status: 'active',
          },
        });

        generatedCards.push(card);
      } catch (err) {
        console.error(`Failed to generate card for ${p.fullName}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: generatedCards,
      count: generatedCards.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
