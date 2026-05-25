'use client';

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Rewind } from 'lucide-react';
import { toast } from 'sonner';

interface Checkpoint {
  id: string;
  lessonId: string;
  timestamp: number;
  question: string;
  questionType: string;
  options: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  order: number;
  isRequired: boolean;
}

interface CheckpointProgress {
  checkpointId: string;
  isCorrect: boolean;
  answer: string | null;
}

interface Props {
  lessonId: string;
  videoUrl: string;
  contentType: string;
  duration: number;
  onComplete?: () => void;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

function getEmbedUrl(url: string): string {
  if (!url) return '';
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?api=1`;
  if (url.includes('embed') || url.includes('plugins/video')) return url;
  if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) return url;
  return url;
}

// YouTube IFrame API types (no namespace — prefer module syntax)
interface YTPlayerHandle {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  pauseVideo(): void;
  playVideo(): void;
  destroy(): void;
}
interface YTPlayerConfig {
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (event: { data: number }) => void;
  };
}
declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string | HTMLElement, config: YTPlayerConfig) => YTPlayerHandle;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function CheckpointVideoPlayer({ lessonId, videoUrl, contentType, duration: totalMinutes, onComplete }: Props) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(true);
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [checkpointResult, setCheckpointResult] = useState<'correct' | 'wrong' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [progressData, setProgressData] = useState<CheckpointProgress[]>([]);
  const [ytReady, setYtReady] = useState(false);
  const [ytError, setYtError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const lastCheckpointIdx = useRef(-1);
  const seekingRef = useRef(false);
  const ytPlayerRef = useRef<YTPlayerHandle | null>(null);
  const [embedSrc, setEmbedSrc] = useState('');

  const totalSecs = totalMinutes * 60;
  const isYouTube = !!getYouTubeId(videoUrl);
  const isVimeo = !!getVimeoId(videoUrl);
  const isOtherEmbed = !!videoUrl && !isYouTube && !isVimeo && /embed|plugins/.test(videoUrl);
  const isDirectMedia = !!videoUrl && !isYouTube && !isVimeo && !isOtherEmbed;
  const ytContainerId = useId();

  // Set iframe embedSrc for Vimeo / other (NOT YouTube)
  useEffect(() => {
    if (videoUrl && !isYouTube) setEmbedSrc(getEmbedUrl(videoUrl));
  }, [videoUrl, isYouTube]);

  // Load checkpoints
  useEffect(() => {
    if (!lessonId) return;
    setLoadingCheckpoints(true);
    fetch(`/api/video-checkpoints?lessonId=${lessonId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => {
        const items = json.data || json || [];
        setCheckpoints(items.sort((a: Checkpoint, b: Checkpoint) => a.timestamp - b.timestamp));
      })
      .catch(() => toast.error('Failed to load checkpoints'))
      .finally(() => setLoadingCheckpoints(false));
  }, [lessonId]);

  // Progress updates
  const updateProgress = useCallback(async (pct: number) => {
    try {
      await fetch('/api/video-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, progress: pct, completed: pct >= 95 }),
      });
    } catch { /* silent */ }
  }, [lessonId]);

  // Stable refs for callbacks
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const updateProgressRef = useRef(updateProgress);
  updateProgressRef.current = updateProgress;
  const totalMinutesRef = useRef(totalMinutes);
  totalMinutesRef.current = totalMinutes;

  // Checkpoint detection
  useEffect(() => {
    if (!checkpoints.length || activeCheckpoint || completed || seekingRef.current) return;

    const nextCp = checkpoints.find((cp, idx) => {
      if (idx <= lastCheckpointIdx.current) return false;
      return currentTime >= cp.timestamp;
    });

    if (nextCp) {
      const cpIdx = checkpoints.indexOf(nextCp);
      lastCheckpointIdx.current = cpIdx;
      pauseVideo();
      setActiveCheckpoint(nextCp);
      setSelectedAnswer('');
      setCheckpointResult(null);
    }
  }, [currentTime, checkpoints, activeCheckpoint, completed]);

  // -----------------------------------------------------------------------
  // YouTube IFrame API — load script + create player (deferred for Dialog)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isYouTube) return;

    let destroyed = false;
    const videoId = getYouTubeId(videoUrl);
    if (!videoId) return;

    if (!window.YT) {
      const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existing) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    const createPlayer = () => {
      if (destroyed || !window.YT?.Player || ytPlayerRef.current) return;
      const container = document.getElementById(ytContainerId);
      if (!container || container.clientWidth === 0) {
        // Container not ready yet — retry
        if (!destroyed) setTimeout(createPlayer, 500);
        return;
      }
      try {
        ytPlayerRef.current = new window.YT.Player(container, {
          videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => { if (!destroyed) setYtReady(true); },
            onStateChange: (event: { data: number }) => {
              if (destroyed) return;
              if (event.data === 0) {
                setCompleted(true);
                updateProgressRef.current(100);
                onCompleteRef.current?.();
              }
            },
          },
        });
        setYtError(false);
      } catch {
        setYtError(true);
        if (!destroyed) setTimeout(createPlayer, 2000);
      }
    };

    // Defer creation so the Dialog portal is fully rendered (CSS transitions ~200ms)
    const deferTimer = setTimeout(() => {
      if (window.YT?.Player) {
        createPlayer();
      } else {
        window.onYouTubeIframeAPIReady = createPlayer;
      }
    }, 300);

    // Fallback poll every 800ms for safety
    const fallback = setInterval(() => {
      if (window.YT?.Player && !ytPlayerRef.current) createPlayer();
    }, 800);

    return () => {
      destroyed = true;
      clearTimeout(deferTimer);
      clearInterval(fallback);
      if (window.onYouTubeIframeAPIReady === createPlayer) {
        window.onYouTubeIframeAPIReady = undefined;
      }
      setYtReady(false);
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch { /* ignore */ }
        ytPlayerRef.current = null;
      }
    };
  }, [isYouTube, videoUrl, ytContainerId]);

  // -----------------------------------------------------------------------
  // YouTube poller — reads currentTime every 1s
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isYouTube || !ytReady) return;

    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player) return;
      try {
        const time = player.getCurrentTime();
        const dur = player.getDuration();
        if (isFinite(time)) setCurrentTime(time);
        if (isFinite(dur) && dur > 0) setTotalDuration(dur);
        const effectiveDur = dur > 0 ? dur : totalMinutesRef.current * 60;
        if (effectiveDur > 0) {
          const pct = Math.min(100, Math.round((time / effectiveDur) * 100));
          setProgress(pct);
          if (pct % 10 === 0) updateProgressRef.current(pct);
        }
      } catch { /* player not ready */ }
    }, 1000);

    return () => clearInterval(interval);
  }, [isYouTube, ytReady]);

  // -----------------------------------------------------------------------
  // Vimeo / other embed — postMessage polling for currentTime
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isYouTube || isDirectMedia) return;

    const pollInterval = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        if (isVimeo) {
          iframeRef.current.contentWindow.postMessage('{"method":"getCurrentTime"}', '*');
        }
      }
    }, 1000);

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.info?.currentTime !== undefined) {
          setCurrentTime(data.info.currentTime);
          if (data.info.duration > 0) setTotalDuration(data.info.duration);
          const dur = data.info.duration || totalMinutesRef.current * 60;
          if (dur > 0) {
            const pct = Math.min(100, Math.round((data.info.currentTime / dur) * 100));
            setProgress(pct);
            if (pct % 10 === 0) updateProgressRef.current(pct);
          }
        }
        if (data?.event === 'onStateChange') {
          if (data.info === 0) {
            setCompleted(true);
            updateProgressRef.current(100);
            onCompleteRef.current?.();
          }
        }
      } catch { /* not a JSON message */ }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('message', handleMessage);
    };
  }, [isYouTube, isVimeo, isDirectMedia]);

  // -----------------------------------------------------------------------
  // Video controls
  // -----------------------------------------------------------------------
  const pauseVideo = useCallback(() => {
    if (videoRef.current) { videoRef.current.pause(); }
    if (ytPlayerRef.current) { ytPlayerRef.current.pauseVideo(); }
    if (iframeRef.current && isVimeo) {
      try { iframeRef.current.contentWindow?.postMessage('{"method":"pause"}', '*'); } catch { /* cross-origin */ }
    }
  }, [isVimeo]);

  const playVideo = useCallback(() => {
    if (videoRef.current) { videoRef.current.play(); }
    if (ytPlayerRef.current) { ytPlayerRef.current.playVideo(); }
    if (iframeRef.current && isVimeo) {
      try { iframeRef.current.contentWindow?.postMessage('{"method":"play"}', '*'); } catch { /* cross-origin */ }
    }
  }, [isVimeo]);

  const seekTo = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    if (videoRef.current) { videoRef.current.currentTime = seconds; }
    if (ytPlayerRef.current) { ytPlayerRef.current.seekTo(seconds, true); }
    if (iframeRef.current && isVimeo) {
      try {
        iframeRef.current.contentWindow?.postMessage(JSON.stringify({ method: 'seekTo', value: seconds }), '*');
      } catch { /* cross-origin */ }
    }
  }, [isVimeo]);

  // -----------------------------------------------------------------------
  // Checkpoint submission
  // -----------------------------------------------------------------------
  const handleSubmitCheckpoint = async () => {
    if (!activeCheckpoint || !selectedAnswer) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/video-checkpoints/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkpointId: activeCheckpoint.id,
          lessonId,
          answer: selectedAnswer,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit');

      const isCorrect = (json.data?.isCorrect ?? json.isCorrect) === true;
      setCheckpointResult(isCorrect ? 'correct' : 'wrong');
      setProgressData(prev => [...prev, { checkpointId: activeCheckpoint.id, isCorrect, answer: selectedAnswer }]);

      if (isCorrect) {
        setTimeout(() => {
          const completedCp = activeCheckpoint;
          setActiveCheckpoint(null);
          setCheckpointResult(null);
          const remaining = checkpoints.filter(cp => cp.timestamp > completedCp.timestamp);
          if (remaining.length === 0 && !completed) {
            setCompleted(true);
            onComplete?.();
          }
          playVideo();
        }, 1500);
      } else {
        setTimeout(() => {
          const prevTimestamp = lastCheckpointIdx.current > 0
            ? checkpoints[lastCheckpointIdx.current - 1].timestamp
            : 0;
          seekingRef.current = true;
          seekTo(prevTimestamp);
          lastCheckpointIdx.current = Math.max(0, lastCheckpointIdx.current - 1);
          setTimeout(() => {
            setActiveCheckpoint(null);
            setCheckpointResult(null);
            seekingRef.current = false;
            playVideo();
          }, 800);
        }, 2000);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Submission failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Direct media handlers
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      const dur = videoRef.current.duration || totalSecs;
      setCurrentTime(time);
      if (dur > 0) setTotalDuration(dur);
      const pct = Math.min(100, Math.round((time / dur) * 100));
      setProgress(pct);
      if (pct % 5 === 0) updateProgress(pct);
    }
  }, [totalSecs, updateProgress]);

  const handleEnded = useCallback(() => {
    setCompleted(true);
    updateProgress(100);
    onComplete?.();
  }, [onComplete, updateProgress]);

  const handleLoadedMeta = useCallback(() => {
    if (videoRef.current && videoRef.current.duration > 0) {
      setTotalDuration(videoRef.current.duration);
    }
  }, []);

  // Parse options
  const options: string[] = activeCheckpoint?.options
    ? (Array.isArray(activeCheckpoint.options)
        ? activeCheckpoint.options
        : (() => {
            try { return JSON.parse(activeCheckpoint.options as string); }
            catch { return []; }
          })())
    : [];

  // ── Loading state ──
  if (loadingCheckpoints) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-4" ref={playerContainerRef}>
      {/* Video Player */}
      <div className="relative rounded-xl overflow-hidden bg-black shadow-lg">
        {isYouTube ? (
          <div className="w-full aspect-video relative bg-black">
            <div id={ytContainerId} className="w-full h-full" />
            {!ytReady && !ytError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/60" />
              </div>
            )}
            {ytError && (
              <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm px-4 text-center">
                YouTube player failed to load. Please refresh and try again.
              </div>
            )}
            {activeCheckpoint && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                <div className="text-white text-center p-4">
                  <Rewind className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                  <p className="text-lg font-semibold">Checkpoint reached</p>
                  <p className="text-sm text-gray-300">Answer the question to continue</p>
                </div>
              </div>
            )}
          </div>
        ) : isDirectMedia ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full aspect-video"
            controls={!activeCheckpoint}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMeta}
            onEnded={handleEnded}
            onPlay={() => {}}
            onPause={() => {}}
            playsInline
          />
        ) : (
          <div className="w-full aspect-video relative">
            <iframe
              ref={iframeRef}
              src={embedSrc}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {activeCheckpoint && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                <div className="text-white text-center p-4">
                  <Rewind className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                  <p className="text-lg font-semibold">Checkpoint reached</p>
                  <p className="text-sm text-gray-300">Answer the question to continue</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Progress info */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span>{checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''}</span>
          {progressData.length > 0 && (
            <span>• {progressData.filter(p => p.isCorrect).length}/{progressData.length} correct</span>
          )}
        </div>
        {completed && (
          <Badge className="bg-emerald-600">Completed</Badge>
        )}
      </div>

      {/* Checkpoint Quiz Overlay */}
      {activeCheckpoint && (
        <Card className="border-emerald-200 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                Checkpoint
              </Badge>
              {activeCheckpoint.questionType === 'TRUE_FALSE' ? 'True or False' : 'Multiple Choice'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium text-sm">{activeCheckpoint.question}</p>

            {checkpointResult ? (
              <div className={`p-4 rounded-lg ${checkpointResult === 'correct' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {checkpointResult === 'correct' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-semibold ${checkpointResult === 'correct' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {checkpointResult === 'correct' ? 'Correct!' : 'Incorrect'}
                  </span>
                </div>
                {activeCheckpoint.explanation && (
                  <p className="text-sm text-gray-600 mt-1">{activeCheckpoint.explanation}</p>
                )}
                {checkpointResult === 'wrong' && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <Rewind className="h-4 w-4" />
                    Rewinding to replay this section...
                  </p>
                )}
              </div>
            ) : (
              <>
                <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
                  {activeCheckpoint.questionType === 'MCQ' && options.map((opt: string, i: number) => (
                    <div key={i} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50">
                      <RadioGroupItem value={String(i)} id={`cp-${i}`} />
                      <Label htmlFor={`cp-${i}`} className="text-sm cursor-pointer flex-1">{opt}</Label>
                    </div>
                  ))}
                  {activeCheckpoint.questionType === 'TRUE_FALSE' && (
                    <>
                      <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value="true" id="cp-true" />
                        <Label htmlFor="cp-true" className="text-sm cursor-pointer">True</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value="false" id="cp-false" />
                        <Label htmlFor="cp-false" className="text-sm cursor-pointer">False</Label>
                      </div>
                    </>
                  )}
                </RadioGroup>

                <Button
                  onClick={handleSubmitCheckpoint}
                  disabled={!selectedAnswer || submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Answer'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
