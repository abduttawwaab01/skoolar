'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Rewind, Play, Pause } from 'lucide-react';
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

export function CheckpointVideoPlayer({ lessonId, videoUrl, contentType, duration: totalMinutes, onComplete }: Props) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(true);
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [checkpointResult, setCheckpointResult] = useState<'correct' | 'wrong' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [progressData, setProgressData] = useState<CheckpointProgress[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const lastCheckpointIdx = useRef(-1);
  const seekingRef = useRef(false);
  const totalSecs = totalMinutes * 60;
  const isDirectMedia = videoUrl && !/youtube|youtu\.be|vimeo|dailymotion|facebook|tiktok|embed/.test(videoUrl);

  // Load checkpoints for this lesson
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

  // Track progress updates to backend
  const updateProgress = useCallback(async (pct: number) => {
    try {
      await fetch('/api/video-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, progress: pct, completed: pct >= 95 }),
      });
    } catch { /* silent */ }
  }, [lessonId]);

  // Check if current time hits a checkpoint
  useEffect(() => {
    if (!checkpoints.length || activeCheckpoint || completed || seekingRef.current) return;

    const nextCp = checkpoints.find((cp, idx) => {
      if (idx <= lastCheckpointIdx.current) return false;
      if (totalDuration <= 0) return currentTime >= cp.timestamp && cp.timestamp > 0;
      const cpRatio = cp.timestamp / totalDuration;
      const curRatio = currentTime / totalDuration;
      return curRatio >= cpRatio;
    });

    if (nextCp) {
      const cpIdx = checkpoints.indexOf(nextCp);
      lastCheckpointIdx.current = cpIdx;
      pauseVideo();
      setActiveCheckpoint(nextCp);
      setSelectedAnswer('');
      setCheckpointResult(null);
    }
  }, [currentTime, checkpoints, activeCheckpoint, completed, totalDuration]);

  // Poll current time for embedded YouTube/Vimeo (no direct timeupdate event available)
  useEffect(() => {
    if (isDirectMedia) return;
    const pollInterval = setInterval(() => {
      // Check ref inside interval so polling starts once iframe is rendered
      if (iframeRef.current?.contentWindow) {
        // Request current time from YouTube player
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }), '*'
        );
      }
    }, 1000);

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.info?.currentTime !== undefined) {
          setCurrentTime(data.info.currentTime);
          const dur = totalMinutes * 60;
          if (dur > 0) {
            const pct = Math.min(100, Math.round((data.info.currentTime / dur) * 100));
            setProgress(pct);
            if (pct % 10 === 0) updateProgress(pct);
          }
        }
        // YouTube ready event — start polling for time
        if (data?.event === 'onReady') {
          // YouTube player is ready; the interval above handles polling
        }
      } catch { /* not a JSON message */ }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('message', handleMessage);
    };
  }, [isDirectMedia, totalMinutes, updateProgress]);

  const pauseVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    if (iframeRef.current) {
      try {
        const isYoutube = /youtube|youtu\.be/.test(videoUrl);
        if (isYoutube) {
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'
          );
        } else {
          iframeRef.current.contentWindow?.postMessage('{"method":"pause"}', '*');
        }
      } catch { /* cross-origin */ }
    }
  }, [videoUrl]);

  const playVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
    if (iframeRef.current) {
      try {
        const isYoutube = /youtube|youtu\.be/.test(videoUrl);
        if (isYoutube) {
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
          );
        }
      } catch { /* cross-origin */ }
    }
  }, [videoUrl]);

  const seekTo = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
    if (iframeRef.current) {
      const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        try {
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }), '*'
          );
        } catch { /* cross-origin */ }
      }
    }
  }, [videoUrl]);

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
          // Check if this was the last checkpoint
          const remaining = checkpoints.filter(cp => cp.timestamp > completedCp.timestamp);
          if (remaining.length === 0 && !completed) {
            setCompleted(true);
            onComplete?.();
          }
          playVideo();
        }, 1500);
      } else {
        // Wrong answer — rewind to start of checkpoint section
        setTimeout(() => {
          const prevTimestamp = lastCheckpointIdx.current > 0
            ? checkpoints[lastCheckpointIdx.current - 1].timestamp
            : 0;
          seekingRef.current = true;
          seekTo(prevTimestamp);
          lastCheckpointIdx.current--;
          // Wait for seek to take effect before clearing checkpoint
          // to prevent immediate re-detection of the same checkpoint
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

  // Build embed URL for YouTube/Vimeo
  function getEmbedUrl(url: string): string {
    if (!url) return '';
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?enablejsapi=1&rel=0&modestbranding=1`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?api=1`;
    if (url.includes('embed')) return url;
    return url;
  }

  // Handle direct media time updates
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

  // Handle direct media ended
  const handleEnded = useCallback(() => {
    setCompleted(true);
    setIsPlaying(false);
    updateProgress(100);
    onComplete?.();
  }, [onComplete, updateProgress]);

  // Handle direct media loadedmetadata
  const handleLoadedMeta = useCallback(() => {
    if (videoRef.current && videoRef.current.duration > 0) {
      setTotalDuration(videoRef.current.duration);
    }
  }, []);

  // Parse options for display (API already returns an array; guard against double-parse)
  const options: string[] = activeCheckpoint?.options
    ? (Array.isArray(activeCheckpoint.options)
        ? activeCheckpoint.options
        : (() => {
            try { return JSON.parse(activeCheckpoint.options as string); }
            catch { return []; }
          })())
    : [];

  if (loadingCheckpoints) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={playerContainerRef}>
      {/* Video Player */}
      <div className="relative rounded-xl overflow-hidden bg-black shadow-lg">
        {isDirectMedia ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full aspect-video"
            controls={!activeCheckpoint}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMeta}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            playsInline
          />
        ) : (
          <>
            <div className="w-full aspect-video relative">
              <iframe
                ref={iframeRef}
                src={getEmbedUrl(videoUrl)}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {activeCheckpoint && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                <div className="text-white text-center p-4">
                  <Rewind className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                  <p className="text-lg font-semibold">Checkpoint reached</p>
                  <p className="text-sm text-gray-300">Answer the question to continue</p>
                </div>
              </div>
            )}
          </>
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
                  {options.map((opt: string, i: number) => (
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
