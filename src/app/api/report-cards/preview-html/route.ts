import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import { renderReportCardHTML } from '@/lib/report-card-utils/render-card-html';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import { db } from '@/lib/db';
import type { SubjectResult, DomainData, Orientation } from '@/lib/report-card-utils/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { studentId, termId, classId, schoolId: bodySchoolId, orientation: bodyOrientation } = body;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId
      ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !studentId || !termId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const orientation = (bodyOrientation || 'portrait') as Orientation;

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

    const scoreTypes = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));
    const totalWeight = scoreTypes.reduce((sum, st) => sum + st.weight, 0);
    const examsBySubject = new Map<string, typeof exams>();
    for (const exam of exams) {
      const key = exam.subjectId;
      if (!examsBySubject.has(key)) examsBySubject.set(key, []);
      examsBySubject.get(key)!.push(exam);
    }

    let grandTotal = 0;
    const subjectResults: SubjectResult[] = Array.from(examsBySubject.entries())
      .flatMap(([subjectId, subjectExams]) => {
        let caTotal = 0, caMax = 0, examTotal = 0, examMax = 0;
        const scoresByType: Record<string, { raw: number; max: number; normalized: number }> = {};
        for (const st of scoreTypes) { scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 }; }
        for (const exam of subjectExams) {
          if (exam.scoreType && !exam.scoreType.isInReport) continue;
          const examType = exam.scoreType?.type || exam.type;
          const maxMarks = exam.totalMarks ?? 100;
          const score = exam.scores[0]?.score || 0;
          const stId = exam.scoreTypeId || '';
          if (stId && scoresByType[stId]) { scoresByType[stId].raw += score; scoresByType[stId].max += maxMarks; }
          if (examType === 'midterm' || examType === 'ca') { caTotal += score; caMax += maxMarks; }
          else if (examType === 'exam' || examType === 'final') { examTotal += score; examMax += maxMarks; }
          else if (!stId || !scoresByType[stId]) { caTotal += score; caMax += maxMarks; }
        }
        const hasScoresByType = Object.values(scoresByType).some(s => s.raw > 0);
        const hasAnyScores = hasScoresByType || caTotal > 0 || examTotal > 0;
        if (!hasAnyScores) return [];
        let total = 0;
        if (totalWeight > 0 && hasScoresByType) {
          for (const st of scoreTypes) {
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
        return [{
          subjectId, subjectName: subjectExams[0].subject.name,
          caScore: caTotal,
          examScore: examTotal,
          total: Math.round(total), percentage: Math.round(total), grade, remark, scoresByType,
        } as SubjectResult];
      })
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    const attRecords = await db.attendance.findMany({ where: { schoolId: targetSchoolId, studentId, termId }, select: { status: true } });
    const totalDays = attRecords.length;
    const daysPresent = attRecords.filter(a => a.status === 'present').length;
    const daysAbsent = totalDays - daysPresent;
    const attendance = { totalDays, daysPresent, daysAbsent, percentage: totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0 };

    const totalStudents = await db.student.count({ where: { classId, schoolId: targetSchoolId, deletedAt: null, isActive: true } });
    const averageScore = subjectResults.length > 0 ? Math.round((grandTotal / subjectResults.length) * 100) / 100 : 0;
    const overall = calculateGrade(averageScore, 100, REPORT_CARD_SCALE);

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
      showChart: true, showDomains: true, showAttendance: true,
      scoreTypes,
    }, { orientation });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    console.error('POST /api/report-cards/preview-html error:', error);
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
