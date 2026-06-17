export interface TermAverage {
  termId: string;
  termName: string;
  termOrder: number;
  averageScore: number;
  overallGrade: string;
  totalSubjects: number;
}

export interface CumulativeResult {
  terms: TermAverage[];
  cumulativeAverage: number;
  cumulativeGrade: string;
  trend: 'improving' | 'declining' | 'stable';
  subjectCount: number;
}

export function computeCumulativeAverage(terms: TermAverage[]): CumulativeResult {
  if (terms.length === 0) {
    return { terms: [], cumulativeAverage: 0, cumulativeGrade: 'N/A', trend: 'stable', subjectCount: 0 };
  }

  const sorted = [...terms].sort((a, b) => a.termOrder - b.termOrder);
  const total = sorted.reduce((sum, t) => sum + t.averageScore, 0);
  const cumulativeAverage = Math.round((total / sorted.length) * 100) / 100;

  let cumulativeGrade: string;
  if (cumulativeAverage >= 70) cumulativeGrade = 'A';
  else if (cumulativeAverage >= 60) cumulativeGrade = 'B';
  else if (cumulativeAverage >= 50) cumulativeGrade = 'C';
  else if (cumulativeAverage >= 40) cumulativeGrade = 'D';
  else cumulativeGrade = 'F';

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (sorted.length >= 2) {
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    const firstAvg = firstHalf.reduce((s, t) => s + t.averageScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, t) => s + t.averageScore, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 2) trend = 'improving';
    else if (diff < -2) trend = 'declining';
  }

  return {
    terms: sorted,
    cumulativeAverage,
    cumulativeGrade,
    trend,
    subjectCount: sorted.length > 0 ? sorted[0].totalSubjects : 0,
  };
}
