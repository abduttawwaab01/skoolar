'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Play, Volume2, ImageIcon, X } from 'lucide-react';
import { handleSilentError } from '@/lib/error-handler';

interface PlatformAdvert {
  id: string;
  title: string;
  description?: string;
  contentType: string;
  mediaUrl?: string;
  mediaType?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkText?: string;
  ctaType: string;
  htmlContent?: string;
  buttonColor: string;
  autoSwipeMs: number;
  position: number;
}

export function AdvertCarousel() {
  const [adverts, setAdverts] = useState<PlatformAdvert[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoSwipeTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAdverts = async () => {
      try {
        const res = await fetch('/api/platform/adverts');
        const json = await res.json();
        if (!cancelled && json.success) setAdverts(json.data);
      } catch (error: unknown) {
        handleSilentError(error, 'Failed to fetch adverts');
      }
    };
    fetchAdverts();
    return () => { cancelled = true; };
  }, []);

  // Auto-swipe
  useEffect(() => {
    if (adverts.length <= 1 || isPaused) return;
    const currentAdvert = adverts[currentIndex];
    const interval = currentAdvert?.autoSwipeMs || 5000;
    if (interval <= 0) return;

    if (autoSwipeTimer.current) clearTimeout(autoSwipeTimer.current);
    autoSwipeTimer.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % adverts.length);
    }, interval);

    return () => {
      if (autoSwipeTimer.current) clearTimeout(autoSwipeTimer.current);
    };
  }, [adverts, currentIndex, isPaused]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setCurrentIndex((prev) => (prev + 1) % adverts.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + adverts.length) % adverts.length);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    touchStartX.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    touchEndX.current = e.clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      handleSwipe(diff > 0 ? 'left' : 'right');
    }
  };

  const trackClick = async (advertId: string, linkUrl?: string) => {
    try {
      await fetch(`/api/platform/adverts/${advertId}/click`, { method: 'POST' });
      } catch (error: unknown) {
        handleSilentError(error, 'Failed to fetch adverts');
      }
    if (linkUrl) window.open(linkUrl, '_blank', 'noopener,noreferrer');
  };

  if (adverts.length === 0) return null;

  const current = adverts[currentIndex];
  const gradients = [
    'from-emerald-500 to-teal-600',
    'from-teal-500 to-cyan-600',
    'from-emerald-600 to-green-700',
    'from-green-500 to-emerald-600',
  ];

  const renderContent = () => {
    switch (current.contentType) {
      case 'image':
        return (
          <div className="relative h-full w-full">
            {current.imageUrl && (
              <img
                src={current.imageUrl}
                alt={current.title}
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h3 className="text-2xl font-bold mb-1">{current.title}</h3>
              {current.description && (
                <p className="text-white/90 text-sm mb-3 max-w-lg">{current.description}</p>
              )}
              {current.linkUrl && current.linkText && (
                <button
                  onClick={() => trackClick(current.id, current.linkUrl)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:scale-105"
                  style={{ backgroundColor: current.buttonColor }}
                >
                  {current.linkText}
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="flex flex-col items-center justify-center h-full p-6 text-white gap-4">
            {current.mediaUrl ? (
              <video
                src={current.mediaUrl}
                controls
                className="w-full max-w-2xl rounded-lg shadow-lg"
                style={{ maxHeight: '300px' }}
              >
                Your browser does not support video.
              </video>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold">{current.title}</h3>
              </div>
            )}
            <h3 className="text-xl font-bold mt-2">{current.title}</h3>
            {current.description && <p className="text-white/80 text-center">{current.description}</p>}
            {current.linkUrl && current.linkText && (
              <button
                onClick={() => trackClick(current.id, current.linkUrl)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:scale-105 mt-2"
                style={{ backgroundColor: current.buttonColor }}
              >
                {current.linkText}
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center h-full p-6 text-white gap-4">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/20 animate-pulse">
              <Volume2 className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold">{current.title}</h3>
            {current.description && <p className="text-white/80 text-center text-sm">{current.description}</p>}
            {current.mediaUrl && (
              <audio controls className="w-full max-w-md mt-2">
                <source src={current.mediaUrl} type={current.mediaType || 'audio/mpeg'} />
                Your browser does not support audio.
              </audio>
            )}
            {current.linkUrl && current.linkText && (
              <button
                onClick={() => trackClick(current.id, current.linkUrl)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:scale-105 mt-2"
                style={{ backgroundColor: current.buttonColor }}
              >
                {current.linkText}
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
        );

      case 'mixed':
        return (
          <div className="flex h-full">
            <div className="w-1/2 h-full relative hidden md:block">
              {current.imageUrl ? (
                <img src={current.imageUrl} alt={current.title} className="h-full w-full object-cover" />
              ) : current.mediaUrl?.match(/\.(mp4|webm|ogg)/i) ? (
                <video src={current.mediaUrl} className="h-full w-full object-cover" muted autoPlay loop />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${gradients[currentIndex % gradients.length]} flex items-center justify-center`}>
                  <ImageIcon className="h-12 w-12 text-white/40" />
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center p-8 text-white">
              <h3 className="text-2xl font-bold mb-2">{current.title}</h3>
              {current.description && (
                <p className="text-white/80 text-sm mb-4">{current.description}</p>
              )}
              {current.htmlContent && (
                <div
                  className="text-white/70 text-sm mb-4 prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: current.htmlContent }}
                />
              )}
              {current.linkUrl && current.linkText && (
                <button
                  onClick={() => trackClick(current.id, current.linkUrl)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium transition-all hover:scale-105 w-fit"
                  style={{ backgroundColor: current.buttonColor }}
                >
                  {current.linkText}
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );

      default: // text
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-white text-center gap-4">
            <h3 className="text-2xl font-bold">{current.title}</h3>
            {current.description && (
              <p className="text-white/80 text-sm max-w-lg">{current.description}</p>
            )}
            {current.linkUrl && current.linkText && (
              <button
                onClick={() => trackClick(current.id, current.linkUrl)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium transition-all hover:scale-105 mt-2"
                style={{ backgroundColor: current.buttonColor }}
              >
                {current.linkText}
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg shadow-md"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Main slide */}
      <div
        className={`relative h-48 md:h-64 bg-gradient-to-r ${gradients[currentIndex % gradients.length]} transition-all duration-500`}
      >
        {renderContent()}
      </div>

      {/* Navigation arrows */}
      {adverts.length > 1 && (
        <>
          <button
            onClick={() => handleSwipe('right')}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleSwipe('left')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {adverts.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {adverts.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}

      {/* Close / dismiss button */}
      <button
        onClick={() => setAdverts([])}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/40 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
