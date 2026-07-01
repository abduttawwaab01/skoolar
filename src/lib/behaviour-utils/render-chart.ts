import {
  type BehaviourConfig,
  type StudentBehaviourEntry,
  type ColourState,
  WEEKDAYS,
  COLOUR_HEX,
  COLOUR_LABELS,
  computeStudentTotal,
  computeStudentMax,
  computeClassTotals,
} from './types';
import { renderStarSVG, renderStarRow, renderMiniProgress, STAR_SIZE_MAP } from './star-assets';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function palette(config: BehaviourConfig) {
  return {
    bg: config.backgroundColor,
    text: config.textColor,
    primary: config.primaryColor,
    secondary: config.secondaryColor,
    accent: config.accentColor,
    border: config.borderColor,
    star: config.starColor,
  };
}

function globalStyles(config: BehaviourConfig): string {
  const p = palette(config);
  return `
    @page { margin: 10mm; size: landscape; }
    body { margin:0;padding:20px;font-family:'Segoe UI',system-ui,sans-serif;background:${p.bg};color:${p.text}; }
    .chart-container { max-width:1100px;margin:0 auto; }
    .chart-header { text-align:center;margin-bottom:16px; }
    .chart-header h1 { margin:0;font-size:24px;color:${p.primary}; }
    .chart-header .meta { font-size:13px;color:#64748b;margin-top:4px; }
    table { width:100%;border-collapse:collapse;font-size:14px; }
    th { background:${p.primary};color:#fff;padding:8px 6px;text-align:center;font-weight:600; }
    td { padding:6px;text-align:center;border:1px solid ${p.border}; }
    .student-name { text-align:left;font-weight:500;padding-left:10px;white-space:nowrap; }
    .student-name-small { text-align:left;padding-left:8px;font-size:13px; }
    .totals-row { background:${p.accent};font-weight:600; }
    .totals-label { text-align:right;padding-right:12px; }
    .reward-section { margin-top:20px;padding:12px;background:${p.accent};border-radius:8px;border:1px solid ${p.border}; }
    .reward-section h3 { margin:0 0 8px;font-size:15px;color:${p.primary}; }
    .reward-track { display:flex;gap:6px;align-items:center;flex-wrap:wrap; }
    .reward-step { display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500;background:#fff;border:1px solid ${p.border}; }
    .reward-step.reached { background:${p.primary};color:#fff;border-color:${p.primary}; }
    .colour-cell { width:32px;height:32px;border-radius:50%;display:inline-block;border:2px solid transparent;cursor:pointer;transition:all 0.2s; }
    .colour-cell.grey { background:#94a3b8; }
    .colour-cell.green { background:#22c55e; }
    .colour-cell.yellow { background:#eab308; }
    .colour-cell.red { background:#ef4444; }
    .colour-cell.selected { border-color:#1e293b;transform:scale(1.15); }
    .goal-box { padding:10px;background:#fff;border:1px solid ${p.border};border-radius:8px;text-align:center; }
    .goal-box .emoji { font-size:24px; }
    .goal-box .label { font-size:12px;margin-top:4px;color:#64748b; }
    .sticker-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:12px; }
    .sticker-circle { width:100%;aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;border:3px dashed ${p.border};background:#f8fafc;transition:all 0.2s; }
    .sticker-circle.filled { border-style:solid;background:${p.accent};border-color:${p.primary}; }
    .ladder-container { display:flex;flex-direction:column;gap:4px;padding:12px; }
    .ladder-rung { display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:20px;font-size:13px;background:#f1f5f9;transition:all 0.3s; }
    .ladder-rung.reached { background:${p.primary};color:#fff; }
    .ladder-rung .rung-number { font-weight:700;min-width:24px; }
    .sticker-theme-space .sticker-circle { background:#0f172a;border-color:#38bdf8;color:#38bdf8; }
    .sticker-theme-ocean .sticker-circle { background:#e0f2fe;border-color:#0ea5e9;color:#0ea5e9; }
    .sticker-theme-garden .sticker-circle { background:#f0fdf4;border-color:#22c55e;color:#22c55e; }
    .colour-chart-row td { vertical-align:middle; }
  `;
}

export function renderChartHTML(config: BehaviourConfig): string {
  const { templateId } = config;
  const p = palette(config);

  const head = `
    <meta charset="utf-8">
    <title>${escapeHtml(config.chartTitle)}</title>
    <style>${globalStyles(config)}</style>
  `;

  const header = `
    <div class="chart-header">
      <h1>${escapeHtml(config.chartTitle)}</h1>
      <div class="meta">${escapeHtml(config.schoolName)} — ${escapeHtml(config.periodLabel)} ${escapeHtml(config.date)}</div>
    </div>
  `;

  let bodyContent = '';

  switch (templateId) {
    case 'daily-star-chart':
      bodyContent = renderDailyStarChart(config, p);
      break;
    case 'weekly-class-chart':
      bodyContent = renderWeeklyClassChart(config, p);
      break;
    case 'monthly-goal-tracker':
      bodyContent = renderMonthlyGoalTracker(config, p);
      break;
    case 'colour-behaviour-chart':
      bodyContent = renderColourBehaviourChart(config, p);
      break;
    case 'reward-ladder':
      bodyContent = renderRewardLadder(config, p);
      break;
    case 'sticker-collection':
      bodyContent = renderStickerCollection(config, p);
      break;
  }

  const rewards = config.showRewardTrack && config.rewards.length > 0
    ? renderRewardSection(config, p)
    : '';

  return `<!DOCTYPE html><html><head>${head}</head><body><div class="chart-container">${header}${bodyContent}${rewards}</div></body></html>`;
}

function renderRewardSection(config: BehaviourConfig, p: Record<string, string>): string {
  const totals = config.students.map(s => computeStudentTotal(s));
  const classTotal = totals.reduce((a, b) => a + b, 0);
  const steps = config.rewards.map(r => {
    const reached = classTotal >= r.threshold;
    return `<span class="reward-step${reached ? ' reached' : ''}">${r.emoji || ''} ${escapeHtml(r.label)} (${r.threshold})</span>`;
  }).join('');
  return `
    <div class="reward-section">
      <h3>🏆 Reward Track — ${classTotal} stars earned</h3>
      <div class="reward-track">${steps}</div>
    </div>`;
}

function renderDailyStarChart(config: BehaviourConfig, p: Record<string, string>): string {
  const cats = config.categories;
  const sw = STAR_SIZE_MAP[config.starSize];
  if (!config.showNames) {
    return renderIndividualStarChart(config, p);
  }

  let html = `<table><thead><tr><th style="text-align:left;padding-left:10px">Student</th>`;
  for (const cat of cats) {
    html += `<th>${cat.emoji}<br>${escapeHtml(cat.label)}</th>`;
  }
  if (config.showTotals) html += `<th>Total</th>`;
  html += `</tr></thead><tbody>`;

  for (const student of config.students) {
    const total = computeStudentTotal(student);
    const max = computeStudentMax(cats);
    html += `<tr><td class="student-name">${escapeHtml(student.name)}</td>`;
    for (const cat of cats) {
      const score = student.scores[cat.id] || 0;
      html += `<td>${renderStarRow(score, cat.maxScore, p.star, sw)}</td>`;
    }
    if (config.showTotals) {
      html += `<td><strong>${total}</strong> / ${max}</td>`;
    }
    html += `</tr>`;
  }

  if (config.showTotals && config.students.length > 0) {
    const classTotals = computeClassTotals(config.students, cats);
    const grandTotal = config.students.reduce((s, st) => s + computeStudentTotal(st), 0);
    const grandMax = cats.reduce((s, c) => s + c.maxScore * config.students.length, 0);
    html += `<tr class="totals-row"><td class="totals-label">Class Totals</td>`;
    for (const cat of cats) {
      html += `<td><strong>${classTotals[cat.id] || 0}</strong></td>`;
    }
    html += `<td><strong>${grandTotal}</strong> / ${grandMax}</td></tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

function renderIndividualStarChart(config: BehaviourConfig, p: Record<string, string>): string {
  const student = config.students.find(s => s.id === config.selectedStudentId) || config.students[0];
  if (!student) return '<p>No student selected</p>';
  const cats = config.categories;
  const sw = STAR_SIZE_MAP[config.starSize];
  let html = `<table><thead><tr><th>Category</th><th>Stars</th><th>Score</th></tr></thead><tbody>`;
  let total = 0;
  let max = 0;
  for (const cat of cats) {
    const score = student.scores[cat.id] || 0;
    total += score;
    max += cat.maxScore;
    html += `<tr><td style="text-align:left;padding-left:10px">${cat.emoji} ${escapeHtml(cat.label)}</td><td>${renderStarRow(score, cat.maxScore, p.star, sw)}</td><td>${score}/${cat.maxScore}</td></tr>`;
  }
  if (config.showTotals) {
    html += `<tr class="totals-row"><td class="totals-label">Total</td><td></td><td>${total}/${max}</td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderWeeklyClassChart(config: BehaviourConfig, p: Record<string, string>): string {
  const sw = STAR_SIZE_MAP[config.starSize];
  let html = `<table><thead><tr><th>Student</th>`;
  for (const day of WEEKDAYS) {
    html += `<th>${day}</th>`;
  }
  if (config.showTotals) html += `<th>Total</th>`;
  html += `</tr></thead><tbody>`;

  for (const student of config.students) {
    html += `<tr><td class="student-name">${escapeHtml(student.name)}</td>`;
    let total = 0;
    for (const day of WEEKDAYS) {
      const score = student.scores[day] || 0;
      total += score;
      html += `<td>${renderStarRow(score, 1, p.star, sw)}</td>`;
    }
    if (config.showTotals) html += `<td><strong>${total}</strong> / 5</td>`;
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderMonthlyGoalTracker(config: BehaviourConfig, p: Record<string, string>): string {
  const student = config.students.find(s => s.id === config.selectedStudentId) || config.students[0];
  if (!student) return '<p>No student selected</p>';
  const sw = STAR_SIZE_MAP[config.starSize];
  const goals = config.goals;

  const total = Object.values(student.goals || {}).reduce((s, v) => s + v, 0);
  const max = goals.length;

  let html = `<div style="text-align:center;margin-bottom:16px"><h2 style="color:${p.primary};margin:0">${escapeHtml(student.name)}</h2><div style="font-size:40px;margin:8px 0">${renderStarRow(total, max, p.star, STAR_SIZE_MAP.lg)}</div><div style="font-size:14px">${total} / ${max} goals achieved</div></div>`;
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">`;
  for (const goal of goals) {
    const score = (student.goals || {})[goal.id] || 0;
    html += `<div class="goal-box"><div class="emoji">${score ? '✅' : goal.emoji}</div><div class="label">${escapeHtml(goal.label)}</div>${renderMiniProgress(score ? 1 : 0, 1, p.star)}</div>`;
  }
  html += `</div>`;
  return html;
}

function renderColourBehaviourChart(config: BehaviourConfig, p: Record<string, string>): string {
  const cycle = config.colourCycleOrder;
  const colourLabel = (c: ColourState) => COLOUR_LABELS[c] || c;
  const colourHex = (c: ColourState) => COLOUR_HEX[c] || '#94a3b8';

  let html = `<table><thead><tr><th style="text-align:left;padding-left:10px">Student</th>`;
  for (const c of cycle) {
    html += `<th style="background:${colourHex(c)}">${colourLabel(c)}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const student of config.students) {
    const currentColour = student.colour || 'grey';
    html += `<tr class="colour-chart-row"><td class="student-name">${escapeHtml(student.name)}</td>`;
    for (const c of cycle) {
      const selected = c === currentColour;
      html += `<td><span class="colour-cell ${c}${selected ? ' selected' : ''}">${selected ? '✓' : ''}</span></td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;

  if (config.showTotals) {
    html += `<div style="margin-top:12px;font-size:13px;color:#64748b;text-align:center">`;
    const counts: Record<string, number> = {};
    for (const s of config.students) {
      const c = s.colour || 'grey';
      counts[c] = (counts[c] || 0) + 1;
    }
    for (const c of cycle) {
      html += `<span style="display:inline-block;margin:0 8px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${colourHex(c)};vertical-align:middle;margin-right:4px"></span> ${colourLabel(c)}: ${counts[c] || 0}</span>`;
    }
    html += `</div>`;
  }
  return html;
}

function renderRewardLadder(config: BehaviourConfig, p: Record<string, string>): string {
  const rewards = config.rewards;
  const maxRung = rewards.length > 0 ? rewards[rewards.length - 1].threshold : 100;

  let html = `<table><thead><tr><th style="text-align:left;padding-left:10px">Student</th><th>Stars</th><th>Progress</th></tr></thead><tbody>`;
  const sw = STAR_SIZE_MAP[config.starSize];

  for (const student of config.students) {
    const total = computeStudentTotal(student);
    const pct = Math.min(100, (total / maxRung) * 100);
    html += `<tr><td class="student-name">${escapeHtml(student.name)}</td><td><strong>${total}</strong></td><td style="padding:4px 12px">${renderMiniProgress(total, maxRung, p.star)}<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">`;
    for (const r of rewards) {
      const reached = total >= r.threshold;
      html += `<span style="display:inline-flex;align-items:center;gap:2px;padding:2px 8px;border-radius:12px;font-size:11px;background:${reached ? p.primary : '#f1f5f9'};color:${reached ? '#fff' : '#64748b'}">${r.emoji || ''} ${escapeHtml(r.label)}</span>`;
    }
    html += `</div></td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderStickerCollection(config: BehaviourConfig, p: Record<string, string>): string {
  const theme = config.stickerTheme;
  const totalSlots = 30;
  const filledSlots = 8;
  let html = `<div class="sticker-grid sticker-theme-${theme}">`;
  for (let i = 0; i < totalSlots; i++) {
    const filled = i < filledSlots;
    html += `<div class="sticker-circle${filled ? ' filled' : ''}">${filled ? ['🚀', '🌙', '⭐', '🛸', '☄️', '🪐', '🌍', '💫'][i % 8] : '?'}</div>`;
  }
  html += `</div>`;
  return html;
}
