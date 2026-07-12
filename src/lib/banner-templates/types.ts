export type BannerSizePreset =
  | 'instagram-post' | 'instagram-story'
  | 'facebook-post' | 'facebook-cover'
  | 'twitter-post' | 'twitter-header'
  | 'linkedin-post' | 'linkedin-banner'
  | 'website-hero' | 'website-banner' | 'sidebar-ad' | 'email-header'
  | 'a4-landscape' | 'a4-portrait' | 'a3-poster' | 'flyer'
  | 'tv-landscape' | 'tv-portrait'
  | 'custom';

export type BackgroundStyle = 'solid' | 'gradient' | 'pattern' | 'image';
export type BackgroundPattern = 'damask' | 'shield' | 'geometric' | 'confetti' | 'parchment' | 'diagonal' | 'none';
export type BorderStyle = 'solid' | 'double' | 'dashed' | 'ornate' | 'filigree' | 'laurel' | 'artdeco' | 'vintage' | 'none';
export type TextAlign = 'left' | 'center' | 'right';
export type ContentPosition = 'top' | 'center' | 'bottom';

export type ShapeType =
  | 'header-band' | 'footer-band'
  | 'side-stripe-left' | 'side-stripe-right'
  | 'center-box'
  | 'corner-top-left' | 'corner-top-right' | 'corner-bottom-left' | 'corner-bottom-right'
  | 'diagonal-band'
  | 'circle' | 'divider-line';

export interface BannerShape {
  id: string;
  type: ShapeType;
  enabled: boolean;
  color: string;
  opacity: number;
  size: number;
  rotation?: number;
}

export interface BannerColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  bg: string;
  gradientStart: string;
  gradientEnd: string;
}

export interface BannerDesignState {
  name: string;
  size: BannerSizePreset;
  customWidth: number;
  customHeight: number;

  schoolName: string;
  title: string;
  subtitle: string;
  description: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  contactInfo: string;
  customText: string;

  colors: BannerColors;
  fontFamily: string;
  titleFontSize: number;
  subtitleFontSize: number;

  backgroundStyle: BackgroundStyle;
  backgroundPattern: BackgroundPattern;
  backgroundImage: string;

  shapes: BannerShape[];
  borderStyle: BorderStyle;
  borderWidth: number;
  showBorder: boolean;

  logoUrl: string;
  showLogo: boolean;

  textAlign: TextAlign;
  contentPosition: ContentPosition;
  overlayOpacity: number;

  showTitle: boolean;
  showSubtitle: boolean;
  showDescription: boolean;
  showDate: boolean;
  showTime: boolean;
  showVenue: boolean;
  showContact: boolean;
  showSchoolName: boolean;
}

export interface BannerSizeDefinition {
  key: BannerSizePreset;
  label: string;
  width: number;
  height: number;
  category: string;
}

export type TemplatePreset = {
  name: string;
  category: string;
  description: string;
  defaultSize: BannerSizePreset;
  design: Partial<BannerDesignState>;
};

export const BANNER_SIZES: BannerSizeDefinition[] = [
  { key: 'instagram-post', label: 'Instagram Post', width: 1080, height: 1080, category: 'Social Media' },
  { key: 'instagram-story', label: 'Instagram Story', width: 1080, height: 1920, category: 'Social Media' },
  { key: 'facebook-post', label: 'Facebook Post', width: 1200, height: 630, category: 'Social Media' },
  { key: 'facebook-cover', label: 'Facebook Cover', width: 820, height: 312, category: 'Social Media' },
  { key: 'twitter-post', label: 'Twitter/X Post', width: 1200, height: 675, category: 'Social Media' },
  { key: 'twitter-header', label: 'Twitter Header', width: 1500, height: 500, category: 'Social Media' },
  { key: 'linkedin-post', label: 'LinkedIn Post', width: 1200, height: 627, category: 'Social Media' },
  { key: 'linkedin-banner', label: 'LinkedIn Banner', width: 1584, height: 396, category: 'Social Media' },
  { key: 'website-hero', label: 'Website Hero', width: 1920, height: 1080, category: 'Web' },
  { key: 'website-banner', label: 'Website Banner', width: 728, height: 90, category: 'Web' },
  { key: 'sidebar-ad', label: 'Sidebar Ad', width: 300, height: 250, category: 'Web' },
  { key: 'email-header', label: 'Email Header', width: 600, height: 200, category: 'Web' },
  { key: 'a4-landscape', label: 'A4 Landscape', width: 3508, height: 2480, category: 'Print' },
  { key: 'a4-portrait', label: 'A4 Portrait', width: 2480, height: 3508, category: 'Print' },
  { key: 'a3-poster', label: 'A3 Poster', width: 4961, height: 3508, category: 'Print' },
  { key: 'flyer', label: 'Flyer', width: 2550, height: 3300, category: 'Print' },
  { key: 'tv-landscape', label: 'TV Landscape', width: 1920, height: 1080, category: 'Digital Signage' },
  { key: 'tv-portrait', label: 'TV Portrait', width: 1080, height: 1920, category: 'Digital Signage' },
];

export const FONT_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Helvetica Neue", sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans' },
  { value: '"Lato", sans-serif', label: 'Lato' },
  { value: '"Playfair Display", serif', label: 'Playfair Display' },
  { value: '"Raleway", sans-serif', label: 'Raleway' },
  { value: '"Poppins", sans-serif', label: 'Poppins' },
  { value: '"Oswald", sans-serif', label: 'Oswald' },
  { value: '"Great Vibes", cursive', label: 'Great Vibes' },
];

export const COLOR_THEMES = [
  { name: 'Ocean', primary: '#0369a1', secondary: '#38bdf8', accent: '#fbbf24', bg: '#f0f9ff', gradientStart: '#0ea5e9', gradientEnd: '#0369a1', text: '#0c4a6e', textSecondary: '#64748b' },
  { name: 'Emerald', primary: '#059669', secondary: '#34d399', accent: '#fbbf24', bg: '#ecfdf5', gradientStart: '#10b981', gradientEnd: '#047857', text: '#064e3b', textSecondary: '#64748b' },
  { name: 'Royal Blue', primary: '#1d4ed8', secondary: '#60a5fa', accent: '#f59e0b', bg: '#eff6ff', gradientStart: '#3b82f6', gradientEnd: '#1d4ed8', text: '#1e3a5f', textSecondary: '#64748b' },
  { name: 'Crimson', primary: '#dc2626', secondary: '#f87171', accent: '#fbbf24', bg: '#fef2f2', gradientStart: '#ef4444', gradientEnd: '#dc2626', text: '#7f1d1d', textSecondary: '#64748b' },
  { name: 'Purple', primary: '#7c3aed', secondary: '#a78bfa', accent: '#fbbf24', bg: '#f5f3ff', gradientStart: '#8b5cf6', gradientEnd: '#7c3aed', text: '#4c1d95', textSecondary: '#64748b' },
  { name: 'Amber', primary: '#d97706', secondary: '#fbbf24', accent: '#ffffff', bg: '#fffbeb', gradientStart: '#f59e0b', gradientEnd: '#d97706', text: '#78350f', textSecondary: '#64748b' },
  { name: 'Slate', primary: '#475569', secondary: '#94a3b8', accent: '#fbbf24', bg: '#f8fafc', gradientStart: '#64748b', gradientEnd: '#334155', text: '#1e293b', textSecondary: '#64748b' },
  { name: 'Rose', primary: '#e11d48', secondary: '#fb7185', accent: '#fbbf24', bg: '#fff1f2', gradientStart: '#f43f5e', gradientEnd: '#e11d48', text: '#881337', textSecondary: '#64748b' },
];

export const SHAPES_BY_TYPE: Record<ShapeType, { label: string; icon: string }> = {
  'header-band': { label: 'Header Band', icon: '▬' },
  'footer-band': { label: 'Footer Band', icon: '▬' },
  'side-stripe-left': { label: 'Left Stripe', icon: '▐' },
  'side-stripe-right': { label: 'Right Stripe', icon: '▌' },
  'center-box': { label: 'Center Box', icon: '▢' },
  'corner-top-left': { label: 'Top-Left Corner', icon: '◤' },
  'corner-top-right': { label: 'Top-Right Corner', icon: '◥' },
  'corner-bottom-left': { label: 'Bottom-Left Corner', icon: '◣' },
  'corner-bottom-right': { label: 'Bottom-Right Corner', icon: '◢' },
  'diagonal-band': { label: 'Diagonal Band', icon: '⟋' },
  'circle': { label: 'Circle', icon: '○' },
  'divider-line': { label: 'Divider Line', icon: '—' },
};

export function getSizeDimensions(size: BannerSizePreset, customW?: number, customH?: number): { width: number; height: number } {
  if (size === 'custom') return { width: customW || 1200, height: customH || 630 };
  const preset = BANNER_SIZES.find(s => s.key === size);
  return preset ? { width: preset.width, height: preset.height } : { width: 1200, height: 630 };
}

export function createShape(type: ShapeType, color: string): BannerShape {
  return {
    id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    enabled: true,
    color,
    opacity: 70,
    size: 0.5,
    rotation: type === 'diagonal-band' ? -5 : 0,
  };
}

export const DEFAULT_BANNER_DESIGN: BannerDesignState = {
  name: 'New Banner',
  size: 'website-hero',
  customWidth: 1200,
  customHeight: 630,

  schoolName: 'My School',
  title: 'Welcome Back to School!',
  subtitle: 'Academic Year 2025-2026',
  description: 'Join us for an exciting new year of learning and growth.',
  eventDate: '',
  eventTime: '',
  venue: '',
  contactInfo: '',
  customText: '',

  colors: {
    primary: '#1d4ed8',
    secondary: '#3b82f6',
    accent: '#fbbf24',
    text: '#ffffff',
    textSecondary: '#e0e7ff',
    bg: '#1e3a5f',
    gradientStart: '#1e40af',
    gradientEnd: '#1e3a5f',
  },
  fontFamily: '"Montserrat", sans-serif',
  titleFontSize: 1.0,
  subtitleFontSize: 0.6,

  backgroundStyle: 'gradient',
  backgroundPattern: 'none',
  backgroundImage: '',

  shapes: [
    { id: 'default-header', type: 'header-band', enabled: true, color: '#fbbf24', opacity: 90, size: 0.08 },
  ],
  borderStyle: 'none',
  borderWidth: 0,
  showBorder: false,

  logoUrl: '',
  showLogo: false,

  textAlign: 'center',
  contentPosition: 'center',
  overlayOpacity: 50,

  showTitle: true,
  showSubtitle: true,
  showDescription: true,
  showDate: false,
  showTime: false,
  showVenue: false,
  showContact: false,
  showSchoolName: true,
};
