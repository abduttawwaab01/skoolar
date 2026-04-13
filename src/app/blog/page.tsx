'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Search, BookOpen, Star, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicLayout } from '@/components/layout/public-layout';
import { handleSilentError } from '@/lib/error-handler';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  authorName: string;
  authorAvatar: string | null;
  category: string;
  tags: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  featured: boolean;
  readTime: number;
  viewCount: number;
}

const categories = ['All', 'General', 'Education', 'Technology', 'Parenting', 'Teaching', 'News', 'Tips', 'Updates'];

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch('/api/platform/blog');
        const json = await res.json();
        if (json.success) setPosts(json.data || []);
      } catch { /* */ } finally { setLoading(false); }
    };
    fetchPosts();
  }, []);

  const filteredPosts = posts.filter((post) => {
    const matchesSearch = !search ||
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      (post.excerpt || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || post.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredPosts = filteredPosts.filter((p) => p.featured);
  const regularPosts = filteredPosts.filter((p) => !p.featured);

  return (
    <PublicLayout>
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-6 w-6" />
            <Badge variant="secondary" className="bg-white/20 text-white border-0">Blog</Badge>
          </div>
          <h1 className="text-4xl font-bold mb-3">Insights & Resources</h1>
          <p className="text-emerald-100 text-lg max-w-2xl">
            Stay updated with the latest in education technology, teaching tips, school management insights, and more.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles..."
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-emerald-50 border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden border">
                <Skeleton className="h-48 w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No articles found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            {/* Featured Posts */}
            {featuredPosts.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  <h2 className="text-xl font-bold text-gray-900">Featured</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featuredPosts.map((post) => (
                    <Link key={post.id} href={`/blog/${post.slug}`} className="group">
                      <div className="bg-white rounded-xl overflow-hidden border hover:shadow-lg transition-all duration-300">
                        {post.coverImage ? (
                          <div className="h-52 relative overflow-hidden">
                            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute top-3 left-3">
                              <Badge className="bg-amber-500 text-white">{post.category}</Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="h-52 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <BookOpen className="h-12 w-12 text-white/50" />
                          </div>
                        )}
                        <div className="p-5">
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-600 transition-colors mb-2">{post.title}</h3>
                          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{post.excerpt}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readTime} min</span>
                            <span>{post.viewCount} views</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Posts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularPosts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="group">
                  <div className="bg-white rounded-xl overflow-hidden border hover:shadow-lg transition-all duration-300">
                    {post.coverImage ? (
                      <div className="h-44 relative overflow-hidden">
                        <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className="h-44 bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-emerald-400" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">{post.category}</Badge>
                        <span className="text-xs text-gray-400">{post.readTime} min read</span>
                      </div>
                      <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors mb-1 line-clamp-2">{post.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center gap-2 mt-3 text-xs text-emerald-600 font-medium">
                        Read more <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
