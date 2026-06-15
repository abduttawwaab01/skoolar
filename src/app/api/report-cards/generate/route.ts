import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateGrade, calculateGPA, getOverallGrade, DEFAULT_THRESHOLDS, calculateClassRank } from '@/lib/report-card-utils/grade-calculator';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, termId, classId, studentIds } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : auth.schoolId;
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const term = await db.term.findUnique({ where: { id: termId }, select: { id: true, academicYearId: true, isCurrent: true, startDate: true, endDate: true } });
    if (!term) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

    const students = studentIds?.length
      ? await db.student.findMany({ where: { id: { in: studentIds }, schoolId: targetSchoolId }, select: { id: true, name: true, admissionNo: true, classId: true } })
      : await db.student.findMany({ where: { schoolId: targetSchoolId, classId }, select: { id: true, name: true, admissionNo: true, classId: true } });

    if (students.length === 0) return NextResponse.json({ error: 'No students found' }, { status: 404 });

    const exams = await db.exam.findMany({
      where: { schoolId: targetSchoolId, termId, classId },
      include: { scores: { include: { scoreType: true } }, subject: { select: { id: true, name: true } }, scoreType: true },
    });
    const scoreTypes = await db.scoreType.findMany({ where: { schoolId: targetSchoolId, isActive: true }, orderBy: { position: 'asc' } });
    const totalWeight = scoreTypes.reduce((s, st) => s + st.weight, 0);

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
      const subjectMap = new Map<string, any>();
      let grandTotal = 0;

      for (const exam of exams) {
        const key = exam.subjectId;
        if (!subjectMap.has(key)) {
          subjectMap.set(key, { subjectId: key, subjectName: exam.subject.name, caScore: 0, examScore: 0, total: 0, scoresByType: {} });
        }
        const rec = subjectMap.get(key)!;
        const score = exam.scores.find((s) => s.studentId === student.id);
        if (exam.type === 'exam') {
          rec.examScore = score ? score.score : 0;
        } else if (score && score.scoreType) {
          const st = score.scoreType;
          const normalized = totalWeight > 0 ? (score.score / Math.max(st.maxMarks, 1)) * (st.weight / totalWeight) * 100 : score.score;
          rec.scoresByType[st.name.toLowerCase().replace(/\s+/g, '')] = { raw: score.score, max: st.maxMarks, normalized };
          rec.caScore += normalized;
        } else if (score) {
          rec.caScore += score.score;
        }
      }

      const subjectResults: any[] = [];
      for (const [, rec] of subjectMap) {
        rec.total = rec.caScore + rec.examScore;
        grandTotal += rec.total;
        const gradeResult = calculateGrade(rec.total, 100, DEFAULT_THRESHOLDS);
        subjectResults.push({ ...rec, ...gradeResult });
      }

      const averageScore = subjectResults.length > 0 ? grandTotal / subjectResults.length : 0;
      const gpa = calculateGPA(subjectResults);
      const overall = getOverallGrade(gpa);
      const att = attendanceMap.get(student.id);
      const attendanceSummary = att ? JSON.stringify({ totalDays: att.total, daysPresent: att.present, daysAbsent: att.total - att.present, percentage: att.total > 0 ? Math.round((att.present / att.total) * 100) : 0 }) : null;

      generated.push({ studentId: student.id, totalScore: grandTotal, averageScore, gpa, grade: overall.grade, overallRemark: overall.remark, subjectResults, attendanceSummary });
    }

    const allScores = generated.map((g) => ({ studentId: g.studentId, totalScore: g.totalScore }));
    const ranks = calculateClassRank(allScores);

    const upserted = [];
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
      include: { student: { select: { id: true, name: true, admissionNo: true, photo: true } }, term: { select: { id: true, name: true, order: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: reportCards });
  } catch (error) {
    console.error('GET /api/report-cards/generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
