import * as https from 'node:https';
import * as http from 'node:http';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { calculateSubjectResults, calculateAttendance, calculateOverallGrade } from '@/lib/calculate-report-card';

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

  const [exams, scoreTypeRecords] = await Promise.all([
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

  const scoreTypes = scoreTypeRecords.map(st => ({ id: st.id, name: st.name, maxMarks: st.maxMarks, weight: st.weight, position: st.position }));

  const { subjectResults, grandTotal } = calculateSubjectResults({
    exams,
    scoreTypes,
  });

  const totalStudents = await db.student.count({
    where: { classId: reportCard.classId, schoolId: reportCard.schoolId, deletedAt: null, isActive: true },
  });

  const { averageScore, overallGrade, overallRemark } = calculateOverallGrade(subjectResults, grandTotal);

  return {
    reportCard, school, settings, attendance, domainGrade,
    subjectResults, grandTotal, averageScore, totalStudents,
    overallGrade, overallRemark,
    scoreTypes,
  };
}
