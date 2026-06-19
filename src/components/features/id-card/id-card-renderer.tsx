'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';

interface IDCardRendererProps {
  cardId?: string;
  schoolId?: string;
  studentId?: string;
  teacherId?: string;
  designId?: string;
  side?: 'front' | 'back';
  className?: string;
}

export function IDCardRenderer({
  cardId,
  schoolId,
  studentId,
  teacherId,
  designId,
  side = 'front',
  className = '',
}: IDCardRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCard();
  }, [cardId, studentId, teacherId, designId, side]);

  async function loadCard() {
    setLoading(true);
    setError(null);
    try {
      let url = '';
      if (cardId) {
        url = `/api/id-cards/${cardId}/${side === 'front' ? 'pdf' : 'pdf'}`;
      } else {
        const res = await fetch('/api/id-cards/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: schoolId || '',
            studentId: studentId || undefined,
            teacherId: teacherId || undefined,
            designId: designId || undefined,
            side,
          }),
        });
        if (!res.ok) throw new Error('Preview failed');
        const html = await res.text();
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
        }
        setLoading(false);
        return;
      }

      if (url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load card');
        const html = await res.text();
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`relative ${className} w-full max-w-[500px] mx-auto`} style={{ width: '85.6mm', height: '53.98mm' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl border border-gray-200">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium text-gray-700">Loading ID card...</p>
          </div>
        </div>
      )}
      {error ? (
        <div className="flex items-center justify-center bg-red-50 rounded-xl text-xs text-red-700 h-full p-6 border border-red-200">
          <div className="text-center">
            <div className="size-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <XCircle className="size-6 text-red-600" />
            </div>
            <p className="text-sm font-medium mb-2">Failed to Load ID Card</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full">
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0 rounded-xl shadow-lg"
            style={{ width: '85.6mm', height: '53.98mm' }}
            title="ID Card"
          />
        </div>
      )}
    </div>
  );
}
