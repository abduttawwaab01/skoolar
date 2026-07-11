import { calculateGrade, REPORT_CARD_SCALE } from '@/lib/grade-calculator';
import type { SubjectResult, ScoreTypeInfo } from '@/lib/report-card-utils/types';

interface ExamLike {
  subjectId: string;
  subject: { id: string; name: string; code?: string | null };
  scoreType?: { id: string; name: string; type: string; maxMarks: number; weight: number; isInReport: boolean } | null;
  scoreTypeId?: string | null;
  type: string;
  totalMarks: number | null;
  scores: { score: number; scoreTypeId?: string | null }[];
}

interface ExamScoreInput {
  exams: ExamLike[];
  scoreTypes: ScoreTypeInfo[];
  studentId?: string;
  /** If provided, ensures every subject in this list appears in results (even with 0 scores) */
  classSubjects?: { subjectId: string; subjectName: string }[];
}

/**
 * Calculate subject results from exam scores.
 * Works on-the-fly from Score Entry data — no DB ReportCard records needed.
 */
export function calculateSubjectResults(input: ExamScoreInput): {
  subjectResults: SubjectResult[];
  grandTotal: number;
} {
  const { exams, scoreTypes, classSubjects } = input;
  const totalWeight = scoreTypes.reduce((sum, st) => sum + st.weight, 0);

  const examsBySubject = new Map<string, ExamLike[]>();
  for (const exam of exams) {
    const key = exam.subjectId;
    if (!examsBySubject.has(key)) examsBySubject.set(key, []);
    examsBySubject.get(key)!.push(exam);
  }

  const seenSubjectIds = new Set<string>();
  let grandTotal = 0;
  const subjectResults: SubjectResult[] = [];

  for (const [subjectId, subjectExams] of examsBySubject) {
    seenSubjectIds.add(subjectId);
    const result = calcSingleSubject(subjectId, subjectExams, scoreTypes, totalWeight);
    if (result) {
      grandTotal += result.total;
      subjectResults.push(result);
    }
  }

  // Add subjects from classSubjects that have no exams (show as 0)
  if (classSubjects) {
    for (const cs of classSubjects) {
      if (!seenSubjectIds.has(cs.subjectId)) {
        subjectResults.push({
          subjectId: cs.subjectId,
          subjectName: cs.subjectName,
          caScore: 0,
          examScore: 0,
          total: 0,
          percentage: 0,
          grade: 'F',
          remark: 'Fail',
        });
      }
    }
  }

  subjectResults.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  return { subjectResults, grandTotal };
}

function calcSingleSubject(
  subjectId: string,
  subjectExams: ExamLike[],
  scoreTypes: ScoreTypeInfo[],
  totalWeight: number,
): SubjectResult | null {
  const scoresByType: Record<string, { raw: number; max: number; normalized: number }> = {};
  for (const st of scoreTypes) {
    scoresByType[st.id] = { raw: 0, max: 0, normalized: 0 };
  }

  const subjectName = subjectExams[0]?.subject?.name || 'Unknown';

  for (const exam of subjectExams) {
    if (exam.scoreType && !exam.scoreType.isInReport) continue;
    const maxMarks = exam.totalMarks ?? 100;
    const score = exam.scores[0]?.score ?? 0;
    const stId = exam.scores[0]?.scoreTypeId || exam.scoreTypeId || '';

    if (stId && scoresByType[stId]) {
      scoresByType[stId].raw += score;
      scoresByType[stId].max += maxMarks;
    }
  }

  const hasScoresByType = Object.values(scoresByType).some(s => s.raw > 0);
  const hasAnyExams = subjectExams.length > 0;

  let total = 0;
  if (totalWeight > 0 && hasScoresByType) {
    for (const st of scoreTypes) {
      const sd = scoresByType[st.id];
      if (sd.max > 0) sd.normalized = Math.round(((sd.raw / sd.max) * (st.weight / totalWeight) * 100) * 100) / 100;
      total += sd.normalized;
    }
  } else if (hasAnyExams) {
    total = 0;
  } else {
    return null;
  }

  total = Math.round(total * 100) / 100;

  let caScore = 0;
  let examScore = 0;
  for (const st of scoreTypes) {
    const sd = scoresByType[st.id];
    if (st.type === 'ca' || st.type === 'midterm') {
      caScore += sd.normalized;
    } else if (st.type === 'exam' || st.type === 'final') {
      examScore += sd.normalized;
    }
  }
  caScore = Math.round(caScore * 100) / 100;
  examScore = Math.round(examScore * 100) / 100;

  const { grade, remark } = calculateGrade(total, 100, REPORT_CARD_SCALE);

  return {
    subjectId,
    subjectName,
    caScore,
    examScore,
    total: Math.round(total),
    percentage: Math.round(total),
    grade,
    remark,
    scoresByType,
  };
}

export function calculateAttendance(
  records: { status: string }[],
): { totalDays: number; daysPresent: number; daysAbsent: number; daysLate: number; percentage: number } {
  const totalDays = records.length;
  const daysPresent = records.filter(a => a.status === 'present').length;
  const daysLate = records.filter(a => a.status === 'late').length;
  return {
    totalDays,
    daysPresent,
    daysAbsent: totalDays - daysPresent - daysLate,
    daysLate,
    percentage: totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0,
  };
}

export function calculateOverallGrade(
  subjectResults: SubjectResult[],
  grandTotal: number,
): { averageScore: number; overallGrade: string; overallRemark: string } {
  const averageScore = subjectResults.length > 0 ? Math.round((grandTotal / subjectResults.length) * 100) / 100 : 0;
  const overall = calculateGrade(averageScore, 100, REPORT_CARD_SCALE);
  return { averageScore, overallGrade: overall.grade, overallRemark: overall.remark };
}
