import { db } from '@/lib/db';
import { cache } from 'react';

export interface SchoolProfile {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  foundedDate: string | null;
  schoolType: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  aboutTitle: string | null;
  aboutContent: string | null;
  aboutImages: string | null;
  admissionsTitle: string | null;
  admissionsContent: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  socialLinks: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  customCss: string | null;
  isPublished: boolean;
  extraSections: string | null;
  featureCards: string | null;
  sectionVisibility: string | null;
  themePreset: string | null;
}

function makeSchoolProfile(school: any, publicPage: any): SchoolProfile {
  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    logo: school.logo,
    primaryColor: school.primaryColor,
    secondaryColor: school.secondaryColor,
    motto: school.motto,
    address: school.address,
    phone: school.phone,
    email: school.email,
    website: school.website,
    foundedDate: school.foundedDate ? school.foundedDate.toISOString() : null,
    schoolType: school.schoolType,
    heroTitle: publicPage?.heroTitle ?? null,
    heroSubtitle: publicPage?.heroSubtitle ?? null,
    heroImageUrl: publicPage?.heroImageUrl ?? null,
    aboutTitle: publicPage?.aboutTitle ?? null,
    aboutContent: publicPage?.aboutContent ?? null,
    aboutImages: publicPage?.aboutImages ?? null,
    admissionsTitle: publicPage?.admissionsTitle ?? null,
    admissionsContent: publicPage?.admissionsContent ?? null,
    contactEmail: publicPage?.contactEmail ?? null,
    contactPhone: publicPage?.contactPhone ?? null,
    contactAddress: publicPage?.contactAddress ?? null,
    socialLinks: publicPage?.socialLinks ?? null,
    metaTitle: publicPage?.metaTitle ?? null,
    metaDescription: publicPage?.metaDescription ?? null,
    customCss: publicPage?.customCss ?? null,
    isPublished: publicPage?.isPublished ?? false,
    extraSections: publicPage?.extraSections ?? null,
    featureCards: publicPage?.featureCards ?? null,
    sectionVisibility: publicPage?.sectionVisibility ?? null,
    themePreset: publicPage?.themePreset ?? null,
  };
}

async function tryEdgeConfig(_slug: string): Promise<SchoolProfile | null> {
  // Edge Config bypass removed — it returned raw data without running through
  // makeSchoolProfile(), which could contain non-serializable values that crash
  // Server Component renders. The DB path is already request-cached via React cache().
  return null;
}

export const getSchoolBySlug = cache(async (slug: string): Promise<SchoolProfile | null> => {
  try {
    const fromEdge = await tryEdgeConfig(slug);
    if (fromEdge) return fromEdge;

    const school = await db.school.findUnique({
      where: { slug },
      include: { publicPage: true },
    });

    if (!school) return null;

    return makeSchoolProfile(school, school.publicPage);
  } catch {
    return null;
  }
});

export const getSchoolById = cache(async (id: string): Promise<SchoolProfile | null> => {
  try {
    const school = await db.school.findUnique({
      where: { id },
      include: { publicPage: true },
    });

    if (!school) return null;

    return makeSchoolProfile(school, school.publicPage);
  } catch {
    return null;
  }
});

export function getSchoolFromSlug(slug: string): Promise<SchoolProfile | null> {
  return getSchoolBySlug(slug);
}

export async function updateSchoolCache(schoolId: string, slug: string): Promise<void> {
  try {
    const school = await db.school.findUnique({
      where: { id: schoolId },
      include: { publicPage: true },
    });
    // primes the lazy React cache for subsequent calls in the same request
  } catch {
    // silent
  }
}
