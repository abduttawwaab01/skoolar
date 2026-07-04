import { notFound } from 'next/navigation';
import { getSchoolFromSlug } from '@/lib/school-cache';
import { SchoolLanding } from '@/components/school/school-landing';

export const revalidate = 3600;

export default async function SchoolHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school || !school.isPublished) return notFound();
  return <SchoolLanding school={school} />;
}
