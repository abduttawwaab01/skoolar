export const CARD_WIDTH_LANDSCAPE = 85.6;
export const CARD_HEIGHT_LANDSCAPE = 53.98;
export const CARD_WIDTH_PORTRAIT = 53.98;
export const CARD_HEIGHT_PORTRAIT = 85.6;

export type CardOrientation = 'landscape' | 'portrait';
export type CardPersonType = 'student' | 'teacher' | 'staff' | 'executive';
export type CardSide = 'front' | 'back';
export type BackgroundType = 'solid' | 'gradient' | 'dots' | 'grid' | 'stripes' | 'glass';
export type FontSizeLabel = 'sm' | 'md' | 'lg';

export interface IDCardDesignColors {
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
  watermarkText: string;
  backText: string;
}

export interface IDCardPreviewData {
  student?: {
    id: string;
    name: string;
    admissionNo: string;
    photo?: string | null;
    className?: string;
    section?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    bloodGroup?: string | null;
    house?: string | null;
    academicSession?: string | null;
    emergencyContact?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
  };
  teacher?: {
    id: string;
    name: string;
    employeeNo: string;
    photo?: string | null;
    department?: string;
    designation?: string;
    phone?: string | null;
    email?: string | null;
  };
  school: {
    id: string;
    name: string;
    logo?: string | null;
    motto?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  design: IDCardDesignState;
  qrCodeDataUrl?: string;
  serialNumber?: string;
}

export interface IDCardLayoutComponent {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface IDCardLayoutJSON {
  front: IDCardLayoutComponent[];
  back: IDCardLayoutComponent[];
}
