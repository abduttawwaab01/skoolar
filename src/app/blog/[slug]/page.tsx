import type { Metadata } from 'next';
import BlogPostClient from './blog-post-client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/platform/blog/${slug}`);
    if (res.ok) {
      const post = await res.json();
      return { title: `${post.data?.title || 'Blog Post'} | Skoolar Blog`, description: post.data?.excerpt || 'Read this article on Skoolar.' };
    }
  } catch {}
  return { title: 'Blog Post | Skoolar Blog' };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogPostClient slug={slug} />;
}
