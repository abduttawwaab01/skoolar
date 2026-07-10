import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { calculateSubjectGrade, DEFAULT_THRESHOLDS } from '@/lib/grade-calculator';
import { calculateAttendance } from '@/lib/calculate-report-card';
import { validateParentChild } from '@/lib/api-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const reportCard = await db.reportCard.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true, admissionNo: true, gender: true, dateOfBirth: true, bloodGroup: true, photo: true, behaviorScore: true,
            user: { select: { name: true, avatar: true } },
            class: { select: { id: true, name: true, section: true, grade: true } },
          },
        },
        term: { select: { id: true, name: true, order: true, startDate: true, endDate: true, academicYear: { select: { name: true } } } },
      },
    });

    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (auth.role === 'STUDENT') {
      const studentRecord = await db.student.findFirst({ where: { userId: auth.userId, schoolId: auth.schoolId } });
      if (!studentRecord || studentRecord.id !== reportCard.studentId) {
        return NextResponse.json({ error: 'You can only view your own report cards' }, { status: 403 });
      }
    }

    if (auth.role === 'PARENT') {
      const hasAccess = await validateParentChild(auth.userId, reportCard.studentId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this report card' }, { status: 403 });
      }
    }

    if (!reportCard.isPublished && auth.role !== 'SUPER_ADMIN' && auth.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Report card not yet published' }, { status: 403 });
    }

    const subjectResults = reportCard.subjectResults ? JSON.parse(reportCard.subjectResults as string) : [];

    let attendanceSummary = null;
    if (reportCard.attendanceSummary) {
      attendanceSummary = JSON.parse(reportCard.attendanceSummary as string);
    } else {
      const attendances = await db.attendance.findMany({
        where: {
          schoolId: reportCard.schoolId,
          studentId: reportCard.studentId,
          date: { gte: reportCard.term.startDate, lte: reportCard.term.endDate },
        },
      });
      attendanceSummary = calculateAttendance(attendances);
    }

    const domainGrade = await db.domainGrade.findUnique({
      where: { schoolId_studentId_termId: { schoolId: reportCard.schoolId, studentId: reportCard.studentId, termId: reportCard.termId } },
    });

    const grandTotal = subjectResults.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
    const avgScore = reportCard.averageScore || 0;
    const overallGrade = reportCard.grade || 'F';
    const overallRemark = calculateSubjectGrade(avgScore, 100, DEFAULT_THRESHOLDS).remark;

    const totalStudents = await db.reportCard.count({
      where: { schoolId: reportCard.schoolId, termId: reportCard.termId, classId: reportCard.classId, deletedAt: null },
    });

    const data = {
      id: reportCard.id,
      schoolId: reportCard.schoolId,
      studentId: reportCard.studentId,
      termId: reportCard.termId,
      classId: reportCard.classId,
      totalScore: reportCard.totalScore || grandTotal,
      averageScore: avgScore,
      grade: overallGrade,
      classRank: reportCard.classRank,
      totalStudents,
      teacherComment: reportCard.teacherComment,
      principalComment: reportCard.principalComment,
      attendanceSummary: JSON.stringify(attendanceSummary),
      isPublished: reportCard.isPublished,
      publishedAt: reportCard.publishedAt?.toISOString(),
      createdAt: reportCard.createdAt.toISOString(),
      student: {
        id: reportCard.student.id,
        name: reportCard.student.user.name,
        admissionNo: reportCard.student.admissionNo,
        gender: reportCard.student.gender,
        dateOfBirth: reportCard.student.dateOfBirth?.toISOString(),
        bloodGroup: reportCard.student.bloodGroup,
        photo: reportCard.student.photo || reportCard.student.user.avatar,
      },
      subjectResults,
      numSubjects: subjectResults.length,
      grandTotal: subjectResults.reduce((sum: number, s: any) => sum + (s.total || 0), 0),
      grandPossible: subjectResults.length * 100,
      overallGrade: { grade: overallGrade, remark: overallRemark },
      attendance: {
        totalDays: attendanceSummary?.totalDays || 0,
        presentDays: attendanceSummary?.daysPresent || 0,
        absentDays: attendanceSummary?.daysAbsent || 0,
        percentage: attendanceSummary?.percentage || 0,
      },
      domainGrade: domainGrade ? {
        id: domainGrade.id,
        cognitive: {
          reasoning: domainGrade.cognitiveReasoning, memory: domainGrade.cognitiveMemory,
          concentration: domainGrade.cognitiveConcentration, problemSolving: domainGrade.cognitiveProblemSolving,
          initiative: domainGrade.cognitiveInitiative, average: domainGrade.cognitiveAverage,
        },
        psychomotor: {
          handwriting: domainGrade.psychomotorHandwriting, sports: domainGrade.psychomotorSports,
          drawing: domainGrade.psychomotorDrawing, practical: domainGrade.psychomotorPractical,
          average: domainGrade.psychomotorAverage,
        },
        affective: {
          punctuality: domainGrade.affectivePunctuality, neatness: domainGrade.affectiveNeatness,
          honesty: domainGrade.affectiveHonesty, leadership: domainGrade.affectiveLeadership,
          cooperation: domainGrade.affectiveCooperation, attentiveness: domainGrade.affectiveAttentiveness,
          obedience: domainGrade.affectiveObedience, selfControl: domainGrade.affectiveSelfControl,
          politeness: domainGrade.affectivePoliteness, average: domainGrade.affectiveAverage,
        },
        classTeacherComment: domainGrade.classTeacherComment,
        classTeacherName: domainGrade.classTeacherName,
        principalComment: domainGrade.principalComment,
        principalName: domainGrade.principalName,
      } : null,
    };

    const school = await db.school.findUnique({ where: { id: reportCard.schoolId } });
    const settings = await db.schoolSettings.findFirst({ where: { schoolId: reportCard.schoolId } });
    const classRecord = await db.class.findUnique({ where: { id: reportCard.classId } });

    const meta = {
      school: {
        id: school?.id || '',
        name: school?.name || 'School',
        logo: school?.logo,
        address: school?.address,
        motto: school?.motto,
        phone: school?.phone,
        email: school?.email,
        website: school?.website,
        primaryColor: school?.primaryColor || '#059669',
        secondaryColor: school?.secondaryColor || '#14b8a6',
      },
      settings: settings ? {
        scoreSystem: settings.scoreSystem,
        fontFamily: settings.fontFamily,
        schoolMotto: settings.schoolMotto || school?.motto,
        schoolVision: settings.schoolVision,
        schoolMission: settings.schoolMission,
        principalName: settings.principalName,
        vicePrincipalName: settings.vicePrincipalName,
        nextTermBegins: settings.nextTermBegins,
        academicSession: settings.academicSession,
      } : null,
      term: {
        id: reportCard.term.id,
        name: reportCard.term.name,
        order: reportCard.term.order,
        startDate: reportCard.term.startDate.toISOString(),
        endDate: reportCard.term.endDate.toISOString(),
        academicYear: reportCard.term.academicYear?.name || '',
      },
      class: {
        id: classRecord?.id || reportCard.classId,
        name: classRecord?.name || 'Class',
        section: classRecord?.section,
        grade: classRecord?.grade,
        classTeacher: classRecord?.classTeacher,
      },
      totalStudents,
      generatedAt: reportCard.createdAt.toISOString(),
    };

    return NextResponse.json({ data, meta });
  } catch (error) {
    console.error('GET /api/report-cards/[id]/view error:', error);
    return NextResponse.json({ error: 'Failed to load report card' }, { status: 500 });
  }
}
