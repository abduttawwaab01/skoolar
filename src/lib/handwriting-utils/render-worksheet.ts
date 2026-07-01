import {
  type HandwritingConfig,
  type HandwritingTemplateId,
  LINE_SPACING_PX,
  LINE_STYLE_CSS,
} from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function globalStyles(config: HandwritingConfig): string {
  const px = LINE_SPACING_PX[config.lineSpacing];
  const lc = config.lineColor;
  const ls = LINE_STYLE_CSS[config.lineStyle];
  const bg = config.backgroundColor;
  const tc = config.textColor;
  const pc = config.primaryColor;
  const marginCol = config.marginLineColor;
  const isPortrait = config.orientation === 'portrait';
  const pw = config.paperSize === 'a4' ? 210 : 215.9;
  const ph = config.paperSize === 'a4' ? 297 : 279.4;

  return `
    @page { size: ${isPortrait ? `${pw}mm ${ph}mm` : `${ph}mm ${pw}mm`}; margin: ${config.margins}mm; }
    * { box-sizing: border-box; }
    body {
      margin:0;padding:0;font-family:'Segoe UI','Comic Sans MS',cursive,sans-serif;
      background:${bg};color:${tc};
      width:100%;height:100%;
      display:flex;flex-direction:column;
    }
    .sheet {
      width:100%;height:100%;
      padding:10mm 8mm;
      display:flex;flex-direction:column;
    }
    .sheet-header {
      text-align:center;margin-bottom:6mm;
      border-bottom:2px solid ${pc};
      padding-bottom:3mm;
    }
    .sheet-header h1 {
      margin:0;font-size:20pt;color:${pc};font-weight:600;
    }
    .sheet-meta {
      display:flex;justify-content:space-between;
      margin-bottom:4mm;font-size:10pt;color:#64748b;
    }
    .sheet-meta span { min-width:80px; }
    .sheet-meta .empty-line { border-bottom:1px solid ${lc}; min-width:100px; display:inline-block; }
    .lines-area {
      flex:1;display:flex;flex-direction:column;
      position:relative;margin-top:2mm;
    }
    .line-row {
      flex:1;display:flex;align-items:center;
      position:relative;
      min-height:${px}px;
      border-bottom:${ls === 'solid' ? '1px' : ls === 'dashed' ? '2px' : '1px'} ${ls} ${lc};
    }
    .line-row.dotted-thirds-top {
      border-bottom:2px dashed ${lc};
    }
    .line-row.dotted-thirds-mid {
      border-bottom:2px dotted ${lc};
    }
    .line-row.primary-mid {
      border-bottom:2px dashed ${lc};
    }
    .margin-line {
      position:absolute;left:0;top:0;bottom:0;
      border-left:2px solid ${marginCol};
      width:0;pointer-events:none;
    }
    .grid-cell {
      flex:1;border-right:1px dashed ${lc};
      height:100%;display:flex;align-items:center;justify-content:center;
    }
    .grid-cell:last-child { border-right:none; }
    .trace-text {
      color:rgba(100,116,139,0.35) !important;
      font-family:'Comic Sans MS','Segoe UI',cursive,sans-serif;
      font-size:${config.fontSize}pt;
      line-height:${px}px;
      padding:0 4px;
      letter-spacing:1px;
      white-space:pre;
      overflow:hidden;
      pointer-events:none;
    }
    .blank-line {
      border-bottom-color:${lc};
    }
    .story-picture-box {
      border:2px dashed ${pc};border-radius:4px;
      margin-bottom:4mm;display:flex;align-items:center;justify-content:center;
      background:#f8fafc;color:#94a3b8;font-size:14pt;
      min-height:${config.pictureBoxHeight}px;
    }
    .grid-container {
      display:flex;flex-direction:column;flex:1;
    }
    .grid-row {
      display:flex;flex:1;
      border-bottom:1px solid ${lc};
    }
    .grid-row:last-child { border-bottom:none; }
    .grid-cell-border {
      border-right:1px dashed ${lc};
    }
    .dotted-thirds-container .line-row {
      border-bottom:2px solid ${lc};
    }
    .dotted-thirds-container .line-row.dotted-third-top-line {
      border-bottom:2px dashed ${lc};
      border-top:2px dashed ${lc};
    }
    .dotted-thirds-container .line-row.dotted-third-mid-line {
      border-bottom:none;
      border-top:2px dotted ${lc};
    }
  `;
}

function renderHeader(config: HandwritingConfig): string {
  return `
    <div class="sheet-header">
      ${config.showTitleField ? `<h1>${esc(config.sheetTitle)}</h1>` : ''}
    </div>
    <div class="sheet-meta">
      ${config.showNameField ? `<span>Name: <span class="empty-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>` : ''}
      ${config.showDateField ? `<span>Date: <span class="empty-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>` : ''}
    </div>
  `;
}

function renderClassicRuled(config: HandwritingConfig): string {
  const px = LINE_SPACING_PX[config.lineSpacing];
  let rows = '';
  for (let i = 0; i < config.lineCount; i++) {
    rows += `<div class="line-row" style="min-height:${px}px">
      ${config.showMarginLine ? '<div class="margin-line"></div>' : ''}
    </div>`;
  }
  return `<div class="lines-area">${rows}</div>`;
}

function renderDottedThirds(config: HandwritingConfig): string {
  const px = LINE_SPACING_PX[config.lineSpacing];
  const thirdCount = Math.ceil(config.lineCount / 3) * 3;
  let rows = '';
  for (let i = 0; i < thirdCount; i++) {
    const mod = i % 3;
    if (mod === 0) {
      rows += `<div class="line-row" style="min-height:${px}px;border-bottom:2px dashed ${config.lineColor}">
        ${config.showMarginLine ? '<div class="margin-line"></div>' : ''}
      </div>`;
    } else if (mod === 1) {
      rows += `<div class="line-row" style="min-height:${px}px;border-bottom:none;border-top:2px dotted ${config.lineColor}">
        ${config.showMarginLine ? '<div class="margin-line"></div>' : ''}
      </div>`;
    } else {
      rows += `<div class="line-row" style="min-height:${px}px;border-bottom:2px solid ${config.lineColor}">
        ${config.showMarginLine ? '<div class="margin-line"></div>' : ''}
      </div>`;
    }
  }
  return `<div class="lines-area dotted-thirds-container">${rows}</div>`;
}

function renderPrimaryLines(config: HandwritingConfig): string {
  const px = LINE_SPACING_PX[config.lineSpacing];
  let rows = '';
  for (let i = 0; i < config.lineCount; i++) {
    const isTop = i % 2 === 0;
    rows += `<div class="line-row" style="min-height:${px};${isTop ? `border-bottom:2px solid ${config.lineColor}` : `border-bottom:2px dashed ${config.lineColor}`}">
      ${config.showMarginLine ? '<div class="margin-line"></div>' : ''}
    </div>`;
  }
  return `<div class="lines-area">${rows}</div>`;
}

function renderGrid(config: HandwritingConfig): string {
  const px = LINE_SPACING_PX[config.lineSpacing];
  const cols = 8;
  const totalCells = config.lineCount * cols;
  let html = '<div class="grid-container">';
  for (let r = 0; r < config.lineCount; r++) {
    html += '<div class="grid-row" style="min-height:' + px + 'px">';
    for (let c = 0; c < cols; c++) {
      html += `<div class="grid-cell" style="border-right:${c < cols - 1 ? '1px dashed ' + config.lineColor : 'none'}"></div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderTraceWrite(config: HandwritingConfig): string {
  const px = LINE_SPACING_PX[config.lineSpacing];
  const lines = config.tracingText.split('\n').filter(Boolean);
  const pairs = Math.ceil(config.lineCount / 2);
  let rows = '';
  for (let p = 0; p < pairs; p++) {
    const traceLine = lines[p % lines.length] || '';
    rows += `<div class="line-row" style="min-height:${px}px">
      ${config.showMarginLine ? '<div class="margin-line"></div>' : ''}
      <span class="trace-text">${esc(traceLine)}</span>
    </div>`;
    rows += `<div class="line-row" style="min-height:${px}px;border-bottom:1px solid ${config.lineColor}">
      ${config.showMarginLine ? '<div class="margin-line"></div>' : ''}
    </div>`;
  }
  return `<div class="lines-area">${rows}</div>`;
}

function renderStorySheet(config: HandwritingConfig): string {
  const px = LINE_SPACING_PX[config.lineSpacing];
  const picBoxHeight = config.pictureBoxHeight;
  let html = '';
  if (config.pictureBox) {
    html += `<div class="story-picture-box" style="min-height:${picBoxHeight}px">
      <span>📎 Draw your picture here</span>
    </div>`;
  }
  html += '<div class="lines-area">';
  for (let i = 0; i < config.lineCount; i++) {
    html += `<div class="line-row" style="min-height:${px}px">
      ${config.showMarginLine ? '<div class="margin-line"></div>' : ''}
    </div>`;
  }
  html += '</div>';
  return html;
}

export function renderWorksheetHTML(config: HandwritingConfig): string {
  const head = `<meta charset="utf-8"><title>${esc(config.sheetTitle)}</title><style>${globalStyles(config)}</style>`;
  const header = renderHeader(config);
  let body = '';
  switch (config.templateId) {
    case 'classic-ruled': body = renderClassicRuled(config); break;
    case 'dotted-thirds': body = renderDottedThirds(config); break;
    case 'primary-lines': body = renderPrimaryLines(config); break;
    case 'handwriting-grid': body = renderGrid(config); break;
    case 'trace-write': body = renderTraceWrite(config); break;
    case 'story-sheet': body = renderStorySheet(config); break;
  }
  return `<!DOCTYPE html><html><head>${head}</head><body><div class="sheet">${header}${body}</div></body></html>`;
}
