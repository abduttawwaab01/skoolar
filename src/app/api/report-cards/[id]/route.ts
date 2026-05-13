import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import { requireAuth } from '@/lib/auth-middleware';

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

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

        const caScore = caMax > 0 ? Math.round(((caTotal / caMax) * 40) * 100) / 100 : 0;
        const examScore = examMax > 0 ? Math.round(((examTotal / examMax) * 60) * 100) / 100 : 0;
        const total = Math.round((caScore + examScore) * 100) / 100;

        const { grade, remark } = calculateGrade(total, 100, REPORT_CARD_SCALE);

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
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const reportCard = await db.reportCard.findUnique({ where: { id } });
    if (!reportCard) {
      return NextResponse.json({ error: 'Report card not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    return NextResponse.json({
      data: updated,
      message: 'Report card updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
