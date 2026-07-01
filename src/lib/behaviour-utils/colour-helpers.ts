import { type ColourState, COLOUR_HEX, COLOUR_LABELS } from './types';

export function cycleColour(current: ColourState, order: ColourState[]): ColourState {
  const idx = order.indexOf(current);
  return idx < 0 ? order[0] : order[(idx + 1) % order.length];
}

export function getColourHex(state: ColourState): string {
  return COLOUR_HEX[state] || '#94a3b8';
}

export function getColourLabel(state: ColourState): string {
  return COLOUR_LABELS[state] || 'Not Rated';
}

export function getContrastText(bgHex: string): string {
  const c = bgHex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1e293b' : '#ffffff';
}

export const COLOUR_GRADIENTS: Record<ColourState, string> = {
  grey: 'from-slate-300 to-slate-400',
  green: 'from-green-400 to-green-500',
  yellow: 'from-yellow-400 to-yellow-500',
  red: 'from-red-400 to-red-500',
};

export const COLOUR_ORDER_LABELS: ColourState[] = ['grey', 'green', 'yellow', 'red'];

export function colourToScore(colour: ColourState): number {
  switch (colour) {
    case 'green': return 3;
    case 'yellow': return 2;
    case 'red': return 1;
    default: return 0;
  }
}
