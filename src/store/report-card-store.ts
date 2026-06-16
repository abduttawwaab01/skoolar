import { create } from 'zustand';
import { DEFAULT_TEMPLATES, type ReportCardPreset } from '@/lib/report-card-utils/default-templates';
import { DEFAULT_THRESHOLDS } from '@/lib/report-card-utils/grade-calculator';

export type ApprovalStatus = 'draft' | 'submitted' | 'approved' | 'published' | 'archived';
export type ExportFormat = 'pdf' | 'png' | 'csv' | 'docx';
export type DeliveryMethod = 'whatsapp' | 'email';
export type BackgroundType = 'solid' | 'gradient' | 'image';
export type FontSizeLabel = 'sm' | 'md' | 'lg';

export interface ReportCardDesignColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  headerBg: string;
  bg: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export interface ReportCardDesignState {
  name: string;
  orientation: 'portrait' | 'landscape';
  colors: ReportCardDesignColors;
  backgroundType: BackgroundType;
  fontFamily: string;
  fontSize: FontSizeLabel;
  showHeader: boolean;
  showLogo: boolean;
  showMotto: boolean;
  showAddress: boolean;
  showContacts: boolean;
  showStudentPhoto: boolean;
  showStudentInfo: boolean;
  showSubjectsTable: boolean;
  showDomains: boolean;
  showChart: boolean;
  showAttendance: boolean;
  showRemarks: boolean;
  showSignatures: boolean;
  showFooter: boolean;
  showWatermark: boolean;
  watermarkText: string;
  gradingScaleId: string;
}

export interface SelectionState {
  schoolId: string;
  classId: string;
  termId: string;
  studentId: string;
  studentIds: string[];
  approvalStatusFilter: ApprovalStatus | '';
  searchQuery: string;
}

export interface PreviewState {
  previewSrc: string | null;
  previewLoading: boolean;
}

export interface GenerationState {
  generating: boolean;
  bulkGenerating: boolean;
  generateProgress: number;
}

interface ReportCardStore {
  design: ReportCardDesignState;
  selection: SelectionState;
  preview: PreviewState;
  generation: GenerationState;
  selectedPresetId: string;

  setDesign: (partial: Partial<ReportCardDesignState>) => void;
  setDesignColors: (colors: Partial<ReportCardDesignColors>) => void;
  setSelection: (partial: Partial<SelectionState>) => void;
  setPreview: (partial: Partial<PreviewState>) => void;
  setGeneration: (partial: Partial<GenerationState>) => void;
  setSelectedPresetId: (id: string) => void;
  resetDesign: () => void;
  resetSelection: () => void;
  applyPreset: (preset: ReportCardPreset) => void;
}

const DEFAULT_DESIGN: ReportCardDesignState = {
  name: 'Custom',
  orientation: 'portrait',
  colors: {
    primary: '#059669',
    secondary: '#FFFFFF',
    accent: '#fbbf24',
    text: '#1e293b',
    textSecondary: '#64748b',
    headerBg: '#059669',
    bg: '#ffffff',
    gradientFrom: '#059669',
    gradientTo: '#047857',
  },
  backgroundType: 'solid',
  fontFamily: 'Inter',
  fontSize: 'md',
  showHeader: true,
  showLogo: true,
  showMotto: true,
  showAddress: true,
  showContacts: false,
  showStudentPhoto: false,
  showStudentInfo: true,
  showSubjectsTable: true,
  showDomains: true,
  showChart: true,
  showAttendance: true,
  showRemarks: true,
  showSignatures: true,
  showFooter: true,
  showWatermark: false,
  watermarkText: '',
  gradingScaleId: 'default',
};

const DEFAULT_SELECTION: SelectionState = {
  schoolId: '',
  classId: '',
  termId: '',
  studentId: '',
  studentIds: [],
  approvalStatusFilter: '',
  searchQuery: '',
};

export const useReportCardStore = create<ReportCardStore>((set) => ({
  design: { ...DEFAULT_DESIGN },
  selection: { ...DEFAULT_SELECTION },
  preview: { previewSrc: null, previewLoading: false },
  generation: { generating: false, bulkGenerating: false, generateProgress: 0 },
  selectedPresetId: '',

  setDesign: (partial) => set((state) => ({ design: { ...state.design, ...partial } })),
  setDesignColors: (colors) => set((state) => ({ design: { ...state.design, colors: { ...state.design.colors, ...colors } } })),
  setSelection: (partial) => set((state) => ({ selection: { ...state.selection, ...partial } })),
  setPreview: (partial) => set((state) => ({ preview: { ...state.preview, ...partial } })),
  setGeneration: (partial) => set((state) => ({ generation: { ...state.generation, ...partial } })),
  setSelectedPresetId: (id) => set({ selectedPresetId: id }),

  resetDesign: () => set({ design: { ...DEFAULT_DESIGN }, selectedPresetId: '' }),
  resetSelection: () => set({ selection: { ...DEFAULT_SELECTION } }),

  applyPreset: (preset: any) => set(() => ({
    design: {
      name: preset.name,
      orientation: preset.orientation || 'portrait',
      colors: {
        primary: preset.colors?.primary || '#059669',
        secondary: preset.colors?.secondary || '#FFFFFF',
        accent: preset.colors?.accent || '#fbbf24',
        text: preset.colors?.text || '#1e293b',
        textSecondary: preset.colors?.textSecondary || '#64748b',
        headerBg: preset.colors?.headerBg || '#059669',
        bg: preset.colors?.bg || '#ffffff',
        gradientFrom: preset.colors?.gradientFrom,
        gradientTo: preset.colors?.gradientTo,
      },
      backgroundType: preset.backgroundType || 'solid',
      fontFamily: preset.fontFamily || 'Inter',
      fontSize: (preset.fontSize as FontSizeLabel) || 'md',
      showHeader: preset.showHeader !== false,
      showLogo: preset.showLogo !== false,
      showMotto: preset.showMotto !== false,
      showAddress: preset.showAddress !== false,
      showContacts: preset.showContacts === true,
      showStudentPhoto: preset.showStudentPhoto === true,
      showStudentInfo: preset.showStudentInfo !== false,
      showSubjectsTable: preset.showSubjectsTable !== false,
      showDomains: preset.showDomains !== false,
      showChart: preset.showChart !== false,
      showAttendance: preset.showAttendance !== false,
      showRemarks: preset.showRemarks !== false,
      showSignatures: preset.showSignatures !== false,
      showFooter: preset.showFooter !== false,
      showWatermark: preset.showWatermark === true,
      watermarkText: preset.watermarkText || '',
      gradingScaleId: preset.gradingScaleId || 'default',
    },
    selectedPresetId: preset.id || '',
  })),
}));
