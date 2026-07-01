export type PatternGenerator = (color: string, opacity: number) => string;

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const damaskPattern: PatternGenerator = (color, opacity) => `
  <pattern id="cert-bg-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
    <path d="M30 5 Q35 10 30 15 Q25 10 30 5Z" fill="${esc(color)}" opacity="${opacity * 0.3}" />
    <path d="M30 20 Q33 23 30 26 Q27 23 30 20Z" fill="${esc(color)}" opacity="${opacity * 0.2}" />
    <circle cx="30" cy="40" r="2" fill="${esc(color)}" opacity="${opacity * 0.15}" />
    <circle cx="15" cy="30" r="1.5" fill="${esc(color)}" opacity="${opacity * 0.1}" />
    <circle cx="45" cy="30" r="1.5" fill="${esc(color)}" opacity="${opacity * 0.1}" />
    <path d="M5 10 Q10 5 15 10 Q10 15 5 10Z" fill="${esc(color)}" opacity="${opacity * 0.15}" />
    <path d="M45 10 Q50 5 55 10 Q50 15 45 10Z" fill="${esc(color)}" opacity="${opacity * 0.15}" />
    <path d="M5 50 Q10 45 15 50 Q10 55 5 50Z" fill="${esc(color)}" opacity="${opacity * 0.15}" />
    <path d="M45 50 Q50 45 55 50 Q50 55 45 50Z" fill="${esc(color)}" opacity="${opacity * 0.15}" />
  </pattern>
`;

export const shieldPattern: PatternGenerator = (color, opacity) => `
  <pattern id="cert-bg-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
    <path d="M40 5 L55 20 L55 35 L40 50 L25 35 L25 20 Z" fill="none" stroke="${esc(color)}" stroke-width="0.5" opacity="${opacity * 0.2}" />
    <path d="M40 10 L50 22 L50 32 L40 42 L30 32 L30 22 Z" fill="none" stroke="${esc(color)}" stroke-width="0.3" opacity="${opacity * 0.15}" />
  </pattern>
`;

export const geometricPattern: PatternGenerator = (color, opacity) => `
  <pattern id="cert-bg-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
    <rect x="0" y="0" width="20" height="20" fill="none" stroke="${esc(color)}" stroke-width="0.3" opacity="${opacity * 0.15}" />
    <rect x="20" y="20" width="20" height="20" fill="none" stroke="${esc(color)}" stroke-width="0.3" opacity="${opacity * 0.15}" />
    <line x1="0" y1="0" x2="20" y2="20" stroke="${esc(color)}" stroke-width="0.2" opacity="${opacity * 0.1}" />
    <line x1="40" y1="0" x2="20" y2="20" stroke="${esc(color)}" stroke-width="0.2" opacity="${opacity * 0.1}" />
    <line x1="0" y1="40" x2="20" y2="20" stroke="${esc(color)}" stroke-width="0.2" opacity="${opacity * 0.1}" />
    <line x1="40" y1="40" x2="20" y2="20" stroke="${esc(color)}" stroke-width="0.2" opacity="${opacity * 0.1}" />
  </pattern>
`;

export const confettiPattern: PatternGenerator = (color, opacity) => `
  <pattern id="cert-bg-pattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
    <rect x="5" y="5" width="3" height="3" rx="0.5" fill="${esc(color)}" opacity="${opacity * 0.25}" transform="rotate(30 6.5 6.5)" />
    <circle cx="20" cy="15" r="1.5" fill="${esc(color)}" opacity="${opacity * 0.2}" />
    <rect x="35" y="5" width="2" height="4" rx="0.5" fill="${esc(color)}" opacity="${opacity * 0.2}" transform="rotate(-20 36 7)" />
    <circle cx="10" cy="30" r="1" fill="${esc(color)}" opacity="${opacity * 0.15}" />
    <rect x="25" y="28" width="3" height="2" rx="0.5" fill="${esc(color)}" opacity="${opacity * 0.2}" transform="rotate(45 26.5 29)" />
    <circle cx="42" cy="32" r="1.5" fill="${esc(color)}" opacity="${opacity * 0.15}" />
    <rect x="8" y="40" width="2" height="3" rx="0.5" fill="${esc(color)}" opacity="${opacity * 0.2}" transform="rotate(-45 9 41.5)" />
    <circle cx="30" cy="42" r="1" fill="${esc(color)}" opacity="${opacity * 0.15}" />
  </pattern>
`;

export const parchmentPattern: PatternGenerator = (color, opacity) => `
  <pattern id="cert-bg-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
    <circle cx="15" cy="20" r="8" fill="${esc(color)}" opacity="${opacity * 0.04}" />
    <circle cx="50" cy="45" r="12" fill="${esc(color)}" opacity="${opacity * 0.03}" />
    <circle cx="85" cy="15" r="6" fill="${esc(color)}" opacity="${opacity * 0.04}" />
    <circle cx="30" cy="75" r="10" fill="${esc(color)}" opacity="${opacity * 0.03}" />
    <circle cx="75" cy="65" r="7" fill="${esc(color)}" opacity="${opacity * 0.04}" />
    <circle cx="90" cy="90" r="5" fill="${esc(color)}" opacity="${opacity * 0.03}" />
    <circle cx="10" cy="95" r="4" fill="${esc(color)}" opacity="${opacity * 0.04}" />
  </pattern>
`;

export const diagonalPattern: PatternGenerator = (color, opacity) => `
  <pattern id="cert-bg-pattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="30" stroke="${esc(color)}" stroke-width="0.4" opacity="${opacity * 0.12}" />
  </pattern>
`;

export const patternGenerators: Record<string, PatternGenerator> = {
  damask: damaskPattern,
  shield: shieldPattern,
  geometric: geometricPattern,
  confetti: confettiPattern,
  parchment: parchmentPattern,
  diagonal: diagonalPattern,
};

export function generatePattern(style: string, color: string, opacity: number): string {
  const gen = patternGenerators[style];
  if (!gen) return '';
  return gen(color, opacity);
}
