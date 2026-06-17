export interface AttendanceCorrelationInput {
  attendancePercentage: number;
  academicAverage: number;
  totalDays: number;
}

export interface AttendanceCorrelationResult {
  correlation: 'strong' | 'moderate' | 'weak' | 'none';
  insight: string;
  score: number;
}

export function analyzeAttendanceCorrelation(input: AttendanceCorrelationInput): AttendanceCorrelationResult {
  const { attendancePercentage, academicAverage } = input;

  const attScore = attendancePercentage / 100;
  const acadScore = academicAverage / 100;

  const diff = Math.abs(attScore - acadScore);
  const product = attScore * acadScore;

  let correlation: 'strong' | 'moderate' | 'weak' | 'none';
  let insight: string;

  if (attendancePercentage >= 90 && academicAverage >= 70) {
    correlation = 'strong';
    insight = 'Excellent attendance strongly supports high academic performance.';
  } else if (attendancePercentage >= 80 && academicAverage >= 60) {
    correlation = 'moderate';
    insight = 'Good attendance contributes positively to academic results.';
  } else if (attendancePercentage < 70 && academicAverage < 50) {
    correlation = 'strong';
    insight = 'Low attendance is likely impacting academic performance. Regular attendance is recommended.';
  } else if (attendancePercentage >= 75 && academicAverage < 50) {
    correlation = 'weak';
    insight = 'Attendance is satisfactory but academic performance needs improvement. Consider additional support.';
  } else if (attendancePercentage < 70 && academicAverage >= 60) {
    correlation = 'weak';
    insight = 'Despite lower attendance, academic performance remains good. Further improvement possible with regular attendance.';
  } else {
    correlation = 'moderate';
    insight = 'Consistent attendance patterns align with steady academic progress.';
  }

  const correlationScore = Math.round((1 - diff) * 100);

  return { correlation, insight, score: correlationScore };
}

export function generateAttendanceCorrelationSVG(
  attPct: number,
  acadAvg: number,
  width: number,
  height: number,
  primaryColor: string
): string {
  const cx = width / 2;
  const cy = height / 2 - 5;
  const r = Math.min(cx, cy) - 10;
  const barW = 12;
  const barGap = 8;
  const maxBarH = height - 30;

  const attBarH = (attPct / 100) * maxBarH;
  const acadBarH = (acadAvg / 100) * maxBarH;

  const attColor = attPct >= 80 ? '#059669' : attPct >= 60 ? '#d97706' : '#dc2626';
  const acadColor = primaryColor || '#0284c7';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="transparent"/>
<text x="${cx}" y="10" text-anchor="middle" font-size="6" fill="#64748b" font-family="Inter" font-weight="600">Attendance vs Performance</text>
<rect x="${cx - barW - barGap}" y="${height - 15 - attBarH}" width="${barW}" height="${attBarH}" rx="2" fill="${attColor}" opacity="0.85"/>
<text x="${cx - barW - barGap + barW / 2}" y="${height - 15 - attBarH - 2}" text-anchor="middle" font-size="5" fill="#475569" font-family="Inter" font-weight="600">${Math.round(attPct)}%</text>
<text x="${cx - barW - barGap + barW / 2}" y="${height - 2}" text-anchor="middle" font-size="5" fill="#64748b" font-family="Inter">Attend.</text>
<rect x="${cx + barGap}" y="${height - 15 - acadBarH}" width="${barW}" height="${acadBarH}" rx="2" fill="${acadColor}" opacity="0.85"/>
<text x="${cx + barGap + barW / 2}" y="${height - 15 - acadBarH - 2}" text-anchor="middle" font-size="5" fill="#475569" font-family="Inter" font-weight="600">${Math.round(acadAvg)}%</text>
<text x="${cx + barGap + barW / 2}" y="${height - 2}" text-anchor="middle" font-size="5" fill="#64748b" font-family="Inter">Academics</text>
</svg>`;
}
