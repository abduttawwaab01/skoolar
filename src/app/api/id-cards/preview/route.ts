import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderIDCard } from '@/lib/id-card-utils/render-card-server';
import { generateQRBase64 } from '@/lib/id-card-utils/qr-generator';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      type = 'student',
      name = 'Unknown',
      displayId = 'N/A',
      className = 'N/A',
      section = '',
      department = '',
      gender = '',
      phone = '',
      email = '',
      address = '',
      bloodGroup = '',
      dateOfBirth = '',
      house = '',
      academicSession = '',
      designation = '',
      position = '',
      role = 'STUDENT',
      photoDataUrl = null,
      colors = { primary: '#059669', secondary: '#FFFFFF', accent: '#fbbf24', text: '#1e293b', textSecondary: '#64748b', headerBg: '#059669', bg: '#ffffff' },
      showPhoto = true,
      showLogo = true,
      showQR = true,
      showBarcode = false,
      showSignature = true,
      showWatermark = true,
      showMotto = true,
      showExpiryDate = false,
      showIssueDate = true,
      orientation = 'landscape',
      isBack = false,
      backText = '',
      issueDate = null,
      expiryDate = null,
      signatureUrl = null,
      watermarkText = null,
      schoolOverride = null,
      qrColor = '#059669',
    } = body;

    const person: any = {
      name,
      displayId,
      class: className,
      section,
      department,
      gender,
      phone,
      email,
      address,
      bloodGroup,
      dateOfBirth,
      house,
      academicSession,
      designation,
      position,
      role,
      type,
    };
    if (schoolOverride) person._school = schoolOverride;

    // Generate QR data
    let qrBase64 = '';
    if (showQR) {
      qrBase64 = await generateQRBase64(
        {
          type,
          userId: '',
          personId: '',
          schoolId: schoolOverride?.id || '',
          uuid: 'preview',
          validationToken: 'preview',
          name,
          role,
        },
        qrColor,
        isBack ? 400 : 480
      );
    }

    const cardBuffer = await renderIDCard(person, {
      colors,
      showPhoto,
      showLogo,
      showQR,
      showBarcode,
      showSignature,
      showWatermark,
      showMotto,
      showExpiryDate,
      showIssueDate,
      orientation,
      photoUrl: photoDataUrl || null,
      qrData: qrBase64,
      isBack: !!isBack,
      isPreview: true,
      role,
      backText: backText || '',
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
      signatureUrl: signatureUrl || null,
      watermarkText: watermarkText || null,
      schoolLogo: schoolOverride?.logo || null,
      schoolName: schoolOverride?.name || '',
      motto: schoolOverride?.motto || '',
    });

    return NextResponse.json({
      success: true,
      data: cardBuffer.toString('base64'),
      contentType: 'image/png',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
