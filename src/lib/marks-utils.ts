export function distributeMarks(totalMarks: number, count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor(totalMarks / count);
  const remainder = totalMarks - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}
