import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { renderIDCard } from '@/lib/id-card-utils/render-card-server';
import { requireAuth } from '@/lib/auth-middleware';
import { generateQRBase64 } from '@/lib/id-card-utils/qr-generator';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { format, scope = 'both', orientation = 'landscape', cards: bodyCards, type = 'student' } = body;
    const bulkColors = body.colors || { primary: '#059669', secondary: '#FFFFFF' };

    const userRole = auth.role;
    const targetSchoolId = userRole === 'SUPER_ADMIN'
      ? (body.schoolId || bodyCards?.[0]?.schoolId || '')
      : (auth.schoolId || '');

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School not determined' }, { status: 403 });
    }

    const exportSchool = await db.school.findUnique({
      where: { id: targetSchoolId },
      select: { name: true, logo: true, motto: true },
    });

    if (userRole !== 'SUPER_ADMIN') {
      if (auth.schoolId !== targetSchoolId)
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      if ((userRole === 'TEACHER' || userRole === 'ACCOUNTANT' || userRole === 'LIBRARIAN') && bodyCards?.some((c: any) => c.type !== 'student' && c.userId !== auth.userId))
        return NextResponse.json({ error: 'You can only export your own card' }, { status: 403 });
    }

    let cards = bodyCards;
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      if (type.startsWith('staff') || type === 'teacher') {
        const staffWhere: any = { schoolId: targetSchoolId, deletedAt: null, role: { notIn: ['STUDENT', 'PARENT'] } };
        if (type === 'teacher') staffWhere.role = 'TEACHER';
        const allStaff = await db.user.findMany({
          where: staffWhere,
          include: { teacherProfile: true, accountantProfile: true, librarianProfile: true, directorProfile: true },
        });
        cards = allStaff.map((u) => {
          let employeeNo = `USR-${u.id.slice(0, 6)}`;
          if (u.teacherProfile?.employeeNo) employeeNo = u.teacherProfile.employeeNo;
          else if (u.accountantProfile?.employeeNo) employeeNo = u.accountantProfile.employeeNo;
          else if (u.librarianProfile?.employeeNo) employeeNo = u.librarianProfile.employeeNo;
          else if (u.directorProfile?.employeeNo) employeeNo = u.directorProfile.employeeNo;
          return {
            type: u.role === 'TEACHER' ? 'teacher' : 'staff',
            personId: u.id,
            userId: u.id,
            displayId: employeeNo,
            name: u.name || 'Unknown',
            role: u.role,
            phone: u.phone || '',
            photo: u.avatar,
            schoolId: u.schoolId,
            colors: bulkColors,
            backText: '',
            showPhoto: true,
            showQR: true,
            orientation,
          };
        });
      } else {
        const allStudents = await db.student.findMany({
          where: { schoolId: targetSchoolId, deletedAt: null, isActive: true },
          include: { user: { select: { name: true } }, class: { select: { name: true, section: true } } },
        });
        cards = allStudents.map((student) => ({
          type: 'student',
          personId: student.id,
          userId: student.userId,
          displayId: student.admissionNo,
          name: student.user?.name || 'Unknown',
          class: student.class?.name || 'N/A',
          gender: student.gender,
          photo: student.photo,
          schoolId: student.schoolId,
          colors: bulkColors,
          backText: '',
          showPhoto: true,
          showQR: true,
          orientation,
        }));
      }
      if (!cards || cards.length === 0) {
        return NextResponse.json({ error: 'No people found' }, { status: 404 });
      }
    }

    const exportLog = await db.exportLog.create({
      data: {
        schoolId: targetSchoolId,
        userId: auth.userId || auth.id,
        type: 'id_cards',
        format,
        filename: `id-cards-${Date.now()}`,
        status: 'processing',
      },
    });

    async function renderCard(cardData: any, back: boolean): Promise<Buffer> {
      const role = cardData.type === 'student' ? 'STUDENT' : (cardData.role || 'STAFF');
      const person = { ...cardData, id: cardData.personId || cardData.id, type: cardData.type || 'student' };

      let qrData = '';
      if (!back && cardData.showQR !== false) {
        qrData = await generateQRBase64({
          type: person.type,
          userId: cardData.userId || '',
          personId: cardData.personId || '',
          schoolId: targetSchoolId,
          uuid: `export-${Date.now()}`,
          validationToken: 'export',
          name: cardData.name || 'Unknown',
          role,
        });
      }

      return renderIDCard(person, {
        colors: cardData.colors || bulkColors,
        showPhoto: !back && cardData.showPhoto !== false,
        showLogo: true,
        showQR: !back && cardData.showQR !== false,
        showBarcode: false,
        showSignature: true,
        showWatermark: false,
        showMotto: true,
        showExpiryDate: false,
        showIssueDate: true,
        orientation,
        photoUrl: back ? null : (cardData.photo || null),
        qrData,
        isBack: back,
        role,
        backText: cardData.backText || '',
        issueDate: null,
        expiryDate: null,
        schoolLogo: exportSchool?.logo || null,
        schoolName: exportSchool?.name || '',
        motto: exportSchool?.motto || '',
      });
    }

    const needFront = scope === 'front' || scope === 'both';
    const needBack = scope === 'back' || scope === 'both';

    // PDF
    if (format === 'pdf') {
      try {
        const { PDFDocument } = await import('pdf-lib');
        const cardWidthMm = orientation === 'portrait' ? 53.98 : 85.6;
        const cardHeightMm = orientation === 'portrait' ? 85.6 : 53.98;
        const cardW = Math.round(cardWidthMm * 72 / 25.4);
        const cardH = Math.round(cardHeightMm * 72 / 25.4);

        const pdfDoc = await PDFDocument.create();
        for (const cardData of cards) {
          try {
            if (needFront) {
              const buf = await renderCard(cardData, false);
              if (buf && buf.length > 0) {
                const pngImg = await pdfDoc.embedPng(buf);
                const page = pdfDoc.addPage([cardW, cardH]);
                page.drawImage(pngImg, { x: 0, y: 0, width: cardW, height: cardH });
              }
            }
            if (needBack) {
              const buf = await renderCard(cardData, true);
              if (buf && buf.length > 0) {
                const pngImg = await pdfDoc.embedPng(buf);
                const page = pdfDoc.addPage([cardW, cardH]);
                page.drawImage(pngImg, { x: 0, y: 0, width: cardW, height: cardH });
              }
            }
          } catch (cardErr) {
            console.error(`Card render failed for ${cardData.name}:`, cardErr);
          }
        }

        const pdfBytes = await pdfDoc.save();
        const pdfBuffer = Buffer.from(pdfBytes);

        await db.exportLog.update({
          where: { id: exportLog.id },
          data: { fileSize: pdfBuffer.length, status: 'success', filename: `id-cards-${Date.now()}.pdf` },
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="id-cards-${Date.now()}.pdf"`,
            'Content-Length': pdfBuffer.length.toString(),
          },
        });
      } catch (pdfErr) {
        await db.exportLog.update({ where: { id: exportLog.id }, data: { status: 'failed' } });
        return NextResponse.json({ error: `PDF failed: ${pdfErr instanceof Error ? pdfErr.message : 'Unknown'}` }, { status: 500 });
      }
    }

    // PNG ZIP
    if (format === 'png') {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();
      for (const cardData of cards) {
        const safeName = (cardData.name || 'card').replace(/[^a-z0-9]/gi, '_');
        try {
          if (needFront) zip.addFile(`${safeName}-front.png`, await renderCard(cardData, false));
          if (needBack) zip.addFile(`${safeName}-back.png`, await renderCard(cardData, true));
        } catch (ce) {
          console.error(`PNG export failed for ${cardData.name}:`, ce);
        }
      }
      const zipBuffer = zip.toBuffer();
      await db.exportLog.update({ where: { id: exportLog.id }, data: { fileSize: zipBuffer.length, status: 'success', filename: `id-cards-${Date.now()}.zip` } });
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="id-cards-${Date.now()}.zip"` },
      });
    }

    // CSV
    if (format === 'csv') {
      const header = ['Name', 'ID', 'Type', 'Class/Role', 'Gender/Phone', 'School ID'].join(',');
      const rows = cards.map((c: any) => {
        const name = `"${(c.name || '').replace(/"/g, '""')}"`;
        const id = `"${(c.displayId || c.admissionNo || c.employeeNo || '').replace(/"/g, '""')}"`;
        const cardType = c.type || 'student';
        const classRole = `"${(c.class || c.role || '').replace(/"/g, '""')}"`;
        const genderPhone = `"${(c.gender || c.phone || '').replace(/"/g, '""')}"`;
        const schoolId = `"${(c.schoolId || '').replace(/"/g, '""')}"`;
        return [name, id, cardType, classRole, genderPhone, schoolId].join(',');
      });
      const csv = [header, ...rows].join('\r\n');
      const csvBuffer = Buffer.from('\uFEFF' + csv, 'utf8');
      await db.exportLog.update({ where: { id: exportLog.id }, data: { fileSize: csvBuffer.length, status: 'success', filename: `id-cards-${Date.now()}.csv` } });
      return new NextResponse(new Uint8Array(csvBuffer), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="id-cards-${Date.now()}.csv"` },
      });
    }

    await db.exportLog.update({ where: { id: exportLog.id }, data: { status: 'failed' } });
    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
