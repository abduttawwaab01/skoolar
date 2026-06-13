import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { renderReportCardPdf } from '@/lib/report-card-pdf';
import { getReportCardData, resolveImageBuffer, type ResolvedImage } from '@/app/api/report-cards/[id]/pdf/route';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { reportCardIds } = await request.json();

    if (!reportCardIds || !Array.isArray(reportCardIds) || reportCardIds.length === 0) {
      return NextResponse.json({ error: 'No report card IDs provided' }, { status: 400 });
    }

    if (reportCardIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 report cards per export' }, { status: 400 });
    }

    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();

    let successCount = 0;
    let failCount = 0;

    for (const id of reportCardIds) {
      try {
        const data = await getReportCardData(id);
        if (!data) {
          failCount++;
          continue;
        }

        if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && data.reportCard.schoolId !== auth.schoolId) {
          failCount++;
          continue;
        }

        const { reportCard, school, settings, subjectResults, attendance, domainGrade } = data;
        const student = reportCard.student;

        const photoUrl = student?.photo || student?.user?.avatar || null;

        const [logo, photo] = await Promise.all([
          school?.logo ? resolveImageBuffer(school.logo, 'logo', request) : Promise.resolve(null),
          photoUrl ? resolveImageBuffer(photoUrl, 'photo', request) : Promise.resolve(null),
        ]);

        const toPngDataUri = async (img: ResolvedImage | null): Promise<string | null> => {
          if (!img) return null;
          try {
            const png = await sharp(img.buffer).png({ compressionLevel: 6 }).toBuffer();
            return `data:image/png;base64,${png.toString('base64')}`;
          } catch {
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
        const classPosText = classPosition
          ? `${classPosition}${['th','st','nd','rd'][(classPosition % 100) > 10 && (classPosition % 100) < 14 ? 0 : [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20][classPosition % 10] || 0]}`
          : undefined;

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

        const pdfBuf = await renderReportCardPdf(input, 'pdf');
        const safeName = (student?.user?.name || id).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        zip.addFile(`${safeName}-report-card.pdf`, Buffer.from(pdfBuf));
        successCount++;
      } catch (cardErr) {
        console.error(`[ReportCard Bulk Export] Failed for ${id}:`, cardErr);
        failCount++;
      }
    }

    if (successCount === 0) {
      return NextResponse.json({ error: 'No report cards could be generated' }, { status: 500 });
    }

    const zipBuffer = zip.toBuffer();
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="report-cards-${Date.now()}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ReportCard Bulk Export] Error:', error instanceof Error ? { message: error.message, stack: error.stack?.slice(0, 300) } : error);
    return NextResponse.json({ error: `Bulk export failed: ${message}` }, { status: 500 });
  }
}
