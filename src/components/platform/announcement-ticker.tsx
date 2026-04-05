'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Info, AlertTriangle, AlertCircle, CheckCircle2, Megaphone } from 'lucide-react';
import { handleSilentError } from '@/lib/error-handler';

interface PlatformAnnouncement {
  id: string;
  message: string;
  type: string;
  linkUrl?: string;
  isActive: boolean;
}

const typeConfig: Record<string, { bg: string; iconBg: string; icon: typeof Info; textColor: string; borderColor: string; scrollBg: string }> = {
  info: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-500',
    icon: Info,
    textColor: 'text-blue-800',
    borderColor: 'border-blue-200',
    scrollBg: 'from-blue-500/0 via-blue-50 to-blue-500/0',
  },
  warning: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
    icon: AlertTriangle,
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    scrollBg: 'from-amber-500/0 via-amber-50 to-amber-500/0',
  },
  urgent: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-500',
    icon: AlertCircle,
    textColor: 'text-red-800',
    borderColor: 'border-red-200',
    scrollBg: 'from-red-500/0 via-red-50 to-red-500/0',
  },
  success: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-500',
    icon: CheckCircle2,
    textColor: 'text-emerald-800',
    borderColor: 'border-emerald-200',
    scrollBg: 'from-emerald-500/0 via-emerald-50 to-emerald-500/0',
  },
};

export function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/platform/announcements');
        const json = await res.json();
        if (!cancelled && json.success) {
          setAnnouncements(json.data);
        }
      } catch (error: unknown) {
        handleSilentError(error, 'Failed to fetch announcements');
      }
    };
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const visibleAnnouncements = announcements.filter((a) => !dismissed.has(a.id));

  // Continuous marquee scrolling
  useEffect(() => {
    if (visibleAnnouncements.length === 0) return;
    
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const config = typeConfig[visibleAnnouncements[currentIndex]?.type] || typeConfig.info;

    const scroll = () => {
      if (isPaused) {
        animationRef.current = requestAnimationFrame(scroll);
        return;
      }

      const containerWidth = scrollContainer.scrollWidth;
      const viewportWidth = scrollContainer.clientWidth;
      
      // Move scroll position
      scrollPositionRef.current += 0.5; // Speed of scroll
      
      // Reset when we've scrolled through all content
      if (scrollPositionRef.current >= containerWidth - viewportWidth + 100) {
        // Move to next announcement
        const nextIndex = (currentIndex + 1) % visibleAnnouncements.length;
        setCurrentIndex(nextIndex);
        scrollPositionRef.current = 0;
      }

      scrollContainer.style.transform = `translateX(-${scrollPositionRef.current}px)`;
      animationRef.current = requestAnimationFrame(scroll);
    };

    animationRef.current = requestAnimationFrame(scroll);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [visibleAnnouncements.length, currentIndex, isPaused]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => new Set(prev).add(id));
  };

  if (visibleAnnouncements.length === 0) return null;

  const current = visibleAnnouncements[currentIndex] || visibleAnnouncements[0];
  const config = typeConfig[current.type] || typeConfig.info;
  const Icon = config.icon;

  // Create a doubled list for seamless looping
  const displayMessages = [...visibleAnnouncements, ...visibleAnnouncements];

  return (
    <div
      className={`relative border-b ${config.borderColor} ${config.bg} overflow-hidden group`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-full">
        {/* Icon */}
        <div className={`shrink-0 w-7 h-7 rounded-full ${config.iconBg} flex items-center justify-center z-10`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>

        {/* Continuous Scrolling Messages */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex items-center gap-8 whitespace-nowrap"
            style={{ willChange: 'transform' }}
          >
            {displayMessages.map((ann, idx) => {
              const annConfig = typeConfig[ann.type] || typeConfig.info;
              const AnnIcon = annConfig.icon;
              
              return (
                <span 
                  key={`${ann.id}-${idx}`} 
                  className={`${annConfig.textColor} text-sm font-medium flex items-center gap-2`}
                >
                  <Megaphone className="h-3 w-3 shrink-0" />
                  {ann.linkUrl ? (
                    <a
                      href={ann.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {ann.message}
                    </a>
                  ) : (
                    ann.message
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Dot indicators */}
        {visibleAnnouncements.length > 1 && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 z-10">
            {visibleAnnouncements.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  scrollPositionRef.current = 0;
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? `w-5 ${config.iconBg}`
                    : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}

        {/* Dismiss button */}
        <button
          onClick={(e) => handleDismiss(current.id, e)}
          className={`shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors ${config.textColor} opacity-60 hover:opacity-100 z-10`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Fade edges */}
      <div className={`absolute inset-y-0 left-0 w-12 bg-gradient-to-r ${config.scrollBg} to-transparent pointer-events-none`} />
      <div className={`absolute inset-y-0 right-0 w-12 bg-gradient-to-l ${config.scrollBg} to-transparent pointer-events-none`} />
    </div>
  );
}
