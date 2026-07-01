import { type StarSize } from './types';

export function renderStarSVG(filled: boolean, color: string, size: number): string {
  const fill = filled ? color : 'none';
  const stroke = filled ? 'none' : color;
  const opacity = filled ? 1 : 0.3;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="${opacity}"
      />
    </svg>`;
}

export function renderStarRow(count: number, max: number, color: string, starSize: number): string {
  let stars = '';
  for (let i = 0; i < max; i++) {
    stars += renderStarSVG(i < count, color, starSize);
  }
  return `<div style="display:flex;gap:2px;align-items:center;justify-content:center">${stars}</div>`;
}

export function renderMiniProgress(current: number, max: number, color: string): string {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return `
    <div style="width:100%;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden;margin-top:2px">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;transition:width 0.3s"></div>
    </div>`;
}

export const STAR_SIZE_MAP: Record<StarSize, number> = {
  sm: 16,
  md: 22,
  lg: 30,
};
