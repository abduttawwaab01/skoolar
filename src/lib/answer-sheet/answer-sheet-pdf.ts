'use client';

import { jsPDF } from 'jspdf';

export interface AnswerSheetConfig {
  examTitle: string;
  subject: string;
  numObjectiveQuestions: number;
  optionsPerQuestion: 4 | 5;
  numTheoryQuestions: number;
  instructions: string;
}

export interface SchoolBranding {
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
  primaryColor: string;
  secondaryColor: string;
}

const defaultConfig: AnswerSheetConfig = {
  examTitle: 'Examination',
  subject: '',
  numObjectiveQuestions: 40,
  optionsPerQuestion: 4,
  numTheoryQuestions: 3,
  instructions: 'Use a pencil to shade the circles completely.\nChoose the best answer for each question.\nWrite legibly in the theory section.\nDo not fold or mutilate this sheet.',
};

const OPTION_LABELS: Record<number, string[]> = {
  4: ['A', 'B', 'C', 'D'],
  5: ['A', 'B', 'C', 'D', 'E'],
};

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 5, g: 150, b: 105 };
}

function generateObjectiveGridHtml(numQ: number, options: number): string {
  const labels = OPTION_LABELS[options];
  let rows = '';
  for (let i = 0; i < numQ; i++) {
    const bubbles = labels.map(l => `<span class="bubble"><span class="bubble-letter">${l}</span></span>`).join('');
    rows += `<tr><td class="q-num">${i + 1}.</td><td class="bubbles-row">${bubbles}</td></tr>`;
  }
  const colCount = numQ <= 25 ? 1 : numQ <= 50 ? 2 : 3;
  const grid = Array.from({ length: Math.ceil(numQ / colCount) }, (_, ri) => {
    const start = ri * colCount;
    const cells = Array.from({ length: colCount }, (_, ci) => {
      const idx = start + ci;
      if (idx >= numQ) return '<td></td>';
      const b = labels.map(l => `<span class="bubble"><span class="bubble-letter">${l}</span></span>`).join('');
      return `<td class="q-cell"><span class="q-cell-num">${idx + 1}.</span>${b}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table class="obj-grid">${grid}</table>`;
}

function generateTheoryHtml(numQ: number): string {
  let html = '';
  for (let i = 0; i < numQ; i++) {
    html += `<div class="theory-q">
      <div class="theory-num">${i + 1}.</div>
      <div class="theory-lines">
        <div class="t-line"></div><div class="t-line"></div>
        <div class="t-line"></div><div class="t-line"></div>
        <div class="t-line"></div><div class="t-line"></div>
      </div>
    </div>`;
  }
  return html;
}

export function generateAnswerSheetHtml(
  config: AnswerSheetConfig,
  branding: SchoolBranding
): string {
  const c = { ...defaultConfig, ...config };
  const pc = branding.primaryColor || '#059669';
  const labels = OPTION_LABELS[c.optionsPerQuestion];
  const logoHtml = branding.logo
    ? `<img src="${branding.logo}" alt="Logo" class="school-logo" />`
    : '';
  const optionsLabels = labels.map(l =>
    `<span class="opt-label">${l}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Answer Sheet - ${c.examTitle}</title>
<style>
  @page { size: A4; margin: 14mm 16mm }
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body {
    font-family: 'Times New Roman', Times, serif;
    color: #222; line-height: 1.5; font-size: 11pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .top-band { height: 5px; background: ${pc}; }
  .header { text-align: center; padding: 14px 0 10px; }
  .header-top { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .school-logo { height: 52px; width: auto; }
  .school-name { font-size: 18pt; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 2px; }
  .school-info { font-size: 8.5pt; color: #555; margin-top: 2px; }
  .school-motto { font-size: 9pt; font-style: italic; color: ${pc}; margin-top: 2px; }
  .divider { border: none; border-top: 2.5px solid ${pc}; margin: 6px 0 10px; }
  .title { text-align: center; font-size: 15pt; font-weight: 700; letter-spacing: 1px; margin-bottom: 10px; color: #1a1a1a; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .info-table td { padding: 4px 8px; font-size: 10pt; border: 1px solid #ccc; width: 50%; }
  .info-table td:first-child { font-weight: 600; width: 120px; color: #333; }
  .info-table .blank { border-bottom: 1px solid #999; min-width: 100px; display: inline-block; }
  .instructions { border: 1.5px solid ${pc}; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; background: #fafff7; }
  .instructions h3 { font-size: 10pt; color: ${pc}; margin-bottom: 4px; }
  .instructions p { font-size: 9pt; color: #444; white-space: pre-line; }
  .section-title { font-size: 11pt; font-weight: 700; margin-bottom: 6px; padding: 4px 8px; background: ${pc}; color: #fff; border-radius: 3px; }
  .obj-grid { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .obj-grid td { padding: 3px 4px; vertical-align: middle; border-bottom: 1px solid #e8e8e8; }
  .q-cell { white-space: nowrap; padding: 4px 6px !important; }
  .q-cell-num { display: inline-block; width: 28px; font-weight: 600; font-size: 9pt; color: ${pc}; }
  .bubble { display: inline-block; width: 18px; height: 18px; border: 1.5px solid #666; border-radius: 50%; text-align: center; line-height: 18px; margin: 0 3px; font-size: 8pt; color: #666; }
  .bubble-letter { font-size: 7.5pt; }
  .theory-q { display: flex; gap: 10px; margin-bottom: 2px; }
  .theory-num { font-weight: 700; font-size: 10pt; color: ${pc}; min-width: 24px; padding-top: 2px; }
  .theory-lines { flex: 1; }
  .t-line { border-bottom: 1px solid #bbb; height: 24px; margin-bottom: 2px; width: 100%; }
  .examiner-section { margin-top: 16px; border-top: 2px solid ${pc}; padding-top: 8px; }
  .examiner-row { display: flex; gap: 20px; margin-top: 6px; }
  .examiner-field { flex: 1; }
  .examiner-field label { font-size: 9pt; font-weight: 600; color: #444; }
  .examiner-field .line { border-bottom: 1px solid #999; height: 22px; margin-top: 2px; }
  .footer { text-align: center; margin-top: 18px; font-size: 7.5pt; color: #aaa; border-top: 1px solid #ddd; padding-top: 6px; }
  .no-print { display: block; text-align: center; margin-top: 20px; }
  .no-print button { padding: 8px 24px; font-size: 13px; cursor: pointer; margin: 0 4px; border-radius: 4px; border: 1px solid #ccc; background: #f5f5f5; }
  .no-print button:hover { background: #e8e8e8; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="top-band"></div>
<div class="header">
  <div class="header-top">
    ${logoHtml}
    <div>
      <div class="school-name">${branding.name || 'School Name'}</div>
      <div class="school-info">${[branding.address, branding.phone, branding.email].filter(Boolean).join('  |  ')}</div>
      ${branding.motto ? `<div class="school-motto">&ldquo;${branding.motto}&rdquo;</div>` : ''}
    </div>
  </div>
</div>
<hr class="divider" />
<div class="title">ANSWER SHEET</div>
<table class="info-table">
  <tr><td>Exam: <span class="blank">&nbsp;${c.examTitle}&nbsp;</span></td><td>Subject: <span class="blank">&nbsp;${c.subject || '_______________'}&nbsp;</span></td></tr>
  <tr><td>Student Name: <span class="blank">&nbsp;________________________&nbsp;</span></td><td>Class: <span class="blank">&nbsp;________________&nbsp;</span></td></tr>
  <tr><td>Roll Number: <span class="blank">&nbsp;________________&nbsp;</span></td><td>Date: <span class="blank">&nbsp;________________&nbsp;</span></td></tr>
</table>
<div class="instructions">
  <h3>Instructions</h3>
  <p>${c.instructions}</p>
</div>
${c.numObjectiveQuestions > 0 ? `
<div class="section-title">Section A: Objective Questions (${c.numObjectiveQuestions} Questions)</div>
${generateObjectiveGridHtml(c.numObjectiveQuestions, c.optionsPerQuestion)}
` : ''}
${c.numTheoryQuestions > 0 ? `
<div class="section-title">Section B: Theory Questions</div>
${generateTheoryHtml(c.numTheoryQuestions)}
` : ''}
<div class="examiner-section">
  <div style="font-size:10pt;font-weight:700;color:#333">For Examiner Use Only</div>
  <div class="examiner-row">
    <div class="examiner-field"><label>Objective Score:</label><div class="line"></div></div>
    <div class="examiner-field"><label>Theory Score:</label><div class="line"></div></div>
  </div>
  <div class="examiner-row">
    <div class="examiner-field"><label>Total Score:</label><div class="line"></div></div>
    <div class="examiner-field"><label>Grade:</label><div class="line"></div></div>
  </div>
  <div class="examiner-row">
    <div class="examiner-field"><label>Examiner&rsquo;s Signature:</label><div class="line"></div></div>
    <div class="examiner-field"><label>Date:</label><div class="line"></div></div>
  </div>
</div>
<div class="footer">Generated by SKOOLAR &bull; School Management System</div>
<div class="no-print">
  <button onclick="window.print()">Print</button>
  <button onclick="window.close()">Close</button>
</div>
</body>
</html>`;
}

export async function generateAnswerSheetPdf(
  config: AnswerSheetConfig,
  branding: SchoolBranding
): Promise<void> {
  const c = { ...defaultConfig, ...config };
  const pc = branding.primaryColor || '#059669';
  const rgb = hexToRgb(pc);
  const labels = OPTION_LABELS[c.optionsPerQuestion];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 210;
  const ph = 297;
  const m = 16;
  const cw = pw - 2 * m;
  let y = m;
  let pg = 1;

  const checkPage = (need: number) => {
    if (y + need > ph - 16) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(180);
      doc.text(`Page ${pg}`, pw / 2, ph - 8, { align: 'center' });
      doc.addPage();
      pg++;
      y = m + 2;
      return true;
    }
    return false;
  };

  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, 0, pw, 4, 'F');

  const schoolName = (branding.name || 'School').toUpperCase();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  const snl = doc.splitTextToSize(schoolName, cw);
  doc.text(snl, pw / 2, y + 6, { align: 'center' });
  y += snl.length * 6 + 10;

  const contact = [branding.address, branding.phone, branding.email].filter(Boolean);
  if (contact.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const cl = doc.splitTextToSize(contact.join('  |  '), cw);
    doc.text(cl, pw / 2, y, { align: 'center' });
    y += cl.length * 3.5 + 3;
  }
  if (branding.motto) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.text(`"${branding.motto}"`, pw / 2, y, { align: 'center' });
    y += 5;
  }

  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(0.5);
  doc.line(m, y, pw - m, y);
  y += 7;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('ANSWER SHEET', pw / 2, y, { align: 'center' });
  y += 8;

  const fields = [
    [`Exam: ${c.examTitle}`, `Subject: ${c.subject || '______________'}`],
    ['Student Name: ________________________', 'Class: ________________'],
    ['Roll Number: ________________', 'Date: ________________'],
  ];

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  fields.forEach((row, ri) => {
    checkPage(8);
    doc.setDrawColor(180);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(m, y, cw, 7, 1, 1, ri % 2 === 0 ? 'F' : 'FD');
    doc.text(row[0], m + 4, y + 4.8);
    doc.text(row[1], m + cw / 2 + 2, y + 4.8);
    y += 9;
  });

  y += 2;

  if (c.instructions) {
    checkPage(20);
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setFillColor(250, 253, 248);
    const instrLines = doc.splitTextToSize(c.instructions, cw - 12);
    const ih = Math.max(16, instrLines.length * 3.8 + 8);
    doc.roundedRect(m, y, cw, ih, 1.5, 1.5, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.text('INSTRUCTIONS', m + 4, y + 4);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70);
    doc.text(instrLines, m + 4, y + 8);
    y += ih + 5;
  }

  if (c.numObjectiveQuestions > 0) {
    checkPage(10);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(m, y, cw, 6, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255);
    doc.text(`Section A: Objective Questions (${c.numObjectiveQuestions})`, m + 4, y + 4.2);
    y += 9;

    const cols = c.numObjectiveQuestions <= 25 ? 1 : c.numObjectiveQuestions <= 50 ? 2 : 3;
    const qPerCol = Math.ceil(c.numObjectiveQuestions / cols);
    const colW = cw / cols;
    const optW = 6.5;
    const cellH = 6;

    for (let ri = 0; ri < qPerCol; ri++) {
      checkPage((qPerCol - ri) * cellH + 8);
      for (let ci = 0; ci < cols; ci++) {
        const idx = ri * cols + ci;
        if (idx >= c.numObjectiveQuestions) continue;
        const x = m + ci * colW;
        if (ri % 2 === 0) {
          doc.setFillColor(248, 250, 248);
          doc.rect(x, y, colW, cellH, 'F');
        }
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.text(`${idx + 1}.`, x + 2, y + 4.2);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70);
        labels.forEach((label, oi) => {
          doc.setDrawColor(140);
          doc.setLineWidth(0.3);
          const cx = x + 10 + oi * (optW + 2);
          doc.circle(cx + optW / 2, y + 3, 2.5, 'S');
          doc.setFontSize(6);
          doc.text(label, cx + optW / 2, y + 5.5, { align: 'center' });
        });
      }
      y += cellH + 1;
    }
    y += 3;
  }

  if (c.numTheoryQuestions > 0) {
    checkPage(10);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(m, y, cw, 6, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255);
    doc.text('Section B: Theory Questions', m + 4, y + 4.2);
    y += 9;

    for (let i = 0; i < c.numTheoryQuestions; i++) {
      const th = 32;
      checkPage(th + 4);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.text(`${i + 1}.`, m + 2, y + 3);
      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      for (let li = 0; li < 6; li++) {
        doc.line(m + 10, y + 2 + li * 5, m + cw, y + 2 + li * 5);
      }
      y += th + 2;
    }
  }

  checkPage(20);
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(0.5);
  doc.line(m, y, pw - m, y);
  y += 4;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50);
  doc.text('For Examiner Use Only', m, y);
  y += 6;

  const examFields = [
    ['Objective Score:', 'Theory Score:'],
    ['Total Score:', 'Grade:'],
    ["Examiner's Signature:", 'Date:'],
  ];
  examFields.forEach((row) => {
    checkPage(8);
    doc.setDrawColor(180);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(m, y, cw, 7, 1, 1, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(row[0], m + 4, y + 4.8);
    doc.text(row[1], m + cw / 2 + 2, y + 4.8);
    y += 9;
  });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(180);
  doc.text(`Page ${pg}`, pw / 2, ph - 8, { align: 'center' });
  doc.setTextColor(190);
  doc.text('Generated by SKOOLAR School Management System', pw / 2, ph - 4, { align: 'center' });

  doc.save(`answer_sheet_${c.examTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30)}.pdf`);
}

export async function printAnswerSheet(
  config: AnswerSheetConfig,
  branding: SchoolBranding
): Promise<void> {
  const html = generateAnswerSheetHtml(config, branding);
  const win = window.open('', '_blank');
  if (!win) {
    const { toast } = await import('sonner');
    toast.error('Popup blocked. Please allow popups to print.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

export function fetchSchoolBranding(schoolId: string): Promise<SchoolBranding> {
  return fetch(`/api/schools/${schoolId}`)
    .then(r => r.json())
    .then(json => {
      const s = json.data || json;
      return {
        name: s.name || 'School',
        logo: s.logo || null,
        address: s.address || null,
        phone: s.phone || null,
        email: s.email || null,
        motto: s.motto || null,
        primaryColor: s.primaryColor || '#059669',
        secondaryColor: s.secondaryColor || '#10B981',
      };
    });
}
