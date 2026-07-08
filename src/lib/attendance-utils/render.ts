import {
  type AttendanceConfig,
  type AttendanceStudent,
  ATTENDANCE_CODES,
  ATTENDANCE_CODE_LABELS,
  TEMPLATE_META,
} from './types';

const esc = (s: string | number) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getWeekdays(start: string, end: string): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  current.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function groupByWeek(dates: Date[]): Date[][] {
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  for (const d of dates) {
    if (currentWeek.length > 0 && d.getDay() <= currentWeek[currentWeek.length - 1].getDay()) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(d);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);
  return weeks;
}

function formatDateHeader(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function formatDateShort(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function sameMonth(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

function getMonthKey(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function globalStyles(config: AttendanceConfig): string {
  const { primaryColor, backgroundColor, textColor, fontSize, orientation, paperSize } = config;
  const pw = paperSize === 'a4' ? 210 : 215.9;
  const ph = paperSize === 'a4' ? 297 : 279.4;
  const isPortrait = orientation === 'portrait';

  return `
    @page { size: ${isPortrait ? `${pw}mm ${ph}mm` : `${ph}mm ${pw}mm`}; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: ${fontSize}pt;
      color: ${textColor};
      background: ${backgroundColor};
    }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    .header {
      text-align: center;
      margin-bottom: 3mm;
      padding-bottom: 2mm;
      border-bottom: 2px solid ${primaryColor};
    }
    .header h1 { font-size: 16pt; color: ${primaryColor}; font-weight: 700; margin: 0; }
    .header .subtitle { font-size: 9pt; color: #64748b; margin-top: 1mm; }
    .header .info {
      display: flex; justify-content: center; gap: 8mm;
      font-size: 9pt; margin-top: 1mm;
      color: #475569;
    }
    .header .info span { border-bottom: 1px solid #cbd5e1; padding: 0 4px; }

    table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
    th, td { border: 1px solid #cbd5e1; padding: 1mm 0.8mm; text-align: center; font-size: ${fontSize}pt; }
    th {
      background: ${primaryColor};
      color: #fff;
      font-weight: 600;
      font-size: ${fontSize * 0.85}pt;
      white-space: nowrap;
    }
    th.name-col { text-align: left; }
    td.name-col { text-align: left; font-weight: 500; padding-left: 2mm; }
    td.sn-col { font-size: ${fontSize * 0.85}pt; color: #64748b; }
    td.blank-cell { min-width: 8mm; height: ${fontSize * 1.8}pt; }
    .week-total-row td {
      font-size: ${fontSize * 0.8}pt;
      background: #f8fafc;
      font-weight: 500;
      color: #475569;
    }
    .week-total-label { text-align: left; padding-left: 2mm; font-style: italic; }

    .summary-section {
      margin-top: 4mm;
      padding: 2mm;
      border-top: 2px solid ${primaryColor};
    }
    .summary-section h3 { font-size: 11pt; color: ${primaryColor}; margin-bottom: 1mm; }
    .summary-table th { font-size: ${fontSize * 0.75}pt; }
    .summary-table td { font-size: ${fontSize * 0.8}pt; }
    .summary-table .code-header { background: #475569; }

    /* Term overview styles */
    .month-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5mm;
      margin-bottom: 3mm;
    }
    .month-title {
      grid-column: 1 / -1;
      font-size: 12pt;
      font-weight: 700;
      color: ${primaryColor};
      text-align: center;
      padding: 1mm 0;
      border-bottom: 2px solid ${primaryColor};
      margin-bottom: 1mm;
    }
    .month-day-header {
      font-size: 7pt;
      font-weight: 600;
      text-align: center;
      padding: 0.5mm;
      background: #e2e8f0;
      color: #475569;
    }
    .month-cell {
      border: 1px solid #e2e8f0;
      min-height: ${fontSize * 2.5}px;
      padding: 0.5mm;
      text-align: center;
      font-size: 7pt;
    }
    .month-cell.empty { background: #f8fafc; border-color: #f1f5f9; }
    .month-cell .day-num {
      font-weight: 600;
      font-size: 7pt;
      color: #64748b;
    }
    .month-cell .att-count {
      font-size: 8pt;
      color: ${primaryColor};
      font-weight: 700;
    }
    .month-cell .att-fraction {
      font-size: 6pt;
      color: #94a3b8;
    }

    .attendance-legend {
      display: flex; gap: 4mm; justify-content: center;
      font-size: 7pt; color: #64748b; margin-bottom: 2mm;
    }
    .attendance-legend span { display: flex; align-items: center; gap: 1mm; }

    .print-footer {
      text-align: center;
      font-size: 7pt;
      color: #94a3b8;
      margin-top: 3mm;
      padding-top: 1mm;
      border-top: 1px solid #e2e8f0;
    }
  `;
}

function renderHeader(config: AttendanceConfig): string {
  const meta = TEMPLATE_META[config.templateId];
  return `
    <div class="header">
      ${config.showTitleField ? `<h1>${esc(config.sheetTitle)}</h1>` : ''}
      <div class="info">
        ${config.className ? `<span>Class: <strong>${esc(config.className)}</strong></span>` : ''}
        ${config.term ? `<span>Term: <strong>${esc(config.term)}</strong></span>` : ''}
        ${config.session ? `<span>Session: <strong>${esc(config.session)}</strong></span>` : ''}
      </div>
      <div class="subtitle">${meta?.name || ''}</div>
    </div>
  `;
}

function getCodeHintRow(): string {
  const hints = ATTENDANCE_CODES.map(c => `<span><strong>${c}</strong> = ${ATTENDANCE_CODE_LABELS[c]}</span>`).join('');
  return `<div class="attendance-legend">${hints}</div>`;
}

function renderWeekTable(
  config: AttendanceConfig,
  students: AttendanceStudent[],
  weekDates: Date[],
  weekIndex: number,
  includeNotes: boolean,
): string {
  const cols = weekDates.length;
  const noteCol = includeNotes ? 1 : 0;
  const totalCols = 2 + cols + noteCol;

  let html = `<table><thead><tr>`;
  html += `<th class="name-col" style="width:5mm">S/N</th>`;
  html += `<th class="name-col" style="min-width:${config.className.length > 10 ? '35mm' : '30mm'}">Student Name</th>`;
  for (const d of weekDates) {
    html += `<th style="width:${Math.floor(85 / cols)}%">${formatDateHeader(d)}</th>`;
  }
  if (includeNotes) {
    html += `<th style="width:15mm">Notes</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    html += `<tr>`;
    html += `<td class="sn-col">${i + 1}</td>`;
    html += `<td class="name-col">${esc(s.name)}${s.admissionNo ? ` <span style="font-size:7pt;color:#94a3b8">(${esc(s.admissionNo)})</span>` : ''}</td>`;
    for (let j = 0; j < cols; j++) {
      html += `<td class="blank-cell">&nbsp;</td>`;
    }
    if (includeNotes) {
      html += `<td class="blank-cell" style="min-width:12mm">&nbsp;</td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table>`;

  if (config.showSummary) {
    html += `<div style="margin-top:1mm;display:flex;gap:3mm;font-size:${config.fontSize * 0.8}pt;color:#64748b;">`;
    html += `<span>Week ${weekIndex + 1} Totals:</span>`;
    for (const code of ATTENDANCE_CODES) {
      html += `<span><strong>${code}</strong> = <span style="border-bottom:1px solid #cbd5e1;min-width:8mm;display:inline-block">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>`;
    }
    html += `</div>`;
  }

  return html;
}

function renderStandardRegister(config: AttendanceConfig): string {
  const { students, startDate, endDate, showBehaviourNotes } = config;
  const weekdays = getWeekdays(startDate, endDate);
  const weeks = groupByWeek(weekdays);
  const includeNotes = showBehaviourNotes || config.templateId === 'behaviour-notes';

  if (students.length === 0) {
    return `<div class="page">${renderHeader(config)}<p style="text-align:center;color:#94a3b8;padding:10mm">No students added yet. Go to Configurator to add students.</p></div>`;
  }

  let html = '';
  for (let w = 0; w < weeks.length; w++) {
    html += `<div class="page">`;
    html += renderHeader(config);
    html += `<div class="subtitle" style="text-align:center;font-size:9pt;margin-bottom:1mm;color:#64748b;">Week ${w + 1}: ${formatDateHeader(weeks[w][0])} — ${formatDateHeader(weeks[w][weeks[w].length - 1])}</div>`;
    html += getCodeHintRow();
    html += renderWeekTable(config, students, weeks[w], w, includeNotes);
    html += `<div class="print-footer">Generated by Skoolar · ${config.className} · ${config.session} · ${config.term}</div>`;
    html += `</div>`;
  }

  return html;
}

function renderWeeklySheet(config: AttendanceConfig): string {
  const { students, startDate, endDate, showBehaviourNotes } = config;
  const weekdays = getWeekdays(startDate, endDate);
  const weeks = groupByWeek(weekdays);
  const includeNotes = showBehaviourNotes || config.templateId === 'behaviour-notes';

  if (students.length === 0) {
    return `<div class="page">${renderHeader(config)}<p style="text-align:center;color:#94a3b8;padding:10mm">No students added yet. Go to Configurator to add students.</p></div>`;
  }

  let html = '';
  for (let w = 0; w < weeks.length; w++) {
    html += `<div class="page">`;
    html += renderHeader(config);
    html += `<div class="subtitle" style="text-align:center;font-size:10pt;margin-bottom:2mm;font-weight:600;color:${config.primaryColor};">Week ${w + 1}: ${formatDateHeader(weeks[w][0])} — ${formatDateHeader(weeks[w][weeks[w].length - 1])}</div>`;
    html += getCodeHintRow();

    const cols = weeks[w].length;
    const noteCol = includeNotes ? 1 : 0;
    let tableHtml = `<table><thead><tr>`;
    tableHtml += `<th class="name-col" style="width:6mm">#</th>`;
    tableHtml += `<th class="name-col" style="min-width:35mm">Student Name</th>`;
    for (const d of weeks[w]) {
      tableHtml += `<th>${DAY_NAMES[d.getDay()]}<br><span style="font-weight:400;font-size:7pt">${d.getDate()}/${d.getMonth() + 1}</span></th>`;
    }
    if (includeNotes) tableHtml += `<th style="width:18mm">Notes</th>`;
    tableHtml += `</tr></thead><tbody>`;

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      tableHtml += `<tr>`;
      tableHtml += `<td class="sn-col">${i + 1}</td>`;
      tableHtml += `<td class="name-col">${esc(s.name)}</td>`;
      for (let j = 0; j < cols; j++) {
        tableHtml += `<td class="blank-cell" style="height:${config.fontSize * 2.5}pt">&nbsp;</td>`;
      }
      if (includeNotes) tableHtml += `<td class="blank-cell" style="height:${config.fontSize * 2.5}pt">&nbsp;</td>`;
      tableHtml += `</tr>`;
    }

    tableHtml += `</tbody></table>`;

    if (config.showSummary && weeks[w].length > 0) {
      tableHtml += `<div style="margin-top:2mm;display:flex;gap:4mm;font-size:9pt;color:#475569;justify-content:center;">`;
      tableHtml += `<span style="font-weight:600">Weekly Summary:</span>`;
      for (const code of ATTENDANCE_CODES) {
        tableHtml += `<span><strong>${code}</strong> = <span style="border-bottom:1px solid #94a3b8;min-width:10mm;display:inline-block">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>`;
      }
      tableHtml += `</div>`;
    }

    html += tableHtml;
    html += `<div class="print-footer">Generated by Skoolar · ${config.className} · ${config.session} · ${config.term}</div>`;
    html += `</div>`;
  }

  return html;
}

function renderTermOverview(config: AttendanceConfig): string {
  const { students, startDate, endDate } = config;
  const weekdays = getWeekdays(startDate, endDate);

  if (students.length === 0) {
    return `<div class="page">${renderHeader(config)}<p style="text-align:center;color:#94a3b8;padding:10mm">No students added yet. Go to Configurator to add students.</p></div>`;
  }

  const totalDays = weekdays.length;
  const totalStudents = students.length;
  const months: Map<string, Date[]> = new Map();
  for (const d of weekdays) {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(d);
  }

  let html = `<div class="page">`;
  html += renderHeader(config);
  html += `<div style="text-align:center;font-size:9pt;margin-bottom:2mm;color:#64748b;">
    ${totalStudents} students · ${totalDays} school days · ${formatDateHeader(weekdays[0])} — ${formatDateHeader(weekdays[weekdays.length - 1])}
  </div>`;

  for (const [_, monthDates] of months) {
    const firstDay = new Date(monthDates[0]);
    firstDay.setDate(1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();

    html += `<div class="month-grid">`;
    html += `<div class="month-title">${getMonthKey(firstDay)}</div>`;
    html += `<div class="month-day-header">Sun</div><div class="month-day-header">Mon</div><div class="month-day-header">Tue</div>`;
    html += `<div class="month-day-header">Wed</div><div class="month-day-header">Thu</div><div class="month-day-header">Fri</div><div class="month-day-header">Sat</div>`;

    for (let i = 0; i < startDay; i++) {
      html += `<div class="month-cell empty"></div>`;
    }

    const dateSet = new Set(monthDates.map(d => d.getDate()));
    for (let day = 1; day <= daysInMonth; day++) {
      const isSchoolDay = dateSet.has(day);
      const currentDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
      const dow = currentDate.getDay();
      html += `<div class="month-cell ${!isSchoolDay ? 'empty' : ''}">`;
      html += `<div class="day-num">${day}</div>`;
      if (isSchoolDay) {
        html += `<div class="att-count">${totalStudents}</div>`;
        html += `<div class="att-fraction">/${totalStudents}</div>`;
      }
      html += `</div>`;
    }

    const lastDayDow = new Date(firstDay.getFullYear(), firstDay.getMonth(), daysInMonth).getDay();
    for (let i = lastDayDow + 1; i < 7; i++) {
      html += `<div class="month-cell empty"></div>`;
    }

    html += `</div>`;
  }

  html += `<div class="summary-section"><h3>Term Summary</h3>
    <div style="display:flex;gap:6mm;font-size:9pt;color:#475569;flex-wrap:wrap;margin-top:1mm;">
      <span>Total Students: <strong>${totalStudents}</strong></span>
      <span>Total School Days: <strong>${totalDays}</strong></span>
      <span>Expected Marks: <strong>${totalStudents * totalDays}</strong></span>
      <span>Weeks: <strong>${groupByWeek(weekdays).length}</strong></span>
    </div>
  </div>`;

  html += `<div class="print-footer">Generated by Skoolar · ${config.className} · ${config.session} · ${config.term}</div>`;
  html += `</div>`;

  return html;
}

function renderBehaviourNotes(config: AttendanceConfig): string {
  return renderStandardRegister({ ...config, showBehaviourNotes: true, templateId: 'behaviour-notes' });
}

export function renderAttendanceHTML(config: AttendanceConfig): string {
  const head = `<meta charset="utf-8"><title>${esc(config.sheetTitle)}</title><style>${globalStyles(config)}</style>`;

  let body: string;
  switch (config.templateId) {
    case 'standard-register':
      body = renderStandardRegister(config);
      break;
    case 'weekly-sheet':
      body = renderWeeklySheet(config);
      break;
    case 'term-overview':
      body = renderTermOverview(config);
      break;
    case 'behaviour-notes':
      body = renderBehaviourNotes(config);
      break;
    default:
      body = renderStandardRegister(config);
  }

  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}
