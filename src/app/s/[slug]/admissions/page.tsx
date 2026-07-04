import { notFound } from 'next/navigation';
import { getSchoolFromSlug } from '@/lib/school-cache';
import { SchoolAdmissions } from '@/components/school/school-admissions';

export const revalidate = 3600;

export default async function SchoolAdmissionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school || !school.isPublished) return notFound();
  return <SchoolAdmissions school={school} />;
}
