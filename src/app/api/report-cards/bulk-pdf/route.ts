import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';
import { calculateSubjectResults, calculateAttendance, calculateOverallGrade } from '@/lib/calculate-report-card';
import { renderReportCardHTML } from '@/lib/report-card-utils/render-card-html';
import { generatePdfFromHtml } from '@/lib/report-card-utils/pdf-generator';
import { renderReportCardSVG, renderReportCardPng } from '@/lib/report-card-utils/render-card-server';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import { DEFAULT_THRESHOLDS } from '@/lib/grade-calculator';
import { A4 } from '@/lib/report-card-utils/constants';
import type { ReportCardData as ReportCardInput, ScoreTypeInfo } from '@/lib/report-card-utils/types';
import type { ReportCardRenderInput, SubjectResult, DomainData } from '@/lib/report-card-utils/render-card-server';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolId, classId, termId } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : auth.schoolId;
    if (!targetSchoolId || !classId || !termId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [school, term, scoreTypeRecords] = await Promise.all([
      db.school.findUnique({ where: { id: targetSchoolId } }),
      db.term.findUnique({ where: { id: termId, schoolId: targetSchoolId }, include: { academicYear: { select: { name: true } } } }),
      db.scoreType.findMany({ where: { schoolId: targetSchoolId, isInReport: true, isActive: true }, orderBy: { position: 'asc' } }),
    ]);

    if (!school || !term) {
      return NextResponse.json({ error: 'School or term not found' }, { status: 404 });
    }

    const scoreTypes: ScoreTypeInfo[] = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: targetSchoolId } });

    const students = await db.student.findMany({
      where: { schoolId: targetSchoolId, classId, deletedAt: null, isActive: true },
      select: { id: true, admissionNo: true, user: { select: { name: true } }, class: { select: { name: true, section: true } } },
    });

    if (students.length === 0) {
      return NextResponse.json({ error: 'No students found' }, { status: 404 });
    }

    const allExams = await db.exam.findMany({
      where: { schoolId: targetSchoolId, termId, classId, deletedAt: null },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } },
        scores: { include: { scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } } } },
      },
    });

    const allAttendance = await db.attendance.findMany({
      where: { schoolId: targetSchoolId, termId },
      select: { studentId: true, status: true },
    });
    const attendanceByStudent = new Map<string, { status: string }[]>();
    for (const a of allAttendance) {
      if (!attendanceByStudent.has(a.studentId)) attendanceByStudent.set(a.studentId, []);
      attendanceByStudent.get(a.studentId)!.push(a);
    }

    const allDomainGrades = await db.domainGrade.findMany({
      where: { schoolId: targetSchoolId, termId, classId },
    });
    const domainByStudent = new Map(allDomainGrades.map(d => [d.studentId, d]));

    const cls = students[0]?.class;

    // Pre-compute data for each student: HTML + SVG-fallback data
    const htmlParts: string[] = [];
    const svgParts: ReportCardRenderInput[] = [];

    for (const student of students) {
      const studentId = student.id;
      const studentExams = allExams.map(e => ({
        ...e,
        scores: e.scores.filter(s => s.studentId === studentId),
      }));

      const { subjectResults, grandTotal } = calculateSubjectResults({
        exams: studentExams,
        scoreTypes,
      });

      const attendanceRecords = attendanceByStudent.get(studentId) || [];
      const attendance = calculateAttendance(attendanceRecords);

      const { averageScore, overallGrade, overallRemark } = calculateOverallGrade(subjectResults, grandTotal);

      const photoUrl = (student.user as any)?.avatar;
      const photoBase64 = photoUrl ? await resolveImageBuffer(photoUrl, 'photo', request) : null;
      const logoBase64 = school?.logo ? await resolveImageBuffer(school.logo, 'logo', request) : null;

      const dg = domainByStudent.get(studentId);
      const domain: any = {
        cognitive: dg ? { reasoning: dg.cognitiveReasoning, memory: dg.cognitiveMemory, concentration: dg.cognitiveConcentration, problemSolving: dg.cognitiveProblemSolving, initiative: dg.cognitiveInitiative, average: dg.cognitiveAverage } : {},
        psychomotor: dg ? { handwriting: dg.psychomotorHandwriting, sports: dg.psychomotorSports, drawing: dg.psychomotorDrawing, practical: dg.psychomotorPractical, average: dg.psychomotorAverage } : {},
        affective: dg ? { punctuality: dg.affectivePunctuality, neatness: dg.affectiveNeatness, honesty: dg.affectiveHonesty, leadership: dg.affectiveLeadership, cooperation: dg.affectiveCooperation, attentiveness: dg.affectiveAttentiveness, obedience: dg.affectiveObedience, selfControl: dg.affectiveSelfControl, politeness: dg.affectivePoliteness, average: dg.affectiveAverage } : {},
        classTeacherComment: dg?.classTeacherComment,
        classTeacherName: dg?.classTeacherName,
        principalComment: dg?.principalComment,
        principalName: dg?.principalName,
      };

      const photoDataUri = photoBase64 ? `data:${photoBase64.contentType};base64,${photoBase64.buffer.toString('base64')}` : null;
      const logoDataUri = logoBase64 ? `data:${logoBase64.contentType};base64,${logoBase64.buffer.toString('base64')}` : null;

      const totals = {
        grandTotal: Math.round(grandTotal),
        averageScore,
        totalStudents: students.length,
        overallGrade,
        overallRemark,
      };

      const reportCardInput: ReportCardInput = {
        student: {
          name: student.user?.name || 'Student',
          admissionNo: student.admissionNo || 'N/A',
          photoBase64: photoDataUri,
        },
        school: {
          name: school.name || 'School',
          logoBase64: logoDataUri,
          address: school.address,
          motto: school.motto,
          phone: school.phone,
          email: school.email,
          primaryColor: school.primaryColor || '#059669',
        },
        settings: {
          principalName: settings?.principalName,
          nextTermBegins: settings?.nextTermBegins,
          academicSession: term.academicYear?.name || settings?.academicSession,
        },
        term: { name: term.name, order: term.order || 1 },
        cls: { name: cls?.name || 'Class', section: cls?.section },
        subjectResults,
        attendance: { daysPresent: attendance.daysPresent, daysAbsent: attendance.daysAbsent, percentage: attendance.percentage, totalDays: attendance.totalDays },
        domainGrade: domain,
        totals,
        teacherComment: dg?.classTeacherComment,
        principalComment: dg?.principalComment,
        showChart: true,
        showDomains: true,
        showAttendance: true,
        scoreTypes,
        radarData: subjectResults.map(r => ({ subject: r.subjectName, score: Math.round(r.percentage || r.total || 0) })),
        chartColumns: 2,
        domainColumns: 3,
      };

      // Generate HTML for Puppeteer approach
      const html = await renderReportCardHTML(reportCardInput, { orientation: 'portrait' });
      htmlParts.push(html);

      // Build SVG input for Puppeteer fallback
      const sr: SubjectResult[] = subjectResults;
      svgParts.push({
        student: {
          name: student.user?.name || 'Student',
          admissionNo: student.admissionNo || 'N/A',
          photoBase64: photoDataUri,
        },
        school: {
          name: school.name || 'School',
          logoBase64: logoDataUri,
          address: school.address,
          motto: school.motto,
          phone: school.phone,
          email: school.email,
          website: school.website,
          primaryColor: school.primaryColor || '#059669',
          secondaryColor: school.secondaryColor || '#059669',
        },
        settings: {
          principalName: settings?.principalName,
          nextTermBegins: settings?.nextTermBegins,
          academicSession: term.academicYear?.name || settings?.academicSession,
        },
        term: { name: term.name, order: term.order || 1 },
        cls: { name: cls?.name || 'Class', section: cls?.section },
        subjectResults: sr,
        attendance: { daysPresent: attendance.daysPresent, daysAbsent: attendance.daysAbsent, percentage: attendance.percentage, totalDays: attendance.totalDays },
        domainGrade: domain,
        gradeScale: DEFAULT_THRESHOLDS,
        totals,
        teacherComment: dg?.classTeacherComment,
        principalComment: dg?.principalComment,
        showChart: true,
        showDomains: true,
        showAttendance: true,
        showLegend: true,
        scoreTypes,
      });
    }

    // Try Puppeteer PDF first
    let pdf: Buffer;
    try {
      const combinedHtml = htmlParts.join('<div style="page-break-after:always"></div>');
      pdf = await generatePdfFromHtml({ html: combinedHtml, orientation: 'portrait' });
    } catch (puppeteerError) {
      console.warn('Puppeteer PDF failed, falling back to SVG→PDF:', puppeteerError);
      // Fallback: generate individual PDF pages using SVG renderer and combine
      const { PDFDocument } = await import('pdf-lib');
      const finalPdf = await PDFDocument.create();
      for (const svgInput of svgParts) {
        const svg = await renderReportCardSVG(svgInput);
        const pngBuffer = await renderReportCardPng(svg);
        const page = finalPdf.addPage([A4.WIDTH_MM * 2.83465, A4.HEIGHT_MM * 2.83465]);
        const { width, height } = page.getSize();
        const pngImage = await finalPdf.embedPng(pngBuffer);
        page.drawImage(pngImage, { x: 0, y: 0, width, height });
      }
      pdf = Buffer.from(await finalPdf.save());
    }

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Report-Cards-${classId}-${termId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('POST /api/report-cards/bulk-pdf error:', error);
    return NextResponse.json({ error: 'Bulk PDF generation failed' }, { status: 500 });
  }
}
