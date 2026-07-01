export type BehaviourTemplateId =
  | 'daily-star-chart'
  | 'weekly-class-chart'
  | 'monthly-goal-tracker'
  | 'colour-behaviour-chart'
  | 'reward-ladder'
  | 'sticker-collection';

export type PeriodType = 'daily' | 'weekly' | 'monthly';
export type StarSize = 'sm' | 'md' | 'lg';
export type ColourState = 'grey' | 'green' | 'yellow' | 'red';

export interface StudentBehaviourEntry {
  id: string;
  name: string;
  scores: Record<string, number>;
  notes?: string;
  colour?: ColourState;
  ladderRung?: number;
  goals?: Record<string, number>;
}

export interface BehaviourCategory {
  id: string;
  label: string;
  emoji: string;
  maxScore: number;
}

export interface BehaviourReward {
  threshold: number;
  label: string;
  emoji?: string;
}

export interface BehaviourGoal {
  id: string;
  label: string;
  emoji: string;
}

export interface BehaviourConfig {
  templateId: BehaviourTemplateId;
  chartTitle: string;
  periodType: PeriodType;
  periodLabel: string;
  date: string;
  schoolName: string;
  students: StudentBehaviourEntry[];
  categories: BehaviourCategory[];
  goals: BehaviourGoal[];
  categoryPreset: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  starColor: string;
  starSize: StarSize;
  showNames: boolean;
  showTotals: boolean;
  showRewardTrack: boolean;
  rewards: BehaviourReward[];
  colourCycleOrder: ColourState[];
  stickerTheme: 'space' | 'ocean' | 'garden';
  selectedStudentId: string | null;
}

export const TEMPLATE_META: Record<BehaviourTemplateId, { name: string; description: string; bestFor: string }> = {
  'daily-star-chart': { name: 'Daily Star Chart', description: 'Multi-category grid with stars per cell', bestFor: 'Daily multi-category tracking' },
  'weekly-class-chart': { name: 'Weekly Class Chart', description: 'One star per day, simple grid', bestFor: 'Quick weekly check' },
  'monthly-goal-tracker': { name: 'Monthly Goal Tracker', description: 'Individual goals with milestone stars', bestFor: 'Personal goal setting' },
  'colour-behaviour-chart': { name: 'Colour Behaviour Chart', description: 'Traffic light system per student', bestFor: 'Behaviour conduct grades' },
  'reward-ladder': { name: 'Reward Ladder', description: 'Ascending ladder with reward milestones', bestFor: 'Motivation & gamification' },
  'sticker-collection': { name: 'Sticker Collection', description: 'Themed circles for physical stickers', bestFor: 'Nursery/early primary' },
};

export const CATEGORY_PRESETS: Record<string, { label: string; categories: BehaviourCategory[] }> = {
  default: {
    label: 'Default (5 Categories)',
    categories: [
      { id: 'punctuality', label: 'Punctuality', emoji: '⏰', maxScore: 3 },
      { id: 'respect', label: 'Respect', emoji: '🙏', maxScore: 3 },
      { id: 'participation', label: 'Participation', emoji: '🙋', maxScore: 3 },
      { id: 'discipline', label: 'Discipline', emoji: '📏', maxScore: 3 },
      { id: 'teamwork', label: 'Teamwork', emoji: '🤝', maxScore: 3 },
    ],
  },
  academic: {
    label: 'Academic',
    categories: [
      { id: 'hw-completion', label: 'Homework', emoji: '📚', maxScore: 3 },
      { id: 'classwork', label: 'Classwork', emoji: '✏️', maxScore: 3 },
      { id: 'quiz', label: 'Quiz Performance', emoji: '📝', maxScore: 3 },
      { id: 'reading', label: 'Reading', emoji: '📖', maxScore: 3 },
    ],
  },
  conduct: {
    label: 'Conduct',
    categories: [
      { id: 'politeness', label: 'Politeness', emoji: '😊', maxScore: 3 },
      { id: 'tidiness', label: 'Tidiness', emoji: '🧹', maxScore: 3 },
      { id: 'helpfulness', label: 'Helpfulness', emoji: '🤲', maxScore: 3 },
      { id: 'honesty', label: 'Honesty', emoji: '💎', maxScore: 3 },
    ],
  },
};

export const DEFAULT_GOALS: BehaviourGoal[] = [
  { id: 'goal-1', label: 'Complete Homework', emoji: '📚' },
  { id: 'goal-2', label: 'Be Respectful', emoji: '🙏' },
  { id: 'goal-3', label: 'Participate in Class', emoji: '🙋' },
  { id: 'goal-4', label: 'Stay Organized', emoji: '📋' },
];

export const STICKER_THEMES = {
  space: { label: 'Space', emoji: '🚀', bgColor: '#0f172a', circleBorder: '#38bdf8' },
  ocean: { label: 'Ocean', emoji: '🌊', bgColor: '#e0f2fe', circleBorder: '#0ea5e9' },
  garden: { label: 'Garden', emoji: '🌸', bgColor: '#f0fdf4', circleBorder: '#22c55e' },
};

export const DEFAULT_BEHAVIOUR_CONFIG: BehaviourConfig = {
  templateId: 'daily-star-chart',
  chartTitle: 'Behaviour Star Chart',
  periodType: 'daily',
  periodLabel: 'Week 1',
  date: new Date().toISOString().split('T')[0],
  schoolName: 'My School',
  students: [
    { id: 's1', name: 'Student 1', scores: {} },
    { id: 's2', name: 'Student 2', scores: {} },
    { id: 's3', name: 'Student 3', scores: {} },
  ],
  categories: [...CATEGORY_PRESETS.default.categories],
  goals: [...DEFAULT_GOALS],
  categoryPreset: 'default',
  primaryColor: '#6366f1',
  secondaryColor: '#a5b4fc',
  accentColor: '#eef2ff',
  backgroundColor: '#ffffff',
  textColor: '#1e293b',
  borderColor: '#e2e8f0',
  starColor: '#f59e0b',
  starSize: 'md',
  showNames: true,
  showTotals: true,
  showRewardTrack: false,
  rewards: [
    { threshold: 10, label: 'Small Prize', emoji: '🍬' },
    { threshold: 25, label: 'Extra Play Time', emoji: '🎮' },
    { threshold: 50, label: 'Special Treat', emoji: '🎁' },
    { threshold: 100, label: 'Grand Prize', emoji: '🏆' },
  ],
  colourCycleOrder: ['grey', 'green', 'yellow', 'red'],
  stickerTheme: 'space',
  selectedStudentId: null,
};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const COLOUR_LABELS: Record<ColourState, string> = {
  grey: 'Not Rated',
  green: 'Good',
  yellow: 'Warning',
  red: 'Poor',
};

export const COLOUR_HEX: Record<ColourState, string> = {
  grey: '#94a3b8',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

let studentCounter = 4;
export function generateStudentId(): string {
  return `s${studentCounter++}`;
}

export function computeStudentTotal(student: StudentBehaviourEntry): number {
  return Object.values(student.scores).reduce((sum, v) => sum + v, 0);
}

export function computeStudentMax(categories: BehaviourCategory[]): number {
  return categories.reduce((sum, c) => sum + c.maxScore, 0);
}

export function computeClassTotals(students: StudentBehaviourEntry[], categories: BehaviourCategory[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const cat of categories) {
    totals[cat.id] = students.reduce((sum, s) => sum + (s.scores[cat.id] || 0), 0);
  }
  return totals;
}
