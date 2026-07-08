import { type CalculatedSubject, GRADE_BOUNDARIES } from './types';

const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT = "'Segoe UI',Arial,sans-serif";

function shorten(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '\u2026';
}

function gradeColor(grade: string): string {
  const g = GRADE_BOUNDARIES.find((b) => b.grade === grade);
  return g ? g.color : '#6b7280';
}

export function generateSubjectBarChart(subjects: CalculatedSubject[], primaryColor: string): string {
  const n = subjects.length;
  if (n === 0) return '';
  const totalW = 560;
  const chartH = 80;
  const baseY = chartH - 6;
  const barW = Math.max(6, Math.min(18, (totalW - 55) / n - 3));
  const gap = Math.max(2, Math.min(4, (totalW - 55 - n * barW) / (n - 1 || 1)));

  const yGrid = [0, 25, 50, 75, 100].map((y) => {
    const yPos = baseY - (y / 100) * (chartH - 20);
    return `<text x="32" y="${(yPos + 1.5).toFixed(1)}" text-anchor="end" font-size="4.5" fill="#94a3b8">${y}</text>
<line x1="36" y1="${yPos.toFixed(1)}" x2="${(totalW - 6).toFixed(1)}" y2="${yPos.toFixed(1)}" stroke="#e2e8f0" stroke-width="0.4"/>`;
  }).join('');

  const bars = subjects.map((sub, i) => {
    const barH = (sub.percentage / 100) * (chartH - 20);
    const x = 40 + i * (barW + gap);
    const y = baseY - barH;
    const c = gradeColor(sub.grade);
    const gid = `cb${i}`;
    return `<defs><linearGradient id="${gid}" x1="0" y1="1" x2="0" y2="0">
<stop offset="0%" stop-color="${c}" stop-opacity="0.4"/>
<stop offset="100%" stop-color="${c}" stop-opacity="1"/></linearGradient></defs>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${Math.max(barH, 1).toFixed(1)}" rx="1.5" fill="url(#${gid})" opacity="0.9"/>
<text x="${(x + barW / 2).toFixed(1)}" y="${(baseY + 7).toFixed(1)}" text-anchor="middle" font-size="4.5" fill="#64748b">${esc(shorten(sub.name, 5))}</text>
<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 1.5).toFixed(1)}" text-anchor="middle" font-size="4.5" fill="#475569" font-weight="600">${sub.percentage}%</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="26mm" viewBox="0 0 ${totalW} ${chartH}" style="display:block">
<rect width="${totalW}" height="${chartH}" fill="transparent"/>
${yGrid}
${bars}
</svg>`;
}

export function generateRadarChart(subjects: CalculatedSubject[], primaryColor: string): string {
  const items = subjects.slice(0, 6);
  if (items.length < 3) return '';

  while (items.length < 6) {
    items.push({ name: '', percentage: 0, grade: '', remark: '', total: 0, maxPossible: 0, scores: {} } as CalculatedSubject);
  }

  const cx = 60, cy = 60, radius = 40, levels = 4, slice = (2 * Math.PI) / 6;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="120" viewBox="0 0 120 120" style="display:block">
<rect width="120" height="120" fill="transparent"/>`;

  for (let l = 0; l < levels; l++) {
    const r = ((radius / levels) * (l + 1));
    const pts = items.map((_, i) => {
      const a = i * slice - Math.PI / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="0.4" opacity="${(0.12 + (l + 1) * 0.04).toFixed(2)}"/>`;
  }

  svg += items.map((_, i) => {
    const a = i * slice - Math.PI / 2;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + radius * Math.cos(a)).toFixed(1)}" y2="${(cy + radius * Math.sin(a)).toFixed(1)}" stroke="#e2e8f0" stroke-width="0.4"/>`;
  }).join('');

  const dataPts = items.map((d, i) => {
    const a = i * slice - Math.PI / 2;
    const r = (Math.min(d.percentage, 100) / 100) * radius;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

  svg += `<polygon points="${dataPts}" fill="${primaryColor}" fill-opacity="0.12" stroke="${primaryColor}" stroke-width="1.2" stroke-linejoin="round"/>`;

  svg += items.map((d, i) => {
    if (!d.name) return '';
    const a = i * slice - Math.PI / 2;
    const r = (Math.min(d.percentage, 100) / 100) * radius;
    const dx = cx + r * Math.cos(a);
    const dy = cy + r * Math.sin(a);
    return `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2.2" fill="${primaryColor}" stroke="#fff" stroke-width="0.8"/>`;
  }).join('');

  svg += items.map((d, i) => {
    if (!d.name) return '';
    const a = i * slice - Math.PI / 2;
    const lx = cx + (radius + 11) * Math.cos(a);
    const ly = cy + (radius + 11) * Math.sin(a);
    return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="4" fill="#475569" font-weight="500">${esc(shorten(d.name, 7))}</text>`;
  }).join('');

  svg += '</svg>';
  return svg;
}
