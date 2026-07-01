export type MathDrillTemplateId =
  | 'addition-drill'
  | 'subtraction-drill'
  | 'multiplication-drill'
  | 'division-drill'
  | 'mixed-operations'
  | 'times-table-drill'
;

export type MathDrillDifficulty = 'easy' | 'medium' | 'hard';

export type MathDrillOperation = '+' | '-' | '×' | '÷';

export interface MathProblem {
  id: number;
  operand1: number;
  operand2: number;
  operator: MathDrillOperation;
  answer: number;
}

export interface MathDrillConfig {
  templateId: MathDrillTemplateId;
  sheetTitle: string;
  studentName: string;
  date: string;
  difficulty: MathDrillDifficulty;
  operations: MathDrillOperation[];
  numberOfQuestions: number;
  columns: number;
  showAnswerKey: boolean;
  showNameField: boolean;
  showDateField: boolean;
  showTitleField: boolean;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  orientation: 'portrait' | 'landscape';
  paperSize: 'a4' | 'letter';
  includeBorrowing: boolean;
  includeCarrying: boolean;
  includeRemainders: boolean;
  timesTableNumber: number;
}

export interface MathDrillTemplateMeta {
  id: MathDrillTemplateId;
  name: string;
  description: string;
  bestFor: string;
  tags: string[];
}

export const DIFFICULTY_RANGES: Record<MathDrillDifficulty, { min: number; max: number; label: string }> = {
  easy: { min: 1, max: 9, label: 'Easy (1-digit, 0-9)' },
  medium: { min: 10, max: 99, label: 'Medium (2-digit, 10-99)' },
  hard: { min: 100, max: 999, label: 'Hard (3-digit, 100-999)' },
};

export const DIFFICULTY_QUESTION_LIMITS: Record<MathDrillDifficulty, { min: number; max: number }> = {
  easy: { min: 5, max: 50 },
  medium: { min: 5, max: 40 },
  hard: { min: 5, max: 30 },
};

export const QUESTION_COUNTS: number[] = [5, 10, 15, 20, 25, 30, 40, 50];
export const COLUMN_OPTIONS: number[] = [1, 2, 3, 4];
export const OP_SYMBOLS: Record<MathDrillOperation, string> = {
  '+': '+',
  '-': '-',
  '×': '×',
  '÷': '÷',
};

export const TEMPLATE_META: Record<MathDrillTemplateId, MathDrillTemplateMeta> = {
  'addition-drill': {
    id: 'addition-drill',
    name: 'Addition Practice',
    description: 'Vertical addition with carry or without, designed for classroom drill',
    bestFor: 'Addition skills and mental math, classroom or personal practice',
    tags: ['arithmetic', 'math', 'classwork', 'assessment'],
  },

  'subtraction-drill': {
    id: 'subtraction-drill',
    name: 'Subtraction Practice',
    description: 'Vertical subtraction including borrowing (regrouping), problem-solving skills',
    bestFor: 'Subtraction fluency, testing consolidation of subtraction concepts',
    tags: ['arithmetic', 'math', 'classwork', 'computation'],
  },

  'multiplication-drill': {
    id: 'multiplication-drill',
    name: 'Multiplication Practice',
    description: 'Multi-digit multiplication, including carrying, building multiplication speed',
    bestFor: 'Multiplication fact and algorithm mastery, elementary to middle school',
    tags: ['arithmetic', 'math', 'times-tables', 'calculated'],
  },

  'division-drill': {
    id: 'division-drill',
    name: 'Division Practice',
    description: 'Long division problems including remainders, algorithm practice',
    bestFor: 'Division skills, distributive property application',
    tags: ['arithmetic', 'math', 'algorithm', 'long-division'],
  },

  'mixed-operations': {
    id: 'mixed-operations',
    name: 'Mixed Operations Challenge',
    description: 'Random mix of all four operations for comprehensive review',
    bestFor: 'Operation selection and flexible thinking, assessment of mixed skills',
    tags: ['arithmetic', 'math', 'problem-solving', 'comprehensive'],
  },

  'times-table-drill': {
    id: 'times-table-drill',
    name: 'Times Table Drill',
    description: 'Fill-in-the-blank times table for a specific multiplier (2–12)',
    bestFor: 'Memorization of specific multiplication tables, classroom drill',
    tags: ['arithmetic', 'math', 'memorization', 'times-tables'],
  },
};

export const DEFAULT_MATH_DRILL_CONFIG: MathDrillConfig = {
  templateId: 'mixed-operations',
  sheetTitle: 'Math Fact Drill Sheet',
  studentName: '',
  date: new Date().toISOString().split('T')[0],
  difficulty: 'easy',
  operations: ['+', '-', '×', '÷'],
  numberOfQuestions: 20,
  columns: 3,
  showAnswerKey: false,
  showNameField: true,
  showDateField: true,
  showTitleField: true,
  primaryColor: '#059669', // Green
  backgroundColor: '#ffffff',
  textColor: '#1e293b',
  fontSize: 14,
  orientation: 'portrait',
  paperSize: 'a4',
  includeBorrowing: false,
  includeCarrying: false,
  includeRemainders: true,
  timesTableNumber: 2,
};

export const DIFFICULTY_LETTERS: Record<MathDrillDifficulty, string> = {
  easy: 'E',
  medium: 'M',
  hard: 'H',
};

export const MAX_OPERANDS: Record<MathDrillDifficulty, { addition: number; subtraction: number; multiplication: number; division: number }> = {
  easy: { addition: 9, subtraction: 9, multiplication: 9, division: 12 },
  medium: { addition: 99, subtraction: 99, multiplication: 12, division: 30 },
  hard: { addition: 999, subtraction: 999, multiplication: 12, division: 100 },
};

export const DIVISION_MAX_ANSWER: Record<MathDrillDifficulty, number> = {
  easy: 30,
  medium: 100,
  hard: 500,
};