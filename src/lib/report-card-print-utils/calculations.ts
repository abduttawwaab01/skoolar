import {
  type ReportCardPrintConfig,
  type ScoreTypeConfig,
  type StudentEntry,
  type CalculatedSubject,
  type CalculatedStudent,
  type CalculatedDomain,
  type CalculatedDomainTrait,
  GRADE_BOUNDARIES,
} from './types';

export function getGradeFromPercentage(pct: number): { grade: string; remark: string; color: string; bgColor: string } {
  for (const b of GRADE_BOUNDARIES) {
    if (pct >= b.min && pct <= b.max) {
      return { grade: b.grade, remark: b.remark, color: b.color, bgColor: b.bgColor };
    }
  }
  return { grade: 'F', remark: 'Fail', color: '#991b1b', bgColor: '#fef2f2' };
}

export function calculateSubject(config: ReportCardPrintConfig, scores: Record<string, number | undefined>): CalculatedSubject | null {
  const subjectName = '';
  let total = 0;
  let maxPossible = 0;
  const resultScores: Record<string, number | undefined> = {};

  for (const st of config.scoreTypes) {
    const val = scores[st.id];
    resultScores[st.id] = val;
    if (typeof val === 'number' && !isNaN(val)) {
      if (st.includeInTotal) {
        total += val;
        maxPossible += st.maxScore;
      }
    }
  }

  const percentage = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;
  const { grade, remark, color, bgColor } = getGradeFromPercentage(percentage);

  return {
    name: subjectName,
    total,
    maxPossible,
    percentage,
    grade,
    remark,
    scores: resultScores,
  };
}

export function calculateDomains(config: ReportCardPrintConfig, student: StudentEntry): CalculatedDomain[] {
  return config.domains.map((dom) => {
    const traits: CalculatedDomainTrait[] = dom.traits.map((t) => ({
      label: t.label,
      score: student.domainScores?.[dom.id]?.[t.id],
      maxScore: t.maxScore,
    }));
    const scored = traits.filter((t) => typeof t.score === 'number');
    if (scored.length === 0) {
      return { id: dom.id, name: dom.name, traits, average: 0, grade: '-', remark: '' };
    }
    const totalScore = scored.reduce((s, t) => s + (t.score ?? 0), 0);
    const totalMax = scored.reduce((s, t) => s + t.maxScore, 0);
    const avg = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    const { grade, remark } = getGradeFromPercentage(avg);
    return { id: dom.id, name: dom.name, traits, average: avg, grade, remark };
  });
}

export function calculateStudent(config: ReportCardPrintConfig, student: StudentEntry): CalculatedStudent {
  const subjects: CalculatedSubject[] = [];

  for (const subjectName of config.subjects) {
    const scores = student.scores[subjectName] || {};
    let total = 0;
    let maxPossible = 0;
    const resultScores: Record<string, number | undefined> = {};

    for (const st of config.scoreTypes) {
      const val = scores[st.id];
      resultScores[st.id] = val;
      if (typeof val === 'number' && !isNaN(val)) {
        if (st.includeInTotal) {
          total += val;
          maxPossible += st.maxScore;
        }
      }
    }

    const percentage = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;
    const { grade, remark } = getGradeFromPercentage(percentage);

    subjects.push({
      name: subjectName,
      total,
      maxPossible,
      percentage,
      grade,
      remark,
      scores: resultScores,
    });
  }

  const grandTotal = subjects.reduce((s, sub) => s + sub.total, 0);
  const maxGrandTotal = subjects.reduce((s, sub) => s + sub.maxPossible, 0);
  const averagePercentage = subjects.length > 0 ? Math.round(subjects.reduce((s, sub) => s + sub.percentage, 0) / subjects.length) : 0;
  const { grade: overallGrade, remark: overallRemark } = getGradeFromPercentage(averagePercentage);

  return {
    id: student.id,
    name: student.name,
    admissionNo: student.admissionNo,
    photoDataUrl: student.photoDataUrl,
    teacherComment: student.teacherComment || '',
    principalComment: student.principalComment || '',
    subjects,
    domains: config.showDomains ? calculateDomains(config, student) : [],
    attendance: student.attendance || { present: 0, absent: 0, total: 0 },
    grandTotal,
    maxGrandTotal,
    averagePercentage,
    overallGrade,
    overallRemark,
    position: 1,
    totalStudents: config.students.length,
  };
}

export function calculateAllStudents(config: ReportCardPrintConfig): CalculatedStudent[] {
  const calculated = config.students.map((s) => calculateStudent(config, s));
  calculated.sort((a, b) => b.averagePercentage - a.averagePercentage);
  let currentPos = 1;
  for (let i = 0; i < calculated.length; i++) {
    if (i > 0 && calculated[i].averagePercentage < calculated[i - 1].averagePercentage) {
      currentPos = i + 1;
    }
    calculated[i].position = currentPos;
    calculated[i].totalStudents = calculated.length;
  }
  return calculated;
}
