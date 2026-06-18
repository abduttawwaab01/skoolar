import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderReportCardSVG, renderReportCardPdf as oldRenderPdf, renderReportCardPng } from '@/lib/report-card-utils/render-card-server';
import { renderReportCardHTML } from '@/lib/report-card-utils/render-card-html';
import { generatePdfFromHtml } from '@/lib/report-card-utils/pdf-generator';
import { DEFAULT_THRESHOLDS, calculateSubjectGrade } from '@/lib/grade-calculator';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import type { SubjectResult, DomainData, Orientation } from '@/lib/report-card-utils/types';
const archiver = require('archiver') as (format: string, options?: Record<string, any>) => import('stream').Transform;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { format = 'pdf', reportCardIds, classId, termId, schoolId, orientation: bodyOrientation } = body;
    const orientation = (bodyOrientation || 'portrait') as Orientation;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const reportCardInclude = { student: { include: { user: { select: { name: true } }, class: { select: { name: true, section: true } } } }, term: true };

    let reportCards;
    if (reportCardIds?.length) {
      reportCards = await db.reportCard.findMany({ where: { id: { in: reportCardIds }, schoolId: targetSchoolId, deletedAt: null }, include: reportCardInclude });
    } else if (classId && termId) {
      reportCards = await db.reportCard.findMany({ where: { schoolId: targetSchoolId, classId, termId, deletedAt: null }, include: reportCardInclude });
    } else {
      return NextResponse.json({ error: 'Specify reportCardIds or classId+termId' }, { status: 400 });
    }

    if (reportCards.length === 0) return NextResponse.json({ error: 'No report cards found' }, { status: 404 });

    const school = await db.school.findUnique({ where: { id: targetSchoolId }, select: { name: true, logo: true, address: true, motto: true, phone: true, email: true, website: true, primaryColor: true } });
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: targetSchoolId } });
    const logoBase64 = school?.logo ? ((await resolveImageBuffer(school.logo, 'logo', request))?.buffer?.toString('base64') ?? null) : null;

    if (format === 'csv') {
      let csv = 'Student Name,Admission No,Class,Term,Total Score,Average,Grade,GPA,Class Rank\n';
      for (const rc of reportCards) {
        csv += `"${rc.student?.user?.name || ''}","${(rc.student as any)?.admissionNo || ''}","${rc.classId}",${rc.term?.name || ''},${rc.totalScore || ''},${rc.averageScore || ''},${rc.grade || ''},${rc.gpa || ''},${rc.classRank || ''}\n`;
      }
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="report-cards.csv"` } });
    }

    if (format === 'docx') {
      const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint">
<w:body>${reportCards.map((rc) => `<wx:sect><w:p><w:r><w:t>${school?.name || ''} - Report Card</w:t></w:r></w:p><w:p><w:r><w:t>Student: ${rc.student?.user?.name || ''} (${(rc.student as any)?.admissionNo || ''})</w:t></w:r></w:p><w:p><w:r><w:t>Term: ${rc.term?.name || ''} | Average: ${rc.averageScore || ''} | Grade: ${rc.grade || ''}</w:t></w:r></w:p><w:p><w:r><w:t>---</w:t></w:r></w:p></wx:sect>`).join('')}</w:body></w:wordDocument>`;
      return new NextResponse(doc, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="report-cards.xml"` } });
    }

    if (format === 'png' && reportCards.length === 1) {
      const rc = reportCards[0];
      const svg = await buildReportCardSvg(rc, school, settings, logoBase64);
      const png = await renderReportCardPng(svg);
      return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="report-card-${(rc.student as any)?.admissionNo || rc.id}.png"` } });
    }

    if (format === 'pdf' && reportCards.length === 1) {
      const rc = reportCards[0];
      try {
        const html = await buildReportCardHtml(rc, school, settings, logoBase64, orientation);
        const pdf = await generatePdfFromHtml({ html, orientation });
        return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-card-${(rc.student as any)?.admissionNo || rc.id}.pdf"` } });
      } catch {
        const svg = await buildReportCardSvg(rc, school, settings, logoBase64);
        const pdf = await oldRenderPdf(svg);
        return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-card-${(rc.student as any)?.admissionNo || rc.id}.pdf"` } });
      }
    }

    // Bulk export — try Puppeteer for PDF, fallback to SVG for individual cards
    const archive: any = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));

    const processPromise = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', reject);
    });

    const totalCards = reportCards.length;
    const failedCards: any[] = [];

    for (let i = 0; i < totalCards; i++) {
      const rc = reportCards[i];
      try {
        if (format === 'pdf') {
          try {
            const html = await buildReportCardHtml(rc, school, settings, logoBase64, orientation);
            const pdf = await generatePdfFromHtml({ html, orientation });
            archive.append(Buffer.from(pdf), { name: `report-card-${(rc.student as any)?.admissionNo || rc.id}.pdf` });
          } catch {
            const svg = await buildReportCardSvg(rc, school, settings, logoBase64);
            const pdf = await oldRenderPdf(svg);
            archive.append(Buffer.from(pdf), { name: `report-card-${(rc.student as any)?.admissionNo || rc.id}.pdf` });
          }
        } else {
          const svg = await buildReportCardSvg(rc, school, settings, logoBase64);
          const png = await renderReportCardPng(svg);
          archive.append(Buffer.from(png), { name: `report-card-${(rc.student as any)?.admissionNo || rc.id}.png` });
        }
      } catch (error) {
        console.error(`Failed to process report card ${rc.id}:`, error);
        failedCards.push({ id: rc.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    archive.finalize();
    await processPromise;
    const zipBuf = Buffer.concat(chunks);

    const response = new NextResponse(zipBuf, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="report-cards.zip"` } });
    (response as any).processedSummary = {
      total: totalCards,
      successful: totalCards - failedCards.length,
      failed: failedCards.length,
      failedCards,
    };
    return response;
  } catch (error) {
    console.error('POST /api/report-cards/export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

async function buildReportCardSvg(rc: any, school: any, settings: any, logoBase64: string | null, showChart = true, showDomains = true, showAttendance = true, showLegend = true) {
  const subjectResults = rc.subjectResults ? JSON.parse(rc.subjectResults) : [];
  const attendance = rc.attendanceSummary ? JSON.parse(rc.attendanceSummary) : null;
  const domainGrade = await db.domainGrade.findUnique({ where: { schoolId_studentId_termId: { schoolId: rc.schoolId, studentId: rc.studentId, termId: rc.termId } } });
  const domain: any = { cognitive: {}, psychomotor: {}, affective: {}, classTeacherComment: domainGrade?.classTeacherComment, classTeacherName: domainGrade?.classTeacherName, principalComment: domainGrade?.principalComment, principalName: domainGrade?.principalName };
  if (domainGrade) {
    domain.cognitive = { reasoning: domainGrade.cognitiveReasoning, memory: domainGrade.cognitiveMemory, concentration: domainGrade.cognitiveConcentration, problemSolving: domainGrade.cognitiveProblemSolving, initiative: domainGrade.cognitiveInitiative, average: domainGrade.cognitiveAverage };
    domain.psychomotor = { handwriting: domainGrade.psychomotorHandwriting, sports: domainGrade.psychomotorSports, drawing: domainGrade.psychomotorDrawing, practical: domainGrade.psychomotorPractical, average: domainGrade.psychomotorAverage };
    domain.affective = { punctuality: domainGrade.affectivePunctuality, neatness: domainGrade.affectiveNeatness, honesty: domainGrade.affectiveHonesty, leadership: domainGrade.affectiveLeadership, cooperation: domainGrade.affectiveCooperation, attentiveness: domainGrade.affectiveAttentiveness, obedience: domainGrade.affectiveObedience, selfControl: domainGrade.affectiveSelfControl, politeness: domainGrade.affectivePoliteness, average: domainGrade.affectiveAverage };
  }

  const avgScore = rc.averageScore || 0;
  const overallGrade = rc.grade || 'F';
  const overallRemark = calculateSubjectGrade(avgScore, 100, DEFAULT_THRESHOLDS).remark;

  return renderReportCardSVG({
    student: { name: rc.student?.user?.name || 'Student', admissionNo: rc.student?.admissionNo || 'N/A', gender: rc.student?.gender, dateOfBirth: rc.student?.dateOfBirth?.toISOString?.()?.split('T')[0] },
    school: { name: school?.name || 'School', logoBase64, address: school?.address, motto: school?.motto, phone: school?.phone, email: school?.email, website: school?.website, primaryColor: school?.primaryColor },
    settings: { principalName: settings?.principalName, nextTermBegins: settings?.nextTermBegins, academicSession: settings?.academicSession },
    term: { name: rc.term?.name || 'Term', order: (rc.term as any)?.order || 1 },
    cls: { name: rc.student?.class?.name || rc.classId || 'Class', section: rc.student?.class?.section },
    subjectResults,
    attendance: attendance || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
    domainGrade: domain,
    gradeScale: DEFAULT_THRESHOLDS,
    totals: { grandTotal: rc.totalScore || 0, averageScore: avgScore, totalStudents: 1, classRank: rc.classRank, overallGrade, overallRemark },
    teacherComment: rc.teacherComment,
    principalComment: rc.principalComment,
    showChart, showDomains, showAttendance, showLegend,
  });
}

async function buildReportCardHtml(rc: any, school: any, settings: any, logoBase64: string | null, orientation: Orientation): Promise<string> {
  const subjectResults: SubjectResult[] = rc.subjectResults ? JSON.parse(rc.subjectResults) : [];
  const attendance = rc.attendanceSummary ? JSON.parse(rc.attendanceSummary) : null;
  const domainGrade = await db.domainGrade.findUnique({ where: { schoolId_studentId_termId: { schoolId: rc.schoolId, studentId: rc.studentId, termId: rc.termId } } });
  const domain: DomainData = {
    cognitive: domainGrade ? { reasoning: domainGrade.cognitiveReasoning, memory: domainGrade.cognitiveMemory, concentration: domainGrade.cognitiveConcentration, problemSolving: domainGrade.cognitiveProblemSolving, initiative: domainGrade.cognitiveInitiative, average: domainGrade.cognitiveAverage } : {},
    psychomotor: domainGrade ? { handwriting: domainGrade.psychomotorHandwriting, sports: domainGrade.psychomotorSports, drawing: domainGrade.psychomotorDrawing, practical: domainGrade.psychomotorPractical, average: domainGrade.psychomotorAverage } : {},
    affective: domainGrade ? { punctuality: domainGrade.affectivePunctuality, neatness: domainGrade.affectiveNeatness, honesty: domainGrade.affectiveHonesty, leadership: domainGrade.affectiveLeadership, cooperation: domainGrade.affectiveCooperation, attentiveness: domainGrade.affectiveAttentiveness, obedience: domainGrade.affectiveObedience, selfControl: domainGrade.affectiveSelfControl, politeness: domainGrade.affectivePoliteness, average: domainGrade.affectiveAverage } : {},
    classTeacherComment: domainGrade?.classTeacherComment, classTeacherName: domainGrade?.classTeacherName,
    principalComment: domainGrade?.principalComment, principalName: domainGrade?.principalName,
  };

  const avgScore = rc.averageScore || 0;
  const overallGrade = rc.grade || 'F';
  const overallRemark = calculateSubjectGrade(avgScore, 100, DEFAULT_THRESHOLDS).remark;

  return renderReportCardHTML({
    student: { name: rc.student?.user?.name || 'Student', admissionNo: (rc.student as any)?.admissionNo || 'N/A' },
    school: { name: school?.name || 'School', logoBase64: logoBase64 ? `data:image/png;base64,${logoBase64}` : null, address: school?.address, motto: school?.motto, phone: school?.phone, email: school?.email, primaryColor: school?.primaryColor },
    settings: { principalName: settings?.principalName, nextTermBegins: settings?.nextTermBegins, academicSession: settings?.academicSession },
    term: { name: rc.term?.name || 'Term', order: (rc.term as any)?.order || 1 },
    cls: { name: rc.student?.class?.name || rc.classId || 'Class', section: rc.student?.class?.section },
    subjectResults,
    attendance: attendance || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
    domainGrade: domain,
    totals: { grandTotal: rc.totalScore || 0, averageScore: avgScore, totalStudents: 1, classRank: rc.classRank, overallGrade, overallRemark },
    teacherComment: rc.teacherComment,
    principalComment: rc.principalComment,
    showChart: true, showDomains: true, showAttendance: true,
  }, { orientation });
}
