import type { SubjectResult, DomainData } from './render-card-server';

interface ScoreTypeInfo {
  id: string;
  name: string;
  maxMarks: number;
  weight: number;
  position: number;
}

export interface BehaviorTrait {
  label: string;
  rating: number; // 1-5
}

export interface ReportCardHTMLInput {
  student: {
    name: string;
    admissionNo: string;
    gender?: string | null;
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
    photoBase64?: string | null;
    parents?: string | null;
    age?: string | null;
  };
  school: {
    name: string;
    logoBase64?: string | null;
    address?: string | null;
    motto?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
  };
  settings: {
    principalName?: string | null;
    nextTermBegins?: string | null;
    academicSession?: string | null;
  };
  term: { name: string; order: number };
  cls: { name: string; section?: string | null };
  subjectResults: SubjectResult[];
  attendance: { daysPresent: number; daysAbsent: number; percentage: number; totalDays: number };
  domainGrade: DomainData;
  totals: { grandTotal: number; averageScore: number; totalStudents: number; classRank?: number; overallGrade: string; overallRemark: string };
  teacherComment?: string | null;
  principalComment?: string | null;
  reportCardId?: string;
  watermarkText?: string | null;
  showChart?: boolean;
  showRadarChart?: boolean;
  showTrendChart?: boolean;
  showDomains?: boolean;
  showBehavior?: boolean;
  showAttendance?: boolean;
  showLegend?: boolean;
  scoreTypes?: ScoreTypeInfo[];
  radarData?: { subject: string; score: number }[];
  trendData?: { term: string; average: number }[];
  behaviorData?: BehaviorTrait[];

  // House/school info
  house?: string | null;
}

function esc(s: string | number | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getGradeColor(grade: string): string {
  const map: Record<string, string> = {
    'A+': '#065f46', 'A': '#059669', 'A-': '#10b981',
    'B+': '#0369a1', 'B': '#0284c7', 'B-': '#38bdf8',
    'C+': '#d97706', 'C': '#f59e0b', 'C-': '#fbbf24',
    'D+': '#ea580c', 'D': '#f97316', 'E': '#dc2626', 'F': '#991b1b'
  };
  return map[grade] || '#6b7280';
}

function getScoreTypeValue(
  scoresByType: Record<string, { raw: number; max: number; normalized: number }> | undefined,
  scoreTypeId: string,
  scoreTypeName: string,
): number | null {
  if (!scoresByType) return null;
  if (scoresByType[scoreTypeId]?.raw !== undefined) {
    return Math.round(scoresByType[scoreTypeId].raw);
  }
  const normalized = scoreTypeName.toLowerCase().replace(/\s+/g, '');
  for (const [key, val] of Object.entries(scoresByType)) {
    if (key.toLowerCase().replace(/\s+/g, '') === normalized) {
      return Math.round(val.raw);
    }
  }
  return null;
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function renderReportCardHTML(input: ReportCardHTMLInput): Promise<string> {
  const pc = input.school.primaryColor || '#059669';
  const sc = input.school.secondaryColor || '#ffffff';
  const dark = '#1e293b';
  const muted = '#64748b';
  const hasNoScores = input.subjectResults.length === 0;

  const hasScores = input.subjectResults.length > 0;
  const showChart = input.showChart !== false && hasScores && input.subjectResults.length >= 2;
  const showDomains = input.showDomains !== false && input.domainGrade;
  const showAttendance = input.showAttendance !== false && input.attendance && input.attendance.totalDays > 0;
  const showRemarks = !!(input.teacherComment || input.principalComment);

  const showRadar = input.showRadarChart !== false && hasScores && (input.radarData?.length ?? 0) >= 3;
  const showTrend = input.showTrendChart !== false && (input.trendData?.length ?? 0) >= 2;
  const showBehavior = input.showBehavior !== false && (input.behaviorData?.length ?? 0) > 0;

  const scoreTypes = (input.scoreTypes || []).filter(st =>
    hasScores && input.subjectResults.some(r => {
      if (!r.scoresByType) return false;
      return getScoreTypeValue(r.scoresByType, st.id, st.name) !== null;
    })
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Report Card</title>
<style>
@page {
  size: A4;
  margin: 8mm 10mm;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 210mm;
  min-height: 297mm;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  color: ${dark};
  font-size: 9pt;
  line-height: 1.3;
}
.report-card {
  width: 100%;
  min-height: 281mm;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.top-stripe {
  height: 2.5mm;
  background: linear-gradient(90deg, ${pc}, ${adjustColor(pc, 30)});
  flex-shrink: 0;
}
.header {
  background: linear-gradient(135deg, ${pc}, ${adjustColor(pc, -20)});
  padding: 4mm 5mm;
  display: flex;
  align-items: center;
  gap: 3mm;
  flex-shrink: 0;
}
.header-logo {
  width: 12mm; height: 12mm;
  border-radius: 2mm;
  object-fit: contain;
  flex-shrink: 0;
}
.header-body { flex: 1; min-width: 0; }
.header-name { color: #fff; font-weight: 700; font-size: 14pt; line-height: 1.2; }
.header-motto { color: #fff; font-size: 7pt; opacity: 0.75; font-style: italic; }
.header-contacts { color: #fff; font-size: 6.5pt; opacity: 0.7; text-align: right; line-height: 1.4; flex-shrink: 0; max-width: 55mm; }

.title-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.5mm 5mm 1mm;
  flex-shrink: 0;
  border-bottom: 0.5pt solid #e2e8f0;
}
.title-row h2 { font-size: 11pt; font-weight: 700; color: ${dark}; }
.title-row .session { font-size: 7.5pt; color: ${muted}; }

.student-info {
  margin: 1.5mm 5mm;
  padding: 2mm 3mm;
  background: #f8fafc;
  border: 0.5pt solid #e2e8f0;
  border-radius: 1.5mm;
  display: flex;
  gap: 3mm;
  flex-shrink: 0;
}
.student-photo {
  width: 14mm; height: 14mm;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5pt solid ${pc}30;
  flex-shrink: 0;
}
.student-details {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1mm 3mm;
}
.student-field .label { font-size: 6.5pt; color: ${muted}; font-weight: 500; }
.student-field .value { font-size: 8pt; color: ${dark}; font-weight: 600; }

.section-label {
  font-size: 9pt;
  font-weight: 700;
  color: ${dark};
  padding: 2mm 5mm 0.8mm;
  flex-shrink: 0;
}

.academic-table-wrap {
  padding: 0 5mm;
  flex: 1;
}
.academic-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 7.5pt;
}
.academic-table thead th {
  background: ${pc};
  color: #fff;
  font-weight: 600;
  padding: 0.8mm 1mm;
  text-align: center;
  font-size: 7pt;
  white-space: nowrap;
}
.academic-table thead th:first-child { border-radius: 1mm 0 0 0; }
.academic-table thead th:last-child { border-radius: 0 1mm 0 0; }
.academic-table tbody td {
  padding: 0.6mm 1mm;
  text-align: center;
  border-bottom: 0.3pt solid #e2e8f0;
  font-size: 7pt;
}
.academic-table tbody tr:nth-child(even) td {
  background: #f8fafc;
}
.academic-table .subject-name { text-align: left; font-weight: 600; }
.academic-table .remark-cell { text-align: left; font-size: 6.5pt; }
.academic-table .grade-cell { font-weight: 700; }

.summary-bar {
  margin: 1mm 5mm;
  padding: 2mm 3mm;
  background: #f0fdf4;
  border: 0.5pt solid #bbf7d0;
  border-radius: 1.5mm;
  display: flex;
  flex-shrink: 0;
}
.summary-item { flex: 1; text-align: center; }
.summary-item .label { font-size: 7pt; color: ${muted}; font-weight: 500; }
.summary-item .value { font-size: 11pt; font-weight: 700; color: ${dark}; margin-top: 0.2mm; }
.summary-item .grade-highlight { color: ${pc}; }

.chart-wrap {
  margin: 0 5mm;
  flex-shrink: 0;
}
.chart-wrap svg { width: 100%; height: auto; display: block; }

.domains-wrap {
  margin: 0 5mm;
  flex-shrink: 0;
}
.domain-row { display: flex; gap: 2mm; }
.domain-col {
  flex: 1;
  background: #f8fafc;
  border: 0.3pt solid #e2e8f0;
  border-radius: 1mm;
  padding: 1.5mm;
}
.domain-col-title { font-size: 7.5pt; font-weight: 700; color: ${dark}; margin-bottom: 0.5mm; }
.domain-trait {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.2mm 0; font-size: 6.5pt;
}
.domain-trait-label { color: ${muted}; }
.domain-badge {
  font-size: 6pt; font-weight: 700;
  padding: 0.2mm 1.5mm; border-radius: 2mm; white-space: nowrap;
}

.attendance-wrap {
  margin: 0 5mm;
  padding: 2mm 3mm;
  background: #f8fafc;
  border: 0.3pt solid #e2e8f0;
  border-radius: 1.5mm;
  display: flex;
  align-items: center;
  gap: 3mm;
  flex-shrink: 0;
}
.attendance-stats { flex: 1; display: flex; }
.attendance-stat { flex: 1; text-align: center; }
.attendance-stat .label { font-size: 6.5pt; color: ${muted}; font-weight: 500; }
.attendance-stat .value { font-size: 10pt; font-weight: 700; color: ${dark}; margin-top: 0.2mm; }

.remarks-wrap {
  margin: 0 5mm;
  flex-shrink: 0;
}
.remark-block {
  background: #f8fafc;
  border: 0.3pt solid #e2e8f0;
  border-radius: 1mm;
  padding: 1.5mm 2mm;
  margin-bottom: 1mm;
}
.remark-header { font-size: 7pt; font-weight: 700; color: ${dark}; margin-bottom: 0.3mm; }
.remark-text { font-size: 7pt; color: #475569; line-height: 1.4; }
.remark-signature { font-size: 6pt; color: ${muted}; text-align: right; margin-top: 0.3mm; }

.signatures {
  margin: 1mm 5mm;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
  padding-top: 1mm;
  border-top: 0.3pt solid #e2e8f0;
  font-size: 7.5pt;
  color: ${muted};
}

.footer {
  margin-top: auto;
  padding: 1.5mm 5mm;
  border-top: 0.3pt solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
  font-size: 6.5pt;
  color: ${muted};
}

.watermark {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 36pt; font-weight: 900;
  color: ${pc}; opacity: 0.035;
  white-space: nowrap;
  pointer-events: none;
  letter-spacing: 4mm;
  text-transform: uppercase;
  z-index: 0;
}

.no-data {
  color: #dc2626; font-size: 8pt; font-style: italic;
  padding: 3mm 0; text-align: center;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .watermark { position: absolute; }
}
</style>
</head>
<body>
<div class="report-card">

${input.watermarkText ? `<div class="watermark">${esc(input.watermarkText)}</div>` : ''}

<div class="top-stripe"></div>

<div class="header">
  ${input.school.logoBase64
    ? `<img class="header-logo" src="${esc(input.school.logoBase64)}" alt="Logo"/>`
    : `<div style="width:12mm;height:12mm;border-radius:2mm;background:rgba(255,255,255,0.1);flex-shrink:0;"></div>`}
  <div class="header-body">
    <div class="header-name">${esc(input.school.name)}</div>
    ${input.school.motto ? `<div class="header-motto">${esc(input.school.motto)}</div>` : ''}
  </div>
  <div class="header-contacts">
    ${[input.school.address, input.school.phone, input.school.email].filter(Boolean).join('<br/>')}
  </div>
</div>

<div class="title-row">
  <h2>${esc(input.term.name)} Term Report · ${esc(input.cls.name)}${input.cls.section ? ' · ' + esc(input.cls.section) : ''}</h2>
  <span class="session">${esc(input.settings.academicSession || '')}</span>
</div>

<div class="student-info">
  ${input.student.photoBase64
    ? `<img class="student-photo" src="${esc(input.student.photoBase64)}" alt="Photo"/>`
    : `<div style="width:14mm;height:14mm;border-radius:50%;background:${pc}08;border:1.5pt solid ${pc}20;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:6mm;font-weight:700;color:${pc};opacity:0.3;">${(input.student.name || 'U')[0].toUpperCase()}</div>`}
  <div class="student-details">
    <div class="student-field"><span class="label">Name</span><div class="value">${esc(input.student.name)}</div></div>
    <div class="student-field"><span class="label">Admission No</span><div class="value">${esc(input.student.admissionNo)}</div></div>
    <div class="student-field"><span class="label">Class</span><div class="value">${esc(input.cls.name)}${input.cls.section ? ' · ' + esc(input.cls.section) : ''}</div></div>
    <div class="student-field"><span class="label">Gender</span><div class="value">${esc(input.student.gender || '—')}</div></div>
    <div class="student-field"><span class="label">DOB</span><div class="value">${esc(input.student.dateOfBirth || '—')}</div></div>
    ${input.house ? `<div class="student-field"><span class="label">House</span><div class="value">${esc(input.house)}</div></div>` : ''}
    <div class="student-field"><span class="label">Term</span><div class="value">${esc(input.term.name)}</div></div>
    <div class="student-field"><span class="label">Session</span><div class="value">${esc(input.settings.academicSession || '—')}</div></div>
  </div>
</div>

<div class="section-label">Academic Performance</div>

<div class="academic-table-wrap">
${hasNoScores
  ? `<div class="no-data">No assessment data available yet</div>`
  : `<table class="academic-table">
  <thead>
    <tr>
      <th style="width:4mm">#</th>
      <th style="text-align:left">Subject</th>
      ${scoreTypes.map(st => `<th style="width:${Math.min(12, Math.max(7, 70 / scoreTypes.length))}mm">${esc(st.name)}</th>`).join('')}
      <th style="width:7mm">Total</th>
      <th style="width:6mm">Grade</th>
      <th style="text-align:left">Remark</th>
    </tr>
  </thead>
  <tbody>
    ${input.subjectResults.map((r, i) => {
      const gc = getGradeColor(r.grade);
      return `<tr>
        <td>${i + 1}</td>
        <td class="subject-name">${esc(r.subjectName)}</td>
        ${scoreTypes.map(st => {
          const val = getScoreTypeValue(r.scoresByType, st.id, st.name);
          return `<td>${val !== null ? esc(val) : '—'}</td>`;
        }).join('')}
        <td style="font-weight:600">${esc(Math.round(r.total))}</td>
        <td class="grade-cell" style="color:${gc}">${esc(r.grade)}</td>
        <td class="remark-cell">${esc(r.remark)}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>`}
</div>

<div class="summary-bar" style="background:linear-gradient(135deg,${pc}08,${pc}03);border-color:${pc}30;">
  <div class="summary-item">
    <div class="label">Total Score</div>
    <div class="value" style="font-size:12pt;">${hasNoScores ? '—' : esc(Math.round(input.totals.grandTotal))}</div>
  </div>
  <div class="summary-item">
    <div class="label">Average</div>
    <div class="value" style="font-size:12pt;color:${hasNoScores ? '' : getGradeColor(input.totals.overallGrade)}">${hasNoScores ? '—' : esc(Math.round(input.totals.averageScore)) + '%'}</div>
  </div>
  <div class="summary-item">
    <div class="label">Grade</div>
    <div class="value grade-highlight" style="font-size:14pt;color:${getGradeColor(input.totals.overallGrade)}">${hasNoScores ? '—' : esc(input.totals.overallGrade)}</div>
  </div>
  <div class="summary-item">
    <div class="label">Class Rank</div>
    <div class="value" style="font-size:12pt;">${input.totals.classRank ? `${input.totals.classRank}/${input.totals.totalStudents}` : '—'}</div>
  </div>
  <div class="summary-item">
    <div class="label">Status</div>
    <div class="value" style="font-size:10pt;color:${input.totals.averageScore >= 50 ? '#059669' : '#dc2626'}">${hasNoScores ? '—' : (input.totals.averageScore >= 50 ? 'PASS' : 'FAIL')}</div>
  </div>
</div>

${showChart ? `
<div class="section-label">Performance Analysis</div>
<div style="display:flex;gap:3mm;margin:0 5mm;flex-shrink:0;">
  <div style="flex:1;min-width:0;">
    <svg width="100%" height="38mm" viewBox="0 0 600 130" xmlns="http://www.w3.org/2000/svg" style="display:block;">
      <rect width="600" height="130" fill="transparent"/>
      ${(() => {
        const data = input.subjectResults.map(r => ({
          label: r.subjectName.length > 5 ? r.subjectName.slice(0, 5) + '..' : r.subjectName,
          value: Math.round(r.percentage),
          color: getGradeColor(r.grade),
        }));
        const maxVal = 100;
        const barW = Math.max(8, Math.min(24, (560) / data.length - 6));
        const gap = 4;
        return data.map((d, i) => {
          const barH = (d.value / maxVal) * 75;
          const x = 40 + i * (barW + gap);
          const y = 110 - barH;
          const gradientId = `bg${i}`;
          return `<defs><linearGradient id="${gradientId}" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="${d.color}" stop-opacity="0.6"/><stop offset="100%" stop-color="${d.color}" stop-opacity="1"/></linearGradient></defs>
          <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="2" fill="url(#${gradientId})" opacity="0.9"/>
          <text x="${x + barW / 2}" y="122" text-anchor="middle" font-size="6" fill="#64748b" font-family="sans-serif">${esc(d.label)}</text>
          <text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="5.5" fill="#475569" font-family="sans-serif" font-weight="600">${d.value}%</text>`;
        }).join('');
      })()}
      ${[0, 25, 50, 75, 100].map(y => {
        const yPos = 110 - (y / 100) * 75;
        return `<text x="34" y="${yPos + 2}" text-anchor="end" font-size="5" fill="#94a3b8" font-family="sans-serif">${y}</text>
          <line x1="38" y1="${yPos}" x2="590" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.5"/>`;
      }).join('')}
    </svg>
  </div>
  ${showRadar ? `
  <div style="flex-shrink:0;width:42mm;">
    <svg width="100%" height="38mm" viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg" style="display:block;">
      <rect width="170" height="170" fill="transparent"/>
      ${(() => {
        const radar = (input.radarData || []).slice(0, 6);
        while (radar.length < 6) radar.push({ subject: '', score: 0 });
        const cx = 85, cy = 85, radius = 60, levels = 4, slice = (2 * Math.PI) / 6;
        let out = '';
        for (let l = 0; l < levels; l++) {
          const r = (radius / levels) * (l + 1);
          const pts = radar.map((_, i) => `${cx + r * Math.cos(i * slice - Math.PI / 2)},${cy + r * Math.sin(i * slice - Math.PI / 2)}`).join(' ');
          out += `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="0.3" opacity="${0.12 + (l + 1) * 0.04}"/>`;
        }
        out += radar.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${cx + radius * Math.cos(i * slice - Math.PI / 2)}" y2="${cy + radius * Math.sin(i * slice - Math.PI / 2)}" stroke="#e2e8f0" stroke-width="0.3"/>`).join('');
        const dataPts = radar.map((d, i) => `${cx + (Math.min(d.score, 100) / 100) * radius * Math.cos(i * slice - Math.PI / 2)},${cy + (Math.min(d.score, 100) / 100) * radius * Math.sin(i * slice - Math.PI / 2)}`).join(' ');
        out += `<polygon points="${dataPts}" fill="${pc}" fill-opacity="0.12" stroke="${pc}" stroke-width="1" stroke-linejoin="round"/>`;
        out += radar.map((d, i) => {
          if (!d.subject) return '';
          const a = i * slice - Math.PI / 2;
          const r = (Math.min(d.score, 100) / 100) * radius;
          return `<circle cx="${cx + r * Math.cos(a)}" cy="${cy + r * Math.sin(a)}" r="2" fill="${pc}" stroke="white" stroke-width="0.6"/>`;
        }).join('');
        out += radar.map((d, i) => {
          if (!d.subject) return '';
          const a = i * slice - Math.PI / 2;
          const lx = cx + (radius + 10) * Math.cos(a), ly = cy + (radius + 10) * Math.sin(a);
          const abbr = d.subject.length > 6 ? d.subject.slice(0, 6) : d.subject;
          return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" font-size="4.5" fill="#475569" font-family="sans-serif">${esc(abbr)}</text>`;
        }).join('');
        return out;
      })()}
    </svg>
  </div>` : ''}
</div>` : ''}

${showTrend ? `
<div class="section-label">Performance Trend</div>
<div class="chart-wrap">
  <svg width="100%" height="28mm" viewBox="0 0 500 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="500" height="100" fill="transparent"/>
    ${(() => {
      const trend = input.trendData || [];
      const maxVal = Math.max(...trend.map(d => d.average), 100);
      const minVal = Math.min(...trend.map(d => d.average), 0);
      const range = maxVal - minVal || 50;
      const cH = 65, cW = 420, stepX = trend.length > 1 ? cW / (trend.length - 1) : 0;
      const pts = trend.map((d, i) => ({ x: 50 + i * stepX, y: 80 - ((d.average - minVal) / range) * cH, ...d }));
      const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      const area = `${line} L${pts[pts.length - 1].x},80 L${pts[0].x},80 Z`;
      const markers = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="${pc}" stroke="white" stroke-width="1.2"/>
        <text x="${p.x}" y="${p.y - 6}" text-anchor="middle" font-size="5.5" fill="#475569" font-family="sans-serif" font-weight="600">${p.average}%</text>
        <text x="${p.x}" y="94" text-anchor="middle" font-size="5.5" fill="#64748b" font-family="sans-serif">${esc(p.term)}</text>`).join('');
      return `<path d="${area}" fill="${pc}" fill-opacity="0.06"/><path d="${line}" fill="none" stroke="${pc}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${markers}`;
    })()}
  </svg>
</div>` : ''}

${(showDomains && input.domainGrade) ? `
<div class="section-label">Domain Assessment</div>
<div class="domains-wrap">
  <div class="domain-row">
    ${buildDomainsEnhancedHTML(input.domainGrade, pc)}
  </div>
</div>` : ''}

${showBehavior ? `
<div class="section-label">Behavioural Assessment</div>
<div style="margin:0 5mm;flex-shrink:0;">
  <div style="background:#f8fafc;border:0.3pt solid #e2e8f0;border-radius:1.5mm;padding:2mm 3mm;">
    ${(input.behaviorData || []).map(b => {
      const starColor = pc;
      const starSize = 2.5;
      const stars = Array.from({ length: 5 }, (_, i) => {
        if (i < b.rating) {
          return `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="${starColor}" opacity="${1 - (4 - i) * 0.12}"/>`;
        }
        return `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="#e2e8f0"/>`;
      }).join('');
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.3mm 0;">
        <span style="font-size:7pt;color:#475569;font-weight:500;min-width:25mm;">${esc(b.label)}</span>
        <svg width="28mm" height="${starSize * 2.5 + 1}mm" viewBox="0 0 ${5 * (starSize * 2.2 + 1) + starSize * 2} ${starSize * 2 + 2}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="transparent"/>
          ${stars}
        </svg>
      </div>`;
    }).join('')}
  </div>
</div>` : ''}

${showAttendance ? `
<div class="section-label">Attendance Analysis</div>
<div class="attendance-wrap">
  <svg width="26mm" height="22mm" viewBox="0 0 90 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="45" cy="40" r="32" fill="none" stroke="#e2e8f0" stroke-width="7"/>
    ${(() => {
      const pct = input.attendance.percentage;
      const circumference = 2 * Math.PI * 32;
      const filled = (pct / 100) * circumference;
      const attColor = pct >= 90 ? '#059669' : pct >= 75 ? '#d97706' : '#dc2626';
      return `<circle cx="45" cy="40" r="32" fill="none" stroke="${attColor}" stroke-width="7"
        stroke-dasharray="${filled} ${circumference - filled}" stroke-linecap="round"
        transform="rotate(-90 45 40)"/>`;
    })()}
    <text x="45" y="37" text-anchor="middle" font-size="20" font-weight="bold" fill="#1e293b" font-family="sans-serif">${Math.round(input.attendance.percentage)}%</text>
    <text x="45" y="50" text-anchor="middle" font-size="5.5" fill="#64748b" font-family="sans-serif">Attendance</text>
  </svg>
  <div style="flex:1;">
    <div class="attendance-stats" style="margin-bottom:1.5mm;">
      <div class="attendance-stat"><div class="label">Days Open</div><div class="value">${input.attendance.totalDays}</div></div>
      <div class="attendance-stat"><div class="label">Present</div><div class="value">${input.attendance.daysPresent}</div></div>
      <div class="attendance-stat"><div class="label">Absent</div><div class="value">${input.attendance.daysAbsent}</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:0.8mm;">
      <div style="display:flex;align-items:center;gap:2mm;">
        <span style="font-size:6pt;color:#64748b;width:12mm;">Present</span>
        <svg width="100%" height="3mm" viewBox="0 0 100 8" xmlns="http://www.w3.org/2000/svg" style="flex:1;">
          <rect width="100" height="6" rx="3" fill="#e2e8f0"/>
          <rect width="${Math.min(100, (input.attendance.daysPresent / Math.max(1, input.attendance.totalDays)) * 100)}" height="6" rx="3" fill="${pc}" opacity="0.85"/>
        </svg>
        <span style="font-size:6pt;color:#475569;font-weight:600;width:8mm;text-align:right;">${input.attendance.daysPresent}</span>
      </div>
      <div style="display:flex;align-items:center;gap:2mm;">
        <span style="font-size:6pt;color:#64748b;width:12mm;">Absent</span>
        <svg width="100%" height="3mm" viewBox="0 0 100 8" xmlns="http://www.w3.org/2000/svg" style="flex:1;">
          <rect width="100" height="6" rx="3" fill="#e2e8f0"/>
          <rect width="${Math.min(100, (input.attendance.daysAbsent / Math.max(1, input.attendance.totalDays)) * 100)}" height="6" rx="3" fill="#f97316" opacity="0.85"/>
        </svg>
        <span style="font-size:6pt;color:#475569;font-weight:600;width:8mm;text-align:right;">${input.attendance.daysAbsent}</span>
      </div>
    </div>
  </div>
</div>` : ''}

${showRemarks ? `
<div class="section-label">Remarks</div>
<div class="remarks-wrap">
  ${input.teacherComment ? `
  <div class="remark-block">
    <div class="remark-header">Teacher's Remark</div>
    <div class="remark-text">${esc(input.teacherComment)}</div>
    ${input.domainGrade?.classTeacherName ? `<div class="remark-signature">— ${esc(input.domainGrade.classTeacherName)}</div>` : ''}
  </div>` : ''}
  ${(input.principalComment || input.domainGrade?.principalComment) ? `
  <div class="remark-block">
    <div class="remark-header">Principal's Remark</div>
    <div class="remark-text">${esc(input.principalComment || input.domainGrade?.principalComment)}</div>
    ${input.settings.principalName ? `<div class="remark-signature">— ${esc(input.settings.principalName)}</div>` : ''}
  </div>` : ''}
</div>` : ''}

<div class="signatures">
  <span>Class Teacher: _________________</span>
  <span>Principal: _________________</span>
</div>

<div class="footer">
  <span>Skoolar · ${todayStr()}</span>
  ${input.settings.nextTermBegins ? `<span>Next Term: ${esc(input.settings.nextTermBegins)}</span>` : ''}
</div>

</div>
</body>
</html>`;
}

function adjustColor(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const num = Math.min(255, Math.max(0, parseInt(h.slice(0, 2), 16) + amount));
  const num2 = Math.min(255, Math.max(0, parseInt(h.slice(2, 4), 16) + amount));
  const num3 = Math.min(255, Math.max(0, parseInt(h.slice(4, 6), 16) + amount));
  return `#${num.toString(16).padStart(2, '0')}${num2.toString(16).padStart(2, '0')}${num3.toString(16).padStart(2, '0')}`;
}

function buildDomainsEnhancedHTML(domainGrade: DomainData, primaryColor: string): string {
  const groups: { title: string; traits: { label: string; value: string | null }[] }[] = [];

  function pctColor(pct: number): string {
    if (pct >= 75) return '#059669';
    if (pct >= 50) return '#d97706';
    return '#dc2626';
  }

  if (domainGrade.cognitive && Object.keys(domainGrade.cognitive).length > 1) {
    groups.push({
      title: 'Cognitive',
      traits: Object.entries(domainGrade.cognitive)
        .filter(([k]) => k !== 'average')
        .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
    });
  }
  if (domainGrade.psychomotor && Object.keys(domainGrade.psychomotor).length > 1) {
    groups.push({
      title: 'Psychomotor',
      traits: Object.entries(domainGrade.psychomotor)
        .filter(([k]) => k !== 'average')
        .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
    });
  }
  if (domainGrade.affective && Object.keys(domainGrade.affective).length > 1) {
    groups.push({
      title: 'Affective',
      traits: Object.entries(domainGrade.affective)
        .filter(([k]) => k !== 'average')
        .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
    });
  }

  if (groups.length === 0) return '';

  return groups.map(dg => {
    const avg = dg.traits.reduce((s, t) => s + (parseInt(t.value || '0') || 0), 0) / Math.max(1, dg.traits.length);
    const avgPct = Math.min(100, Math.round((avg / 5) * 100));
    const avgColor = pctColor(avgPct);
    return `
    <div class="domain-col">
      <div class="domain-col-title" style="display:flex;align-items:center;justify-content:space-between;">
        <span>${esc(dg.title)}</span>
        <span style="font-size:6.5pt;font-weight:600;color:${avgColor};">${avgPct}%</span>
      </div>
      <svg width="100%" height="2.5mm" viewBox="0 0 100 6" xmlns="http://www.w3.org/2000/svg" style="display:block;margin-bottom:1mm;">
        <rect width="100" height="5" rx="2.5" fill="#e2e8f0"/>
        <rect width="${avgPct}" height="5" rx="2.5" fill="${avgColor}" opacity="0.8"/>
      </svg>
      ${dg.traits.slice(0, 5).map(t => {
        const val = parseInt(t.value || '0') || 0;
        const maxVal = 5;
        const pct = Math.min(100, (val / maxVal) * 100);
        const c = pctColor(pct);
        return `
      <div class="domain-trait">
        <span class="domain-trait-label">${esc(t.label)}</span>
        <div style="display:flex;align-items:center;gap:1mm;flex:1;margin-left:1mm;">
          <svg width="100%" height="2mm" viewBox="0 0 50 4" xmlns="http://www.w3.org/2000/svg" style="flex:1;">
            <rect width="50" height="3" rx="1.5" fill="#e2e8f0"/>
            <rect width="${pct * 0.5}" height="3" rx="1.5" fill="${c}" opacity="0.8"/>
          </svg>
          <span style="font-size:6pt;font-weight:600;color:${c};min-width:5mm;text-align:right;">${esc(t.value || '—')}</span>
        </div>
      </div>`;
      }).join('')}
    </div>`;
  }).join('');
}
