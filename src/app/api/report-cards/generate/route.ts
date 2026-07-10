import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateSubjectResults, calculateAttendance, calculateOverallGrade } from '@/lib/calculate-report-card';
import { calculateGPA } from '@/lib/grade-calculator';
import type { ScoreTypeInfo } from '@/lib/report-card-utils/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(auth.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, termId, classId, studentIds } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : auth.schoolId;
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const term = await db.term.findUnique({ where: { id: termId, schoolId: targetSchoolId }, select: { id: true, academicYearId: true, isCurrent: true, startDate: true, endDate: true } });
    if (!term) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

    const students = studentIds?.length
      ? await db.student.findMany({ where: { id: { in: studentIds }, schoolId: targetSchoolId }, select: { id: true, admissionNo: true, classId: true, user: { select: { name: true } } } })
      : await db.student.findMany({ where: { schoolId: targetSchoolId, classId }, select: { id: true, admissionNo: true, classId: true, user: { select: { name: true } } } });

    if (students.length === 0) return NextResponse.json({ error: 'No students found' }, { status: 404 });

    const [exams, scoreTypeRecords] = await Promise.all([
      db.exam.findMany({
        where: { schoolId: targetSchoolId, termId, classId },
        include: { scores: { include: { scoreType: true } }, subject: { select: { id: true, name: true } }, scoreType: true },
      }),
      db.scoreType.findMany({
        where: { schoolId: targetSchoolId, isInReport: true, isActive: true },
        orderBy: { position: 'asc' },
      }),
    ]);

    const scoreTypeInfos: ScoreTypeInfo[] = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));

    const attendances = await db.attendance.findMany({
      where: { schoolId: targetSchoolId, classId, date: { gte: term.startDate, lte: term.endDate } },
    });
    const attendanceMap = new Map<string, typeof attendances>();
    for (const a of attendances) {
      if (!attendanceMap.has(a.studentId)) attendanceMap.set(a.studentId, []);
      attendanceMap.get(a.studentId)!.push(a);
    }

    const domainGrades = await db.domainGrade.findMany({ where: { schoolId: targetSchoolId, termId, classId } });
    const domainMap = new Map(domainGrades.map((d) => [d.studentId, d]));

    const generated: any[] = [];

    for (const student of students) {
      const studentExams = exams.map(e => ({
        ...e,
        scores: e.scores.filter(s => s.studentId === student.id),
      }));

      const { subjectResults, grandTotal } = calculateSubjectResults({
        exams: studentExams,
        scoreTypes: scoreTypeInfos,
      });

      const { averageScore, overallGrade, overallRemark } = calculateOverallGrade(subjectResults, grandTotal);

      const grades = subjectResults.map(r => r.grade);
      const gpa = calculateGPA(grades);

      const studentAttendances = attendanceMap.get(student.id) || [];
      const attendanceSummary = JSON.stringify(calculateAttendance(studentAttendances));

      generated.push({ studentId: student.id, totalScore: grandTotal, averageScore, gpa, grade: overallGrade, overallRemark, subjectResults, attendanceSummary });
    }

    const allScores = generated.map((g) => ({ studentId: g.studentId, totalScore: g.totalScore }));
    const ranks = calculateClassRank(allScores);

    const studentMap = new Map(students.map(s => [s.id, s]));
    const upserted: any[] = [];
    for (const g of generated) {
      const rank = ranks.get(g.studentId) || null;
      const rc = await db.reportCard.upsert({
        where: { schoolId_studentId_termId: { schoolId: targetSchoolId, studentId: g.studentId, termId } },
        create: { schoolId: targetSchoolId, studentId: g.studentId, termId, classId, totalScore: g.totalScore, averageScore: g.averageScore, gpa: g.gpa, classRank: rank, grade: g.grade, attendanceSummary: g.attendanceSummary, approvalStatus: 'draft', generatedById: auth.userId, subjectResults: JSON.stringify(g.subjectResults) },
        update: { totalScore: g.totalScore, averageScore: g.averageScore, gpa: g.gpa, classRank: rank, grade: g.grade, attendanceSummary: g.attendanceSummary, subjectResults: JSON.stringify(g.subjectResults) },
      });
      const stu = studentMap.get(g.studentId);
      const dg = domainMap.get(g.studentId);
      const attendance = g.attendanceSummary ? JSON.parse(g.attendanceSummary) : { totalDays: 0, daysPresent: 0, daysAbsent: 0, daysLate: 0, percentage: 0 };
      upserted.push({
        ...rc,
        student: { id: g.studentId, name: stu?.user?.name || 'Unknown', admissionNo: stu?.admissionNo || '' },
        subjectResults: g.subjectResults,
        attendance,
        numSubjects: g.subjectResults.length,
        grandTotal: Math.round(g.totalScore),
        grandPossible: g.subjectResults.length * 100,
        overallGrade: { grade: g.grade, remark: g.overallRemark },
        domainGrade: dg ? {
          id: dg.id,
          cognitive: { reasoning: dg.cognitiveReasoning, memory: dg.cognitiveMemory, concentration: dg.cognitiveConcentration, problemSolving: dg.cognitiveProblemSolving, initiative: dg.cognitiveInitiative, average: dg.cognitiveAverage },
          psychomotor: { handwriting: dg.psychomotorHandwriting, sports: dg.psychomotorSports, drawing: dg.psychomotorDrawing, practical: dg.psychomotorPractical, average: dg.psychomotorAverage },
          affective: { punctuality: dg.affectivePunctuality, neatness: dg.affectiveNeatness, honesty: dg.affectiveHonesty, leadership: dg.affectiveLeadership, cooperation: dg.affectiveCooperation, attentiveness: dg.affectiveAttentiveness, obedience: dg.affectiveObedience, selfControl: dg.affectiveSelfControl, politeness: dg.affectivePoliteness, average: dg.affectiveAverage },
          classTeacherComment: dg.classTeacherComment, classTeacherName: dg.classTeacherName,
          principalComment: dg.principalComment, principalName: dg.principalName,
        } : null,
      });
    }

    return NextResponse.json({
      count: upserted.length,
      data: upserted,
      meta: {
        school: { id: targetSchoolId },
        term: { id: termId },
        class: { id: classId },
        totalStudents: students.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /api/report-cards/generate error:', error);
    return NextResponse.json({ error: 'Bulk generation failed' }, { status: 500 });
  }
}

function calculateClassRank(scores: { studentId: string; totalScore: number }[]): Map<string, number> {
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
  const ranks = new Map<string, number>();
  sorted.forEach((s, i) => ranks.set(s.studentId, i + 1));
  return ranks;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const termId = searchParams.get('termId') || '';
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const where: any = { schoolId: targetSchoolId, deletedAt: null };
    if (termId) where.termId = termId;
    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;

    const reportCards = await db.reportCard.findMany({
      where,
      include: { student: { select: { id: true, admissionNo: true, photo: true, user: { select: { name: true } } } }, term: { select: { id: true, name: true, order: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: reportCards });
  } catch (error) {
    console.error('GET /api/report-cards/generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
