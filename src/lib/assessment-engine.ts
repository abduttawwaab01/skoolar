export type MasteryLevel = 'beginner' | 'intermediate' | 'advanced' | 'mastered';
export type Trend = 'improving' | 'stable' | 'declining';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SkillBreakdown {
  skillName: string;
  score: number;
  maxScore: number;
  percentage: number;
  masteryLevel: MasteryLevel;
}

export interface DomainResult {
  domain: string;
  score: number;
  maxScore: number;
  percentage: number;
  masteryLevel: MasteryLevel;
  skillBreakdown: SkillBreakdown[];
  strengths: string[];
  weaknesses: string[];
}

export interface AssessmentAnswer {
  questionId: string;
  answer: unknown;
  marksAwarded?: number;
  isCorrect?: boolean;
  timeSpent?: number;
}

export interface QuestionData {
  id: string;
  type: string;
  questionText: string;
  options?: string;
  correctAnswer?: string;
  marks: number;
  difficulty: string;
  skillTag?: string;
  category?: string;
  weight: number;
}

export function calculatePercentage(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

export function determineMasteryLevel(percentage: number): MasteryLevel {
  if (percentage >= 80) return 'mastered';
  if (percentage >= 60) return 'advanced';
  if (percentage >= 40) return 'intermediate';
  return 'beginner';
}

export function determineTrend(currentScore: number, previousScore: number | undefined): Trend {
  if (previousScore === undefined || previousScore === null) return 'stable';
  const diff = currentScore - previousScore;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

export function gradeObjectiveAnswer(question: QuestionData, answer: unknown): { isCorrect: boolean; marksAwarded: number } {
  if (!question.correctAnswer || answer === undefined || answer === null) {
    return { isCorrect: false, marksAwarded: 0 };
  }

  try {
    const correct = JSON.parse(question.correctAnswer);
    const isCorrect = JSON.stringify(answer) === JSON.stringify(correct);
    return {
      isCorrect,
      marksAwarded: isCorrect ? question.marks : 0,
    };
  } catch {
    const isCorrect = String(answer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
    return {
      isCorrect,
      marksAwarded: isCorrect ? question.marks : 0,
    };
  }
}

export function computeDomainResults(
  questions: QuestionData[],
  answers: AssessmentAnswer[],
  domain: string
): DomainResult {
  const answerMap = new Map(answers.map(a => [a.questionId, a]));
  const domainQuestions = questions.filter(q => q.category === domain || true);

  let totalScore = 0;
  let totalMaxScore = 0;
  const skillMap = new Map<string, { score: number; maxScore: number }>();

  for (const q of domainQuestions) {
    const ans = answerMap.get(q.id);
    const marksAwarded = ans?.marksAwarded ?? 0;
    const weightedMarks = marksAwarded * q.weight;
    const weightedMax = q.marks * q.weight;

    totalScore += weightedMarks;
    totalMaxScore += weightedMax;

    if (q.skillTag) {
      const existing = skillMap.get(q.skillTag) || { score: 0, maxScore: 0 };
      existing.score += weightedMarks;
      existing.maxScore += weightedMax;
      skillMap.set(q.skillTag, existing);
    }
  }

  const percentage = calculatePercentage(totalScore, totalMaxScore);
  const masteryLevel = determineMasteryLevel(percentage);

  const skillBreakdown: SkillBreakdown[] = Array.from(skillMap.entries()).map(([skillName, data]) => ({
    skillName,
    score: data.score,
    maxScore: data.maxScore,
    percentage: calculatePercentage(data.score, data.maxScore),
    masteryLevel: determineMasteryLevel(calculatePercentage(data.score, data.maxScore)),
  }));

  const weaknesses = skillBreakdown
    .filter(s => s.masteryLevel === 'beginner' || s.masteryLevel === 'intermediate')
    .map(s => s.skillName);

  const strengths = skillBreakdown
    .filter(s => s.masteryLevel === 'advanced' || s.masteryLevel === 'mastered')
    .map(s => s.skillName);

  return {
    domain,
    score: totalScore,
    maxScore: totalMaxScore,
    percentage,
    masteryLevel,
    skillBreakdown,
    strengths,
    weaknesses,
  };
}

export function computeOverallMasteryScore(domainResults: DomainResult[]): number {
  if (domainResults.length === 0) return 0;
  const totalWeighted = domainResults.reduce((sum, d) => sum + d.percentage, 0);
  return Math.round(totalWeighted / domainResults.length);
}

export function computeLearningStyle(answers: AssessmentAnswer[], styleQuestions: QuestionData[]): {
  visual: number;
  auditory: number;
  kinesthetic: number;
  readingWriting: number;
  primaryStyle: string;
  secondaryStyle: string;
} {
  const scores = { visual: 0, auditory: 0, kinesthetic: 0, readingWriting: 0 };
  const counts = { visual: 0, auditory: 0, kinesthetic: 0, readingWriting: 0 };
  const answerMap = new Map(answers.map(a => [a.questionId, a]));

  for (const q of styleQuestions) {
    const ans = answerMap.get(q.id);
    if (!ans || !q.category) continue;
    const category = q.category as keyof typeof scores;
    if (category in scores) {
      const value = typeof ans.answer === 'number' ? ans.answer : 0;
      scores[category] += value;
      counts[category]++;
    }
  }

  const result = {
    visual: counts.visual > 0 ? Math.round((scores.visual / (counts.visual * 5)) * 100) : 0,
    auditory: counts.auditory > 0 ? Math.round((scores.auditory / (counts.auditory * 5)) * 100) : 0,
    kinesthetic: counts.kinesthetic > 0 ? Math.round((scores.kinesthetic / (counts.kinesthetic * 5)) * 100) : 0,
    readingWriting: counts.readingWriting > 0 ? Math.round((scores.readingWriting / (counts.readingWriting * 5)) * 100) : 0,
    primaryStyle: '',
    secondaryStyle: '',
  };

  const sorted = Object.entries(result)
    .filter(([k]) => k !== 'primaryStyle' && k !== 'secondaryStyle')
    .sort(([, a], [, b]) => (b as number) - (a as number));

  result.primaryStyle = sorted[0]?.[0] || '';
  result.secondaryStyle = sorted[1]?.[0] || '';

  return result;
}

export function generateRecommendations(
  domainResults: DomainResult[],
  learningStyle?: { primaryStyle: string; secondaryStyle: string }
): Array<{
  domain: string;
  skillName: string;
  recommendationType: string;
  title: string;
  description: string;
  priority: string;
}> {
  const recommendations: Array<{
    domain: string;
    skillName: string;
    recommendationType: string;
    title: string;
    description: string;
    priority: string;
  }> = [];

  for (const domain of domainResults) {
    for (const weakness of domain.weaknesses) {
      recommendations.push({
        domain: domain.domain,
        skillName: weakness,
        recommendationType: 'revision_focus',
        title: `Improve ${weakness}`,
        description: `Focus on improving your ${weakness} skills. Practice with targeted exercises and review core concepts.`,
        priority: 'high',
      });
    }
  }

  if (learningStyle?.primaryStyle) {
    recommendations.push({
      domain: 'learning_style',
      skillName: 'learning_style',
      recommendationType: 'study_material',
      title: `Leverage Your ${learningStyle.primaryStyle} Learning Style`,
      description: `You learn best through ${learningStyle.primaryStyle} methods. Use ${learningStyle.primaryStyle}-based study techniques to improve retention.`,
      priority: 'medium',
    });
  }

  return recommendations;
}

export function calculateGrowthScore(currentResults: DomainResult[], previousResults: DomainResult[]): {
  overallChange: number;
  domainChanges: Array<{ domain: string; change: number }>;
  trend: Trend;
} {
  const currentOverall = computeOverallMasteryScore(currentResults);
  const previousOverall = previousResults.length > 0 ? computeOverallMasteryScore(previousResults) : 0;

  const domainChanges = currentResults.map(curr => {
    const prev = previousResults.find(p => p.domain === curr.domain);
    return {
      domain: curr.domain,
      change: prev ? curr.percentage - prev.percentage : 0,
    };
  });

  return {
    overallChange: currentOverall - previousOverall,
    domainChanges,
    trend: determineTrend(currentOverall, previousOverall > 0 ? previousOverall : undefined),
  };
}

export function parseJsonSafe<T>(json: string | undefined | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
