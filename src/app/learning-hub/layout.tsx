import type { Metadata } from 'next';
import { PublicLayout } from '@/components/layout/public-layout';

export const metadata: Metadata = {
  title: 'Learning Hub | Skoolar',
  description: 'Join our vibrant learning community. Share stories, poems, articles, and connect with fellow students.',
  openGraph: { title: 'Learning Hub | Skoolar', description: 'A vibrant learning community for students', type: 'website' },
};

export const dynamic = 'force-dynamic';

export default function LearningHubLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}
