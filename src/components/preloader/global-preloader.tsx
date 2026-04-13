'use client';

import { useEffect, useState } from 'react';
import { School } from 'lucide-react';

interface PreloaderQuote {
  quote: string;
  author: string;
}

const DEFAULT_QUOTE: PreloaderQuote = {
  quote: 'Education is the passport to the future, for tomorrow belongs to those who prepare for it today.',
  author: 'Malcolm X',
};

export function GlobalPreloader() {
  const [quote, setQuote] = useState<PreloaderQuote>(DEFAULT_QUOTE);
  const [isFading, setIsFading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch('/api/platform/preloader');
        const json = await res.json();
        if (json.success && json.data && json.data.quote) {
          setQuote({ quote: json.data.quote, author: json.data.author });
        }
      } catch {
        // Use default quote - already set
      }
    };

    fetchQuote();

    // Exactly 3 seconds of display, then fade out
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 2500);

    const completeTimer = setTimeout(() => {
      setIsComplete(true);
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  if (isComplete) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-1000 ease-in-out ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 40%, #f0fdfa 70%, #ecfdf5 100%)',
      }}
    >
      {/* Background blur effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 size-80 rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-teal-100/50 blur-3xl" />
        <div className="absolute top-1/4 left-1/4 size-40 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-60 rounded-full bg-teal-200/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <School className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Skoolar
          </h1>
          <p className="text-sm text-gray-500 font-medium">Empowering Education</p>
        </div>

        {/* Spinner */}
        <div className="relative mb-10">
          <div className="w-12 h-12 border-4 border-emerald-200 rounded-full" />
          <div className="w-12 h-12 border-4 border-transparent border-t-emerald-500 rounded-full absolute top-0 left-0 animate-spin" />
        </div>

        {/* Quote */}
        <div className="max-w-md text-center px-6 animate-fade-in-up">
          <blockquote className="text-gray-600 italic text-base leading-relaxed mb-2">
            &ldquo;{quote.quote}&rdquo;
          </blockquote>
          <cite className="text-emerald-600 text-sm font-medium not-italic">
            — {quote.author}
          </cite>
        </div>

        {/* Loading dots */}
        <div className="absolute bottom-8 flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}