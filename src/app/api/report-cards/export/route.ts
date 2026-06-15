import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderReportCardSVG, renderReportCardPdf, renderReportCardPng } from '@/lib/report-card-utils/render-card-server';
import { DEFAULT_THRESHOLDS } from '@/lib/report-card-utils/grade-calculator';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import * as archiver from 'archiver';
import { PDFDocument } from 'pdf-lib';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { format = 'pdf', reportCardIds, classId, termId, schoolId } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    let reportCards;
    if (reportCardIds?.length) {
      reportCards = await db.reportCard.findMany({ where: { id: { in: reportCardIds }, schoolId: targetSchoolId, deletedAt: null }, include: { student: { include: { user: { select: { name: true } } } }, term: true } });
    } else if (classId && termId) {
      reportCards = await db.reportCard.findMany({ where: { schoolId: targetSchoolId, classId, termId, deletedAt: null }, include: { student: { include: { user: { select: { name: true } } } }, term: true } });
    } else {
      return NextResponse.json({ error: 'Specify reportCardIds or classId+termId' }, { status: 400 });
    }

    if (reportCards.length === 0) return NextResponse.json({ error: 'No report cards found' }, { status: 404 });

    const school = await db.school.findUnique({ where: { id: targetSchoolId }, select: { name: true, logo: true, address: true, motto: true, phone: true, email: true, website: true, primaryColor: true } });
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: targetSchoolId } });

    const logoBase64 = school?.logo ? (await resolveImageBuffer(school.logo, 'logo', request))?.buffer?.toString('base64') : null;

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
      const png = await renderReportCardPng(svg, 3);
      return new NextResponse(png, { headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="report-card-${(rc.student as any)?.admissionNo || rc.id}.png"` } });
    }

    if (format === 'pdf' && reportCards.length === 1) {
      const rc = reportCards[0];
      const svg = await buildReportCardSvg(rc, school, settings, logoBase64);
      const pdf = await renderReportCardPdf(svg);
      return new NextResponse(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-card-${(rc.student as any)?.admissionNo || rc.id}.pdf"` } });
    }

    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));

    const processPromise = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', reject);
    });

    for (let i = 0; i < Math.min(reportCards.length, 100); i++) {
      const rc = reportCards[i];
      try {
        const svg = await buildReportCardSvg(rc, school, settings, logoBase64);
        const ext = format === 'png' ? 'png' : 'pdf';
        const buf = format === 'png' ? await renderReportCardPng(svg, 3) : await renderReportCardPdf(svg);
        archive.append(buf, { name: `report-card-${(rc.student as any)?.admissionNo || rc.id}.${ext}` });
      } catch { /* skip failed */ }
    }

    archive.finalize();
    await processPromise;
    const zipBuf = Buffer.concat(chunks);
    return new NextResponse(zipBuf, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="report-cards.zip"` } });
  } catch (error) {
    console.error('POST /api/report-cards/export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

async function buildReportCardSvg(rc: any, school: any, settings: any, logoBase64: string | null) {
  const subjectResults = rc.subjectResults ? JSON.parse(rc.subjectResults) : [];
  const attendance = rc.attendanceSummary ? JSON.parse(rc.attendanceSummary) : null;
  const domainGrade = await db.domainGrade.findUnique({ where: { schoolId_studentId_termId: { schoolId: rc.schoolId, studentId: rc.studentId, termId: rc.termId } } });
  const domain = { cognitive: {}, psychomotor: {}, affective: {}, classTeacherComment: domainGrade?.classTeacherComment, classTeacherName: domainGrade?.classTeacherName, principalComment: domainGrade?.principalComment, principalName: domainGrade?.principalName };
  if (domainGrade) {
    domain.cognitive = { reasoning: domainGrade.cognitiveReasoning, memory: domainGrade.cognitiveMemory, concentration: domainGrade.cognitiveConcentration, problemSolving: domainGrade.cognitiveProblemSolving, initiative: domainGrade.cognitiveInitiative, average: domainGrade.cognitiveAverage };
    domain.psychomotor = { handwriting: domainGrade.psychomotorHandwriting, sports: domainGrade.psychomotorSports, drawing: domainGrade.psychomotorDrawing, practical: domainGrade.psychomotorPractical, average: domainGrade.psychomotorAverage };
    domain.affective = { punctuality: domainGrade.affectivePunctuality, neatness: domainGrade.affectiveNeatness, honesty: domainGrade.affectiveHonesty, leadership: domainGrade.affectiveLeadership, cooperation: domainGrade.affectiveCooperation, attentiveness: domainGrade.affectiveAttentiveness, obedience: domainGrade.affectiveObedience, selfControl: domainGrade.affectiveSelfControl, politeness: domainGrade.affectivePoliteness, average: domainGrade.affectiveAverage };
  }

  return renderReportCardSVG({
    student: { name: (rc.student as any)?.name || 'Student', admissionNo: (rc.student as any)?.admissionNo || 'N/A' },
    school: { name: school?.name || 'School', logoBase64, address: school?.address, motto: school?.motto, phone: school?.phone, email: school?.email, website: school?.website, primaryColor: school?.primaryColor },
    settings: { principalName: settings?.principalName, nextTermBegins: settings?.nextTermBegins, academicSession: settings?.academicSession },
    term: { name: rc.term?.name || 'Term', order: (rc.term as any)?.order || 1 },
    cls: { name: rc.classId || 'Class' },
    subjectResults: subjectResults,
    attendance: attendance || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
    domainGrade: domain,
    gradeScale: DEFAULT_THRESHOLDS,
    totals: { grandTotal: rc.totalScore || 0, averageScore: rc.averageScore || 0, totalStudents: 1, classRank: rc.classRank, overallGrade: rc.grade || 'F', overallRemark: '' },
    teacherComment: rc.teacherComment,
    principalComment: rc.principalComment,
    showChart: true, showDomains: true, showAttendance: true, showLegend: true,
  });
}
