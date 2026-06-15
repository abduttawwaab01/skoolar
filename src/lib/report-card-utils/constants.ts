export const A4 = {
  WIDTH_MM: 210,
  HEIGHT_MM: 297,
  PREVIEW_SCALE: 1.5,
  EXPORT_SCALE: 4,
  PADDING: 15,
} as const;

export const MM = (mm: number) => Math.round((mm / 25.4) * 600);
export const PW = MM(A4.WIDTH_MM);
export const PH = MM(A4.HEIGHT_MM);

export const SECTION_SPACING = 6;
export const TABLE_ROW_HEIGHT = 5.5;
export const FONT_SIZES = {
  sm: { header: 11, title: 10, body: 7.5, small: 6 },
  md: { header: 13, title: 11, body: 8.5, small: 7 },
  lg: { header: 15, title: 13, body: 9.5, small: 8 },
} as const;

export const GRADE_LABELS = ['A+', 'A', 'A-', 'B+', 'B', 'C', 'D', 'E', 'F'] as const;
export const GRADE_COLORS: Record<string, string> = {
  'A+': '#065f46', 'A': '#059669', 'A-': '#10b981',
  'B+': '#0369a1', 'B': '#0284c7', 'B-': '#0ea5e6',
  'C': '#d97706', 'D': '#ea580c', 'E': '#dc2626', 'F': '#991b1b',
};

export const DOMAIN_TRAITS = {
  cognitive: [
    { key: 'reasoning', label: 'Critical Thinking' },
    { key: 'memory', label: 'Memory' },
    { key: 'concentration', label: 'Concentration' },
    { key: 'problemSolving', label: 'Problem Solving' },
    { key: 'initiative', label: 'Initiative' },
  ],
  psychomotor: [
    { key: 'handwriting', label: 'Handwriting' },
    { key: 'sports', label: 'Sports' },
    { key: 'drawing', label: 'Drawing' },
    { key: 'practical', label: 'Practical Skills' },
  ],
  affective: [
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'neatness', label: 'Neatness' },
    { key: 'honesty', label: 'Honesty' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'cooperation', label: 'Cooperation' },
    { key: 'attentiveness', label: 'Attentiveness' },
    { key: 'obedience', label: 'Obedience' },
    { key: 'selfControl', label: 'Self Control' },
    { key: 'politeness', label: 'Politeness' },
  ],
} as const;

export const RATING_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Very Good',
  3: 'Good',
  2: 'Fair',
  1: 'Poor',
};

export const APPROVAL_STATUSES = ['draft', 'submitted', 'approved', 'published', 'archived'] as const;

export const PROMOTION_STATUSES = ['promoted', 'conditional', 'repeated', 'graduated'] as const;

export const DELIVERY_METHODS = ['whatsapp', 'email'] as const;
export const DELIVERY_STATUSES = ['pending', 'sent', 'delivered', 'failed', 'read'] as const;

export const EXPORT_FORMATS = ['pdf', 'png', 'csv', 'docx'] as const;

export const DOMAIN_CATEGORIES = ['cognitive', 'psychomotor', 'affective'] as const;

export const DEFAULT_PASS_MARK = 50;
export const DEFAULT_GRADE_SCALE_ID = 'default';
