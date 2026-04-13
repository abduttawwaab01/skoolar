import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Blog | Skoolar',
  description: 'Read the latest articles on education, teaching tips, technology, and school management from the Skoolar team.',
};
export default function BlogLayout({ children }: { children: React.ReactNode }) { return children; }
