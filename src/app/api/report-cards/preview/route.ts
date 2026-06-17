import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import { renderReportCardSVG, renderReportCardPng } from '@/lib/report-card-utils/render-card-server';
import { calculateGrade, REPORT_CARD_SCALE, DEFAULT_THRESHOLDS } from '@/lib/grade-calculator';
import { db } from '@/lib/db';
import type { DomainData, SubjectResult } from '@/lib/report-card-utils/render-card-server';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { studentId, termId, classId, schoolId: bodySchoolId } = body;
    const schoolId = auth.schoolId || bodySchoolId;
    if (!schoolId || !studentId || !termId) {
      return NextResponse.json({ error: 'Missing required fields: schoolId, studentId, termId' }, { status: 400 });
    }

    const [school, student, term, settings] = await Promise.all([
      db.school.findUnique({ where: { id: schoolId } }),
      db.student.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { name: true, email: true, avatar: true } },
          class: { select: { id: true, name: true, section: true } },
        },
      }),
      db.term.findUnique({
        where: { id: termId },
        include: { academicYear: { select: { name: true } } },
      }),
      db.schoolSettings.findUnique({ where: { schoolId } }),
    ]);

    if (!school || !student || !term) {
      return NextResponse.json({ error: 'School, student, or term not found' }, { status: 404 });
    }

    let domain: DomainData = { cognitive: {}, psychomotor: {}, affective: {} };
    try {
      const dg = await db.domainGrade.findUnique({
        where: { schoolId_studentId_termId: { schoolId, studentId, termId } },
      });
      if (dg) {
        domain = {
          cognitive: {
            reasoning: dg.cognitiveReasoning, memory: dg.cognitiveMemory,
            concentration: dg.cognitiveConcentration, problemSolving: dg.cognitiveProblemSolving,
            initiative: dg.cognitiveInitiative, average: dg.cognitiveAverage,
          },
          psychomotor: {
            handwriting: dg.psychomotorHandwriting, sports: dg.psychomotorSports,
            drawing: dg.psychomotorDrawing, practical: dg.psychomotorPractical,
            average: dg.psychomotorAverage,
          },
          affective: {
            punctuality: dg.affectivePunctuality, neatness: dg.affectiveNeatness,
            honesty: dg.affectiveHonesty, leadership: dg.affectiveLeadership,
            cooperation: dg.affectiveCooperation, attentiveness: dg.affectiveAttentiveness,
            obedience: dg.affectiveObedience, selfControl: dg.affectiveSelfControl,
            politeness: dg.affectivePoliteness, average: dg.affectiveAverage,
          },
        };
      }
    } catch { /* domain grades not available */ }

    const [exams, scoreTypes] = await Promise.all([
      db.exam.findMany({
        where: { schoolId, termId, classId, deletedAt: null },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } },
          scores: {
            where: { studentId },
            include: { scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } } },
          },
        },
      }),
      db.scoreType.findMany({
        where: { schoolId, isInReport: true, isActive: true },
        orderBy: { position: 'asc' },
      }),
    ]);

    const totalWeight = scoreTypes.reduce((sum, st) => sum + st.weight, 0);
    const examsBySubject = new Map<string, typeof exams>();
    for (const exam of exams) {
      const key = exam.subjectId;
      if (!examsBySubject.has(key)) examsBySubject.set(key, []);
      examsBySubject.get(key)!.push(exam);
    }

    let grandTotal = 0;
    const subjectResults: SubjectResult[] = Array.from(examsBySubject.entries())
      .flatMap(([subjectId, subjectExams]) => {
        let caTotal = 0, caMax = 0, examTotal = 0, examMax = 0;
        const scoresByType: Record<string, { raw: number; max: number; normalized: number }> = {};

        for (const st of scoreTypes) {
          scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 };
        }

        for (const exam of subjectExams) {
          if (exam.scoreType && !exam.scoreType.isInReport) continue;
          const examType = exam.scoreType?.type || exam.type;
          const maxMarks = exam.totalMarks ?? 100;
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
          let examScoreVal = examMax > 0 ? (examTotal / examMax) * 60 : 0;
          total = caScore + examScoreVal;
          if (caMax > 0 && caMax <= 40 && examMax > 0 && examMax <= 60) {
            total = caTotal + examTotal;
          }
        }

        total = Math.round(total * 100) / 100;
        const { grade, remark } = calculateGrade(total, 100, REPORT_CARD_SCALE);
        grandTotal += total;

        return [{
          subjectId,
          subjectName: subjectExams[0].subject.name,
          caScore: Math.round((caMax > 0 ? (caTotal / caMax) * 40 : 0) * 100) / 100,
          examScore: Math.round((examMax > 0 ? (examTotal / examMax) * 60 : 0) * 100) / 100,
          total: Math.round(total), grade, remark, scoresByType,
        }];
      })
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    const attRecords = await db.attendance.findMany({
      where: { schoolId, studentId, termId },
      select: { status: true },
    });
    const totalDays = attRecords.length;
    const daysPresent = attRecords.filter(a => a.status === 'present').length;
    const daysAbsent = totalDays - daysPresent;
    const attendance = {
      totalDays,
      daysPresent,
      daysAbsent,
      percentage: totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0,
    };

    const totalStudents = await db.student.count({
      where: { classId, schoolId, deletedAt: null, isActive: true },
    });

    const averageScore = subjectResults.length > 0 ? Math.round((grandTotal / subjectResults.length) * 100) / 100 : 0;
    const overall = calculateGrade(averageScore, 100, REPORT_CARD_SCALE);

    const logoBase64 = school.logo ? await resolveImageBuffer(school.logo, 'logo', request) : null;
    const studentPhotoUrl = student.user?.avatar || student.photo;
    const studentPhoto = studentPhotoUrl ? await resolveImageBuffer(studentPhotoUrl, 'photo', request) : null;

    const svg = await renderReportCardSVG({
      student: {
        name: student.user?.name || 'Student',
        admissionNo: student.admissionNo || 'N/A',
        gender: student.gender || null,
        dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        bloodGroup: student.bloodGroup || null,
        photoBase64: studentPhoto?.buffer?.toString('base64') || null,
      },
      school: {
        name: school.name || 'School',
        logoBase64: logoBase64?.buffer?.toString('base64') || null,
        address: school.address || null,
        motto: school.motto || settings?.schoolMotto || null,
        phone: school.phone || null,
        email: school.email || null,
        website: school.website || null,
        primaryColor: school.primaryColor || '#059669',
      },
      settings: {
        principalName: settings?.principalName || null,
        nextTermBegins: settings?.nextTermBegins || null,
        academicSession: term.academicYear?.name || settings?.academicSession || null,
      },
      term: { name: term.name, order: term.order || 1 },
      cls: { name: student.class?.name || 'Class', section: student.class?.section || null },
      subjectResults,
      attendance,
      domainGrade: domain,
      gradeScale: DEFAULT_THRESHOLDS,
      totals: {
        grandTotal: Math.round(grandTotal),
        averageScore,
        totalStudents,
        overallGrade: overall.grade,
        overallRemark: overall.remark,
      },
      teacherComment: domain?.classTeacherComment || null,
      principalComment: domain?.principalComment || null,
      watermarkText: null,
      showChart: true,
      showDomains: true,
      showAttendance: true,
      showLegend: true,
    });

    const pngBuffer = await renderReportCardPng(svg);
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    console.error('POST /api/report-cards/preview error:', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
