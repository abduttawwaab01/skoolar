export interface GradeBoundary {
  grade: string;
  min: number;
  max: number;
  remark: string;
}

export const DEFAULT_GRADE_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A', min: 70, max: 100, remark: 'Excellent' },
  { grade: 'B', min: 60, max: 69, remark: 'Very Good' },
  { grade: 'C', min: 50, max: 59, remark: 'Good' },
  { grade: 'D', min: 40, max: 49, remark: 'Fair' },
  { grade: 'E', min: 30, max: 39, remark: 'Poor' },
  { grade: 'F', min: 0, max: 29, remark: 'Fail' },
];

export function getGradeFromBoundaries(
  percentage: number,
  boundaries: GradeBoundary[]
): { grade: string; remark: string } {
  for (const b of boundaries) {
    if (percentage >= b.min && percentage <= b.max) {
      return { grade: b.grade, remark: b.remark };
    }
  }
  const last = boundaries[boundaries.length - 1];
  return { grade: last.grade, remark: last.remark };
}
