import { notFound } from 'next/navigation';
import { getSchoolFromSlug } from '@/lib/school-cache';
import { parseAboutImages } from '@/lib/school-utils';
import { SchoolAbout } from '@/components/school/school-about';

export const revalidate = 3600;

export default async function SchoolAboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school || !school.isPublished) return notFound();
  return <SchoolAbout school={school} images={parseAboutImages(school.aboutImages)} />;
}
