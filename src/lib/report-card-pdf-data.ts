import * as https from 'node:https';
import * as http from 'node:http';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import type { SubjectResult, ScoreTypeInfo } from '@/lib/report-card-utils/types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 8000;

export interface ResolvedImage {
  buffer: Buffer;
  contentType: string;
}

export async function resolveImageBuffer(
  url: string | null | undefined,
  kind: 'logo' | 'photo',
  request?: NextRequest
): Promise<ResolvedImage | null> {
  if (!url) return null;
  if (url.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(url);
    if (!match) return null;
    try {
      return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] || 'image/jpeg' };
    } catch (err) {
      console.warn(`report-card-pdf: ${kind} data-uri parse failed:`, err);
      return null;
    }
  }

  const baseUrl = request?.headers.get('origin')
    || process.env.NEXT_PUBLIC_APP_URL
    || `https://${request?.headers.get('host') || 'skoolar.org'}`;
  const fullUrl = url.startsWith('//')
    ? `https:${url}`
    : url.startsWith('http')
      ? url
      : `${baseUrl}${url}`;

  try {
    const mod = fullUrl.startsWith('https') ? https : http;
    const headers: Record<string, string> = { Accept: 'image/*' };
    const cookie = request?.headers.get('cookie');
    if (cookie) headers['Cookie'] = cookie;

    const buf = await new Promise<{ data: Buffer; ct: string }>((resolve, reject) => {
      const req = mod.get(
        fullUrl,
        { timeout: IMAGE_FETCH_TIMEOUT_MS, headers },
        (res) => {
          const ct = res.headers['content-type'] || 'image/jpeg';
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve({ data: Buffer.concat(chunks), ct }));
        }
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });
      req.on('error', reject);
    });
    if (!buf.ct.startsWith('image/')) {
      console.warn(`report-card-pdf: ${kind} invalid content-type ${buf.ct} for ${fullUrl.substring(0, 120)}`);
      return null;
    }
    if (buf.data.length === 0) {
      console.warn(`report-card-pdf: ${kind} empty body for ${fullUrl.substring(0, 120)}`);
      return null;
    }
    if (buf.data.length > MAX_IMAGE_BYTES) {
      console.warn(`report-card-pdf: ${kind} too large (${buf.data.length} bytes) for ${fullUrl.substring(0, 120)}`);
      return null;
    }
    return { buffer: buf.data, contentType: buf.ct };
  } catch (err) {
    console.warn(`report-card-pdf: ${kind} fetch failed for ${fullUrl.substring(0, 120)}:`, err);
    return null;
  }
}

export async function getReportCardData(id: string) {
  const reportCard = await db.reportCard.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          user: { select: { name: true, email: true, avatar: true } },
          class: { select: { id: true, name: true, section: true, grade: true, classTeacher: { select: { user: { select: { name: true } } } } } },
        },
      },
      term: {
        include: { academicYear: { select: { name: true, id: true } } },
      },
    },
  });
  if (!reportCard) return null;

  const [school, settings] = await Promise.all([
    db.school.findUnique({ where: { id: reportCard.schoolId } }),
    db.schoolSettings.findUnique({ where: { schoolId: reportCard.schoolId } }),
  ]);

  let attendance = { totalDays: 0, daysPresent: 0, daysAbsent: 0, percentage: 0 };
  try {
    if (reportCard.attendanceSummary) {
      attendance = JSON.parse(reportCard.attendanceSummary);
    }
  } catch { /* ignore */ }

  const domainGrade = await db.domainGrade.findUnique({
    where: { schoolId_studentId_termId: { schoolId: reportCard.schoolId, studentId: reportCard.studentId, termId: reportCard.termId } },
  });

  const [exams, scoreTypes] = await Promise.all([
    db.exam.findMany({
      where: { schoolId: reportCard.schoolId, termId: reportCard.termId, classId: reportCard.classId, deletedAt: null },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } },
        scores: {
          where: { studentId: reportCard.studentId },
          include: { scoreType: { select: { id: true, name: true, type: true, maxMarks: true, weight: true, isInReport: true } } },
        },
      },
    }),
    db.scoreType.findMany({
      where: { schoolId: reportCard.schoolId, isInReport: true, isActive: true },
      orderBy: { position: 'asc' },
    }),
  ]);

  const scoreTypeInfos: ScoreTypeInfo[] = scoreTypes.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));
  const totalWeight = scoreTypeInfos.reduce((sum, st) => sum + st.weight, 0);

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
      for (const st of scoreTypeInfos) { scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 }; }

      for (const exam of subjectExams) {
        if (exam.scoreType && !exam.scoreType.isInReport) continue;
        const examType = exam.scoreType?.type || exam.type;
        const maxMarks = exam.totalMarks ?? 100;
        const score = exam.scores[0]?.score || 0;
        const stId = exam.scoreTypeId || '';

        if (stId && scoresByType[stId]) {
          scoresByType[stId].raw += score;
          scoresByType[stId].max += maxMarks;
        }

        if (examType === 'midterm' || examType === 'ca') {
          caTotal += score;
          caMax += maxMarks;
        } else if (examType === 'exam' || examType === 'final') {
          examTotal += score;
          examMax += maxMarks;
        }
      }

      const hasAnyScores = Object.values(scoresByType).some(s => s.raw > 0);
      if (!hasAnyScores) return [];

      let total = 0;
      if (totalWeight > 0) {
        for (const st of scoreTypeInfos) {
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
        caScore: Math.round((caMax > 0 ? (caTotal / caMax) * 40 : 0) * 100) / 100,
        examScore: Math.round((examMax > 0 ? (examTotal / examMax) * 60 : 0) * 100) / 100,
        total: Math.round(total), percentage: Math.round(total), grade, remark,
        scoresByType,
      } as SubjectResult];
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const totalStudents = await db.student.count({
    where: { classId: reportCard.classId, schoolId: reportCard.schoolId, deletedAt: null, isActive: true },
  });

  const averageScore = subjectResults.length > 0 ? Math.round((grandTotal / subjectResults.length) * 100) / 100 : 0;
  const overallGrade = calculateGrade(averageScore, 100, REPORT_CARD_SCALE);

  return {
    reportCard, school, settings, attendance, domainGrade,
    subjectResults, grandTotal, averageScore, totalStudents,
    overallGrade: overallGrade.grade,
    overallRemark: overallGrade.remark,
    scoreTypes: scoreTypeInfos,
  };
}
