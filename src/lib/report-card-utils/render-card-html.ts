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
    'A1': '#065f46', 'B2': '#059669', 'B3': '#0284c7',
    'C4': '#d97706', 'C5': '#ea580c', 'C6': '#f97316',
    'D7': '#dc2626', 'E8': '#dc2626', 'F9': '#991b1b',
  };
  return m[grade] || '#6b7280';
}

function gbColor(grade: string): string {
  const m: Record<string, string> = {
    'A+': '#ecfdf5', 'A': '#ecfdf5', 'A-': '#ecfdf5',
    'B+': '#eff6ff', 'B': '#eff6ff', 'B-': '#eff6ff',
    'C+': '#fffbeb', 'C': '#fffbeb', 'C-': '#fffbeb',
    'D+': '#fff7ed', 'D': '#fff7ed', 'E': '#fef2f2', 'F': '#fef2f2',
    'A1': '#ecfdf5', 'B2': '#ecfdf5', 'B3': '#eff6ff',
    'C4': '#fffbeb', 'C5': '#fff7ed', 'C6': '#fff7ed',
    'D7': '#fef2f2', 'E8': '#fef2f2', 'F9': '#fef2f2',
  };
  return m[grade] || '#f8fafc';
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function adjustColor(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const clamp = (x: number) => Math.min(255, Math.max(0, x));
  const r = clamp(parseInt(h.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(h.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(h.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
  if (!v || v < 1) return '';
  const labels: Record<number, string> = { 5: 'Exc', 4: 'V.G', 3: 'Good', 2: 'Fair', 1: 'Poor' };
  const colors: Record<number, string> = { 5: '#065f46', 4: '#059669', 3: '#d97706', 2: '#ea580c', 1: '#dc2626' };
  return `<span style="background:${colors[v]}15;color:${colors[v]};font-size:5pt;font-weight:700;padding:0.2mm 1.5mm;border-radius:2mm;white-space:nowrap">${labels[v]}</span>`;
}

function behaviorStars(rating: number, pc: string): string {
  const starSize = 2;
  const stars = Array.from({ length: 5 }, (_, i) => {
    const fill = i < rating ? pc : '#e2e8f0';
    const opacity = i < rating ? 1 - (4 - i) * 0.12 : 1;
    return `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="${fill}" opacity="${opacity}"/>`;
  }).join('');
  const w = 5 * (starSize * 2.2 + 1) + starSize * 2;
  return `<svg width="${w}" height="${starSize * 2 + 2}" viewBox="0 0 ${w} ${starSize * 2 + 2}" style="display:inline-block;vertical-align:middle">${stars}</svg>`;
}

export interface RenderCardHtmlOptions {
  orientation?: Orientation;
}

export async function renderReportCardHTML(input: ReportCardData, options?: RenderCardHtmlOptions): Promise<string> {
  const orientation = options?.orientation || 'portrait';
  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? '297mm' : '210mm';
  const pageH = isLandscape ? '210mm' : '297mm';

  const pc = input.school.primaryColor || '#059669';
  const dark = '#1e293b';
  const muted = '#64748b';
  const border = '#e2e8f0';
  const hasScores = input.subjectResults.length > 0;

  const showChart = input.showChart !== false && hasScores && input.subjectResults.length >= 2;
  const showDomains = input.showDomains !== false && input.domainGrade;
  const showAttendance = input.showAttendance !== false && input.attendance && input.attendance.totalDays > 0;
  const showRemarks = !!(input.teacherComment || input.principalComment || input.behaviorData?.length);

  const chartCols = Math.min(Math.max(input.chartColumns || 2, 1), 4);
  const domainCols = Math.min(Math.max(input.domainColumns || 3, 1), 4);
  const needsPageBreak = hasScores && input.subjectResults.length > 12;

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
<title>Report Card — ${esc(input.student.name)}</title>
<style>
@page { size: ${pageW} ${pageH}; margin: 4mm 5mm; }
@page :first { margin-top: 4mm; }

@font-face {
  font-family:'Geist';
  src:url('/fonts/Geist-Regular.woff2') format('woff2');
  font-weight:400; font-style:normal; font-display:swap;
}
@font-face {
  font-family:'Geist';
  src:url('/fonts/Geist-Bold.woff2') format('woff2');
  font-weight:600; font-style:normal; font-display:swap;
}
@font-face {
  font-family:'Geist';
  src:url('/fonts/Geist-Bold.woff2') format('woff2');
  font-weight:700; font-style:normal; font-display:swap;
}
@font-face {
  font-family:'Amiri';
  src:url('/fonts/Amiri-Regular.woff2') format('woff2');
  font-weight:400; font-style:normal; font-display:swap;
}

*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}

html,body{
  width:100%;min-height:100%;
  background:#fff;
  font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  color:${dark};
  font-size:7pt;line-height:1.35;
}

.report-card{
  position:relative;width:100%;min-height:100%;
  display:flex;flex-direction:column;
}

.watermark{
  position:fixed;top:50%;left:50%;
  transform:translate(-50%,-50%) rotate(-30deg);
  font-size:30pt;font-weight:900;
  color:${pc};opacity:0.03;
  white-space:nowrap;pointer-events:none;
  letter-spacing:4mm;text-transform:uppercase;z-index:0;
}

/* --- Stripe --- */
.stripe{height:2mm;background:linear-gradient(90deg,${pc},${adjustColor(pc,30)})}

/* --- Header --- */
.header{
  background:linear-gradient(135deg,${pc},${adjustColor(pc,-20)});
  padding:2.5mm 4mm;display:flex;align-items:center;gap:2.5mm;
}
.header-logo{width:10mm;height:10mm;border-radius:1.5mm;object-fit:contain;flex-shrink:0}
.header-logo-placeholder{width:10mm;height:10mm;border-radius:1.5mm;background:rgba(255,255,255,0.1);flex-shrink:0}
.header-body{flex:1;min-width:0}
.header-name{color:#fff;font-weight:700;font-size:13pt;line-height:1.2}
.header-motto{color:#fff;font-size:6.5pt;opacity:0.75;font-style:italic;margin-top:0.2mm}
.header-contacts{color:#fff;font-size:5.5pt;opacity:0.7;text-align:right;line-height:1.4;flex-shrink:0;max-width:50mm}

/* --- Title --- */
.title-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:1mm 4mm 0.8mm;border-bottom:0.5pt solid ${border};
}
.title-row h2{font-size:9pt;font-weight:700;color:${dark}}
.title-row .session{font-size:6.5pt;color:${muted}}

/* --- Student Info --- */
.student-info{
  margin:1mm 4mm;padding:1.5mm 2.5mm;
  background:#f8fafc;border:0.5pt solid ${border};border-radius:1.5mm;
  display:flex;gap:2.5mm;align-items:center;
  page-break-inside:avoid;
}
.student-photo{width:11mm;height:11mm;border-radius:50%;object-fit:cover;border:1.5pt solid ${pc}30;flex-shrink:0}
.student-photo-placeholder{
  width:11mm;height:11mm;border-radius:50%;background:${pc}08;border:1.5pt solid ${pc}20;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  font-size:5mm;font-weight:700;color:${pc};opacity:0.3;
}
.student-details{flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5mm 2.5mm}
.student-field .field-label{font-size:5.5pt;color:${muted};font-weight:500}
.student-field .field-value{font-size:7pt;color:${dark};font-weight:600}

/* --- Section Label --- */
.section-label{
  font-size:7.5pt;font-weight:700;color:${dark};
  padding:1.5mm 4mm 0.5mm;display:flex;align-items:center;gap:2.5mm;
  page-break-inside:avoid;
}
.section-label::after{
  content:'';flex:1;height:0.4pt;
  background:linear-gradient(90deg,${pc}40,transparent);
}

/* --- Table --- */
.table-wrap{padding:0 4mm;page-break-inside:avoid}
.academic-table{width:100%;border-collapse:collapse;font-size:6.5pt}
.academic-table thead th{
  background:${pc};color:#fff;font-weight:600;
  padding:0.6mm 0.8mm;text-align:center;font-size:6pt;white-space:nowrap;
}
.academic-table thead th:first-child{border-radius:1.2mm 0 0 0}
.academic-table thead th:last-child{border-radius:0 1.2mm 0 0}
.academic-table tbody td{
  padding:0.4mm 0.8mm;text-align:center;
  border-bottom:0.3pt solid ${border};font-size:6pt;vertical-align:middle;
}
.academic-table tbody tr:nth-child(even) td{background:#f8fafc}
.academic-table .cell-subject{text-align:left;font-weight:600}
.academic-table .cell-remark{text-align:left;font-size:5.5pt;color:#475569}

.grade-chip{
  display:inline-block;padding:0.2mm 1.5mm;border-radius:1.5mm;
  font-size:5.5pt;font-weight:700;line-height:1.3;
}

/* --- Summary Bar --- */
.summary-bar{
  margin:1mm 4mm;padding:1.5mm 2mm;
  background:linear-gradient(135deg,${pc}08,${pc}03);
  border:0.5pt solid ${pc}30;border-radius:1.5mm;
  display:grid;grid-template-columns:repeat(5,1fr);gap:0.5mm;
  page-break-inside:avoid;
}
.summary-item{text-align:center}
.summary-item .sum-label{font-size:6pt;color:${muted};font-weight:500;display:block;margin-bottom:0.2mm}
.summary-item .sum-value{font-size:10pt;font-weight:700;color:${dark}}
.summary-item .sum-grade{font-size:12pt;font-weight:700}

/* --- Charts --- */
.chart-section{padding:0 4mm;page-break-inside:avoid}
.chart-section svg{width:100%;height:auto;display:block}

/* --- Domains --- */
.domains-section{padding:0 4mm;page-break-inside:avoid}
.domain-row{display:grid;grid-template-columns:repeat(${domainCols},1fr);gap:1.5mm}
.domain-col{background:#f8fafc;border:0.3pt solid ${border};border-radius:1.2mm;padding:1.5mm}
.domain-col-title{font-size:6.5pt;font-weight:700;color:${dark};display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5mm}
.domain-avg{font-size:5.5pt;font-weight:600}
.domain-traits{display:flex;flex-direction:column;gap:0.3mm}
.domain-trait{display:flex;align-items:center;justify-content:space-between;font-size:5.5pt}
.domain-trait-label{color:${muted};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.domain-trait-bar{flex:0 0 14mm;margin:0 0.8mm}
.domain-trait-bar svg{display:block;width:100%;height:2mm}
.domain-trait-value{font-weight:600;min-width:4mm;text-align:right;font-size:5pt;flex-shrink:0}
.domain-na{color:#94a3b8}
.domain-badge{font-size:5pt;font-weight:700;padding:0.2mm 1.5mm;border-radius:2mm;white-space:nowrap}

/* --- Bottom row: attendance + behavior + remarks --- */
.bottom-row{display:flex;gap:1.5mm;padding:0 4mm;margin-top:0.5mm;page-break-inside:avoid}

.att-box{
  flex:0 0 55mm;background:#f8fafc;border:0.3pt solid ${border};border-radius:1.2mm;
  padding:1.5mm 2mm;display:flex;align-items:center;gap:2mm;
}
.att-gauge{flex-shrink:0}
.att-details{flex:1}
.att-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0.3mm;margin-bottom:0.5mm}
.att-stat{text-align:center}
.att-stat .att-label{font-size:5pt;color:${muted};font-weight:500}
.att-stat .att-value{font-size:8pt;font-weight:700;color:${dark}}
.att-bar-row{display:flex;align-items:center;gap:1mm}
.att-bar-label{font-size:5pt;color:${muted};width:8mm;flex-shrink:0}
.att-bar-track{flex:1}
.att-bar-track svg{display:block;width:100%;height:2.5mm}
.att-bar-count{font-size:5pt;color:#475569;font-weight:600;width:5mm;text-align:right}

.remarks-box{
  flex:1;background:#f8fafc;border:0.3pt solid ${border};border-radius:1.2mm;
  padding:1.5mm 2mm;display:flex;flex-direction:column;gap:0.5mm;
  min-height:0;overflow:hidden;
}
.remark-item{font-size:6pt;color:#475569;line-height:1.4}
.remark-label{font-size:6pt;font-weight:700;color:${dark}}
.remark-signature{font-size:5pt;color:${muted};text-align:right}
.behavior-line{font-size:6pt;color:#475569;display:flex;align-items:center;gap:2mm}

/* --- Signatures --- */
.signatures{
  margin:1mm 4mm 0;display:flex;justify-content:space-between;
  padding-top:0.8mm;border-top:0.3pt solid ${border};
  font-size:6.5pt;color:${muted};page-break-inside:avoid;
}

/* --- Footer --- */
.footer{
  margin-top:auto;padding:1mm 4mm;
  border-top:0.3pt solid ${border};
  display:flex;justify-content:space-between;
  font-size:5.5pt;color:${muted};
}

/* --- Empty State --- */
.no-data{color:#dc2626;font-size:7pt;font-style:italic;padding:2mm 0;text-align:center}

/* --- Print --- */
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .watermark{position:fixed}
  .report-card{min-height:100%}
  .page-break{page-break-before:always}
}
</style>
</head>
<body>
<div class="report-card">

${input.watermarkText ? `<div class="watermark">${esc(input.watermarkText)}</div>` : ''}

<div class="stripe"></div>

<div class="header">
  ${input.school.logoBase64
    ? `<img class="header-logo" src="${esc(input.school.logoBase64)}" alt=""/>`
    : `<div class="header-logo-placeholder"></div>`}
  <div class="header-body">
    <div class="header-name">${esc(input.school.name)}</div>
    ${input.school.motto ? `<div class="header-motto">${esc(input.school.motto)}</div>` : ''}
  </div>
  ${(() => {
    const c = [input.school.address, input.school.phone, input.school.email].filter(Boolean).join('  |  ');
    return c ? `<div class="header-contacts">${c}</div>` : '';
  })()}
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

${needsPageBreak ? '<div class="page-break"></div>' : ''}

<div class="section-label">Academic Performance</div>

<div class="table-wrap">
${!hasScores
  ? `<div class="no-data">No assessment data available yet</div>`
  : `<table class="academic-table">
  <thead>
    <tr>
      <th style="width:3.5mm">#</th>
      <th style="text-align:left">Subject</th>
      ${scoreTypes.map(st => `<th style="width:${Math.min(10, Math.max(6, 55 / scoreTypes.length))}mm">${esc(st.name)}</th>`).join('')}
      <th style="width:6mm">Total</th>
      <th style="width:7mm">Grade</th>
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
    <div class="sum-value" style="font-size:9pt;color:${input.totals.averageScore >= 50 ? '#059669' : '#dc2626'}">${!hasScores ? '—' : (input.totals.averageScore >= 50 ? 'PASS' : 'FAIL')}</div>
  </div>
</div>

${showChart ? buildChartsSection(input, pc, dark, muted, border, chartCols) : ''}

${showDomains && input.domainGrade ? buildDomainsSection(input.domainGrade, pc, dark, muted, border) : ''}

<div class="bottom-row">
  ${showAttendance ? buildAttendanceCompact(input, pc, dark, muted, border) : ''}
  ${showRemarks ? buildRemarksCompact(input, pc, dark, muted) : ''}
</div>

<div class="signatures">
  <span>Class Teacher: _________________</span>
  <span>Principal: _________________</span>
</div>

<div class="footer">
  <span>${todayStr()}</span>
  ${input.settings.nextTermBegins ? `<span>Next Term: ${esc(input.settings.nextTermBegins)}</span>` : ''}
  <span style="opacity:0.5">Skoolar</span>
</div>

</div>
</body>
</html>`;
}

// ---- Charts Section (configurable columns) ----

function buildChartsSection(input: ReportCardData, pc: string, dark: string, muted: string, border: string, cols: number): string {
  const showRadar = (input.radarData?.length ?? 0) >= 3;
  const showTrend = (input.trendData?.length ?? 0) >= 2;

  let html = `<div class="section-label">Performance Analysis</div><div class="chart-section">`;

  if (cols <= 1) {
    // Single column: bar chart full width
    html += buildBarChartSVG(input, pc);
    if (showRadar) {
      html += `<div style="margin-top:1mm">${buildRadarChartSVG(input, pc)}</div>`;
    }
  } else {
    // Multi-column grid
    const items: string[] = [];
    items.push(buildBarChartSVG(input, pc));
    if (showRadar) items.push(buildRadarChartSVG(input, pc));
    if (showTrend && items.length < cols) items.push(buildTrendChartSVG(input, pc));

    const colPct = Math.floor(100 / cols) - 1;
    const rows = Math.ceil(items.length / cols);
    for (let r = 0; r < rows; r++) {
      html += `<div style="display:flex;gap:1.5mm;margin-bottom:1mm">`;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx < items.length) {
          html += `<div style="flex:1;min-width:0">${items[idx]}</div>`;
        } else {
          html += `<div style="flex:1;min-width:0"></div>`;
        }
      }
      html += `</div>`;
    }
  }

  html += `</div>`;
  return html;
}

function buildBarChartSVG(input: ReportCardData, pc: string): string {
  const data = input.subjectResults.map(r => ({
    label: r.subjectName,
    value: Math.round(r.percentage),
    color: gradeColor(r.grade),
  }));
  const n = data.length;
  const totalW = 560;
  const barW = Math.max(6, Math.min(20, (totalW - 50) / n - 4));
  const gap = 3;
  const chartH = 75;
  const baseY = chartH - 5;

  const yGrid = [0, 25, 50, 75, 100].map(y => {
    const yPos = baseY - (y / 100) * (chartH - 18);
    return `<text x="30" y="${yPos + 1.5}" text-anchor="end" font-size="4.5" fill="#94a3b8">${y}</text>
<line x1="34" y1="${yPos}" x2="${totalW - 6}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.4"/>`;
  }).join('');

  const bars = data.map((d, i) => {
    const barH = (d.value / 100) * (chartH - 18);
    const x = 38 + i * (barW + gap);
    const y = baseY - barH;
    const gId = `cb${i}`;
    return `<defs><linearGradient id="${gId}" x1="0" y1="1" x2="0" y2="0">
<stop offset="0%" stop-color="${d.color}" stop-opacity="0.5"/>
<stop offset="100%" stop-color="${d.color}" stop-opacity="1"/></linearGradient></defs>
<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH,1)}" rx="1.5" fill="url(#${gId})" opacity="0.9"/>
<text x="${x+barW/2}" y="${baseY+8}" text-anchor="middle" font-size="4.5" fill="#64748b">${esc(d.label.length > 6 ? d.label.slice(0,6)+'..' : d.label)}</text>
<text x="${x+barW/2}" y="${y-1.5}" text-anchor="middle" font-size="4.5" fill="#475569" font-weight="600">${d.value}%</text>`;
  }).join('');

  return `<svg width="100%" height="26mm" viewBox="0 0 ${totalW} ${chartH}" xmlns="http://www.w3.org/2000/svg">
<rect width="${totalW}" height="${chartH}" fill="transparent"/>
${yGrid}
${bars}
</svg>`;
}

function buildRadarChartSVG(input: ReportCardData, pc: string): string {
  const radar = (input.radarData || []).slice(0, 6);
  if (radar.length < 3) return '';
  while (radar.length < 6) radar.push({ subject: '', score: 0 });
  const cx = 85, cy = 85, radius = 55, levels = 4, slice = (2 * Math.PI) / 6;

  let out = '<svg width="100%" height="26mm" viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg"><rect width="170" height="170" fill="transparent"/>';

  for (let l = 0; l < levels; l++) {
    const r = (radius / levels) * (l + 1);
    const pts = radar.map((_, i) => `${(cx + r * Math.cos(i * slice - Math.PI / 2)).toFixed(1)},${(cy + r * Math.sin(i * slice - Math.PI / 2)).toFixed(1)}`).join(' ');
    out += `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="0.3" opacity="${0.12 + (l + 1) * 0.04}"/>`;
  }

  out += radar.map((_, i) =>
    `<line x1="${cx}" y1="${cy}" x2="${(cx + radius * Math.cos(i * slice - Math.PI / 2)).toFixed(1)}" y2="${(cy + radius * Math.sin(i * slice - Math.PI / 2)).toFixed(1)}" stroke="#e2e8f0" stroke-width="0.3"/>`
  ).join('');

  const dataPts = radar.map((d, i) => {
    const a = i * slice - Math.PI / 2;
    const r = (Math.min(d.score, 100) / 100) * radius;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

  out += `<polygon points="${dataPts}" fill="${pc}" fill-opacity="0.1" stroke="${pc}" stroke-width="1" stroke-linejoin="round"/>`;

  out += radar.map((d, i) => {
    if (!d.subject) return '';
    const a = i * slice - Math.PI / 2;
    const r = (Math.min(d.score, 100) / 100) * radius;
    const dx = cx + r * Math.cos(a);
    const dy = cy + r * Math.sin(a);
    return `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2" fill="${pc}" stroke="#fff" stroke-width="0.6"/>`;
  }).join('');

  out += radar.map((d, i) => {
    if (!d.subject) return '';
    const a = i * slice - Math.PI / 2;
    const lx = cx + (radius + 10) * Math.cos(a);
    const ly = cy + (radius + 10) * Math.sin(a);
    return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="4.5" fill="#475569">${esc(d.subject.length > 6 ? d.subject.slice(0,6) : d.subject)}</text>`;
  }).join('');

  out += '</svg>';
  return out;
}

function buildTrendChartSVG(input: ReportCardData, pc: string): string {
  const trend = input.trendData || [];
  if (trend.length < 2) return '';
  const maxVal = Math.max(...trend.map(d => d.average), 100);
  const minVal = Math.min(...trend.map(d => d.average), 0);
  const range = maxVal - minVal || 50;
  const cW = 420, cH = 55;
  const stepX = trend.length > 1 ? cW / (trend.length - 1) : 0;

  const pts = trend.map((d, i) => ({ x: 40 + i * stepX, y: 65 - ((d.average - minVal) / range) * cH, ...d }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},65 L${pts[0].x.toFixed(1)},65 Z`;
  const markers = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="${pc}" stroke="#fff" stroke-width="1"/>
<text x="${p.x.toFixed(1)}" y="${(p.y - 4).toFixed(1)}" text-anchor="middle" font-size="5" fill="#475569" font-weight="600">${p.average}%</text>
<text x="${p.x.toFixed(1)}" y="78" text-anchor="middle" font-size="5" fill="#64748b">${esc(p.term)}</text>`
  ).join('');

  return `<svg width="100%" height="22mm" viewBox="0 0 500 85" xmlns="http://www.w3.org/2000/svg">
<rect width="500" height="85" fill="transparent"/>
<path d="${area}" fill="${pc}" fill-opacity="0.06"/>
<path d="${line}" fill="none" stroke="${pc}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
${markers}
</svg>`;
}

// ---- Domains Section ----

function buildDomainsSection(domainGrade: any, pc: string, dark: string, muted: string, border: string): string {
  const groups: { title: string; traits: { label: string; value: string | null }[] }[] = [];

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
    const ac = avgPct >= 75 ? '#059669' : avgPct >= 50 ? '#d97706' : '#dc2626';

    html += `<div class="domain-col">
      <div class="domain-col-title">
        <span>${esc(dg.title)}</span>
        <span class="domain-avg" style="color:${ac}">${avgPct}%</span>
      </div>
      <svg width="100%" height="2mm" viewBox="0 0 100 5" xmlns="http://www.w3.org/2000/svg" style="display:block;margin-bottom:0.5mm">
        <rect width="100" height="4" rx="2" fill="#e2e8f0"/>
        <rect width="${avgPct}" height="4" rx="2" fill="${ac}" opacity="0.8"/>
      </svg>
      <div class="domain-traits">
      ${dg.traits.slice(0, 4).map(t => {
        const val = parseInt(t.value || '0') || 0;
        const pct = Math.min(100, (val / 5) * 100);
        const c = pct >= 75 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
        return `<div class="domain-trait">
          <span class="domain-trait-label">${esc(t.label)}</span>
          <div class="domain-trait-bar">
            <svg viewBox="0 0 40 3" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="2.5" rx="1.25" fill="#e2e8f0"/>
              <rect width="${pct * 0.4}" height="2.5" rx="1.25" fill="${c}" opacity="0.85"/>
            </svg>
          </div>
          <span class="domain-trait-value">${ratingBadge(t.value)}</span>
        </div>`;
      }).join('')}
      </div>
    </div>`;
  }

  html += `</div></div>`;
  return html;
}

// ---- Compact Attendance ----

function buildAttendanceCompact(input: ReportCardData, pc: string, dark: string, muted: string, border: string): string {
  const pct = input.attendance.percentage;
  const circumference = 2 * Math.PI * 22;
  const filled = (pct / 100) * circumference;
  const attColor = pct >= 90 ? '#059669' : pct >= 75 ? '#d97706' : '#dc2626';

  return `<div class="att-box">
    <div class="att-gauge">
    <svg width="18mm" height="16mm" viewBox="0 0 60 55" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="5"/>
      <circle cx="30" cy="28" r="22" fill="none" stroke="${attColor}" stroke-width="5"
        stroke-dasharray="${filled.toFixed(1)} ${(circumference - filled).toFixed(1)}" stroke-linecap="round"
        transform="rotate(-90 30 28)"/>
      <text x="30" y="26" text-anchor="middle" font-size="12" font-weight="bold" fill="${dark}">${Math.round(pct)}%</text>
      <text x="30" y="35" text-anchor="middle" font-size="4" fill="${muted}">Attnd</text>
    </svg>
    </div>
    <div class="att-details">
      <div class="att-stats">
        <div class="att-stat"><span class="att-label">Days</span><div class="att-value">${input.attendance.totalDays}</div></div>
        <div class="att-stat"><span class="att-label">Present</span><div class="att-value">${input.attendance.daysPresent}</div></div>
        <div class="att-stat"><span class="att-label">Absent</span><div class="att-value">${input.attendance.daysAbsent}</div></div>
        <div class="att-stat"><span class="att-label">%</span><div class="att-value" style="color:${attColor}">${Math.round(pct)}</div></div>
      </div>
      <div class="att-bar-row">
        <span class="att-bar-label">Present</span>
        <div class="att-bar-track"><svg viewBox="0 0 80 6" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="5" rx="2.5" fill="#e2e8f0"/><rect width="${Math.min(80, (input.attendance.daysPresent / Math.max(1, input.attendance.totalDays)) * 80)}" height="5" rx="2.5" fill="${pc}" opacity="0.85"/></svg></div>
        <span class="att-bar-count">${input.attendance.daysPresent}</span>
      </div>
    </div>
  </div>`;
}

// ---- Compact Remarks + Behavior inline ----

function buildRemarksCompact(input: ReportCardData, pc: string, dark: string, muted: string): string {
  const hasTeacher = !!input.teacherComment;
  const hasPrincipal = !!(input.principalComment || input.domainGrade?.principalComment);
  const hasBehavior = !!(input.behaviorData?.length);

  let html = `<div class="remarks-box">`;

  if (hasBehavior) {
    const first = input.behaviorData![0];
    html += `<div class="behavior-line"><span class="remark-label">Behaviour:</span> ${behaviorStars(first.rating, pc)} <span style="font-size:5.5pt;color:#64748b">${esc(first.label)}</span></div>`;
  }

  if (hasTeacher) {
    html += `<div class="remark-item"><span class="remark-label">Teacher:</span> ${esc(input.teacherComment)}</div>`;
  }
  if (hasPrincipal) {
    html += `<div class="remark-item"><span class="remark-label">Principal:</span> ${esc(input.principalComment || input.domainGrade?.principalComment)}</div>`;
  }
  if (!hasTeacher && !hasPrincipal && !hasBehavior) {
    html += `<div class="remark-item" style="color:#94a3b8">No remarks</div>`;
  }

  html += `</div>`;
  return html;
}
