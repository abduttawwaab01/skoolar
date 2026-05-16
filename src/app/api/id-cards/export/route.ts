import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { renderIDCard } from '@/lib/id-card-utils/render-card';

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { format, scope = 'both', orientation = 'portrait', cards } = body;

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: 'No cards provided' }, { status: 400 });
    }

    const userRole     = token.role as string;
    const userSchoolId = token.schoolId as string;
    const targetSchoolId = cards[0].schoolId as string;

    if (userRole !== 'SUPER_ADMIN') {
      if (userSchoolId !== targetSchoolId)
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      if (userRole === 'TEACHER' && cards.some((c: any) => c.type === 'staff'))
        return NextResponse.json({ error: 'Teachers can only export student ID cards' }, { status: 403 });
    }

    const exportLog = await db.exportLog.create({
      data: {
        schoolId:  targetSchoolId,
        userId:    token.id as string,
        type:      'id_cards',
        format,
        filename:  `id-cards-${new Date().toISOString().split('T')[0]}`,
        status:    'processing',
      },
    });

    // ─── helper: render one card buffer ─────────────────────────────────────
    async function renderCard(cardData: any, back: boolean): Promise<Buffer> {
      const role = cardData.type === 'student' ? 'STUDENT' : (cardData.role || 'STAFF');
      const normalized = { ...cardData, id: cardData.personId || cardData.id, type: cardData.type || 'student' };
      return renderIDCard(
        normalized,
        cardData.colors || { primary: '#059669', secondary: '#FFFFFF' },
        cardData.backText || '',
        back ? false : (cardData.showPhoto !== false),
        back ? false : (cardData.showBarcode !== false),
        back ? false : (cardData.showQR !== false),
        orientation,
        back ? null : (cardData.photo || null),
        role,
        back,
      );
    }

    const needFront = scope === 'front' || scope === 'both';
    const needBack  = scope === 'back'  || scope === 'both';

// ─── PDF ─────────────────────────────────────────────────────────────────
    if (format === 'pdf') {
      try {
        const PDFDocument = (await import('pdfkit')).default;

        // Card dimensions in points (72 points per inch)
        // CRITICAL: Precise dimensions for printing.
        // Landscape: 85.6mm x 53.98mm, Portrait: 53.98mm x 85.6mm
        const cardWidthMm   = orientation === 'portrait' ? 53.98 : 85.6;
        const cardHeightMm  = orientation === 'portrait' ? 85.6  : 53.98;
        const cardWidthPt   = (cardWidthMm  / 25.4) * 72;
        const cardHeightPt  = (cardHeightMm / 25.4) * 72;

        const doc = new PDFDocument({ 
          size: [cardWidthPt, cardHeightPt], 
          compress: true, 
          autoFirstPage: false, 
          margin: 0,
          info: { Title: 'Skoolar ID Cards Export', Author: 'Skoolar' }
        });

        for (const cardData of cards) {
          try {
            if (needFront) {
              const buf = await renderCard(cardData, false);
              if (buf && buf.length > 0) {
                doc.addPage({ size: [cardWidthPt, cardHeightPt], margin: 0 });
                // Sharp PNGs are at 300 DPI, we fit them exactly to the point-based page size
                doc.image(buf, 0, 0, {
                  fit: [cardWidthPt, cardHeightPt],
                  align: 'center',
                  valign: 'center'
                });
              }
            }
            if (needBack) {
              const buf = await renderCard(cardData, true);
              if (buf && buf.length > 0) {
                doc.addPage({ size: [cardWidthPt, cardHeightPt], margin: 0 });
                doc.image(buf, 0, 0, {
                  fit: [cardWidthPt, cardHeightPt],
                  align: 'center',
                  valign: 'center'
                });
              }
            }
          } catch (cardErr) {
            console.error(`Card render failed for ${cardData.name}:`, cardErr);
            doc.addPage({ size: [cardWidthPt, cardHeightPt], margin: 0 });
            doc.fontSize(8).text(`Failed to render card for: ${cardData.name || 'unknown student'}`, 5, cardHeightPt / 2 - 4, { align: 'center', width: cardWidthPt - 10 });
          }
        }

        const chunks: Buffer[] = [];
        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
          doc.on('data', (chunk: Buffer) => chunks.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', (err) => reject(err));
          doc.end();
        });

        await db.exportLog.update({
          where: { id: exportLog.id },
          data: { fileSize: pdfBuffer.length, status: 'success', filename: `id-cards-${Date.now()}.pdf` }
        });

        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="id-cards-${Date.now()}.pdf"`,
            'Content-Length': pdfBuffer.length.toString()
          },
        });
      } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr);
        await db.exportLog.update({ where: { id: exportLog.id }, data: { status: 'failed' } });
        return NextResponse.json({ error: `PDF generation failed: ${pdfErr instanceof Error ? pdfErr.message : 'Unknown error'}` }, { status: 500 });
      }
    }

    // ─── PNG (ZIP) ────────────────────────────────────────────────────────────
    if (format === 'png') {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();
      for (const cardData of cards) {
        const safeName = (cardData.name || 'card').replace(/[^a-z0-9]/gi, '_');
        if (needFront) { zip.addFile(`${safeName}-front.png`, await renderCard(cardData, false)); }
        if (needBack)  { zip.addFile(`${safeName}-back.png`,  await renderCard(cardData, true)); }
      }
      const zipBuffer = zip.toBuffer();
      await db.exportLog.update({ where: { id: exportLog.id }, data: { fileSize: zipBuffer.length, status: 'success', filename: `id-cards-${Date.now()}.zip` } });
      return new NextResponse(zipBuffer, {
        headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="id-cards-${Date.now()}.zip"` },
      });
    }

    // ─── DOCX ─────────────────────────────────────────────────────────────────
    if (format === 'docx') {
      const { Document, Packer, Paragraph, ImageRun, AlignmentType, PageOrientation } = await import('docx');

      const cardWidthMm  = orientation === 'portrait' ? 53.98 : 85.6;
      const cardHeightMm = orientation === 'portrait' ? 85.6  : 53.98;
      // EMU: 1 inch = 914400 EMU, 1 mm = 36000 EMU
      const cardWidthEmu  = Math.round(cardWidthMm  * 36000);
      const cardHeightEmu = Math.round(cardHeightMm * 36000);

      const sections: any[] = [];

      for (let i = 0; i < cards.length; i++) {
        const cardData = cards[i];
        const cardSections: any[] = [];

        if (needFront) {
          const buf = await renderCard(cardData, false);
          cardSections.push({
            properties: {
              page: {
                size: {
                  width: Math.round(210 * 36000),
                  height: Math.round(297 * 36000),
                  orientation: PageOrientation.PORTRAIT,
                },
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: buf,
                    transformation: { width: Math.round(cardWidthMm * 2.835), height: Math.round(cardHeightMm * 2.835) },
                    type: 'png',
                  }),
                ],
              }),
            ],
          });
        }

        if (needBack) {
          const buf = await renderCard(cardData, true);
          cardSections.push({
            properties: {
              page: {
                size: {
                  width: Math.round(210 * 36000),
                  height: Math.round(297 * 36000),
                  orientation: PageOrientation.PORTRAIT,
                },
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: buf,
                    transformation: { width: Math.round(cardWidthMm * 2.835), height: Math.round(cardHeightMm * 2.835) },
                    type: 'png',
                  }),
                ],
              }),
            ],
          });
        }

        sections.push(...cardSections);
      }

      const doc = new Document({ sections });
      const docxBuffer = await Packer.toBuffer(doc);

      await db.exportLog.update({ where: { id: exportLog.id }, data: { fileSize: docxBuffer.length, status: 'success', filename: `id-cards-${Date.now()}.docx` } });

      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="id-cards-${Date.now()}.docx"`,
        },
      });
    }

    // ─── CSV ──────────────────────────────────────────────────────────────────
    if (format === 'csv') {
      const header = ['Name', 'ID', 'Type', 'Class / Role', 'Gender / Phone', 'School ID'].join(',');
      const rows = cards.map((c: any) => {
        const name      = `"${(c.name || '').replace(/"/g, '""')}"`;
        const id        = `"${(c.displayId || c.admissionNo || c.employeeNo || '').replace(/"/g, '""')}"`;
        const type      = c.type || 'student';
        const classRole = `"${(c.class || c.role || '').replace(/"/g, '""')}"`;
        const genderPhone = `"${(c.gender || c.phone || '').replace(/"/g, '""')}"`;
        const schoolId  = `"${(c.schoolId || '').replace(/"/g, '""')}"`;
        return [name, id, type, classRole, genderPhone, schoolId].join(',');
      });
      const csv = [header, ...rows].join('\r\n');
      const csvBuffer = Buffer.from('\uFEFF' + csv, 'utf8'); // BOM for Excel

      await db.exportLog.update({ where: { id: exportLog.id }, data: { fileSize: csvBuffer.length, status: 'success', filename: `id-cards-${Date.now()}.csv` } });

      return new NextResponse(csvBuffer, {
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
