import { create } from 'zustand';

export type PersonType = 'student' | 'teacher' | 'staff' | 'executive';
export type Orientation = 'landscape' | 'portrait';
export type CardSide = 'front' | 'back';
export type FontSize = 'sm' | 'md' | 'lg';
export type BackgroundType = 'solid' | 'gradient' | 'image' | 'glass';

export interface DesignColors {
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

export interface PersonData {
  fullName: string;
  displayId: string;
  role: string;
  department: string;
  className: string;
  section: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  house: string;
  academicSession: string;
  designation: string;
  position: string;
}

export interface IDCardDesignState {
  name: string;
  orientation: Orientation;
  colors: DesignColors;
  backgroundType: BackgroundType;
  fontFamily: string;
  fontSize: FontSize;
  showPhoto: boolean;
  showLogo: boolean;
  showQRCode: boolean;
  showBarcode: boolean;
  showSignature: boolean;
  showWatermark: boolean;
  showMotto: boolean;
  showExpiryDate: boolean;
  showIssueDate: boolean;
  qrPosition: 'front' | 'back' | 'both';
  backLayoutType: 'standard' | 'minimal' | 'detailed';
  showEmergencyInfo: boolean;
  showMedicalInfo: boolean;
  showTerms: boolean;
  showSignatory: boolean;
  showSchoolInfo: boolean;
  backText: string;
  termsText: string;
  signatureUrl: string | null;
  signatureLabel: string;
  watermarkText: string;
}

interface IDCardStore {
  // Person selection
  personType: PersonType;
  selectedPersonId: string;
  personData: PersonData;
  photoFile: string | null;
  logoFile: string | null;
  signatureFile: string | null;

  // Card state
  cardSide: CardSide;
  design: IDCardDesignState;
  selectedDesignId: string;

  // Preview
  previewSrc: string | null;
  previewLoading: boolean;

  // Bulk
  bulkOrientation: Orientation;
  bulkExporting: boolean;

  // Actions
  setPersonType: (type: PersonType) => void;
  setSelectedPersonId: (id: string) => void;
  setPersonData: (data: Partial<PersonData>) => void;
  setPhotoFile: (file: string | null) => void;
  setLogoFile: (file: string | null) => void;
  setSignatureFile: (file: string | null) => void;
  setCardSide: (side: CardSide) => void;
  setDesign: (design: Partial<IDCardDesignState>) => void;
  setSelectedDesignId: (id: string) => void;
  setPreviewSrc: (src: string | null) => void;
  setPreviewLoading: (loading: boolean) => void;
  setBulkOrientation: (orientation: Orientation) => void;
  setBulkExporting: (exporting: boolean) => void;
  resetDesign: () => void;
  resetPerson: () => void;
}

const DEFAULT_DESIGN: IDCardDesignState = {
  name: 'Custom',
  orientation: 'landscape',
  colors: {
    primary: '#059669',
    secondary: '#FFFFFF',
    accent: '#fbbf24',
    text: '#1e293b',
    textSecondary: '#64748b',
    headerBg: '#059669',
    bg: '#ffffff',
  },
  backgroundType: 'solid',
  fontFamily: 'Inter',
  fontSize: 'md',
  showPhoto: true,
  showLogo: true,
  showQRCode: true,
  showBarcode: false,
  showSignature: true,
  showWatermark: true,
  showMotto: true,
  showExpiryDate: false,
  showIssueDate: true,
  qrPosition: 'front',
  backLayoutType: 'standard',
  showEmergencyInfo: true,
  showMedicalInfo: true,
  showTerms: true,
  showSignatory: true,
  showSchoolInfo: true,
  backText: 'This ID card remains the property of the school.\nIf found, please return to the school office.\n\nTerms:\n1. Always carry this ID while on school premises\n2. Do not share or lend your ID card\n3. Report lost cards immediately\n4. Return card upon leaving the school',
  termsText: '',
  signatureUrl: null,
  signatureLabel: 'Authorized Signatory',
  watermarkText: '',
};

const DEFAULT_PERSON: PersonData = {
  fullName: '',
  displayId: '',
  role: '',
  department: '',
  className: '',
  section: '',
  gender: '',
  dateOfBirth: '',
  bloodGroup: 'O+',
  phone: '',
  email: '',
  address: '',
  house: '',
  academicSession: '',
  designation: '',
  position: '',
};

export const useIDCardStore = create<IDCardStore>((set) => ({
  personType: 'student',
  selectedPersonId: '',
  personData: { ...DEFAULT_PERSON },
  photoFile: null,
  logoFile: null,
  signatureFile: null,
  cardSide: 'front',
  design: { ...DEFAULT_DESIGN },
  selectedDesignId: '',
  previewSrc: null,
  previewLoading: false,
  bulkOrientation: 'portrait',
  bulkExporting: false,

  setPersonType: (type) => set({ personType: type, selectedPersonId: '', personData: { ...DEFAULT_PERSON }, photoFile: null }),
  setSelectedPersonId: (id) => set({ selectedPersonId: id }),
  setPersonData: (data) => set((state) => ({ personData: { ...state.personData, ...data } })),
  setPhotoFile: (file) => set({ photoFile: file }),
  setLogoFile: (file) => set({ logoFile: file }),
  setSignatureFile: (file) => set({ signatureFile: file }),
  setCardSide: (side) => set({ cardSide: side }),
  setDesign: (design) => set((state) => ({ design: { ...state.design, ...design } })),
  setSelectedDesignId: (id) => set({ selectedDesignId: id }),
  setPreviewSrc: (src) => set({ previewSrc: src }),
  setPreviewLoading: (loading) => set({ previewLoading: loading }),
  setBulkOrientation: (orientation) => set({ bulkOrientation: orientation }),
  setBulkExporting: (exporting) => set({ bulkExporting: exporting }),

  resetDesign: () => set({ design: { ...DEFAULT_DESIGN }, selectedDesignId: '' }),
  resetPerson: () => set({ personData: { ...DEFAULT_PERSON }, photoFile: null, selectedPersonId: '' }),
}));
