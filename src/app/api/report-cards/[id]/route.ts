import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateSubjectResults, calculateOverallGrade } from '@/lib/calculate-report-card';

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

    const scoreTypeInfos = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, type: st.type, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));

    const { subjectResults, grandTotal } = calculateSubjectResults({ exams, scoreTypes: scoreTypeInfos });
    const { averageScore, overallGrade, overallRemark } = calculateOverallGrade(subjectResults, grandTotal);

    const attendance = reportCard.attendanceSummary ? JSON.parse(reportCard.attendanceSummary) : null;

    const totalStudents = await db.student.count({
      where: { classId: reportCard.classId, schoolId: reportCard.schoolId, deletedAt: null, isActive: true },
    });

    return NextResponse.json({
      data: { ...reportCard, student: reportCard.student ? { ...reportCard.student, name: reportCard.student.user?.name, user: undefined } : null },
      subjectResults, grandTotal: Math.round(grandTotal), averageScore, overallGrade, overallRemark,
      attendance, domainGrade,
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
