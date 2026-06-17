import puppeteer, { Browser, Page } from 'puppeteer';
import { GEIST_REGULAR_BASE64, GEIST_FONT_FAMILY } from '@/lib/id-card-utils/geist-font-data';
import { ARABIC_FONT_BASE64, ARABIC_FONT_FAMILY } from '@/lib/id-card-utils/arabic-font-data';
import { esc, n } from '@/lib/id-card-utils/formatters';
import { generateSubjectBarChart, generateAttendanceGauge } from './svg-charts';
import type { SubjectResult, DomainData } from './render-card-server';
import { getScoreDisplay } from './score-type-utils';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  });
  return browserInstance;
}

async function safeClose(page: Page): Promise<void> {
  try { await page.close(); } catch { /* ignore */ }
}

const GEIST_FONT_CSS = `
@font-face {
  font-family: '${GEIST_FONT_FAMILY}';
  src: url(data:font/woff2;base64,${GEIST_REGULAR_BASE64}) format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: '${ARABIC_FONT_FAMILY}';
  src: url(data:font/woff2;base64,${ARABIC_FONT_BASE64}) format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
`;

function fontFamily(): string {
  return `'${ARABIC_FONT_FAMILY}', '${GEIST_FONT_FAMILY}', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
}

function contrast(bg: string): string {
  const h = bg.replace('#', '');
  const lum = (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255;
  return lum > 0.55 ? '#1a1a1a' : '#ffffff';
}

function adj(c: string, a: number): string {
  const h = c.replace('#', '');
  const cl = (x: number) => Math.max(0, Math.min(255, x));
  return `#${cl(parseInt(h.slice(0, 2), 16) + a).toString(16).padStart(2, '0')}${cl(parseInt(h.slice(2, 4), 16) + a).toString(16).padStart(2, '0')}${cl(parseInt(h.slice(4, 6), 16) + a).toString(16).padStart(2, '0')}`;
}

function getGradeColor(grade: string): string {
  const map: Record<string, string> = { 'A+': '#065f46', 'A': '#059669', 'A-': '#10b981', 'B+': '#0369a1', 'B': '#0284c7', 'C': '#d97706', 'D': '#ea580c', 'E': '#dc2626', 'F': '#991b1b' };
  return map[grade] || '#6b7280';
}

function renderRatingBadge(value: string | null): string {
  const v = parseInt(value || '0', 10);
  const labels: Record<number, string> = { 5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Fair', 1: 'Poor' };
  const colors: Record<number, string> = { 5: '#065f46', 4: '#059669', 3: '#d97706', 2: '#ea580c', 1: '#dc2626' };
  if (!v || v < 1) return `<span class="domain-badge domain-badge--na">N/A</span>`;
  return `<span class="domain-badge domain-badge--${v}" style="background:${colors[v]}18;color:${colors[v]}">${labels[v]}</span>`;
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
}

export async function renderReportCardHTML(input: ReportCardHTMLInput): Promise<string> {
  const pc = input.school.primaryColor || '#059669';
  const sc = input.school.secondaryColor || '#ffffff';
  const dark = '#1e293b';
  const muted = '#64748b';
  const pcD = adj(pc, -30);
  const pcL = adj(pc, 40);
  const hdrText = contrast(pc);
  const hasNoScores = input.subjectResults.length === 0;

  const chartSvg = (input.showChart !== false && !hasNoScores)
    ? generateSubjectBarChart(
        input.subjectResults.map(r => ({
          label: r.subjectName.length > 6 ? r.subjectName.slice(0, 6) : r.subjectName,
          value: Math.round(r.percentage),
          color: getGradeColor(r.grade),
        })),
        540, 100
      )
    : null;

  const attSvg = (input.showAttendance !== false && input.attendance)
    ? generateAttendanceGauge(input.attendance.percentage, 70, 60)
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
${GEIST_FONT_CSS}

html, body {
  width: 210mm;
  height: 297mm;
  overflow: hidden;
  background: #ffffff;
  font-family: ${fontFamily()};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
  color: ${dark};
}

.report-card {
  width: 210mm;
  height: 297mm;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.top-stripe {
  height: 2.5mm;
  background: linear-gradient(90deg, ${pcD}, ${pc}, ${pcL});
  flex-shrink: 0;
}

.header {
  background: linear-gradient(135deg, ${pcD}, ${pc});
  padding: 3mm 8mm;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 3mm;
  position: relative;
}

.header::after {
  content: '';
  position: absolute;
  bottom: -1.5mm; left: 0; right: 0;
  height: 3mm;
  background: ${pc};
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}

.header-logo {
  width: 10mm; height: 10mm;
  border-radius: 1.5mm;
  object-fit: contain;
  background: rgba(255,255,255,0.12);
  flex-shrink: 0;
}

.header-logo-placeholder {
  width: 10mm; height: 10mm;
  border-radius: 1.5mm;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center; justify-content: center;
  flex-shrink: 0;
}

.header-logo-placeholder svg { width: 6mm; height: 6mm; fill: rgba(255,255,255,0.4); }

.header-body { flex: 1; min-width: 0; }

.header-name {
  color: ${hdrText}; font-weight: 700;
  font-size: 5mm; line-height: 1.1;
  margin-bottom: 0.5mm;
}

.header-motto {
  color: ${hdrText}; font-size: 2mm;
  opacity: 0.75; font-style: italic;
}

.header-contacts {
  color: ${hdrText}; font-size: 1.6mm;
  opacity: 0.7;
  text-align: right;
  line-height: 1.4;
  flex-shrink: 0;
  max-width: 50mm;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2mm 8mm 1.5mm;
  flex-shrink: 0;
}

.title-row h2 {
  font-size: 3.2mm; font-weight: 700;
  color: ${dark};
}

.title-row .session {
  font-size: 2mm;
  color: ${muted};
}

.student-info {
  margin: 0 8mm;
  padding: 2.5mm 3mm;
  background: #f8fafc;
  border: 0.5px solid #e2e8f0;
  border-radius: 2mm;
  display: flex;
  gap: 3mm;
  flex-shrink: 0;
}

.student-photo {
  width: 12mm; height: 12mm;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid ${pc}30;
  flex-shrink: 0;
}

.student-photo-placeholder {
  width: 12mm; height: 12mm;
  border-radius: 50%;
  background: ${pc}08;
  border: 1.5px solid ${pc}20;
  display: flex;
  align-items: center; justify-content: center;
  flex-shrink: 0;
  font-size: 4.5mm; font-weight: 700;
  color: ${pc}; opacity: 0.3;
}

.student-details {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  column-gap: 3mm;
  row-gap: 1.2mm;
}

.student-field { }

.student-field .label {
  font-size: 1.5mm;
  color: ${muted};
  font-weight: 500;
  line-height: 1.2;
}

.student-field .value {
  font-size: 1.9mm;
  color: ${dark};
  font-weight: 600;
  line-height: 1.3;
}

.section-label {
  font-size: 2.2mm;
  font-weight: 700;
  color: ${dark};
  padding: 2mm 8mm 0.8mm;
  flex-shrink: 0;
}

.academic-section {
  padding: 0 8mm;
  flex-shrink: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.subjects-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 1.6mm;
}

.subjects-table thead th {
  background: ${pc};
  color: ${hdrText};
  font-weight: 600;
  padding: 0.8mm 1mm;
  text-align: center;
  font-size: 1.5mm;
  white-space: nowrap;
}

.subjects-table thead th:first-child { border-radius: 1.5mm 0 0 0; }
.subjects-table thead th:last-child { border-radius: 0 1.5mm 0 0; }

.subjects-table tbody td {
  padding: 0.7mm 1mm;
  text-align: center;
  border-bottom: 0.3px solid #e2e8f0;
  font-size: 1.6mm;
}

.subjects-table tbody tr:nth-child(even) td {
  background: #f8fafc;
}

.subjects-table tbody tr:last-child td:first-child { border-radius: 0 0 0 1.5mm; }
.subjects-table tbody tr:last-child td:last-child { border-radius: 0 0 1.5mm 0; }

.grade-cell {
  font-weight: 700;
}

.remark-cell {
  font-size: 1.4mm;
  text-align: left;
}

.table-empty {
  padding: 6mm 0;
  text-align: center;
  color: #dc2626;
  font-size: 2mm;
  font-style: italic;
  background: #fef2f2;
  border-radius: 2mm;
  border: 0.5px solid #fecaca;
}

.summary-bar {
  margin: 1.5mm 8mm;
  padding: 2.5mm 3mm;
  background: #f0fdf4;
  border: 0.5px solid #bbf7d0;
  border-radius: 2mm;
  display: flex;
  flex-shrink: 0;
}

.summary-item {
  flex: 1;
  text-align: center;
}

.summary-item .label {
  font-size: 1.6mm;
  color: ${muted};
  font-weight: 500;
}

.summary-item .value {
  font-size: 2.8mm;
  font-weight: 700;
  color: ${dark};
  margin-top: 0.3mm;
}

.summary-item .value.grade-highlight {
  color: ${pc};
}

.chart-section {
  margin: 0 8mm;
  flex-shrink: 0;
}

.chart-section svg {
  width: 100%;
  height: auto;
  display: block;
}

.domains-section {
  margin: 0 8mm;
  flex-shrink: 0;
}

.domain-row {
  display: flex;
  gap: 2mm;
}

.domain-col {
  flex: 1;
  background: #f8fafc;
  border: 0.3px solid #e2e8f0;
  border-radius: 1.5mm;
  padding: 1.5mm 1.5mm;
}

.domain-col-title {
  font-size: 1.7mm;
  font-weight: 700;
  color: ${dark};
  margin-bottom: 0.8mm;
}

.domain-trait {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3mm 0;
  font-size: 1.4mm;
}

.domain-trait-label {
  color: ${muted};
}

.domain-badge {
  font-size: 1.1mm;
  font-weight: 700;
  padding: 0.2mm 1.2mm;
  border-radius: 2mm;
  white-space: nowrap;
}

.domain-badge--na {
  background: #f1f5f9;
  color: #94a3b8;
}

.attendance-section {
  margin: 0 8mm;
  padding: 2mm 3mm;
  background: #f8fafc;
  border: 0.3px solid #e2e8f0;
  border-radius: 2mm;
  display: flex;
  align-items: center;
  gap: 3mm;
  flex-shrink: 0;
}

.attendance-section svg {
  flex-shrink: 0;
}

.attendance-stats {
  flex: 1;
  display: flex;
}

.attendance-stat {
  flex: 1;
  text-align: center;
}

.attendance-stat .label {
  font-size: 1.5mm;
  color: ${muted};
  font-weight: 500;
}

.attendance-stat .value {
  font-size: 2.5mm;
  font-weight: 700;
  color: ${dark};
  margin-top: 0.2mm;
}

.remarks-section {
  margin: 0 8mm;
  flex-shrink: 0;
}

.remark-block {
  background: #f8fafc;
  border: 0.3px solid #e2e8f0;
  border-radius: 1.5mm;
  padding: 1.5mm 2mm;
  margin-bottom: 1.5mm;
}

.remark-header {
  font-size: 1.6mm;
  font-weight: 700;
  color: ${dark};
  margin-bottom: 0.5mm;
}

.remark-text {
  font-size: 1.6mm;
  color: #475569;
  line-height: 1.45;
}

.remark-signature {
  font-size: 1.3mm;
  color: ${muted};
  text-align: right;
  margin-top: 0.5mm;
}

.signatures-row {
  margin: 1mm 8mm;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
  padding-top: 1mm;
  border-top: 0.3px solid #e2e8f0;
}

.signature-field {
  font-size: 1.6mm;
  color: ${muted};
}

.footer {
  margin-top: auto;
  padding: 2mm 8mm;
  border-top: 0.3px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  font-size: 1.5mm;
  color: ${muted};
}

.watermark {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 14mm; font-weight: 900;
  color: ${pc}; opacity: 0.035;
  white-space: nowrap;
  pointer-events: none;
  letter-spacing: 3mm;
  text-transform: uppercase;
  z-index: 0;
}

.no-data-message {
  color: #dc2626;
  font-size: 1.8mm;
  font-style: italic;
  padding: 3mm 0;
  text-align: center;
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
    : `<div class="header-logo-placeholder"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>`}
  <div class="header-body">
    <div class="header-name">${esc(input.school.name)}</div>
    ${input.school.motto ? `<div class="header-motto">${esc(input.school.motto)}</div>` : ''}
  </div>
  <div class="header-contacts">
    ${[input.school.address, input.school.phone, input.school.email].filter(Boolean).join('<br/>')}
  </div>
</div>

<div class="title-row">
  <h2>${esc(input.term.name)} Term Students Report</h2>
  <span class="session">Session: ${esc(input.settings.academicSession || 'N/A')}</span>
</div>

<div class="student-info">
  ${input.student.photoBase64
    ? `<img class="student-photo" src="${esc(input.student.photoBase64)}" alt="Photo"/>`
    : `<div class="student-photo-placeholder">${(input.student.name || 'U')[0].toUpperCase()}</div>`}
  <div class="student-details">
    <div class="student-field"><span class="label">Name</span><div class="value">${esc(input.student.name)}</div></div>
    <div class="student-field"><span class="label">Admission No</span><div class="value">${esc(input.student.admissionNo)}</div></div>
    <div class="student-field"><span class="label">Class</span><div class="value">${esc(input.cls.name)}${input.cls.section ? ' · ' + esc(input.cls.section) : ''}</div></div>
    <div class="student-field"><span class="label">Gender</span><div class="value">${esc(input.student.gender || '—')}</div></div>
    <div class="student-field"><span class="label">Date of Birth</span><div class="value">${esc(input.student.dateOfBirth || '—')}</div></div>
    <div class="student-field"><span class="label">Term</span><div class="value">${esc(input.term.name)} Term</div></div>
    <div class="student-field"><span class="label">Age</span><div class="value">${esc(input.student.age || '—')}</div></div>
    <div class="student-field"><span class="label">Parents</span><div class="value">${esc(input.student.parents || '—')}</div></div>
    <div class="student-field"><span class="label">Session</span><div class="value">${esc(input.settings.academicSession || '—')}</div></div>
  </div>
</div>

<div class="section-label">Academic Performance</div>

<div class="academic-section">
${hasNoScores
  ? `<div class="no-data-message">No assessment data available yet</div>`
  : `<table class="subjects-table">
  <thead>
    <tr>
      <th style="width:5mm">#</th>
      <th style="text-align:left">Subject</th>
      <th style="width:7mm">CA 1</th>
      <th style="width:7mm">CA 2</th>
      <th style="width:7mm">Assign.</th>
      <th style="width:7mm">Project</th>
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
        <td style="text-align:left;font-weight:500">${esc(r.subjectName)}</td>
        <td>${getScoreDisplay(r.scoresByType, 'ca1', String(Math.round(r.caScore)))}</td>
        <td>${getScoreDisplay(r.scoresByType, 'ca2')}</td>
        <td>${getScoreDisplay(r.scoresByType, 'assignment')}</td>
        <td>${getScoreDisplay(r.scoresByType, 'project')}</td>
        <td style="font-weight:600">${n(r.total)}</td>
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
    <div class="value">${hasNoScores ? '—' : n(input.totals.grandTotal)}</div>
  </div>
  <div class="summary-item">
    <div class="label">Average</div>
    <div class="value">${hasNoScores ? '—' : n(input.totals.averageScore) + '%'}</div>
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

${chartSvg ? `
<div class="section-label">Performance Chart</div>
<div class="chart-section">
  ${chartSvg}
</div>` : ''}

${(input.showDomains !== false && input.domainGrade) ? buildDomainsHTML(input.domainGrade, pc, dark, muted) : ''}

${attSvg ? `
<div class="section-label">Attendance</div>
<div class="attendance-section">
  ${attSvg}
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
    <div class="attendance-stat">
      <div class="label">Attendance %</div>
      <div class="value">${input.attendance.percentage}%</div>
    </div>
  </div>
</div>` : ''}

<div class="section-label">Remarks</div>
<div class="remarks-section">
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
</div>

<div class="signatures-row">
  <span class="signature-field">Class Teacher: _________________</span>
  <span class="signature-field">Principal: _________________</span>
</div>

<div class="footer">
  <span>Generated by Skoolar · ${todayStr()}</span>
  ${input.settings.nextTermBegins ? `<span>Next Term Begins: ${esc(input.settings.nextTermBegins)}</span>` : ''}
</div>

</div>
</body>
</html>`;
}

function buildDomainsHTML(domainGrade: DomainData, pc: string, dark: string, muted: string): string {
  const domainGroups: { title: string; traits: { key: string; label: string; value: string | null }[] }[] = [];

  if (domainGrade.cognitive && Object.keys(domainGrade.cognitive).length > 0) {
    domainGroups.push({
      title: 'Cognitive Domain',
      traits: Object.entries(domainGrade.cognitive)
        .filter(([k]) => k !== 'average')
        .map(([k, v]) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
    });
  }
  if (domainGrade.psychomotor && Object.keys(domainGrade.psychomotor).length > 0) {
    domainGroups.push({
      title: 'Psychomotor Domain',
      traits: Object.entries(domainGrade.psychomotor)
        .filter(([k]) => k !== 'average')
        .map(([k, v]) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
    });
  }
  if (domainGrade.affective && Object.keys(domainGrade.affective).length > 0) {
    domainGroups.push({
      title: 'Affective Domain',
      traits: Object.entries(domainGrade.affective)
        .filter(([k]) => k !== 'average')
        .map(([k, v]) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value: v })),
    });
  }

  if (domainGroups.length === 0) return '';

  return `
<div class="section-label">Domain Assessment</div>
<div class="domains-section">
  <div class="domain-row">
    ${domainGroups.map(dg => `
    <div class="domain-col">
      <div class="domain-col-title">${esc(dg.title)}</div>
      ${dg.traits.slice(0, 5).map(t => `
      <div class="domain-trait">
        <span class="domain-trait-label">${esc(t.label)}</span>
        ${renderRatingBadge(t.value)}
      </div>`).join('')}
    </div>`).join('')}
  </div>
</div>`;
}

export async function renderReportCardHTMLToPNG(input: ReportCardHTMLInput): Promise<Buffer> {
  const html = await renderReportCardHTML(input);
  const browser = await getBrowser();
  const page = await browser.newPage();

  const dpi = 300;
  const pxW = Math.round((210 / 25.4) * dpi);
  const pxH = Math.round((297 / 25.4) * dpi);

  await page.setViewport({
    width: pxW,
    height: pxH,
    deviceScaleFactor: 2,
  });

  try {
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 30000,
    });
    await page.waitForSelector('.report-card', { timeout: 10000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
  } catch (err) {
    await safeClose(page);
    throw err;
  }

  const element = await page.$('.report-card');
  if (!element) {
    await safeClose(page);
    throw new Error('Report card element not found');
  }

  const clip = await element.boundingBox();
  if (!clip) {
    await safeClose(page);
    throw new Error('Could not get report card bounding box');
  }

  const screenshot = await page.screenshot({
    type: 'png',
    clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height },
    optimizeForSpeed: false,
  });

  await safeClose(page);

  if (screenshot.length < 100) {
    throw new Error('Screenshot too small, rendering likely failed');
  }

  return Buffer.from(screenshot);
}
