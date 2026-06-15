import { isPassing } from './grade-calculator';

export interface PromotionRuleConfig {
  minAverage: number;
  maxFailures: number;
  attendanceThreshold: number;
  subjectsRequired: number;
}

export interface PromotionInput {
  averageScore: number;
  subjectResults: { grade: string; percentage: number }[];
  attendancePercentage: number;
  totalSubjects: number;
}

const DEFAULT_RULES: PromotionRuleConfig = {
  minAverage: 50,
  maxFailures: 2,
  attendanceThreshold: 70,
  subjectsRequired: 0,
};

export function determinePromotionStatus(
  input: PromotionInput,
  rules: PromotionRuleConfig = DEFAULT_RULES
): { status: 'promoted' | 'conditional' | 'repeated' | 'graduated'; reason: string } {
  const { averageScore, subjectResults, attendancePercentage, totalSubjects } = input;
  const failures = subjectResults.filter((s) => !isPassing(s.percentage, rules.minAverage));
  const meetsAttendance = attendancePercentage >= rules.attendanceThreshold;
  const meetsAverage = averageScore >= rules.minAverage;
  const meetsSubjects = rules.subjectsRequired === 0 || totalSubjects >= rules.subjectsRequired;

  if (meetsAverage && failures.length === 0 && meetsAttendance && meetsSubjects) {
    return { status: 'promoted', reason: 'Met all promotion requirements.' };
  }

  if (failures.length <= rules.maxFailures && meetsAttendance) {
    return {
      status: 'conditional',
      reason: `Failed ${failures.length} subject(s) but within allowable limit. Conditional promotion.`,
    };
  }

  return {
    status: 'repeated',
    reason: `Failed ${failures.length} subject(s) and/or attendance below threshold (${attendancePercentage}%).`,
  };
}

export function determineGraduationStatus(
  input: PromotionInput,
  totalTerms: number,
  completedTerms: number,
  rules: PromotionRuleConfig = DEFAULT_RULES
): { status: 'graduated' | 'promoted'; reason: string } {
  if (completedTerms < totalTerms) {
    return determinePromotionStatus(input, rules) as any;
  }

  const promo = determinePromotionStatus(input, rules);
  if (promo.status === 'promoted') {
    return { status: 'graduated', reason: 'Successfully completed all academic requirements.' };
  }
  return promo as any;
}
