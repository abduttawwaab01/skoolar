'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Info, AlertTriangle, AlertCircle, CheckCircle2, Megaphone } from 'lucide-react';
import { handleSilentError } from '@/lib/error-handler';

interface PlatformAnnouncement {
  id: string;
  title: string | null;
  message: string;
  type: string;
  targetRoles: string | null;
  targetSchools: string | null;
  linkUrl?: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string | null;
}

const typeConfig: Record<string, { bg: string; iconBg: string; icon: typeof Info; textColor: string; borderColor: string }> = {
  info: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-500',
    icon: Info,
    textColor: 'text-blue-800',
    borderColor: 'border-blue-200',
  },
  warning: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
    icon: AlertTriangle,
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
  },
  urgent: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-500',
    icon: AlertCircle,
    textColor: 'text-red-800',
    borderColor: 'border-red-200',
  },
  success: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-500',
    icon: CheckCircle2,
    textColor: 'text-emerald-800',
    borderColor: 'border-emerald-200',
  },
};

export function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [offset, setOffset] = useState(0);

  // First useEffect - fetch announcements
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

   // Filter announcements - server already filtered by targeting, only handle dismissed locally
   const visibleAnnouncements = announcements.filter((a) => !dismissed.has(a.id));

   // For seamless marquee, duplicate the content
   const marqueeContent = [...visibleAnnouncements, ...visibleAnnouncements];

   // Calculate total width: we need to measure rendered width dynamically
   const [contentWidth, setContentWidth] = useState(0);
   const containerRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
     if (containerRef.current) {
       setContentWidth(containerRef.current.scrollWidth);
     }
   }, [visibleAnnouncements]);

   // Animation loop
   useEffect(() => {
     if (visibleAnnouncements.length === 0 || isPaused || contentWidth === 0) return;

     const interval = setInterval(() => {
       setOffset((prev) => {
         const newOffset = prev - 1;
         // Reset when we've scrolled exactly half (the original content width)
         if (Math.abs(newOffset) >= contentWidth / 2) {
           return 0;
         }
         return newOffset;
       });
     }, 30);

     return () => clearInterval(interval);
   }, [visibleAnnouncements.length, isPaused, contentWidth]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => new Set(prev).add(id));
  };

  if (visibleAnnouncements.length === 0) return null;

  // Get the first announcement's config for styling
  const firstAnn = visibleAnnouncements[0];
  const config = typeConfig[firstAnn?.type] || typeConfig.info;
  const Icon = config.icon;

   // Duplicate content for seamless looping
   const marqueeContent = [...visibleAnnouncements, ...visibleAnnouncements];

   return (
     <div
       className={`relative border-b ${config.borderColor} ${config.bg} overflow-hidden`}
       onMouseEnter={() => setIsPaused(true)}
       onMouseLeave={() => setIsPaused(false)}
     >
       <div className="flex items-center gap-3 py-2 w-full">
         {/* Icon */}
         <div className={`shrink-0 w-7 h-7 rounded-full ${config.iconBg} flex items-center justify-center z-10 ml-2`}>
           <Icon className="h-3.5 w-3.5 text-white" />
         </div>

         {/* Marquee Container - full width, seamless scroll */}
         <div className="flex-1 overflow-hidden relative">
           <div
             ref={containerRef}
             className="flex items-center whitespace-nowrap"
             style={{
               transform: `translateX(${offset}px)`,
               willChange: 'transform',
             }}
           >
             {marqueeContent.map((ann, idx) => {
               const annConfig = typeConfig[ann.type] || typeConfig.info;
               return (
                 <span
                   key={`${ann.id}-${idx}`}
                   className={`${annConfig.textColor} text-sm font-medium flex items-center gap-2 px-6 shrink-0`}
                 >
                   <Megaphone className="h-3 w-3 shrink-0 opacity-70" />
                   {ann.title && <span className="font-bold">{ann.title}:</span>}
                   <span>{ann.message}</span>
                   {ann.linkUrl && (
                     <a
                       href={ann.linkUrl}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="underline hover:opacity-80 ml-2"
                     >
                       Learn more
                     </a>
                   )}
                 </span>
               );
             })}
           </div>
           
           {/* Fade gradients on both ends */}
           <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none" />
           <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
         </div>

         {/* Dismiss button */}
         <button
           onClick={(e) => handleDismiss(firstAnn.id, e)}
           className={`shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors ${config.textColor} opacity-60 hover:opacity-100 z-10 mr-2`}
         >
           <X className="h-3.5 w-3.5" />
         </button>
       </div>
     </div>
   );
}
