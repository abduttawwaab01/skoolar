export type BorderGenerator = (width: number, height: number, color: string, strokeWidth: number) => string;

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const doubleBorder: BorderGenerator = (w, h, color, sw) => {
  const inset = sw * 3;
  const innerInset = inset + sw * 4;
  return `
    <rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" rx="4" />
    <rect x="${innerInset}" y="${innerInset}" width="${w - innerInset * 2}" height="${h - innerInset * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw / 2}" rx="3" />
  `;
};

export const solidBorder: BorderGenerator = (w, h, color, sw) => {
  const inset = sw * 2;
  return `
    <rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" rx="4" />
  `;
};

export const dashedBorder: BorderGenerator = (w, h, color, sw) => {
  const inset = sw * 2;
  return `
    <rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" stroke-dasharray="${sw * 2},${sw * 2}" rx="4" />
  `;
};

export const ornateBorder: BorderGenerator = (w, h, color, sw) => {
  const m = sw * 4;
  const cornerSize = Math.min(w, h) * 0.06;
  return `
    <rect x="${m}" y="${m}" width="${w - m * 2}" height="${h - m * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" rx="${cornerSize}" />
    <rect x="${m + sw * 3}" y="${m + sw * 3}" width="${w - (m + sw * 3) * 2}" height="${h - (m + sw * 3) * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" rx="${cornerSize - sw * 2}" />

    <!-- Top-left corner ornament -->
    <path d="M${m + sw * 2} ${m + cornerSize} L${m + sw * 2} ${m + sw * 2} L${m + cornerSize} ${m + sw * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" />
    <circle cx="${m + cornerSize / 2}" cy="${m + cornerSize / 2}" r="${cornerSize * 0.15}" fill="${esc(color)}" />

    <!-- Top-right corner ornament -->
    <path d="M${w - (m + sw * 2)} ${m + cornerSize} L${w - (m + sw * 2)} ${m + sw * 2} L${w - (m + cornerSize)} ${m + sw * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" />
    <circle cx="${w - (m + cornerSize / 2)}" cy="${m + cornerSize / 2}" r="${cornerSize * 0.15}" fill="${esc(color)}" />

    <!-- Bottom-left corner ornament -->
    <path d="M${m + sw * 2} ${h - (m + cornerSize)} L${m + sw * 2} ${h - (m + sw * 2)} L${m + cornerSize} ${h - (m + sw * 2)}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" />
    <circle cx="${m + cornerSize / 2}" cy="${h - (m + cornerSize / 2)}" r="${cornerSize * 0.15}" fill="${esc(color)}" />

    <!-- Bottom-right corner ornament -->
    <path d="M${w - (m + sw * 2)} ${h - (m + cornerSize)} L${w - (m + sw * 2)} ${h - (m + sw * 2)} L${w - (m + cornerSize)} ${h - (m + sw * 2)}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" />
    <circle cx="${w - (m + cornerSize / 2)}" cy="${h - (m + cornerSize / 2)}" r="${cornerSize * 0.15}" fill="${esc(color)}" />

    <!-- Decorative corner arcs -->
    <path d="M${m + sw * 6} ${m + cornerSize * 1.2} Q${m + cornerSize * 0.5} ${m + cornerSize * 0.5} ${m + cornerSize * 1.2} ${m + sw * 6}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" />
    <path d="M${w - (m + sw * 6)} ${m + cornerSize * 1.2} Q${w - (m + cornerSize * 0.5)} ${m + cornerSize * 0.5} ${w - (m + cornerSize * 1.2)} ${m + sw * 6}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" />
    <path d="M${m + sw * 6} ${h - (m + cornerSize * 1.2)} Q${m + cornerSize * 0.5} ${h - (m + cornerSize * 0.5)} ${m + cornerSize * 1.2} ${h - (m + sw * 6)}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" />
    <path d="M${w - (m + sw * 6)} ${h - (m + cornerSize * 1.2)} Q${w - (m + cornerSize * 0.5)} ${h - (m + cornerSize * 0.5)} ${w - (m + cornerSize * 1.2)} ${h - (m + sw * 6)}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" />
  `;
};

export const filigreeBorder: BorderGenerator = (w, h, color, sw) => {
  const m = sw * 5;
  const r = Math.min(w, h) * 0.025;
  return `
    <!-- Outer border -->
    <rect x="${m}" y="${m}" width="${w - m * 2}" height="${h - m * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" rx="${r * 2}" />

    <!-- Filigree swirls - top -->
    <path d="M${w * 0.3} ${m + sw} Q${w * 0.35} ${m - sw * 2} ${w * 0.4} ${m + sw} Q${w * 0.45} ${m + sw * 3} ${w * 0.5} ${m + sw} Q${w * 0.55} ${m - sw * 2} ${w * 0.6} ${m + sw} Q${w * 0.65} ${m + sw * 3} ${w * 0.7} ${m + sw}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.4}" opacity="0.6" />
    <!-- Filigree swirls - bottom -->
    <path d="M${w * 0.3} ${h - (m + sw)} Q${w * 0.35} ${h - (m - sw * 2)} ${w * 0.4} ${h - (m + sw)} Q${w * 0.45} ${h - (m + sw * 3)} ${w * 0.5} ${h - (m + sw)} Q${w * 0.55} ${h - (m - sw * 2)} ${w * 0.6} ${h - (m + sw)} Q${w * 0.65} ${h - (m + sw * 3)} ${w * 0.7} ${h - (m + sw)}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.4}" opacity="0.6" />

    <!-- Filigree swirls - left -->
    <path d="M${m + sw} ${h * 0.3} Q${m - sw * 2} ${h * 0.35} ${m + sw} ${h * 0.4} Q${m + sw * 3} ${h * 0.45} ${m + sw} ${h * 0.5} Q${m - sw * 2} ${h * 0.55} ${m + sw} ${h * 0.6} Q${m + sw * 3} ${h * 0.65} ${m + sw} ${h * 0.7}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.4}" opacity="0.6" />
    <!-- Filigree swirls - right -->
    <path d="M${w - (m + sw)} ${h * 0.3} Q${w - (m - sw * 2)} ${h * 0.35} ${w - (m + sw)} ${h * 0.4} Q${w - (m + sw * 3)} ${h * 0.45} ${w - (m + sw)} ${h * 0.5} Q${w - (m - sw * 2)} ${h * 0.55} ${w - (m + sw)} ${h * 0.6} Q${w - (m + sw * 3)} ${h * 0.65} ${w - (m + sw)} ${h * 0.7}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.4}" opacity="0.6" />

    <!-- Diamond corner accents -->
    ${generateDiamond(m + sw * 3, m + sw * 3, sw * 3, color)}
    ${generateDiamond(w - (m + sw * 3), m + sw * 3, sw * 3, color)}
    ${generateDiamond(m + sw * 3, h - (m + sw * 3), sw * 3, color)}
    ${generateDiamond(w - (m + sw * 3), h - (m + sw * 3), sw * 3, color)}
  `;
};

function generateDiamond(cx: number, cy: number, size: number, color: string): string {
  return `<polygon points="${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}" fill="${esc(color)}" opacity="0.3" />`;
}

export const laurelBorder: BorderGenerator = (w, h, color, sw) => {
  const m = sw * 5;
  return `
    <rect x="${m}" y="${m}" width="${w - m * 2}" height="${h - m * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" rx="6" />

    <!-- Laurel wreath - left side -->
    <g transform="translate(${m + sw * 2}, ${h * 0.45})" opacity="0.5">
      <path d="M0,0 C-5,-10 -2,-25 5,-30 C12,-25 15,-10 10,0 Z" fill="none" stroke="${esc(color)}" stroke-width="1.5" />
      <path d="M0,5 C-5,15 -2,30 5,35 C12,30 15,15 10,5 Z" fill="none" stroke="${esc(color)}" stroke-width="1.5" />
      <path d="M3,0 C-2,-8 0,-20 5,-25" fill="none" stroke="${esc(color)}" stroke-width="1" />
      <path d="M3,5 C-2,8 0,20 5,25" fill="none" stroke="${esc(color)}" stroke-width="1" />
      <line x1="3" y1="-3" x2="5" y2="-6" stroke="${esc(color)}" stroke-width="0.8" />
      <line x1="1" y1="-2" x2="-1" y2="-5" stroke="${esc(color)}" stroke-width="0.8" />
      <line x1="3" y1="3" x2="5" y2="6" stroke="${esc(color)}" stroke-width="0.8" />
      <line x1="1" y1="2" x2="-1" y2="5" stroke="${esc(color)}" stroke-width="0.8" />
    </g>

    <!-- Laurel wreath - right side -->
    <g transform="translate(${w - (m + sw * 2)}, ${h * 0.45}) scale(-1,1)" opacity="0.5">
      <path d="M0,0 C-5,-10 -2,-25 5,-30 C12,-25 15,-10 10,0 Z" fill="none" stroke="${esc(color)}" stroke-width="1.5" />
      <path d="M0,5 C-5,15 -2,30 5,35 C12,30 15,15 10,5 Z" fill="none" stroke="${esc(color)}" stroke-width="1.5" />
      <path d="M3,0 C-2,-8 0,-20 5,-25" fill="none" stroke="${esc(color)}" stroke-width="1" />
      <path d="M3,5 C-2,8 0,20 5,25" fill="none" stroke="${esc(color)}" stroke-width="1" />
      <line x1="3" y1="-3" x2="5" y2="-6" stroke="${esc(color)}" stroke-width="0.8" />
      <line x1="1" y1="-2" x2="-1" y2="-5" stroke="${esc(color)}" stroke-width="0.8" />
      <line x1="3" y1="3" x2="5" y2="6" stroke="${esc(color)}" stroke-width="0.8" />
      <line x1="1" y1="2" x2="-1" y2="5" stroke="${esc(color)}" stroke-width="0.8" />
    </g>

    <!-- Center ribbon -->
    <path d="M${w * 0.35} ${h * 0.82} Q${w * 0.5} ${h * 0.87} ${w * 0.65} ${h * 0.82}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.8}" opacity="0.4" />
  `;
};

export const artdecoBorder: BorderGenerator = (w, h, color, sw) => {
  const m = sw * 5;
  const step = Math.min(w, h) * 0.015;
  return `
    <!-- Outer frame -->
    <rect x="${m}" y="${m}" width="${w - m * 2}" height="${h - m * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" />

    <!-- Art deco corner blocks - TL -->
    <polyline points="${m + step * 4},${m} ${m + step * 4},${m + step * 4} ${m},${m + step * 4}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" />
    <polyline points="${m + step * 7},${m} ${m + step * 7},${m + step * 7} ${m},${m + step * 7}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" opacity="0.5" />

    <!-- Art deco corner blocks - TR -->
    <polyline points="${w - (m + step * 4)},${m} ${w - (m + step * 4)},${m + step * 4} ${w - m},${m + step * 4}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" />
    <polyline points="${w - (m + step * 7)},${m} ${w - (m + step * 7)},${m + step * 7} ${w - m},${m + step * 7}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" opacity="0.5" />

    <!-- Art deco corner blocks - BL -->
    <polyline points="${m + step * 4},${h - m} ${m + step * 4},${h - (m + step * 4)} ${m},${h - (m + step * 4)}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" />
    <polyline points="${m + step * 7},${h - m} ${m + step * 7},${h - (m + step * 7)} ${m},${h - (m + step * 7)}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" opacity="0.5" />

    <!-- Art deco corner blocks - BR -->
    <polyline points="${w - (m + step * 4)},${h - m} ${w - (m + step * 4)},${h - (m + step * 4)} ${w - m},${h - (m + step * 4)}" fill="none" stroke="${esc(color)}" stroke-width="${sw}" />
    <polyline points="${w - (m + step * 7)},${h - m} ${w - (m + step * 7)},${h - (m + step * 7)} ${w - m},${h - (m + step * 7)}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" opacity="0.5" />

    <!-- Top/Bottom sunburst -->
    <g opacity="0.3">
      ${generateSunburst(w / 2, m, step * 2, 8, color)}
      ${generateSunburst(w / 2, h - m, step * 2, 8, color)}
    </g>

    <!-- Vertical stepped lines -->
    <line x1="${m + step * 2}" y1="${m + step * 8}" x2="${m + step * 2}" y2="${h - (m + step * 8)}" stroke="${esc(color)}" stroke-width="${sw * 0.3}" opacity="0.3" />
    <line x1="${w - (m + step * 2)}" y1="${m + step * 8}" x2="${w - (m + step * 2)}" y2="${h - (m + step * 8)}" stroke="${esc(color)}" stroke-width="${sw * 0.3}" opacity="0.3" />
  `;
};

function generateSunburst(cx: number, cy: number, len: number, rays: number, color: string): string {
  let svg = '';
  for (let i = 0; i < rays; i++) {
    const angle = (i * Math.PI * 2) / rays;
    const dx = Math.sin(angle) * len;
    const dy = Math.cos(angle) * len;
    svg += `<line x1="${cx}" y1="${cy}" x2="${cx + dx}" y2="${cy + dy}" stroke="${esc(color)}" stroke-width="0.8" />`;
  }
  return svg;
}

export const vintageBorder: BorderGenerator = (w, h, color, sw) => {
  const m = sw * 4;
  const scrollSize = Math.min(w, h) * 0.04;
  return `
    <!-- Parchment-style outer frame -->
    <rect x="${m}" y="${m}" width="${w - m * 2}" height="${h - m * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.5}" rx="${scrollSize}" />

    <!-- Inner frame -->
    <rect x="${m + sw * 2}" y="${m + sw * 2}" width="${w - (m + sw * 2) * 2}" height="${h - (m + sw * 2) * 2}" fill="none" stroke="${esc(color)}" stroke-width="${sw * 0.3}" rx="${scrollSize}" />

    <!-- Vintage scrollwork - top corners -->
    ${generateScrollwork(m + scrollSize, m + scrollSize, scrollSize, color)}
    ${generateScrollwork(w - (m + scrollSize), m + scrollSize, scrollSize, color)}
    ${generateScrollwork(m + scrollSize, h - (m + scrollSize), scrollSize, color)}
    ${generateScrollwork(w - (m + scrollSize), h - (m + scrollSize), scrollSize, color)}

    <!-- Top decorative line -->
    <line x1="${w * 0.2}" y1="${m + sw * 3}" x2="${w * 0.8}" y2="${m + sw * 3}" stroke="${esc(color)}" stroke-width="0.5" opacity="0.4" />
    <circle cx="${w * 0.2}" cy="${m + sw * 3}" r="1.5" fill="${esc(color)}" opacity="0.4" />
    <circle cx="${w * 0.8}" cy="${m + sw * 3}" r="1.5" fill="${esc(color)}" opacity="0.4" />

    <!-- Bottom decorative line -->
    <line x1="${w * 0.2}" y1="${h - (m + sw * 3)}" x2="${w * 0.8}" y2="${h - (m + sw * 3)}" stroke="${esc(color)}" stroke-width="0.5" opacity="0.4" />
    <circle cx="${w * 0.2}" cy="${h - (m + sw * 3)}" r="1.5" fill="${esc(color)}" opacity="0.4" />
    <circle cx="${w * 0.8}" cy="${h - (m + sw * 3)}" r="1.5" fill="${esc(color)}" opacity="0.4" />
  `;
};

function generateScrollwork(cx: number, cy: number, s: number, color: string): string {
  return `
    <path d="M${cx - s} ${cy} Q${cx} ${cy - s} ${cx + s} ${cy} Q${cx} ${cy + s} ${cx - s} ${cy}" fill="none" stroke="${esc(color)}" stroke-width="1" opacity="0.5" />
  `;
}

export const borderGenerators: Record<string, BorderGenerator> = {
  solid: solidBorder,
  double: doubleBorder,
  dashed: dashedBorder,
  ornate: ornateBorder,
  filigree: filigreeBorder,
  laurel: laurelBorder,
  artdeco: artdecoBorder,
  vintage: vintageBorder,
  none: () => '',
};

export function generateBorder(borderStyle: string, widthMm: number, heightMm: number, color: string, strokeWidth: number): string {
  const generator = borderGenerators[borderStyle] || borderGenerators.double;
  const svgW = widthMm * 3.78;
  const svgH = heightMm * 3.78;
  const sw = Math.max(1, strokeWidth * 3.78 / 4);
  return generator(svgW, svgH, color, sw);
}
