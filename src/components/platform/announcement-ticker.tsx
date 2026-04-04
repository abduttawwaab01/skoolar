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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Smooth cycling through announcements with slide transition
  const transitionTo = useCallback((nextIndex: number) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setIsTransitioning(true);
    transitionTimerRef.current = setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIsTransitioning(false);
    }, 300);
  }, []);

  // Auto-cycle
  useEffect(() => {
    if (visibleAnnouncements.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      const next = (currentIndex + 1) % visibleAnnouncements.length;
      transitionTo(next);
    }, 6000);
    return () => clearInterval(timer);
  }, [visibleAnnouncements.length, isPaused, currentIndex, transitionTo]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => new Set(prev).add(id));
  };

  if (visibleAnnouncements.length === 0) return null;

  const current = visibleAnnouncements[currentIndex] || visibleAnnouncements[0];
  const config = typeConfig[current.type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={`relative border-b ${config.borderColor} ${config.bg} overflow-hidden group`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-full">
        {/* Icon */}
        <div className={`shrink-0 w-7 h-7 rounded-full ${config.iconBg} flex items-center justify-center`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>

        {/* Scrolling Message */}
        <div className="flex-1 overflow-hidden relative h-5">
          <div
            ref={scrollRef}
            className={`whitespace-nowrap absolute inset-0 flex items-center transition-all duration-300 ${
              isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
            }`}
          >
            {current.linkUrl ? (
              <a
                href={current.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${config.textColor} hover:underline text-sm font-medium flex items-center gap-2`}
              >
                <Megaphone className="h-3 w-3 shrink-0" />
                <span>{current.message}</span>
              </a>
            ) : (
              <span className={`${config.textColor} text-sm font-medium flex items-center gap-2`}>
                <Megaphone className="h-3 w-3 shrink-0" />
                {current.message}
              </span>
            )}
          </div>

          {/* Fade edges */}
          <div className={`absolute inset-y-0 left-0 w-8 bg-gradient-to-r ${config.scrollBg} to-transparent pointer-events-none`} />
          <div className={`absolute inset-y-0 right-0 w-8 bg-gradient-to-l ${config.scrollBg} to-transparent pointer-events-none`} />
        </div>

        {/* Dot indicators */}
        {visibleAnnouncements.length > 1 && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {visibleAnnouncements.map((_, idx) => (
              <button
                key={idx}
                onClick={() => transitionTo(idx)}
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
          className={`shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors ${config.textColor} opacity-60 hover:opacity-100`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Marquee animation for long messages */}
      <style jsx>{`
        @keyframes ticker-marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
