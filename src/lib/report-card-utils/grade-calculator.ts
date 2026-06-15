export interface GradeThreshold {
  grade: string;
  minScore: number;
  maxScore: number;
  remark: string;
  gradePoint: number;
}

export interface GradeScale {
  id: string;
  name: string;
  type: 'percentage' | 'letter' | 'gpa' | 'competency';
  thresholds: GradeThreshold[];
}

export interface SubjectGradeResult {
  score: number;
  total: number;
  percentage: number;
  grade: string;
  remark: string;
  gradePoint: number;
}

export const DEFAULT_THRESHOLDS: GradeThreshold[] = [
  { grade: 'A+', minScore: 90, maxScore: 100, remark: 'Distinction', gradePoint: 4.0 },
  { grade: 'A', minScore: 80, maxScore: 89, remark: 'Excellent', gradePoint: 4.0 },
  { grade: 'B', minScore: 70, maxScore: 79, remark: 'Very Good', gradePoint: 3.0 },
  { grade: 'C', minScore: 60, maxScore: 69, remark: 'Good', gradePoint: 2.0 },
  { grade: 'D', minScore: 50, maxScore: 59, remark: 'Fair', gradePoint: 1.0 },
  { grade: 'F', minScore: 0, maxScore: 49, remark: 'Fail', gradePoint: 0 },
];

export const ALTERNATIVE_THRESHOLDS: GradeThreshold[] = [
  { grade: 'A', minScore: 70, maxScore: 100, remark: 'Excellent', gradePoint: 4.0 },
  { grade: 'B', minScore: 60, maxScore: 69, remark: 'Very Good', gradePoint: 3.0 },
  { grade: 'C', minScore: 50, maxScore: 59, remark: 'Good', gradePoint: 2.0 },
  { grade: 'D', minScore: 45, maxScore: 49, remark: 'Fair', gradePoint: 1.0 },
  { grade: 'E', minScore: 40, maxScore: 44, remark: 'Poor', gradePoint: 0.5 },
  { grade: 'F', minScore: 0, maxScore: 39, remark: 'Fail', gradePoint: 0 },
];

export function calculateGrade(
  score: number,
  maxScore: number,
  thresholds: GradeThreshold[] = DEFAULT_THRESHOLDS
): SubjectGradeResult {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const threshold = thresholds.find(
    (t) => percentage >= t.minScore && percentage <= t.maxScore
  ) || thresholds[thresholds.length - 1];
  return {
    score, total: maxScore, percentage: Math.round(percentage * 100) / 100,
    grade: threshold.grade, remark: threshold.remark, gradePoint: threshold.gradePoint,
  };
}

export function calculateGPA(grades: SubjectGradeResult[]): number {
  if (grades.length === 0) return 0;
  const total = grades.reduce((sum, g) => sum + g.gradePoint, 0);
  return Math.round((total / grades.length) * 100) / 100;
}

export function getOverallGrade(gpa: number): { grade: string; remark: string } {
  if (gpa >= 3.5) return { grade: 'A', remark: 'Excellent' };
  if (gpa >= 3.0) return { grade: 'B', remark: 'Very Good' };
  if (gpa >= 2.0) return { grade: 'C', remark: 'Good' };
  if (gpa >= 1.0) return { grade: 'D', remark: 'Fair' };
  return { grade: 'F', remark: 'Fail' };
}

export function isPassing(percentage: number, passMark = 50): boolean {
  return percentage >= passMark;
}

export function calculateClassRank(scores: { studentId: string; totalScore: number }[]): Map<string, number> {
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
  const ranks = new Map<string, number>();
  sorted.forEach((s, i) => ranks.set(s.studentId, i + 1));
  return ranks;
}

export function calculateWeightedScore(
  scoresByType: { raw: number; max: number; weight: number }[]
): { total: number; maxTotal: number; percentage: number } {
  let totalWeight = 0;
  let weightedSum = 0;
  let maxWeightedSum = 0;
  for (const s of scoresByType) {
    totalWeight += s.weight;
    weightedSum += (s.raw / Math.max(s.max, 1)) * s.weight;
    maxWeightedSum += s.weight;
  }
  const percentage = maxWeightedSum > 0 ? (weightedSum / maxWeightedSum) * 100 : 0;
  return { total: weightedSum, maxTotal: maxWeightedSum, percentage: Math.round(percentage * 100) / 100 };
}
