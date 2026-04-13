'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Play, Video, Clock, Eye, Star, Upload, Search, Filter, X,
  Calendar, Tag, ArrowUpDown, ListVideo, Loader2, Pencil,
  Trash2, ChevronLeft, ChevronRight, PlayCircle, CheckCircle2,
  AlertTriangle, Plus, MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';

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

interface VideoStats {
  totalLessons: number;
  totalWatchTime: number;
  categories: number;
  thisWeek: number;
}

type SortOption = 'recent' | 'popular' | 'title';
type StatusFilter = 'all' | 'published' | 'draft';

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
  // Twitter/X
  const twMatch = url.match(/twitter\.com\/\w+\/status\/(\d+)|x\.com\/\w+\/status\/(\d+)/);
  if (twMatch) return url; // Twitter requires oEmbed, fallback to direct URL
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
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
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
export function VideoLessonsView() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';

  // Data state
  const [lessons, setLessons] = useState<VideoLesson[]>([]);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Active video player
  const [activeVideo, setActiveVideo] = useState<VideoLesson | null>(null);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    contentType: 'video',
    videoUrl: '',
    audioUrl: '',
    imageUrl: '',
    content: '',
    thumbnailUrl: '',
    subjectId: '',
    classId: '',
    duration: '',
    tags: '',
    isFeatured: false,
    isPublished: true,
  });

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<VideoLesson | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    contentType: 'video',
    videoUrl: '',
    audioUrl: '',
    imageUrl: '',
    content: '',
    thumbnailUrl: '',
    subjectId: '',
    classId: '',
    duration: '',
    tags: '',
    isFeatured: false,
    isPublished: false,
  });

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Derived data
  const uniqueSubjects = [...new Set(lessons.map((l) => l.subjectName).filter(Boolean))] as string[];
  const uniqueClasses = [...new Set(lessons.map((l) => l.className).filter(Boolean))] as string[];

  const featuredCount = lessons.filter((l) => l.isFeatured).length;
  const publishedCount = lessons.filter((l) => l.isPublished).length;
  const totalViews = lessons.reduce((acc, l) => acc + l.viewCount, 0);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch lessons
  const fetchLessons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (schoolId) params.set('schoolId', schoolId);
      params.set('sortBy', sortBy);
      params.set('page', currentPage.toString());
      params.set('limit', '12');
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/video-lessons?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setLessons(json.data || []);
      setTotalPages(json.totalPages || 1);
      setStats(json.stats || null);
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
  }, [filterSubject, filterClass, filterStatus, sortBy]);

  // Client-side filtering for subject, class, status
  const filteredLessons = lessons.filter((lesson) => {
    if (filterSubject !== 'all' && lesson.subjectName !== filterSubject) return false;
    if (filterClass !== 'all' && lesson.className !== filterClass) return false;
    if (filterStatus === 'published' && !lesson.isPublished) return false;
    if (filterStatus === 'draft' && lesson.isPublished) return false;
    return true;
  });

  // ── Upload Handler ──
  const handleUpload = async () => {
    if (!uploadForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (uploadForm.contentType === 'video' && !uploadForm.videoUrl.trim()) {
      toast.error('Video URL is required');
      return;
    }
    if (uploadForm.contentType === 'audio' && !uploadForm.audioUrl.trim()) {
      toast.error('Audio URL is required');
      return;
    }
    if (uploadForm.contentType === 'image' && !uploadForm.imageUrl.trim()) {
      toast.error('Image URL is required');
      return;
    }
    if (uploadForm.contentType === 'text' && !uploadForm.content.trim()) {
      toast.error('Content is required for text lessons');
      return;
    }

    setUploading(true);
    try {
      const res = await fetch('/api/video-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          title: uploadForm.title,
          description: uploadForm.description || null,
          contentType: uploadForm.contentType,
          videoUrl: uploadForm.videoUrl || null,
          audioUrl: uploadForm.audioUrl || null,
          imageUrl: uploadForm.imageUrl || null,
          content: uploadForm.content || null,
          thumbnailUrl: uploadForm.thumbnailUrl || null,
          duration: parseInt(uploadForm.duration) || 0,
          tags: uploadForm.tags || null,
          isFeatured: uploadForm.isFeatured,
          uploadedBy: currentUser?.id || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to upload');
      }

      toast.success('Lesson uploaded successfully!');
      setUploadOpen(false);
      setUploadForm({
        title: '', description: '', contentType: 'video', videoUrl: '', audioUrl: '', imageUrl: '', content: '', thumbnailUrl: '',
        subjectId: '', classId: '', duration: '', tags: '',
        isFeatured: false, isPublished: true,
      });
      fetchLessons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  // ── Edit Handler ──
  const openEdit = (lesson: VideoLesson) => {
    setEditingLesson(lesson);
    setEditForm({
      title: lesson.title,
      description: lesson.description || '',
      contentType: lesson.contentType || 'video',
      videoUrl: lesson.videoUrl || '',
      audioUrl: lesson.audioUrl || '',
      imageUrl: lesson.imageUrl || '',
      content: lesson.content || '',
      thumbnailUrl: lesson.thumbnailUrl || '',
      subjectId: lesson.subjectId || '',
      classId: lesson.classId || '',
      duration: lesson.duration?.toString() || '',
      tags: lesson.tags || '',
      isFeatured: lesson.isFeatured,
      isPublished: lesson.isPublished,
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingLesson || !editForm.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setUploading(true);
    try {
      const res = await fetch('/api/video-lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLesson.id,
          title: editForm.title,
          description: editForm.description || null,
          contentType: editForm.contentType,
          videoUrl: editForm.videoUrl || null,
          audioUrl: editForm.audioUrl || null,
          imageUrl: editForm.imageUrl || null,
          content: editForm.content || null,
          thumbnailUrl: editForm.thumbnailUrl || null,
          subjectId: editForm.subjectId || null,
          classId: editForm.classId || null,
          duration: parseInt(editForm.duration) || 0,
          tags: editForm.tags || null,
          isFeatured: editForm.isFeatured,
          isPublished: editForm.isPublished,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update');
      }

      toast.success('Lesson updated successfully!');
      setEditOpen(false);
      setEditingLesson(null);
      fetchLessons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Update failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  // ── Delete Handler ──
  const handleDelete = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/video-lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteDialog, deletedAt: new Date().toISOString() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete');
      }

      toast.success('Video lesson deleted successfully!');
      setDeleteDialog(null);
      setActiveVideo(null);
      fetchLessons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Toggle Featured ──
  const toggleFeatured = async (lesson: VideoLesson) => {
    try {
      const res = await fetch('/api/video-lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lesson.id, isFeatured: !lesson.isFeatured }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      toast.success(lesson.isFeatured ? 'Removed from featured' : 'Added to featured');
      fetchLessons();
    } catch {
      toast.error('Failed to update featured status');
    }
  };

  // ── Toggle Published ──
  const togglePublished = async (lesson: VideoLesson) => {
    try {
      const res = await fetch('/api/video-lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lesson.id, isPublished: !lesson.isPublished }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      toast.success(lesson.isPublished ? 'Unpublished lesson' : 'Published lesson');
      fetchLessons();
    } catch {
      toast.error('Failed to update publish status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100">
            <Video className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Video Lessons</h1>
            <p className="text-sm text-muted-foreground">Manage video lessons for your school</p>
          </div>
        </div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload Video
        </Button>
      </div>

      {/* Stats Row */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <ListVideo className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lessons.length}</p>
                <p className="text-xs text-muted-foreground">Total Lessons</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{featuredCount}</p>
                <p className="text-xs text-muted-foreground">Featured</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{publishedCount}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatViewCount(totalViews)}</p>
                <p className="text-xs text-muted-foreground">Total Views</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Content Player Modal */}
      {activeVideo && (
        <Card className="overflow-hidden border-2 border-emerald-200">
          <div className="relative">
            <div className="aspect-video w-full bg-black">
              {activeVideo.contentType === 'video' && activeVideo.videoUrl && activeVideo.videoUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) && (
                <video src={activeVideo.videoUrl} controls className="w-full h-full" title={activeVideo.title} />
              )}
              {activeVideo.contentType === 'video' && activeVideo.videoUrl && !activeVideo.videoUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) && (
                <iframe
                  src={getEmbedUrl(activeVideo.videoUrl || '')}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activeVideo.title}
                />
              )}
              {activeVideo.contentType === 'audio' && (
                <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-8">
                  <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center mb-6">
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
                <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
                  <div className="max-w-2xl w-full">
                    <h3 className="text-2xl font-bold mb-4">{activeVideo.title}</h3>
                    {activeVideo.description && <p className="text-sm text-white/70 mb-6">{activeVideo.description}</p>}
                    <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeVideo.content || '') }} />
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-3 right-3 gap-1 bg-black/60 text-white hover:bg-black/80"
              onClick={() => setActiveVideo(null)}
            >
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
          {activeVideo.contentType === 'audio' && activeVideo.audioUrl && (
            <div className="p-4 bg-gray-50 border-t">
              <audio controls className="w-full" src={activeVideo.audioUrl}>
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
          {activeVideo.contentType === 'text' && activeVideo.content && (
            <div className="p-6 prose max-w-none border-t" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeVideo.content || '') }} />
          )}
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-lg font-semibold">{activeVideo.title}</h3>
                  {activeVideo.isFeatured && (
                    <Badge className="bg-amber-500 text-white gap-1">
                      <Star className="h-3 w-3" /> Featured
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1',
                      activeVideo.isPublished
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    )}
                  >
                    {activeVideo.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                {activeVideo.description && (
                  <p className="text-sm text-muted-foreground mt-1">{activeVideo.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {activeVideo.subjectName && (
                    <Badge variant="outline" className={cn('gap-1', getSubjectColor(activeVideo.subjectName))}>
                      <PlayCircle className="h-3 w-3" />
                      {activeVideo.subjectName}
                    </Badge>
                  )}
                  {activeVideo.className && (
                    <Badge variant="secondary">{activeVideo.className}</Badge>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {formatDuration(activeVideo.duration)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" /> {formatViewCount(activeVideo.viewCount)} views
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {formatDate(activeVideo.createdAt)}
                  </span>
                </div>
                {activeVideo.tagsArray && activeVideo.tagsArray.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {activeVideo.tagsArray.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setActiveVideo(null); openEdit(activeVideo); }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteDialog(activeVideo.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search, Sort, Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search video lessons..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {uniqueSubjects.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {uniqueClasses.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterSubject !== 'all' || filterClass !== 'all' || filterStatus !== 'all') && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
            setFilterSubject('all');
            setFilterClass('all');
            setFilterStatus('all');
          }}>
            <X className="h-3 w-3 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Lesson Grid */}
      {loading ? (
        <CardGridSkeleton count={8} />
      ) : filteredLessons.length === 0 ? (
        <Card className="p-12 text-center">
          <Video className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium">No Video Lessons Found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery || filterSubject !== 'all' || filterClass !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Start by uploading your first video lesson!'}
          </p>
          {!searchQuery && filterSubject === 'all' && filterClass === 'all' && filterStatus === 'all' && (
            <Button className="mt-4 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4" />
              Upload First Lesson
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredLessons.map((lesson) => (
              <VideoLessonCard
                key={lesson.id}
                lesson={lesson}
                onPlay={() => setActiveVideo(lesson)}
                onEdit={() => openEdit(lesson)}
                onDelete={() => setDeleteDialog(lesson.id)}
                onToggleFeatured={() => toggleFeatured(lesson)}
                onTogglePublished={() => togglePublished(lesson)}
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

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-emerald-600" />
              Upload Lesson
            </DialogTitle>
            <DialogDescription>Add a new lesson (video, audio, image, or text) for your students</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="upload-title">Title *</Label>
              <Input id="upload-title" placeholder="e.g. Introduction to Algebra" value={uploadForm.title} onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-desc">Description</Label>
              <Textarea id="upload-desc" placeholder="Brief description of the lesson content..." rows={3} value={uploadForm.description} onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Content Type *</Label>
              <Select value={uploadForm.contentType} onValueChange={(v) => setUploadForm((f) => ({ ...f, contentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">🎬 Video Lesson</SelectItem>
                  <SelectItem value="audio">🎵 Audio Lesson</SelectItem>
                  <SelectItem value="text">📝 Text Lesson</SelectItem>
                  <SelectItem value="image">🖼️ Image Lesson</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {uploadForm.contentType === 'video' && (
              <div className="space-y-2">
                <Label htmlFor="upload-url">Video URL * <span className="text-xs text-muted-foreground">(YouTube, TikTok, Facebook, Vimeo, Dailymotion, or direct .mp4 link)</span></Label>
                <Input id="upload-url" placeholder="https://youtube.com/watch?v=..." value={uploadForm.videoUrl} onChange={(e) => setUploadForm((f) => ({ ...f, videoUrl: e.target.value }))} />
              </div>
            )}
            {uploadForm.contentType === 'audio' && (
              <div className="space-y-2">
                <Label htmlFor="upload-audio">Audio URL * <span className="text-xs text-muted-foreground">(Direct link to .mp3, .wav, .ogg file or streaming URL)</span></Label>
                <Input id="upload-audio" placeholder="https://example.com/lesson.mp3" value={uploadForm.audioUrl} onChange={(e) => setUploadForm((f) => ({ ...f, audioUrl: e.target.value }))} />
              </div>
            )}
            {uploadForm.contentType === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="upload-content">Lesson Content *</Label>
                <Textarea id="upload-content" placeholder="Write your lesson content here..." rows={8} value={uploadForm.content} onChange={(e) => setUploadForm((f) => ({ ...f, content: e.target.value }))} />
              </div>
            )}
            {uploadForm.contentType === 'image' && (
              <div className="space-y-2">
                <Label htmlFor="upload-image">Image URL * <span className="text-xs text-muted-foreground">(Direct link to image file)</span></Label>
                <Input id="upload-image" placeholder="https://example.com/diagram.png" value={uploadForm.imageUrl} onChange={(e) => setUploadForm((f) => ({ ...f, imageUrl: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="upload-thumb">Thumbnail URL <span className="text-xs text-muted-foreground">(optional, auto-generated for YouTube/Vimeo)</span></Label>
              <Input id="upload-thumb" placeholder="https://example.com/thumbnail.jpg" value={uploadForm.thumbnailUrl} onChange={(e) => setUploadForm((f) => ({ ...f, thumbnailUrl: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={uploadForm.subjectId} onValueChange={(v) => setUploadForm((f) => ({ ...f, subjectId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {uniqueSubjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={uploadForm.classId} onValueChange={(v) => setUploadForm((f) => ({ ...f, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {uniqueClasses.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="upload-duration">Duration (minutes)</Label>
                <Input id="upload-duration" type="number" placeholder="e.g. 45" value={uploadForm.duration} onChange={(e) => setUploadForm((f) => ({ ...f, duration: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-tags">Tags</Label>
                <Input id="upload-tags" placeholder="e.g. algebra, beginner" value={uploadForm.tags} onChange={(e) => setUploadForm((f) => ({ ...f, tags: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Featured</Label>
                <p className="text-xs text-muted-foreground">Show in the featured section</p>
              </div>
              <Switch checked={uploadForm.isFeatured} onCheckedChange={(v) => setUploadForm((f) => ({ ...f, isFeatured: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Publish immediately</Label>
                <p className="text-xs text-muted-foreground">Make visible to students</p>
              </div>
              <Switch checked={uploadForm.isPublished} onCheckedChange={(v) => setUploadForm((f) => ({ ...f, isPublished: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading...' : 'Upload Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Edit Lesson
            </DialogTitle>
            <DialogDescription>Update the lesson details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input id="edit-title" placeholder="Lesson title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" placeholder="Lesson description..." rows={3} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select value={editForm.contentType} onValueChange={(v) => setEditForm((f) => ({ ...f, contentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">🎬 Video Lesson</SelectItem>
                  <SelectItem value="audio">🎵 Audio Lesson</SelectItem>
                  <SelectItem value="text">📝 Text Lesson</SelectItem>
                  <SelectItem value="image">🖼️ Image Lesson</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.contentType === 'video' && (
              <div className="space-y-2">
                <Label htmlFor="edit-url">Video URL * <span className="text-xs text-muted-foreground">(YouTube, TikTok, Facebook, Vimeo, Dailymotion, or direct .mp4 link)</span></Label>
                <Input id="edit-url" placeholder="https://youtube.com/watch?v=..." value={editForm.videoUrl} onChange={(e) => setEditForm((f) => ({ ...f, videoUrl: e.target.value }))} />
              </div>
            )}
            {editForm.contentType === 'audio' && (
              <div className="space-y-2">
                <Label htmlFor="edit-audio">Audio URL * <span className="text-xs text-muted-foreground">(Direct link to .mp3, .wav, .ogg file or streaming URL)</span></Label>
                <Input id="edit-audio" placeholder="https://example.com/lesson.mp3" value={editForm.audioUrl} onChange={(e) => setEditForm((f) => ({ ...f, audioUrl: e.target.value }))} />
              </div>
            )}
            {editForm.contentType === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="edit-content">Lesson Content *</Label>
                <Textarea id="edit-content" placeholder="Write your lesson content here..." rows={8} value={editForm.content} onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))} />
              </div>
            )}
            {editForm.contentType === 'image' && (
              <div className="space-y-2">
                <Label htmlFor="edit-image">Image URL * <span className="text-xs text-muted-foreground">(Direct link to image file)</span></Label>
                <Input id="edit-image" placeholder="https://example.com/diagram.png" value={editForm.imageUrl} onChange={(e) => setEditForm((f) => ({ ...f, imageUrl: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-thumb">Thumbnail URL</Label>
              <Input id="edit-thumb" placeholder="https://example.com/thumbnail.jpg" value={editForm.thumbnailUrl} onChange={(e) => setEditForm((f) => ({ ...f, thumbnailUrl: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={editForm.subjectId} onValueChange={(v) => setEditForm((f) => ({ ...f, subjectId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {uniqueSubjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={editForm.classId} onValueChange={(v) => setEditForm((f) => ({ ...f, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {uniqueClasses.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-duration">Duration (minutes)</Label>
                <Input id="edit-duration" type="number" placeholder="e.g. 45" value={editForm.duration} onChange={(e) => setEditForm((f) => ({ ...f, duration: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tags">Tags</Label>
                <Input id="edit-tags" placeholder="e.g. algebra, beginner" value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Featured</Label>
                <p className="text-xs text-muted-foreground">Show in the featured section</p>
              </div>
              <Switch checked={editForm.isFeatured} onCheckedChange={(v) => setEditForm((f) => ({ ...f, isFeatured: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Published</Label>
                <p className="text-xs text-muted-foreground">Visible to students</p>
              </div>
              <Switch checked={editForm.isPublished} onCheckedChange={(v) => setEditForm((f) => ({ ...f, isPublished: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditingLesson(null); }}>Cancel</Button>
            <Button onClick={handleEdit} disabled={uploading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {uploading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Video Lesson
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this video lesson? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Video Lesson Card ──────────────────────────────────
function VideoLessonCard({
  lesson,
  onPlay,
  onEdit,
  onDelete,
  onToggleFeatured,
  onTogglePublished,
}: {
  lesson: VideoLesson;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
  onTogglePublished: () => void;
}) {
  const thumbnailSrc = lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl || '');

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-200 border">
      <div className="relative aspect-video bg-muted/30 overflow-hidden cursor-pointer" onClick={onPlay}>
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
        {/* Featured Star */}
        {lesson.isFeatured && (
          <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-xs gap-0.5">
            <Star className="h-3 w-3" />
            Featured
          </Badge>
        )}
        {/* Published/Draft Badge */}
        <Badge
          variant="outline"
          className={cn(
            'absolute top-2 right-2 text-xs',
            lesson.isPublished
              ? 'bg-emerald-500/90 text-white border-emerald-500'
              : 'bg-gray-500/90 text-white border-gray-500'
          )}
        >
          {lesson.isPublished ? 'Published' : 'Draft'}
        </Badge>
      </div>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h4
            className="font-semibold text-sm line-clamp-2 cursor-pointer hover:text-emerald-600 transition-colors flex-1"
            onClick={onPlay}
          >
            {lesson.title}
          </h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onPlay}>
                <Play className="h-4 w-4 mr-2" /> Play
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleFeatured}>
                <Star className={cn('h-4 w-4 mr-2', lesson.isFeatured && 'fill-amber-500 text-amber-500')} />
                {lesson.isFeatured ? 'Unfeature' : 'Feature'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePublished}>
                <CheckCircle2 className={cn('h-4 w-4 mr-2', lesson.isPublished && 'text-emerald-600')} />
                {lesson.isPublished ? 'Unpublish' : 'Publish'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {lesson.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lesson.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {lesson.subjectName && (
            <Badge variant="outline" className={cn('text-xs', getSubjectColor(lesson.subjectName))}>
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
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(lesson.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
