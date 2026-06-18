function esc(s: string | number): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface BarChartData {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
}

export function generateSubjectBarChart(data: BarChartData[], width = 400, height = 180): string {
  const maxVal = Math.max(...data.map(d => d.maxValue || d.value), 100);
  const barWidth = Math.max(12, Math.min(30, (width - 40) / data.length - 6));
  const chartHeight = height - 40;
  const gap = 4;

  const bars = data.map((d, i) => {
    const barH = ((d.value / maxVal) * chartHeight);
    const x = 30 + i * (barWidth + gap);
    const y = height - 30 - barH;
    const color = d.color || '#059669';
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="2" fill="${color}" opacity="0.85"/>
<text x="${x + barWidth / 2}" y="${height - 12}" text-anchor="middle" font-size="7" fill="#64748b" font-family="Inter, sans-serif">${esc(d.label)}</text>
<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="6" fill="#475569" font-family="Inter, sans-serif">${d.value}%</text>`;
  });

  const yAxis = [0, 25, 50, 75, 100]
    .map(y => {
      const yPos = height - 30 - (y / maxVal) * chartHeight;
      return `<text x="22" y="${yPos + 2}" text-anchor="end" font-size="6" fill="#94a3b8" font-family="Inter, sans-serif">${y}</text>
<line x1="26" y1="${yPos}" x2="${width - 10}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="transparent"/>
${yAxis}
${bars.join('')}
</svg>`;
}

export function generateDomainRadarChart(data: { domain: string; average: number }[], width = 200, height = 200, color = '#059669'): string {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 20;
  const levels = 5;
  const slice = (2 * Math.PI) / data.length;
  const maxRating = 5;

  const grid = Array.from({ length: levels }, (_, l) => {
    const r = (radius / levels) * (l + 1);
    const pts = data.map((_, i) => {
      const a = i * slice - Math.PI / 2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="0.3" opacity="${0.08 + (l + 1) * 0.04}"/>`;
  }).join('');

  const axes = data.map((_, i) => {
    const a = i * slice - Math.PI / 2;
    const x2 = cx + radius * Math.cos(a);
    const y2 = cy + radius * Math.sin(a);
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#e2e8f0" stroke-width="0.3"/>`;
  }).join('');

  const dataPts = data.map((d, i) => {
    const a = i * slice - Math.PI / 2;
    const r = (Math.min(d.average, maxRating) / maxRating) * radius;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  const labels = data.map((d, i) => {
    const a = i * slice - Math.PI / 2;
    const lx = cx + (radius + 14) * Math.cos(a);
    const ly = cy + (radius + 14) * Math.sin(a);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" font-size="5.5" fill="#475569" font-family="Inter, sans-serif" font-weight="500">${esc(d.domain)}</text>`;
  }).join('');

  const dotRadius = 2.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="transparent"/>
${grid}
${axes}
<polygon points="${dataPts}" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>
${data.map((d, i) => {
  const a = i * slice - Math.PI / 2;
  const r = (Math.min(d.average, maxRating) / maxRating) * radius;
  const dx = cx + r * Math.cos(a);
  const dy = cy + r * Math.sin(a);
  return `<circle cx="${dx}" cy="${dy}" r="${dotRadius}" fill="${color}" stroke="#ffffff" stroke-width="0.8"/>`;
}).join('')}
${labels}
</svg>`;
}

export function generateGradeDistribution(data: { grade: string; count: number }[], width = 300, height = 120): string {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const barHeight = 14;
  const gap = 3;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const chartWidth = width - 80;

  const gradeColor = (g: string): string => {
    const colors: Record<string, string> = { 'A+': '#065f46', 'A': '#059669', 'B': '#0284c7', 'C': '#d97706', 'D': '#ea580c', 'E': '#dc2626', 'F': '#991b1b' };
    return colors[g] || '#6b7280';
  };

  const bars = data.map((d, i) => {
    const barW = (d.count / maxCount) * chartWidth;
    const y = 10 + i * (barHeight + gap);
    const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
    return `<text x="25" y="${y + barHeight - 3}" text-anchor="end" font-size="7" fill="#475569" font-family="Inter, sans-serif">${esc(d.grade)}</text>
<rect x="30" y="${y + 1}" width="${barW || 1}" height="${barHeight - 2}" rx="2" fill="${gradeColor(d.grade)}" opacity="0.8"/>
<text x="${30 + barW + 4}" y="${y + barHeight - 3}" font-size="6" fill="#64748b" font-family="Inter, sans-serif">${d.count} (${pct}%)</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="transparent"/>
${bars}
</svg>`;
}

export function generateTermTrendChart(data: { term: string; average: number }[], width = 300, height = 150): string {
  if (data.length < 2) return '';
  const maxVal = Math.max(...data.map(d => d.average), 100);
  const minVal = Math.min(...data.map(d => d.average), 0);
  const range = maxVal - minVal || 50;
  const chartH = height - 40;
  const chartW = width - 50;
  const stepX = chartW / (data.length - 1);

  const points = data.map((d, i) => {
    const x = 35 + i * stepX;
    const y = height - 25 - ((d.average - minVal) / range) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${height - 25} L${points[0].x},${height - 25} Z`;

  const markers = points.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#059669" stroke="white" stroke-width="1.5"/>
<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="6" fill="#475569" font-family="Inter, sans-serif">${p.average}%</text>
<text x="${p.x}" y="${height - 10}" text-anchor="middle" font-size="6" fill="#64748b" font-family="Inter, sans-serif">${esc(p.term)}</text>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="transparent"/>
<path d="${areaPath}" fill="#059669" fill-opacity="0.08"/>
<path d="${linePath}" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
${markers}
</svg>`;
}

export function generateAttendanceGauge(percentage: number, width = 120, height = 120): string {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) - 12;
  const circumference = 2 * Math.PI * r;
  const filled = (percentage / 100) * circumference;
  const color = percentage >= 90 ? '#059669' : percentage >= 75 ? '#d97706' : '#dc2626';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="transparent"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="8"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
  stroke-dasharray="${filled} ${circumference - filled}" stroke-linecap="round"
  transform="rotate(-90 ${cx} ${cy})"/>
<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="18" font-weight="bold" fill="${color}" font-family="Inter, sans-serif">${Math.round(percentage)}%</text>
<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="7" fill="#64748b" font-family="Inter, sans-serif">Attendance</text>
</svg>`;
}

export function generateRadarChart6Axis(
  data: { subject: string; score: number }[],
  maxScore: number,
  primaryColor: string,
  width = 180,
  height = 180
): string {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 15;
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
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="0.3" opacity="${0.15 + (l + 1) * 0.05}"/>`;
  }).join('');

  const axes = subjects6.map((_, i) => {
    const a = i * slice - Math.PI / 2;
    return `<line x1="${cx}" y1="${cy}" x2="${cx + radius * Math.cos(a)}" y2="${cy + radius * Math.sin(a)}" stroke="#e2e8f0" stroke-width="0.3"/>`;
  }).join('');

  const dataPts = subjects6.map((d, i) => {
    const a = i * slice - Math.PI / 2;
    const r = (Math.min(d.score, maxScore) / maxScore) * radius;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  const labels = subjects6.map((d, i) => {
    if (!d.subject) return '';
    const a = i * slice - Math.PI / 2;
    const lx = cx + (radius + 12) * Math.cos(a);
    const ly = cy + (radius + 12) * Math.sin(a);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" font-size="5" fill="#475569" font-family="Inter, sans-serif" font-weight="500">${esc(d.subject)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="transparent"/>
${grid}
${axes}
<polygon points="${dataPts}" fill="${primaryColor}" fill-opacity="0.12" stroke="${primaryColor}" stroke-width="1.2" stroke-linejoin="round"/>
${subjects6.map((d, i) => {
  if (!d.subject) return '';
  const a = i * slice - Math.PI / 2;
  const r = (Math.min(d.score, maxScore) / maxScore) * radius;
  const dx = cx + r * Math.cos(a);
  const dy = cy + r * Math.sin(a);
  return `<circle cx="${dx}" cy="${dy}" r="2.5" fill="${primaryColor}" stroke="#ffffff" stroke-width="0.8"/>`;
}).join('')}
${labels}
</svg>`;
}

export function generateBehaviorStars(rating: number, maxStars = 5, starSize = 8, color = '#f59e0b'): string {
  const fullStar = `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="${color}"/>`;
  const emptyStar = `<polygon points="0,-${starSize} ${starSize * 0.224},-${starSize * 0.309} ${starSize * 0.951},-${starSize * 0.309} ${starSize * 0.363},${starSize * 0.118} ${starSize * 0.588},${starSize * 0.809} 0,${starSize * 0.382} -${starSize * 0.588},${starSize * 0.809} -${starSize * 0.363},${starSize * 0.118} -${starSize * 0.951},-${starSize * 0.309} -${starSize * 0.224},-${starSize * 0.309}" fill="#e2e8f0"/>`;

  const stars: string[] = [];
  for (let i = 0; i < maxStars; i++) {
    const x = i * (starSize * 2.2 + 1);
    const svg = i < rating ? fullStar : emptyStar;
    stars.push(`<g transform="translate(${x + starSize}, ${starSize + 1})">${svg}</g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxStars * (starSize * 2.2 + 1) + starSize * 2}" height="${starSize * 2 + 2}" viewBox="0 0 ${maxStars * (starSize * 2.2 + 1) + starSize * 2} ${starSize * 2 + 2}">
<rect width="100%" height="100%" fill="transparent"/>
${stars.join('')}
</svg>`;
}

export function generateProgressBar(value: number, max: number, color = '#059669', width = 60, height = 6): string {
  const pct = Math.min(100, (value / max) * 100);
  const fillW = (pct / 100) * width;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" rx="${height / 2}" fill="#e2e8f0"/>
<rect width="${fillW}" height="${height}" rx="${height / 2}" fill="${color}" opacity="0.85"/>
</svg>`;
}
