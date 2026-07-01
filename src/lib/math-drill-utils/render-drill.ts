import {
  type MathDrillConfig,
  type MathProblem,
  type MathDrillDifficulty,
  DIFFICULTY_RANGES,
  TEMPLATE_META,
  OP_SYMBOLS,
} from './types';

const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function globalStyles(config: MathDrillConfig): string {
  const { primaryColor, backgroundColor, textColor, fontSize, orientation, paperSize, columns } = config;
  const pw = paperSize === 'a4' ? 210 : 215.9;
  const ph = paperSize === 'a4' ? 297 : 279.4;
  const isPortrait = orientation === 'portrait';

  return `
    @page { size: ${isPortrait ? `${pw}mm ${ph}mm` : `${ph}mm ${pw}mm`}; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      margin:0;padding:10mm 8mm;
      font-family:'Courier New','Consolas',monospace;
      background:${backgroundColor};color:${textColor};
      width:100%;
    }
    .sheet { max-width:100%; }
    .header {
      text-align:center;margin-bottom:4mm;
      border-bottom:2px solid ${primaryColor};
      padding-bottom:2mm;
    }
    .header h1 { margin:0;font-size:18pt;color:${primaryColor};font-weight:600; }
    .meta {
      display:flex;justify-content:space-between;
      margin-bottom:3mm;font-size:9pt;color:#64748b;
    }
    .meta .line { border-bottom:1px solid #cbd5e1; min-width:80px; display:inline-block; }
    .problems-grid {
      display:grid;
      grid-template-columns:repeat(${columns}, 1fr);
      gap:4mm 3mm;
      page-break-inside:avoid;
    }
    .problem-cell {
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:2mm 1mm;
      border:1px solid #e2e8f0;
      border-radius:2px;
      min-height:40px;
    }
    .problem-expression {
      font-size:${fontSize}pt;
      font-weight:500;
      text-align:center;
      line-height:1.6;
    }
    .problem-expression .line { border-bottom:1px solid ${textColor}; width:100%; margin:1px 0; }
    .answer-line { margin-top:2px; }
    .answer-key {
      margin-top:8mm;padding:3mm;
      border-top:2px solid ${primaryColor};
      font-size:9pt;
    }
    .answer-key h3 { color:${primaryColor};margin:0 0 2mm;font-size:11pt; }
    .answer-key-grid {
      display:grid;
      grid-template-columns:repeat(${Math.min(columns, 3)}, 1fr);
      gap:1mm;
    }
    .answer-key-item { padding:0.5mm;border-bottom:1px dashed #e2e8f0;font-family:monospace; }
    .times-table-grid {
      display:grid;
      grid-template-columns:repeat(4, 1fr);
      gap:1mm;
      margin-top:3mm;
    }
    .times-table-cell {
      border:1px solid #e2e8f0;padding:1mm;text-align:center;
      font-size:${fontSize}pt;
    }
    .times-table-header { background:${primaryColor};color:#fff;font-weight:bold; }
    .mixed-op-badge {
      display:inline-block;
      padding:0 4px;
      font-size:8pt;
      color:#64748b;
    }
    .problem-number {
      font-size:7pt;color:#94a3b8;margin-right:2mm;min-width:12px;
    }
  `;
}

function renderHeader(config: MathDrillConfig): string {
  return `
    <div class="header">
      ${config.showTitleField ? `<h1>${esc(config.sheetTitle)}</h1>` : ''}
    </div>
    <div class="meta">
      ${config.showNameField ? `<span>Name: <span class="line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>` : ''}
      ${config.showDateField ? `<span>Date: <span class="line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>` : ''}
    </div>
  `;
}

function getMaxOperandDigits(config: MathDrillConfig): number {
  const range = DIFFICULTY_RANGES[config.difficulty];
  return String(range.max).length;
}

function renderProblemCell(problem: MathProblem, config: MathDrillConfig): string {
  const digits = getMaxOperandDigits(config);
  const pad = (n: number) => String(n).padStart(digits, '&nbsp;');

  switch (problem.operator) {
    case '+':
    case '×':
      return `
        <div class="problem-cell">
          <div style="text-align:right;width:100%">${pad(problem.operand1)}</div>
          <div style="text-align:right;width:100%">${problem.operator} ${pad(problem.operand2)}</div>
          <div style="border-bottom:1px solid ${config.textColor};width:100%;margin:1px 0;"></div>
          <div style="text-align:right;width:100%;min-height:${config.fontSize * 1.5}px">&nbsp;</div>
        </div>`;
    case '-':
      return `
        <div class="problem-cell">
          <div style="text-align:right;width:100%">${pad(problem.operand1)}</div>
          <div style="text-align:right;width:100%">${problem.operator} ${pad(problem.operand2)}</div>
          <div style="border-bottom:1px solid ${config.textColor};width:100%;margin:1px 0;"></div>
          <div style="text-align:right;width:100%;min-height:${config.fontSize * 1.5}px">&nbsp;</div>
        </div>`;
    case '÷':
      return `
        <div class="problem-cell">
          <div style="display:flex;align-items:center;justify-content:center;gap:2px;width:100%">
            <span style="font-size:${config.fontSize * 1.4}pt;font-weight:bold">${esc(problem.operand1)}</span>
            <span style="font-size:${config.fontSize * 1.4}pt;margin:0 2px">÷</span>
            <span style="font-size:${config.fontSize * 1.4}pt;font-weight:bold">${esc(problem.operand2)}</span>
          </div>
          <div style="border-bottom:1px solid ${config.textColor};width:100%;margin:2px 0;"></div>
          <div style="text-align:center;width:100%;min-height:${config.fontSize * 1.5}px">&nbsp;</div>
        </div>`;
    default:
      return `<div class="problem-cell">${esc(problem.operand1)} ${problem.operator} ${esc(problem.operand2)} = ?</div>`;
  }
}

function renderTimesTableDrill(config: MathDrillConfig, problems: MathProblem[]): string {
  const num = config.timesTableNumber;
  let html = `<h3 style="text-align:center;color:${config.primaryColor};margin:4mm 0 2mm">${num} Times Table</h3>`;
  html += '<div class="times-table-grid">';
  html += `<div class="times-table-cell times-table-header">×</div>`;
  for (let i = 1; i <= 12; i++) {
    html += `<div class="times-table-cell times-table-header">${i}</div>`;
  }
  html += `<div class="times-table-cell times-table-header">${num}</div>`;
  for (let i = 1; i <= 12; i++) {
    html += `<div class="times-table-cell">${num * i}</div>`;
  }
  html += '</div>';

  // Fill-in-the-blank section
  html += '<h3 style="text-align:center;color:${config.primaryColor};margin:4mm 0 2mm">Fill in the blanks</h3>';
  html += '<div class="problems-grid" style="grid-template-columns:repeat(' + config.columns + ',1fr)">';
  for (const p of problems) {
    html += renderProblemCell(p, config);
  }
  html += '</div>';
  return html;
}

function renderProblemsGrid(config: MathDrillConfig, problems: MathProblem[]): string {
  if (config.templateId === 'times-table-drill') {
    return renderTimesTableDrill(config, problems);
  }

  let html = '<div class="problems-grid">';
  for (const p of problems) {
    html += renderProblemCell(p, config);
  }
  html += '</div>';
  return html;
}

function renderAnswerKey(config: MathDrillConfig, problems: MathProblem[]): string {
  if (!config.showAnswerKey) return '';
  let html = '<div class="answer-key"><h3>📝 Answer Key</h3><div class="answer-key-grid">';
  for (const p of problems) {
    html += `<div class="answer-key-item">${p.operand1} ${p.operator} ${p.operand2} = <strong>${p.answer}</strong></div>`;
  }
  html += '</div></div>';
  return html;
}

export function renderMathDrillHTML(config: MathDrillConfig, problems: MathProblem[]): string {
  const head = `<meta charset="utf-8"><title>${esc(config.sheetTitle)}</title><style>${globalStyles(config)}</style>`;
  const header = renderHeader(config);
  const meta = TEMPLATE_META[config.templateId];

  // Difficulty label
  const diffLabel = DIFFICULTY_RANGES[config.difficulty].label;

  // Info bar
  const infoBar = `<div style="text-align:center;font-size:8pt;color:#94a3b8;margin-bottom:3mm">${meta?.name || config.templateId} · ${diffLabel} · ${problems.length} questions · ${config.columns} columns</div>`;

  const problemsGrid = renderProblemsGrid(config, problems);
  const answerKey = renderAnswerKey(config, problems);

  return `<!DOCTYPE html><html><head>${head}</head><body><div class="sheet">${header}${infoBar}${problemsGrid}${answerKey}</div></body></html>`;
}
