import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/audit-logger';

// GET /api/report-cards/[id] - Fetch single report card with full data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const reportCard = await db.reportCard.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true, avatar: true } },
            class: { select: { id: true, name: true, section: true, grade: true } },
          },
        },
        term: {
          include: { academicYear: { select: { name: true, id: true } } },
        },
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Report card not found' }, { status: 404 });
    }

    const school = await db.school.findUnique({
      where: { id: reportCard.schoolId },
    });

    const settings = await db.schoolSettings.findUnique({
      where: { schoolId: reportCard.schoolId },
    });

    // Parse attendance summary
    let attendance = { totalDays: 0, presentDays: 0, absentDays: 0, percentage: 0 };
    try {
      if (reportCard.attendanceSummary) {
        attendance = JSON.parse(reportCard.attendanceSummary);
      }
    } catch {
      // Use defaults
    }

    // Role-based access check
    const isStaff = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'DIRECTOR'].includes(auth.role || '');
    const isOwnStudent = auth.role === 'STUDENT' && reportCard.student.userId === auth.userId;
    const isOwnChild = auth.role === 'PARENT' && reportCard.student.parentIds.includes(auth.userId || '');

    if (!isStaff && !isOwnStudent && !isOwnChild) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // School context validation
    if (auth.schoolId && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if 3rd term
    const isThirdTerm = reportCard.term.name.toLowerCase().includes('3') || reportCard.term.order === 3;

    // Fetch domain grades for 3rd term
    let domainGrade: { cognitive: Record<string, string | null>; psychomotor: Record<string, string | null>; affective: Record<string, string | null>; classTeacherComment?: string | null; classTeacherName?: string | null; principalComment?: string | null; principalName?: string | null } | null = null;
    if (isThirdTerm) {
      const dg = await db.domainGrade.findUnique({
        where: {
          schoolId_studentId_termId: {
            schoolId: reportCard.schoolId,
            studentId: reportCard.studentId,
            termId: reportCard.termId,
          },
        },
      });

      if (dg) {
        domainGrade = {
          cognitive: {
            reasoning: dg.cognitiveReasoning,
            memory: dg.cognitiveMemory,
            concentration: dg.cognitiveConcentration,
            problemSolving: dg.cognitiveProblemSolving,
            initiative: dg.cognitiveInitiative,
            average: dg.cognitiveAverage,
          },
          psychomotor: {
            handwriting: dg.psychomotorHandwriting,
            sports: dg.psychomotorSports,
            drawing: dg.psychomotorDrawing,
            practical: dg.psychomotorPractical,
            average: dg.psychomotorAverage,
          },
          affective: {
            punctuality: dg.affectivePunctuality,
            neatness: dg.affectiveNeatness,
            honesty: dg.affectiveHonesty,
            leadership: dg.affectiveLeadership,
            cooperation: dg.affectiveCooperation,
            attentiveness: dg.affectiveAttentiveness,
            obedience: dg.affectiveObedience,
            selfControl: dg.affectiveSelfControl,
            politeness: dg.affectivePoliteness,
            average: dg.affectiveAverage,
          },
          classTeacherComment: dg.classTeacherComment,
          classTeacherName: dg.classTeacherName,
          principalComment: dg.principalComment,
          principalName: dg.principalName,
        };
      }
    }

    // Fetch exam scores for the student
    const exams = await db.exam.findMany({
      where: {
        schoolId: reportCard.schoolId,
        termId: reportCard.termId,
        classId: reportCard.classId,
        deletedAt: null,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true, position: true } },
        scores: {
          where: { studentId: reportCard.studentId },
          include: {
            scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true, position: true } },
          },
        },
      },
    });

    // Group exams by subject
    const examsBySubject = new Map<string, typeof exams>();
    for (const exam of exams) {
      const key = exam.subjectId;
      if (!examsBySubject.has(key)) {
        examsBySubject.set(key, []);
      }
      examsBySubject.get(key)!.push(exam);
    }

    const subjectResults = Array.from(examsBySubject.entries())
      .map(([subjectId, subjectExams]) => {
        let caTotal = 0;
        let caMax = 0;
        let examTotal = 0;
        let examMax = 0;

        for (const exam of subjectExams) {
          if (exam.scoreType && !exam.scoreType.isInReport) continue;

          const examType = exam.scoreType?.type || exam.type;
          const maxMarks = exam.totalMarks || 100;

          const studentScore = exam.scores[0];
          const score = studentScore ? studentScore.score : 0;

          if (examType === 'midterm' || examType === 'ca') {
            caTotal += score;
            caMax += maxMarks;
          } else if (examType === 'exam' || examType === 'final') {
            examTotal += score;
            examMax += maxMarks;
          }
        }

        let caScore = caMax > 0 ? (caTotal / caMax) * 40 : 0;
        let examScore = examMax > 0 ? (examTotal / examMax) * 60 : 0;
        let total = caScore + examScore;

        if (caMax > 0 && caMax <= 40 && examMax > 0 && examMax <= 60) {
          caScore = caTotal;
          examScore = examTotal;
          total = caScore + examScore;
        }

        const { grade, remark } = (() => {
          const pct = total;
          if (pct >= 70) return { grade: 'A', remark: 'Excellent' };
          if (pct >= 60) return { grade: 'B', remark: 'Very Good' };
          if (pct >= 50) return { grade: 'C', remark: 'Good' };
          if (pct >= 40) return { grade: 'D', remark: 'Fair' };
          if (pct >= 30) return { grade: 'E', remark: 'Poor' };
          return { grade: 'F', remark: 'Fail' };
        })();

        return {
          subjectId,
          subjectName: subjectExams[0].subject.name,
          subjectCode: subjectExams[0].subject.code,
          caScore: Math.round(caScore * 100) / 100,
          examScore: Math.round(examScore * 100) / 100,
          totalScore: Math.round(total * 100) / 100,
          maxPossible: 100,
          grade,
          remark,
        };
      })
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    // Get total students in class for rank context
    const totalStudents = await db.student.count({
      where: { classId: reportCard.classId, schoolId: reportCard.schoolId, deletedAt: null, isActive: true },
    });

    return NextResponse.json({
      data: {
        ...reportCard,
        subjectResults,
        attendance,
        domainGrade,
        isThirdTerm,
        totalStudents,
        school: school ? {
          id: school.id,
          name: school.name,
          logo: school.logo,
          address: school.address,
          motto: school.motto,
          phone: school.phone,
          email: school.email,
          website: school.website,
          primaryColor: school.primaryColor,
          secondaryColor: school.secondaryColor,
        } : null,
        settings: settings ? {
          scoreSystem: settings.scoreSystem,
          fontFamily: settings.fontFamily,
          schoolMotto: settings.schoolMotto,
          schoolVision: settings.schoolVision,
          schoolMission: settings.schoolMission,
          principalName: settings.principalName,
          vicePrincipalName: settings.vicePrincipalName,
          nextTermBegins: settings.nextTermBegins,
          academicSession: settings.academicSession,
        } : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/report-cards/[id] - Update report card
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'DIRECTOR']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const reportCard = await db.reportCard.findUnique({ where: { id } });
    if (!reportCard) {
      return NextResponse.json({ error: 'Report card not found' }, { status: 404 });
    }

    const { teacherComment, principalComment, isPublished, attendanceSummary } = body;

    const updated = await db.reportCard.update({
      where: { id },
      data: {
        ...(teacherComment !== undefined && { teacherComment }),
        ...(principalComment !== undefined && { principalComment }),
        ...(isPublished !== undefined && {
          isPublished,
          publishedAt: isPublished ? new Date() : null,
        }),
        ...(attendanceSummary !== undefined && { attendanceSummary: JSON.stringify(attendanceSummary) }),
      },
    });

    // Log the successful update
    createAuditLogEntry({
      schoolId: auth.schoolId || reportCard.schoolId,
      userId: auth.userId,
      action: 'REPORT_CARD_UPDATE',
      entity: 'REPORT_CARD',
      entityId: id,
      details: JSON.stringify(body),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      data: updated,
      message: 'Report card updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/report-cards/[id] - Soft delete report card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.reportCard.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Report card not found' }, { status: 404 });
    }

    // School context validation
    if (auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Report card already deleted' }, { status: 410 });
    }

    // Perform soft delete
    await db.reportCard.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Log the successful deletion
    createAuditLogEntry({
      schoolId: auth.schoolId || existing.schoolId,
      userId: auth.userId,
      action: 'REPORT_CARD_DELETE',
      entity: 'REPORT_CARD',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ message: 'Report card deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
