import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateSubjectResults, calculateAttendance, calculateOverallGrade } from '@/lib/calculate-report-card';
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
      where: { schoolId: targetSchoolId, date: { gte: term.startDate, lte: term.endDate } },
    });
    const attendanceMap = new Map<string, { total: number; present: number }>();
    for (const a of attendances) {
      if (!attendanceMap.has(a.studentId)) attendanceMap.set(a.studentId, { total: 0, present: 0 });
      const rec = attendanceMap.get(a.studentId)!;
      rec.total++;
      if (a.status === 'present') rec.present++;
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
      const att = attendanceMap.get(student.id);
      const attendanceSummary = att ? JSON.stringify(calculateAttendance(
        Array.from({ length: att.total }, (_, i) => ({ status: i < att.present ? 'present' : 'absent' }))
      )) : null;

      generated.push({ studentId: student.id, totalScore: grandTotal, averageScore, gpa: 0, grade: overallGrade, overallRemark, subjectResults, attendanceSummary });
    }

    const allScores = generated.map((g) => ({ studentId: g.studentId, totalScore: g.totalScore }));
    const ranks = calculateClassRank(allScores);

    const upserted: any[] = [];
    for (const g of generated) {
      const rank = ranks.get(g.studentId) || null;
      const rc = await db.reportCard.upsert({
        where: { schoolId_studentId_termId: { schoolId: targetSchoolId, studentId: g.studentId, termId } },
        create: { schoolId: targetSchoolId, studentId: g.studentId, termId, classId, totalScore: g.totalScore, averageScore: g.averageScore, gpa: g.gpa, classRank: rank, grade: g.grade, attendanceSummary: g.attendanceSummary, approvalStatus: 'draft', generatedById: auth.userId, subjectResults: JSON.stringify(g.subjectResults) },
        update: { totalScore: g.totalScore, averageScore: g.averageScore, gpa: g.gpa, classRank: rank, grade: g.grade, attendanceSummary: g.attendanceSummary, subjectResults: JSON.stringify(g.subjectResults) },
      });
      upserted.push(rc);
    }

    return NextResponse.json({ count: upserted.length, data: upserted });
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
