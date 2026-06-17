import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { resolveImageBuffer } from '@/lib/report-card-pdf-data';
import { renderReportCardSVG, renderReportCardPng } from '@/lib/report-card-utils/render-card-server';
import { DEFAULT_THRESHOLDS } from '@/lib/grade-calculator';
import type { DomainData, SubjectResult } from '@/lib/report-card-utils/render-card-server';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolName, schoolLogo, schoolMotto, schoolAddress, schoolPhone, schoolEmail, schoolWebsite, schoolColor, studentName, admissionNo, gender, dateOfBirth, bloodGroup, studentPhoto, termName, termOrder, className, section, subjectResults, attendanceData, domainData, teacherComment, principalComment, principalName, averageScore, overallGrade, overallRemark, totalStudents, classRank, session, nextTermBegins, watermarkText, showChart = true, showDomains = true, showAttendance = true, showLegend = true } = body;

    const schoolColorHex = schoolColor || '#059669';
    const logoBase64 = schoolLogo ? await resolveImageBuffer(schoolLogo, 'logo', request) : null;

    const subjects: SubjectResult[] = (subjectResults || []).map((s: any) => ({
      subjectId: s.subjectId || '',
      subjectName: s.subjectName || 'Subject',
      caScore: s.caScore || 0,
      examScore: s.examScore || 0,
      total: s.total || 0,
      percentage: s.percentage || 0,
      grade: s.grade || 'F',
      remark: s.remark || 'Fail',
      scoresByType: s.scoresByType || undefined,
    }));

    const domain: DomainData = domainData || { cognitive: {}, psychomotor: {}, affective: {} };

    const svg = await renderReportCardSVG({
      student: { name: studentName || 'Student', admissionNo: admissionNo || 'N/A', gender, dateOfBirth, bloodGroup, photoBase64: studentPhoto ? (await resolveImageBuffer(studentPhoto, 'photo', request))?.buffer?.toString('base64') : null },
      school: { name: schoolName || 'School', logoBase64: logoBase64?.buffer?.toString('base64'), address: schoolAddress, motto: schoolMotto, phone: schoolPhone, email: schoolEmail, website: schoolWebsite, primaryColor: schoolColorHex },
      settings: { principalName, nextTermBegins, academicSession: session },
      term: { name: termName || 'First', order: termOrder || 1 },
      cls: { name: className || 'Class', section },
      subjectResults: subjects,
      attendance: attendanceData || { daysPresent: 0, daysAbsent: 0, percentage: 0, totalDays: 0 },
      domainGrade: domain,
      gradeScale: DEFAULT_THRESHOLDS,
      totals: { grandTotal: subjects.reduce((s, r) => s + r.total, 0), averageScore: averageScore || 0, totalStudents: totalStudents || 1, classRank, overallGrade: overallGrade || 'F', overallRemark: overallRemark || 'Fail' },
      teacherComment, principalComment,
      watermarkText, showChart, showDomains, showAttendance, showLegend,
    });

    const pngBuffer = await renderReportCardPng(svg);
    return new NextResponse(new Uint8Array(pngBuffer), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' } });
  } catch (error) {
    console.error('POST /api/report-cards/preview error:', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
