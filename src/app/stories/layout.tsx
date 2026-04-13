import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Stories | Skoolar',
  description: 'Explore inspiring educational stories from students, teachers, and school communities around the world.',
};
export default function StoriesLayout({ children }: { children: React.ReactNode }) { return children; }
