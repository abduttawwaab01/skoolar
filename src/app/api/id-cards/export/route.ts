import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';
import { renderIDCard } from '@/lib/id-card-utils/render-card';

// POST /api/id-cards/export - Batch export ID cards
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      format, // 'pdf' or 'png'
      scope, // 'front', 'back', 'both'
      orientation = 'portrait',
      cards 
    } = body;

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: 'No cards provided for export' }, { status: 400 });
    }

    // Role-based permission check
    const userRole = token.role;
    const userSchoolId = token.schoolId;
    const targetSchoolId = cards[0].schoolId;

    // SUPER_ADMIN can export any school
    if (userRole !== 'SUPER_ADMIN') {
      // SCHOOL_ADMIN and TEACHER must belong to the school they're exporting from
      if (userSchoolId !== targetSchoolId) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      // TEACHER can only export students, not staff
      if (userRole === 'TEACHER') {
        const hasStaff = cards.some(card => card.type === 'staff');
        if (hasStaff) {
          return NextResponse.json({ error: 'Teachers can only export student ID cards' }, { status: 403 });
        }
      }
    }

    // Create export log
    const exportLog = await db.exportLog.create({
      data: {
        schoolId: targetSchoolId,
        userId: token.id,
        type: 'id_cards',
        format: format,
        filename: `id-cards-${new Date().toISOString().split('T')[0]}`,
        status: 'processing',
      },
    });

    if (format === 'pdf') {
      // Generate PDF
      const doc = new PDFDocument({
        size: orientation === 'portrait' ? [85.6, 53.98] : [53.98, 85.6],
        layout: 'portrait',
        compress: true,
        autoFirstPage: false,
      });

      // Add each card as a page (2 pages if both sides)
      for (const cardData of cards) {
        const role = cardData.type === 'student' ? 'STUDENT' : (cardData.role || 'STAFF');
        
        // Front
        const frontBuffer = await renderIDCard(
          cardData,
          cardData.colors || { primary: '#059669', secondary: '#FFFFFF' },
          cardData.backText || '',
          cardData.showPhoto !== false,
          cardData.showBarcode !== false,
          cardData.showQR !== false,
          orientation,
          cardData.photo,
          role
        );
        
        doc.addPage({ size: [85.6, 53.98], layout: 'portrait' });
        doc.image(frontBuffer, 0, 0, { width: 85.6, height: 53.98 });
        
        // Back (if requested)
        if (scope === 'both' || scope === 'back') {
          const backBuffer = await renderIDCard(
            { ...cardData, name: '' },
            cardData.colors || { primary: '#059669', secondary: '#FFFFFF' },
            cardData.backText || '',
            false,
            false,
            false,
            orientation,
            null,
            role,
            true
          );
          doc.addPage({ size: [85.6, 53.98], layout: 'portrait' });
          doc.image(backBuffer, 0, 0, { width: 85.6, height: 53.98 });
        }
      }

      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
      });

      // Update export log
      await db.exportLog.update({
        where: { id: exportLog.id },
        data: {
          fileSize: pdfBuffer.length,
          status: 'success',
          filename: `id-cards-${Date.now()}.pdf`,
        },
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="id-cards-${Date.now()}.pdf"`,
        },
      });
    } else {
      // PNG export - create ZIP file with individual card images
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();
      
      for (const cardData of cards) {
        const role = cardData.type === 'student' ? 'STUDENT' : (cardData.role || 'STAFF');
        
        // Front
        if (scope === 'front' || scope === 'both') {
          const frontBuffer = await renderIDCard(
            cardData,
            cardData.colors || { primary: '#059669', secondary: '#FFFFFF' },
            cardData.backText || '',
            cardData.showPhoto !== false,
            cardData.showBarcode !== false,
            cardData.showQR !== false,
            orientation,
            cardData.photo,
            role
          );
          const filename = `${cardData.name || 'card'}-front.png`;
          zip.addFile(filename, frontBuffer);
        }
        
        // Back
        if (scope === 'back' || scope === 'both') {
          const backBuffer = await renderIDCard(
            { ...cardData, name: '' },
            cardData.colors || { primary: '#059669', secondary: '#FFFFFF' },
            cardData.backText || '',
            false,
            false,
            false,
            orientation,
            null,
            role,
            true
          );
          const filename = `${cardData.name || 'card'}-back.png`;
          zip.addFile(filename, backBuffer);
        }
      }
      
      const zipBuffer = zip.toBuffer();
      
      // Update export log
      await db.exportLog.update({
        where: { id: exportLog.id },
        data: {
          fileSize: zipBuffer.length,
          status: 'success',
          filename: `id-cards-${Date.now()}.zip`,
        },
      });
      
      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="id-cards-${Date.now()}.zip"`,
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
