'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Play, Video, Clock, Eye, Star, Search, X,
  Calendar, Tag, ListVideo, Loader2, PlayCircle,
  ChevronLeft, ChevronRight, Sparkles, ArrowUpDown,
  GraduationCap, TrendingUp, Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { StudentLessonQuiz } from '@/components/features/lesson-quiz-manager';
import DOMPurify from 'dompurify';

// ── Types ──────────────────────────────────────────────
interface VideoLesson {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  classId: string | null;
  contentType: string;
  videoUrl: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  content: string | null;
  thumbnailUrl: string | null;
  duration: number;
  tags: string | null;
  tagsArray: string[];
  viewCount: number;
  isFeatured: boolean;
  isPublished: boolean;
  uploadedBy: string | null;
  uploaderName: string | null;
  uploaderAvatar: string | null;
  subjectName: string | null;
  className: string | null;
  createdAt: string;
  updatedAt: string;
}

type SortOption = 'recent' | 'popular' | 'title';

// ── Helpers ────────────────────────────────────────────
function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:00`;
  return `${m}:00`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatViewCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function getEmbedUrl(url: string): string {
  if (!url) return '';
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Dailymotion
  const dmMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) return `https://www.dailymotion.com/embed/video/${dmMatch[1]}`;
  // TikTok
  const ttMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
  if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;
  // Facebook Video
  const fbMatch = url.match(/facebook\.com\/.*\/videos\/(\d+)/);
  if (fbMatch) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  // Facebook Reel
  const fbReelMatch = url.match(/facebook\.com\/reel\/(\d+)/);
  if (fbReelMatch) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  // Instagram Reel/Post
  const igMatch = url.match(/instagram\.com\/(reel|p)\/([a-zA-Z0-9_-]+)/);
  if (igMatch) return `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed/`;
  // Already embed URL
  if (url.includes('embed') || url.includes('iframe') || url.includes('plugins/video')) return url;
  // Direct video file
  if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) return url;
  return url;
}

function getVideoThumbnail(url: string): string {
  if (!url) return '';
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
  // Dailymotion
  const dmMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) return `https://www.dailymotion.com/thumbnail/video/${dmMatch[1]}`;
  return '';
}

const subjectColors: Record<string, string> = {
  Mathematics: 'bg-blue-100 text-blue-700',
  English: 'bg-purple-100 text-purple-700',
  Science: 'bg-green-100 text-green-700',
  Physics: 'bg-cyan-100 text-cyan-700',
  Chemistry: 'bg-orange-100 text-orange-700',
  Biology: 'bg-emerald-100 text-emerald-700',
  History: 'bg-amber-100 text-amber-700',
  Geography: 'bg-teal-100 text-teal-700',
  'Computer Science': 'bg-indigo-100 text-indigo-700',
  Art: 'bg-pink-100 text-pink-700',
  Music: 'bg-rose-100 text-rose-700',
  default: 'bg-gray-100 text-gray-700',
};

function getSubjectColor(subjectName: string | null): string {
  if (!subjectName) return subjectColors.default;
  return subjectColors[subjectName] || subjectColors.default;
}

// ── Skeleton Components ────────────────────────────────
function FeaturedSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <CardContent className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <CardContent className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────
export function StudentVideoLessons() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';

  // Data state
  const [lessons, setLessons] = useState<VideoLesson[]>([]);
  const [featuredLessons, setFeaturedLessons] = useState<VideoLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Video player dialog
  const [playerOpen, setPlayerOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoLesson | null>(null);
  const [viewIncremented, setViewIncremented] = useState<string | null>(null);

  // Derived data
  const uniqueSubjects = [...new Set(lessons.map((l) => l.subjectName).filter(Boolean))] as string[];

  // Track watched lessons (in-memory for this session)
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch all lessons (published only)
  const fetchLessons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (schoolId) params.set('schoolId', schoolId);
      params.set('sortBy', sortBy);
      params.set('page', currentPage.toString());
      params.set('limit', '20');
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/video-lessons?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      // Only show published lessons to students
      const published = (json.data || []).filter((l: VideoLesson) => l.isPublished);
      setLessons(published);
      setTotalPages(json.totalPages || 1);

      // Fetch featured lessons separately
      const featuredParams = new URLSearchParams();
      if (schoolId) featuredParams.set('schoolId', schoolId);
      featuredParams.set('isFeatured', 'true');
      featuredParams.set('limit', '6');

      const featuredRes = await fetch(`/api/video-lessons?${featuredParams.toString()}`);
      if (featuredRes.ok) {
        const featuredJson = await featuredRes.json();
        setFeaturedLessons((featuredJson.data || []).filter((l: VideoLesson) => l.isPublished));
      }
    } catch {
      toast.error('Failed to load video lessons');
    } finally {
      setLoading(false);
    }
  }, [schoolId, sortBy, currentPage, debouncedSearch]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSubject, sortBy]);

  // Client-side filtering for subject
  const filteredLessons = lessons.filter((lesson) => {
    if (filterSubject !== 'all' && lesson.subjectName !== filterSubject) return false;
    return true;
  });

  // Featured lessons from current filtered set
  const displayFeatured = filterSubject === 'all'
    ? featuredLessons.slice(0, 3)
    : featuredLessons.filter((l) => l.subjectName === filterSubject).slice(0, 3);

  // "Continue Learning" — recently watched in this session
  const continueLearning = filteredLessons.filter((l) => watchedIds.has(l.id)).slice(0, 4);

  // Related videos (same subject as active video, excluding itself)
  const relatedVideos = activeVideo
    ? filteredLessons
        .filter((l) => l.id !== activeVideo.id && l.subjectName === activeVideo.subjectName)
        .slice(0, 4)
    : [];

  // ── Play Video Handler ──
  const handlePlayVideo = async (lesson: VideoLesson) => {
    setActiveVideo(lesson);
    setPlayerOpen(true);
    setWatchedIds((prev) => new Set(prev).add(lesson.id));

    // Increment view count (only once per session per video)
    if (!viewIncremented?.includes(lesson.id)) {
      setViewIncremented((prev) => (prev ? `${prev},${lesson.id}` : lesson.id));
      try {
        await fetch('/api/video-lessons', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lesson.id, viewCount: true }),
        });
        // Update local view count optimistically
        setLessons((prev) =>
          prev.map((l) =>
            l.id === lesson.id ? { ...l, viewCount: l.viewCount + 1 } : l
          )
        );
        setFeaturedLessons((prev) =>
          prev.map((l) =>
            l.id === lesson.id ? { ...l, viewCount: l.viewCount + 1 } : l
          )
        );
      } catch {
        // Silently fail for view count
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100">
            <PlayCircle className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Video Lessons</h1>
            <p className="text-sm text-muted-foreground">Watch educational videos from your teachers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
            <Video className="h-3.5 w-3.5" />
            {lessons.length} lessons available
          </Badge>
        </div>
      </div>

      {/* Featured Section */}
      {!loading && displayFeatured.length > 0 && !activeTab && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Featured Lessons</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayFeatured.map((lesson) => (
              <FeaturedCard key={lesson.id} lesson={lesson} onPlay={handlePlayVideo} />
            ))}
          </div>
        </div>
      )}

      {/* Continue Learning Section */}
      {!loading && continueLearning.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">Continue Learning</h2>
            <Badge variant="secondary" className="text-xs">{continueLearning.length} videos</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {continueLearning.map((lesson) => (
              <StudentVideoCard key={lesson.id} lesson={lesson} onPlay={handlePlayVideo} watched />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <ListVideo className="h-4 w-4" />
              All Lessons
            </TabsTrigger>
            <TabsTrigger value="featured" className="gap-1.5">
              <Star className="h-4 w-4" />
              Featured
            </TabsTrigger>
            <TabsTrigger value="quiz" className="gap-1.5">
              <Award className="h-4 w-4" />
              Quiz
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lessons..."
                className="pl-9 w-48 sm:w-56 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-36 h-9">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="title">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Subject Filter */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {uniqueSubjects.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterSubject !== 'all' && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilterSubject('all')}>
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* All Lessons Tab */}
        <TabsContent value="all" className="mt-4">
          {loading ? (
            <CardGridSkeleton count={8} />
          ) : filteredLessons.length === 0 ? (
            <Card className="p-12 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium">No Video Lessons Found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || filterSubject !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Your teachers haven\'t uploaded any video lessons yet.'}
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredLessons.map((lesson) => (
                  <StudentVideoCard
                    key={lesson.id}
                    lesson={lesson}
                    onPlay={handlePlayVideo}
                    watched={watchedIds.has(lesson.id)}
                  />
                ))}
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | string)[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        typeof p === 'string' ? (
                          <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
                        ) : (
                          <Button
                            key={p}
                            variant={currentPage === p ? 'default' : 'outline'}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </Button>
                        )
                      )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Featured Tab */}
        <TabsContent value="featured" className="mt-4">
          {loading ? (
            <CardGridSkeleton count={6} />
          ) : featuredLessons.filter((l) => filterSubject === 'all' || l.subjectName === filterSubject).length === 0 ? (
            <Card className="p-12 text-center">
              <Star className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium">No Featured Lessons</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {filterSubject !== 'all'
                  ? 'No featured lessons in this subject yet'
                  : 'Check back later for featured content from your teachers.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {featuredLessons
                .filter((l) => filterSubject === 'all' || l.subjectName === filterSubject)
                .map((lesson) => (
                  <StudentVideoCard
                    key={lesson.id}
                    lesson={lesson}
                    onPlay={handlePlayVideo}
                    watched={watchedIds.has(lesson.id)}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        {/* Quiz Tab */}
        <TabsContent value="quiz" className="mt-4">
          {activeVideo ? (
            <StudentLessonQuiz lessonId={activeVideo.id} studentId={currentUser?.id || ''} />
          ) : (
            <Card className="p-8 text-center">
              <Award className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium">Select a Lesson First</h3>
              <p className="text-sm text-muted-foreground mt-1">Click on a lesson to watch it, then come here to take the quiz.</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Content Player Dialog ── */}
      <Dialog open={playerOpen} onOpenChange={(open) => {
        setPlayerOpen(open);
        if (!open) setActiveVideo(null);
      }}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0">
          {activeVideo && (
            <>
              {/* Content Player */}
              <div className="relative aspect-video w-full bg-black">
                {activeVideo.contentType === 'video' && activeVideo.videoUrl && !activeVideo.videoUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) && (
                  <iframe
                    src={getEmbedUrl(activeVideo.videoUrl || '')}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={activeVideo.title}
                  />
                )}
                {activeVideo.contentType === 'video' && activeVideo.videoUrl && activeVideo.videoUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) && (
                  <video src={activeVideo.videoUrl} controls className="w-full h-full" title={activeVideo.title} />
                )}
                {activeVideo.contentType === 'audio' && (
                  <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-8">
                    <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center mb-6 animate-pulse">
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{activeVideo.title}</h3>
                    {activeVideo.description && <p className="text-sm text-white/70 mb-6 text-center max-w-md">{activeVideo.description}</p>}
                  </div>
                )}
                {activeVideo.contentType === 'image' && activeVideo.imageUrl && (
                  <img src={activeVideo.imageUrl} alt={activeVideo.title} className="w-full h-full object-contain" />
                )}
                {activeVideo.contentType === 'text' && (
                  <div className="flex items-start justify-center h-full bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 overflow-y-auto">
                    <div className="max-w-2xl w-full">
                      <h3 className="text-2xl font-bold mb-4">{activeVideo.title}</h3>
                      {activeVideo.description && <p className="text-sm text-white/70 mb-6">{activeVideo.description}</p>}
                      <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeVideo.content || '') }} />
                    </div>
                  </div>
                )}
              </div>
              {activeVideo.contentType === 'audio' && activeVideo.audioUrl && (
                <div className="p-4 bg-gray-50 border-t">
                  <audio controls className="w-full" src={activeVideo.audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
              {activeVideo.contentType === 'text' && activeVideo.content && (
                <div className="p-6 prose max-w-none border-t" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeVideo.content) }} />
              )}
              {/* Video Info */}
              <div className="p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h2 className="text-xl font-bold">{activeVideo.title}</h2>
                    {activeVideo.isFeatured && (
                      <Badge className="bg-amber-500 text-white gap-1">
                        <Star className="h-3 w-3" /> Featured
                      </Badge>
                    )}
                  </div>
                  {activeVideo.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{activeVideo.description}</p>
                  )}
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-3 flex-wrap">
                  {activeVideo.subjectName && (
                    <Badge variant="outline" className={cn('gap-1', getSubjectColor(activeVideo.subjectName))}>
                      <GraduationCap className="h-3 w-3" />
                      {activeVideo.subjectName}
                    </Badge>
                  )}
                  {activeVideo.className && (
                    <Badge variant="secondary">{activeVideo.className}</Badge>
                  )}
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> {formatDuration(activeVideo.duration)}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" /> {formatViewCount(activeVideo.viewCount)} views
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" /> {formatDate(activeVideo.createdAt)}
                  </span>
                </div>

                {/* Tags */}
                {activeVideo.tagsArray && activeVideo.tagsArray.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeVideo.tagsArray.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Uploader */}
                {activeVideo.uploaderName && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span>Uploaded by <span className="font-medium text-foreground">{activeVideo.uploaderName}</span></span>
                  </div>
                )}

                {/* Related Videos */}
                {relatedVideos.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <ListVideo className="h-4 w-4" />
                      Related Videos
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {relatedVideos.map((rv) => (
                        <button
                          key={rv.id}
                          className="text-left group/card"
                          onClick={() => {
                            setActiveVideo(rv);
                            setWatchedIds((prev) => new Set(prev).add(rv.id));
                            if (!viewIncremented?.includes(rv.id)) {
                              setViewIncremented((prev) => (prev ? `${prev},${rv.id}` : rv.id));
                              fetch('/api/video-lessons', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: rv.id, viewCount: true }),
                              }).catch(() => {});
                            }
                          }}
                        >
                          <div className="flex gap-3 items-start">
                            <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-muted/30 shrink-0">
                              {rv.thumbnailUrl || getVideoThumbnail(rv.videoUrl || '') ? (
                                <img
                                  src={rv.thumbnailUrl || getVideoThumbnail(rv.videoUrl || '')}
                                  alt={rv.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
                                  <Video className="h-5 w-5 text-emerald-400" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                                <Play className="h-5 w-5 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-sm font-medium line-clamp-2 group-hover/card:text-emerald-600 transition-colors">
                                {rv.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {formatDuration(rv.duration)}
                                <Eye className="h-3 w-3" />
                                {formatViewCount(rv.viewCount)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Featured Card (larger) ─────────────────────────────
function FeaturedCard({ lesson, onPlay }: { lesson: VideoLesson; onPlay: (lesson: VideoLesson) => void }) {
  const thumbnailSrc = lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl || '');

  return (
    <Card
      className="cursor-pointer group overflow-hidden hover:shadow-xl transition-all duration-200 border border-amber-200 bg-gradient-to-b from-amber-50/50 to-transparent"
      onClick={() => onPlay(lesson)}
    >
      <div className="relative aspect-video bg-muted/30 overflow-hidden">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={lesson.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
            <Video className="h-14 w-14 text-amber-400" />
          </div>
        )}
        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
            <Play className="h-8 w-8 text-emerald-600 ml-1" />
          </div>
        </div>
        {/* Duration */}
        {lesson.duration > 0 && (
          <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/75 text-white text-xs font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(lesson.duration)}
          </div>
        )}
        {/* Featured Badge */}
        <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-xs gap-1 shadow-sm">
          <Star className="h-3 w-3 fill-white" />
          Featured
        </Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold line-clamp-2 group-hover:text-emerald-600 transition-colors">
          {lesson.title}
        </h3>
        {lesson.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{lesson.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {lesson.subjectName && (
            <Badge variant="outline" className={cn('text-xs', getSubjectColor(lesson.subjectName))}>
              <GraduationCap className="h-3 w-3 mr-1" />
              {lesson.subjectName}
            </Badge>
          )}
          {lesson.className && (
            <Badge variant="secondary" className="text-xs">{lesson.className}</Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatViewCount(lesson.viewCount)} views
          </span>
          {lesson.uploaderName && (
            <span className="truncate max-w-[50%]">{lesson.uploaderName}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Student Video Card ─────────────────────────────────
function StudentVideoCard({
  lesson,
  onPlay,
  watched,
}: {
  lesson: VideoLesson;
  onPlay: (lesson: VideoLesson) => void;
  watched?: boolean;
}) {
  const thumbnailSrc = lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl || '');

  return (
    <Card
      className={cn(
        'group overflow-hidden hover:shadow-lg transition-all duration-200 border',
        watched && 'border-emerald-200 bg-emerald-50/30'
      )}
    >
      <div
        className="relative aspect-video bg-muted/30 overflow-hidden cursor-pointer"
        onClick={() => onPlay(lesson)}
      >
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={lesson.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
            <Video className="h-12 w-12 text-emerald-400" />
          </div>
        )}
        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Play className="h-7 w-7 text-emerald-600 ml-1" />
          </div>
        </div>
        {/* Duration Badge */}
        {lesson.duration > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-white text-xs font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(lesson.duration)}
          </div>
        )}
        {/* Content Type Badge */}
        <div className="absolute top-2 left-2 flex gap-1">
          {lesson.contentType === 'audio' && (
            <Badge className="bg-purple-500 text-white text-xs gap-0.5">🎵 Audio</Badge>
          )}
          {lesson.contentType === 'text' && (
            <Badge className="bg-blue-500 text-white text-xs gap-0.5">📝 Text</Badge>
          )}
          {lesson.contentType === 'image' && (
            <Badge className="bg-pink-500 text-white text-xs gap-0.5">🖼️ Image</Badge>
          )}
          {lesson.isFeatured && (
            <Badge className="bg-amber-500 text-white text-xs gap-0.5">
              <Star className="h-3 w-3" />
            </Badge>
          )}
        </div>
        {/* Watched indicator */}
        {watched && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <Play className="h-3 w-3 text-white ml-0.5" />
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <h4
          className="font-semibold text-sm line-clamp-2 cursor-pointer hover:text-emerald-600 transition-colors"
          onClick={() => onPlay(lesson)}
        >
          {lesson.title}
        </h4>
        <div className="flex items-center gap-2 mt-2">
          {lesson.subjectName && (
            <Badge variant="outline" className={cn('text-xs', getSubjectColor(lesson.subjectName))}>
              {lesson.subjectName}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatViewCount(lesson.viewCount)} views
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(lesson.createdAt)}
          </span>
        </div>
        {/* Tags preview */}
        {lesson.tagsArray && lesson.tagsArray.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {lesson.tagsArray.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                <Tag className="h-2 w-2" />
                {tag}
              </Badge>
            ))}
            {lesson.tagsArray.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{lesson.tagsArray.length - 2}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
