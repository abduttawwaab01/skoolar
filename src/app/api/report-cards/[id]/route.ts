import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const reportCard = await db.reportCard.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, admissionNo: true, gender: true, dateOfBirth: true, bloodGroup: true, photo: true } },
        term: { include: { academicYear: { select: { id: true, name: true } } } },
        design: { select: { id: true, name: true, primaryColor: true, fontFamily: true } },
        approvals: { orderBy: { createdAt: 'desc' } },
        comments: { include: { teacherId: true } },
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

    const exams = await db.exam.findMany({
      where: { schoolId: reportCard.schoolId, termId: reportCard.termId, classId: reportCard.classId },
      include: { scores: { where: { studentId: reportCard.studentId } }, subject: { select: { id: true, name: true } }, scoreType: true },
    });

    const scoreTypes = await db.scoreType.findMany({ where: { schoolId: reportCard.schoolId, isActive: true }, orderBy: { position: 'asc' } });
    const totalWeight = scoreTypes.reduce((s, st) => s + st.weight, 0);

    const subjectResults: any[] = [];
    const subjectMap = new Map<string, any>();

    for (const exam of exams) {
      const key = exam.subjectId;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { subjectId: key, subjectName: exam.subject.name, caScore: 0, examScore: 0, total: 0, scoresByType: {} });
      }
      const rec = subjectMap.get(key)!;
      const score = exam.scores[0];
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

    let grandTotal = 0;
    for (const [, rec] of subjectMap) {
      rec.total = rec.caScore + rec.examScore;
      grandTotal += rec.total;
      subjectResults.push(rec);
    }

    const attendance = reportCard.attendanceSummary ? JSON.parse(reportCard.attendanceSummary) : null;

    const totalStudents = await db.reportCard.count({ where: { schoolId: reportCard.schoolId, termId: reportCard.termId, classId: reportCard.classId } });

    return NextResponse.json({
      data: reportCard, subjectResults, attendance, domainGrade,
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
