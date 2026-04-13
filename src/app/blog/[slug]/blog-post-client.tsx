'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, Tag, Share2, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PublicLayout } from '@/components/layout/public-layout';
import { handleSilentError } from '@/lib/error-handler';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  authorName: string;
  authorAvatar: string | null;
  category: string;
  tags: string | null;
  publishedAt: string | null;
  readTime: number;
  viewCount: number;
}

export default function BlogPostClient({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/platform/blog/${slug}`);
        const json = await res.json();
        if (json.success) setPost(json.data);
      } catch { /* */ } finally { setLoading(false); }
    };
    fetchPost();
  }, [slug]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: post?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {/* clipboard not available */});
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!post) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Article Not Found</h2>
            <Link href="/blog" className="text-emerald-600 hover:underline">Back to Blog</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  let tags: string[] = [];
  try { tags = JSON.parse(post.tags || '[]') as string[]; } catch { tags = []; }

  return (
    <PublicLayout>
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/blog" className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-400 truncate">{post.title}</span>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Cover */}
        {post.coverImage && (
          <div className="rounded-xl overflow-hidden mb-8">
            <img src={post.coverImage} alt={post.title} className="w-full h-64 md:h-80 object-cover" />
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4">
          <Badge>{post.category}</Badge>
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="gap-1"><Tag className="h-3 w-3" />{tag}</Badge>
          ))}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8 pb-6 border-b">
          <span>By <strong className="text-gray-700">{post.authorName}</strong></span>
          {post.publishedAt && (
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          )}
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.readTime} min read</span>
          <span>{post.viewCount} views</span>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none prose-emerald">
          <div className="whitespace-pre-wrap text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br/>') }} />
        </div>
      </article>
    </PublicLayout>
  );
}
