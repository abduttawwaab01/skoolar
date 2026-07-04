import { notFound } from 'next/navigation';
import { getSchoolFromSlug } from '@/lib/school-cache';
import { SchoolContact } from '@/components/school/school-contact';

export const revalidate = 3600;

export default async function SchoolContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school || !school.isPublished) return notFound();
  return <SchoolContact school={school} />;
}
