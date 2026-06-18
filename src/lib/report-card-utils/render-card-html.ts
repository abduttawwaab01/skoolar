import type { ReportCardData, Orientation } from './types';

function esc(s: string | number | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gradeColor(grade: string): string {
  const m: Record<string, string> = {
    'A+': '#065f46', 'A': '#059669', 'A-': '#10b981',
    'B+': '#0369a1', 'B': '#0284c7', 'B-': '#38bdf8',
    'C+': '#d97706', 'C': '#f59e0b', 'C-': '#fbbf24',
    'D+': '#ea580c', 'D': '#f97316', 'E': '#dc2626', 'F': '#991b1b',
  };
  return m[grade] || '#6b7280';
}

function gbColor(grade: string): string {
  const m: Record<string, string> = {
    'A+': '#ecfdf5', 'A': '#ecfdf5', 'A-': '#ecfdf5',
    'B+': '#eff6ff', 'B': '#eff6ff', 'B-': '#eff6ff',
    'C+': '#fffbeb', 'C': '#fffbeb', 'C-': '#fffbeb',
    'D+': '#fff7ed', 'D': '#fff7ed', 'E': '#fef2f2', 'F': '#fef2f2',
  };
  return m[grade] || '#f8fafc';
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function adjustColor(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const n1 = Math.min(255, Math.max(0, parseInt(h.slice(0, 2), 16) + amount));
  const n2 = Math.min(255, Math.max(0, parseInt(h.slice(2, 4), 16) + amount));
  const n3 = Math.min(255, Math.max(0, parseInt(h.slice(4, 6), 16) + amount));
  return `#${n1.toString(16).padStart(2, '0')}${n2.toString(16).padStart(2, '0')}${n3.toString(16).padStart(2, '0')}`;
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
  const norm = scoreTypeName.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(scoresByType)) {
    if (k.toLowerCase().replace(/\s+/g, '') === norm) return Math.round(v.raw);
  }
  return null;
}

function ratingBadge(value: string | null): string {
  const v = parseInt(value || '0', 10);
  const labels: Record<number, string> = { 5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Fair', 1: 'Poor' };
  const colors: Record<number, string> = { 5: '#065f46', 4: '#059669', 3: '#d97706', 2: '#ea580c', 1: '#dc2626' };
  if (!v || v < 1) return `<span class="domain-na">—</span>`;
  return `<span class="domain-badge" style="background:${colors[v]}15;color:${colors[v]}">${labels[v]}</span>`;
}

export interface RenderCardHtmlOptions {
  orientation?: Orientation;
}

export async function renderReportCardHTML(input: ReportCardData, options?: RenderCardHtmlOptions): Promise<string> {
  const orientation = options?.orientation || 'portrait';
  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? '297mm' : '210mm';
  const pageH = isLandscape ? '210mm' : '297mm';
  const pageMarginH = '10mm';
  const pageMarginV = isLandscape ? '8mm' : '10mm';

  const pc = input.school.primaryColor || '#059669';
  const dark = '#1e293b';
  const muted = '#64748b';
  const border = '#e2e8f0';
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

  const headerContacts = [input.school.address, input.school.phone, input.school.email].filter(Boolean).join('  |  ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Report Card — ${esc(input.student.name)}</title>
<style>
@page {
  size: ${pageW} ${pageH};
  margin: ${pageMarginV} ${pageMarginH};
}
@page :first { margin-top: 0; }

@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Bold.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Amiri';
  src: url('/fonts/Amiri-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: ${pageW};
  min-height: ${pageH};
  background: #ffffff;
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: ${dark};
  font-size: 9pt;
  line-height: 1.4;
}

.report-card {
  position: relative;
  width: 100%;
  min-height: ${pageH};
  display: grid;
  grid-template-rows: auto auto auto auto 1fr auto auto auto;
  gap: 0;
  overflow: hidden;
}

.watermark {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 36pt;
  font-weight: 900;
  color: ${pc};
  opacity: 0.035;
  white-space: nowrap;
  pointer-events: none;
  letter-spacing: 6mm;
  text-transform: uppercase;
  z-index: 0;
}

/* ===== TOP STRIPE ===== */
.top-stripe {
  height: 2.5mm;
  background: linear-gradient(90deg, ${pc}, ${adjustColor(pc, 30)});
}

/* ===== HEADER ===== */
.header {
  background: linear-gradient(135deg, ${pc}, ${adjustColor(pc, -20)});
  padding: 4mm 5mm;
  display: flex;
  align-items: center;
  gap: 3mm;
}
.header-logo {
  width: 12mm; height: 12mm;
  border-radius: 2mm;
  object-fit: contain;
  flex-shrink: 0;
}
.header-logo-placeholder {
  width: 12mm; height: 12mm;
  border-radius: 2mm;
  background: rgba(255,255,255,0.1);
  flex-shrink: 0;
}
.header-body { flex: 1; min-width: 0; }
.header-name { color: #fff; font-weight: 700; font-size: 14pt; line-height: 1.2; letter-spacing: -0.02em; }
.header-motto { color: #fff; font-size: 7pt; opacity: 0.75; font-style: italic; margin-top: 0.3mm; }
.header-contacts { color: #fff; font-size: 6.5pt; opacity: 0.7; text-align: right; line-height: 1.4; flex-shrink: 0; max-width: 55mm; }

/* ===== TITLE ROW ===== */
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5mm 5mm 1mm;
  border-bottom: 0.5pt solid ${border};
}
.title-row h2 { font-size: 11pt; font-weight: 700; color: ${dark}; }
.title-row .session { font-size: 7.5pt; color: ${muted}; }

/* ===== STUDENT INFO ===== */
.student-info {
  margin: 1.5mm 5mm;
  padding: 2mm 3mm;
  background: #f8fafc;
  border: 0.5pt solid ${border};
  border-radius: 2mm;
  display: flex;
  gap: 3mm;
}
.student-photo {
  width: 14mm; height: 14mm;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5pt solid ${pc}30;
  flex-shrink: 0;
}
.student-photo-placeholder {
  width: 14mm; height: 14mm;
  border-radius: 50%;
  background: ${pc}08;
  border: 1.5pt solid ${pc}20;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 6mm;
  font-weight: 700;
  color: ${pc};
  opacity: 0.3;
}
.student-details {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1mm 3mm;
}
.student-field .field-label { font-size: 6.5pt; color: ${muted}; font-weight: 500; }
.student-field .field-value { font-size: 8pt; color: ${dark}; font-weight: 600; }

/* ===== SECTION LABEL ===== */
.section-label {
  font-size: 9pt;
  font-weight: 700;
  color: ${dark};
  padding: 2mm 5mm 0.8mm;
  display: flex;
  align-items: center;
  gap: 3mm;
}
.section-label::after {
  content: '';
  flex: 1;
  height: 0.5pt;
  background: linear-gradient(90deg, ${pc}40, transparent);
}

/* ===== TABLE ===== */
.table-wrap {
  padding: 0 5mm;
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
.academic-table thead th:first-child { border-radius: 1.5mm 0 0 0; }
.academic-table thead th:last-child { border-radius: 0 1.5mm 0 0; }
.academic-table tbody td {
  padding: 0.6mm 1mm;
  text-align: center;
  border-bottom: 0.3pt solid ${border};
  font-size: 7pt;
  vertical-align: middle;
}
.academic-table tbody tr:nth-child(even) td { background: #f8fafc; }
.academic-table .cell-subject { text-align: left; font-weight: 600; }
.academic-table .cell-remark { text-align: left; font-size: 6.5pt; color: #475569; }

.grade-chip {
  display: inline-block;
  padding: 0.3mm 1.8mm;
  border-radius: 2mm;
  font-size: 6.5pt;
  font-weight: 700;
  line-height: 1.3;
}

/* ===== SUMMARY BAR ===== */
.summary-bar {
  margin: 1.5mm 5mm;
  padding: 2.5mm 3mm;
  background: linear-gradient(135deg, ${pc}08, ${pc}03);
  border: 0.5pt solid ${pc}30;
  border-radius: 2mm;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(30mm, 1fr));
  gap: 1mm;
}
.summary-item { text-align: center; }
.summary-item .sum-label { font-size: 7pt; color: ${muted}; font-weight: 500; display: block; margin-bottom: 0.3mm; }
.summary-item .sum-value { font-size: 12pt; font-weight: 700; color: ${dark}; }
.summary-item .sum-grade { font-size: 14pt; font-weight: 700; }

/* ===== CHART ===== */
.chart-section {
  padding: 0 5mm;
}
.chart-section svg { width: 100%; height: auto; display: block; }
.charts-row {
  display: flex;
  gap: 3mm;
}
.charts-row .chart-main { flex: 1; min-width: 0; }
.charts-row .chart-side { flex-shrink: 0; width: 42mm; }

/* ===== DOMAINS ===== */
.domains-section {
  padding: 0 5mm;
}
.domain-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2mm;
}
.domain-col {
  background: #f8fafc;
  border: 0.3pt solid ${border};
  border-radius: 1.5mm;
  padding: 2mm;
}
.domain-col-title {
  font-size: 7.5pt;
  font-weight: 700;
  color: ${dark};
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.8mm;
}
.domain-avg { font-size: 6.5pt; font-weight: 600; }
.domain-traits { display: flex; flex-direction: column; gap: 0.4mm; }
.domain-trait {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 6.5pt;
}
.domain-trait-label { color: ${muted}; }
.domain-trait-bar { flex: 1; margin: 0 1mm; }
.domain-trait-bar svg { display: block; width: 100%; height: 2mm; }
.domain-trait-value { font-weight: 600; min-width: 5mm; text-align: right; font-size: 6pt; }
.domain-na { color: #94a3b8; }
.domain-badge {
  font-size: 5.5pt;
  font-weight: 700;
  padding: 0.2mm 1.8mm;
  border-radius: 2mm;
  white-space: nowrap;
}

/* ===== ATTENDANCE ===== */
.attendance-section {
  margin: 0 5mm;
  padding: 2mm 3mm;
  background: #f8fafc;
  border: 0.3pt solid ${border};
  border-radius: 1.5mm;
  display: flex;
  align-items: center;
  gap: 3mm;
}
.attendance-gauge { flex-shrink: 0; }
.attendance-details { flex: 1; }
.attendance-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5mm;
  margin-bottom: 1.5mm;
}
.attendance-stat { text-align: center; }
.attendance-stat .att-label { font-size: 6.5pt; color: ${muted}; font-weight: 500; }
.attendance-stat .att-value { font-size: 10pt; font-weight: 700; color: ${dark}; margin-top: 0.2mm; }
.attendance-bars { display: flex; flex-direction: column; gap: 0.8mm; }
.attendance-bar-row {
  display: flex;
  align-items: center;
  gap: 2mm;
}
.attendance-bar-label { font-size: 6pt; color: ${muted}; width: 12mm; flex-shrink: 0; }
.attendance-bar-track { flex: 1; }
.attendance-bar-track svg { display: block; width: 100%; height: 3mm; }
.attendance-bar-count { font-size: 6pt; color: #475569; font-weight: 600; width: 8mm; text-align: right; }

/* ===== REMARKS ===== */
.remarks-section {
  padding: 0 5mm;
}
.remark-block {
  background: #f8fafc;
  border: 0.3pt solid ${border};
  border-radius: 1.5mm;
  padding: 1.5mm 2mm;
  margin-bottom: 1mm;
}
.remark-header { font-size: 7pt; font-weight: 700; color: ${dark}; margin-bottom: 0.5mm; }
.remark-text { font-size: 7pt; color: #475569; line-height: 1.5; }
.remark-signature { font-size: 6pt; color: ${muted}; text-align: right; margin-top: 0.5mm; }

/* ===== BEHAVIOR ===== */
.behavior-section {
  padding: 0 5mm;
}
.behavior-wrap {
  background: #f8fafc;
  border: 0.3pt solid ${border};
  border-radius: 1.5mm;
  padding: 2mm 3mm;
}
.behavior-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4mm 0;
}
.behavior-label { font-size: 7pt; color: #475569; font-weight: 500; min-width: 25mm; }

/* ===== SIGNATURES ===== */
.signatures {
  margin: 1.5mm 5mm;
  display: flex;
  justify-content: space-between;
  padding-top: 1mm;
  border-top: 0.3pt solid ${border};
  font-size: 7.5pt;
  color: ${muted};
}

/* ===== FOOTER ===== */
.footer {
  margin-top: auto;
  padding: 1.5mm 5mm;
  border-top: 0.3pt solid ${border};
  display: flex;
  justify-content: space-between;
  font-size: 6.5pt;
  color: ${muted};
}

/* ===== EMPTY STATE ===== */
.no-data { color: #dc2626; font-size: 8pt; font-style: italic; padding: 3mm 0; text-align: center; }

/* ===== PRINT ===== */
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .watermark { position: fixed; }
  .report-card { min-height: 100%; }
  .page-break { page-break-before: always; }
}
</style>
</head>
<body>
<div class="report-card">

${input.watermarkText ? `<div class="watermark">${esc(input.watermarkText)}</div>` : ''}

<div class="top-stripe"></div>

<div class="header">
  ${input.school.logoBase64
    ? `<img class="header-logo" src="${esc(input.school.logoBase64)}" alt=""/>`
    : `<div class="header-logo-placeholder"></div>`}
  <div class="header-body">
    <div class="header-name">${esc(input.school.name)}</div>
    ${input.school.motto ? `<div class="header-motto">${esc(input.school.motto)}</div>` : ''}
  </div>
  ${headerContacts ? `<div class="header-contacts">${headerContacts}</div>` : ''}
</div>

<div class="title-row">
  <h2>${esc(input.term.name)} Term Report · ${esc(input.cls.name)}${input.cls.section ? ' · ' + esc(input.cls.section) : ''}</h2>
  <span class="session">${esc(input.settings.academicSession || '')}</span>
</div>

<div class="student-info">
  ${input.student.photoBase64
    ? `<img class="student-photo" src="${esc(input.student.photoBase64)}" alt=""/>`
    : `<div class="student-photo-placeholder">${(input.student.name || 'U')[0].toUpperCase()}</div>`}
  <div class="student-details">
    <div class="student-field"><span class="field-label">Name</span><div class="field-value">${esc(input.student.name)}</div></div>
    <div class="student-field"><span class="field-label">Admission No</span><div class="field-value">${esc(input.student.admissionNo)}</div></div>
    <div class="student-field"><span class="field-label">Class</span><div class="field-value">${esc(input.cls.name)}${input.cls.section ? ' · ' + esc(input.cls.section) : ''}</div></div>
    <div class="student-field"><span class="field-label">Gender</span><div class="field-value">${esc(input.student.gender || '—')}</div></div>
    <div class="student-field"><span class="field-label">DOB</span><div class="field-value">${esc(input.student.dateOfBirth || '—')}</div></div>
    ${input.house ? `<div class="student-field"><span class="field-label">House</span><div class="field-value">${esc(input.house)}</div></div>` : ''}
    <div class="student-field"><span class="field-label">Term</span><div class="field-value">${esc(input.term.name)}</div></div>
    <div class="student-field"><span class="field-label">Session</span><div class="field-value">${esc(input.settings.academicSession || '—')}</div></div>
  </div>
</div>

<div class="section-label">Academic Performance</div>

<div class="table-wrap">
${!hasScores
  ? `<div class="no-data">No assessment data available yet</div>`
  : `<table class="academic-table">
  <thead>
    <tr>
      <th style="width:4mm">#</th>
      <th style="text-align:left">Subject</th>
      ${scoreTypes.map(st => `<th style="width:${Math.min(12, Math.max(7, 70 / scoreTypes.length))}mm">${esc(st.name)}</th>`).join('')}
      <th style="width:7mm">Total</th>
      <th style="width:8mm">Grade</th>
      <th style="text-align:left">Remark</th>
    </tr>
  </thead>
  <tbody>
    ${input.subjectResults.map((r, i) => {
      const gc = gbColor(r.grade);
      const cc = gradeColor(r.grade);
      return `<tr>
        <td>${i + 1}</td>
        <td class="cell-subject">${esc(r.subjectName)}</td>
        ${scoreTypes.map(st => {
          const val = getScoreTypeValue(r.scoresByType, st.id, st.name);
          return `<td>${val !== null ? esc(val) : '—'}</td>`;
        }).join('')}
        <td style="font-weight:600">${esc(Math.round(r.total))}</td>
        <td><span class="grade-chip" style="background:${gc};color:${cc}">${esc(r.grade)}</span></td>
        <td class="cell-remark">${esc(r.remark)}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>`}
</div>

<div class="summary-bar">
  <div class="summary-item">
    <span class="sum-label">Total Score</span>
    <div class="sum-value">${!hasScores ? '—' : esc(Math.round(input.totals.grandTotal))}</div>
  </div>
  <div class="summary-item">
    <span class="sum-label">Average</span>
    <div class="sum-value" style="color:${hasScores ? gradeColor(input.totals.overallGrade) : ''}">${!hasScores ? '—' : esc(Math.round(input.totals.averageScore)) + '%'}</div>
  </div>
  <div class="summary-item">
    <span class="sum-label">Grade</span>
    <div class="sum-grade" style="color:${gradeColor(input.totals.overallGrade)}">${!hasScores ? '—' : esc(input.totals.overallGrade)}</div>
  </div>
  <div class="summary-item">
    <span class="sum-label">Class Rank</span>
    <div class="sum-value">${input.totals.classRank ? `${input.totals.classRank}/${input.totals.totalStudents}` : '—'}</div>
  </div>
  <div class="summary-item">
    <span class="sum-label">Status</span>
    <div class="sum-value" style="font-size:10pt;color:${input.totals.averageScore >= 50 ? '#059669' : '#dc2626'}">${!hasScores ? '—' : (input.totals.averageScore >= 50 ? 'PASS' : 'FAIL')}</div>
  </div>
</div>

${showChart ? buildChartHTML(input, pc, dark, muted, border) : ''}

${showDomains && input.domainGrade ? buildDomainsHTML(input.domainGrade, pc, dark, muted, border) : ''}

${renderBehaviorSection(input, pc)}

${showAttendance ? buildAttendanceHTML(input, pc, dark, muted, border) : ''}

${showRemarks ? buildRemarksHTML(input, dark, muted, border) : ''}

<div class="signatures">
  <span>Class Teacher: _________________</span>
  <span>Principal: _________________</span>
</div>

<div class="footer">
  <span>Skoolar · ${todayStr()}</span>
  ${input.settings.nextTermBegins ? `<span>Next Term: ${esc(input.settings.nextTermBegins)}</span>` : ''}
  <span>Powered by Skoolar</span>
</div>

</div>
</body>
</html>`;
}

// ---- Chart Section ----

function buildChartHTML(input: ReportCardData, pc: string, dark: string, muted: string, border: string): string {
  const showRadar = (input.radarData?.length ?? 0) >= 3;
  const showTrend = (input.trendData?.length ?? 0) >= 2;
  let html = `<div class="section-label">Performance Analysis</div><div class="chart-section"><div class="charts-row">`;
  html += `<div class="chart-main"><svg width="100%" height="38mm" viewBox="0 0 600 130" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="130" fill="transparent"/>
    ${(() => {
      const data = input.subjectResults.map(r => ({
        label: r.subjectName.length > 5 ? r.subjectName.slice(0, 5) + '..' : r.subjectName,
        value: Math.round(r.percentage),
        color: gradeColor(r.grade),
      }));
      const barW = Math.max(8, Math.min(24, 560 / data.length - 6));
      const gap = 4;
      const maxVal = 100;
      return data.map((d, i) => {
        const barH = (d.value / maxVal) * 75;
        const x = 40 + i * (barW + gap);
        const y = 110 - barH;
        const gId = `bg${i}`;
        return `<defs><linearGradient id="${gId}" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="${d.color}" stop-opacity="0.6"/><stop offset="100%" stop-color="${d.color}" stop-opacity="1"/></linearGradient></defs>
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="2" fill="url(#${gId})" opacity="0.9"/>
        <text x="${x + barW / 2}" y="122" text-anchor="middle" font-size="6" fill="#64748b" font-family="sans-serif">${esc(d.label)}</text>
        <text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="5.5" fill="#475569" font-family="sans-serif" font-weight="600">${d.value}%</text>`;
      }).join('');
    })()}
    ${[0, 25, 50, 75, 100].map(y => {
      const yPos = 110 - (y / 100) * 75;
      return `<text x="34" y="${yPos + 2}" text-anchor="end" font-size="5" fill="#94a3b8" font-family="sans-serif">${y}</text>
      <line x1="38" y1="${yPos}" x2="590" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    }).join('')}</svg></div>`;
  if (showRadar) {
    html += `<div class="chart-side"><svg width="100%" height="38mm" viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg">
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
    </svg></div>`;
  }
  html += `</div></div>`;

  if (showTrend) {
    html += `<div class="section-label">Performance Trend</div><div class="chart-section">
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
    </svg></div>`;
  }

  return html;
}

// ---- Domains Section ----

function buildDomainsHTML(domainGrade: any, pc: string, dark: string, muted: string, border: string): string {
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
        .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v as string | null })),
    });
  }
  if (domainGrade.psychomotor && Object.keys(domainGrade.psychomotor).length > 1) {
    groups.push({
      title: 'Psychomotor',
      traits: Object.entries(domainGrade.psychomotor)
        .filter(([k]) => k !== 'average')
        .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v as string | null })),
    });
  }
  if (domainGrade.affective && Object.keys(domainGrade.affective).length > 1) {
    groups.push({
      title: 'Affective',
      traits: Object.entries(domainGrade.affective)
        .filter(([k]) => k !== 'average')
        .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v as string | null })),
    });
  }

  if (groups.length === 0) return '';

  let html = `<div class="section-label">Domain Assessment</div><div class="domains-section"><div class="domain-row">`;

  for (const dg of groups) {
    const avg = dg.traits.reduce((s, t) => s + (parseInt(t.value || '0') || 0), 0) / Math.max(1, dg.traits.length);
    const avgPct = Math.min(100, Math.round((avg / 5) * 100));
    const ac = pctColor(avgPct);

    html += `<div class="domain-col">
      <div class="domain-col-title">
        <span>${esc(dg.title)}</span>
        <span class="domain-avg" style="color:${ac}">${avgPct}%</span>
      </div>
      <svg width="100%" height="2.5mm" viewBox="0 0 100 6" xmlns="http://www.w3.org/2000/svg" style="display:block;margin-bottom:1mm;">
        <rect width="100" height="5" rx="2.5" fill="#e2e8f0"/>
        <rect width="${avgPct}" height="5" rx="2.5" fill="${ac}" opacity="0.8"/>
      </svg>
      <div class="domain-traits">
      ${dg.traits.slice(0, 5).map(t => {
        const val = parseInt(t.value || '0') || 0;
        const maxVal = 5;
        const pct = Math.min(100, (val / maxVal) * 100);
        const c = pctColor(pct);
        return `
      <div class="domain-trait">
        <span class="domain-trait-label">${esc(t.label)}</span>
        <div class="domain-trait-bar">
          <svg viewBox="0 0 50 4" xmlns="http://www.w3.org/2000/svg">
            <rect width="50" height="3" rx="1.5" fill="#e2e8f0"/>
            <rect width="${pct * 0.5}" height="3" rx="1.5" fill="${c}" opacity="0.8"/>
          </svg>
        </div>
        <span class="domain-trait-value" style="color:${c}">${ratingBadge(t.value)}</span>
      </div>`;
      }).join('')}
      </div>
    </div>`;
  }

  html += `</div></div>`;
  return html;
}

// ---- Behavior Section ----

function renderBehaviorSection(input: ReportCardData, pc: string): string {
  if (!input.behaviorData?.length) return '';
  const starSize = 2.5;
  const starsSvg = (rating: number) => Array.from({ length: 5 }, (_, i) => {
    if (i < rating) {
      return `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="${pc}" opacity="${1 - (4 - i) * 0.12}"/>`;
    }
    return `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="#e2e8f0"/>`;
  }).join('');

  return `<div class="section-label">Behavioural Assessment</div><div class="behavior-section">
  <div class="behavior-wrap">
    ${input.behaviorData.map(b => `
    <div class="behavior-row">
      <span class="behavior-label">${esc(b.label)}</span>
      <svg width="28mm" height="${starSize * 2.5 + 1}mm" viewBox="0 0 ${5 * (starSize * 2.2 + 1) + starSize * 2} ${starSize * 2 + 2}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="transparent"/>
        ${starsSvg(b.rating)}
      </svg>
    </div>`).join('')}
  </div>
</div>`;
}

// ---- Attendance Section ----

function buildAttendanceHTML(input: ReportCardData, pc: string, dark: string, muted: string, border: string): string {
  return `<div class="section-label">Attendance Analysis</div>
<div class="attendance-section">
  <div class="attendance-gauge">
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
    <text x="45" y="37" text-anchor="middle" font-size="20" font-weight="bold" fill="${dark}" font-family="sans-serif">${Math.round(input.attendance.percentage)}%</text>
    <text x="45" y="50" text-anchor="middle" font-size="5.5" fill="${muted}" font-family="sans-serif">Attendance</text>
  </svg>
  </div>
  <div class="attendance-details">
    <div class="attendance-stats-row">
      <div class="attendance-stat"><span class="att-label">Days Open</span><div class="att-value">${input.attendance.totalDays}</div></div>
      <div class="attendance-stat"><span class="att-label">Present</span><div class="att-value">${input.attendance.daysPresent}</div></div>
      <div class="attendance-stat"><span class="att-label">Absent</span><div class="att-value">${input.attendance.daysAbsent}</div></div>
      <div class="attendance-stat"><span class="att-label">Attendance</span><div class="att-value">${input.attendance.percentage}%</div></div>
    </div>
    <div class="attendance-bars">
      <div class="attendance-bar-row">
        <span class="attendance-bar-label">Present</span>
        <div class="attendance-bar-track"><svg viewBox="0 0 100 8" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="6" rx="3" fill="#e2e8f0"/><rect width="${Math.min(100, (input.attendance.daysPresent / Math.max(1, input.attendance.totalDays)) * 100)}" height="6" rx="3" fill="${pc}" opacity="0.85"/></svg></div>
        <span class="attendance-bar-count">${input.attendance.daysPresent}</span>
      </div>
      <div class="attendance-bar-row">
        <span class="attendance-bar-label">Absent</span>
        <div class="attendance-bar-track"><svg viewBox="0 0 100 8" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="6" rx="3" fill="#e2e8f0"/><rect width="${Math.min(100, (input.attendance.daysAbsent / Math.max(1, input.attendance.totalDays)) * 100)}" height="6" rx="3" fill="#f97316" opacity="0.85"/></svg></div>
        <span class="attendance-bar-count">${input.attendance.daysAbsent}</span>
      </div>
    </div>
  </div>
</div>`;
}

// ---- Remarks Section ----

function buildRemarksHTML(input: ReportCardData, dark: string, muted: string, border: string): string {
  return `<div class="section-label">Remarks</div><div class="remarks-section">
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
</div>`;
}
