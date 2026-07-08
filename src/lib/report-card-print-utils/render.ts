import {
  type ReportCardPrintConfig,
  type ReportCardTemplateId,
  type CalculatedStudent,
  type CalculatedSubject,
  type CalculatedDomain,
  A4_USABLE_HEIGHT,
  GRADE_BOUNDARIES,
} from './types';
import { calculateAllStudents } from './calculations';
import { generateSubjectBarChart, generateRadarChart } from './render-charts';

const esc = (s: string | number | null | undefined): string => {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

function gradeColor(grade: string): string {
  const g = GRADE_BOUNDARIES.find((b) => b.grade === grade);
  return g ? g.color : '#6b7280';
}

function gradeBgColor(grade: string): string {
  const g = GRADE_BOUNDARIES.find((b) => b.grade === grade);
  return g ? g.bgColor : '#f8fafc';
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

function todayStr(): string {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function estimateContentHeight(config: ReportCardPrintConfig): number {
  const rowH = config.fontSize >= 9 ? 5 : 4;
  const headerH = 22;
  const infoH = 16;
  const tableH = (config.subjects || []).length * rowH + 6;
  const summaryH = 14;
  const chartH = (config.showChart || config.showRadar) ? 52 : 0;
  const domainH = config.showDomains && (config.domains || []).length > 0
    ? (config.domains || []).reduce((s, d) => s + 10 + ((d.traits || []).length * 3.5), 0)
    : 0;
  const commentH = (config.showTeacherComment || config.showPrincipalComment) ? 22 : 0;
  const signatureH = config.showSignature ? 10 : 0;
  const footerH = 8;
  const buffer = 5;
  return headerH + infoH + tableH + summaryH + chartH + domainH + commentH + signatureH + footerH + buffer;
}

function renderHTMLWrap(content: string, style: string, scale: number): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Report Card</title>
<style>${style}</style></head><body><div class="report-card-wrap" style="transform:scale(${scale.toFixed(3)});transform-origin:top center;width:${100 / scale}%">${content}</div></body></html>`;
}

function renderHeader(config: ReportCardPrintConfig, cssVars: Record<string, string>): string {
  const logo = config.showLogo && config.schoolLogoDataUrl
    ? `<img class="logo" src="${esc(config.schoolLogoDataUrl)}" alt=""/>`
    : '';

  const contactParts: string[] = [];
  if (config.schoolAddress) contactParts.push(esc(config.schoolAddress));
  if (config.schoolPhone) contactParts.push(`Tel: ${esc(config.schoolPhone)}`);
  if (config.schoolEmail) contactParts.push(`Email: ${esc(config.schoolEmail)}`);
  if (config.schoolWebsite) contactParts.push(esc(config.schoolWebsite));
  const contactLine = contactParts.length > 0 ? contactParts.join(' &nbsp;|&nbsp; ') : '';

  return `<div class="header">
    <div class="header-top">
      ${logo}
      <div class="header-text">
        <div class="school-name">${esc(config.schoolName || 'School Name')}</div>
        ${config.schoolMotto ? `<div class="school-motto">${esc(config.schoolMotto)}</div>` : ''}
        <div class="school-address">${contactLine}</div>
      </div>
    </div>
    <div class="report-title">REPORT OF PROGRESS</div>
  </div>`;
}

function renderStudentInfo(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  const photo = config.showStudentPhoto && student.photoDataUrl
    ? `<div class="photo-wrap"><img class="student-photo" src="${esc(student.photoDataUrl)}" alt=""/></div>`
    : '';

  const att = student.attendance || { present: 0, absent: 0, total: 0 };
  const attStr = att.total > 0 ? `${att.present} out of ${att.total}` : `P:${att.present} A:${att.absent}`;

  return `<div class="student-info">
    <div class="info-fields">
      <div class="field"><span class="label">Name:</span><span class="value">${esc(student.name)}</span></div>
      <div class="field"><span class="label">Admission No:</span><span class="value">${esc(student.admissionNo)}</span></div>
      <div class="field"><span class="label">Class:</span><span class="value">${esc(config.className)}</span></div>
      <div class="field"><span class="label">Term:</span><span class="value">${esc(config.termLabel)}</span></div>
      <div class="field"><span class="label">Session:</span><span class="value">${esc(config.sessionLabel)}</span></div>
      <div class="field"><span class="label">Attendance:</span><span class="value">${esc(attStr)}</span></div>
    </div>
    ${photo}
  </div>`;
}

function renderTable(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  const scoreCols = (config.scoreTypes || []).filter(st => {
    return student.subjects.some(sub => typeof sub.scores[st.id] === 'number');
  });

  const rows = student.subjects.map((sub, i) => {
    const c = gradeColor(sub.grade);
    const bg = gradeBgColor(sub.grade);
    return `<tr>
      <td class="cell-sn">${i + 1}</td>
      <td class="cell-subj">${esc(sub.name)}</td>
      ${scoreCols.map(st => {
        const val = sub.scores[st.id];
        return typeof val === 'number' ? `<td class="cell-score">${val}</td>` : `<td class="cell-score na">—</td>`;
      }).join('')}
      <td class="cell-total"><strong>${esc(sub.total)}</strong></td>
      <td class="cell-pct">${esc(sub.percentage)}%</td>
      <td class="cell-grade"><span class="grade-badge" style="background:${bg};color:${c}">${esc(sub.grade)}</span></td>
      <td class="cell-remark">${esc(sub.remark)}</td>
    </tr>`;
  }).join('');

  const colHeaders = scoreCols.map(st => `<th>${esc(st.label)}</th>`).join('');
  const maxTotal = scoreCols.reduce((s, st) => s + (st.includeInTotal ? st.maxScore : 0), 0);

  return `<div class="table-section">
    <table class="subjects-table">
      <thead><tr>
        <th class="col-sn">#</th>
        <th class="col-subj">Subject</th>
        ${colHeaders}
        <th class="col-total">Total<br/><span class="th-sub">/${esc(maxTotal)}</span></th>
        <th class="col-pct">%</th>
        <th class="col-grade">Grade</th>
        <th class="col-remark">Remark</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderSummary(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  const posColor = student.averagePercentage >= 70 ? '#059669' : student.averagePercentage >= 50 ? '#d97706' : '#dc2626';
  const posLabel = student.averagePercentage >= 50 ? 'PASS' : 'FAIL';

  return `<div class="summary-bar">
    <div class="summary-item">
      <span class="sum-label">Grand Total</span>
      <span class="sum-value">${esc(student.grandTotal)}</span>
    </div>
    <div class="summary-item">
      <span class="sum-label">Average</span>
      <span class="sum-value">${esc(student.averagePercentage)}%</span>
    </div>
    <div class="summary-item">
      <span class="sum-label">Grade</span>
      <span class="sum-value grade-large" style="color:${gradeColor(student.overallGrade)}">${esc(student.overallGrade)}</span>
    </div>
    ${config.showPosition ? `<div class="summary-item">
      <span class="sum-label">Position</span>
      <span class="sum-value">${esc(student.position)}/${esc(student.totalStudents)}</span>
    </div>` : ''}
    <div class="summary-item">
      <span class="sum-label">Status</span>
      <span class="sum-value" style="color:${posColor}">${posLabel}</span>
    </div>
  </div>`;
}

function renderCharts(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  if (!config.showChart && !config.showRadar) return '';
  if (student.subjects.length < 2) return '';

  const barChart = config.showChart ? generateSubjectBarChart(student.subjects, config.primaryColor) : '';
  const radarChart = config.showRadar ? generateRadarChart(student.subjects, config.primaryColor) : '';

  if (!barChart && !radarChart) return '';

  return `<div class="charts-section">
    ${config.showChart && barChart ? `<div class="chart-block"><div class="section-label">Performance by Subject</div>${barChart}</div>` : ''}
    ${config.showRadar && radarChart ? `<div class="chart-block"><div class="section-label">Performance Radar</div>${radarChart}</div>` : ''}
  </div>`;
}

function renderDomains(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  if (!config.showDomains || student.domains.length === 0) return '';
  const blocks = student.domains.filter(d => (d.traits || []).length > 0).map(dom => {
    const domTraits = dom.traits || [];
    const traitRows = domTraits.map(t => {
      const pct = t.maxScore > 0 && typeof t.score === 'number' ? Math.round((t.score / t.maxScore) * 100) : 0;
      const { grade, color, bgColor } = pct > 0
        ? (GRADE_BOUNDARIES.find(b => pct >= b.min && pct <= b.max) || { grade: '-', color: '#94a3b8', bgColor: '#f8fafc' })
        : { grade: '-', color: '#94a3b8', bgColor: '#f8fafc' };
      const scoreStr = typeof t.score === 'number' ? `${t.score}/${t.maxScore}` : '—';
      return `<tr>
        <td class="cell-domain-trait">${esc(t.label)}</td>
        <td class="cell-score cell-score-center">${scoreStr}</td>
        <td class="cell-pct">${pct > 0 ? pct + '%' : '—'}</td>
        <td class="cell-grade"><span class="grade-badge" style="background:${bgColor};color:${color}">${esc(grade)}</span></td>
      </tr>`;
    }).join('');
    const { grade, color, bgColor } = GRADE_BOUNDARIES.find(b => dom.grade === b.grade) || { grade: '-', color: '#94a3b8', bgColor: '#f8fafc' };
    return `<div class="domain-block">
      <div class="domain-name">${esc(dom.name)} <span class="domain-avg">Avg: ${dom.average}% <span class="grade-badge" style="background:${bgColor};color:${color}">${esc(grade)}</span></span></div>
      <table class="subjects-table domain-traits-table">
        <thead><tr>
          <th class="col-domain-trait">Trait</th>
          <th class="col-score-sm">Score</th>
          <th class="col-pct">%</th>
          <th class="col-grade">Grade</th>
        </tr></thead>
        <tbody>${traitRows}</tbody>
      </table>
    </div>`;
  }).join('');
  if (!blocks) return '';
  return `<div class="domains-section">
    <div class="section-label">Learning Domains</div>
    ${blocks}
  </div>`;
}

function renderComments(config: ReportCardPrintConfig, student?: CalculatedStudent): string {
  if (!config.showTeacherComment && !config.showPrincipalComment) return '';
  const tc = student?.teacherComment || config.teacherComment;
  const pc = student?.principalComment || config.principalComment;
  const parts: string[] = [];
  if (config.showTeacherComment && tc) {
    parts.push(`<div class="comment"><span class="comment-label">Teacher's Report:</span> ${esc(tc)}</div>`);
  }
  if (config.showPrincipalComment && pc) {
    parts.push(`<div class="comment"><span class="comment-label">Principal's Report:</span> ${esc(pc)}</div>`);
  }
  if (parts.length === 0) return '';
  return `<div class="comments-section">${parts.join('')}</div>`;
}

function renderFooter(config: ReportCardPrintConfig): string {
  const signatures = config.showSignature ? `<div class="signatures">
    <div class="sig-line">Class Teacher: <span class="sig-space">_________________</span></div>
    <div class="sig-line">Principal: <span class="sig-space">_________________</span></div>
    <div class="sig-line">Parent/Guardian: <span class="sig-space">_________________</span></div>
  </div>` : '';

  const nextTerm = config.nextTermBegins
    ? `<span>Next Term Begins: ${esc(config.nextTermBegins)}</span>`
    : '';

  return `<div class="footer">
    ${signatures}
    <div class="footer-info">
      <span>${todayStr()}</span>
      ${nextTerm}
      <span class="powered">Skoolar</span>
    </div>
  </div>`;
}

function estimateScale(config: ReportCardPrintConfig): number {
  const est = estimateContentHeight(config);
  return Math.min(1, Math.max(0.5, A4_USABLE_HEIGHT / est));
}

// ─── TEMPLATES ──────────────────────────────────────────

function classicCSS(config: ReportCardPrintConfig): string {
  const pc = config.primaryColor;
  const sc = config.secondaryColor || adjustColor(pc, 40);
  const bg = config.backgroundColor;
  const tc = config.textColor;
  const fs = config.fontSize;

  return `
    @page{size:A4;margin:8mm 10mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:${fs}pt;color:${tc};background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-card-wrap{max-width:190mm;margin:0 auto;background:${bg}}
    .header{background:linear-gradient(135deg,${pc},${adjustColor(pc,-20)});padding:3mm 4mm;color:#fff;border-radius:2mm 2mm 0 0}
    .header-top{display:flex;align-items:center;gap:2.5mm}
    .logo{width:10mm;height:10mm;object-fit:contain;border-radius:1mm;background:rgba(255,255,255,0.15);padding:0.5mm}
    .header-text{flex:1;text-align:center}
    .school-name{font-size:14pt;font-weight:700;letter-spacing:0.3pt}
    .school-motto{font-size:6.5pt;font-style:italic;opacity:0.8;margin-top:0.3mm}
    .school-address{font-size:6pt;opacity:0.7;margin-top:0.2mm}
    .report-title{text-align:center;font-size:9pt;font-weight:600;letter-spacing:1.5pt;margin-top:1.2mm;padding:0.5mm;border-top:1px solid rgba(255,255,255,0.2)}
    .student-info{display:flex;gap:2mm;padding:2mm 3mm;background:#f8fafc;border:1px solid #e2e8f0;border-top:none}
    .info-fields{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.5mm 3mm}
    .field .label{font-size:${fs * 0.85}pt;color:#64748b;font-weight:500;margin-right:1mm}
    .field .value{font-size:${fs}pt;font-weight:600;color:${tc}}
    .photo-wrap{flex-shrink:0}
    .student-photo{width:14mm;height:16mm;object-fit:cover;border:2px solid ${pc}40;border-radius:1mm}
    .table-section{padding:1.5mm 3mm}
    .subjects-table{width:100%;border-collapse:collapse;font-size:${fs}pt}
    .subjects-table th{background:${pc};color:#fff;font-weight:600;padding:0.6mm 0.8mm;text-align:center;font-size:${fs * 0.85}pt;white-space:nowrap}
    .subjects-table th:first-child{border-radius:1mm 0 0 0}
    .subjects-table th:last-child{border-radius:0 1mm 0 0}
    .subjects-table td{padding:0.4mm 0.6mm;text-align:center;border-bottom:0.5pt solid #e2e8f0;font-size:${fs * 0.9}pt}
    .subjects-table tr:nth-child(even) td{background:#f8fafc}
    .col-sn{width:5mm}
    .col-subj{text-align:left;min-width:22mm}
    .col-total{width:10mm}
    .col-pct{width:8mm}
    .col-grade{width:8mm}
    .col-remark{text-align:left;width:14mm;font-size:${fs * 0.8}pt;color:#64748b}
    .cell-subj{text-align:left;font-weight:600}
    .cell-score{font-size:${fs * 0.85}pt}
    .cell-score.na{color:#cbd5e1}
    .cell-total{font-weight:600}
    .grade-badge{display:inline-block;padding:0.2mm 1.5mm;border-radius:1.5mm;font-size:${fs * 0.85}pt;font-weight:700;line-height:1.4;min-width:6mm}
    .th-sub{font-weight:400;font-size:${fs * 0.7}pt}
    .summary-bar{display:grid;grid-template-columns:repeat(5,1fr);gap:0.5mm;padding:1.5mm 3mm;margin:0 3mm;background:linear-gradient(135deg,${pc}08,${pc}03);border:1px solid ${pc}30;border-radius:1.5mm}
    .summary-item{text-align:center}
    .sum-label{display:block;font-size:${fs * 0.75}pt;color:#64748b;font-weight:500}
    .sum-value{font-size:${fs * 1.2}pt;font-weight:700;color:${tc}}
    .grade-large{font-size:${fs * 1.5}pt}
    .charts-section{padding:2mm 3mm}
    .section-label{font-size:${fs * 0.9}pt;font-weight:600;color:${pc};margin-bottom:1mm;border-bottom:1.5px solid ${pc}30;padding-bottom:0.3mm}
    .chart-block{margin-bottom:2mm}
    .chart-block svg{width:100%;height:auto;display:block}
    .domains-section{padding:1.5mm 3mm}
    .domain-block{margin-bottom:1.5mm;background:${pc}04;border-radius:1mm;padding:1mm 1.5mm}
    .domain-name{font-size:${fs * 0.85}pt;font-weight:700;color:${pc};margin-bottom:0.5mm;display:flex;justify-content:space-between;align-items:center}
    .domain-avg{font-size:${fs * 0.75}pt;font-weight:500;color:#64748b;display:flex;align-items:center;gap:1mm}
    .domain-traits-table{font-size:${fs * 0.8}pt;width:100%;border-collapse:collapse}
    .domain-traits-table th{background:transparent;color:${tc};font-weight:600;padding:0.3mm 0.5mm;text-align:center;font-size:${fs * 0.75}pt;border-bottom:0.5pt solid #e2e8f0}
    .domain-traits-table td{padding:0.2mm 0.5mm;text-align:center;font-size:${fs * 0.8}pt}
    .cell-domain-trait{text-align:left;font-weight:500}
    .cell-score-center{text-align:center}
    .comments-section{padding:1.5mm 3mm}
    .comment{font-size:${fs * 0.85}pt;color:#475569;line-height:1.5;margin-bottom:1mm;padding:1mm;background:#f8fafc;border-left:2.5px solid ${pc};border-radius:0 1mm 1mm 0}
    .comment-label{font-weight:700;color:${tc}}
    .footer{padding:1.5mm 3mm 0;border-top:1pt solid #e2e8f0}
    .signatures{display:flex;justify-content:space-between;font-size:${fs * 0.85}pt;color:#475569;margin-bottom:1mm}
    .sig-space{display:inline-block;min-width:30mm;border-bottom:1px solid #94a3b8}
    .footer-info{display:flex;justify-content:space-between;font-size:${fs * 0.7}pt;color:#94a3b8;padding:0.5mm 0}
    .powered{opacity:0.5}
  `;
}

function renderClassic(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  const content = `
    ${renderHeader(config, {})}
    ${renderStudentInfo(config, student)}
    ${renderTable(config, student)}
    ${renderSummary(config, student)}
    ${renderCharts(config, student)}
    ${renderDomains(config, student)}
    ${renderComments(config, student)}
    ${renderFooter(config)}
  `;
  const scale = estimateScale(config);
  return renderHTMLWrap(content, classicCSS(config), scale);
}

// ─── MODERN ────────────────────────────────────────────

function modernCSS(config: ReportCardPrintConfig): string {
  const pc = config.primaryColor || '#0d9488';
  const sc = config.secondaryColor || adjustColor(pc, 40);
  const bg = config.backgroundColor || '#ffffff';
  const tc = config.textColor;
  const fs = config.fontSize;

  return `
    @page{size:A4;margin:8mm 10mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:${fs}pt;color:${tc};background:${adjustColor(bg, -8)};-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-card-wrap{max-width:190mm;margin:0 auto;background:${bg};border-radius:3mm;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
    .header{background:linear-gradient(135deg,${pc},${adjustColor(pc, -20)});padding:4mm 5mm;color:#fff}
    .header-top{display:flex;align-items:center;gap:3mm}
    .logo{width:11mm;height:11mm;object-fit:contain;border-radius:2mm;background:rgba(255,255,255,0.2);padding:1mm}
    .header-text{flex:1;text-align:center}
    .school-name{font-size:15pt;font-weight:700}
    .school-motto{font-size:7pt;font-style:italic;opacity:0.75;margin-top:0.5mm}
    .school-address{font-size:6pt;opacity:0.6;margin-top:0.3mm}
    .report-title{text-align:center;font-size:9pt;font-weight:600;letter-spacing:2pt;margin-top:1.5mm;padding:0.8mm;border-top:1px solid rgba(255,255,255,0.15)}
    .student-info{display:flex;gap:2.5mm;padding:2.5mm 4mm;background:${bg};border-bottom:1px solid #e2e8f0}
    .info-fields{flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5mm 2mm}
    .field .label{font-size:${fs * 0.8}pt;color:#94a3b8;font-weight:500;text-transform:uppercase;letter-spacing:0.3pt}
    .field .value{font-size:${fs}pt;font-weight:600;color:${tc}}
    .photo-wrap{flex-shrink:0;text-align:center}
    .student-photo{width:14mm;height:17mm;object-fit:cover;border-radius:2mm;border:2px solid ${pc}30}
    .table-section{padding:2mm 4mm}
    .subjects-table{width:100%;border-collapse:separate;border-spacing:0;font-size:${fs}pt;border-radius:2mm;overflow:hidden}
    .subjects-table th{background:${pc};color:#fff;font-weight:600;padding:0.7mm 1mm;text-align:center;font-size:${fs * 0.8}pt}
    .subjects-table td{padding:0.5mm 0.8mm;text-align:center;border-bottom:0.5pt solid #f1f5f9;font-size:${fs * 0.85}pt}
    .subjects-table tr:last-child td{border-bottom:none}
    .subjects-table tbody tr{transition:background 0.15s}
    .subjects-table tbody tr:hover td{background:${pc}08}
    .col-sn{width:5mm}
    .col-subj{text-align:left;min-width:22mm}
    .cell-subj{text-align:left;font-weight:600}
    .cell-score{font-size:${fs * 0.8}pt}
    .cell-score.na{color:#e2e8f0}
    .grade-badge{display:inline-block;padding:0.3mm 2mm;border-radius:2mm;font-size:${fs * 0.8}pt;font-weight:700;line-height:1.4;min-width:7mm}
    .summary-bar{display:grid;grid-template-columns:repeat(5,1fr);gap:1.5mm;padding:2mm 4mm;margin:0 4mm;background:linear-gradient(135deg,${pc}15,${pc}08);border:1px solid ${pc}30;border-radius:2mm}
    .summary-item{text-align:center;padding:0.5mm}
    .sum-label{display:block;font-size:${fs * 0.7}pt;color:#64748b;font-weight:500;text-transform:uppercase}
    .sum-value{font-size:${fs * 1.3}pt;font-weight:700;color:${tc}}
    .grade-large{font-size:${fs * 1.6}pt}
    .charts-section{padding:2mm 4mm}
    .section-label{font-size:${fs * 0.9}pt;font-weight:600;color:${pc};margin-bottom:1.5mm;padding-bottom:0.5mm;border-bottom:2px solid ${pc}30}
    .chart-block{margin-bottom:2mm;padding:1.5mm;background:${pc}05;border-radius:2mm}
    .domains-section{padding:2mm 4mm}
    .domain-block{margin-bottom:2mm;background:${pc}04;border-radius:2mm;padding:1.5mm 2mm}
    .domain-name{font-size:${fs * 0.85}pt;font-weight:700;color:${pc};margin-bottom:0.5mm;display:flex;justify-content:space-between;align-items:center}
    .domain-avg{font-size:${fs * 0.75}pt;font-weight:500;color:#64748b;display:flex;align-items:center;gap:1mm}
    .domain-traits-table{font-size:${fs * 0.8}pt;width:100%;border-collapse:collapse}
    .domain-traits-table th{background:transparent;color:${tc};font-weight:600;padding:0.3mm 0.5mm;text-align:center;font-size:${fs * 0.75}pt;border-bottom:0.5pt solid #e2e8f0}
    .domain-traits-table td{padding:0.2mm 0.5mm;text-align:center;font-size:${fs * 0.8}pt}
    .cell-domain-trait{text-align:left;font-weight:500}
    .cell-score-center{text-align:center}
    .comments-section{padding:2mm 4mm}
    .comment{font-size:${fs * 0.85}pt;color:#475569;line-height:1.5;margin-bottom:1.5mm;padding:1.5mm 2mm;background:${pc}08;border-radius:2mm;border:1px solid ${pc}25}
    .comment-label{font-weight:700;color:${pc}}
    .footer{padding:2mm 4mm 1.5mm;border-top:1px solid #e2e8f0;background:${adjustColor(bg, -3)}}
    .signatures{display:flex;justify-content:space-between;font-size:${fs * 0.85}pt;color:#475569;margin-bottom:1mm}
    .sig-space{display:inline-block;min-width:28mm;border-bottom:1px solid #94a3b8;margin-left:2mm}
    .footer-info{display:flex;justify-content:space-between;font-size:${fs * 0.7}pt;color:#94a3b8;padding:0.5mm 0}
    .powered{opacity:0.5}
  `;
}

function renderModern(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  const content = `
    ${renderHeader(config, {})}
    ${renderStudentInfo(config, student)}
    ${renderTable(config, student)}
    ${renderSummary(config, student)}
    ${renderCharts(config, student)}
    ${renderDomains(config, student)}
    ${renderComments(config, student)}
    ${renderFooter(config)}
  `;
  const scale = estimateScale(config);
  return renderHTMLWrap(content, modernCSS(config), scale);
}

// ─── VIBRANT ───────────────────────────────────────────

function vibrantCSS(config: ReportCardPrintConfig): string {
  const pc = config.primaryColor || '#ea580c';
  const sc = config.secondaryColor || adjustColor(pc, 60);
  const bg = config.backgroundColor || '#ffffff';
  const tc = config.textColor;
  const fs = config.fontSize;

  return `
    @page{size:A4;margin:8mm 10mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:${fs}pt;color:${tc};background:${adjustColor(bg, -5)};-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-card-wrap{max-width:190mm;margin:0 auto;background:${bg};border-radius:2mm;overflow:hidden;border:2px solid ${sc}80}
    .header{background:linear-gradient(135deg,${pc},${adjustColor(pc,-20)});padding:3.5mm 4mm;color:#fff;position:relative;overflow:hidden}
    .header::after{content:'';position:absolute;top:-10mm;right:-10mm;width:25mm;height:25mm;background:rgba(255,255,255,0.06);border-radius:50%}
    .header::before{content:'';position:absolute;bottom:-15mm;left:-5mm;width:30mm;height:30mm;background:rgba(255,255,255,0.04);border-radius:50%}
    .header-top{display:flex;align-items:center;gap:3mm;position:relative;z-index:1}
    .logo{width:12mm;height:12mm;object-fit:contain;border-radius:50%;background:rgba(255,255,255,0.25);padding:1mm;border:2px solid rgba(255,255,255,0.3)}
    .header-text{flex:1;text-align:center}
    .school-name{font-size:16pt;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,0.1)}
    .school-motto{font-size:7pt;font-style:italic;opacity:0.85;margin-top:0.5mm}
    .school-address{font-size:6.5pt;opacity:0.7;margin-top:0.3mm}
    .report-title{text-align:center;font-size:10pt;font-weight:700;letter-spacing:1.5pt;margin-top:1.5mm;padding:0.8mm;border-top:2px solid rgba(255,255,255,0.2);position:relative;z-index:1}
    .student-info{display:flex;gap:2mm;padding:2.5mm 4mm;background:linear-gradient(135deg,${pc}10,${pc}08);border-bottom:2px solid ${sc}80}
    .info-fields{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.5mm 3mm}
    .field .label{font-size:${fs * 0.8}pt;color:${adjustColor(pc, -40)};font-weight:600;margin-right:1mm}
    .field .value{font-size:${fs}pt;font-weight:700;color:${tc}}
    .photo-wrap{flex-shrink:0;text-align:center}
    .student-photo{width:15mm;height:18mm;object-fit:cover;border-radius:2mm;border:3px solid ${sc}90;box-shadow:0 2px 6px rgba(0,0,0,0.1)}
    .table-section{padding:2mm 4mm}
    .subjects-table{width:100%;border-collapse:collapse;font-size:${fs}pt;border:2px solid ${sc}80;border-radius:2mm;overflow:hidden}
    .subjects-table th{background:linear-gradient(135deg,${pc},${adjustColor(pc,-20)});color:#fff;font-weight:700;padding:0.8mm 1mm;text-align:center;font-size:${fs * 0.85}pt}
    .subjects-table td{padding:0.5mm 0.8mm;text-align:center;border-bottom:1px solid ${sc}30;font-size:${fs * 0.9}pt}
    .subjects-table tbody tr:nth-child(even) td{background:${pc}06}
    .subjects-table tbody tr:last-child td{border-bottom:none}
    .col-sn{width:5mm}
    .col-subj{text-align:left;min-width:22mm}
    .cell-subj{text-align:left;font-weight:700}
    .cell-score{font-size:${fs * 0.85}pt;font-weight:600}
    .cell-score.na{color:${sc}80}
    .grade-badge{display:inline-block;padding:0.4mm 2.5mm;border-radius:3mm;font-size:${fs * 0.9}pt;font-weight:800;line-height:1.5;min-width:8mm;border:1px solid transparent}
    .summary-bar{display:grid;grid-template-columns:repeat(5,1fr);gap:1mm;padding:2mm 4mm;margin:0 4mm;background:linear-gradient(135deg,${pc}12,${sc}30);border-radius:2mm;border:2px solid ${sc}70}
    .summary-item{text-align:center}
    .sum-label{display:block;font-size:${fs * 0.75}pt;color:${adjustColor(pc, -40)};font-weight:600}
    .sum-value{font-size:${fs * 1.3}pt;font-weight:800;color:${tc}}
    .grade-large{font-size:${fs * 1.7}pt}
    .charts-section{padding:2mm 4mm}
    .section-label{font-size:${fs}pt;font-weight:700;color:${pc};margin-bottom:1.5mm;padding-bottom:0.5mm;border-bottom:3px solid ${sc}80}
    .chart-block{margin-bottom:2mm;padding:2mm;background:${pc}06;border-radius:2mm;border:1px solid ${sc}80}
    .domains-section{padding:2mm 4mm}
    .domain-block{margin-bottom:2mm;background:${pc}06;border-radius:2mm;padding:1.5mm 2mm;border:1px solid ${sc}40}
    .domain-name{font-size:${fs * 0.9}pt;font-weight:800;color:${pc};margin-bottom:0.5mm;display:flex;justify-content:space-between;align-items:center}
    .domain-avg{font-size:${fs * 0.75}pt;font-weight:500;color:${adjustColor(pc, -40)};display:flex;align-items:center;gap:1mm}
    .domain-traits-table{font-size:${fs * 0.85}pt;width:100%;border-collapse:collapse}
    .domain-traits-table th{background:transparent;color:${tc};font-weight:700;padding:0.3mm 0.5mm;text-align:center;font-size:${fs * 0.8}pt;border-bottom:1px solid ${sc}40}
    .domain-traits-table td{padding:0.2mm 0.5mm;text-align:center;font-size:${fs * 0.85}pt}
    .cell-domain-trait{text-align:left;font-weight:600}
    .cell-score-center{text-align:center}
    .comments-section{padding:2mm 4mm}
    .comment{font-size:${fs * 0.9}pt;color:${tc};line-height:1.6;margin-bottom:1.5mm;padding:1.5mm 2mm;background:linear-gradient(135deg,${pc}08,${pc}04);border-radius:2mm;border-left:4px solid ${pc}}
    .comment-label{font-weight:800;color:${adjustColor(pc, -20)}}
    .footer{padding:2mm 4mm 1.5mm;border-top:2px solid ${sc}80;background:${pc}06}
    .signatures{display:flex;justify-content:space-between;font-size:${fs * 0.85}pt;color:${tc};margin-bottom:1mm;font-weight:500}
    .sig-space{display:inline-block;min-width:28mm;border-bottom:2px solid ${sc}70;margin-left:2mm}
    .footer-info{display:flex;justify-content:space-between;font-size:${fs * 0.7}pt;color:${adjustColor(pc, -40)};padding:0.5mm 0}
    .powered{opacity:0.5}
  `;
}

function renderVibrant(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  const content = `
    ${renderHeader(config, {})}
    ${renderStudentInfo(config, student)}
    ${renderTable(config, student)}
    ${renderSummary(config, student)}
    ${renderCharts(config, student)}
    ${renderDomains(config, student)}
    ${renderComments(config, student)}
    ${renderFooter(config)}
  `;
  const scale = estimateScale(config);
  return renderHTMLWrap(content, vibrantCSS(config), scale);
}

// ─── EXECUTIVE ─────────────────────────────────────────

function executiveCSS(config: ReportCardPrintConfig): string {
  const pc = config.primaryColor || '#1e293b';
  const gc = config.secondaryColor || adjustColor(pc, 60);
  const bg = config.backgroundColor || '#ffffff';
  const tc = config.textColor;
  const fs = config.fontSize;

  return `
    @page{size:A4;margin:8mm 10mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Georgia','Times New Roman',serif;font-size:${fs}pt;color:${tc};background:${adjustColor(bg, -3)};-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-card-wrap{max-width:190mm;margin:0 auto;background:${bg};border:1.5px solid #cbd5e1;box-shadow:0 0 20px rgba(0,0,0,0.04)}
    .header{background:linear-gradient(180deg,${pc},${adjustColor(pc,20)});padding:4mm 5mm 3mm;color:#fff;position:relative}
    .header::after{content:'';position:absolute;bottom:0;left:10%;right:10%;height:0.5mm;background:linear-gradient(90deg,transparent,${gc},transparent)}
    .header-top{display:flex;align-items:center;gap:3mm}
    .logo{width:11mm;height:11mm;object-fit:contain;border-radius:50%;background:rgba(255,255,255,0.1);padding:1mm;border:1.5px solid ${gc}60}
    .header-text{flex:1;text-align:center}
    .school-name{font-size:15pt;font-weight:700;letter-spacing:0.5pt;font-family:'Georgia',serif}
    .school-motto{font-size:7pt;font-style:italic;opacity:0.7;margin-top:0.5mm;color:#cbd5e1}
    .school-address{font-size:6pt;opacity:0.6;margin-top:0.3mm;color:#94a3b8}
    .report-title{text-align:center;font-size:10pt;font-weight:700;letter-spacing:2.5pt;margin-top:1.5mm;padding:0.8mm 0 0;color:${gc}}
    .student-info{display:flex;gap:2mm;padding:2.5mm 5mm;background:${adjustColor(bg, -2)};border-bottom:1px solid #e2e8f0}
    .info-fields{flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5mm 2mm}
    .field .label{font-size:${fs * 0.75}pt;color:#64748b;font-weight:500;font-style:italic}
    .field .value{font-size:${fs}pt;font-weight:600;color:${pc};border-bottom:1px dotted #cbd5e1;padding:0 1mm}
    .photo-wrap{flex-shrink:0}
    .student-photo{width:13mm;height:16mm;object-fit:cover;border:1.5px solid #cbd5e1;padding:0.5mm}
    .table-section{padding:2mm 5mm}
    .subjects-table{width:100%;border-collapse:collapse;font-size:${fs}pt;border:1px solid #cbd5e1}
    .subjects-table th{background:${pc};color:#fff;font-weight:600;padding:0.7mm 1mm;text-align:center;font-size:${fs * 0.8}pt;font-family:'Segoe UI',Arial,sans-serif;border:1px solid ${adjustColor(pc, -10)}}
    .subjects-table td{padding:0.5mm 0.8mm;text-align:center;border:0.5pt solid #e2e8f0;font-size:${fs * 0.85}pt;font-family:'Segoe UI',Arial,sans-serif}
    .subjects-table tbody tr:nth-child(even) td{background:${adjustColor(bg, -2)}}
    .col-sn{width:5mm}
    .col-subj{text-align:left;min-width:22mm}
    .cell-subj{text-align:left;font-weight:600}
    .cell-score{font-size:${fs * 0.8}pt}
    .cell-score.na{color:#cbd5e1}
    .grade-badge{display:inline-block;padding:0.2mm 2mm;font-size:${fs * 0.85}pt;font-weight:700;border-radius:0.5mm;min-width:7mm}
    .summary-bar{display:grid;grid-template-columns:repeat(5,1fr);gap:0.5mm;padding:2mm 4mm;margin:0 5mm;background:${adjustColor(bg, -2)};border:1px solid #cbd5e1;border-top:2px solid ${gc}}
    .summary-item{text-align:center;border-right:1px solid #e2e8f0;padding:0.5mm}
    .summary-item:last-child{border-right:none}
    .sum-label{display:block;font-size:${fs * 0.7}pt;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:0.5pt}
    .sum-value{font-size:${fs * 1.2}pt;font-weight:700;color:${pc}}
    .grade-large{font-size:${fs * 1.5}pt;color:${gc}}
    .charts-section{padding:2mm 5mm}
    .section-label{font-size:${fs * 0.9}pt;font-weight:700;color:${pc};margin-bottom:1.5mm;padding-bottom:0.5mm;border-bottom:1.5px solid ${gc}60;text-transform:uppercase;letter-spacing:0.5pt}
    .chart-block{margin-bottom:2mm;padding:1.5mm;background:${adjustColor(bg, -2)};border:1px solid #e2e8f0}
    .domains-section{padding:2mm 5mm}
    .domain-block{margin-bottom:2mm;background:${adjustColor(bg, -2)};border:1px solid #e2e8f0;padding:1.5mm 2mm}
    .domain-name{font-size:${fs * 0.85}pt;font-weight:700;color:${pc};margin-bottom:0.5mm;display:flex;justify-content:space-between;align-items:center;text-transform:uppercase;letter-spacing:0.3pt}
    .domain-avg{font-size:${fs * 0.75}pt;font-weight:500;color:#64748b;display:flex;align-items:center;gap:1mm}
    .domain-traits-table{font-size:${fs * 0.8}pt;width:100%;border-collapse:collapse}
    .domain-traits-table th{background:transparent;color:${pc};font-weight:600;padding:0.3mm 0.5mm;text-align:center;font-size:${fs * 0.75}pt;border-bottom:0.5pt solid #cbd5e1}
    .domain-traits-table td{padding:0.2mm 0.5mm;text-align:center;font-size:${fs * 0.8}pt}
    .cell-domain-trait{text-align:left;font-weight:500}
    .cell-score-center{text-align:center}
    .comments-section{padding:2mm 5mm}
    .comment{font-size:${fs * 0.85}pt;color:#475569;line-height:1.5;margin-bottom:1.5mm;padding:1.5mm 2mm;background:${adjustColor(bg, -2)};border-left:3px solid ${gc}}
    .comment-label{font-weight:700;color:${pc}}
    .footer{padding:2mm 5mm 1.5mm;border-top:1px solid #cbd5e1}
    .signatures{display:flex;justify-content:space-between;font-size:${fs * 0.85}pt;color:#475569;margin-bottom:1.5mm}
    .sig-space{display:inline-block;min-width:28mm;border-bottom:1px solid #64748b;margin-left:2mm}
    .footer-info{display:flex;justify-content:space-between;font-size:${fs * 0.7}pt;color:#94a3b8;padding:0.5mm 0;border-top:1px solid #e2e8f0;margin-top:1mm;padding-top:1mm}
    .powered{opacity:0.5}
  `;
}

function renderExecutive(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  const content = `
    ${renderHeader(config, {})}
    ${renderStudentInfo(config, student)}
    ${renderTable(config, student)}
    ${renderSummary(config, student)}
    ${renderCharts(config, student)}
    ${renderDomains(config, student)}
    ${renderComments(config, student)}
    ${renderFooter(config)}
  `;
  const scale = estimateScale(config);
  return renderHTMLWrap(content, executiveCSS(config), scale);
}

// ─── COMPACT ───────────────────────────────────────────

function compactCSS(config: ReportCardPrintConfig): string {
  const pc = config.primaryColor || '#2563eb';
  const sc = config.secondaryColor || adjustColor(pc, 40);
  const bg = config.backgroundColor || '#ffffff';
  const tc = config.textColor;
  const fs = Math.max(6, config.fontSize - 1);

  return `
    @page{size:A4;margin:6mm 8mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:${fs}pt;color:${tc};background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-card-wrap{max-width:194mm;margin:0 auto;background:${bg}}
    .header{padding:2mm 3mm;border-bottom:2px solid ${pc}}
    .header-top{display:flex;align-items:center;gap:2mm}
    .logo{width:8mm;height:8mm;object-fit:contain}
    .header-text{flex:1;text-align:center}
    .school-name{font-size:12pt;font-weight:700;color:${pc}}
    .school-motto{font-size:5.5pt;font-style:italic;color:#64748b}
    .school-address{font-size:5pt;color:#94a3b8}
    .report-title{text-align:center;font-size:7.5pt;font-weight:600;color:#475569;margin-top:0.5mm;letter-spacing:1pt}
    .student-info{display:flex;gap:1.5mm;padding:1.5mm 3mm;background:${adjustColor(bg, -3)};border-bottom:1px solid #e2e8f0}
    .info-fields{flex:1;display:flex;flex-wrap:wrap;gap:0.3mm 2mm}
    .field{font-size:${fs}pt;white-space:nowrap}
    .field .label{font-size:${fs * 0.85}pt;color:#64748b;font-weight:500}
    .field .value{font-size:${fs * 0.95}pt;font-weight:600}
    .photo-wrap{flex-shrink:0}
    .student-photo{width:10mm;height:12mm;object-fit:cover;border:1px solid #e2e8f0}
    .table-section{padding:1mm 3mm}
    .subjects-table{width:100%;border-collapse:collapse;font-size:${fs}pt}
    .subjects-table th{background:${pc};color:#fff;font-weight:600;padding:0.4mm 0.6mm;text-align:center;font-size:${fs * 0.85}pt;white-space:nowrap}
    .subjects-table td{padding:0.3mm 0.5mm;text-align:center;border-bottom:0.3pt solid #e2e8f0;font-size:${fs}pt}
    .subjects-table tr:nth-child(even) td{background:${adjustColor(bg, -3)}}
    .col-sn{width:4mm}
    .col-subj{text-align:left;min-width:18mm}
    .cell-subj{text-align:left;font-weight:600}
    .cell-score{font-size:${fs * 0.9}pt}
    .cell-score.na{color:#cbd5e1}
    .grade-badge{display:inline-block;padding:0.1mm 1.2mm;border-radius:1mm;font-size:${fs * 0.9}pt;font-weight:700}
    .summary-bar{display:grid;grid-template-columns:repeat(5,1fr);gap:0.3mm;padding:1mm 3mm;margin:0 3mm;background:${pc}08;border:1px solid ${pc}30;border-radius:1mm}
    .summary-item{text-align:center}
    .sum-label{display:block;font-size:${fs * 0.75}pt;color:#64748b;font-weight:500}
    .sum-value{font-size:${fs * 1.1}pt;font-weight:700}
    .grade-large{font-size:${fs * 1.4}pt}
    .charts-section{padding:1mm 3mm}
    .section-label{font-size:${fs * 0.85}pt;font-weight:600;color:${pc};margin-bottom:0.5mm}
    .chart-block{margin-bottom:1mm}
    .chart-block svg{width:100%;height:auto;display:block}
    .domains-section{padding:1mm 3mm}
    .domain-block{margin-bottom:1mm;background:${pc}04;border-radius:0.5mm;padding:0.8mm 1mm}
    .domain-name{font-size:${fs * 0.8}pt;font-weight:700;color:${pc};margin-bottom:0.3mm;display:flex;justify-content:space-between;align-items:center}
    .domain-avg{font-size:${fs * 0.7}pt;font-weight:500;color:#64748b;display:flex;align-items:center;gap:0.5mm}
    .domain-traits-table{font-size:${fs * 0.75}pt;width:100%;border-collapse:collapse}
    .domain-traits-table th{background:transparent;color:${tc};font-weight:600;padding:0.2mm 0.3mm;text-align:center;font-size:${fs * 0.7}pt;border-bottom:0.3pt solid #e2e8f0}
    .domain-traits-table td{padding:0.15mm 0.3mm;text-align:center;font-size:${fs * 0.75}pt}
    .cell-domain-trait{text-align:left;font-weight:500}
    .cell-score-center{text-align:center}
    .comments-section{padding:1mm 3mm}
    .comment{font-size:${fs * 0.85}pt;color:#475569;line-height:1.4;margin-bottom:1mm;padding:0.8mm 1.5mm;background:${adjustColor(bg, -3)};border-left:2px solid ${pc}}
    .comment-label{font-weight:700}
    .footer{padding:1mm 3mm 0.5mm;border-top:0.5pt solid #e2e8f0}
    .signatures{display:flex;justify-content:space-between;font-size:${fs * 0.8}pt;color:#475569;margin-bottom:0.5mm}
    .sig-space{display:inline-block;min-width:25mm;border-bottom:0.5px solid #94a3b8;margin-left:1mm}
    .footer-info{display:flex;justify-content:space-between;font-size:${fs * 0.65}pt;color:#94a3b8}
    .powered{opacity:0.5}
  `;
}

function renderCompact(config: ReportCardPrintConfig, student: CalculatedStudent): string {
  const content = `
    ${renderHeader(config, {})}
    ${renderStudentInfo(config, student)}
    ${renderTable(config, student)}
    ${renderSummary(config, student)}
    ${renderCharts(config, student)}
    ${renderDomains(config, student)}
    ${renderComments(config, student)}
    ${renderFooter(config)}
  `;
  const scale = estimateScale(config);
  return renderHTMLWrap(content, compactCSS(config), scale);
}

// ─── MAIN EXPORT ───────────────────────────────────────

const templateRenderers: Record<ReportCardTemplateId, (config: ReportCardPrintConfig, student: CalculatedStudent) => string> = {
  classic: renderClassic,
  modern: renderModern,
  vibrant: renderVibrant,
  executive: renderExecutive,
  compact: renderCompact,
};

export function renderReportCardPrintHTML(config: ReportCardPrintConfig, studentIndex: number): string {
  const calculated = calculateAllStudents(config);
  const student = calculated[studentIndex];
  if (!student) return '<html><body><p style="padding:20mm;text-align:center;color:#94a3b8">Student not found</p></body></html>';

  if (config.templateId === 'compact') {
    return templateRenderers.compact(config, student);
  }
  return templateRenderers[config.templateId](config, student);
}
