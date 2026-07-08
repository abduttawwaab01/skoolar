import { create } from 'zustand';
import type { CardOrientation, CardPersonType, BackgroundType, FontSizeLabel, IDCardDesignColors } from '@/lib/id-card-utils/types';

export interface IDCardSelectionState {
  schoolId: string;
  classId: string;
  studentId: string;
  studentIds: string[];
  personType: CardPersonType;
}

export interface IDCardDesignState {
  name: string;
  type: CardPersonType;
  orientation: CardOrientation;
  colors: IDCardDesignColors;
  backgroundType: BackgroundType;
  fontFamily: string;
  fontSize: FontSizeLabel;
  showPhoto: boolean;
  showLogo: boolean;
  showQRCode: boolean;
  showBarcode: boolean;
  showSignature: boolean;
  showWatermark: boolean;
  showExpiryDate: boolean;
  showIssueDate: boolean;
  showMotto: boolean;
  showAddress: boolean;
  showEmergencyInfo: boolean;
  showMedicalInfo: boolean;
  showTerms: boolean;
  showEmail: boolean;
  showParentInfo: boolean;
  showPersonalAddress: boolean;
  watermarkText: string;
  backText: string;
}

export interface IDCardStore {
  design: IDCardDesignState;
  selection: IDCardSelectionState;
  previewSide: 'front' | 'back';
  setDesign: (partial: Partial<IDCardDesignState>) => void;
  setDesignColors: (colors: Partial<IDCardDesignColors>) => void;
  setSelection: (partial: Partial<IDCardSelectionState>) => void;
  setPreviewSide: (side: 'front' | 'back') => void;
  resetDesign: () => void;
  resetSelection: () => void;
}

const DEFAULT_COLORS: IDCardDesignColors = {
  primary: '#059669',
  secondary: '#ffffff',
  accent: '#fbbf24',
  text: '#1e293b',
  textSecondary: '#64748b',
  headerBg: '#059669',
  bg: '#ffffff',
  gradientFrom: '#059669',
  gradientTo: '#047857',
};

const DEFAULT_DESIGN: IDCardDesignState = {
  name: 'Standard',
  type: 'student',
  orientation: 'landscape',
  colors: { ...DEFAULT_COLORS },
  backgroundType: 'dots',
  fontFamily: 'Inter',
  fontSize: 'md',
  showPhoto: true,
  showLogo: true,
  showQRCode: true,
  showBarcode: false,
  showSignature: true,
  showWatermark: true,
  showExpiryDate: false,
  showIssueDate: false,
  showMotto: true,
  showAddress: false,
  showEmergencyInfo: true,
  showMedicalInfo: true,
  showTerms: true,
  showEmail: true,
  showParentInfo: true,
  showPersonalAddress: true,
  watermarkText: '',
  backText: 'This card is the property of the school. It must be presented upon request. Report loss immediately.',
};

const DEFAULT_SELECTION: IDCardSelectionState = {
  schoolId: '',
  classId: '',
  studentId: '',
  studentIds: [],
  personType: 'student',
};

export const useIDCardStore = create<IDCardStore>((set) => ({
  design: { ...DEFAULT_DESIGN },
  selection: { ...DEFAULT_SELECTION },
  previewSide: 'front',

  setDesign: (partial) => set((state) => ({ design: { ...state.design, ...partial } })),
  setDesignColors: (colors) => set((state) => ({
    design: { ...state.design, colors: { ...state.design.colors, ...colors } },
  })),
  setSelection: (partial) => set((state) => ({ selection: { ...state.selection, ...partial } })),
  setPreviewSide: (side) => set({ previewSide: side }),

  resetDesign: () => set({ design: { ...DEFAULT_DESIGN } }),
  resetSelection: () => set({ selection: { ...DEFAULT_SELECTION } }),
}));
