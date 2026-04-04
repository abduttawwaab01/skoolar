'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Clock, Eye, Heart, Share2, BookOpen, Calendar, User,
  Bookmark, Printer, Type, Minus, Plus, List, ChevronDown, ChevronUp,
  Star, TrendingUp, Layers, Sparkles
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { PublicLayout } from '@/components/layout/public-layout';

interface Story {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  level: string | null;
  grade: string | null;
  category: string;
  tags: string | null;
  authorName: string | null;
  authorBio: string | null;
  isFeatured: boolean;
  readTime: number;
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
}

interface RelatedStory {
  id: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string;
  authorName: string | null;
  readTime: number;
  viewCount: number;
  likeCount: number;
  level: string | null;
}

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

const categoryGradients: Record<string, string> = {
  'Adventure': 'from-orange-50 to-amber-50',
  'Fantasy': 'from-purple-50 to-violet-50',
  'Science Fiction': 'from-cyan-50 to-blue-50',
  'Mystery': 'from-rose-50 to-pink-50',
  'Non-Fiction': 'from-emerald-50 to-teal-50',
  'Romance': 'from-pink-50 to-rose-50',
  'Horror': 'from-gray-50 to-slate-50',
  'Comedy': 'from-amber-50 to-yellow-50',
  'Drama': 'from-violet-50 to-purple-50',
  'General': 'from-blue-50 to-indigo-50',
};

function TableOfContents({ content }: { content: string }) {
  const [open, setOpen] = useState(true);
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());

  const headings = paragraphs
    .filter((p) => {
      const trimmed = p.trim();
      return trimmed.length > 0 && trimmed.length < 100 && (
        trimmed.startsWith('#') ||
        trimmed.startsWith('##') ||
        trimmed.startsWith('Chapter') ||
        trimmed.startsWith('CHAPTER') ||
        (trimmed.length < 60 && /^[A-Z]/.test(trimmed) && !trimmed.includes('.'))
      );
    })
    .map((p) => p.replace(/^#+\s*/, '').trim());

  const sections = headings.length >= 2 ? headings : paragraphs
    .filter((p) => p.trim().length > 0)
    .slice(0, 10)
    .map((p) => {
      const trimmed = p.trim();
      return trimmed.length > 80 ? trimmed.substring(0, 80) + '...' : trimmed;
    });

  if (sections.length < 2) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-24">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-gray-900">Table of Contents</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 max-h-80 overflow-y-auto">
          <nav className="space-y-1">
            {sections.map((section, idx) => (
              <a
                key={idx}
                href={`#section-${idx}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(`section-${idx}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors group"
              >
                <span className="text-xs text-gray-400 mt-0.5 font-mono">{idx + 1}</span>
                <span className="line-clamp-2 group-hover:underline">{section}</span>
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

function ReadingSettings({
  fontSize,
  setFontSize,
  lineSpacing,
  setLineSpacing,
}: {
  fontSize: number;
  setFontSize: (v: number) => void;
  lineSpacing: number;
  setLineSpacing: (v: number) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="gap-1.5"
            >
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Reading Mode</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Adjust reading preferences</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showSettings && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl border shadow-xl p-5 z-50 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Reading Settings</span>
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)} className="h-7 w-7 p-0">
              ✕
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">Font Size</label>
              <span className="text-xs text-gray-400">{fontSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Slider
                value={[fontSize]}
                onValueChange={(v) => setFontSize(v[0])}
                min={14}
                max={24}
                step={1}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex justify-center">
              <span className="text-gray-700" style={{ fontSize }}>Aa</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">Line Spacing</label>
              <span className="text-xs text-gray-400">{lineSpacing}x</span>
            </div>
            <Select value={String(lineSpacing)} onValueChange={(v) => setLineSpacing(Number(v))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.5">Compact (1.5x)</SelectItem>
                <SelectItem value="1.8">Normal (1.8x)</SelectItem>
                <SelectItem value="2">Relaxed (2.0x)</SelectItem>
                <SelectItem value="2.4">Spacious (2.4x)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Quick Presets</label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setFontSize(16); setLineSpacing(1.8); }}>
                Default
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setFontSize(18); setLineSpacing(2); }}>
                Large
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setFontSize(20); setLineSpacing(2.4); }}>
                Extra Large
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setFontSize(14); setLineSpacing(1.5); }}>
                Compact
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthorCard({ story }: { story: Story }) {
  if (!story.authorName) return null;

  const initials = story.authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-100/50">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg shadow-purple-500/20">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900 text-lg">{story.authorName}</h4>
          <p className="text-sm text-purple-600 font-medium mb-1">Author</p>
          {story.authorBio && (
            <p className="text-sm text-gray-600 leading-relaxed">{story.authorBio}</p>
          )}
          {story.publishedAt && (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Published {new Date(story.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RelatedStoriesCard({ stories }: { stories: RelatedStory[] }) {
  if (stories.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="p-4 border-b flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-600" />
        <h3 className="font-semibold text-gray-900">Related Stories</h3>
      </div>
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {stories.map((story) => {
          const catColor = categoryColors[story.category] || categoryColors['General'];
          return (
            <Link key={story.id} href={`/stories/${story.id}`} className="group block">
              <div className="flex gap-3 p-2 rounded-xl hover:bg-purple-50/50 transition-colors">
                <div className={`w-16 h-20 rounded-lg bg-gradient-to-br ${categoryGradients[story.category] || 'from-purple-50 to-indigo-50'} flex items-center justify-center shrink-0 overflow-hidden`}>
                  {story.coverImage ? (
                    <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="h-5 w-5 text-purple-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2 leading-snug">
                    {story.title}
                  </h4>
                  {story.authorName && (
                    <p className="text-xs text-gray-500 mt-1">by {story.authorName}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${catColor}`}>
                      {story.category}
                    </Badge>
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{story.readTime}m</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Skeleton className="h-6 w-40 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-4">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <div className="space-y-3 mt-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function StoryDetailClient({ id }: { id: string }) {
  const [story, setStory] = useState<Story | null>(null);
  const [relatedStories, setRelatedStories] = useState<RelatedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.8);
  const [readingProgress, setReadingProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        const res = await fetch(`/api/platform/stories/${id}`);
        const json = await res.json();
        if (json.success) setStory(json.data);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [id]);

  useEffect(() => {
    const fetchRelated = async () => {
      try {
        const res = await fetch('/api/platform/stories');
        const json = await res.json();
        if (json.success && story) {
          const related = (json.data || [])
            .filter((s: Story) => s.id !== story.id && s.category === story.category)
            .slice(0, 5);
          setRelatedStories(related);
        }
      } catch {
        /* silent */
      }
    };
    if (story) fetchRelated();
  }, [story]);

  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const progress = scrollHeight <= clientHeight ? 100 : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    setReadingProgress(progress);
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: story?.title, url });
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      } catch {
        toast.error('Could not copy link');
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleLike = () => {
    setLiked(!liked);
    toast.success(liked ? 'Removed from likes' : 'Added to likes!');
  };

  const toggleBookmark = () => {
    setBookmarked(!bookmarked);
    toast.success(bookmarked ? 'Removed from bookmarks' : 'Bookmarked!');
  };

  let tags: string[] = [];
  try {
    tags = JSON.parse(story?.tags || '[]') as string[];
  } catch {
    tags = [];
  }

  const wordCount = story?.content ? story.content.split(/\s+/).length : 0;

  const contentSections = useMemo(() => {
    if (!story) return [];
    return story.content.split(/\n\n+/).filter((p) => p.trim());
  }, [story]);

  const sectionGroups = useMemo(() => {
    const groups: { id: number; paragraphs: string[]; title: string }[] = [];
    for (let i = 0; i < contentSections.length; i += 3) {
      const chunk = contentSections.slice(i, i + 3);
      const title = chunk[0].replace(/^#+\s*/, '').trim();
      groups.push({
        id: Math.floor(i / 3),
        paragraphs: chunk,
        title: title.length > 80 ? title.substring(0, 80) + '...' : title,
      });
    }
    return groups;
  }, [contentSections]);

  if (loading) {
    return (
      <PublicLayout>
        <DetailLoadingSkeleton />
      </PublicLayout>
    );
  }

  if (!story) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-32 px-4">
          <div className="text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-6">
              <BookOpen className="h-12 w-12 text-purple-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Story Not Found</h2>
            <p className="text-gray-500 mb-6">The story you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/stories">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Stories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const catColor = categoryColors[story.category] || categoryColors['General'];

  return (
    <PublicLayout>
      {/* Reading Progress Bar */}
      <div className="fixed top-16 left-0 right-0 z-40 h-1 bg-gray-100 print:hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Breadcrumb */}
      <div className="bg-white border-b print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/stories" className="flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Stories
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-400 truncate max-w-xs">{story.title}</span>
          </div>
          <ReadingSettings
            fontSize={fontSize}
            setFontSize={setFontSize}
            lineSpacing={lineSpacing}
            setLineSpacing={setLineSpacing}
          />
        </div>
      </div>

      <article className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {story.coverImage && (
              <div className="rounded-2xl overflow-hidden mb-8 shadow-xl shadow-purple-500/5 print:shadow-none">
                <img src={story.coverImage} alt={story.title} className="w-full h-64 sm:h-80 md:h-96 object-cover print:hidden" />
              </div>
            )}

            {!story.coverImage && (
              <div className={`bg-gradient-to-br ${categoryGradients[story.category] || 'from-purple-50 to-indigo-50'} rounded-2xl p-8 md:p-12 mb-8 text-center print:bg-white print:border print:border-gray-200`}>
                <div className="w-16 h-16 rounded-2xl bg-white shadow-lg mx-auto mb-4 flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-purple-500" />
                </div>
              </div>
            )}

            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {story.level && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">{story.level}</Badge>}
                {story.grade && <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">{story.grade}</Badge>}
                <Badge variant="outline" className={`text-xs ${catColor}`}>{story.category}</Badge>
                {story.isFeatured && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-500" /> Featured
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight tracking-tight print:text-2xl">
                {story.title}
              </h1>

              {story.excerpt && (
                <p className="text-lg md:text-xl text-gray-500 italic leading-relaxed">
                  &ldquo;{story.excerpt}&rdquo;
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8 shadow-sm print:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {story.authorName ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {story.authorName.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{story.authorName}</p>
                        {story.publishedAt && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(story.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : story.publishedAt ? (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      {new Date(story.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="h-4 w-4" />
                          {story.readTime} min
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{wordCount.toLocaleString()} words</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Eye className="h-4 w-4" />
                          {story.viewCount.toLocaleString()}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Views</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Heart className="h-4 w-4" />
                          {story.likeCount + (liked ? 1 : 0)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Likes</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <Separator className="my-4" />
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <Button
                  variant={liked ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleLike}
                  className={liked ? 'bg-red-500 hover:bg-red-600 text-white gap-1.5' : 'gap-1.5'}
                >
                  <Heart className={`h-4 w-4 ${liked ? 'fill-white' : ''}`} />
                  {liked ? 'Liked' : 'Like'}
                </Button>
                <Button
                  variant={bookmarked ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleBookmark}
                  className={bookmarked ? 'bg-purple-600 hover:bg-purple-700 text-white gap-1.5' : 'gap-1.5'}
                >
                  <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-white' : ''}`} />
                  {bookmarked ? 'Saved' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </div>
            </div>

            {story.authorBio && (
              <div className="mb-8 print:mb-4">
                <AuthorCard story={story} />
              </div>
            )}

            <div
              ref={contentRef}
              className="prose prose-lg max-w-none bg-white rounded-2xl border border-gray-100 p-6 md:p-10 shadow-sm overflow-y-auto max-h-none print:border print:p-4"
              style={{ fontSize: `${fontSize}px`, lineHeight: `${lineSpacing}` }}
            >
              {sectionGroups.map((group) => (
                <div key={group.id} id={`section-${group.id}`} className="mb-8 scroll-mt-24">
                  {sectionGroups.length > 1 && (
                    <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                      Section {group.id + 1}
                    </h3>
                  )}
                  {group.paragraphs.map((paragraph, pIdx) => (
                    <p
                      key={pIdx}
                      className="text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap print:text-black"
                      dangerouslySetInnerHTML={{ __html: paragraph.replace(/\n/g, '<br/>') }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-8 print:hidden">
                <span className="text-sm text-gray-400 mr-1">Tags:</span>
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs text-gray-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 cursor-pointer transition-colors">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 mt-6 text-xs text-gray-400 print:hidden">
              <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{wordCount.toLocaleString()} words</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />~{story.readTime} min read</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{story.viewCount} views</span>
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{story.likeCount} likes</span>
            </div>

            <Separator className="my-8 print:hidden" />
            <div className="flex items-center justify-between print:hidden">
              <Link href="/stories">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> All Stories
                </Button>
              </Link>
              <Link href="/submit-story">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                  <BookOpen className="h-4 w-4" /> Submit a Story
                </Button>
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 print:hidden">
            {contentSections.length >= 4 && (
              <TableOfContents content={story.content} />
            )}

            <AuthorCard story={story} />

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Story Info
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Category', value: story.category },
                  { label: 'Level', value: story.level },
                  { label: 'Grade', value: story.grade },
                  { label: 'Read Time', value: `${story.readTime} minutes` },
                  { label: 'Word Count', value: wordCount.toLocaleString() },
                  { label: 'Views', value: story.viewCount.toLocaleString() },
                  { label: 'Likes', value: story.likeCount.toLocaleString() },
                ].map((item) => (
                  item.value && (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-medium text-gray-900">{item.value}</span>
                    </div>
                  )
                ))}
              </div>
            </div>

            <RelatedStoriesCard stories={relatedStories} />
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
