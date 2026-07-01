import {
  type BehaviourConfig,
  type BehaviourTemplateId,
  DEFAULT_BEHAVIOUR_CONFIG,
  CATEGORY_PRESETS,
  DEFAULT_GOALS,
} from './types';

const base = (partial: Partial<BehaviourConfig>): BehaviourConfig => ({
  ...DEFAULT_BEHAVIOUR_CONFIG,
  ...partial,
  students: partial.students || DEFAULT_BEHAVIOUR_CONFIG.students.map(s => ({ ...s, scores: {} })),
  categories: partial.categories || CATEGORY_PRESETS.default.categories.map(c => ({ ...c })),
});

export const TEMPLATE_PRESETS: Record<BehaviourTemplateId, BehaviourConfig> = {
  'daily-star-chart': base({
    templateId: 'daily-star-chart',
    chartTitle: 'Daily Star Chart',
    periodType: 'daily',
    categories: CATEGORY_PRESETS.default.categories.map(c => ({ ...c })),
    showTotals: true,
    showRewardTrack: true,
    rewards: [
      { threshold: 10, label: 'Small Prize', emoji: '🍬' },
      { threshold: 25, label: 'Extra Play', emoji: '🎮' },
      { threshold: 50, label: 'Special Treat', emoji: '🎁' },
    ],
  }),

  'weekly-class-chart': base({
    templateId: 'weekly-class-chart',
    chartTitle: 'Weekly Class Chart',
    periodType: 'weekly',
    periodLabel: 'Week of',
    categories: [
      { id: 'daily', label: 'Daily Star', emoji: '⭐', maxScore: 5 },
    ],
    showNames: true,
    showTotals: true,
    showRewardTrack: false,
  }),

  'monthly-goal-tracker': base({
    templateId: 'monthly-goal-tracker',
    chartTitle: 'My Goal Tracker',
    periodType: 'monthly',
    periodLabel: 'Month of',
    categories: [],
    goals: DEFAULT_GOALS.map(g => ({ ...g })),
    showNames: false,
    showTotals: true,
    showRewardTrack: true,
    rewards: [
      { threshold: 10, label: 'Well Done!', emoji: '🌟' },
      { threshold: 20, label: 'Star Achiever', emoji: '🏅' },
    ],
    selectedStudentId: 's1',
  }),

  'colour-behaviour-chart': base({
    templateId: 'colour-behaviour-chart',
    chartTitle: 'Behaviour Colour Chart',
    periodType: 'daily',
    periodLabel: 'This Week',
    categories: [
      { id: 'conduct', label: 'Conduct', emoji: '🎨', maxScore: 3 },
    ],
    showNames: true,
    showTotals: true,
    showRewardTrack: false,
    colourCycleOrder: ['grey', 'green', 'yellow', 'red'],
    starColor: '#22c55e',
    primaryColor: '#059669',
  }),

  'reward-ladder': base({
    templateId: 'reward-ladder',
    chartTitle: 'Reward Ladder',
    periodType: 'weekly',
    periodLabel: 'Ongoing',
    categories: CATEGORY_PRESETS.default.categories.map(c => ({ ...c })),
    showNames: true,
    showTotals: true,
    showRewardTrack: true,
    rewards: [
      { threshold: 10, label: 'Sticker', emoji: '⭐' },
      { threshold: 25, label: 'Play Time', emoji: '🎮' },
      { threshold: 50, label: 'Prize Box', emoji: '🎁' },
      { threshold: 100, label: 'Field Trip', emoji: '🚌' },
      { threshold: 200, label: 'Grand Prize', emoji: '🏆' },
    ],
  }),

  'sticker-collection': base({
    templateId: 'sticker-collection',
    chartTitle: 'My Sticker Collection',
    periodType: 'weekly',
    categories: [],
    showNames: false,
    showTotals: false,
    showRewardTrack: false,
    stickerTheme: 'space',
    starSize: 'lg',
    starColor: '#f59e0b',
    backgroundColor: '#0f172a',
    students: [],
  }),
};
