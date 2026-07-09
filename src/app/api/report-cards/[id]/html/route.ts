import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { renderReportCardHTML } from '@/lib/report-card-utils/render-card-html';
import { DEFAULT_THRESHOLDS, calculateSubjectGrade } from '@/lib/grade-calculator';
import { resolveImageBuffer, getReportCardData } from '@/lib/report-card-pdf-data';
import type { SubjectResult, DomainData, Orientation } from '@/lib/report-card-utils/types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const orientation = (searchParams.get('orientation') || 'portrait') as Orientation;

    const reportData = await getReportCardData(id);
    if (!reportData || !reportData.reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const reportCard = reportData.reportCard;
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const school = reportData.school;
    const settings = reportData.settings;
    const logoBase64 = school?.logo ? (await resolveImageBuffer(school.logo, 'logo', request)) : null;
    const studentPhotoUrl = (reportCard.student as any)?.user?.avatar || (reportCard.student as any)?.photo;
    const studentPhoto = studentPhotoUrl ? await resolveImageBuffer(studentPhotoUrl, 'photo', request) : null;

    const subjectResults: SubjectResult[] = reportData.subjectResults || [];
    const attendance = reportData.attendance || null;
    const radarData = subjectResults.map(s => ({ subject: s.subjectName, score: Math.round(s.percentage) }));
    const trendData: { term: string; average: number }[] = [];
    try {
      const prevReportCards = await db.reportCard.findMany({
        where: { studentId: reportCard.studentId, schoolId: reportCard.schoolId, id: { not: reportCard.id } },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { averageScore: true, term: { select: { name: true, order: true } } },
      });
      prevReportCards.forEach(rc => {
        if (rc.averageScore != null) {
          trendData.push({ term: rc.term.name.replace(/^Term\s*/i, 'T'), average: Math.round(rc.averageScore) });
        }
      });
      if (reportCard.averageScore != null) {
        trendData.push({ term: (reportCard.term as any)?.name?.replace(/^Term\s*/i, 'T') || 'Now', average: Math.round(reportCard.averageScore) });
      }
    } catch { /* trend data optional */ }
    const behaviorData = [
      { label: 'Conduct', rating: Math.min(5, Math.max(1, Math.round(((reportCard.student as any)?.behaviorScore ?? 100) / 20))) },
      { label: 'Attentiveness', rating: 4 },
      { label: 'Homework', rating: 4 },
      { label: 'Participation', rating: 3 },
    ];
    const studentHouse = (reportCard.student as any)?.house || null;

    const domainGrade = await db.domainGrade.findUnique({
      where: { schoolId_studentId_termId: { schoolId: reportCard.schoolId, studentId: reportCard.studentId, termId: reportCard.termId } },
    });
    const domain: DomainData = {
      cognitive: domainGrade ? {
        reasoning: domainGrade.cognitiveReasoning, memory: domainGrade.cognitiveMemory,
        concentration: domainGrade.cognitiveConcentration, problemSolving: domainGrade.cognitiveProblemSolving,
        initiative: domainGrade.cognitiveInitiative, average: domainGrade.cognitiveAverage,
      } : {},
      psychomotor: domainGrade ? {
        handwriting: domainGrade.psychomotorHandwriting, sports: domainGrade.psychomotorSports,
        drawing: domainGrade.psychomotorDrawing, practical: domainGrade.psychomotorPractical,
        average: domainGrade.psychomotorAverage,
      } : {},
      affective: domainGrade ? {
        punctuality: domainGrade.affectivePunctuality, neatness: domainGrade.affectiveNeatness,
        honesty: domainGrade.affectiveHonesty, leadership: domainGrade.affectiveLeadership,
        cooperation: domainGrade.affectiveCooperation, attentiveness: domainGrade.affectiveAttentiveness,
        obedience: domainGrade.affectiveObedience, selfControl: domainGrade.affectiveSelfControl,
        politeness: domainGrade.affectivePoliteness, average: domainGrade.affectiveAverage,
      } : {},
      classTeacherComment: domainGrade?.classTeacherComment,
      classTeacherName: domainGrade?.classTeacherName,
      principalComment: domainGrade?.principalComment,
      principalName: domainGrade?.principalName,
    };

    const scoreTypes = reportData.scoreTypes || [];

    const avgScore = reportCard.averageScore || 0;
    const overallGrade = reportCard.grade || 'F';
    const overallRemark = calculateSubjectGrade(avgScore, 100, DEFAULT_THRESHOLDS).remark;

    const html = await renderReportCardHTML({
      student: {
        name: (reportCard.student as any)?.user?.name || 'Student',
        admissionNo: (reportCard.student as any)?.admissionNo || 'N/A',
        gender: (reportCard.student as any)?.gender || null,
        dateOfBirth: (reportCard.student as any)?.dateOfBirth ? new Date((reportCard.student as any).dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
        bloodGroup: (reportCard.student as any)?.bloodGroup || null,
        photoBase64: studentPhoto ? `data:${studentPhoto.contentType};base64,${studentPhoto.buffer.toString('base64')}` : null,
      },
      school: {
        name: school?.name || 'School',
        logoBase64: logoBase64 ? `data:${logoBase64.contentType};base64,${logoBase64.buffer.toString('base64')}` : null,
        address: school?.address || null,
        motto: school?.motto || null,
        phone: school?.phone || null,
        email: school?.email || null,
        primaryColor: school?.primaryColor || '#059669',
      },
      settings: {
        principalName: settings?.principalName || null,
        nextTermBegins: settings?.nextTermBegins || null,
        academicSession: settings?.academicSession || (reportCard.term as any)?.academicYear?.name || null,
      },
      term: { name: (reportCard.term as any)?.name || 'Term', order: (reportCard.term as any)?.order || 1 },
      cls: { name: (reportCard.student as any)?.class?.name || 'Class', section: (reportCard.student as any)?.class?.section || null },
      subjectResults,
      attendance: attendance || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
      domainGrade: domain,
      totals: {
        grandTotal: reportCard.totalScore || 0,
        averageScore: avgScore,
        totalStudents: 1,
        classRank: reportCard.classRank ?? undefined,
        overallGrade,
        overallRemark,
      },
      teacherComment: reportCard.teacherComment,
      principalComment: reportCard.principalComment,
      showChart: true,
      showDomains: true,
      showAttendance: true,
      radarData,
      trendData,
      behaviorData,
      house: studentHouse,
      scoreTypes,
    }, { orientation });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('GET /api/report-cards/[id]/html error:', error);
    return NextResponse.json({ error: 'HTML generation failed' }, { status: 500 });
  }
}
