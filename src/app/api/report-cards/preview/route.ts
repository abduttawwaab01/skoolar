import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import { renderReportCardHTML } from '@/lib/report-card-utils/render-card-html';
import { db } from '@/lib/db';
import { calculateSubjectResults, calculateAttendance, calculateOverallGrade } from '@/lib/calculate-report-card';
import type { DomainData, Orientation } from '@/lib/report-card-utils/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { studentId, termId, classId, schoolId: bodySchoolId, design: bodyDesign } = body;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId
      ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !studentId || !termId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const orientation = (bodyDesign?.orientation || 'portrait') as Orientation;

    const [school, student, term, settings] = await Promise.all([
      db.school.findUnique({ where: { id: targetSchoolId } }),
      db.student.findUnique({
        where: { id: studentId, schoolId: targetSchoolId },
        include: { user: { select: { name: true, email: true, avatar: true } }, class: { select: { id: true, name: true, section: true } } },
      }),
      db.term.findUnique({ where: { id: termId, schoolId: targetSchoolId }, include: { academicYear: { select: { id: true, name: true } } } }),
      db.schoolSettings.findUnique({ where: { schoolId: targetSchoolId } }),
    ]);

    if (!school || !student || !term) {
      return NextResponse.json({ error: 'School, student, or term not found' }, { status: 404 });
    }

    let domain: DomainData = { cognitive: {}, psychomotor: {}, affective: {} };
    try {
      const dg = await db.domainGrade.findUnique({ where: { schoolId_studentId_termId: { schoolId: targetSchoolId, studentId, termId } } });
      if (dg) {
        domain = {
          cognitive: { reasoning: dg.cognitiveReasoning, memory: dg.cognitiveMemory, concentration: dg.cognitiveConcentration, problemSolving: dg.cognitiveProblemSolving, initiative: dg.cognitiveInitiative, average: dg.cognitiveAverage },
          psychomotor: { handwriting: dg.psychomotorHandwriting, sports: dg.psychomotorSports, drawing: dg.psychomotorDrawing, practical: dg.psychomotorPractical, average: dg.psychomotorAverage },
          affective: { punctuality: dg.affectivePunctuality, neatness: dg.affectiveNeatness, honesty: dg.affectiveHonesty, leadership: dg.affectiveLeadership, cooperation: dg.affectiveCooperation, attentiveness: dg.affectiveAttentiveness, obedience: dg.affectiveObedience, selfControl: dg.affectiveSelfControl, politeness: dg.affectivePoliteness, average: dg.affectiveAverage },
          classTeacherComment: dg.classTeacherComment, classTeacherName: dg.classTeacherName,
          principalComment: dg.principalComment, principalName: dg.principalName,
        };
      }
    } catch { /* domain grades not available */ }

    const [exams, scoreTypeRecords] = await Promise.all([
      db.exam.findMany({
        where: { schoolId: targetSchoolId, termId, classId, deletedAt: null },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } },
          scores: { where: { studentId }, include: { scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } } } },
        },
      }),
      db.scoreType.findMany({ where: { schoolId: targetSchoolId, isInReport: true, isActive: true }, orderBy: { position: 'asc' } }),
    ]);

    const scoreTypes = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, type: st.type, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));

    const { subjectResults, grandTotal } = calculateSubjectResults({
      exams,
      scoreTypes,
    });

    const attRecords = await db.attendance.findMany({ where: { schoolId: targetSchoolId, studentId, termId }, select: { status: true } });
    const attendance = calculateAttendance(attRecords);

    const totalStudents = await db.student.count({ where: { classId, schoolId: targetSchoolId, deletedAt: null, isActive: true } });
    const { averageScore, overallGrade, overallRemark } = calculateOverallGrade(subjectResults, grandTotal);
    const overall = { grade: overallGrade, remark: overallRemark };

    const logoBase64 = school?.logo ? await resolveImageBuffer(school.logo, 'logo', request) : null;
    const studentPhotoUrl = student.user?.avatar || student.photo;
    const studentPhoto = studentPhotoUrl ? await resolveImageBuffer(studentPhotoUrl, 'photo', request) : null;

    const photoDataUri = studentPhoto ? `data:${studentPhoto.contentType};base64,${studentPhoto.buffer.toString('base64')}` : null;
    const logoDataUri = logoBase64 ? `data:${logoBase64.contentType};base64,${logoBase64.buffer.toString('base64')}` : null;

    const html = await renderReportCardHTML({
      student: {
        name: student.user?.name || 'Student',
        admissionNo: student.admissionNo || 'N/A',
        gender: student.gender || null,
        dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
        bloodGroup: student.bloodGroup || null,
        photoBase64: photoDataUri,
      },
      school: {
        name: school.name || 'School',
        logoBase64: logoDataUri, address: school.address || null,
        motto: school.motto || settings?.schoolMotto || null,
        phone: school.phone || null, email: school.email || null,
        website: school.website || null, primaryColor: school.primaryColor || '#059669',
      },
      settings: { principalName: settings?.principalName || null, nextTermBegins: settings?.nextTermBegins || null, academicSession: term.academicYear?.name || settings?.academicSession || null },
      term: { name: term.name, order: term.order || 1 },
      cls: { name: student.class?.name || 'Class', section: student.class?.section || null },
      subjectResults,
      attendance,
      domainGrade: domain,
      totals: {
        grandTotal: Math.round(grandTotal), averageScore, totalStudents,
        overallGrade: overall.grade, overallRemark: overall.remark,
      },
      teacherComment: domain?.classTeacherComment || null,
      principalComment: domain?.principalComment || null,
      showChart: bodyDesign?.showChart !== false,
      showDomains: bodyDesign?.showDomains !== false,
      showAttendance: bodyDesign?.showAttendance !== false,
      watermarkText: bodyDesign?.showWatermark ? (bodyDesign?.watermarkText || null) : null,
      scoreTypes,
      radarData: subjectResults.map(r => ({ subject: r.subjectName, score: Math.round(r.percentage) })),
      chartColumns: bodyDesign?.chartColumns || 2,
      domainColumns: bodyDesign?.domainColumns || 3,
      behaviorData: bodyDesign?.behaviorData || [],
      trendData: bodyDesign?.trendData || [],
    }, { orientation });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    console.error('POST /api/report-cards/preview error:', error);
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
