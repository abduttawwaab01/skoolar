export function getSchoolDomain(slug: string): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'skoolar.org';
  return `${slug}.${rootDomain}`;
}

export function parseSocialLinks(json: string | null): Record<string, string> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function parseAboutImages(json: string | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export function parseExtraSections(json: string | null): Array<{ id: string; type: string; content: string; order: number }> {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export interface FeatureCard {
  icon: string;
  title: string;
  description: string;
}

export function parseFeatureCards(json: string | null): FeatureCard[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export function serializeFeatureCards(cards: FeatureCard[]): string {
  return JSON.stringify(cards);
}

export interface SectionVisibility {
  hero: boolean;
  about: boolean;
  admissions: boolean;
  contact: boolean;
  featureCards: boolean;
  entranceExam: boolean;
  extraSections: boolean;
}

export function parseSectionVisibility(json: string | null): SectionVisibility {
  const defaults: SectionVisibility = {
    hero: true,
    about: true,
    admissions: true,
    contact: true,
    featureCards: true,
    entranceExam: true,
    extraSections: true,
  };
  if (!json) return defaults;
  try {
    return { ...defaults, ...JSON.parse(json) };
  } catch {
    return defaults;
  }
}

export function serializeSectionVisibility(vis: SectionVisibility): string {
  return JSON.stringify(vis);
}

export function parseThemePreset(val: string | null): string {
  if (!val) return 'emerald';
  const valid = ['emerald', 'royal', 'crimson', 'purple', 'amber', 'slate'];
  return valid.includes(val) ? val : 'emerald';
}

export function serializeSocialLinks(obj: Record<string, string>): string {
  return JSON.stringify(obj);
}

export function buildPreviewProfile(form: Record<string, any>, slug: string) {
  return {
    id: 'preview',
    name: form.name || 'Your School Name',
    slug,
    logo: form.logo || null,
    primaryColor: form.primaryColor || '#059669',
    secondaryColor: form.secondaryColor || '#10B981',
    motto: form.motto || null,
    address: form.address || null,
    phone: form.phone || null,
    email: form.email || null,
    website: form.website || null,
    foundedDate: form.foundedDate ? new Date(form.foundedDate) : null,
    schoolType: form.schoolType || null,
    heroTitle: form.heroTitle || null,
    heroSubtitle: form.heroSubtitle || null,
    heroImageUrl: form.heroImageUrl || null,
    aboutTitle: form.aboutTitle || null,
    aboutContent: form.aboutContent || null,
    aboutImages: form.aboutImages || '[]',
    admissionsTitle: form.admissionsTitle || null,
    admissionsContent: form.admissionsContent || null,
    contactEmail: form.contactEmail || null,
    contactPhone: form.contactPhone || null,
    contactAddress: form.contactAddress || null,
    socialLinks: form.socialLinks || '{}',
    metaTitle: form.metaTitle || null,
    metaDescription: form.metaDescription || null,
    customCss: form.customCss || null,
    isPublished: false,
    extraSections: form.extraSections || null,
    featureCards: form.featureCards || null,
    sectionVisibility: form.sectionVisibility || null,
    themePreset: form.themePreset || null,
  };
}

export const THEME_PRESETS: Array<{ name: string; label: string; primary: string; secondary: string; description: string }> = [
  { name: 'emerald', label: 'Emerald', primary: '#059669', secondary: '#10B981', description: 'Fresh green — default' },
  { name: 'royal', label: 'Royal Blue', primary: '#1D4ED8', secondary: '#3B82F6', description: 'Trustworthy blue' },
  { name: 'crimson', label: 'Crimson', primary: '#DC2626', secondary: '#F87171', description: 'Bold red' },
  { name: 'purple', label: 'Purple', primary: '#7C3AED', secondary: '#A78BFA', description: 'Creative purple' },
  { name: 'amber', label: 'Amber', primary: '#D97706', secondary: '#FBBF24', description: 'Warm gold' },
  { name: 'slate', label: 'Slate', primary: '#1E293B', secondary: '#475569', description: 'Professional dark' },
];
