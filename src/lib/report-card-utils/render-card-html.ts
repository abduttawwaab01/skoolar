import type { SubjectResult, DomainData } from './render-card-server';

interface ScoreTypeInfo {
  id: string;
  name: string;
  maxMarks: number;
  weight: number;
  position: number;
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
  showDomains?: boolean;
  showAttendance?: boolean;
  showLegend?: boolean;
  scoreTypes?: ScoreTypeInfo[];
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

<div class="summary-bar">
  <div class="summary-item">
    <div class="label">Total Score</div>
    <div class="value">${hasNoScores ? '—' : esc(Math.round(input.totals.grandTotal))}</div>
  </div>
  <div class="summary-item">
    <div class="label">Average</div>
    <div class="value">${hasNoScores ? '—' : esc(Math.round(input.totals.averageScore)) + '%'}</div>
  </div>
  <div class="summary-item">
    <div class="label">Grade</div>
    <div class="value grade-highlight" style="color:${getGradeColor(input.totals.overallGrade)}">${hasNoScores ? '—' : esc(input.totals.overallGrade)}</div>
  </div>
  <div class="summary-item">
    <div class="label">Class Rank</div>
    <div class="value">${input.totals.classRank ? `${input.totals.classRank}/${input.totals.totalStudents}` : '—'}</div>
  </div>
  <div class="summary-item">
    <div class="label">Remark</div>
    <div class="value">${hasNoScores ? '—' : esc(input.totals.overallRemark)}</div>
  </div>
</div>

${showChart ? `
<div class="section-label">Performance Chart</div>
<div class="chart-wrap">
  <svg width="100%" height="35mm" viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="120" fill="transparent"/>
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
        const barH = (d.value / maxVal) * 70;
        const x = 40 + i * (barW + gap);
        const y = 100 - barH;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="2" fill="${d.color}" opacity="0.85"/>
          <text x="${x + barW / 2}" y="112" text-anchor="middle" font-size="6" fill="#64748b" font-family="sans-serif">${esc(d.label)}</text>
          <text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="5.5" fill="#475569" font-family="sans-serif">${d.value}%</text>`;
      }).join('');
    })()}
    ${[0, 25, 50, 75, 100].map(y => {
      const yPos = 100 - (y / 100) * 70;
      return `<text x="34" y="${yPos + 2}" text-anchor="end" font-size="5" fill="#94a3b8" font-family="sans-serif">${y}</text>
        <line x1="38" y1="${yPos}" x2="590" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    }).join('')}
  </svg>
</div>` : ''}

${(showDomains && input.domainGrade) ? `
<div class="section-label">Domain Assessment</div>
<div class="domains-wrap">
  <div class="domain-row">
    ${buildDomainsHTML(input.domainGrade)}
  </div>
</div>` : ''}

${showAttendance ? `
<div class="section-label">Attendance</div>
<div class="attendance-wrap">
  <svg width="28mm" height="24mm" viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="45" r="35" fill="none" stroke="#e2e8f0" stroke-width="8"/>
    ${(() => {
      const pct = input.attendance.percentage;
      const circumference = 2 * Math.PI * 35;
      const filled = (pct / 100) * circumference;
      const attColor = pct >= 90 ? '#059669' : pct >= 75 ? '#d97706' : '#dc2626';
      return `<circle cx="50" cy="45" r="35" fill="none" stroke="${attColor}" stroke-width="8"
        stroke-dasharray="${filled} ${circumference - filled}" stroke-linecap="round"
        transform="rotate(-90 50 45)"/>`;
    })()}
    <text x="50" y="42" text-anchor="middle" font-size="22" font-weight="bold" fill="#1e293b" font-family="sans-serif">${input.attendance.percentage}%</text>
    <text x="50" y="55" text-anchor="middle" font-size="6" fill="#64748b" font-family="sans-serif">Attendance</text>
  </svg>
  <div class="attendance-stats">
    <div class="attendance-stat">
      <div class="label">Days Open</div>
      <div class="value">${input.attendance.totalDays}</div>
    </div>
    <div class="attendance-stat">
      <div class="label">Present</div>
      <div class="value">${input.attendance.daysPresent}</div>
    </div>
    <div class="attendance-stat">
      <div class="label">Absent</div>
      <div class="value">${input.attendance.daysAbsent}</div>
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

function buildDomainsHTML(domainGrade: DomainData): string {
  const groups: { title: string; traits: { label: string; value: string | null }[] }[] = [];

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

  return groups.map(dg => `
    <div class="domain-col">
      <div class="domain-col-title">${esc(dg.title)}</div>
      ${dg.traits.slice(0, 5).map(t => `
      <div class="domain-trait">
        <span class="domain-trait-label">${esc(t.label)}</span>
        <span class="domain-badge" style="background:${t.value ? '#05966918' : '#f1f5f9'};color:${t.value ? '#059669' : '#94a3b8'}">${esc(t.value || 'N/A')}</span>
      </div>`).join('')}
    </div>`).join('');
}
