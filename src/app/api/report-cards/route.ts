import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateSubjectGrade as calculateGrade, calculateSubjectGPA as calculateGPA, getOverallGrade, DEFAULT_THRESHOLDS } from '@/lib/grade-calculator';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const querySchoolId = searchParams.get('schoolId') || '';
    const termId = searchParams.get('termId') || '';
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';
    const approvalStatus = searchParams.get('approvalStatus') || '';
    const isPublished = searchParams.get('isPublished');

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    where.deletedAt = null;
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (termId) where.termId = termId;
    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (isPublished !== null) where.isPublished = isPublished === 'true';

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      db.reportCard.findMany({
        where: where as any,
        include: { student: { select: { id: true, admissionNo: true, user: { select: { name: true } } } }, term: { select: { id: true, name: true, order: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      db.reportCard.count({ where: where as any }),
    ]);

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('GET /api/report-cards error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(auth.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, studentId, termId, classId, teacherComment, principalComment, behaviorRating } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? schoolId : auth.schoolId;
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const student = await db.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
    if (!student || student.schoolId !== targetSchoolId) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const term = await db.term.findUnique({ where: { id: termId }, select: { id: true, academicYearId: true, isCurrent: true, startDate: true, endDate: true } });
    if (!term) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

    const exams = await db.exam.findMany({
      where: { schoolId: targetSchoolId, termId, classId },
      include: { scores: { where: { studentId }, include: { scoreType: true } }, subject: { select: { id: true, name: true } }, scoreType: true },
    });

    const scoreTypes = await db.scoreType.findMany({ where: { schoolId: targetSchoolId, isActive: true }, orderBy: { position: 'asc' } });
    const scoreTypeInfos = scoreTypes.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));
    const totalWeight = scoreTypeInfos.reduce((s, st) => s + st.weight, 0);

    const subjectMap = new Map<string, { subjectId: string; subjectName: string; caScore: number; caMax: number; examScore: number; examMax: number; total: number; scoresByType: Record<string, { raw: number; max: number; normalized: number }> }>();

    for (const exam of exams) {
      const key = exam.subjectId;
      if (!subjectMap.has(key)) {
        const sbt: Record<string, { raw: number; max: number; normalized: number }> = {};
        for (const st of scoreTypeInfos) sbt[st.id] = { raw: 0, max: 0, normalized: 0 };
        subjectMap.set(key, { subjectId: key, subjectName: exam.subject.name, caScore: 0, caMax: 0, examScore: 0, examMax: 0, total: 0, scoresByType: sbt });
      }
      const rec = subjectMap.get(key)!;

      if (exam.scoreType && !exam.scoreType.isInReport) continue;
      const examType = exam.scoreType?.type || exam.type;
      const maxMarks = exam.totalMarks ?? 100;
      const score = exam.scores[0];
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
      } else if (!stId || !rec.scoresByType[stId]) {
        rec.caScore += scoreVal;
        rec.caMax += maxMarks;
      }
    }

    let grandTotal = 0;
    const subjectResults: any[] = [];
    for (const [, rec] of subjectMap) {
      const hasScoresByType = Object.values(rec.scoresByType).some(s => s.raw > 0);
      const hasAnyScores = hasScoresByType || rec.caScore > 0 || rec.examScore > 0;
      if (!hasAnyScores) continue;

      let total = 0;
      if (totalWeight > 0 && hasScoresByType) {
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
      grandTotal += total;
      const { grade, remark } = calculateGrade(total, 100, DEFAULT_THRESHOLDS);
      subjectResults.push({
        subjectId: rec.subjectId, subjectName: rec.subjectName,
        caScore: Math.round((rec.caMax > 0 ? (rec.caScore / rec.caMax) * 40 : 0) * 100) / 100,
        examScore: Math.round((rec.examMax > 0 ? (rec.examScore / rec.examMax) * 60 : 0) * 100) / 100,
        total: Math.round(total), percentage: Math.round(total), grade, remark,
        scoresByType: rec.scoresByType,
      });
    }

    const averageScore = subjectResults.length > 0 ? grandTotal / subjectResults.length : 0;
    const gpa = calculateGPA(subjectResults);
    const overall = getOverallGrade(gpa);

    const allStudents = await db.reportCard.groupBy({
      by: ['studentId'], where: { schoolId: targetSchoolId, termId, classId },
      _sum: { totalScore: true },
    });

    const sorted = allStudents.sort((a: any, b: any) => (b._sum.totalScore || 0) - (a._sum.totalScore || 0));
    const classRank = sorted.findIndex((s: any) => s.studentId === studentId) + 1 || 0;

    const attendances = await db.attendance.findMany({
      where: { studentId, schoolId: targetSchoolId, date: { gte: term.startDate, lte: term.endDate } },
    });
    const totalDays = attendances.length;
    const daysPresent = attendances.filter((a) => a.status === 'present').length;
    const attendanceSummary = JSON.stringify({ totalDays, daysPresent, daysAbsent: totalDays - daysPresent, percentage: totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0 });

    const reportCard = await db.reportCard.upsert({
      where: { schoolId_studentId_termId: { schoolId: targetSchoolId, studentId, termId } },
      create: { schoolId: targetSchoolId, studentId, termId, classId, totalScore: grandTotal, averageScore, gpa, classRank: classRank || null, grade: overall.grade, teacherComment: teacherComment || null, principalComment: principalComment || null, attendanceSummary, behaviorRating: behaviorRating || null, approvalStatus: 'draft', generatedById: auth.userId },
      update: { totalScore: grandTotal, averageScore, gpa, classRank: classRank || null, grade: overall.grade, teacherComment: teacherComment || undefined, principalComment: principalComment || undefined, attendanceSummary, behaviorRating: behaviorRating || undefined },
    });

    return NextResponse.json({ data: reportCard, subjectResults, overallGrade: overall.grade, overallRemark: overall.remark });
  } catch (error) {
    console.error('POST /api/report-cards error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
