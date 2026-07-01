export type CertificateType =
  | 'ACHIEVEMENT'
  | 'COMPLETION'
  | 'PARTICIPATION'
  | 'LEAVING'
  | 'TRANSFER'
  | 'TESTIMONIAL'
  | 'MERIT'
  | 'GRADUATION'
  | 'DIPLOMA'
  | 'PROMOTION'
  | 'SPORTS'
  | 'APPRECIATION'
  | 'INTERNSHIP'
  | 'GENERAL';

export type Orientation = 'portrait' | 'landscape';

export type BorderStyle = 'solid' | 'double' | 'dashed' | 'ornate' | 'filigree' | 'laurel' | 'artdeco' | 'vintage' | 'none';

export type CornerStyle = 'rounded' | 'square' | 'ornate';

export type BackgroundStyle = 'solid' | 'gradient' | 'pattern';

export type BackgroundPattern = 'damask' | 'shield' | 'geometric' | 'confetti' | 'parchment' | 'diagonal' | 'none';

export type FontSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export type FoilStyle = 'none' | 'gold' | 'silver' | 'bronze';

export interface CertificateColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  headerBg: string;
  bg: string;
  border: string;
}

export interface CertificateDesignState {
  // Meta
  name: string;
  type: CertificateType;
  orientation: Orientation;
  isDefault: boolean;

  // Colors
  colors: CertificateColors;
  foilStyle: FoilStyle;

  // Typography
  fontFamily: string;
  titleFontSize: FontSize;
  headingFontSize: FontSize;
  bodyFontSize: FontSize;

  // Border
  borderStyle: BorderStyle;
  borderWidth: number;
  cornerStyle: CornerStyle;

  // Background
  backgroundStyle: BackgroundStyle;
  backgroundPattern: BackgroundPattern;
  gradientStart: string;
  gradientEnd: string;

  // Content
  certificateTitle: string;
  purposeText: string;
  completionText: string;
  honorText: string;
  customMessage: string;
  leftSignatureLabel: string;
  rightSignatureLabel: string;

  // Element visibility
  showSchoolLogo: boolean;
  showSchoolName: boolean;
  showStudentPhoto: boolean;
  showStudentName: boolean;
  showCertificateTitle: boolean;
  showPurposeText: boolean;
  showCompletionText: boolean;
  showHonorText: boolean;
  showDate: boolean;
  showStudentDetails: boolean;
  showSeal: boolean;
  showLeftSignature: boolean;
  showRightSignature: boolean;
  showQRCode: boolean;
  showBackgroundPattern: boolean;
  showBorderArt: boolean;
  showWatermark: boolean;
  showCustomMessage: boolean;
  showFooter: boolean;
  showGrade: boolean;
  showAttendance: boolean;
  showSubjects: boolean;
  showCertificateNumber: boolean;
  showVerificationCode: boolean;

  // Watermark
  watermarkText: string;

  // Seal
  sealPosition: 'center' | 'left' | 'right' | 'bottom';

  // Layout elements for drag-and-drop canvas
  elements: CertificateCanvasElement[];
}

export interface CertificateCanvasElement {
  id: string;
  type: 'logo' | 'title' | 'studentName' | 'studentPhoto' | 'purposeText' | 'completionText' | 'honorText' | 'customMessage' | 'date' | 'details' | 'seal' | 'leftSignature' | 'rightSignature' | 'qrCode' | 'footer' | 'border' | 'watermark' | 'grade' | 'subjects';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  zIndex: number;
}

export interface IssuedCertificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  type: CertificateType;
  studentName: string;
  className: string;
  admissionNo: string;
  academicSession: string;
  termName: string;
  grade: string;
  issueDate: string;
  issuedBy: string;
  status: 'ACTIVE' | 'REVOKED';
  design: CertificateDesignState;
  fullName: string;
  attendance: string;
  subjects: { name: string; score: string; grade: string }[];
  qrCodeDataUrl?: string;
}

export interface StudentData {
  id: string;
  name: string;
  admissionNo: string;
  className: string;
  photo?: string;
  gender?: string;
  attendance?: string;
  grade?: string;
}

export interface CertificateRenderData {
  certificateNumber: string;
  verificationCode: string;
  type: CertificateType;
  studentName: string;
  studentPhoto?: string;
  className: string;
  admissionNo: string;
  academicSession: string;
  termName: string;
  grade: string;
  attendance: string;
  subjects: { name: string; score: string; grade: string }[];
  issueDate: string;
  schoolName: string;
  schoolLogo?: string;
  schoolAddress: string;
  schoolMotto: string;
  principalName: string;
  design: CertificateDesignState;
  qrCodeDataUrl?: string;
  foilCss: string;
  borderSvg: string;
  patternSvg: string;
  watermarkOpacity: number;
}

export type TemplatePreset = {
  name: string;
  type: CertificateType;
  category: string;
  description: string;
  design: CertificateDesignState;
};

export const CERTIFICATE_TYPES: Record<CertificateType, string> = {
  ACHIEVEMENT: 'Achievement Award',
  COMPLETION: 'Completion Certificate',
  PARTICIPATION: 'Participation Certificate',
  LEAVING: 'Leaving Certificate',
  TRANSFER: 'Transfer Certificate',
  TESTIMONIAL: 'Testimonial of Character',
  MERIT: 'Merit Award',
  GRADUATION: 'Graduation Certificate',
  DIPLOMA: 'Diploma Certificate',
  PROMOTION: 'Promotion Certificate',
  SPORTS: 'Sports Award',
  APPRECIATION: 'Appreciation Certificate',
  INTERNSHIP: 'Internship Certificate',
  GENERAL: 'General Certificate',
};

export const FONT_OPTIONS = [
  { value: 'Georgia, serif', label: 'Georgia (Serif)' },
  { value: '"Times New Roman", serif', label: 'Times New Roman (Serif)' },
  { value: '"Playfair Display", serif', label: 'Playfair Display (Serif)' },
  { value: '"Palatino Linotype", serif', label: 'Palatino (Serif)' },
  { value: '"Garamond", serif', label: 'Garamond (Serif)' },
  { value: 'Arial, sans-serif', label: 'Arial (Sans-serif)' },
  { value: '"Helvetica Neue", sans-serif', label: 'Helvetica (Sans-serif)' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans (Sans-serif)' },
  { value: '"Lato", sans-serif', label: 'Lato (Sans-serif)' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat (Sans-serif)' },
  { value: '"Brush Script MT", cursive', label: 'Brush Script (Cursive)' },
  { value: '"Great Vibes", cursive', label: 'Great Vibes (Cursive)' },
];

export const FOIL_STYLES = {
  none: { label: 'None', css: '' },
  gold: {
    label: 'Gold Foil',
    css: 'linear-gradient(135deg, #bf953f 0%, #fcf6ba 20%, #b38728 40%, #fbf5b7 60%, #aa771c 80%, #bf953f 100%)',
  },
  silver: {
    label: 'Silver Foil',
    css: 'linear-gradient(135deg, #a8a8a8 0%, #f0f0f0 20%, #808080 40%, #e0e0e0 60%, #606060 80%, #a8a8a8 100%)',
  },
  bronze: {
    label: 'Bronze Foil',
    css: 'linear-gradient(135deg, #cd7f32 0%, #f8d5a3 20%, #a0522d 40%, #e8c48b 60%, #8b4513 80%, #cd7f32 100%)',
  },
};

export const A4_DIMENSIONS = {
  portrait: { width: 210, height: 297 },
  landscape: { width: 297, height: 210 },
};

export const MM = (mm: number): string => `${mm}mm`;

export const DEFAULT_CERTIFICATE_DESIGN: CertificateDesignState = {
  name: 'Default Certificate',
  type: 'ACHIEVEMENT',
  orientation: 'portrait',
  isDefault: false,
  colors: {
    primary: '#1a365d',
    secondary: '#d4a017',
    accent: '#f5f0e8',
    text: '#1e293b',
    textSecondary: '#64748b',
    headerBg: '#1a365d',
    bg: '#ffffff',
    border: '#d4a017',
  },
  foilStyle: 'gold',
  fontFamily: '"Times New Roman", serif',
  titleFontSize: '3xl',
  headingFontSize: 'lg',
  bodyFontSize: 'md',
  borderStyle: 'double',
  borderWidth: 3,
  cornerStyle: 'rounded',
  backgroundStyle: 'solid',
  backgroundPattern: 'none',
  gradientStart: '#ffffff',
  gradientEnd: '#f5f0e8',
  certificateTitle: 'Certificate of Achievement',
  purposeText: 'This is to certify that',
  completionText: 'has successfully completed the academic program',
  honorText: 'with Distinction',
  customMessage: 'We recognize your dedication, hard work, and outstanding performance. We are confident that you will continue to excel in all your future endeavors.',
  leftSignatureLabel: 'Principal',
  rightSignatureLabel: 'Director',
  showSchoolLogo: true,
  showSchoolName: true,
  showStudentPhoto: true,
  showStudentName: true,
  showCertificateTitle: true,
  showPurposeText: true,
  showCompletionText: true,
  showHonorText: true,
  showDate: true,
  showStudentDetails: true,
  showSeal: true,
  showLeftSignature: true,
  showRightSignature: false,
  showQRCode: true,
  showBackgroundPattern: false,
  showBorderArt: true,
  showWatermark: true,
  showCustomMessage: true,
  showFooter: true,
  showGrade: true,
  showAttendance: false,
  showSubjects: false,
  showCertificateNumber: true,
  showVerificationCode: true,
  watermarkText: 'CERTIFIED',
  sealPosition: 'center',
  elements: [],
};

export const CERTIFICATE_TYPES_BY_STYLE: Record<string, CertificateType[]> = {
  Academic: ['ACHIEVEMENT', 'MERIT', 'GRADUATION', 'DIPLOMA', 'COMPLETION'],
  Administrative: ['LEAVING', 'TRANSFER', 'TESTIMONIAL', 'PROMOTION'],
  'Co-curricular': ['PARTICIPATION', 'SPORTS', 'APPRECIATION'],
  Other: ['INTERNSHIP', 'GENERAL'],
};

export function generateCertificateNumber(index?: number): string {
  const year = new Date().getFullYear();
  const seq = index ? String(index).padStart(4, '0') : String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `SKL-${year}-${seq}`;
}

export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getGenderPronouns(gender?: string): { subject: string; object: string; possessive: string } {
  const g = (gender || '').toLowerCase();
  if (g === 'male') return { subject: 'he', object: 'him', possessive: 'his' };
  if (g === 'female') return { subject: 'she', object: 'her', possessive: 'her' };
  return { subject: 'they', object: 'them', possessive: 'their' };
}
