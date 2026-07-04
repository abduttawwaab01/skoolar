import { notFound } from 'next/navigation';
import { getSchoolFromSlug, SchoolProfile } from '@/lib/school-cache';
import { SchoolTemplate } from '@/components/school/school-template';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school) return { title: 'School Not Found' };
  return {
    title: school.metaTitle || `${school.name} | Skoolar`,
    description: school.metaDescription || `${school.name} - School Management Platform`,
    openGraph: {
      title: school.metaTitle || school.name,
      description: school.metaDescription || `${school.name} - School Management Platform`,
      images: school.logo ? [{ url: school.logo }] : [],
    },
  };
}

export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school) return notFound();
  return <SchoolTemplate school={school}>{children}</SchoolTemplate>;
}
