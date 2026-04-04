import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import PDFDocument from 'pdfkit';
import { PNG } from 'pngjs';
import { Buffer } from 'buffer';
import QRCode from 'qrcode';
import sharp from 'sharp';

// GET /api/id-cards - List available cards for user
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'student'; // 'student' or 'staff'
    const schoolId = token.role === 'SUPER_ADMIN' ? searchParams.get('schoolId') : token.schoolId;

    if (!schoolId && token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      schoolId,
      deletedAt: null,
    };

    if (type === 'student') {
      const students = await db.student.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          class: { select: { name: true, section: true } },
        },
        orderBy: { admissionNo: 'asc' },
      });
      return NextResponse.json({ data: students, type: 'student' });
    } else {
      const staff = await db.teacher.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { employeeNo: 'asc' },
      });
      return NextResponse.json({ data: staff, type: 'staff' });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/id-cards/generate - Generate single ID card image
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      type, // 'student' or 'staff'
      personId, 
      schoolId,
      colors = {}, 
      backText = '',
      showPhoto = true,
      showBarcode = true,
      showQR = true,
      orientation = 'portrait' 
    } = body;

    // Fetch person data
    let person: any = null;
    let photoUrl: string | null = null;

    if (type === 'student') {
      const student = await db.student.findUnique({
        where: { id: personId },
        include: {
          user: { select: { name: true } },
          class: { select: { name: true } },
        },
      });
      if (!student) throw new Error('Student not found');
      person = {
        ...student,
        displayId: student.admissionNo,
        class: student.class?.name || 'N/A',
        gender: student.gender,
        role: 'STUDENT',
      };
      photoUrl = student.photo;
    } else {
      const staff = await db.teacher.findUnique({
        where: { id: personId },
        include: {
          user: { select: { name: true } },
        },
      });
      if (!staff) throw new Error('Staff not found');
      person = {
        ...staff,
        displayId: staff.employeeNo,
        role: staff.qualification?.toUpperCase() || 'TEACHER',
        phone: staff.phone,
      };
      photoUrl = staff.photo;
    }

    // Get school settings for colors if not provided
    let schoolColors = colors;
    if (!colors.primary || !colors.secondary) {
      const school = await db.school.findUnique({
        where: { id: schoolId || person.schoolId },
        select: { primaryColor: true, secondaryColor: true, name: true },
      });
      if (school) {
        schoolColors = {
          primary: colors.primary || school.primaryColor || '#059669',
          secondary: colors.secondary || school.secondaryColor || '#FFFFFF',
        };
      }
    }

    // Generate card image using Sharp
    const cardBuffer = await renderIDCard(person, schoolColors, backText, showPhoto, showBarcode, showQR, orientation, photoUrl, person.role);

    return NextResponse.json({ 
      success: true, 
      data: cardBuffer.toString('base64'),
      contentType: 'image/png'
    }, {
      headers: {
        'Content-Type': 'image/png',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/id-cards/export - Batch export ID cards
export async function exportRoute(request: NextRequest) {
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

// Helper function to render ID card as PNG using Sharp
async function renderIDCard(
  person: any,
  colors: { primary: string; secondary: string },
  backText: string,
  showPhoto: boolean,
  showBarcode: boolean,
  showQR: boolean,
  orientation: string,
  photoUrl: string | null,
  role: string,
  isBack = false
): Promise<Buffer> {
  const isPortrait = orientation === 'portrait';
  const width = isPortrait ? 856 : 540;
  const height = isPortrait ? 540 : 856;
  
  // Generate QR code as base64 PNG if needed
  let qrBase64 = '';
  if (showQR && !isBack) {
    const qrData = JSON.stringify({
      type: person.type || 'student',
      id: person.displayId,
      userId: person.userId,
      personId: person.id,
      schoolId: person.schoolId,
      name: person.name,
      role: role,
      timestamp: Date.now(),
    });
    try {
      const qrBuffer = await QRCode.toBuffer(qrData, {
        width: 140,
        margin: 2,
        color: {
          dark: colors.primary,
          light: colors.secondary,
        },
      });
      qrBase64 = qrBuffer.toString('base64');
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  }
  
  // Fetch actual school info
  let schoolName = "School";
  let schoolAddress = "Address";
  let schoolPhone = "Phone";
  
  if (person.schoolId) {
    const school = await db.school.findUnique({
      where: { id: person.schoolId },
      select: { name: true, address: true, phone: true, email: true },
    });
    if (school) {
      schoolName = school.name || "School";
      schoolAddress = school.address || "Address";
      schoolPhone = school.phone || school.email || "Phone";
    }
  }
  
  // Base SVG template
  const initials = person.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'NA';
  const displayId = person.displayId || 'N/A';
  const className = person.class || 'N/A';
  const gender = person.gender || 'N/A';
  const phone = person.phone || '';
  
  // For back side
  if (isBack) {
    const backSVG = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="backHeader" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${adjustColor(colors.primary, -15)};stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="100%" height="100%" fill="${colors.secondary}"/>
        
        <!-- Header -->
        <rect x="0" y="0" width="100%" height="45" fill="url(#backHeader)"/>
        <text x="${width/2}" y="28" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="white" text-anchor="middle">
          ${schoolName}
        </text>
        
        <!-- Contact Info -->
        <text x="30" y="70" font-family="Arial, sans-serif" font-size="8" fill="#444">
          📍 ${schoolAddress} | 📞 ${schoolPhone}
        </text>
        
        <!-- Divider -->
        <line x1="20" y1="85" x2="${width-20}" y2="85" stroke="${colors.primary}" stroke-width="1" opacity="0.3"/>
        
        <!-- Back Text -->
        <text x="30" y="105" font-family="Arial, sans-serif" font-size="7.5" fill="#555">
          ${backText.replace(/\n/g, '&#xa;')}
        </text>
        
        <!-- Footer -->
        <line x1="20" y1="${height-50}" x2="${width-20}" y2="${height-50}" stroke="${colors.primary}" stroke-width="1" opacity="0.3"/>
        <text x="${width/2}" y="${height-38}" font-family="Arial, sans-serif" font-size="7" fill="#888" text-anchor="middle">
          Academic Year: ${new Date().getFullYear()}/${new Date().getFullYear()+1}
        </text>
        <text x="${width/2}" y="${height-25}" font-family="Arial, sans-serif" font-size="6" fill="#aaa" text-anchor="middle">
          Emergency Contact: ${schoolPhone}
        </text>
        
        <!-- Watermark -->
        <text x="${width-30}" y="${height-12}" font-family="Arial, sans-serif" font-size="5" fill="#ccc" text-anchor="end">
          SKOOLAR | ${schoolName}
        </text>
      </svg>
    `;
    
    const buffer = Buffer.from(backSVG);
    return sharp(buffer).png().toBuffer();
  }

  // Front side - Professional Design
  const photoSize = isPortrait ? 90 : 70;
  const photoX = isPortrait ? 25 : 25;
  const photoY = isPortrait ? 75 : 65;
  
  const textStartX = isPortrait ? 130 : 110;
  const textStartY = isPortrait ? 85 : 75;
  
  // Build photo section - show actual photo or placeholder
  let photoSection = '';
  if (showPhoto && photoUrl) {
    // Fetch the photo from URL and convert to base64 for embedding
    let photoBase64 = '';
    try {
      const photoRes = await fetch(photoUrl);
      if (photoRes.ok) {
        const photoBuffer = await photoRes.arrayBuffer();
        const photoArray = new Uint8Array(photoBuffer);
        // Detect content type from URL or default to JPEG
        const contentType = photoUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1] || 'jpeg';
        const mimeType = contentType === 'png' ? 'image/png' : contentType === 'gif' ? 'image/gif' : 'image/jpeg';
        photoBase64 = Buffer.from(photoArray).toString('base64');
        
        if (photoBase64) {
          photoSection = `
            <defs>
              <clipPath id="photoClip">
                <rect x="${photoX + 3}" y="${photoY + 3}" width="${photoSize - 6}" height="${photoSize * 1.15 - 6}" rx="4"/>
              </clipPath>
            </defs>
            <rect x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize * 1.15}" rx="6" fill="${colors.primary}" opacity="0.05"/>
            <rect x="${photoX + 2}" y="${photoY + 2}" width="${photoSize - 4}" height="${photoSize * 1.15 - 4}" rx="5" fill="${colors.secondary}" stroke="${colors.primary}" stroke-width="1" opacity="0.3"/>
            <image x="${photoX + 3}" y="${photoY + 3}" width="${photoSize - 6}" height="${photoSize * 1.15 - 6}" href="data:${mimeType};base64,${photoBase64}" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>
          `;
        }
      }
    } catch (err) {
      console.error('Failed to fetch photo:', err);
    }
    
    // Fallback if photo fetch failed
    if (!photoBase64) {
      photoSection = `
        <rect x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize * 1.15}" rx="6" fill="${colors.primary}" opacity="0.05"/>
        <rect x="${photoX + 2}" y="${photoY + 2}" width="${photoSize - 4}" height="${photoSize * 1.15 - 4}" rx="5" fill="${colors.secondary}" stroke="${colors.primary}" stroke-width="1" opacity="0.3"/>
        <circle cx="${photoX + photoSize/2}" cy="${photoY + photoSize * 0.55}" r="20" fill="${colors.primary}" opacity="0.1"/>
        <text x="${photoX + photoSize/2}" y="${photoY + photoSize * 0.55 + 7}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
          ${initials}
        </text>
      `;
    }
  } else if (showPhoto) {
    photoSection = `
      <rect x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize * 1.15}" rx="6" fill="${colors.primary}" opacity="0.08"/>
      <rect x="${photoX + 3}" y="${photoY + 3}" width="${photoSize - 6}" height="${photoSize * 1.15 - 6}" rx="4" fill="none" stroke="${colors.primary}" stroke-width="1.5" opacity="0.4"/>
      <circle cx="${photoX + photoSize/2}" cy="${photoY + photoSize * 0.45}" r="18" fill="${colors.primary}" opacity="0.15"/>
      <text x="${photoX + photoSize/2}" y="${photoY + photoSize * 0.45 + 7}" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
        ${initials}
      </text>
      <text x="${photoX + photoSize/2}" y="${photoY + photoSize * 0.9}" font-family="Arial, sans-serif" font-size="5" fill="#666" text-anchor="middle">
        PHOTO
      </text>
    `;
  }
  
  let frontSVG = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${adjustColor(colors.primary, -25)};stop-opacity:1" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${adjustColor(colors.primary, 20)};stop-opacity:0.1" />
          <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:0" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="${colors.secondary}"/>
      <rect width="100%" height="100%" fill="url(#accentGrad)"/>
      
      <!-- Header Strip -->
      <rect x="0" y="0" width="100%" height="45" fill="url(#headerGrad)"/>
      
      <!-- School Logo Area -->
      <circle cx="30" cy="22" r="14" fill="white" opacity="0.2"/>
      <text x="30" y="27" font-family="Arial Black, sans-serif" font-size="14" fill="white" text-anchor="middle">
        🎓
      </text>
      
      <!-- School Name -->
      <text x="50" y="25" font-family="Arial Black, sans-serif" font-size="11" font-weight="bold" fill="white">
        ${schoolName.substring(0, 22)}
      </text>
      <text x="${width-20}" y="25" font-family="Arial, sans-serif" font-size="8" fill="rgba(255,255,255,0.85)" text-anchor="end">
        OFFICIAL ID CARD
      </text>
      
      <!-- Photo Section -->
      ${photoSection}
      
      <!-- Name -->
      <text x="${textStartX}" y="${textStartY}" font-family="Arial Black, sans-serif" font-size="13" font-weight="bold" fill="${colors.primary}">
        ${person.name || 'Unknown'}
      </text>
      
      <!-- Role Badge -->
      <rect x="${textStartX}" y="${textStartY + 12}" width="65" height="16" rx="4" fill="none" stroke="${colors.primary}" stroke-width="1.5"/>
      <text x="${textStartX + 32}" y="${textStartY + 24}" font-family="Arial, sans-serif" font-size="7" font-weight="bold" fill="${colors.primary}" text-anchor="middle">
        ${role}
      </text>
      
      <!-- Details -->
      <text x="${textStartX}" y="${textStartY + 42}" font-family="Arial, sans-serif" font-size="8" fill="#555">
        ${person.type === 'student' ? `📚 Class: ${className}` : `💼 Role: ${person.role || 'STAFF'}`}
      </text>
      <text x="${textStartX}" y="${textStartY + 56}" font-family="Arial, sans-serif" font-size="8" fill="#555">
        🆔 <tspan font-family="monospace" font-weight="bold">${displayId}</tspan>
      </text>
      ${person.type === 'student' ? `
        <text x="${textStartX}" y="${textStartY + 70}" font-family="Arial, sans-serif" font-size="8" fill="#555">
          ${gender === 'Male' ? '👦' : '👧'} Gender: ${gender}
        </text>
      ` : phone ? `
        <text x="${textStartX}" y="${textStartY + 70}" font-family="Arial, sans-serif" font-size="8" fill="#555">
          📱 ${phone}
        </text>
      ` : ''}
      
      <!-- QR Code Section (prominent placement) -->
      ${showQR && qrBase64 ? `
        <g transform="translate(${width - 75}, ${height - 120})">
          <rect x="0" y="0" width="70" height="70" rx="6" fill="white" stroke="${colors.primary}" stroke-width="2"/>
          <rect x="5" y="5" width="60" height="60" rx="3" fill="${colors.secondary}"/>
          <image x="8" y="8" width="54" height="54" href="data:image/png;base64,${qrBase64}" />
        </g>
        <text x="${width - 40}" y="${height - 40}" font-family="Arial, sans-serif" font-size="5" fill="#888" text-anchor="middle">
          Scan for Info
        </text>
      ` : ''}
      
      <!-- Barcode Area (when no QR) -->
      ${showBarcode && !showQR ? `
        <g transform="translate(${textStartX}, ${height - 65})">
          <rect width="70" height="30" rx="3" fill="none" stroke="${colors.primary}" stroke-width="0.5" opacity="0.4"/>
          ${Array.from({ length: 35 }).map((_, i) => 
            `<rect x="${i * 2}" y="5" width="${i % 2 === 0 ? 1.5 : 1}" height="20" fill="${i % 2 === 0 ? '#000' : colors.primary}" />`
          ).join('')}
        </g>
      ` : ''}
      
      <!-- Footer Decoration -->
      <rect x="0" y="${height - 18}" width="100%" height="18" fill="${colors.primary}" opacity="0.08"/>
      <text x="${width/2}" y="${height - 8}" font-family="Arial, sans-serif" font-size="5" fill="#999" text-anchor="middle">
        SKOOLAR | ${schoolName} | Valid ${new Date().getFullYear()}
      </text>
    </svg>
  `;

  const svgBuffer = Buffer.from(frontSVG);
  
  // Convert SVG to PNG using Sharp with proper DPI
  return await sharp(svgBuffer)
    .png({ quality: 100 })
    .toBuffer();
}

// Utility: Adjust color brightness
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}