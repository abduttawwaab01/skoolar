import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import { requireAuth } from '@/lib/auth-middleware';

async function getReportCardData(id: string) {
  const reportCard = await db.reportCard.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          user: { select: { name: true, email: true } },
          class: { select: { id: true, name: true, section: true, grade: true } },
        },
      },
      term: {
        include: { academicYear: { select: { name: true, id: true } } },
      },
    },
  });
  if (!reportCard) return null;

  const [school, settings] = await Promise.all([
    db.school.findUnique({ where: { id: reportCard.schoolId } }),
    db.schoolSettings.findUnique({ where: { schoolId: reportCard.schoolId } }),
  ]);

  let attendance = { totalDays: 0, presentDays: 0, absentDays: 0, percentage: 0 };
  try {
    if (reportCard.attendanceSummary) {
      attendance = JSON.parse(reportCard.attendanceSummary);
    }
  } catch { /* ignore */ }

  const isThirdTerm = reportCard.term.name.toLowerCase().includes('3') || reportCard.term.order === 3;

  let domainGrade: Record<string, unknown> | null = null;
  if (isThirdTerm) {
    const dg = await db.domainGrade.findUnique({
      where: { schoolId_studentId_termId: { schoolId: reportCard.schoolId, studentId: reportCard.studentId, termId: reportCard.termId } },
    });
    if (dg) {
      domainGrade = {
        cognitive: {
          reasoning: dg.cognitiveReasoning, memory: dg.cognitiveMemory, concentration: dg.cognitiveConcentration,
          problemSolving: dg.cognitiveProblemSolving, initiative: dg.cognitiveInitiative, average: dg.cognitiveAverage,
        },
        psychomotor: {
          handwriting: dg.psychomotorHandwriting, sports: dg.psychomotorSports, drawing: dg.psychomotorDrawing,
          practical: dg.psychomotorPractical, average: dg.psychomotorAverage,
        },
        affective: {
          punctuality: dg.affectivePunctuality, neatness: dg.affectiveNeatness, honesty: dg.affectiveHonesty,
          leadership: dg.affectiveLeadership, cooperation: dg.affectiveCooperation, attentiveness: dg.affectiveAttentiveness,
          obedience: dg.affectiveObedience, selfControl: dg.affectiveSelfControl, politeness: dg.affectivePoliteness,
          average: dg.affectiveAverage,
        },
        classTeacherComment: dg.classTeacherComment, classTeacherName: dg.classTeacherName,
        principalComment: dg.principalComment, principalName: dg.principalName,
      };
    }
  }

  const exams = await db.exam.findMany({
    where: { schoolId: reportCard.schoolId, termId: reportCard.termId, classId: reportCard.classId, deletedAt: null },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } },
      scores: {
        where: { studentId: reportCard.studentId },
        include: { scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } } },
      },
    },
  });

  const examsBySubject = new Map<string, typeof exams>();
  for (const exam of exams) {
    const key = exam.subjectId;
    if (!examsBySubject.has(key)) examsBySubject.set(key, []);
    examsBySubject.get(key)!.push(exam);
  }

  let grandTotal = 0;
  const subjectResults = Array.from(examsBySubject.entries())
    .map(([subjectId, subjectExams]) => {
      let caTotal = 0, caMax = 0, examTotal = 0, examMax = 0;
      for (const exam of subjectExams) {
        if (exam.scoreType && !exam.scoreType.isInReport) continue;
        const examType = exam.scoreType?.type || exam.type;
        const maxMarks = exam.totalMarks || 100;
        const score = exam.scores[0]?.score || 0;
        if (examType === 'midterm' || examType === 'ca') { caTotal += score; caMax += maxMarks; }
        else if (examType === 'exam' || examType === 'final') { examTotal += score; examMax += maxMarks; }
      }
      const caScore = caMax > 0 ? Math.round(((caTotal / caMax) * 40) * 100) / 100 : 0;
      const examScore = examMax > 0 ? Math.round(((examTotal / examMax) * 60) * 100) / 100 : 0;
      const total = Math.round((caScore + examScore) * 100) / 100;
      const { grade, remark } = calculateGrade(total, 100, REPORT_CARD_SCALE);
      grandTotal += total;
      return { subjectId, subjectName: subjectExams[0].subject.name, caScore, examScore, total: Math.round(total), grade, remark };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const totalStudents = await db.student.count({
    where: { classId: reportCard.classId, schoolId: reportCard.schoolId, deletedAt: null, isActive: true },
  });

  const averageScore = subjectResults.length > 0 ? Math.round((grandTotal / subjectResults.length) * 100) / 100 : 0;
  const overallGrade = calculateGrade(averageScore, 100, REPORT_CARD_SCALE);

  return {
    reportCard,
    school, settings, attendance, isThirdTerm, domainGrade,
    subjectResults, grandTotal, averageScore, totalStudents,
    overallGrade: overallGrade.grade,
    overallRemark: overallGrade.remark,
    passed: subjectResults.filter(s => s.total >= 50).length,
    failed: subjectResults.filter(s => s.total < 50).length,
  };
}

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

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && data.reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { reportCard, school, settings, subjectResults, attendance, domainGrade, isThirdTerm } = data;

    // Build PDF using pdfkit
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Collect PDF chunks
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    return new Promise<NextResponse>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="report-card-${reportCard.student?.user?.name?.replace(/\s+/g, '-') || id}.pdf"`,
          },
        }));
      });

      const pageWidth = doc.page.width - 100;
      const centerX = doc.page.width / 2;
      let y = 50;

      // Helper: draw a horizontal line
      const hline = (yPos: number, width = pageWidth, xOffset = 50) => {
        doc.moveTo(xOffset, yPos).lineTo(xOffset + width, yPos).stroke('#ccc');
      };

      // Helper: center text
      const centerText = (text: string, yPos: number, size = 10, opts = {}) => {
        doc.fontSize(size).font('Helvetica-Bold').text(text, centerX, yPos, { align: 'center', ...opts });
      };

      // ── HEADER ──
      const schoolName = school?.name || 'School Name';
      centerText(schoolName.toUpperCase(), y, 18);
      y += 22;
      if (school?.address) {
        doc.fontSize(9).font('Helvetica').text(school.address, centerX, y, { align: 'center' });
        y += 14;
      }
      if (school?.motto || settings?.schoolMotto) {
        const motto = school?.motto || settings?.schoolMotto || '';
        doc.fontSize(9).font('Helvetica-Oblique').text(`"${motto}"`, centerX, y, { align: 'center' });
        y += 14;
      }
      if (school?.email || school?.phone || school?.website) {
        const contact = [school.email, school.phone, school.website].filter(Boolean).join(' | ');
        doc.fontSize(8).font('Helvetica').text(contact, centerX, y, { align: 'center' });
        y += 14;
      }

      hline(y += 4);
      y += 12;

      // ── TITLE ──
      centerText('REPORT CARD', y, 16);
      y += 20;

      // ── STUDENT INFO ──
      doc.fontSize(10).font('Helvetica-Bold');
      const studentName = reportCard.student?.user?.name || 'Student';
      const className = reportCard.student?.class?.name || '';
      const termName = reportCard.term?.name || '';
      const sessionName = reportCard.term?.academicYear?.name || '';

      doc.text(`Student:`, 50, y);
      doc.font('Helvetica').text(studentName, 120, y);
      doc.font('Helvetica-Bold').text(`Class:`, 300, y);
      doc.font('Helvetica').text(className, 345, y);
      y += 16;

      doc.font('Helvetica-Bold').text(`Admission No:`, 50, y);
      doc.font('Helvetica').text(reportCard.student?.admissionNo || '—', 150, y);
      doc.font('Helvetica-Bold').text(`Term:`, 300, y);
      doc.font('Helvetica').text(termName, 345, y);
      y += 16;

      doc.font('Helvetica-Bold').text(`Session:`, 50, y);
      doc.font('Helvetica').text(sessionName, 120, y);
      doc.font('Helvetica-Bold').text(`Grade:`, 300, y);
      doc.font('Helvetica').text(data.overallGrade, 345, y);
      y += 20;

      // ── SUBJECT SCORES TABLE ──
      hline(y);
      y += 2;

      // Table header
      const colX = [50, 180, 290, 340, 390, 440, 490];
      const colW = [130, 110, 50, 50, 50, 50, 60];
      const headers = ['Subject', 'CA (40%)', 'Exam (60%)', 'Total', 'Grade', 'Remark'];

      doc.rect(50, y, pageWidth, 18).fill('#f3f4f6');
      doc.fontSize(8).font('Helvetica-Bold').fill('#333');
      headers.forEach((h, i) => doc.text(h, colX[i] + 4, y + 5, { width: colW[i], align: i === 0 ? 'left' : 'center' }));
      y += 18;

      // Table rows
      let row = 0;
      for (const sr of subjectResults) {
        const bg = row % 2 === 0 ? '#ffffff' : '#fafafa';
        doc.rect(50, y, pageWidth, 16).fill(bg);
        doc.fontSize(8).font('Helvetica').fill('#333');
        doc.text(sr.subjectName, colX[0] + 4, y + 4, { width: colW[0] - 4 });
        doc.text(sr.caScore.toFixed(1), colX[1] + 4, y + 4, { width: colW[1] - 4, align: 'center' });
        doc.text(sr.examScore.toFixed(1), colX[2] + 4, y + 4, { width: colW[2] - 4, align: 'center' });
        doc.text(sr.total.toString(), colX[3] + 4, y + 4, { width: colW[3] - 4, align: 'center' });
        doc.text(sr.grade, colX[4] + 4, y + 4, { width: colW[4] - 4, align: 'center' });
        doc.text(sr.remark, colX[5] + 4, y + 4, { width: colW[5] - 4, align: 'center' });
        y += 16;
        row++;
      }

      hline(y);
      y += 8;

      // ── SUMMARY ──
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text(`Total Subjects: ${subjectResults.length}`, 50, y);
      doc.text(`Passed: ${data.passed}`, 200, y);
      doc.text(`Failed: ${data.failed}`, 320, y);
      y += 16;

      doc.text(`Average Score: ${data.averageScore}%`, 50, y);
      doc.text(`Overall Grade: ${data.overallGrade} (${data.overallRemark})`, 200, y);
      doc.text(`Class Rank: #${reportCard.classRank || '—'} of ${data.totalStudents}`, 400, y);
      y += 16;

      doc.text(`GPA: ${reportCard.gpa?.toFixed(2) || '—'}`, 50, y);
      y += 20;

      // ── ATTENDANCE ──
      if (attendance.totalDays > 0) {
        hline(y);
        y += 8;
        doc.fontSize(10).font('Helvetica-Bold').text('Attendance', 50, y);
        y += 14;
        doc.fontSize(9).font('Helvetica');
        doc.text(`Total Days: ${attendance.totalDays}`, 50, y);
        doc.text(`Present: ${attendance.presentDays}`, 170, y);
        doc.text(`Absent: ${attendance.absentDays}`, 290, y);
        doc.text(`Attendance: ${attendance.percentage}%`, 410, y);
        y += 20;
      }

      // Page break if needed for domain grades
      if (y > 550) {
        doc.addPage();
        y = 50;
      }

      // ── DOMAIN GRADES (3rd term) ──
      if (domainGrade) {
        hline(y);
        y += 8;
        doc.fontSize(10).font('Helvetica-Bold').text('Domain Grades', 50, y);
        y += 14;

        const domainTypes = [
          { label: 'Cognitive', data: (domainGrade as any).cognitive as Record<string, string | null> },
          { label: 'Psychomotor', data: (domainGrade as any).psychomotor as Record<string, string | null> },
          { label: 'Affective', data: (domainGrade as any).affective as Record<string, string | null> },
        ];

        const dColX = [50, 230, 410];
        doc.fontSize(8).font('Helvetica-Bold');

        domainTypes.forEach((dt, di) => {
          const dx = dColX[di];
          doc.text(dt.label, dx, y);
          doc.font('Helvetica');
          let dy = y + 12;
          Object.entries(dt.data).forEach(([key, val]) => {
            if (key === 'average') return;
            doc.text(`${key}: ${val || '—'}`, dx, dy);
            dy += 11;
          });
          // Average
          doc.font('Helvetica-Bold').text(`Average: ${dt.data.average || '—'}`, dx, dy);
        });

        y += 100;

        // Comments
        const dg = domainGrade as any;
        if (dg.classTeacherComment) {
          doc.fontSize(9).font('Helvetica-Bold').text("Class Teacher's Comment:", 50, y);
          doc.font('Helvetica').text(dg.classTeacherComment, 200, y);
          y += 16;
        }
        if (dg.principalComment) {
          doc.fontSize(9).font('Helvetica-Bold').text("Principal's Comment:", 50, y);
          doc.font('Helvetica').text(dg.principalComment, 200, y);
          y += 16;
        }
        y += 8;
      }

      // ── COMMENTS ──
      if (reportCard.teacherComment || reportCard.principalComment) {
        hline(y);
        y += 8;
        doc.fontSize(10).font('Helvetica-Bold').text('Comments', 50, y);
        y += 14;
        doc.fontSize(9);
        if (reportCard.teacherComment) {
          doc.font('Helvetica-Bold').text('Teacher:', 50, y);
          doc.font('Helvetica').text(reportCard.teacherComment, 120, y, { width: pageWidth - 120 });
          y += 16;
        }
        if (reportCard.principalComment) {
          doc.font('Helvetica-Bold').text('Principal:', 50, y);
          doc.font('Helvetica').text(reportCard.principalComment, 120, y, { width: pageWidth - 120 });
          y += 16;
        }
      }

      // ── GRADING KEY ──
      if (y > 600) { doc.addPage(); y = 50; }
      hline(y);
      y += 8;
      doc.fontSize(10).font('Helvetica-Bold').text('Grading Key', 50, y);
      y += 14;

      const gradeScale = REPORT_CARD_SCALE.thresholds;
      const gColX = [50, 200, 350];
      doc.fontSize(8);
      gradeScale.forEach((gs, gi) => {
        const col = gi % 2;
        const row2 = Math.floor(gi / 2);
        const gx = gColX[col];
        const gy = y + row2 * 14;
        const nextMin = gradeScale[gi + 1]?.min ?? 0;
        const range = gs.min === 70 ? '70 - 100' : `${gs.min} - ${nextMin === 0 ? 100 : nextMin - 1}`;
        doc.font('Helvetica-Bold').text(`${gs.grade}:`, gx, gy, { width: 30 });
        doc.font('Helvetica').text(`${range}% - ${gs.remark}`, gx + 30, gy, { width: 120 });
      });

      y += gradeScale.length / 2 * 14 + 8;
      y += 20;

      // ── NEXT TERM ──
      if (settings?.nextTermBegins) {
        hline(y);
        y += 8;
        doc.fontSize(9).font('Helvetica-Bold').text(`Next Term Begins:`, 50, y);
        doc.font('Helvetica').text(new Date(settings.nextTermBegins).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), 180, y);
        y += 16;
      }

      // ── FOOTER ──
      if (y > 700) { doc.addPage(); y = 50; }
      y = Math.max(y, doc.page.height - 80);
      hline(y);

      doc.fontSize(8).font('Helvetica').fill('#999');
      doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, centerX, y + 8, { align: 'center' });
      doc.text('Powered by Skoolar Education Management Platform', centerX, y + 20, { align: 'center' });

      doc.end();
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
