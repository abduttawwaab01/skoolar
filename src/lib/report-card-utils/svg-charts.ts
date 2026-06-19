function esc(s: string | number): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const FONT = "'Geist',-apple-system,sans-serif";

function chartLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + '\u2026';
}

interface BarChartData {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
}

export function generateSubjectBarChart(data: BarChartData[], width = 380, height = 90): string {
  const maxVal = Math.max(...data.map(d => d.maxValue || d.value), 100);
  const chartH = height - 22;
  const paddingLeft = 26;
  const paddingRight = 6;
  const drawW = width - paddingLeft - paddingRight;
  const barCount = data.length;
  const barW = Math.max(6, Math.min(18, (drawW - barCount + 1) / barCount));
  const gap = barCount > 1 ? (drawW - barCount * barW) / (barCount - 1) : 0;

  const yGrid = [0, 25, 50, 75, 100].map(y => {
    const yPos = height - 20 - (y / maxVal) * chartH;
    return `<text x="${paddingLeft - 4}" y="${yPos + 1.5}" text-anchor="end" font-size="4.5" fill="#94a3b8" font-family="${FONT}">${y}</text>
<line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.4"/>`;
  }).join('');

  const bars = data.map((d, i) => {
    const barH = (Math.min(d.value, maxVal) / maxVal) * chartH;
    const x = paddingLeft + i * (barW + gap);
    const y = height - 20 - barH;
    const color = d.color || '#059669';
    const gId = `bg${i}`;
    return `<defs><linearGradient id="${gId}" x1="0" y1="1" x2="0" y2="0">
<stop offset="0%" stop-color="${color}" stop-opacity="0.5"/>
<stop offset="100%" stop-color="${color}" stop-opacity="1"/>
</linearGradient></defs>
<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 1)}" rx="1.5" fill="url(#${gId})" opacity="0.9"/>
<text x="${x + barW / 2}" y="${height - 5}" text-anchor="middle" font-size="4" fill="#64748b" font-family="${FONT}">${esc(chartLabel(d.label, 5))}</text>
<text x="${x + barW / 2}" y="${y - 2}" text-anchor="middle" font-size="4.5" fill="#475569" font-family="${FONT}" font-weight="600">${d.value}%</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
<rect width="${width}" height="${height}" fill="transparent"/>
${yGrid}
${bars}
</svg>`;
}

export function generateDomainRadarChart(data: { domain: string; average: number }[], width = 140, height = 140, color = '#059669'): string {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 16;
  const levels = 4;
  const slice = (2 * Math.PI) / data.length;
  const maxRating = 5;

  const grid = Array.from({ length: levels }, (_, l) => {
    const r = (radius / levels) * (l + 1);
    const pts = data.map((_, i) => {
      const a = i * slice - Math.PI / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="0.3" opacity="${0.1 + (l + 1) * 0.05}"/>`;
  }).join('');

  const axes = data.map((_, i) => {
    const a = i * slice - Math.PI / 2;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + radius * Math.cos(a)).toFixed(1)}" y2="${(cy + radius * Math.sin(a)).toFixed(1)}" stroke="#e2e8f0" stroke-width="0.3"/>`;
  }).join('');

  const dataPts = data.map((d, i) => {
    const a = i * slice - Math.PI / 2;
    const r = (Math.min(d.average, maxRating) / maxRating) * radius;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

  const labels = data.map((d, i) => {
    const a = i * slice - Math.PI / 2;
    const lx = cx + (radius + 12) * Math.cos(a);
    const ly = cy + (radius + 12) * Math.sin(a);
    return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="4.5" fill="#475569" font-family="${FONT}" font-weight="500">${esc(chartLabel(d.domain, 8))}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
<rect width="${width}" height="${height}" fill="transparent"/>
${grid}
${axes}
<polygon points="${dataPts}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1" stroke-linejoin="round"/>
${data.map((d, i) => {
  const a = i * slice - Math.PI / 2;
  const r = (Math.min(d.average, maxRating) / maxRating) * radius;
  const dx = cx + r * Math.cos(a);
  const dy = cy + r * Math.sin(a);
  return `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2" fill="${color}" stroke="#fff" stroke-width="0.6"/>`;
}).join('')}
${labels}
</svg>`;
}

export function generateGradeDistribution(data: { grade: string; count: number }[], width = 240, height = 90): string {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barH = 10;
  const gap = 2;

  const gradeColor = (g: string): string => {
    const colors: Record<string, string> = { 'A+': '#065f46', 'A': '#059669', 'B': '#0284c7', 'C': '#d97706', 'D': '#ea580c', 'E': '#dc2626', 'F': '#991b1b' };
    return colors[g] || '#6b7280';
  };

  const bars = data.map((d, i) => {
    const barW = (d.count / maxCount) * (width - 60);
    const y = 6 + i * (barH + gap);
    const pct = Math.round((d.count / total) * 100);
    return `<text x="22" y="${y + barH - 2}" text-anchor="end" font-size="5.5" fill="#475569" font-family="${FONT}">${esc(d.grade)}</text>
<rect x="26" y="${y + 1}" width="${Math.max(barW, 1)}" height="${barH - 2}" rx="1.5" fill="${gradeColor(d.grade)}" opacity="0.8"/>
<text x="${26 + barW + 3}" y="${y + barH - 2}" font-size="5" fill="#64748b" font-family="${FONT}">${d.count} (${pct}%)</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
<rect width="${width}" height="${height}" fill="transparent"/>
${bars}
</svg>`;
}

export function generateTermTrendChart(data: { term: string; average: number }[], width = 260, height = 80): string {
  if (data.length < 2) return '';
  const maxVal = Math.max(...data.map(d => d.average), 100);
  const minVal = Math.min(...data.map(d => d.average), 0);
  const range = maxVal - minVal || 50;
  const chartH = height - 28;
  const chartW = width - 40;
  const stepX = chartW / (data.length - 1);

  const points = data.map((d, i) => {
    const x = 35 + i * stepX;
    const y = height - 16 - ((d.average - minVal) / range) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(height - 16).toFixed(1)} L${points[0].x.toFixed(1)},${(height - 16).toFixed(1)} Z`;

  const markers = points.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#059669" stroke="white" stroke-width="1.2"/>
<text x="${p.x.toFixed(1)}" y="${(p.y - 6).toFixed(1)}" text-anchor="middle" font-size="5" fill="#475569" font-family="${FONT}" font-weight="600">${p.average}%</text>
<text x="${p.x.toFixed(1)}" y="${(height - 5).toFixed(1)}" text-anchor="middle" font-size="5" fill="#64748b" font-family="${FONT}">${esc(chartLabel(p.term, 8))}</text>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
<rect width="${width}" height="${height}" fill="transparent"/>
<path d="${areaPath}" fill="#059669" fill-opacity="0.06"/>
<path d="${linePath}" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
${markers}
</svg>`;
}

export function generateAttendanceGauge(percentage: number, width = 80, height = 80): string {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) - 8;
  const circumference = 2 * Math.PI * r;
  const filled = (percentage / 100) * circumference;
  const color = percentage >= 90 ? '#059669' : percentage >= 75 ? '#d97706' : '#dc2626';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
<rect width="${width}" height="${height}" fill="transparent"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="5"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
  stroke-dasharray="${filled.toFixed(1)} ${(circumference - filled).toFixed(1)}" stroke-linecap="round"
  transform="rotate(-90 ${cx} ${cy})"/>
<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="14" font-weight="bold" fill="${color}" font-family="${FONT}">${Math.round(percentage)}%</text>
<text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="5" fill="#64748b" font-family="${FONT}">Attnd</text>
</svg>`;
}

export function generateRadarChart6Axis(
  data: { subject: string; score: number }[],
  maxScore: number,
  primaryColor: string,
  width = 150,
  height = 150
): string {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 14;
  const levels = 4;
  const slice = (2 * Math.PI) / 6;
  const subjects6 = data.slice(0, 6);

  while (subjects6.length < 6) {
    subjects6.push({ subject: '', score: 0 });
  }

  const grid = Array.from({ length: levels }, (_, l) => {
    const r = (radius / levels) * (l + 1);
    const pts = subjects6.map((_, i) => {
      const a = i * slice - Math.PI / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="0.3" opacity="${0.15 + (l + 1) * 0.05}"/>`;
  }).join('');

  const axes = subjects6.map((_, i) => {
    const a = i * slice - Math.PI / 2;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + radius * Math.cos(a)).toFixed(1)}" y2="${(cy + radius * Math.sin(a)).toFixed(1)}" stroke="#e2e8f0" stroke-width="0.3"/>`;
  }).join('');

  const dataPts = subjects6.map((d, i) => {
    const a = i * slice - Math.PI / 2;
    const r = (Math.min(d.score, maxScore) / maxScore) * radius;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

  const labels = subjects6.map((d, i) => {
    if (!d.subject) return '';
    const a = i * slice - Math.PI / 2;
    const lx = cx + (radius + 11) * Math.cos(a);
    const ly = cy + (radius + 11) * Math.sin(a);
    return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="4" fill="#475569" font-family="${FONT}" font-weight="500">${esc(chartLabel(d.subject, 6))}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
<rect width="${width}" height="${height}" fill="transparent"/>
${grid}
${axes}
<polygon points="${dataPts}" fill="${primaryColor}" fill-opacity="0.1" stroke="${primaryColor}" stroke-width="1" stroke-linejoin="round"/>
${subjects6.map((d, i) => {
  if (!d.subject) return '';
  const a = i * slice - Math.PI / 2;
  const r = (Math.min(d.score, maxScore) / maxScore) * radius;
  const dx = cx + r * Math.cos(a);
  const dy = cy + r * Math.sin(a);
  return `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2" fill="${primaryColor}" stroke="#fff" stroke-width="0.6"/>`;
}).join('')}
${labels}
</svg>`;
}

export function generateBehaviorStars(rating: number, maxStars = 5, starSize = 5, color = '#f59e0b'): string {
  const fullStar = `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="${color}"/>`;
  const emptyStar = `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="#e2e8f0"/>`;

  const stars: string[] = [];
  for (let i = 0; i < maxStars; i++) {
    const x = i * (starSize * 2.2 + 1);
    stars.push(`<g transform="translate(${x + starSize}, ${starSize + 1})">${i < rating ? fullStar : emptyStar}</g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxStars * (starSize * 2.2 + 1) + starSize * 2}" height="${starSize * 2 + 2}" viewBox="0 0 ${maxStars * (starSize * 2.2 + 1) + starSize * 2} ${starSize * 2 + 2}" style="display:inline-block;vertical-align:middle">
<rect width="100%" height="100%" fill="transparent"/>
${stars.join('')}
</svg>`;
}

export function generateProgressBar(value: number, max: number, color = '#059669', width = 50, height = 5): string {
  const pct = Math.min(100, (value / max) * 100);
  const fillW = (pct / 100) * width;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
<rect width="${width}" height="${height}" rx="${height / 2}" fill="#e2e8f0"/>
<rect width="${fillW}" height="${height}" rx="${height / 2}" fill="${color}" opacity="0.85"/>
</svg>`;
}
