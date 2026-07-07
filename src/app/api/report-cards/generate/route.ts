import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import type { SubjectResult, ScoreTypeInfo } from '@/lib/report-card-utils/types';

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
    const totalWeight = scoreTypeInfos.reduce((sum, st) => sum + st.weight, 0);

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
      const subjectMap = new Map<string, {
        subjectId: string; subjectName: string;
        caScore: number; caMax: number;
        examScore: number; examMax: number;
        total: number;
        scoresByType: Record<string, { raw: number; max: number; normalized: number }>;
      }>();
      let grandTotal = 0;

      for (const exam of exams) {
        const key = exam.subjectId;
        if (!subjectMap.has(key)) {
          const sbt: Record<string, { raw: number; max: number; normalized: number }> = {};
          for (const st of scoreTypeInfos) sbt[st.id] = { raw: 0, max: 0, normalized: 0 };
          subjectMap.set(key, { subjectId: key, subjectName: exam.subject.name, caScore: 0, caMax: 0, examScore: 0, examMax: 0, total: 0, scoresByType: sbt });
        }
        const rec = subjectMap.get(key)!;
        const score = exam.scores.find((s) => s.studentId === student.id);
        if (exam.scoreType && !exam.scoreType.isInReport) continue;
        const examType = exam.scoreType?.type || exam.type;
        const maxMarks = exam.totalMarks ?? 100;
        const scoreVal = score ? score.score : 0;
        const stId = exam.scoreTypeId || '';

        if (stId && rec.scoresByType[stId]) {
          rec.scoresByType[stId].raw += scoreVal;
          rec.scoresByType[stId].max += maxMarks;
        }

        if (examType === 'midterm' || examType === 'ca') {
          rec.caScore += scoreVal;
          rec.caMax += maxMarks;
        } else if (examType === 'exam' || examType === 'final') {
          rec.examScore += scoreVal;
          rec.examMax += maxMarks;
        }
      }

      const subjectResults: SubjectResult[] = [];
      for (const [, rec] of subjectMap) {
        const hasAnyScores = Object.values(rec.scoresByType).some(s => s.raw > 0);
        if (!hasAnyScores) continue;

        let total = 0;
        if (totalWeight > 0) {
          for (const st of scoreTypeInfos) {
            const sd = rec.scoresByType[st.id];
            if (sd.max > 0) sd.normalized = Math.round(((sd.raw / sd.max) * (st.weight / totalWeight) * 100) * 100) / 100;
            total += sd.normalized;
          }
        } else {
          total = rec.caScore + rec.examScore;
        }
        total = Math.round(total * 100) / 100;
        rec.total = total;
        const { grade, remark } = calculateGrade(total, 100, REPORT_CARD_SCALE);
        grandTotal += total;

        subjectResults.push({
          subjectId: rec.subjectId, subjectName: rec.subjectName,
          caScore: Math.round((rec.caMax > 0 ? (rec.caScore / rec.caMax) * 40 : 0) * 100) / 100,
          examScore: Math.round((rec.examMax > 0 ? (rec.examScore / rec.examMax) * 60 : 0) * 100) / 100,
          total: Math.round(total), percentage: Math.round(total), grade, remark,
          scoresByType: rec.scoresByType,
        });
      }

      const averageScore = subjectResults.length > 0 ? Math.round((grandTotal / subjectResults.length) * 100) / 100 : 0;
      const overall = calculateGrade(averageScore, 100, REPORT_CARD_SCALE);
      const att = attendanceMap.get(student.id);
      const attendanceSummary = att ? JSON.stringify({ totalDays: att.total, daysPresent: att.present, daysAbsent: att.total - att.present, percentage: att.total > 0 ? Math.round((att.present / att.total) * 100) : 0 }) : null;

      generated.push({ studentId: student.id, totalScore: grandTotal, averageScore, gpa: 0, grade: overall.grade, overallRemark: overall.remark, subjectResults, attendanceSummary });
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
