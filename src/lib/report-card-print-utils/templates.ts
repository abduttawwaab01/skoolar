import { type ReportCardPrintConfig, DEFAULT_REPORT_CARD_PRINT_CONFIG, TERM_1_SCORE_TYPES, TERM_2_SCORE_TYPES, TERM_3_SCORE_TYPES } from './types';

const clone = (partial: Partial<ReportCardPrintConfig>): ReportCardPrintConfig => ({
  ...DEFAULT_REPORT_CARD_PRINT_CONFIG,
  ...partial,
});

export const TEMPLATE_PRESETS: Record<string, ReportCardPrintConfig> = {
  classic: clone({
    templateId: 'classic',
    primaryColor: '#1e40af',
    secondaryColor: '#3b82f6',
  }),
  modern: clone({
    templateId: 'modern',
    primaryColor: '#0d9488',
    secondaryColor: '#14b8a6',
  }),
  vibrant: clone({
    templateId: 'vibrant',
    primaryColor: '#ea580c',
    secondaryColor: '#f59e0b',
  }),
  executive: clone({
    templateId: 'executive',
    primaryColor: '#1e293b',
    secondaryColor: '#d97706',
  }),
  compact: clone({
    templateId: 'compact',
    primaryColor: '#2563eb',
    secondaryColor: '#60a5fa',
    fontSize: 7,
  }),
};

export const TERM_SCORE_TYPE_PRESETS: Record<string, { label: string; types: typeof TERM_1_SCORE_TYPES }> = {
  'first': { label: '1st Term', types: TERM_1_SCORE_TYPES },
  'second': { label: '2nd Term', types: TERM_2_SCORE_TYPES },
  'third': { label: '3rd Term (Cumulative)', types: TERM_3_SCORE_TYPES },
};
