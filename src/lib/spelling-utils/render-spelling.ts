import {
  type SpellingConfig,
  type SpellingTemplateId,
  parseWordList,
  parseVocabularyWord,
  parseWordFamilyWord,
} from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function globalStyles(config: SpellingConfig): string {
  const { primaryColor, backgroundColor, textColor, fontSize, orientation, paperSize, numberOfColumns, margins } = config;
  const pw = paperSize === 'a4' ? 210 : 215.9;
  const ph = paperSize === 'a4' ? 297 : 279.4;
  const isPortrait = orientation === 'portrait';

  return `
    @page { size: ${isPortrait ? `${pw}mm ${ph}mm` : `${ph}mm ${pw}mm`}; margin: ${margins}mm; }
    * { box-sizing: border-box; }
    body {
      margin:0;padding:8mm;
      font-family:'Segoe UI','Comic Sans MS',cursive,sans-serif;
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
      margin-bottom:4mm;font-size:9pt;color:#64748b;
    }
    .meta .line { border-bottom:1px solid #cbd5e1; min-width:80px; display:inline-block; }
    .word-grid {
      display:grid;
      grid-template-columns:repeat(${numberOfColumns}, 1fr);
      gap:3mm;
    }
    .word-card {
      border:1px solid #e2e8f0;border-radius:4px;
      padding:2.5mm;page-break-inside:avoid;
    }
    .word-word { font-weight:600;font-size:${fontSize}pt;color:${primaryColor};margin-bottom:1mm; }
    .word-def { font-size:9pt;color:#64748b;margin-bottom:1mm;font-style:italic; }
    .trace-line {
      font-size:${fontSize}pt;color:rgba(100,116,139,0.35);
      font-family:'Comic Sans MS',cursive;letter-spacing:1px;
      border-bottom:1px solid #e2e8f0;padding:1px 0;margin-bottom:1mm;
    }
    .blank-line {
      border-bottom:1px solid #cbd5e1;height:${fontSize * 1.8}px;margin-bottom:1mm;
    }
    .illustration-box {
      border:2px dashed ${primaryColor};border-radius:4px;
      height:50px;display:flex;align-items:center;justify-content:center;
      background:#f8fafc;color:#94a3b8;font-size:9pt;margin-top:1mm;
    }
    .dictation-list { list-style:none;padding:0;margin:0; }
    .dictation-item {
      display:flex;align-items:center;gap:3mm;
      padding:1.5mm 0;border-bottom:1px solid #e2e8f0;
      page-break-inside:avoid;
    }
    .dictation-number {
      width:8mm;height:8mm;border-radius:50%;
      background:${primaryColor};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-weight:bold;font-size:10pt;flex-shrink:0;
    }
    .dictation-line {
      flex:1;border-bottom:1px solid #cbd5e1;height:${fontSize * 1.8}px;
    }
    .family-header {
      grid-column:1 / -1;
      font-weight:bold;font-size:13pt;color:${primaryColor};
      border-bottom:2px solid ${primaryColor};margin:2mm 0 1mm;padding-bottom:1mm;
    }
    .family-group { break-inside:avoid; }
    .sentence-label { font-size:8pt;color:#94a3b8;margin-top:1mm; }
  `;
}

function renderHeader(config: SpellingConfig): string {
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

function renderSpellingList(config: SpellingConfig): string {
  const words = parseWordList(config.wordList);
  let html = '<div class="word-grid">';
  for (const w of words) {
    html += '<div class="word-card">';
    html += `<div class="word-word">${esc(w)}</div>`;
    if (config.showTraceLines) {
      html += `<div class="trace-line">${esc(w)}</div>`;
    }
    html += '<div class="blank-line"></div>';
    if (config.showSentenceLines) {
      html += '<div class="sentence-label">Sentence:</div>';
      html += '<div class="blank-line"></div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderVocabularyBuilder(config: SpellingConfig): string {
  const words = parseWordList(config.wordList);
  let html = '<div class="word-grid">';
  for (const line of words) {
    const { word, definition } = parseVocabularyWord(line);
    html += '<div class="word-card">';
    html += `<div class="word-word">${esc(word)}</div>`;
    if (definition && config.showDefinitions) {
      html += `<div class="word-def">${esc(definition)}</div>`;
    }
    if (config.showSentenceLines) {
      html += '<div class="sentence-label">Sentence:</div>';
      html += '<div class="blank-line"></div>';
      html += '<div class="blank-line"></div>';
    }
    if (config.showIllustrationBoxes) {
      html += '<div class="illustration-box">📎 Draw a picture</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderDictationSheet(config: SpellingConfig): string {
  const words = parseWordList(config.wordList);
  const count = Math.max(words.length, 10);
  let html = '<ul class="dictation-list">';
  for (let i = 1; i <= count; i++) {
    html += `<li class="dictation-item"><span class="dictation-number">${i}</span><span class="dictation-line"></span></li>`;
  }
  html += '</ul>';
  return html;
}

function renderWordFamily(config: SpellingConfig): string {
  const words = parseWordList(config.wordList);
  const parsed = words.map(parseWordFamilyWord);

  const groups = new Map<string, { word: string; family: string }[]>();
  for (const p of parsed) {
    const fam = p.family || 'Other';
    if (!groups.has(fam)) groups.set(fam, []);
    groups.get(fam)!.push(p as { word: string; family: string });
  }

  let html = '<div class="word-grid">';
  for (const [family, members] of groups) {
    html += `<div class="family-header">${esc(family)} Family</div>`;
    for (const m of members) {
      html += '<div class="word-card">';
      html += `<div class="word-word">${esc(m.word)}</div>`;
      if (config.showTraceLines) {
        html += `<div class="trace-line">${esc(m.word)}</div>`;
      }
      html += '<div class="blank-line"></div>';
      if (config.showSentenceLines) {
        html += '<div class="sentence-label">Sentence:</div>';
        html += '<div class="blank-line"></div>';
      }
      html += '</div>';
    }
  }
  html += '</div>';
  return html;
}

function renderSentenceWriting(config: SpellingConfig): string {
  const words = parseWordList(config.wordList);
  let html = '<div class="word-grid">';
  for (const w of words) {
    html += '<div class="word-card">';
    html += `<div class="word-word">${esc(w)}</div>`;
    html += '<div class="sentence-label">Write a sentence using this word:</div>';
    html += '<div class="blank-line"></div>';
    html += '<div class="blank-line"></div>';
    html += '<div class="blank-line"></div>';
    if (config.showIllustrationBoxes) {
      html += '<div class="illustration-box">📎 Draw a picture to match your sentence</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

export function renderSpellingHTML(config: SpellingConfig): string {
  const head = `<meta charset="utf-8"><title>${esc(config.sheetTitle)}</title><style>${globalStyles(config)}</style>`;
  const header = renderHeader(config);
  let body = '';
  switch (config.templateId) {
    case 'spelling-list': body = renderSpellingList(config); break;
    case 'vocabulary-builder': body = renderVocabularyBuilder(config); break;
    case 'dictation-sheet': body = renderDictationSheet(config); break;
    case 'word-family': body = renderWordFamily(config); break;
    case 'sentence-writing': body = renderSentenceWriting(config); break;
  }
  const words = parseWordList(config.wordList);
  const infoBar = `<div style="text-align:center;font-size:8pt;color:#94a3b8;margin-bottom:2mm">${words.length} words · ${config.numberOfColumns} column${config.numberOfColumns > 1 ? 's' : ''}</div>`;
  return `<!DOCTYPE html><html><head>${head}</head><body><div class="sheet">${header}${infoBar}${body}</div></body></html>`;
}
