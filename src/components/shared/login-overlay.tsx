'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';

interface OverlayData {
  id: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaType: string;
  overlayStyle: string;
  backgroundColor: string;
  textColor: string;
  position: string;
  dismissible: boolean;
  showOnce: boolean;
  linkUrl: string | null;
  linkText: string | null;
  priority: number;
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export function LoginOverlay() {
  const { currentUser, currentRole } = useAppStore();
  const [overlays, setOverlays] = useState<OverlayData[]>([]);
  const [visibleOverlays, setVisibleOverlays] = useState<OverlayData[]>([]);
  const [currentOverlayIndex, setCurrentOverlayIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const schoolId = currentUser.schoolId;

  // Fetch overlays
  useEffect(() => {
    if (!schoolId) return;
    const fetchOverlays = async () => {
      try {
        const params = new URLSearchParams({ schoolId, role: currentRole, userId: currentUser.id });
        const res = await fetch(`/api/platform/overlays?${params}`);
        if (res.ok) {
          const json = await res.json();
          const data = (json.data || []) as OverlayData[];
          // Filter out already dismissed "showOnce" overlays
          const dismissed = JSON.parse(localStorage.getItem('skoolar-dismissed-overlays') || '[]') as string[];
          const filtered = data.filter(o => !(o.showOnce && dismissed.includes(o.id)));
          // Sort by priority descending
          filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0));
          setOverlays(filtered);
          setVisibleOverlays(filtered);
        }
      } catch {
        // Silently fail
      } finally {
        setLoaded(true);
      }
    };
    fetchOverlays();
  }, [schoolId, currentRole, currentUser.id]);

  // Dismiss handler
  const dismissOverlay = useCallback((overlayId: string, showOnce: boolean) => {
    if (showOnce) {
      const dismissed = JSON.parse(localStorage.getItem('skoolar-dismissed-overlays') || '[]') as string[];
      if (!dismissed.includes(overlayId)) {
        dismissed.push(overlayId);
        localStorage.setItem('skoolar-dismissed-overlays', JSON.stringify(dismissed));
      }
    }

    setVisibleOverlays(prev => {
      const next = prev.filter(o => o.id !== overlayId);
      setCurrentOverlayIndex(0);
      return next;
    });
  }, []);

  const dismissCurrent = useCallback(() => {
    const current = visibleOverlays[currentOverlayIndex];
    if (current) {
      dismissOverlay(current.id, current.showOnce);
    }
  }, [visibleOverlays, currentOverlayIndex, dismissOverlay]);

  if (!loaded || visibleOverlays.length === 0) return null;

  const currentOverlay = visibleOverlays[currentOverlayIndex];
  if (!currentOverlay) return null;

  const bgStyle = {
    backgroundColor: currentOverlay.backgroundColor || 'rgba(0,0,0,0.8)',
    color: currentOverlay.textColor || '#FFFFFF',
  };

  const renderContent = () => {
    // Image type
    if (currentOverlay.mediaType === 'image' && currentOverlay.imageUrl) {
      return (
        <img
          src={currentOverlay.imageUrl}
          alt={currentOverlay.title || 'Overlay'}
          className="max-w-full max-h-[60vh] object-contain rounded-lg"
        />
      );
    }

    // Video type
    if (currentOverlay.mediaType === 'video' && currentOverlay.videoUrl) {
      const embedUrl = getYouTubeEmbedUrl(currentOverlay.videoUrl);
      if (embedUrl) {
        return (
          <iframe
            src={embedUrl}
            className="w-full aspect-video rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
      return (
        <video
          src={currentOverlay.videoUrl}
          controls
          className="max-w-full max-h-[60vh] rounded-lg"
          autoPlay
          muted
        />
      );
    }

    // Text type (or default)
    return (
      <div
        className="prose prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: currentOverlay.content || currentOverlay.title || '' }}
      />
    );
  };

  // Banner style
  if (currentOverlay.overlayStyle === 'banner') {
    const isTop = currentOverlay.position === 'top';
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: isTop ? -100 : 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isTop ? -100 : 100 }}
          className="fixed left-0 right-0 z-[9999] p-3"
          style={{ ...bgStyle, [isTop ? 'top' : 'bottom']: 0 }}
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {currentOverlay.title && <h3 className="font-semibold text-sm">{currentOverlay.title}</h3>}
              {currentOverlay.content && currentOverlay.mediaType === 'text' && (
                <p className="text-xs opacity-90 line-clamp-2 mt-1" dangerouslySetInnerHTML={{ __html: currentOverlay.content }} />
              )}
              {currentOverlay.linkUrl && (
                <a
                  href={currentOverlay.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs underline mt-1"
                >
                  {currentOverlay.linkText || 'Learn more'} <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {currentOverlay.dismissible && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-full shrink-0"
                onClick={dismissCurrent}
                style={{ color: currentOverlay.textColor }}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          {visibleOverlays.length > 1 && (
            <div className="flex justify-center gap-1 mt-2">
              {visibleOverlays.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentOverlayIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentOverlayIndex ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Fullscreen style
  if (currentOverlay.overlayStyle === 'fullscreen') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={bgStyle}
        >
          <div className="relative max-w-4xl w-full max-h-full overflow-y-auto text-center">
            {currentOverlay.dismissible && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full z-10"
                onClick={dismissCurrent}
                style={{ color: currentOverlay.textColor }}
              >
                <X className="size-5" />
              </Button>
            )}

            {currentOverlay.title && (
              <h2 className="text-2xl font-bold mb-4">{currentOverlay.title}</h2>
            )}

            {renderContent()}

            {currentOverlay.linkUrl && (
              <a
                href={currentOverlay.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 px-6 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium"
                style={{ color: currentOverlay.textColor }}
              >
                {currentOverlay.linkText || 'Learn more'} <ExternalLink className="size-4" />
              </a>
            )}

            {visibleOverlays.length > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {visibleOverlays.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentOverlayIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentOverlayIndex ? 'bg-white' : 'bg-white/30'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Modal style (default)
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={currentOverlay.dismissible ? dismissCurrent : undefined}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative max-w-lg w-full rounded-xl shadow-2xl overflow-hidden"
          style={bgStyle}
          onClick={e => e.stopPropagation()}
        >
          {currentOverlay.dismissible && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-7 w-7 p-0 rounded-full z-10"
              onClick={dismissCurrent}
              style={{ color: currentOverlay.textColor }}
            >
              <X className="size-4" />
            </Button>
          )}

          <div className="p-6">
            {currentOverlay.title && (
              <h2 className="text-lg font-bold mb-3">{currentOverlay.title}</h2>
            )}

            <div className="mb-4">
              {renderContent()}
            </div>

            {currentOverlay.linkUrl && (
              <a
                href={currentOverlay.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium"
                style={{ color: currentOverlay.textColor }}
              >
                {currentOverlay.linkText || 'Learn more'} <ExternalLink className="size-4" />
              </a>
            )}

            {visibleOverlays.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {visibleOverlays.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentOverlayIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentOverlayIndex ? 'bg-white' : 'bg-white/30'}`}
                  />
                ))}
              </div>
            )}

            {currentOverlay.dismissible && (
              <div className="mt-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissCurrent}
                  className="text-xs opacity-70 hover:opacity-100"
                  style={{ color: currentOverlay.textColor }}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
