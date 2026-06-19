import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderReportCardHTML } from '@/lib/report-card-utils/render-card-html';
import { renderReportCardSVG, renderReportCardPdf as oldRenderPdf, renderReportCardPng } from '@/lib/report-card-utils/render-card-server';
import { generatePdfFromHtml } from '@/lib/report-card-utils/pdf-generator';
import { DEFAULT_THRESHOLDS, calculateSubjectGrade } from '@/lib/grade-calculator';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import type { SubjectResult, DomainData, Orientation } from '@/lib/report-card-utils/types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf';
    const orientation = (searchParams.get('orientation') || 'portrait') as Orientation;

    const reportCard = await db.reportCard.findUnique({
      where: { id },
      include: { student: { include: { user: { select: { name: true } }, class: { select: { name: true, section: true } } } }, term: { include: { academicYear: true } } },
    });
    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const school = await db.school.findUnique({ where: { id: reportCard.schoolId }, select: { name: true, logo: true, address: true, motto: true, phone: true, email: true, website: true, primaryColor: true } });
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: reportCard.schoolId } });
    const logoBase64 = school?.logo ? (await resolveImageBuffer(school.logo, 'logo', request))?.buffer?.toString('base64') : null;
    const studentPhotoUrl = (reportCard.student as any)?.user?.avatar || (reportCard.student as any)?.photo;
    const studentPhoto = studentPhotoUrl ? await resolveImageBuffer(studentPhotoUrl, 'photo', request) : null;

    const scoreTypeRecords = await db.scoreType.findMany({ where: { schoolId: reportCard.schoolId, isActive: true }, orderBy: { position: 'asc' } });
    const scoreTypes = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));

    const subjectResults: SubjectResult[] = reportCard.subjectResults ? JSON.parse(reportCard.subjectResults) : [];
    const attendance = reportCard.attendanceSummary ? JSON.parse(reportCard.attendanceSummary) : null;
    const domainGrade = await db.domainGrade.findUnique({ where: { schoolId_studentId_termId: { schoolId: reportCard.schoolId, studentId: reportCard.studentId, termId: reportCard.termId } } });
    const domain: DomainData = {
      cognitive: domainGrade ? { reasoning: domainGrade.cognitiveReasoning, memory: domainGrade.cognitiveMemory, concentration: domainGrade.cognitiveConcentration, problemSolving: domainGrade.cognitiveProblemSolving, initiative: domainGrade.cognitiveInitiative, average: domainGrade.cognitiveAverage } : {},
      psychomotor: domainGrade ? { handwriting: domainGrade.psychomotorHandwriting, sports: domainGrade.psychomotorSports, drawing: domainGrade.psychomotorDrawing, practical: domainGrade.psychomotorPractical, average: domainGrade.psychomotorAverage } : {},
      affective: domainGrade ? { punctuality: domainGrade.affectivePunctuality, neatness: domainGrade.affectiveNeatness, honesty: domainGrade.affectiveHonesty, leadership: domainGrade.affectiveLeadership, cooperation: domainGrade.affectiveCooperation, attentiveness: domainGrade.affectiveAttentiveness, obedience: domainGrade.affectiveObedience, selfControl: domainGrade.affectiveSelfControl, politeness: domainGrade.affectivePoliteness, average: domainGrade.affectiveAverage } : {},
      classTeacherComment: domainGrade?.classTeacherComment,
      classTeacherName: domainGrade?.classTeacherName,
      principalComment: domainGrade?.principalComment,
      principalName: domainGrade?.principalName,
    };

    const avgScore = reportCard.averageScore || 0;
    const overallGrade = reportCard.grade || 'F';
    const overallRemark = calculateSubjectGrade(avgScore, 100, DEFAULT_THRESHOLDS).remark;

    if (format === 'png') {
      const svg = await renderReportCardSVG({
        student: { name: reportCard.student?.user?.name || 'Student', admissionNo: (reportCard.student as any)?.admissionNo || 'N/A', gender: reportCard.student?.gender, dateOfBirth: reportCard.student?.dateOfBirth?.toISOString().split('T')[0] },
        school: { name: school?.name || 'School', logoBase64, address: school?.address, motto: school?.motto, phone: school?.phone, email: school?.email, website: school?.website, primaryColor: school?.primaryColor },
        settings: { principalName: settings?.principalName, nextTermBegins: settings?.nextTermBegins, academicSession: settings?.academicSession },
        term: { name: reportCard.term?.name || 'Term', order: (reportCard.term as any)?.order || 1 },
        cls: { name: reportCard.student?.class?.name || reportCard.classId || 'Class', section: reportCard.student?.class?.section },
        subjectResults,
        attendance: attendance || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
        domainGrade: domain,
        gradeScale: DEFAULT_THRESHOLDS,
        totals: { grandTotal: reportCard.totalScore || 0, averageScore: avgScore, totalStudents: 1, classRank: reportCard.classRank ?? undefined, overallGrade, overallRemark },
        teacherComment: reportCard.teacherComment,
        principalComment: reportCard.principalComment,
        showChart: true, showDomains: true, showAttendance: true, showLegend: true,
        scoreTypes,
      });
      const png = await renderReportCardPng(svg);
      return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="report-card-${(reportCard.student as any)?.admissionNo || reportCard.id}.png"` } });
    }

    // Try Puppeteer first for PDF, fallback to SVG→PDF
    try {
      const photoDataUri = studentPhoto ? `data:${studentPhoto.contentType};base64,${studentPhoto.buffer.toString('base64')}` : null;
      const logoDataUri = logoBase64 ? `data:image/png;base64,${logoBase64}` : null;

      const html = await renderReportCardHTML({
        student: {
          name: reportCard.student?.user?.name || 'Student',
          admissionNo: (reportCard.student as any)?.admissionNo || 'N/A',
          gender: reportCard.student?.gender || null,
          dateOfBirth: reportCard.student?.dateOfBirth ? new Date(reportCard.student.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
          photoBase64: photoDataUri,
        },
        school: {
          name: school?.name || 'School',
          logoBase64: logoDataUri,
          address: school?.address || null,
          motto: school?.motto || null,
          phone: school?.phone || null,
          email: school?.email || null,
          primaryColor: school?.primaryColor || '#059669',
        },
        settings: { principalName: settings?.principalName, nextTermBegins: settings?.nextTermBegins, academicSession: settings?.academicSession },
        term: { name: reportCard.term?.name || 'Term', order: (reportCard.term as any)?.order || 1 },
        cls: { name: reportCard.student?.class?.name || 'Class', section: reportCard.student?.class?.section },
        subjectResults,
        attendance: attendance || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
        domainGrade: domain,
        totals: { grandTotal: reportCard.totalScore || 0, averageScore: avgScore, totalStudents: 1, classRank: reportCard.classRank ?? undefined, overallGrade, overallRemark },
        teacherComment: reportCard.teacherComment,
        principalComment: reportCard.principalComment,
        showChart: true, showDomains: true, showAttendance: true,
        scoreTypes,
        radarData: subjectResults.map(r => ({ subject: r.subjectName, score: Math.round(r.percentage || r.total || 0) })),
        chartColumns: 2,
        domainColumns: 3,
      }, { orientation });

      const pdf = await generatePdfFromHtml({ html, orientation });
      return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-card-${(reportCard.student as any)?.admissionNo || reportCard.id}.pdf"` } });
    } catch (puppeteerError) {
      console.warn('Puppeteer PDF failed, falling back to SVG→PDF:', puppeteerError);
      const svg = await renderReportCardSVG({
        student: { name: reportCard.student?.user?.name || 'Student', admissionNo: (reportCard.student as any)?.admissionNo || 'N/A', gender: reportCard.student?.gender, dateOfBirth: reportCard.student?.dateOfBirth?.toISOString().split('T')[0] },
        school: { name: school?.name || 'School', logoBase64, address: school?.address, motto: school?.motto, phone: school?.phone, email: school?.email, website: school?.website, primaryColor: school?.primaryColor },
        settings: { principalName: settings?.principalName, nextTermBegins: settings?.nextTermBegins, academicSession: settings?.academicSession },
        term: { name: reportCard.term?.name || 'Term', order: (reportCard.term as any)?.order || 1 },
        cls: { name: reportCard.student?.class?.name || reportCard.classId || 'Class', section: reportCard.student?.class?.section },
        subjectResults,
        attendance: attendance || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
        domainGrade: domain,
        gradeScale: DEFAULT_THRESHOLDS,
        totals: { grandTotal: reportCard.totalScore || 0, averageScore: avgScore, totalStudents: 1, classRank: reportCard.classRank ?? undefined, overallGrade, overallRemark },
        teacherComment: reportCard.teacherComment,
        principalComment: reportCard.principalComment,
        showChart: true, showDomains: true, showAttendance: true, showLegend: true,
        scoreTypes,
      });
      const pdf = await oldRenderPdf(svg);
      return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-card-${(reportCard.student as any)?.admissionNo || reportCard.id}.pdf"` } });
    }
  } catch (error) {
    console.error('GET /api/report-cards/[id]/pdf error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
