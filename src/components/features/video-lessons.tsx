'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Video,
  Clock,
  Eye,
  Upload,
  Search,
  BookOpen,
  Clapperboard,
  TrendingUp,
  Filter,
  Star,
  X,
  Calendar,
  User,
  Tag,
  ArrowUpDown,
  ThumbsUp,
  ListVideo,
  PlayCircle,
  Plus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface VideoLesson {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  classId: string | null;
  videoUrl: string;
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
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function getEmbedUrl(url: string): string {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  // If already an embed URL, return as-is
  if (url.includes('iframe') || url.includes('embed')) return url;

  return url;
}

function getVideoThumbnail(url: string): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;

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
  'Art': 'bg-pink-100 text-pink-700',
  'Music': 'bg-rose-100 text-rose-700',
  default: 'bg-gray-100 text-gray-700',
};

function getSubjectColor(subjectName: string | null): string {
  if (!subjectName) return subjectColors.default;
  return subjectColors[subjectName] || subjectColors.default;
}

export default function VideoLessons() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const schoolId = currentUser?.schoolId || selectedSchoolId || '';

  // State
  const [activeTab, setActiveTab] = useState('all');
  const [lessons, setLessons] = useState<VideoLesson[]>([]);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [activeVideo, setActiveVideo] = useState<VideoLesson | null>(null);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    subjectId: '',
    classId: '',
    videoUrl: '',
    duration: '',
    tags: '',
  });

  // Derived data
  const uniqueSubjects = [...new Set(lessons.map((l) => l.subjectName).filter(Boolean))] as string[];
  const uniqueClasses = [...new Set(lessons.map((l) => l.className).filter(Boolean))] as string[];

  const featuredLessons = lessons.filter((l) => l.isFeatured).slice(0, 3);
  const filteredLessons = lessons.filter((lesson) => {
    if (filterSubject !== 'all' && lesson.subjectName !== filterSubject) return false;
    if (filterClass !== 'all' && lesson.className !== filterClass) return false;
    if (activeTab === 'my-uploads' && lesson.uploadedBy !== currentUser?.id) return false;
    return true;
  });

  const fetchLessons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (schoolId) params.set('schoolId', schoolId);
      params.set('sortBy', sortBy);
      params.set('limit', '100');
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/video-lessons?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setLessons(json.data || []);
      setStats(json.stats || null);
    } catch {
      toast.error('Failed to load video lessons');
    } finally {
      setLoading(false);
    }
  }, [schoolId, sortBy, searchQuery]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const handlePlayVideo = async (lesson: VideoLesson) => {
    setActiveVideo(lesson);
    // Increment view count
    try {
      await fetch('/api/video-lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lesson.id, viewCount: true }),
      });
    } catch {
      // Silently fail for view count
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!uploadForm.videoUrl.trim()) {
      toast.error('Video URL is required');
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
          subjectId: uploadForm.subjectId || null,
          classId: uploadForm.classId || null,
          videoUrl: uploadForm.videoUrl,
          duration: parseInt(uploadForm.duration) || 0,
          tags: uploadForm.tags || null,
          uploadedBy: currentUser?.id || null,
          isFeatured: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to upload');
      }

      toast.success('Video lesson uploaded successfully!');
      setUploadOpen(false);
      setUploadForm({ title: '', description: '', subjectId: '', classId: '', videoUrl: '', duration: '', tags: '' });
      fetchLessons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const isTeacher = currentRole === 'TEACHER' || currentRole === 'SCHOOL_ADMIN' || currentRole === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-100">
            <Clapperboard className="h-6 w-6 text-rose-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Video Lessons</h2>
            <p className="text-sm text-gray-500">Browse, watch, and manage video lessons</p>
          </div>
        </div>
        {isTeacher && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-rose-600 hover:bg-rose-700">
                <Upload className="h-4 w-4" />
                Upload Video
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-rose-600" />
                  Upload Video Lesson
                </DialogTitle>
                <DialogDescription>
                  Add a new video lesson for your students
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="upload-title">Title *</Label>
                  <Input
                    id="upload-title"
                    placeholder="e.g. Introduction to Algebra"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-desc">Description</Label>
                  <Textarea
                    id="upload-desc"
                    placeholder="Brief description of the lesson content..."
                    rows={3}
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="upload-subject">Subject</Label>
                    <Select value={uploadForm.subjectId} onValueChange={(v) => setUploadForm((f) => ({ ...f, subjectId: v }))}>
                      <SelectTrigger id="upload-subject">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueSubjects.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-class">Class</Label>
                    <Select value={uploadForm.classId} onValueChange={(v) => setUploadForm((f) => ({ ...f, classId: v }))}>
                      <SelectTrigger id="upload-class">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueClasses.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-url">Video URL * <span className="text-xs text-gray-400">(YouTube, Vimeo, or embed link)</span></Label>
                  <Input
                    id="upload-url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={uploadForm.videoUrl}
                    onChange={(e) => setUploadForm((f) => ({ ...f, videoUrl: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="upload-duration">Duration (minutes)</Label>
                    <Input
                      id="upload-duration"
                      type="number"
                      placeholder="e.g. 45"
                      value={uploadForm.duration}
                      onChange={(e) => setUploadForm((f) => ({ ...f, duration: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-tags">Tags</Label>
                    <Input
                      id="upload-tags"
                      placeholder="e.g. algebra, beginner"
                      value={uploadForm.tags}
                      onChange={(e) => setUploadForm((f) => ({ ...f, tags: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                <Button onClick={handleUpload} disabled={uploading} className="gap-2 bg-rose-600 hover:bg-rose-700">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading...' : 'Upload Lesson'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100">
                <ListVideo className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLessons}</p>
                <p className="text-xs text-gray-500">Total Lessons</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalWatchTime || 0}</p>
                <p className="text-xs text-gray-500">Total Watch Time</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <BookOpen className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.categories}</p>
                <p className="text-xs text-gray-500">Categories</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.thisWeek}</p>
                <p className="text-xs text-gray-500">This Week</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Video Player */}
      {activeVideo && (
        <Card className="overflow-hidden">
          <div className="relative">
            <div className="aspect-video w-full bg-black">
              <iframe
                src={getEmbedUrl(activeVideo.videoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={activeVideo.title}
              />
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
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{activeVideo.title}</h3>
                {activeVideo.description && (
                  <p className="text-sm text-gray-500 mt-1">{activeVideo.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  {activeVideo.subjectName && (
                    <Badge variant="outline" className={getSubjectColor(activeVideo.subjectName)}>
                      <BookOpen className="h-3 w-3 mr-1" />
                      {activeVideo.subjectName}
                    </Badge>
                  )}
                  {activeVideo.className && (
                    <Badge variant="secondary">
                      <User className="h-3 w-3 mr-1" />
                      {activeVideo.className}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {formatDuration(activeVideo.duration)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Eye className="h-3 w-3" />
                    {formatViewCount(activeVideo.viewCount)} views
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {formatDate(activeVideo.createdAt)}
                  </span>
                </div>
                {activeVideo.uploaderName && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
                      <User className="h-3 w-3 text-rose-600" />
                    </div>
                    <span>{activeVideo.uploaderName}</span>
                  </div>
                )}
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Featured / Latest Section */}
      {!activeVideo && featuredLessons.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900">Featured & Latest</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredLessons.map((lesson) => (
              <Card
                key={lesson.id}
                className="cursor-pointer group overflow-hidden hover:shadow-lg transition-all duration-200"
                onClick={() => handlePlayVideo(lesson)}
              >
                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                  {lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl) ? (
                    <img
                      src={lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl)}
                      alt={lesson.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-100 to-rose-200">
                      <Video className="h-12 w-12 text-rose-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play className="h-7 w-7 text-rose-600 ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(lesson.duration)}
                  </div>
                  <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-xs gap-1">
                    <Star className="h-3 w-3" />
                    Featured
                  </Badge>
                </div>
                <CardContent className="p-3">
                  <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">{lesson.title}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    {lesson.subjectName && (
                      <Badge variant="outline" className={`text-xs ${getSubjectColor(lesson.subjectName)}`}>
                        {lesson.subjectName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    {lesson.uploaderName && <span className="flex items-center gap-1"><User className="h-3 w-3" />{lesson.uploaderName}</span>}
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatViewCount(lesson.viewCount)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tabs & Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <ListVideo className="h-4 w-4" />
              All Lessons
            </TabsTrigger>
            {isTeacher && (
              <TabsTrigger value="my-uploads" className="gap-1.5">
                <Upload className="h-4 w-4" />
                My Uploads
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className="gap-1.5">
              <Clock className="h-4 w-4" />
              Watch History
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
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

        {/* Filter Row */}
        <div className="flex items-center gap-3 mt-4">
          <Filter className="h-4 w-4 text-gray-400" />
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
          {(filterSubject !== 'all' || filterClass !== 'all') && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterSubject('all'); setFilterClass('all'); }}>
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* All Lessons Tab */}
        <TabsContent value="all" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-rose-500 animate-spin" />
              <span className="ml-3 text-gray-500">Loading lessons...</span>
            </div>
          ) : filteredLessons.length === 0 ? (
            <Card className="p-12 text-center">
              <Video className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700">No Video Lessons Found</h3>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery || filterSubject !== 'all' || filterClass !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Be the first to upload a video lesson!'}
              </p>
              {isTeacher && !searchQuery && (
                <Button
                  className="mt-4 gap-2 bg-rose-600 hover:bg-rose-700"
                  onClick={() => setUploadOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Upload First Lesson
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLessons.map((lesson) => (
                <VideoCard
                  key={lesson.id}
                  lesson={lesson}
                  onPlay={handlePlayVideo}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Uploads Tab */}
        {isTeacher && (
          <TabsContent value="my-uploads" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 text-rose-500 animate-spin" />
              </div>
            ) : filteredLessons.length === 0 ? (
              <Card className="p-12 text-center">
                <Upload className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-700">No Uploads Yet</h3>
                <p className="text-sm text-gray-400 mt-1">Start sharing your knowledge with video lessons</p>
                <Button className="mt-4 gap-2 bg-rose-600 hover:bg-rose-700" onClick={() => setUploadOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Upload Your First Lesson
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredLessons.map((lesson) => (
                  <VideoCard key={lesson.id} lesson={lesson} onPlay={handlePlayVideo} />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* Watch History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card className="p-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700">Watch History</h3>
            <p className="text-sm text-gray-400 mt-1">Videos you watch will appear here</p>
            <p className="text-xs text-gray-300 mt-2">Start watching a video to build your history</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Video Card Component
function VideoCard({ lesson, onPlay }: { lesson: VideoLesson; onPlay: (lesson: VideoLesson) => void }) {
  const thumbnailSrc = lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl);

  return (
    <Card
      className="cursor-pointer group overflow-hidden hover:shadow-lg transition-all duration-200 border border-gray-200"
      onClick={() => onPlay(lesson)}
    >
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={lesson.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Video className="h-10 w-10 text-gray-400" />
          </div>
        )}
        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Play className="h-6 w-6 text-rose-600 ml-0.5" />
          </div>
        </div>
        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-white text-xs font-medium flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(lesson.duration)}
        </div>
        {/* Featured Badge */}
        {lesson.isFeatured && (
          <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-xs gap-0.5">
            <Star className="h-3 w-3" />
          </Badge>
        )}
      </div>
      <CardContent className="p-3">
        <h4 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-rose-600 transition-colors">
          {lesson.title}
        </h4>
        {/* Subject Badge */}
        {lesson.subjectName && (
          <div className="mt-2">
            <Badge variant="outline" className={`text-xs ${getSubjectColor(lesson.subjectName)}`}>
              {lesson.subjectName}
            </Badge>
          </div>
        )}
        {/* Meta Info */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          {lesson.uploaderName && (
            <span className="flex items-center gap-1 truncate max-w-[60%]" title={lesson.uploaderName}>
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{lesson.uploaderName}</span>
            </span>
          )}
          <span className="flex items-center gap-1 flex-shrink-0">
            <Eye className="h-3 w-3" />
            {formatViewCount(lesson.viewCount)}
          </span>
        </div>
        {/* Tags */}
        {lesson.tagsArray && lesson.tagsArray.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {lesson.tagsArray.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                <Tag className="h-2 w-2" />
                {tag}
              </Badge>
            ))}
            {lesson.tagsArray.length > 2 && (
              <span className="text-[10px] text-gray-400">+{lesson.tagsArray.length - 2}</span>
            )}
          </div>
        )}
        {/* Date */}
        <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(lesson.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}
