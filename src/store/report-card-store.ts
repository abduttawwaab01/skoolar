import { create } from 'zustand';

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
  fontFamily: string;
  fontSize: FontSizeLabel;
  showHeader: boolean;
  showLogo: boolean;
  showMotto: boolean;
  showStudentInfo: boolean;
  showSubjectsTable: boolean;
  showDomains: boolean;
  showChart: boolean;
  showAttendance: boolean;
  showRemarks: boolean;
  showWatermark: boolean;
  watermarkText: string;
}

export interface SelectionState {
  schoolId: string;
  classId: string;
  termId: string;
  studentId: string;
}

interface ReportCardStore {
  design: ReportCardDesignState;
  selection: SelectionState;
  setDesign: (partial: Partial<ReportCardDesignState>) => void;
  setDesignColors: (colors: Partial<ReportCardDesignColors>) => void;
  setSelection: (partial: Partial<SelectionState>) => void;
  resetDesign: () => void;
  resetSelection: () => void;
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
  fontFamily: 'Inter',
  fontSize: 'md',
  showHeader: true,
  showLogo: true,
  showMotto: true,
  showStudentInfo: true,
  showSubjectsTable: true,
  showDomains: true,
  showChart: true,
  showAttendance: true,
  showRemarks: true,
  showWatermark: false,
  watermarkText: '',
};

const DEFAULT_SELECTION: SelectionState = {
  schoolId: '',
  classId: '',
  termId: '',
  studentId: '',
};

export const useReportCardStore = create<ReportCardStore>((set) => ({
  design: { ...DEFAULT_DESIGN },
  selection: { ...DEFAULT_SELECTION },

  setDesign: (partial) => set((state) => ({ design: { ...state.design, ...partial } })),
  setDesignColors: (colors) => set((state) => ({ design: { ...state.design, colors: { ...state.design.colors, ...colors } } })),
  setSelection: (partial) => set((state) => ({ selection: { ...state.selection, ...partial } })),

  resetDesign: () => set({ design: { ...DEFAULT_DESIGN } }),
  resetSelection: () => set({ selection: { ...DEFAULT_SELECTION } }),
}));
