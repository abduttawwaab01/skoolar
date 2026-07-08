import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const reportCard = await db.reportCard.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, admissionNo: true, gender: true, dateOfBirth: true, bloodGroup: true, photo: true, user: { select: { name: true } } } },
        term: { include: { academicYear: { select: { id: true, name: true } } } },
        design: { select: { id: true, name: true, primaryColor: true, fontFamily: true } },
        approvals: { orderBy: { createdAt: 'desc' } },
        comments: true,
        deliveries: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Report card not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const school = await db.school.findUnique({ where: { id: reportCard.schoolId }, select: { id: true, name: true, logo: true, address: true, motto: true, phone: true, email: true, website: true, primaryColor: true, secondaryColor: true } });
    const settings = await db.schoolSettings.findUnique({ where: { schoolId: reportCard.schoolId } });
    const domainGrade = await db.domainGrade.findUnique({ where: { schoolId_studentId_termId: { schoolId: reportCard.schoolId, studentId: reportCard.studentId, termId: reportCard.termId } } });

    const [exams, scoreTypeRecords] = await Promise.all([
      db.exam.findMany({
        where: { schoolId: reportCard.schoolId, termId: reportCard.termId, classId: reportCard.classId, deletedAt: null },
        include: { scores: { where: { studentId: reportCard.studentId } }, subject: { select: { id: true, name: true } }, scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } } },
      }),
      db.scoreType.findMany({
        where: { schoolId: reportCard.schoolId, isInReport: true, isActive: true },
        orderBy: { position: 'asc' },
      }),
    ]);

    const scoreTypeInfos = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));
    const totalWeight = scoreTypeInfos.reduce((sum, st) => sum + st.weight, 0);

    const examsBySubject = new Map<string, typeof exams>();
    for (const exam of exams) {
      const key = exam.subjectId;
      if (!examsBySubject.has(key)) examsBySubject.set(key, []);
      examsBySubject.get(key)!.push(exam);
    }

    let grandTotal = 0;
    const subjectResults: any[] = [];
    for (const [subjectId, subjectExams] of examsBySubject) {
      let caTotal = 0, caMax = 0, examTotal = 0, examMax = 0;
      const scoresByType: Record<string, { raw: number; max: number; normalized: number }> = {};
      for (const st of scoreTypeInfos) { scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 }; }

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
      if (!hasAnyScores) continue;

      let total = 0;
      if (totalWeight > 0 && hasScoresByType) {
        for (const st of scoreTypeInfos) {
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

      subjectResults.push({
        subjectId, subjectName: subjectExams[0].subject.name,
        total: Math.round(total), percentage: Math.round(total), grade, remark,
        scoresByType,
      });
    }

    subjectResults.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    const attendance = reportCard.attendanceSummary ? JSON.parse(reportCard.attendanceSummary) : null;

    const totalStudents = await db.student.count({
      where: { classId: reportCard.classId, schoolId: reportCard.schoolId, deletedAt: null, isActive: true },
    });

    return NextResponse.json({
      data: { ...reportCard, student: reportCard.student ? { ...reportCard.student, name: reportCard.student.user?.name, user: undefined } : null }, subjectResults, attendance, domainGrade,
      totalStudents, school, settings,
    });
  } catch (error) {
    console.error('GET /api/report-cards/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const existing = await db.reportCard.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Record<string, any> = {};
    if (body.teacherComment !== undefined) updateData.teacherComment = body.teacherComment;
    if (body.principalComment !== undefined) updateData.principalComment = body.principalComment;
    if (body.behaviorRating !== undefined) updateData.behaviorRating = body.behaviorRating;
    if (body.attendanceSummary !== undefined) updateData.attendanceSummary = body.attendanceSummary;
    if (body.approvalStatus !== undefined) updateData.approvalStatus = body.approvalStatus;
    if (body.isPublished !== undefined) {
      updateData.isPublished = body.isPublished;
      if (body.isPublished) updateData.publishedAt = new Date();
    }

    const reportCard = await db.reportCard.update({ where: { id }, data: updateData });
    return NextResponse.json({ data: reportCard });
  } catch (error) {
    console.error('PUT /api/report-cards/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.reportCard.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.reportCard.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/report-cards/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
