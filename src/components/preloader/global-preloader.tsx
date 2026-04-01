'use client';

import { useEffect, useState, useCallback } from 'react';
import { School, Loader2 } from 'lucide-react';

interface PreloaderQuote {
  id: string;
  quote: string;
  author: string;
}

const DEFAULT_QUOTE: PreloaderQuote = {
  id: 'default',
  quote: 'Education is the passport to the future, for tomorrow belongs to those who prepare for it today.',
  author: 'Malcolm X',
};

export function GlobalPreloader() {
  const [quote, setQuote] = useState<PreloaderQuote>(DEFAULT_QUOTE);
  const [isFading, setIsFading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  const handleComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch('/api/platform/preloader');
        const json = await res.json();
        if (json.success && json.data) {
          setQuote(json.data);
        }
      } catch {
        // Use default quote
      }
    };

    fetchQuote();

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 2500);

    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      handleComplete();
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [handleComplete]);

  if (isComplete) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 40%, #f0fdfa 70%, #ecfdf5 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-pulse">
          <School className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          Skoolar
        </h1>
        <p className="text-sm text-gray-500 font-medium">Empowering Education</p>
      </div>

      <div className="relative mb-10">
        <div className="w-12 h-12 border-4 border-emerald-200 rounded-full" />
        <div className="w-12 h-12 border-4 border-transparent border-t-emerald-500 rounded-full absolute top-0 left-0 animate-spin" />
      </div>

      <div className="max-w-md text-center px-6 animate-fade-in-up">
        <blockquote className="text-gray-600 italic text-base leading-relaxed mb-2">
          &ldquo;{quote.quote}&rdquo;
        </blockquote>
        <cite className="text-emerald-600 text-sm font-medium not-italic">
          — {quote.author}
        </cite>
      </div>

      <div className="absolute bottom-8 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
          />
        ))}
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