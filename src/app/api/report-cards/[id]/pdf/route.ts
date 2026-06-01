import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import { requireAuth } from '@/lib/auth-middleware';

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch { return null; }
}

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

  const [exams, scoreTypes] = await Promise.all([
    db.exam.findMany({
      where: { schoolId: reportCard.schoolId, termId: reportCard.termId, classId: reportCard.classId, deletedAt: null },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } },
        scores: {
          where: { studentId: reportCard.studentId },
          include: { scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } } },
        },
      },
    }),
    db.scoreType.findMany({
      where: { schoolId: reportCard.schoolId, isInReport: true, isActive: true },
      orderBy: { position: 'asc' },
    }),
  ]);

  const scoreTypeMap = new Map(scoreTypes.map(st => [st.id, st]));
  const totalWeight = scoreTypes.reduce((sum, st) => sum + st.weight, 0);

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
      const scoresByType: Record<string, { raw: number; max: number; normalized: number }> = {};

      for (const st of scoreTypes) {
        scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 };
      }

      for (const exam of subjectExams) {
        if (exam.scoreType && !exam.scoreType.isInReport) continue;
        const examType = exam.scoreType?.type || exam.type;
        const maxMarks = exam.totalMarks || 100;
        const score = exam.scores[0]?.score || 0;
        const stId = exam.scoreTypeId || '';

        if (stId && scoresByType[stId]) {
          scoresByType[stId].raw += score;
          scoresByType[stId].max += maxMarks;
        }

        if (examType === 'midterm' || examType === 'ca') { caTotal += score; caMax += maxMarks; }
        else if (examType === 'exam' || examType === 'final') { examTotal += score; examMax += maxMarks; }
      }

      let total = 0;
      if (totalWeight > 0) {
        for (const st of scoreTypes) {
          const sd = scoresByType[st.id];
          if (sd.max > 0) {
            sd.normalized = Math.round(((sd.raw / sd.max) * (st.weight / totalWeight) * 100) * 100) / 100;
          }
          total += sd.normalized;
        }
      }

      if (scoreTypes.length === 0) {
        let caScore = caMax > 0 ? (caTotal / caMax) * 40 : 0;
        let examScore = examMax > 0 ? (examTotal / examMax) * 60 : 0;
        total = caScore + examScore;
        if (caMax > 0 && caMax <= 40 && examMax > 0 && examMax <= 60) {
          total = caTotal + examTotal;
        }
      }

      total = Math.round(total * 100) / 100;
      const { grade, remark } = calculateGrade(total, 100, REPORT_CARD_SCALE);
      grandTotal += total;

      return {
        subjectId, subjectName: subjectExams[0].subject.name,
        caScore: Math.round((caMax > 0 ? (caTotal / caMax) * 40 : 0) * 100) / 100,
        examScore: Math.round((examMax > 0 ? (examTotal / examMax) * 60 : 0) * 100) / 100,
        total: Math.round(total), grade, remark, scoresByType,
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const totalStudents = await db.student.count({
    where: { classId: reportCard.classId, schoolId: reportCard.schoolId, deletedAt: null, isActive: true },
  });

  const averageScore = subjectResults.length > 0 ? Math.round((grandTotal / subjectResults.length) * 100) / 100 : 0;
  const overallGrade = calculateGrade(averageScore, 100, REPORT_CARD_SCALE);

  return {
    reportCard, school, settings, attendance, isThirdTerm, domainGrade,
    subjectResults, grandTotal, averageScore, totalStudents,
    scoreTypes,
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

    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && data.reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { reportCard, school, settings, subjectResults, attendance, domainGrade, isThirdTerm, scoreTypes } = data;

    const [schoolLogoBuffer, studentPhotoBuffer] = await Promise.all([
      school?.logo ? fetchImageBuffer(school.logo) : Promise.resolve(null),
      reportCard.student?.photo ? fetchImageBuffer(reportCard.student.photo) : Promise.resolve(null),
    ]);

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

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
      const primaryColor = school?.primaryColor || '#059669';
      let y = 50;

      const hline = (yPos: number, width = pageWidth, xOffset = 50) => {
        doc.moveTo(xOffset, yPos).lineTo(xOffset + width, yPos).stroke('#ccc');
      };

      const centerText = (text: string, yPos: number, size = 10, opts = {}) => {
        doc.fontSize(size).font('Helvetica-Bold').text(text, centerX, yPos, { align: 'center', ...opts });
      };

      // ── HEADER with logo ──
      if (schoolLogoBuffer) {
        try {
          doc.image(schoolLogoBuffer, centerX - 25, y, { width: 50, height: 50 });
          y += 54;
        } catch { /* fall through */ }
      }

      const schoolName = school?.name || 'School Name';
      centerText(schoolName.toUpperCase(), y, 20);
      y += 24;
      if (school?.address) {
        doc.fontSize(9).font('Helvetica').fill('#666').text(school.address, centerX, y, { align: 'center' });
        y += 14;
      }
      if (school?.motto || settings?.schoolMotto) {
        const motto = school?.motto || settings?.schoolMotto || '';
        doc.fontSize(9).font('Helvetica-Oblique').fill('#888').text(`"${motto}"`, centerX, y, { align: 'center' });
        y += 14;
      }
      if (school?.email || school?.phone || school?.website) {
        const contact = [school.email, school.phone, school.website].filter(Boolean).join(' | ');
        doc.fontSize(8).font('Helvetica').fill('#999').text(contact, centerX, y, { align: 'center' });
        y += 14;
      }

      hline(y += 4);
      y += 12;

      // ── TITLE ──
      const termLabel = reportCard.term?.name?.toUpperCase() || '';
      const sessionLabel = reportCard.term?.academicYear?.name || '';
      doc.fontSize(14).font('Helvetica-Bold').fill('#333');
      doc.text(`END OF ${termLabel} TERM REPORT CARD`, centerX, y, { align: 'center' });
      y += 18;
      if (sessionLabel) {
        doc.fontSize(9).font('Helvetica').fill('#666');
        doc.text(`Academic Session: ${sessionLabel}`, centerX, y, { align: 'center' });
        y += 16;
      }

      // ── STUDENT INFO ──
      y += 4;
      doc.rect(50, y, pageWidth, 66).fill('#f9f9f9').stroke('#ddd');
      const student = reportCard.student;
      const cls = student?.class;

      // Left side: text info
      const infoX = 60;
      const infoX2 = 200;
      const infoY = y + 6;
      const lineH = 13;

      doc.fontSize(9).font('Helvetica-Bold').fill('#333');
      doc.text('Student Name:', infoX, infoY);
      doc.font('Helvetica').text(student?.user?.name || '—', infoX + 85, infoY);

      doc.font('Helvetica-Bold');
      doc.text('Admission No:', infoX, infoY + lineH);
      doc.font('Helvetica').text(student?.admissionNo || '—', infoX + 85, infoY + lineH);

      doc.font('Helvetica-Bold');
      doc.text('Class:', infoX, infoY + lineH * 2);
      doc.font('Helvetica').text(cls ? `${cls.name}${cls.section ? ` (${cls.section})` : ''}` : '—', infoX + 85, infoY + lineH * 2);

      doc.font('Helvetica-Bold');
      doc.text('Gender:', infoX, infoY + lineH * 3);
      doc.font('Helvetica').text(student?.gender || '—', infoX + 85, infoY + lineH * 3);

      // Right side
      doc.font('Helvetica-Bold').fill('#333');
      doc.text('Date of Birth:', infoX2, infoY);
      doc.font('Helvetica').text(student?.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', infoX2 + 85, infoY);

      doc.font('Helvetica-Bold');
      doc.text('Blood Group:', infoX2, infoY + lineH);
      doc.font('Helvetica').text(student?.bloodGroup || '—', infoX2 + 85, infoY + lineH);

      doc.font('Helvetica-Bold');
      doc.text('No. in Class:', infoX2, infoY + lineH * 2);
      doc.font('Helvetica').text(String(data.totalStudents || '—'), infoX2 + 85, infoY + lineH * 2);

      doc.font('Helvetica-Bold');
      doc.text('Position:', infoX2, infoY + lineH * 3);
      const posText = reportCard.classRank
        ? `#${reportCard.classRank} of ${data.totalStudents || '—'}`
        : '—';
      doc.font('Helvetica').text(posText, infoX2 + 85, infoY + lineH * 3);

      // Right side: student photo
      if (studentPhotoBuffer) {
        try {
          doc.image(studentPhotoBuffer, doc.page.width - 50 - 55, infoY, { width: 50, height: 50 });
        } catch { /* skip photo */ }
      }

      y += 72;

      // ── SUBJECT SCORES TABLE ──
      hline(y);
      y += 2;

      const scoreTypeCols = scoreTypes.length > 0 ? scoreTypes : [];
      const numScoreCols = scoreTypeCols.length;
      const baseCols = 2; // S/N + Subject
      const endCols = 3; // Total + Grade + Remark
      const totalCols = baseCols + numScoreCols + endCols;

      // Dynamic column widths - distribute remaining width after subject
      const subjectW = 120;
      const scoreTypeW = numScoreCols > 0 ? Math.min(60, Math.floor((pageWidth - subjectW - 120) / numScoreCols)) : 0;
      const totalW = 40;
      const gradeW = 30;
      const remarkW = 50;
      const snW = 20;

      const colXs: number[] = [];
      let cx = 50;
      colXs.push(cx); cx += snW; // S/N
      colXs.push(cx); cx += subjectW; // Subject
      for (let i = 0; i < numScoreCols; i++) { colXs.push(cx); cx += scoreTypeW; } // Score types
      colXs.push(cx); cx += totalW; // Total
      colXs.push(cx); cx += gradeW; // Grade
      // Remark (remaining space)

      // Table header
      doc.rect(50, y, pageWidth, 18).fill(primaryColor);
      doc.fontSize(7).font('Helvetica-Bold').fill('#ffffff');
      let hx = 50;
      const writeHeader = (text: string, w: number, align: 'left' | 'center' = 'center') => {
        doc.text(text, hx + 2, y + 5, { width: w - 2, align });
        hx += w;
      };
      writeHeader('#', snW);
      writeHeader('Subject', subjectW, 'left');
      scoreTypeCols.forEach(st => writeHeader(st.name, scoreTypeW));
      writeHeader('Total', totalW);
      writeHeader('Grade', gradeW);
      writeHeader('Remark', remarkW);
      y += 18;

      // Table rows
      let rowIdx = 0;
      for (const sr of subjectResults) {
        const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f5f5f5';
        doc.rect(50, y, pageWidth, 15).fill(bg);

        const textX1 = 50 + snW;
        const textX2 = textX1 + subjectW;

        doc.fontSize(7).font('Helvetica').fill('#333');
        doc.text(String(rowIdx + 1), 50 + 2, y + 4, { width: snW - 2, align: 'center' });
        doc.text(sr.subjectName, textX1 + 2, y + 4, { width: subjectW - 2 });

        let sx = textX2;
        scoreTypeCols.forEach(st => {
          const val = sr.scoresByType?.[st.id];
          const display = val && val.max > 0 ? String(Math.round(val.normalized)) : '—';
          doc.text(display, sx + 2, y + 4, { width: scoreTypeW - 2, align: 'center' });
          sx += scoreTypeW;
        });

        doc.text(String(sr.total), sx + 2, y + 4, { width: totalW - 2, align: 'center' });
        sx += totalW;
        doc.text(sr.grade, sx + 2, y + 4, { width: gradeW - 2, align: 'center' });
        sx += gradeW;
        doc.text(sr.remark, sx + 2, y + 4, { width: pageWidth - (sx - 50) - 2, align: 'center' });

        y += 15;
        rowIdx++;
      }

      hline(y);
      y += 8;

      // ── SUMMARY ──
      doc.fontSize(9).font('Helvetica-Bold').fill('#333');
      doc.text(`Total Subjects: ${subjectResults.length}`, 50, y);
      doc.text(`Passed: ${data.passed}`, 170, y);
      doc.text(`Failed: ${data.failed}`, 290, y);
      y += 16;

      doc.text(`Average Score: ${data.averageScore}%`, 50, y);
      doc.text(`Overall Grade: ${data.overallGrade} (${data.overallRemark})`, 200, y);
      doc.text(`Class Rank: #${reportCard.classRank || '—'} of ${data.totalStudents}`, 400, y);
      y += 16;

      if (reportCard.gpa) {
        doc.text(`GPA: ${reportCard.gpa.toFixed(2)}`, 50, y);
        y += 16;
      }
      y += 4;

      // ── ATTENDANCE ──
      if (attendance.totalDays > 0) {
        hline(y);
        y += 8;
        doc.fontSize(10).font('Helvetica-Bold').fill('#333').text('Attendance', 50, y);
        y += 14;
        doc.fontSize(9).font('Helvetica').fill('#555');
        doc.text(`Total School Days: ${attendance.totalDays}`, 50, y);
        doc.text(`Days Present: ${attendance.presentDays}`, 170, y);
        doc.text(`Days Absent: ${attendance.absentDays}`, 290, y);
        doc.text(`Attendance Rate: ${attendance.percentage}%`, 410, y);
        y += 20;
      }

      // Page break if needed
      if (y > 550) { doc.addPage(); y = 50; }

      // ── DOMAIN GRADES (3rd term only) ──
      if (domainGrade) {
        hline(y);
        y += 8;
        doc.fontSize(11).font('Helvetica-Bold').fill('#333').text('Affective, Psychomotor & Cognitive Domain Grading', 50, y);
        y += 16;

        const domainTypes = [
          { label: 'Cognitive', data: (domainGrade as any).cognitive as Record<string, string | null> },
          { label: 'Psychomotor', data: (domainGrade as any).psychomotor as Record<string, string | null> },
          { label: 'Affective', data: (domainGrade as any).affective as Record<string, string | null> },
        ];

        const dColW = Math.min(170, (pageWidth - 20) / 3);
        const startX = 50;

        domainTypes.forEach((dt, di) => {
          const dx = startX + di * (dColW + 10);
          const entries = Object.entries(dt.data).filter(([k]) => k !== 'average');
          const avgVal = dt.data.average || '—';
          const domainH = Math.max(entries.length * 13 + 30, 60);

          // Domain box
          doc.rect(dx, y, dColW, domainH).fill('#f9f9f9').stroke('#ddd');
          doc.fontSize(8).font('Helvetica-Bold').fill('#333');
          doc.text(dt.label, dx + 4, y + 4, { width: dColW - 8, align: 'center' });
          doc.fontSize(7).font('Helvetica').fill('#555');

          let iy = y + 16;
          entries.forEach(([key, val]) => {
            doc.text(`${key}: ${val || '—'}`, dx + 4, iy, { width: dColW - 8 });
            iy += 11;
          });

          doc.fontSize(7).font('Helvetica-Bold').fill('#333');
          doc.text(`Average: ${avgVal}`, dx + 4, iy + 2, { width: dColW - 8 });
        });

        y += 105;

        // Teacher & Principal comments from domain grades
        const dg = domainGrade as any;
        if (dg.classTeacherComment || dg.principalComment) {
          y += 4;
          if (dg.classTeacherComment) {
            doc.fontSize(9).font('Helvetica-Bold').fill('#333').text("Class Teacher's Comment:", 50, y);
            doc.font('Helvetica').fill('#555').text(String(dg.classTeacherComment), 200, y, { width: pageWidth - 200 });
            y += 20;
          }
          if (dg.principalComment) {
            doc.fontSize(9).font('Helvetica-Bold').fill('#333').text("Principal's Comment:", 50, y);
            doc.font('Helvetica').fill('#555').text(String(dg.principalComment), 200, y, { width: pageWidth - 200 });
            y += 20;
          }
        }
        y += 4;
      }

      // ── COMMENTS ──
      if (reportCard.teacherComment || reportCard.principalComment) {
        hline(y);
        y += 8;
        doc.fontSize(10).font('Helvetica-Bold').fill('#333').text('Comments', 50, y);
        y += 14;
        doc.fontSize(9);
        if (reportCard.teacherComment) {
          doc.font('Helvetica-Bold').fill('#333').text('Teacher:', 50, y);
          doc.font('Helvetica').fill('#555').text(reportCard.teacherComment, 120, y, { width: pageWidth - 120 });
          y += 18;
        }
        if (reportCard.principalComment) {
          doc.font('Helvetica-Bold').fill('#333').text('Principal:', 50, y);
          doc.font('Helvetica').fill('#555').text(reportCard.principalComment, 120, y, { width: pageWidth - 120 });
          y += 18;
        }
      }

      // ── GRADING KEY ──
      if (y > 600) { doc.addPage(); y = 50; }
      hline(y);
      y += 8;
      doc.fontSize(10).font('Helvetica-Bold').fill('#333').text('Grading Key', 50, y);
      y += 14;

      const gradeScale = REPORT_CARD_SCALE.thresholds;
      const gColX2 = [50, 220, 390];
      doc.fontSize(8);
      gradeScale.forEach((gs, gi) => {
        const col = gi % 2;
        const row2r = Math.floor(gi / 2);
        const gx = gColX2[col];
        const gy = y + row2r * 14;
        const nextMin = gradeScale[gi + 1]?.min ?? 0;
        const range = gs.min === 70 ? '70 - 100' : `${gs.min} - ${nextMin === 0 ? 100 : nextMin - 1}`;
        doc.font('Helvetica-Bold').fill('#333').text(`${gs.grade}:`, gx, gy, { width: 25 });
        doc.font('Helvetica').fill('#555').text(`${range}% - ${gs.remark}`, gx + 25, gy, { width: 140 });
      });

      y += Math.ceil(gradeScale.length / 2) * 14 + 12;

      // ── NEXT TERM ──
      if (settings?.nextTermBegins) {
        hline(y);
        y += 8;
        doc.fontSize(9).font('Helvetica-Bold').fill('#333').text('Next Term Begins:', 50, y);
        doc.font('Helvetica').fill('#555').text(
          new Date(settings.nextTermBegins).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          }),
          180, y
        );
        y += 18;
      }

      // ── FOOTER ──
      if (y > 700) { doc.addPage(); y = 50; }
      y = Math.max(y, doc.page.height - 80);
      hline(y);
      doc.fontSize(7).font('Helvetica').fill('#bbb');
      doc.text(
        `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        centerX, y + 6, { align: 'center' }
      );
      doc.fontSize(6).font('Helvetica').fill('#ccc');
      doc.text('Skoolar - Odebunmi Tawwāb', centerX, y + 16, { align: 'center' });

      doc.end();
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
