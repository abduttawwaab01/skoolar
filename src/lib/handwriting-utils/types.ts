export type HandwritingLineStyle = 'solid' | 'dashed' | 'dotted';
export type HandwritingSheetSize = 'a4' | 'letter';
export type HandwritingOrientation = 'portrait' | 'landscape';
export type HandwritingContentType = 'blank' | 'tracing-text' | 'tracing-letters' | 'custom-text';
export type HandwritingLineSpacing = 'narrow' | 'medium' | 'wide';
export type HandwritingTheme = 'light' | 'dark' | 'custom';

export type HandwritingTemplateId =
  | 'classic-ruled'
  | 'dotted-thirds'
  | 'primary-lines'
  | 'handwriting-grid'
  | 'trace-write'
  | 'story-sheet';

export interface HandwritingConfig {
  templateId: HandwritingTemplateId;
  sheetTitle: string;
  studentName: string;
  date: string;
  lineStyle: HandwritingLineStyle;
  lineSpacing: HandwritingLineSpacing;
  lineColor: string;
  orientation: HandwritingOrientation;
  paperSize: HandwritingSheetSize;
  margins: number;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  contentType: HandwritingContentType;
  tracingText: string;
  fontSize: number;
  showNameField: boolean;
  showDateField: boolean;
  showTitleField: boolean;
  lineCount: number;
  showMarginLine: boolean;
  marginLineColor: string;
  pictureBox: boolean;
  pictureBoxHeight: number;
  theme: HandwritingTheme;
}

export interface HandwritingTemplateMeta {
  id: HandwritingTemplateId;
  name: string;
  description: string;
  bestFor: string;
  tags: string[];
}

export const LINE_SPACING_PX: Record<HandwritingLineSpacing, number> = {
  narrow: 36,
  medium: 48,
  wide: 60,
};

export const LINE_SPACING_LABELS: Record<HandwritingLineSpacing, string> = {
  narrow: 'Narrow (36px)',
  medium: 'Medium (48px)',
  wide: 'Wide (60px)',
};

export const PAPER_DIMENSIONS: Record<HandwritingSheetSize, { widthMm: number; heightMm: number; label: string }> = {
  a4: { widthMm: 210, heightMm: 297, label: 'A4 (210×297mm)' },
  letter: { widthMm: 215.9, heightMm: 279.4, label: 'Letter (8.5×11")' },
};

export const LINE_STYLE_CSS: Record<HandwritingLineStyle, string> = {
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
};

export const TEMPLATE_META: Record<HandwritingTemplateId, HandwritingTemplateMeta> = {
  'classic-ruled': {
    id: 'classic-ruled',
    name: 'Classic Ruled',
    description: 'Standard wide-ruled paper with left red margin line',
    bestFor: 'General handwriting practice, traditional lined paper',
    tags: ['ruled', 'traditional', 'standard'],
  },
  'dotted-thirds': {
    id: 'dotted-thirds',
    name: 'Dotted Thirds',
    description: 'Three-line system — top dotted, bottom solid, for letter height guides',
    bestFor: 'Letter height guides, Australian-style handwriting',
    tags: ['three-line', 'dotted', 'letter-height'],
  },
  'primary-lines': {
    id: 'primary-lines',
    name: 'Primary Lines',
    description: 'Dashed middle line between solid top and bottom (kindergarten style)',
    bestFor: 'Kindergarten, early primary, beginner writers',
    tags: ['primary', 'dashed-middle', 'kindergarten'],
  },
  'handwriting-grid': {
    id: 'handwriting-grid',
    name: 'Handwriting Grid',
    description: 'Grid paper with cells for letter-by-letter sizing and spacing',
    bestFor: 'Letter spacing practice, calligraphy, precise sizing',
    tags: ['grid', 'sizing', 'precision'],
  },
  'trace-write': {
    id: 'trace-write',
    name: 'Trace & Write',
    description: 'Pre-printed text in light font to trace plus blank lines to copy',
    bestFor: 'Copywork, sight words, sentence practice',
    tags: ['trace', 'copy', 'sight-words'],
  },
  'story-sheet': {
    id: 'story-sheet',
    name: 'Story Sheet',
    description: 'Top half picture box plus bottom half writing lines for story creation',
    bestFor: 'Creative writing, illustrated stories, journal entries',
    tags: ['story', 'picture-box', 'creative-writing'],
  },
};

export const DEFAULT_HANDWRITING_CONFIG: HandwritingConfig = {
  templateId: 'classic-ruled',
  sheetTitle: 'Handwriting Practice',
  studentName: '',
  date: new Date().toISOString().split('T')[0],
  lineStyle: 'solid',
  lineSpacing: 'medium',
  lineColor: '#cbd5e1',
  orientation: 'portrait',
  paperSize: 'a4',
  margins: 20,
  primaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  textColor: '#1e293b',
  contentType: 'blank',
  tracingText: 'The quick brown fox jumps over the lazy dog.\nPack my box with five dozen liquor jugs.\nHow vexingly quick daft zebras jump!',
  fontSize: 18,
  showNameField: true,
  showDateField: true,
  showTitleField: true,
  lineCount: 14,
  showMarginLine: true,
  marginLineColor: '#ef4444',
  pictureBox: true,
  pictureBoxHeight: 180,
  theme: 'light',
};
