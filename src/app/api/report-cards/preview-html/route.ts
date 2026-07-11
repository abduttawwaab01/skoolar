import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateSubjectResults, calculateAttendance, calculateOverallGrade } from '@/lib/calculate-report-card';
import { renderReportCardHTML } from '@/lib/report-card-utils/render-card-html';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import type { ReportCardData, ScoreTypeInfo } from '@/lib/report-card-utils/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, termId, schoolId } = body;
    if (!studentId || !termId || !schoolId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [school, term, student, scoreTypeRecords] = await Promise.all([
      db.school.findUnique({ where: { id: schoolId } }),
      db.term.findUnique({ where: { id: termId }, include: { academicYear: { select: { name: true } } } }),
      db.student.findUnique({ where: { id: studentId }, include: { class: true, user: { select: { name: true } } } }),
      db.scoreType.findMany({ where: { schoolId, isInReport: true, isActive: true }, orderBy: { position: 'asc' } }),
    ]);

    if (!school || !term || !student) {
      return NextResponse.json({ error: 'School, term or student not found' }, { status: 404 });
    }

    const scoreTypes: ScoreTypeInfo[] = scoreTypeRecords.map(st => ({
      id: st.id, name: st.name, type: st.type, maxMarks: st.maxMarks, weight: st.weight, position: st.position,
    }));

    if (!student.classId) {
      return NextResponse.json({ error: 'Student has no assigned class' }, { status: 400 });
    }

    const classId: string = student.classId;
    const cls = student.class;
    const settings = await db.schoolSettings.findUnique({ where: { schoolId } });

    const exams = await db.exam.findMany({
      where: { schoolId, termId, classId, deletedAt: null },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } },
        scores: { where: { studentId }, include: { scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } } } },
      },
    });

    const allStudents = await db.student.findMany({ where: { schoolId, classId, deletedAt: null, isActive: true }, select: { id: true } });

    const attendanceRecords = await db.attendance.findMany({ where: { schoolId, termId, studentId }, select: { status: true } });
    const attendance = calculateAttendance(attendanceRecords);

    const domainGrade = await db.domainGrade.findUnique({ where: { schoolId_studentId_termId: { schoolId, studentId, termId } } });

    const { subjectResults, grandTotal } = calculateSubjectResults({ exams, scoreTypes, studentId });
    const { averageScore, overallGrade, overallRemark } = calculateOverallGrade(subjectResults, grandTotal);

    const photoUrl = (student.user as any)?.avatar;
    const photoBase64 = photoUrl ? await resolveImageBuffer(photoUrl, 'photo', request) : null;
    const logoBase64 = school?.logo ? await resolveImageBuffer(school.logo, 'logo', request) : null;

    const reportCardInput: ReportCardData = {
      student: {
        name: student.user?.name || 'Student',
        admissionNo: student.admissionNo || 'N/A',
        photoBase64: photoBase64 ? `data:${photoBase64.contentType};base64,${photoBase64.buffer.toString('base64')}` : null,
      },
      school: {
        name: school.name || 'School',
        logoBase64: logoBase64 ? `data:${logoBase64.contentType};base64,${logoBase64.buffer.toString('base64')}` : null,
        address: school.address,
        motto: school.motto,
        phone: school.phone,
        email: school.email,
        primaryColor: school.primaryColor || '#059669',
      },
      settings: {
        principalName: settings?.principalName,
        nextTermBegins: settings?.nextTermBegins,
        academicSession: term.academicYear?.name || settings?.academicSession,
      },
      term: { name: term.name, order: term.order || 1 },
      cls: { name: cls?.name || 'Class', section: cls?.section },
      subjectResults,
      attendance: { daysPresent: attendance.daysPresent, daysAbsent: attendance.daysAbsent, percentage: attendance.percentage, totalDays: attendance.totalDays },
      domainGrade: {
        cognitive: domainGrade ? { reasoning: domainGrade.cognitiveReasoning, memory: domainGrade.cognitiveMemory, concentration: domainGrade.cognitiveConcentration, problemSolving: domainGrade.cognitiveProblemSolving, initiative: domainGrade.cognitiveInitiative, average: domainGrade.cognitiveAverage } : {},
        psychomotor: domainGrade ? { handwriting: domainGrade.psychomotorHandwriting, sports: domainGrade.psychomotorSports, drawing: domainGrade.psychomotorDrawing, practical: domainGrade.psychomotorPractical, average: domainGrade.psychomotorAverage } : {},
        affective: domainGrade ? { punctuality: domainGrade.affectivePunctuality, neatness: domainGrade.affectiveNeatness, honesty: domainGrade.affectiveHonesty, leadership: domainGrade.affectiveLeadership, cooperation: domainGrade.affectiveCooperation, attentiveness: domainGrade.affectiveAttentiveness, obedience: domainGrade.affectiveObedience, selfControl: domainGrade.affectiveSelfControl, politeness: domainGrade.affectivePoliteness, average: domainGrade.affectiveAverage } : {},
        classTeacherComment: domainGrade?.classTeacherComment,
        classTeacherName: domainGrade?.classTeacherName,
        principalComment: domainGrade?.principalComment,
        principalName: domainGrade?.principalName,
      },
      totals: {
        grandTotal: Math.round(grandTotal),
        averageScore,
        totalStudents: allStudents.length,
        overallGrade,
        overallRemark,
      },
      teacherComment: domainGrade?.classTeacherComment,
      principalComment: domainGrade?.principalComment,
      showChart: true,
      showDomains: true,
      showAttendance: true,
      scoreTypes,
      radarData: subjectResults.map(r => ({ subject: r.subjectName, score: Math.round(r.percentage || r.total || 0) })),
      chartColumns: 2,
      domainColumns: 3,
    };

    const html = await renderReportCardHTML(reportCardInput);
    return NextResponse.json({ html });
  } catch (error) {
    console.error('POST /api/report-cards/preview-html error:', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
