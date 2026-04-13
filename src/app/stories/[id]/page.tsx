import type { Metadata } from 'next';
import StoryDetailClient from './story-detail-client';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/platform/stories/${id}`);
    if (res.ok) {
      const story = await res.json();
      return { title: `${story.data?.title || 'Story'} | Skoolar Stories`, description: story.data?.excerpt || 'Read this story on Skoolar.' };
    }
  } catch {}
  return { title: 'Story | Skoolar Stories' };
}

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StoryDetailClient id={id} />;
}
