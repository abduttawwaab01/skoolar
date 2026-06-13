import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireAuth } from '@/lib/auth-middleware';
import { renderReportCardPdf } from '@/lib/report-card-pdf';
import { getReportCardData, resolveImageBuffer, type ResolvedImage } from '@/lib/report-card-pdf-data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const data = await getReportCardData(id);
    if (!data) {
      return NextResponse.json({ error: 'Report card not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && data.reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { reportCard, school, settings, subjectResults, attendance, domainGrade } = data;
    const student = reportCard.student;

    // Photo fallback chain — matches src/app/api/id-cards/route.ts:131
    // so PDFs and ID cards agree on which image source to use.
    const photoUrl = student?.photo || student?.user?.avatar || null;

    const [logo, photo] = await Promise.all([
      school?.logo ? resolveImageBuffer(school.logo, 'logo', request) : Promise.resolve(null),
      photoUrl ? resolveImageBuffer(photoUrl, 'photo', request) : Promise.resolve(null),
    ]);
    if (photoUrl && !photo) {
      console.error(`report-card-pdf: photo resolution FAILED for URL: ${photoUrl.substring(0, 200)}`);
    }

    // Convert resolved images to PNG data URIs using sharp — resvg-wasm
    // handles PNG data URIs reliably, while JPEG may fail in some envs.
    const toPngDataUri = async (img: ResolvedImage | null): Promise<string | null> => {
      if (!img) return null;
      try {
        const png = await sharp(img.buffer).png({ compressionLevel: 6 }).toBuffer();
        return `data:image/png;base64,${png.toString('base64')}`;
      } catch (err) {
        console.warn(`report-card-pdf: sharp PNG conversion failed, fallback to original:`, err);
        return `data:${img.contentType};base64,${img.buffer.toString('base64')}`;
      }
    };
    const [logoDataUri, photoDataUri] = await Promise.all([
      toPngDataUri(logo),
      toPngDataUri(photo),
    ]);

    const academicYear = settings?.academicSession
      || reportCard.term?.academicYear?.name
      || '—';

    const classPosition = reportCard.classRank ?? null;
    const getOrdinalSuffix = (n: number) => {
      if (n >= 11 && n <= 13) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    const classPosText = classPosition ? `${classPosition}${getOrdinalSuffix(classPosition)}` : undefined;

    const input = {
      student: {
        name: student?.user?.name || '—',
        admissionNo: student?.admissionNo || '—',
        gender: student?.gender,
        dateOfBirth: student?.dateOfBirth ? new Date(student.dateOfBirth).toISOString() : null,
        bloodGroup: student?.bloodGroup,
        photo,
        photoBase64: photoDataUri,
        parents: student?.user?.email || null,
      },
      school: {
        name: school?.name || 'School Name',
        logo,
        logoBase64: logoDataUri,
        address: school?.address,
        motto: school?.motto || settings?.schoolMotto || undefined,
        phone: school?.phone,
        email: school?.email,
        website: school?.website,
        primaryColor: school?.primaryColor || '#059669',
        secondaryColor: school?.secondaryColor,
      },
      settings: settings ? {
        principalName: settings.principalName,
        vicePrincipalName: settings.vicePrincipalName,
        nextTermBegins: settings.nextTermBegins ? new Date(settings.nextTermBegins).toISOString() : null,
        academicSession: settings.academicSession,
      } : null,
      term: {
        name: reportCard.term?.name || '',
        academicYear,
      },
      cls: {
        name: student?.class?.name || '—',
        section: student?.class?.section,
        grade: student?.class?.grade,
        classTeacher: student?.class?.classTeacher?.user?.name || null,
      },
      subjectResults,
      attendance: { ...attendance, onLeave: 0 },
      domainGrade: domainGrade as never,
      totals: {
        grandTotal: data.grandTotal,
        totalObtainable: subjectResults.length * 100,
        averageScore: data.averageScore,
        overallGrade: data.overallGrade,
        overallRemark: data.overallRemark,
        classPosition,
        classPositionText: classPosText,
        totalStudents: data.totalStudents,
      },
      teacherComment: reportCard.teacherComment || undefined,
      principalComment: reportCard.principalComment || undefined,
    };

    const format = request.nextUrl.searchParams.get('format') || 'pdf';
    const isPng = format === 'png';
    const buf = await renderReportCardPdf(input, isPng ? 'png' : 'pdf');

    const ext = isPng ? 'png' : 'pdf';
    const safeStudentName = (student?.user?.name || id).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    const filename = `report-card-${safeStudentName}.${ext}`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': isPng ? 'image/png' : 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buf.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReportCard PDF] Error:', error instanceof Error ? { message: error.message, stack: error.stack?.slice(0, 300) } : error);
    return NextResponse.json({ error: `Report card PDF generation failed: ${message}` }, { status: 500 });
  }
}
