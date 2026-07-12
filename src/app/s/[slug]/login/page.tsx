import { notFound } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { getSchoolFromSlug } from '@/lib/school-cache';
import { LoginPage } from '@/components/auth/login-page';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school) return { title: 'School Not Found' };
  return {
    title: `Login | ${school.name}`,
    description: `Log in to ${school.name} portal`,
  };
}

export default async function SchoolLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school) return notFound();

  return (
    <SessionProvider>
      <LoginPage
        initialSchool={{
          id: school.id,
          name: school.name,
          slug: school.slug,
          logo: school.logo,
        }}
      />
      <Toaster position="top-right" richColors closeButton />
    </SessionProvider>
  );
}
