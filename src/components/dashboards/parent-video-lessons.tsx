'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/shared/kpi-card';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Video, Clock, Eye, Star, CheckCircle2, XCircle,
  GraduationCap, TrendingUp, Award, BarChart3, FileBarChart,
  PlayCircle, Loader2,
} from 'lucide-react';

interface VideoLesson {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  classId: string | null;
  contentType: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  viewCount: number;
  isFeatured: boolean;
  isPublished: boolean;
  uploadedBy: string | null;
  uploaderName: string | null;
  subjectName: string | null;
  className: string | null;
  createdAt: string;
}

interface VideoProgress {
  progress: number;
  completed: boolean;
  lessonId: string;
  lastWatchedAt?: string;
}

interface CheckpointProgressSummary {
  totalCheckpoints: number;
  answeredCount: number;
  correctCount: number;
  completionRate: number;
  accuracyRate: number;
  progress: {
    checkpointId: string;
    answer: string;
    isCorrect: boolean;
    answeredAt: string;
  }[];
}

interface ApiStudent {
  id: string;
  admissionNo: string;
  user: { name: string };
  class: { id: string; name: string } | null;
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:00`;
  return `${m}:00`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatViewCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function getVideoThumbnail(url: string): string {
  if (!url) return '';
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
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
  default: 'bg-gray-100 text-gray-700',
};

function getSubjectColor(subjectName: string | null): string {
  if (!subjectName) return subjectColors.default;
  return subjectColors[subjectName] || subjectColors.default;
}

export function ParentVideoLessons() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [children, setChildren] = useState<ApiStudent[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [childrenLoading, setChildrenLoading] = useState(true);

  const [lessons, setLessons] = useState<VideoLesson[]>([]);
  const [videoProgress, setVideoProgress] = useState<Record<string, VideoProgress>>({});
  const [loading, setLoading] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLesson, setDetailLesson] = useState<VideoLesson | null>(null);
  const [checkpointSummary, setCheckpointSummary] = useState<CheckpointProgressSummary | null>(null);
  const [checkpointLoading, setCheckpointLoading] = useState(false);

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        setChildrenLoading(true);
        const res = await fetch(`/api/parent/children?schoolId=${schoolId}`);
        if (res.ok) {
          const json = await res.json();
          const kids: ApiStudent[] = json.data || [];
          setChildren(kids);
        }
      } catch {
        toast.error('Failed to load children');
      } finally {
        setChildrenLoading(false);
      }
    };
    if (schoolId) fetchChildren();
  }, [schoolId, currentUser.id]);

  const fetchData = useCallback(async () => {
    if (children.length === 0) return;
    const child = children[selectedChildIndex];
    if (!child) return;

    try {
      setLoading(true);

      const lessonParams = new URLSearchParams({ schoolId, sortBy: 'recent', limit: '100' });
      const lessonRes = await fetch(`/api/video-lessons?${lessonParams}`);
      if (!lessonRes.ok) throw new Error('Failed to load lessons');
      const lessonJson = await lessonRes.json();
      const published: VideoLesson[] = (lessonJson.data || []).filter((l: VideoLesson) => l.isPublished);
      setLessons(published);

      if (published.length > 0) {
        const lessonIds = published.map(l => l.id);
        const progressRes = await fetch(`/api/video-progress?lessonIds=${lessonIds.join(',')}&studentId=${child.id}`);
        if (progressRes.ok) {
          const progressJson = await progressRes.json();
          setVideoProgress(progressJson.data || {});
        }
      }
    } catch {
      toast.error('Failed to load video lessons');
    } finally {
      setLoading(false);
    }
  }, [children, selectedChildIndex, schoolId]);

  useEffect(() => {
    if (children.length > 0) fetchData();
  }, [fetchData, children]);

  const selectedChild = children[selectedChildIndex] || null;
  const childName = selectedChild?.user?.name || 'Child';
  const childClass = selectedChild?.class?.name || '—';

  const watchedCount = lessons.filter(l => {
    const p = videoProgress[l.id];
    return p && p.progress > 0;
  }).length;

  const completedCount = lessons.filter(l => {
    const p = videoProgress[l.id];
    return p && p.completed;
  }).length;

  const totalCheckpointsAnswered = lessons.reduce((sum, l) => sum + ((videoProgress[l.id] as any)?.checkpointAnswered || 0), 0);

  const openDetail = async (lesson: VideoLesson) => {
    setDetailLesson(lesson);
    setDetailOpen(true);
    setCheckpointSummary(null);

    if (!selectedChild) return;
    setCheckpointLoading(true);
    try {
      const res = await fetch(`/api/video-checkpoints/progress?lessonId=${lesson.id}&studentId=${selectedChild.id}`);
      if (res.ok) {
        const json = await res.json();
        setCheckpointSummary(json.data || null);
      }
    } catch {
      // silent
    } finally {
      setCheckpointLoading(false);
    }
  };

  if (childrenLoading || (loading && children.length > 0)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Video Progress</h1>
          <p className="text-muted-foreground">
            {childName} — {childClass}
            {children.length > 1 && (
              <span className="ml-2 flex gap-1 inline-flex">
                {children.map((child, i) => (
                  <Badge
                    key={child.id}
                    variant={i === selectedChildIndex ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => { setSelectedChildIndex(i); }}
                  >
                    {child.user.name.split(' ')[0]}
                  </Badge>
                ))}
              </span>
            )}
          </p>
        </div>
        <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
          <Video className="h-3.5 w-3.5" />
          {lessons.length} lessons
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard title="Total Lessons" value={lessons.length} icon={Video} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Watched" value={watchedCount} icon={TrendingUp} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
        <KpiCard title="Completed" value={completedCount} icon={CheckCircle2} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard title="Not Started" value={lessons.length - watchedCount} icon={PlayCircle} iconBgColor="bg-gray-100" iconColor="text-gray-600" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : lessons.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Video className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No Video Lessons</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              No video lessons have been assigned yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {lessons.map(lesson => {
            const progress = videoProgress[lesson.id];
            const pct = progress?.progress || 0;
            const completed = progress?.completed || false;
            const watched = pct > 0;
            const thumbnailSrc = lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl || '');

            return (
              <Card key={lesson.id} className={cn(
                'hover:shadow-md transition-shadow',
                completed && 'border-emerald-200 bg-emerald-50/30',
                watched && !completed && 'border-amber-200 bg-amber-50/30',
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="relative w-36 aspect-video rounded-lg overflow-hidden bg-muted/30 shrink-0">
                      {thumbnailSrc ? (
                        <img src={thumbnailSrc} alt={lesson.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
                          <Video className="h-8 w-8 text-emerald-400" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDuration(lesson.duration)}
                      </div>
                      {completed && (
                        <div className="absolute top-1 left-1">
                          <Badge className="bg-emerald-600 text-white text-[10px] gap-0.5 px-1.5 py-0">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Done
                          </Badge>
                        </div>
                      )}
                      {watched && !completed && (
                        <div className="absolute top-1 left-1">
                          <Badge className="bg-amber-500 text-white text-[10px] gap-0.5 px-1.5 py-0">
                            <TrendingUp className="h-2.5 w-2.5" /> {pct}%
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight">{lesson.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        {lesson.subjectName && (
                          <Badge variant="outline" className={cn('text-[10px]', getSubjectColor(lesson.subjectName))}>
                            <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                            {lesson.subjectName}
                          </Badge>
                        )}
                        {lesson.className && <span>{lesson.className}</span>}
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-3 w-3" /> {formatViewCount(lesson.viewCount)} views
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 max-w-xs">
                          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-300',
                                completed ? 'bg-emerald-500' : watched ? 'bg-amber-500' : 'bg-gray-300',
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {completed ? '100%' : `${pct}%`}
                        </span>
                      </div>

                      {lesson.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{lesson.description}</p>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(lesson)}
                      className="shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      <BarChart3 className="size-4 mr-1" /> Progress
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {detailLesson && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileBarChart className="size-5 text-emerald-600" /> {detailLesson.title}
                </DialogTitle>
                <DialogDescription>
                  {detailLesson.subjectName && `${detailLesson.subjectName} · `}
                  {detailLesson.className && `${detailLesson.className} · `}
                  {formatDuration(detailLesson.duration)} duration
                </DialogDescription>
              </DialogHeader>

              {checkpointLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : checkpointSummary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{checkpointSummary.totalCheckpoints}</p>
                      <p className="text-xs text-muted-foreground">Total Checkpoints</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{checkpointSummary.answeredCount}</p>
                      <p className="text-xs text-muted-foreground">Answered</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{checkpointSummary.correctCount}</p>
                      <p className="text-xs text-muted-foreground">Correct</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600">{checkpointSummary.accuracyRate}%</p>
                      <p className="text-xs text-muted-foreground">Accuracy</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Completion Rate</span>
                      <span className="font-bold">{checkpointSummary.completionRate}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${checkpointSummary.completionRate}%` }}
                      />
                    </div>
                  </div>

                  {checkpointSummary.progress.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Checkpoint Results</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {checkpointSummary.progress.map((cp, idx) => (
                          <div
                            key={cp.checkpointId}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-lg text-sm',
                              cp.isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200',
                            )}
                          >
                            {cp.isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                            )}
                            <span className={cn(
                              'font-medium',
                              cp.isCorrect ? 'text-emerald-700' : 'text-red-700',
                            )}>
                              #{idx + 1}
                            </span>
                            <span className="text-muted-foreground ml-auto text-xs">
                              {cp.answeredAt ? formatDate(cp.answeredAt) : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Award className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                  <p>No checkpoint data available for this lesson.</p>
                  <p className="text-xs mt-1">Checkpoints are created by teachers for video lessons.</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
