'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search, BookOpen, Star, Filter, Clock, Eye, Heart, ChevronRight,
  TrendingUp, Sparkles, ArrowLeft, ArrowRight, BookmarkPlus,
  Flame, BookMarked, User, Layers, ChevronLeft, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PublicLayout } from '@/components/layout/public-layout';

interface Story {
  id: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  level: string | null;
  grade: string | null;
  category: string;
  authorName: string | null;
  isFeatured: boolean;
  readTime: number;
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
  content?: string;
}

const levels = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const grades = ['All', 'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];
const categories = ['All', 'General', 'Adventure', 'Fantasy', 'Science Fiction', 'Mystery', 'Non-Fiction', 'Romance', 'Horror', 'Comedy', 'Drama'];

const categoryIcons: Record<string, string> = {
  'Adventure': '🧭',
  'Fantasy': '🧙',
  'Science Fiction': '🚀',
  'Mystery': '🔍',
  'Non-Fiction': '📚',
  'Romance': '💕',
  'Horror': '👻',
  'Comedy': '😂',
  'Drama': '🎭',
  'General': '📖',
};

const categoryColors: Record<string, string> = {
  'Adventure': 'bg-orange-100 text-orange-700 border-orange-200',
  'Fantasy': 'bg-purple-100 text-purple-700 border-purple-200',
  'Science Fiction': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Mystery': 'bg-rose-100 text-rose-700 border-rose-200',
  'Non-Fiction': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Romance': 'bg-pink-100 text-pink-700 border-pink-200',
  'Horror': 'bg-gray-100 text-gray-700 border-gray-200',
  'Comedy': 'bg-amber-100 text-amber-700 border-amber-200',
  'Drama': 'bg-violet-100 text-violet-700 border-violet-200',
  'General': 'bg-blue-100 text-blue-700 border-blue-200',
};

const ITEMS_PER_PAGE = 9;

function StoryCard({ story }: { story: Story }) {
  const wordCount = story.content ? story.content.split(/\s+/).length : Math.round(story.readTime * 200);
  const catColor = categoryColors[story.category] || categoryColors['General'];

  return (
    <Link href={`/stories/${story.id}`} className="group block">
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 h-full flex flex-col">
        {/* Cover Image */}
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-purple-50 via-indigo-50 to-violet-100">
          {story.coverImage ? (
            <img
              src={story.coverImage}
              alt={story.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-200 to-indigo-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="h-8 w-8 text-purple-400" />
              </div>
              <span className="text-xs text-purple-300 font-medium">{categoryIcons[story.category] || '📖'} {story.category}</span>
            </div>
          )}
          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {story.level && (
              <Badge className="bg-white/90 backdrop-blur-sm text-purple-700 text-[10px] font-semibold shadow-sm border-0">
                {story.level}
              </Badge>
            )}
            {story.grade && (
              <Badge className="bg-white/90 backdrop-blur-sm text-indigo-700 text-[10px] font-semibold shadow-sm border-0">
                {story.grade}
              </Badge>
            )}
          </div>
          {/* Featured badge */}
          {story.isFeatured && (
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm text-white rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm">
                <Star className="h-3 w-3 fill-white" />
                Featured
              </div>
            </div>
          )}
          {/* Read time overlay */}
          <div className="absolute bottom-3 right-3">
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white rounded-full px-2.5 py-1 text-[10px] font-medium">
              <Clock className="h-3 w-3" />
              {story.readTime} min
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col">
          {/* Category & Author */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-[10px] font-medium ${catColor}`}>
              {categoryIcons[story.category] || '📖'} {story.category}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="font-bold text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-2 mb-2 text-[15px] leading-snug">
            {story.title}
          </h3>

          {/* Excerpt */}
          {story.excerpt && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3 leading-relaxed">
              {story.excerpt}
            </p>
          )}

          {/* Author */}
          {story.authorName && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-200 to-indigo-200 flex items-center justify-center">
                <User className="h-3 w-3 text-purple-500" />
              </div>
              <span className="text-xs text-gray-500 font-medium">by {story.authorName}</span>
            </div>
          )}

          {/* Stats */}
          <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {story.viewCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {story.likeCount.toLocaleString()}
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {wordCount.toLocaleString()} words
              </span>
            </div>
            <span className="text-purple-600 font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
              Read <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeaturedCarousel({ stories }: { stories: Story[] }) {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoSlide = useCallback(() => {
    if (stories.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % stories.length);
    }, 5000);
  }, [stories.length]);

  useEffect(() => {
    startAutoSlide();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoSlide]);

  if (stories.length === 0) return null;

  const goTo = (index: number) => {
    setCurrent(index);
    if (intervalRef.current) clearInterval(intervalRef.current);
    startAutoSlide();
  };

  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
          <Flame className="h-4 w-4 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Featured Stories</h2>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs ml-2">
          {stories.length} featured
        </Badge>
      </div>

      <div className="relative">
        {/* Main Featured Story */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stories.slice(current, current + 2).map((story, idx) => (
            <Link key={story.id} href={`/stories/${story.id}`} className="group">
              <div className="relative bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 rounded-2xl overflow-hidden h-72 lg:h-80 flex flex-col justify-end hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-500">
                {story.coverImage && (
                  <img
                    src={story.coverImage}
                    alt={story.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                {/* Decorative */}
                <div className="absolute top-4 right-4 w-20 h-20 bg-white/5 rounded-full blur-xl" />
                <div className="absolute top-8 right-8 w-10 h-10 bg-white/5 rounded-full blur-lg" />

                <div className="relative p-6 lg:p-8 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    {story.level && <Badge className="bg-white/20 text-white border-0 text-[10px] backdrop-blur-sm">{story.level}</Badge>}
                    {story.grade && <Badge className="bg-white/20 text-white border-0 text-[10px] backdrop-blur-sm">{story.grade}</Badge>}
                    <Badge className="bg-amber-500/80 text-white border-0 text-[10px] backdrop-blur-sm flex items-center gap-1">
                      <Star className="h-2.5 w-2.5 fill-white" /> Featured
                    </Badge>
                  </div>
                  <h3 className="text-xl lg:text-2xl font-bold mb-2 group-hover:text-amber-300 transition-colors leading-tight line-clamp-2">
                    {story.title}
                  </h3>
                  {story.excerpt && <p className="text-white/70 text-sm line-clamp-2 mb-3">{story.excerpt}</p>}
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    {story.authorName && (
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{story.authorName}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{story.readTime} min read</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{story.viewCount.toLocaleString()} views</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{story.likeCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Navigation */}
        {stories.length > 2 && (
          <>
            <button
              onClick={() => goTo((current - 2 + stories.length) % stories.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
            <button
              onClick={() => goTo((current + 2) % stories.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
            >
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>

            {/* Dots */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {Array.from({ length: Math.ceil(stories.length / 2) }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx * 2)}
                  className={`h-2 rounded-full transition-all ${
                    Math.floor(current / 2) === idx
                      ? 'w-6 bg-purple-600'
                      : 'w-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TrendingStories({ stories }: { stories: Story[] }) {
  const trending = stories
    .filter((s) => !s.isFeatured)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 4);

  if (trending.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Trending Now</h2>
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs ml-2">
          Most read
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {trending.map((story, idx) => (
          <Link key={story.id} href={`/stories/${story.id}`} className="group">
            <div className="relative bg-white rounded-xl border border-gray-100 hover:border-rose-200 p-4 hover:shadow-lg hover:shadow-rose-500/5 transition-all duration-300">
              <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-rose-500/30">
                {idx + 1}
              </div>
              <div className="pl-6">
                <Badge variant="outline" className="text-[10px] mb-2">{story.category}</Badge>
                <h4 className="font-semibold text-gray-900 group-hover:text-rose-600 transition-colors line-clamp-2 text-sm mb-2">
                  {story.title}
                </h4>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{story.viewCount.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{story.likeCount}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{story.readTime}m</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-700 to-blue-800 py-20 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-6 w-24 rounded-full bg-white/20" />
          <Skeleton className="h-12 w-96 bg-white/20" />
          <Skeleton className="h-5 w-[500px] bg-white/15" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Skeleton className="h-24 rounded-xl mb-8" />
        <Skeleton className="h-6 w-40 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      </div>
    </>
  );
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeLevel, setActiveLevel] = useState('All');
  const [activeGrade, setActiveGrade] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const res = await fetch('/api/platform/stories');
        const json = await res.json();
        if (json.success) setStories(json.data || []);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, activeLevel, activeGrade, activeCategory, sortBy, activeTab]);

  const filteredStories = stories
    .filter((story) => {
      const matchesSearch = !search ||
        story.title.toLowerCase().includes(search.toLowerCase()) ||
        (story.excerpt || '').toLowerCase().includes(search.toLowerCase()) ||
        (story.authorName || '').toLowerCase().includes(search.toLowerCase());
      const matchesLevel = activeLevel === 'All' || story.level === activeLevel;
      const matchesGrade = activeGrade === 'All' || story.grade === activeGrade;
      const matchesCategory = activeCategory === 'All' || story.category === activeCategory;
      return matchesSearch && matchesLevel && matchesGrade && matchesCategory;
    })
    .filter((story) => {
      if (activeTab === 'featured') return story.isFeatured;
      if (activeTab === 'trending') return story.viewCount > 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.publishedAt || '').getTime() - new Date(a.publishedAt || '').getTime();
      if (sortBy === 'oldest') return new Date(a.publishedAt || '').getTime() - new Date(b.publishedAt || '').getTime();
      if (sortBy === 'popular') return b.viewCount - a.viewCount;
      if (sortBy === 'most-liked') return b.likeCount - a.likeCount;
      if (sortBy === 'longest') return b.readTime - a.readTime;
      if (sortBy === 'shortest') return a.readTime - b.readTime;
      return 0;
    });

  const featuredStories = filteredStories.filter((s) => s.isFeatured);
  const regularStories = filteredStories.filter((s) => !s.isFeatured);
  const totalPages = Math.ceil(regularStories.length / ITEMS_PER_PAGE);
  const paginatedStories = regularStories.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const hasActiveFilters = activeLevel !== 'All' || activeGrade !== 'All' || activeCategory !== 'All' || search !== '';

  const clearFilters = () => {
    setSearch('');
    setActiveLevel('All');
    setActiveGrade('All');
    setActiveCategory('All');
    setSortBy('newest');
    setActiveTab('all');
  };

  if (loading) {
    return (
      <PublicLayout>
        <LoadingSkeleton />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      {/* Hero Section with animated book theme */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-indigo-700 to-violet-800 text-white py-20 px-4">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-400/5 rounded-full blur-3xl" />
          {/* Floating book icons */}
          <div className="absolute top-16 right-[15%] opacity-10 text-6xl animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}>📖</div>
          <div className="absolute bottom-12 left-[10%] opacity-10 text-5xl animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '4s' }}>📚</div>
          <div className="absolute top-24 left-[20%] opacity-10 text-4xl animate-bounce" style={{ animationDelay: '1s', animationDuration: '3.5s' }}>✨</div>
          <div className="absolute bottom-20 right-[25%] opacity-10 text-4xl animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '2.5s' }}>🎓</div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
            <Badge variant="secondary" className="bg-white/15 text-white border border-white/20 backdrop-blur-sm px-3">
              Story Library
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
            Explore <span className="bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">Stories</span>
          </h1>
          <p className="text-purple-100 text-lg md:text-xl max-w-2xl mb-8 leading-relaxed">
            Discover captivating stories organized by level, grade, and category. From beginner adventures to advanced literary works — find your next great read.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <BookMarked className="h-4 w-4 text-purple-200" />
              <span className="text-sm font-medium">{stories.length} Stories</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-medium">{stories.filter(s => s.isFeatured).length} Featured</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <Layers className="h-4 w-4 text-purple-200" />
              <span className="text-sm font-medium">{categories.length - 1} Categories</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Category Tabs */}
        <div className="mb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 border border-gray-200'
                  }`}
                >
                  <span>{categoryIcons[cat] || '📖'}</span>
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Filter className="h-4 w-4 text-purple-600" />
              Filter & Search
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1">
                  <X className="h-3 w-3" /> Clear all
                </Button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden text-xs text-purple-600 font-medium"
              >
                {showFilters ? 'Hide filters' : 'Show filters'}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stories by title, excerpt, or author..."
              className="pl-10 h-11 border-gray-200 focus:border-purple-300 focus:ring-purple-200 bg-gray-50/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className={`grid gap-4 ${showFilters ? 'grid-cols-1' : 'hidden md:grid-cols-4'}`}>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Level</label>
              <Select value={activeLevel} onValueChange={setActiveLevel}>
                <SelectTrigger className="h-10 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l} value={l}>{l === 'All' ? 'All Levels' : l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Grade</label>
              <Select value={activeGrade} onValueChange={setActiveGrade}>
                <SelectTrigger className="h-10 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g} value={g}>{g === 'All' ? 'All Grades' : g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-10 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="most-liked">Most Liked</SelectItem>
                  <SelectItem value="longest">Longest Read</SelectItem>
                  <SelectItem value="shortest">Shortest Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-2.5 w-full">
                <span className="font-semibold text-gray-700">{filteredStories.length}</span> stori{filteredStories.length === 1 ? 'y' : 'ies'} found
              </div>
            </div>
          </div>
        </div>

        {/* Tabs: All / Featured / Trending / New Arrivals */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="bg-gray-100 p-1">
            <TabsTrigger value="all" className="text-sm font-medium">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              All Stories
            </TabsTrigger>
            <TabsTrigger value="featured" className="text-sm font-medium">
              <Star className="h-3.5 w-3.5 mr-1.5" />
              Featured
            </TabsTrigger>
            <TabsTrigger value="trending" className="text-sm font-medium">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Trending
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {filteredStories.length === 0 ? (
              <EmptyState onClear={clearFilters} hasFilters={hasActiveFilters} />
            ) : (
              <>
                <FeaturedCarousel stories={featuredStories} />
                <TrendingStories stories={filteredStories} />

                {/* New Arrivals section */}
                {regularStories.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">All Stories</h2>
                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs ml-2">
                        {regularStories.length} stories
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {paginatedStories.map((story) => (
                        <StoryCard key={story.id} story={story} />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-10">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="gap-1"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                            .map((p, idx, arr) => {
                              const prev = arr[idx - 1];
                              return (
                                <React.Fragment key={p}>
                                  {prev && p - prev > 1 && (
                                    <span className="text-gray-400 text-sm px-1">...</span>
                                  )}
                                  <button
                                    onClick={() => setPage(p)}
                                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                                      p === page
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                  >
                                    {p}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          disabled={page === totalPages}
                          className="gap-1"
                        >
                          Next <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="featured">
            {featuredStories.length === 0 ? (
              <EmptyState onClear={clearFilters} hasFilters={hasActiveFilters} />
            ) : (
              <>
                <FeaturedCarousel stories={featuredStories} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredStories.map((story) => (
                    <StoryCard key={story.id} story={story} />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="trending">
            {filteredStories.filter(s => s.viewCount > 0).length === 0 ? (
              <EmptyState onClear={clearFilters} hasFilters={hasActiveFilters} />
            ) : (
              <>
                <TrendingStories stories={filteredStories} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStories
                    .filter((s) => s.viewCount > 0)
                    .sort((a, b) => b.viewCount - a.viewCount)
                    .map((story) => (
                      <StoryCard key={story.id} story={story} />
                    ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Submit CTA */}
        <div className="mt-16 relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600" />
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-white/5 rounded-full blur-3xl" />
          </div>
          <div className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 rounded-3xl p-8 md:p-12 text-white text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
              <BookmarkPlus className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3">Have a Story to Share?</h2>
            <p className="text-purple-100 max-w-lg mx-auto mb-8 leading-relaxed">
              Submit your creative writing and get published on our platform. Share your stories with students everywhere and inspire the next generation of readers.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/submit-story">
                <Button className="bg-white text-purple-700 hover:bg-purple-50 gap-2 shadow-lg px-6 h-11 font-semibold">
                  Submit Your Story <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/stories">
                <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 gap-2">
                  <BookOpen className="h-4 w-4" /> Browse Stories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function EmptyState({ onClear, hasFilters }: { onClear: () => void; hasFilters: boolean }) {
  return (
    <div className="text-center py-20 px-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-6">
        <BookOpen className="h-10 w-10 text-purple-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No stories found</h3>
      <p className="text-gray-500 max-w-md mx-auto mb-6">
        {hasFilters
          ? 'Try adjusting your filters to discover more stories in our library.'
          : 'Our story library is growing! Be the first to contribute or check back soon.'}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {hasFilters && (
          <Button variant="outline" onClick={onClear} className="gap-2">
            <X className="h-4 w-4" /> Clear Filters
          </Button>
        )}
        <Link href="/submit-story">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
            <BookmarkPlus className="h-4 w-4" /> Submit a Story
          </Button>
        </Link>
      </div>
    </div>
  );
}
