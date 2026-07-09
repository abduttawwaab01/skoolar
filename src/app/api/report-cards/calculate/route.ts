import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';
import { calculateSubjectResults, calculateAttendance, calculateOverallGrade } from '@/lib/calculate-report-card';
import type { ScoreTypeInfo } from '@/lib/report-card-utils/types';

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

    const { subjectResults, grandTotal } = calculateSubjectResults({
      exams,
      scoreTypes,
    });

    const attendance = calculateAttendance(attendanceRecords);
    const { averageScore, overallGrade, overallRemark } = calculateOverallGrade(subjectResults, grandTotal);

    const overall = { grade: overallGrade, remark: overallRemark };

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
