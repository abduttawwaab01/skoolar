export interface ReportCardPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  orientation: 'portrait' | 'landscape';
  colors: {
    primary: string; secondary: string; accent: string;
    text: string; textSecondary: string; headerBg: string; bg: string;
    gradientFrom?: string; gradientTo?: string;
  };
  backgroundType: string;
  fontFamily: string;
  fontSize: string;
  showHeader: boolean; showLogo: boolean; showMotto: boolean;
  showAddress: boolean; showContacts: boolean;
  showStudentPhoto: boolean; showStudentInfo: boolean;
  showSubjectsTable: boolean; showDomains: boolean;
  showChart: boolean; showAttendance: boolean;
  showCumulative: boolean; showCorrelation: boolean;
  showRemarks: boolean; showSignatures: boolean;
  showFooter: boolean; showWatermark: boolean;
  watermarkText?: string;
  gradingScaleId?: string;
}

const COMMON = {
  showHeader: true, showLogo: true, showMotto: true,
  showAddress: true, showContacts: true,
  showStudentPhoto: true, showStudentInfo: true,
  showSubjectsTable: true, showDomains: true,
  showChart: true, showAttendance: true,
  showCumulative: true, showCorrelation: true,
  showRemarks: true, showSignatures: true,
  showFooter: true, showWatermark: true,
};

export const DEFAULT_TEMPLATES: ReportCardPreset[] = [
  {
    id: 'standard-academic',
    name: 'Standard Academic',
    description: 'Clean professional layout with emerald theme. Ideal for primary and secondary schools.',
    category: 'School',
    orientation: 'portrait',
    colors: { primary: '#059669', secondary: '#FFFFFF', accent: '#fbbf24', text: '#1e293b', textSecondary: '#64748b', headerBg: '#059669', bg: '#ffffff' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
  {
    id: 'modern-international',
    name: 'Modern International',
    description: 'Sleek navy theme with gold accents. Perfect for international and private schools.',
    category: 'Premium',
    orientation: 'portrait',
    colors: { primary: '#1e3a5f', secondary: '#FFFFFF', accent: '#d4a843', text: '#0f172a', textSecondary: '#475569', headerBg: '#1e3a5f', bg: '#ffffff', gradientFrom: '#1e3a5f', gradientTo: '#2d5a87' },
    backgroundType: 'gradient', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
  {
    id: 'premium-executive',
    name: 'Premium Executive',
    description: 'Dark navy with subtle gradient. Designed for high-end private academies.',
    category: 'Premium',
    orientation: 'portrait',
    colors: { primary: '#0f172a', secondary: '#f8fafc', accent: '#f59e0b', text: '#0f172a', textSecondary: '#475569', headerBg: '#0f172a', bg: '#f8fafc', gradientFrom: '#0f172a', gradientTo: '#1e293b' },
    backgroundType: 'gradient', fontFamily: 'Inter', fontSize: 'sm',
    ...COMMON,
  },
  {
    id: 'minimal-elegant',
    name: 'Minimal Elegant',
    description: 'Clean white design with subtle slate accents. Maximum readability.',
    category: 'Minimal',
    orientation: 'portrait',
    colors: { primary: '#334155', secondary: '#FFFFFF', accent: '#0ea5e9', text: '#0f172a', textSecondary: '#64748b', headerBg: '#334155', bg: '#ffffff' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
  {
    id: 'primary-school',
    name: 'Primary School',
    description: 'Colorful and friendly design. Suitable for nursery and primary schools.',
    category: 'School',
    orientation: 'portrait',
    colors: { primary: '#2563eb', secondary: '#eff6ff', accent: '#f59e0b', text: '#1e293b', textSecondary: '#6b7280', headerBg: '#2563eb', bg: '#ffffff' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'lg',
    ...COMMON,
  },
  {
    id: 'secondary-school',
    name: 'Secondary School',
    description: 'Professional design for secondary and high schools. Balanced and formal.',
    category: 'School',
    orientation: 'portrait',
    colors: { primary: '#7c3aed', secondary: '#faf5ff', accent: '#34d399', text: '#4c1d95', textSecondary: '#7c3aed', headerBg: '#7c3aed', bg: '#ffffff' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
  {
    id: 'islamic-school',
    name: 'Islamic School',
    description: 'Elegant green and gold design suitable for Islamic educational institutions.',
    category: 'Religious',
    orientation: 'portrait',
    colors: { primary: '#166534', secondary: '#f0fdf4', accent: '#d4a843', text: '#14532d', textSecondary: '#166534', headerBg: '#166534', bg: '#f0fdf4', gradientFrom: '#166534', gradientTo: '#15803d' },
    backgroundType: 'gradient', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
  {
    id: 'science-tech',
    name: 'Science & Technology',
    description: 'Modern cyan/indigo theme for STEM-focused schools and tech academies.',
    category: 'Specialized',
    orientation: 'portrait',
    colors: { primary: '#0e7490', secondary: '#ecfeff', accent: '#f59e0b', text: '#164e63', textSecondary: '#0e7490', headerBg: '#0e7490', bg: '#ecfeff' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON, showChart: true,
  },
  {
    id: 'arts-culture',
    name: 'Arts & Culture',
    description: 'Creative rose and purple design for arts-focused institutions.',
    category: 'Specialized',
    orientation: 'portrait',
    colors: { primary: '#be185d', secondary: '#fdf2f8', accent: '#a78bfa', text: '#831843', textSecondary: '#be185d', headerBg: '#be185d', bg: '#fdf2f8' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
  {
    id: 'sports-academy',
    name: 'Sports Academy',
    description: 'Bold amber and slate design for sports-focused schools.',
    category: 'Specialized',
    orientation: 'portrait',
    colors: { primary: '#b45309', secondary: '#fffbeb', accent: '#3b82f6', text: '#451a03', textSecondary: '#b45309', headerBg: '#b45309', bg: '#fffbeb' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
  {
    id: 'crimson-classic',
    name: 'Crimson Classic',
    description: 'Traditional crimson and cream design suitable for established institutions.',
    category: 'Premium',
    orientation: 'portrait',
    colors: { primary: '#991b1b', secondary: '#fef2f2', accent: '#fcd34d', text: '#450a0a', textSecondary: '#991b1b', headerBg: '#991b1b', bg: '#fef2f2' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
  {
    id: 'custom-blank',
    name: 'Custom Blank',
    description: 'Begin with a clean slate and design your own report card from scratch.',
    category: 'Custom',
    orientation: 'portrait',
    colors: { primary: '#059669', secondary: '#FFFFFF', accent: '#fbbf24', text: '#1e293b', textSecondary: '#64748b', headerBg: '#059669', bg: '#ffffff' },
    backgroundType: 'solid', fontFamily: 'Inter', fontSize: 'md',
    ...COMMON,
  },
];
