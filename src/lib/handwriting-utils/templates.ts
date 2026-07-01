import { type HandwritingConfig, type HandwritingTemplateId, DEFAULT_HANDWRITING_CONFIG } from './types';

const clone = (partial: Partial<HandwritingConfig>): HandwritingConfig => ({
  ...DEFAULT_HANDWRITING_CONFIG,
  ...partial,
});

export const TEMPLATE_PRESETS: Record<HandwritingTemplateId, HandwritingConfig> = {
  'classic-ruled': clone({
    templateId: 'classic-ruled',
    sheetTitle: 'Handwriting Practice',
    lineStyle: 'solid',
    lineSpacing: 'medium',
    lineCount: 14,
    showMarginLine: true,
    marginLineColor: '#ef4444',
    lineColor: '#94a3b8',
    contentType: 'blank',
  }),

  'dotted-thirds': clone({
    templateId: 'dotted-thirds',
    sheetTitle: 'Dotted Thirds Practice',
    lineStyle: 'dashed',
    lineSpacing: 'wide',
    lineCount: 10,
    showMarginLine: false,
    lineColor: '#64748b',
    contentType: 'blank',
  }),

  'primary-lines': clone({
    templateId: 'primary-lines',
    sheetTitle: 'Primary Writing Lines',
    lineStyle: 'dashed',
    lineSpacing: 'wide',
    lineCount: 10,
    showMarginLine: true,
    marginLineColor: '#22c55e',
    lineColor: '#3b82f6',
    contentType: 'blank',
  }),

  'handwriting-grid': clone({
    templateId: 'handwriting-grid',
    sheetTitle: 'Handwriting Grid',
    lineStyle: 'solid',
    lineSpacing: 'medium',
    lineCount: 12,
    showMarginLine: false,
    lineColor: '#cbd5e1',
    contentType: 'blank',
  }),

  'trace-write': clone({
    templateId: 'trace-write',
    sheetTitle: 'Trace & Write',
    lineStyle: 'solid',
    lineSpacing: 'medium',
    lineCount: 8,
    showMarginLine: true,
    marginLineColor: '#ef4444',
    lineColor: '#94a3b8',
    contentType: 'tracing-text',
    tracingText: 'The quick brown fox jumps over the lazy dog.\nPack my box with five dozen liquor jugs.\nHow vexingly quick daft zebras jump!',
    fontSize: 16,
  }),

  'story-sheet': clone({
    templateId: 'story-sheet',
    sheetTitle: 'My Story',
    lineStyle: 'solid',
    lineSpacing: 'medium',
    lineCount: 8,
    showMarginLine: true,
    marginLineColor: '#ef4444',
    lineColor: '#94a3b8',
    contentType: 'blank',
    pictureBox: true,
    pictureBoxHeight: 200,
  }),
};
