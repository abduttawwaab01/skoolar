'use client';

export interface SubjectBreakdownItem {
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  totalMarks: number;
  correctCount: number;
  earnedMarks: number;
  percentage: number;
  topicBreakdown: TopicBreakdownItem[];
}

export interface TopicBreakdownItem {
  topic: string;
  totalQuestions: number;
  correctCount: number;
  percentage: number;
}

export interface Recommendation {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
}

export interface SubjectRecommendation {
  subjectId: string;
  subjectName: string;
  percentage: number;
  recommendations: Recommendation[];
}

const MASTERY_THRESHOLDS = { mastered: 80, advanced: 60, intermediate: 40 };

export function computeSubjectBreakdown(
  questions: { id: string; subjectId?: string | null; topic?: string | null; marks: number }[],
  studentAnswers: Record<string, unknown> | null,
  isCorrectFn: (questionId: string, answer: unknown) => boolean,
  subjects: { id: string; name: string }[],
): SubjectBreakdownItem[] {
  const subjectMap = new Map<string, SubjectBreakdownItem>();

  for (const q of questions) {
    const sid = q.subjectId || '__none__';
    if (!subjectMap.has(sid)) {
      const sub = subjects.find(s => s.id === sid);
      subjectMap.set(sid, {
        subjectId: sid,
        subjectName: sub?.name || (sid === '__none__' ? 'Uncategorized' : 'Unknown'),
        totalQuestions: 0,
        totalMarks: 0,
        correctCount: 0,
        earnedMarks: 0,
        percentage: 0,
        topicBreakdown: [],
      });
    }
    const entry = subjectMap.get(sid)!;
    entry.totalQuestions++;
    entry.totalMarks += q.marks;

    const answer = studentAnswers?.[q.id] ?? null;
    const correct = isCorrectFn(q.id, answer);
    if (correct) {
      entry.correctCount++;
      entry.earnedMarks += q.marks;
    }

    // Topic breakdown
    const topic = q.topic?.trim();
    if (topic) {
      let tb = entry.topicBreakdown.find(t => t.topic === topic);
      if (!tb) {
        tb = { topic, totalQuestions: 0, correctCount: 0, percentage: 0 };
        entry.topicBreakdown.push(tb);
      }
      tb.totalQuestions++;
      if (correct) tb.correctCount++;
    }
  }

  for (const entry of subjectMap.values()) {
    entry.percentage = entry.totalMarks > 0
      ? Math.round((entry.earnedMarks / entry.totalMarks) * 100 * 100) / 100
      : 0;
    for (const tb of entry.topicBreakdown) {
      tb.percentage = tb.totalQuestions > 0
        ? Math.round((tb.correctCount / tb.totalQuestions) * 100 * 100) / 100
        : 0;
    }
  }

  return Array.from(subjectMap.values()).sort((a, b) => b.totalMarks - a.totalMarks);
}

export function computeSubjectBreakdownForClass(
  questions: { id: string; subjectId?: string | null; marks: number; topic?: string | null }[],
  allStudentAnswers: { studentAnswers: Record<string, unknown> | null; totalMarks: number }[],
  isCorrectFn: (questionId: string, answer: unknown) => boolean,
  subjects: { id: string; name: string }[],
): (SubjectBreakdownItem & { studentsCount: number })[] {
  const subjectMap = new Map<string, SubjectBreakdownItem & { studentsCount: number }>();

  for (const q of questions) {
    const sid = q.subjectId || '__none__';
    if (!subjectMap.has(sid)) {
      const sub = subjects.find(s => s.id === sid);
      subjectMap.set(sid, {
        subjectId: sid,
        subjectName: sub?.name || (sid === '__none__' ? 'Uncategorized' : 'Unknown'),
        totalQuestions: 0,
        totalMarks: 0,
        correctCount: 0,
        earnedMarks: 0,
        percentage: 0,
        topicBreakdown: [],
        studentsCount: 0,
      });
    }
    const entry = subjectMap.get(sid)!;
    entry.totalQuestions++;
    entry.totalMarks += q.marks;

    for (const sa of allStudentAnswers) {
      const answer = sa.studentAnswers?.[q.id] ?? null;
      if (isCorrectFn(q.id, answer)) {
        entry.correctCount++;
        entry.earnedMarks += q.marks;
      }
    }
  }

  const totalStudents = allStudentAnswers.length;
  for (const entry of subjectMap.values()) {
    entry.studentsCount = totalStudents;
    const totalPossible = entry.totalMarks * totalStudents;
    entry.percentage = totalPossible > 0
      ? Math.round((entry.earnedMarks / totalPossible) * 100 * 100) / 100
      : 0;
  }

  return Array.from(subjectMap.values()).sort((a, b) => b.totalMarks - a.totalMarks);
}

export function generateRecommendations(
  subjectBreakdown: SubjectBreakdownItem[],
  overallPercentage: number,
  passRate?: number,
): { subjectRecommendations: SubjectRecommendation[]; generalRecommendations: Recommendation[] } {
  const subjectRecommendations: SubjectRecommendation[] = [];
  const generalRecommendations: Recommendation[] = [];

  for (const sub of subjectBreakdown) {
    if (sub.subjectId === '__none__') continue;
    const recs: Recommendation[] = [];
    if (sub.percentage < 40) {
      recs.push({ type: 'danger', title: 'Critical Weakness', description: `${sub.subjectName} score (${sub.percentage}%) is critically low. Consider remediation sessions and targeted practice.` });
    } else if (sub.percentage < 60) {
      recs.push({ type: 'warning', title: 'Needs Improvement', description: `${sub.subjectName} score (${sub.percentage}%) is below average. Focus on key topics.` });
    } else if (sub.percentage >= 80) {
      recs.push({ type: 'success', title: 'Strong Performance', description: `Excellent performance in ${sub.subjectName}! Consider enrichment materials.` });
    }
    for (const tb of sub.topicBreakdown) {
      if (tb.percentage < 40) {
        recs.push({ type: 'info', title: `Weak Topic: ${tb.topic}`, description: `Only ${tb.percentage}% correct on "${tb.topic}" questions in ${sub.subjectName}. Review this topic.` });
      }
    }
    subjectRecommendations.push({ subjectId: sub.subjectId, subjectName: sub.subjectName, percentage: sub.percentage, recommendations: recs });
  }

  if (overallPercentage < 50) {
    generalRecommendations.push({ type: 'danger', title: 'Overall Performance', description: `Overall score is ${overallPercentage}%. Consider a comprehensive study plan.` });
  }
  if (passRate !== undefined && passRate < 50) {
    generalRecommendations.push({ type: 'warning', title: 'Low Pass Rate', description: `Only ${passRate.toFixed(1)}% of students passed. Review instructional strategies.` });
  }
  if (subjectBreakdown.length > 1 && overallPercentage >= 70) {
    generalRecommendations.push({ type: 'success', title: 'Balanced Performance', description: 'Solid performance across subjects. Maintain consistency.' });
  }

  return { subjectRecommendations, generalRecommendations };
}

export function generateStudentInsights(
  subjectBreakdown: SubjectBreakdownItem[],
  overallPercentage: number,
): { strengths: { name: string; score: number }[]; weaknesses: { name: string; score: number }[] } {
  const strengths: { name: string; score: number }[] = [];
  const weaknesses: { name: string; score: number }[] = [];

  for (const sub of subjectBreakdown) {
    if (sub.subjectId === '__none__') continue;
    if (sub.percentage >= 70) {
      strengths.push({ name: sub.subjectName, score: sub.percentage });
    } else if (sub.percentage < 50) {
      weaknesses.push({ name: sub.subjectName, score: sub.percentage });
    }
  }

  if (strengths.length === 0 && subjectBreakdown.some(s => s.subjectId !== '__none__')) {
    const best = [...subjectBreakdown].filter(s => s.subjectId !== '__none__').sort((a, b) => b.percentage - a.percentage)[0];
    if (best) strengths.push({ name: best.subjectName, score: best.percentage });
  }
  if (weaknesses.length === 0 && subjectBreakdown.some(s => s.subjectId !== '__none__')) {
    const worst = [...subjectBreakdown].filter(s => s.subjectId !== '__none__').sort((a, b) => a.percentage - b.percentage)[0];
    if (worst && worst.percentage < 80) weaknesses.push({ name: worst.subjectName, score: worst.percentage });
  }

  return { strengths, weaknesses };
}

export function getMasteryLevel(percentage: number): 'mastered' | 'advanced' | 'intermediate' | 'beginner' {
  if (percentage >= MASTERY_THRESHOLDS.mastered) return 'mastered';
  if (percentage >= MASTERY_THRESHOLDS.advanced) return 'advanced';
  if (percentage >= MASTERY_THRESHOLDS.intermediate) return 'intermediate';
  return 'beginner';
}

export function getMasteryColor(level: string): string {
  switch (level) {
    case 'mastered': return '#059669';
    case 'advanced': return '#3B82F6';
    case 'intermediate': return '#F59E0B';
    case 'beginner': return '#EF4444';
    default: return '#6B7280';
  }
}

export function getMasteryBadgeClass(level: string): string {
  switch (level) {
    case 'mastered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'advanced': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'intermediate': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'beginner': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}
