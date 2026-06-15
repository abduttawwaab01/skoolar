export function formatScore(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(decimals);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value)}%`;
}

export function ordinal(n: number): string {
  if (n === null || n === undefined) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatAttendance(present: number, total: number): { daysPresent: number; daysAbsent: number; percentage: number } {
  const daysPresent = present ?? 0;
  const daysAbsent = Math.max(0, (total ?? 1) - daysPresent);
  const percentage = total > 0 ? Math.round((daysPresent / total) * 100) : 0;
  return { daysPresent, daysAbsent, percentage };
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'A+': '#065f46', 'A': '#059669', 'A-': '#10b981',
    'B+': '#0369a1', 'B': '#0284c7', 'B-': '#0ea5e6',
    'C': '#d97706', 'D': '#ea580c', 'E': '#dc2626', 'F': '#991b1b',
  };
  return colors[grade] || '#6b7280';
}

export function getGradeBadgeClass(grade: string): string {
  const classes: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'A': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'A-': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'B+': 'bg-sky-100 text-sky-700 border-sky-200',
    'B': 'bg-blue-100 text-blue-700 border-blue-200',
    'C': 'bg-amber-100 text-amber-700 border-amber-200',
    'D': 'bg-orange-100 text-orange-700 border-orange-200',
    'E': 'bg-red-100 text-red-700 border-red-200',
    'F': 'bg-red-200 text-red-800 border-red-300',
  };
  return classes[grade] || 'bg-gray-100 text-gray-700 border-gray-200';
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getTermName(termOrder: number): string {
  const names: Record<number, string> = { 1: 'First', 2: 'Second', 3: 'Third' };
  return names[termOrder] || `${termOrder}th`;
}

export function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen - 1) + '…';
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`);
}
