import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import { requireAuth } from '@/lib/auth-middleware';
import { renderReportCardPdf } from '@/lib/report-card-pdf';

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    const arr = await res.arrayBuffer();
    const b64 = Buffer.from(arr).toString('base64');
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
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
    .flatMap(([subjectId, subjectExams]) => {
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

      const hasAnyScores = Object.values(scoresByType).some(s => s.raw > 0);
      if (!hasAnyScores) return [];

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

      return [{
        subjectId, subjectName: subjectExams[0].subject.name,
        caScore: Math.round((caMax > 0 ? (caTotal / caMax) * 40 : 0) * 100) / 100,
        examScore: Math.round((examMax > 0 ? (examTotal / examMax) * 60 : 0) * 100) / 100,
        total: Math.round(total), grade, remark, scoresByType,
      }];
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
    const student = reportCard.student;

    const [logoBase64, photoBase64] = await Promise.all([
      school?.logo ? fetchImageAsDataUri(school.logo) : Promise.resolve(null),
      student?.photo ? fetchImageAsDataUri(student.photo) : Promise.resolve(null),
    ]);

    const academicYear = settings?.academicSession
      || reportCard.term?.academicYear?.name
      || '—';

    const pdfBuffer = await renderReportCardPdf({
      student: {
        name: student?.user?.name || '—',
        admissionNo: student?.admissionNo || '—',
        gender: student?.gender,
        dateOfBirth: student?.dateOfBirth ? new Date(student.dateOfBirth).toISOString() : null,
        bloodGroup: student?.bloodGroup,
        photoBase64,
        classPosition: reportCard.classRank
          ? `#${reportCard.classRank} of ${data.totalStudents || '—'}`
          : undefined,
      },
      school: {
        name: school?.name || 'School Name',
        logoBase64,
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
      },
      subjectResults,
      scoreTypes: scoreTypes.map(st => ({ id: st.id, name: st.name, weight: st.weight })),
      attendance,
      domainGrade: domainGrade as never,
      isThirdTerm,
      totals: {
        grandTotal: data.grandTotal,
        averageScore: data.averageScore,
        overallGrade: data.overallGrade,
        overallRemark: data.overallRemark,
        classRank: reportCard.classRank ?? null,
        totalStudents: data.totalStudents,
        passed: data.passed,
        failed: data.failed,
      },
    });

    const filename = `report-card-${(student?.user?.name || id).replace(/\s+/g, '-')}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
