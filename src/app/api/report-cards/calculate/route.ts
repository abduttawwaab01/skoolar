import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import { db } from '@/lib/db';
import type { SubjectResult, ScoreTypeInfo } from '@/lib/report-card-utils/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { studentId, termId, classId, schoolId: bodySchoolId } = body;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId
      ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !studentId || !termId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [school, student, term, settings] = await Promise.all([
      db.school.findUnique({ where: { id: targetSchoolId } }),
      db.student.findUnique({
        where: { id: studentId, schoolId: targetSchoolId },
        include: { user: { select: { name: true, email: true, avatar: true } }, class: { select: { id: true, name: true, section: true } } },
      }),
      db.term.findUnique({ where: { id: termId, schoolId: targetSchoolId }, include: { academicYear: { select: { id: true, name: true } } } }),
      db.schoolSettings.findUnique({ where: { schoolId: targetSchoolId } }),
    ]);

    if (!school || !student || !term) {
      return NextResponse.json({ error: 'School, student, or term not found' }, { status: 404 });
    }

    const [exams, scoreTypeRecords, attendanceRecords, domainGradeRecord] = await Promise.all([
      db.exam.findMany({
        where: { schoolId: targetSchoolId, termId, classId, deletedAt: null },
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
        where: { schoolId: targetSchoolId, isInReport: true, isActive: true },
        orderBy: { position: 'asc' },
      }),
      db.attendance.findMany({
        where: { schoolId: targetSchoolId, studentId, termId },
        select: { status: true },
      }),
      db.domainGrade.findUnique({
        where: { schoolId_studentId_termId: { schoolId: targetSchoolId, studentId, termId } },
      }),
    ]);

    const scoreTypes: ScoreTypeInfo[] = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));
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
        for (const st of scoreTypes) { scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 }; }

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

          if (examType === 'midterm' || examType === 'ca') {
            caTotal += score;
            caMax += maxMarks;
          } else if (examType === 'exam' || examType === 'final') {
            examTotal += score;
            examMax += maxMarks;
          } else if (!stId || !scoresByType[stId]) {
            caTotal += score;
            caMax += maxMarks;
          }
        }

        const hasScoresByType = Object.values(scoresByType).some(s => s.raw > 0);
        const hasAnyScores = hasScoresByType || caTotal > 0 || examTotal > 0;
        if (!hasAnyScores) return [];

        let total = 0;
        if (totalWeight > 0 && hasScoresByType) {
          for (const st of scoreTypes) {
            const sd = scoresByType[st.id];
            if (sd.max > 0) sd.normalized = Math.round(((sd.raw / sd.max) * (st.weight / totalWeight) * 100) * 100) / 100;
            total += sd.normalized;
          }
        } else {
          total = caTotal + examTotal;
        }
        total = Math.round(total * 100) / 100;
        const { grade, remark } = calculateGrade(total, 100, REPORT_CARD_SCALE);
        grandTotal += total;

        return [{
          subjectId, subjectName: subjectExams[0].subject.name,
          caScore: Math.round((caMax > 0 ? (caTotal / caMax) * 40 : 0) * 100) / 100,
          examScore: Math.round((examMax > 0 ? (examTotal / examMax) * 60 : 0) * 100) / 100,
          total: Math.round(total), percentage: Math.round(total), grade, remark,
          scoresByType,
        } as SubjectResult];
      })
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    const averageScore = subjectResults.length > 0 ? Math.round((grandTotal / subjectResults.length) * 100) / 100 : 0;
    const overall = calculateGrade(averageScore, 100, REPORT_CARD_SCALE);

    const totalDays = attendanceRecords.length;
    const daysPresent = attendanceRecords.filter(a => a.status === 'present').length;
    const attendance = {
      totalDays,
      daysPresent,
      daysAbsent: totalDays - daysPresent,
      percentage: totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0,
    };

    const domainGrade = domainGradeRecord ? {
      cognitive: {
        reasoning: domainGradeRecord.cognitiveReasoning,
        memory: domainGradeRecord.cognitiveMemory,
        concentration: domainGradeRecord.cognitiveConcentration,
        problemSolving: domainGradeRecord.cognitiveProblemSolving,
        initiative: domainGradeRecord.cognitiveInitiative,
        average: domainGradeRecord.cognitiveAverage,
      },
      psychomotor: {
        handwriting: domainGradeRecord.psychomotorHandwriting,
        sports: domainGradeRecord.psychomotorSports,
        drawing: domainGradeRecord.psychomotorDrawing,
        practical: domainGradeRecord.psychomotorPractical,
        average: domainGradeRecord.psychomotorAverage,
      },
      affective: {
        punctuality: domainGradeRecord.affectivePunctuality,
        neatness: domainGradeRecord.affectiveNeatness,
        honesty: domainGradeRecord.affectiveHonesty,
        leadership: domainGradeRecord.affectiveLeadership,
        cooperation: domainGradeRecord.affectiveCooperation,
        attentiveness: domainGradeRecord.affectiveAttentiveness,
        obedience: domainGradeRecord.affectiveObedience,
        selfControl: domainGradeRecord.affectiveSelfControl,
        politeness: domainGradeRecord.affectivePoliteness,
        average: domainGradeRecord.affectiveAverage,
      },
      classTeacherComment: domainGradeRecord.classTeacherComment,
      classTeacherName: domainGradeRecord.classTeacherName,
      principalComment: domainGradeRecord.principalComment,
      principalName: domainGradeRecord.principalName,
    } : null;

    return NextResponse.json({
      subjectResults,
      scoreTypes,
      attendance,
      domainGrade,
      totals: {
        grandTotal: Math.round(grandTotal),
        averageScore,
        overallGrade: overall.grade,
        overallRemark: overall.remark,
      },
    });
  } catch (error) {
    console.error('POST /api/report-cards/calculate error:', error);
    const message = error instanceof Error ? error.message : 'Calculation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
