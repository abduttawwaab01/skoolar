'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactPlayer from 'react-player';
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

export function CheckpointVideoPlayer({ lessonId, videoUrl, duration: totalMinutes, onComplete }: Props) {
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState('');

  const playerRef = useRef<HTMLVideoElement>(null);
  const lastCheckpointIdx = useRef(-1);
  const seekingRef = useRef(false);

  const totalSecs = totalMinutes * 60;
  const canUseReactPlayer = useMemo(() => !!videoUrl && ReactPlayer.canPlay?.(videoUrl) === true, [videoUrl]);

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
      setIsPlaying(false);
      setActiveCheckpoint(nextCp);
      setSelectedAnswer('');
      setCheckpointResult(null);
    }
  }, [currentTime, checkpoints, activeCheckpoint, completed]);

  // -----------------------------------------------------------------------
  // ReactPlayer handlers (v3 uses standard HTMLVideoElement events)
  // -----------------------------------------------------------------------
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (seekingRef.current) return;
    const video = e.currentTarget;
    const time = video.currentTime;
    const dur = totalDuration || totalMinutes * 60;

    setCurrentTime(time);
    if (dur > 0) {
      const pct = Math.min(100, Math.round((time / dur) * 100));
      setProgress(pct);
      if (pct % 10 === 0) updateProgress(pct);
    }
  }, [totalDuration, totalMinutes, updateProgress]);

  const handleDurationChange = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const dur = e.currentTarget.duration;
    if (dur > 0 && isFinite(dur)) setTotalDuration(dur);
  }, []);

  const handleEnded = useCallback(() => {
    setCompleted(true);
    updateProgress(100);
    onComplete?.();
  }, [onComplete, updateProgress]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    if (!seekingRef.current) setIsPlaying(false);
  }, []);

  const playVideo = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const seekTo = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    if (playerRef.current) playerRef.current.currentTime = seconds;
  }, []);

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

  // Update time display string
  useEffect(() => {
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    if (totalDuration > 0) {
      const tMins = Math.floor(totalDuration / 60);
      const tSecs = Math.floor(totalDuration % 60);
      setTimeDisplay(`${mins}:${secs.toString().padStart(2, '0')} / ${tMins}:${tSecs.toString().padStart(2, '0')}`);
    } else {
      setTimeDisplay(`${mins}:${secs.toString().padStart(2, '0')}`);
    }
  }, [currentTime, totalDuration]);

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
    <div className="space-y-4">
      {/* Video Player */}
      <div className="relative rounded-xl overflow-hidden bg-black shadow-lg">
        {canUseReactPlayer ? (
          <div className="w-full aspect-video relative bg-black">
            <ReactPlayer
              ref={playerRef}
              src={videoUrl}
              width="100%"
              height="100%"
              playing={isPlaying}
              controls
              onReady={() => { setPlayerReady(true); setPlayerError(false); }}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onError={() => { setPlayerError(true); setPlayerReady(false); }}
              config={{
                youtube: { rel: 0, modestbranding: 1, playsinline: 1 } as Record<string, unknown>,
                vimeo: { controls: true } as Record<string, unknown>,
              }}
            />
            {!playerReady && !playerError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <Loader2 className="h-8 w-8 animate-spin text-white/60" />
              </div>
            )}
            {playerError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 text-white/60 text-sm px-4 text-center">
                Video player failed to load. Please refresh and try again.
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
        ) : videoUrl?.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) ? (
          <video
            src={videoUrl}
            className="w-full aspect-video"
            controls={!activeCheckpoint}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              setCurrentTime(video.currentTime);
              const dur = video.duration || totalSecs;
              if (dur > 0) setTotalDuration(dur);
              const pct = Math.min(100, Math.round((video.currentTime / dur) * 100));
              setProgress(pct);
              if (pct % 5 === 0) updateProgress(pct);
            }}
            onLoadedMetadata={(e) => {
              if (e.currentTarget.duration > 0) setTotalDuration(e.currentTarget.duration);
            }}
            onEnded={() => {
              setCompleted(true);
              updateProgress(100);
              onComplete?.();
            }}
            playsInline
          />
        ) : videoUrl ? (
          <iframe
            src={videoUrl}
            className="w-full aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : null}

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
          {timeDisplay && (
            <span className="text-xs font-mono text-gray-400">{timeDisplay}</span>
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
