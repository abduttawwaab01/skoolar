import { type MathDrillConfig, DEFAULT_MATH_DRILL_CONFIG } from './types';

const clone = (partial: Partial<MathDrillConfig>): MathDrillConfig => ({
  ...DEFAULT_MATH_DRILL_CONFIG,
  ...partial,
});

export const TEMPLATE_PRESETS: Record<string, MathDrillConfig> = {
  'addition-drill': clone({
    templateId: 'addition-drill',
    sheetTitle: 'Addition Practice',
    difficulty: 'easy',
    operations: ['+'],
    numberOfQuestions: 20,
    columns: 3,
    includeCarrying: false,
    showAnswerKey: false,
  }),

  'subtraction-drill': clone({
    templateId: 'subtraction-drill',
    sheetTitle: 'Subtraction Practice',
    difficulty: 'easy',
    operations: ['-'],
    numberOfQuestions: 20,
    columns: 3,
    includeBorrowing: false,
    showAnswerKey: false,
  }),

  'multiplication-drill': clone({
    templateId: 'multiplication-drill',
    sheetTitle: 'Multiplication Practice',
    difficulty: 'easy',
    operations: ['×'],
    numberOfQuestions: 20,
    columns: 3,
    showAnswerKey: false,
  }),

  'division-drill': clone({
    templateId: 'division-drill',
    sheetTitle: 'Division Practice',
    difficulty: 'easy',
    operations: ['÷'],
    numberOfQuestions: 20,
    columns: 3,
    includeRemainders: true,
    showAnswerKey: false,
  }),

  'mixed-operations': clone({
    templateId: 'mixed-operations',
    sheetTitle: 'Mixed Operations Challenge',
    difficulty: 'medium',
    operations: ['+', '-', '×', '÷'],
    numberOfQuestions: 25,
    columns: 3,
    includeCarrying: true,
    includeBorrowing: true,
    includeRemainders: true,
    showAnswerKey: true,
  }),

  'times-table-drill': clone({
    templateId: 'times-table-drill',
    sheetTitle: 'Times Table Drill',
    difficulty: 'easy',
    operations: ['×'],
    numberOfQuestions: 36,
    columns: 4,
    showAnswerKey: false,
    timesTableNumber: 2,
  }),
};
