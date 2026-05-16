export interface GradeResult {
  grade: string;
  remark: string;
  percentage: number;
}

export interface GradeScale {
  thresholds: { grade: string; min: number; remark: string }[];
}

export const DEFAULT_GRADE_SCALE: GradeScale = {
  thresholds: [
    { grade: 'A+', min: 90, remark: 'Excellent' },
    { grade: 'A', min: 80, remark: 'Very Good' },
    { grade: 'B', min: 70, remark: 'Good' },
    { grade: 'C', min: 60, remark: 'Fair' },
    { grade: 'D', min: 50, remark: 'Pass' },
    { grade: 'F', min: 0, remark: 'Fail' },
  ],
};

export const ALTERNATIVE_GRADE_SCALE: GradeScale = {
  thresholds: [
    { grade: 'A', min: 70, remark: 'Excellent' },
    { grade: 'B', min: 60, remark: 'Very Good' },
    { grade: 'C', min: 50, remark: 'Good' },
    { grade: 'D', min: 45, remark: 'Fair' },
    { grade: 'E', min: 40, remark: 'Pass' },
    { grade: 'F', min: 0, remark: 'Fail' },
  ],
};

export const REPORT_CARD_SCALE: GradeScale = {
  thresholds: [
    { grade: 'A', min: 70, remark: 'Excellent' },
    { grade: 'B', min: 60, remark: 'Very Good' },
    { grade: 'C', min: 50, remark: 'Good' },
    { grade: 'D', min: 40, remark: 'Fair' },
    { grade: 'E', min: 30, remark: 'Poor' },
    { grade: 'F', min: 0, remark: 'Fail' },
  ],
};

export const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0,
};

export const DEFAULT_PASS_MARK = 50;

export function calculateGrade(
  score: number,
  maxScore: number,
  scale: GradeScale = DEFAULT_GRADE_SCALE
): GradeResult {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  for (const threshold of scale.thresholds) {
    if (percentage >= threshold.min) {
      return { grade: threshold.grade, remark: threshold.remark, percentage };
    }
  }

  const last = scale.thresholds[scale.thresholds.length - 1];
  return { grade: last.grade, remark: last.remark, percentage };
}

export function getGradeFromPercentage(
  percentage: number,
  scale: GradeScale = DEFAULT_GRADE_SCALE
): GradeResult {
  for (const threshold of scale.thresholds) {
    if (percentage >= threshold.min) {
      return { grade: threshold.grade, remark: threshold.remark, percentage };
    }
  }
  const last = scale.thresholds[scale.thresholds.length - 1];
  return { grade: last.grade, remark: last.remark, percentage };
}

export function calculateGradeFromScore(
  score: number,
  maxScore: number
): string {
  if (maxScore <= 0) return 'F';
  const percentage = (score / maxScore) * 100;
  return getGradeFromPercentage(percentage).grade;
}

export function isPassing(percentage: number, passMark: number = DEFAULT_PASS_MARK): boolean {
  return percentage >= passMark;
}

export function calculateGPA(grades: string[]): number {
  if (grades.length === 0) return 0;
  const totalPoints = grades.reduce((sum, grade) => {
    return sum + (GRADE_POINTS[grade] ?? 0);
  }, 0);
  return Math.round((totalPoints / grades.length) * 100) / 100;
}

export function getGradeFromGPA(gpa: number): string {
  if (gpa >= 4.0) return 'A';
  if (gpa >= 3.5) return 'A-';
  if (gpa >= 3.0) return 'B+';
  if (gpa >= 2.5) return 'B';
  if (gpa >= 2.0) return 'C';
  if (gpa >= 1.5) return 'D';
  return 'F';
}

export function getAverageFromGPA(gpa: number): number {
  return Math.round(gpa * 25 * 10) / 10;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isAllowedVideoUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  const allowedDomains = [
    'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
    'tiktok.com', 'facebook.com', 'fb.watch', 'instagram.com',
    'x.com', 'twitter.com',
  ];
  const directExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace('www.', '');
    if (allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d))) return true;
    if (directExtensions.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) return true;
    return false;
  } catch {
    return false;
  }
}

export function isAllowedAudioUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  const directExtensions = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'];
  try {
    const parsed = new URL(url);
    return directExtensions.some(ext => parsed.pathname.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
}
