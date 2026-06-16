import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderReportCardSVG, renderReportCardPdf, renderReportCardPng } from '@/lib/report-card-utils/render-card-server';
import { DEFAULT_THRESHOLDS } from '@/lib/report-card-utils/grade-calculator';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf';

    const reportCard = await db.reportCard.findUnique({
      where: { id },
      include: { student: { include: { user: { select: { name: true } } } }, term: { include: { academicYear: true } } },
    });
    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const school = await db.school.findUnique({ where: { id: reportCard.schoolId }, select: { name: true, logo: true, address: true, motto: true, phone: true, email: true, website: true, primaryColor: true } });
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: reportCard.schoolId } });
    const logoBase64 = school?.logo ? (await resolveImageBuffer(school.logo, 'logo', request))?.buffer?.toString('base64') : null;

    const subjectResults = reportCard.subjectResults ? JSON.parse(reportCard.subjectResults) : [];
    const attendance = reportCard.attendanceSummary ? JSON.parse(reportCard.attendanceSummary) : null;
    const domainGrade = await db.domainGrade.findUnique({ where: { schoolId_studentId_termId: { schoolId: reportCard.schoolId, studentId: reportCard.studentId, termId: reportCard.termId } } });
    const domain: any = {
      cognitive: domainGrade ? { reasoning: domainGrade.cognitiveReasoning, memory: domainGrade.cognitiveMemory, concentration: domainGrade.cognitiveConcentration, problemSolving: domainGrade.cognitiveProblemSolving, initiative: domainGrade.cognitiveInitiative, average: domainGrade.cognitiveAverage } : {},
      psychomotor: domainGrade ? { handwriting: domainGrade.psychomotorHandwriting, sports: domainGrade.psychomotorSports, drawing: domainGrade.psychomotorDrawing, practical: domainGrade.psychomotorPractical, average: domainGrade.psychomotorAverage } : {},
      affective: domainGrade ? { punctuality: domainGrade.affectivePunctuality, neatness: domainGrade.affectiveNeatness, honesty: domainGrade.affectiveHonesty, leadership: domainGrade.affectiveLeadership, cooperation: domainGrade.affectiveCooperation, attentiveness: domainGrade.affectiveAttentiveness, obedience: domainGrade.affectiveObedience, selfControl: domainGrade.affectiveSelfControl, politeness: domainGrade.affectivePoliteness, average: domainGrade.affectiveAverage } : {},
      classTeacherComment: domainGrade?.classTeacherComment,
      classTeacherName: domainGrade?.classTeacherName,
      principalComment: domainGrade?.principalComment,
      principalName: domainGrade?.principalName,
    };

    const svg = await renderReportCardSVG({
      student: { name: reportCard.student?.user?.name || 'Student', admissionNo: (reportCard.student as any)?.admissionNo || 'N/A', gender: (reportCard.student as any)?.gender, dateOfBirth: (reportCard.student as any)?.dateOfBirth },
      school: { name: school?.name || 'School', logoBase64, address: school?.address, motto: school?.motto, phone: school?.phone, email: school?.email, website: school?.website, primaryColor: school?.primaryColor },
      settings: { principalName: settings?.principalName, nextTermBegins: settings?.nextTermBegins, academicSession: settings?.academicSession },
      term: { name: reportCard.term?.name || 'Term', order: (reportCard.term as any)?.order || 1 },
      cls: { name: reportCard.classId || 'Class' },
      subjectResults,
      attendance: attendance || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
      domainGrade: domain,
      gradeScale: DEFAULT_THRESHOLDS,
      totals: { grandTotal: reportCard.totalScore || 0, averageScore: reportCard.averageScore || 0, totalStudents: 1, classRank: reportCard.classRank ?? undefined, overallGrade: reportCard.grade || 'F', overallRemark: '' },
      teacherComment: reportCard.teacherComment,
      principalComment: reportCard.principalComment,
      showChart: true, showDomains: true, showAttendance: true, showLegend: true,
    });

    if (format === 'png') {
      const png = await renderReportCardPng(svg);
      return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="report-card-${(reportCard.student as any)?.admissionNo || reportCard.id}.png"` } });
    }

    const pdf = await renderReportCardPdf(svg);
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-card-${(reportCard.student as any)?.admissionNo || reportCard.id}.pdf"` } });
  } catch (error) {
    console.error('GET /api/report-cards/[id]/pdf error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
